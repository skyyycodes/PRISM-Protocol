/**
 * IKA Network collateral integration.
 *
 * IKA Network (https://ika.xyz) provides 2PC-MPC dWallets on a Sui-based chain.
 * A dWallet controls a BTC or ETH address via threshold cryptography.
 *
 * PRISM integration flow:
 *   1. Borrower creates a dWallet on IKA Network (DKG via Sui tx).
 *   2. Borrower transfers BTC/ETH to the dWallet's derived chain address.
 *   3. IKA oracle detects the lock and signs an 81-byte Solana attestation message.
 *   4. Frontend calls buildVerifyCollateralTx() → two-instruction Solana tx:
 *        ix[0]  Ed25519Program native precompile (validates oracle sig)
 *        ix[1]  prism_core::verify_ika_collateral (reads ix[0] via instructions sysvar)
 */

import {
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

// ─── IKA SDK (real, no mocks) ─────────────────────────────────────────────
import {
  IkaClient,
  getNetworkConfig,
  UserShareEncryptionKeys,
  prepareDKGAsync,
  coordinatorTransactions,
  createRandomSessionIdentifier,
  Curve,
} from '@ika.xyz/sdk';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';

import type { PrismCore } from './idl/prism_core';
import { getIkaCollateralPda } from './pda';

// ─────────────────────────────────────────────────────────────────────────────
// Network constants
// ─────────────────────────────────────────────────────────────────────────────

export const IKA_CHAIN = {
  BTC: 0,
  ETH: 1,
  SUI: 2,
} as const;

export type IkaChain = (typeof IKA_CHAIN)[keyof typeof IKA_CHAIN];

/** secp256k1 is used by BTC and ETH dWallets. */
const SECP256K1_CURVE = Curve.SECP256K1;
const SECP256K1_CURVE_NUMBER = 0;

/**
 * IKA testnet fullnode (Sui-compatible RPC endpoint).
 * Set NEXT_PUBLIC_IKA_FULLNODE_URL in .env to override.
 */
const IKA_FULLNODE_URL =
  process.env.NEXT_PUBLIC_IKA_FULLNODE_URL ?? 'https://fullnode.testnet.ika.xyz';

const IKA_NETWORK =
  (process.env.NEXT_PUBLIC_IKA_NETWORK as 'testnet' | 'mainnet') ?? 'testnet';

// ─────────────────────────────────────────────────────────────────────────────
// Oracle attestation message encoding
// Must be byte-identical to verify_ika_collateral.rs layout.
// ─────────────────────────────────────────────────────────────────────────────

const MSG_PREFIX = Buffer.from('ika_atts'); // 8 bytes

export function buildAttestationMessage(
  dwalletId: Uint8Array,
  chainId: IkaChain,
  amountUsdMicro: bigint,
  loanPubkey: PublicKey,
): Buffer {
  const buf = Buffer.alloc(81);
  MSG_PREFIX.copy(buf, 0);
  Buffer.from(dwalletId).copy(buf, 8);
  buf.writeUInt8(chainId, 40);
  buf.writeBigUInt64LE(amountUsdMicro, 41);
  loanPubkey.toBuffer().copy(buf, 49);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Oracle attestation types
// ─────────────────────────────────────────────────────────────────────────────

export interface OracleAttestation {
  signature: Uint8Array;
  oraclePubkey: PublicKey;
  dwalletId: Uint8Array;
  chainId: IkaChain;
  amountUsdMicro: bigint;
  loanPubkey: PublicKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// IKA oracle HTTP client
// ─────────────────────────────────────────────────────────────────────────────

const IKA_ORACLE_URL =
  process.env.NEXT_PUBLIC_IKA_ORACLE_URL ?? 'https://oracle.ika.xyz/v1';

/**
 * Fetch oracle attestation for a locked dWallet collateral.
 * Real HTTP call to IKA oracle — returns 404 until lock is confirmed on-chain.
 */
export async function getOracleAttestation(
  dwalletId: Uint8Array,
  chainId: IkaChain,
  loanPubkey: PublicKey,
): Promise<OracleAttestation> {
  const res = await fetch(`${IKA_ORACLE_URL}/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dwallet_id: Buffer.from(dwalletId).toString('hex'),
      chain_id: chainId,
      loan_pubkey: loanPubkey.toBase58(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IKA oracle (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    signature: Buffer.from(data.signature, 'hex'),
    oraclePubkey: new PublicKey(data.oracle_pubkey),
    dwalletId,
    chainId,
    amountUsdMicro: BigInt(data.amount_usd_micro),
    loanPubkey,
  };
}

export async function pollOracleAttestation(
  dwalletId: Uint8Array,
  chainId: IkaChain,
  loanPubkey: PublicKey,
  opts = { intervalMs: 10_000, timeoutMs: 300_000 },
): Promise<OracleAttestation> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await getOracleAttestation(dwalletId, chainId, loanPubkey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('404')) throw e;
    }
    await new Promise((r) => setTimeout(r, opts.intervalMs));
  }
  throw new Error(`IKA oracle did not confirm lock within ${opts.timeoutMs / 1000}s`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana two-instruction tx builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the ed25519 + verify_ika_collateral transaction.
 * ix[0] = native ed25519 precompile (Solana validates oracle sig atomically)
 * ix[1] = verify_ika_collateral anchor instruction (reads ix[0] via sysvar)
 */
export async function buildVerifyCollateralTx(
  program: Program<PrismCore>,
  attestation: OracleAttestation,
  configPda: PublicKey,
): Promise<Transaction> {
  const { signature, oraclePubkey, dwalletId, chainId, amountUsdMicro, loanPubkey } = attestation;
  const [ikaCollateralPda] = getIkaCollateralPda(loanPubkey);
  const message = buildAttestationMessage(dwalletId, chainId, amountUsdMicro, loanPubkey);

  const ed25519Ix: TransactionInstruction = Ed25519Program.createInstructionWithPublicKey({
    publicKey: oraclePubkey.toBytes(),
    message: new Uint8Array(message),
    signature: new Uint8Array(signature),
  });

  const verifyIx = await program.methods
    .verifyIkaCollateral()
    .accounts({
      signer: program.provider.publicKey!,
      config: configPda,
      loan: loanPubkey,
      ikaCollateral: ikaCollateralPda,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  const tx = new Transaction();
  tx.add(ed25519Ix, verifyIx);
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// dWallet creation via IKA SDK
// ─────────────────────────────────────────────────────────────────────────────

export interface IkaDwalletInfo {
  /** 32-byte dWallet Sui object ID, stripped of 0x prefix. */
  dwalletId: Uint8Array;
  /** Full Sui object ID string for display / IKA dashboard. */
  dwalletObjectId: string;
}

/**
 * Create a new IKA dWallet using the 2PC-MPC DKG process.
 *
 * Prerequisites:
 *   - Sui keypair with SUI and IKA tokens for gas
 *   - NEXT_PUBLIC_IKA_FULLNODE_URL in .env (default: https://fullnode.testnet.ika.xyz)
 *   - NEXT_PUBLIC_IKA_NETWORK in .env (default: testnet)
 *
 * @param suiKeypair  Sui Ed25519Keypair that pays gas and owns the resulting dWallet
 * @param entropy     32 random bytes for DKG session uniqueness (use crypto.getRandomValues)
 */
export async function createIkaDwallet(
  suiKeypair: Ed25519Keypair,
  entropy: Uint8Array,
): Promise<IkaDwalletInfo> {
  const ikaConfig = getNetworkConfig(IKA_NETWORK);
  const suiClient = new SuiJsonRpcClient({ url: IKA_FULLNODE_URL, network: IKA_NETWORK });
  const ikaClient = new IkaClient({ suiClient, config: ikaConfig, cache: true });
  await ikaClient.initialize();

  // Derive deterministic user-share encryption keys from the keypair's seed.
  const rootSeed = decodeSuiPrivateKey(suiKeypair.getSecretKey()).secretKey;
  const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
    rootSeed,
    SECP256K1_CURVE,
  );

  const senderAddress = suiKeypair.toSuiAddress();

  // Register encryption key if not present (idempotent — safe to call twice).
  const existingEncKey = await ikaClient.getActiveEncryptionKey(senderAddress).catch(() => null);
  if (!existingEncKey) {
    const regTx = new SuiTransaction();
    const coordRef = regTx.sharedObjectRef({
      objectId: ikaConfig.objects.ikaDWalletCoordinator.objectID,
      initialSharedVersion: ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion,
      mutable: true,
    });
    const encKeySig = await userShareEncryptionKeys.getEncryptionKeySignature();
    coordinatorTransactions.registerEncryptionKeyTx(
      ikaConfig,
      coordRef,
      SECP256K1_CURVE_NUMBER,
      userShareEncryptionKeys.encryptionKey,
      encKeySig,
      suiKeypair.getPublicKey().toRawBytes(),
      regTx,
    );
    await suiClient.signAndExecuteTransaction({ transaction: regTx, signer: suiKeypair });
  }

  // DKG: CPU-intensive WASM computation (runs in-browser / Node).
  const networkEncKey = await ikaClient.getLatestNetworkEncryptionKey();
  const dkgOutput = await prepareDKGAsync(
    ikaClient,
    SECP256K1_CURVE,
    userShareEncryptionKeys,
    entropy,
    senderAddress,
  );

  // The encryption key address used in the DKG request is the Sui address
  // that owns the registered encryption key.
  const encKeyObj = await ikaClient.getActiveEncryptionKey(senderAddress);
  const encKeyAddress = (encKeyObj as unknown as { id: { id: string } }).id.id;

  // Submit the DKG + session-identifier registration in one Sui transaction.
  const dkgTx = new SuiTransaction();
  const coordRef = dkgTx.sharedObjectRef({
    objectId: ikaConfig.objects.ikaDWalletCoordinator.objectID,
    initialSharedVersion: ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion,
    mutable: true,
  });

  // Register a random session identifier — result is a Move object used in DKG.
  const sessionBytes = createRandomSessionIdentifier();
  const sessionId = coordinatorTransactions.registerSessionIdentifier(
    ikaConfig,
    coordRef,
    sessionBytes,
    dkgTx,
  );

  // Fee coins: split from the gas object (IKA Network accepts SUI for fees on testnet).
  const [ikaCoin] = dkgTx.splitCoins(dkgTx.gas, [dkgTx.pure.u64(0)]);
  const [suiCoin] = dkgTx.splitCoins(dkgTx.gas, [dkgTx.pure.u64(0)]);

  coordinatorTransactions.requestDWalletDKG(
    ikaConfig,
    coordRef,
    networkEncKey.id,
    SECP256K1_CURVE_NUMBER,
    dkgOutput.userDKGMessage,
    dkgOutput.encryptedUserShareAndProof,
    encKeyAddress,
    dkgOutput.userPublicOutput,
    suiKeypair.getPublicKey().toRawBytes(),
    sessionId,
    null,
    ikaCoin,
    suiCoin,
    dkgTx,
  );

  const dkgResult = await suiClient.signAndExecuteTransaction({
    transaction: dkgTx,
    signer: suiKeypair,
    options: { showObjectChanges: true },
  });

  // Extract the created dWallet object ID from the tx result.
  const createdObjects = dkgResult.objectChanges?.filter(
    (change): change is Extract<
      NonNullable<typeof dkgResult.objectChanges>[number],
      { type: 'created' }
    > => change.type === 'created',
  ) ?? [];

  // The dWallet object is the first newly created object in the transaction.
  const dwalletObj = createdObjects.find(
    (change) => String(change.objectType).includes('DWallet'),
  );

  if (!dwalletObj) {
    throw new Error('DKG transaction completed but no DWallet object found in result');
  }

  const objectId = dwalletObj.objectId; // "0x<64 hex chars>"
  const dwalletId = Buffer.from(objectId.replace('0x', ''), 'hex');

  return { dwalletId, dwalletObjectId: objectId };
}
