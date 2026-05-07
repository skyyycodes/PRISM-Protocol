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

import { Buffer } from 'buffer';

// Aggressive Buffer polyfill for 64-bit support in browser
if (typeof window !== 'undefined') {
  console.log('PRISM: Initializing Buffer polyfill...');
  (window as any).Buffer = (window as any).Buffer || Buffer;
  
  const patch = (proto: any, name: string, fn: Function) => {
    if (!proto[name]) {
      Object.defineProperty(proto, name, {
        value: fn,
        writable: true,
        configurable: true
      });
    }
  };

  patch(Buffer.prototype, 'writeBigUInt64LE', function(this: Buffer, value: bigint, offset: number = 0) {
    const view = new DataView(this.buffer, this.byteOffset + offset, 8);
    view.setBigUint64(0, value, true);
    return offset + 8;
  });

  patch(Buffer.prototype, 'readBigUInt64LE', function(this: Buffer, offset: number = 0) {
    const view = new DataView(this.buffer, this.byteOffset + offset, 8);
    return view.getBigUint64(0, true);
  });
}

import {
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

// @ts-ignore
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { ethers } from 'ethers';
// @ts-ignore
import type { SuiTransactionBlockResponse } from '@mysten/sui/jsonRpc';

// Initialize ecc for bitcoinjs-lib
bitcoin.initEccLib(ecc);

import type { PrismCore } from './idl/prism_core';
import { getIkaCollateralPda } from './pda';

function normalizeSuiAddress(addr: string): string {
  if (!addr) return '';
  let s = addr.toLowerCase();
  if (s.startsWith('0x')) s = s.slice(2);
  return '0x' + s.padStart(64, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// Network constants
// ─────────────────────────────────────────────────────────────────────────────

export const IKA_CHAIN = {
  BTC: 0,
  ETH: 1,
  SUI: 2,
} as const;

export type IkaChain = (typeof IKA_CHAIN)[keyof typeof IKA_CHAIN];

const SECP256K1_CURVE_NUMBER = 0;

export const IKA_NETWORK = (process.env.NEXT_PUBLIC_IKA_NETWORK as 'testnet' | 'mainnet') || 'testnet';
export const IKA_FULLNODE_URL = process.env.NEXT_PUBLIC_IKA_FULLNODE_URL || 'https://sui-testnet-rpc.publicnode.com';
// We'll use our proxy for client-side calls to avoid CORS issues
const CLIENT_RPC_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol}//${window.location.host}/api/sui-proxy` 
  : IKA_FULLNODE_URL;

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
  
  console.log('PRISM DEBUG: Oracle Signature:', Buffer.from(signature).toString('hex'));
  console.log('PRISM DEBUG: Attestation Message:', Buffer.from(message).toString('hex'));
  console.log('PRISM DEBUG: Message Layout:', {
    prefix: Buffer.from(message.slice(0, 8)).toString(),
    dwalletId: Buffer.from(message.slice(8, 40)).toString('hex'),
    chainId: message[40],
    amount: Buffer.from(message.slice(41, 49)).readBigUInt64LE().toString(),
    loan: new PublicKey(message.slice(49, 81)).toBase58()
  });

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

export type IkaDkgStep =
  | 'initializing'
  | 'preparing_keys'
  | 'registering_encryption_key'
  | 'running_dkg_wasm'
  | 'submitting_sui_tx'
  | 'extracting_dwallet';

/**
 * Create a new IKA dWallet using the 2PC-MPC DKG process.
 *
 * @param address     Connected Sui address
 * @param rootSeed    Seed for encryption keys (derived via signPersonalMessage in UI)
 * @param signAndExecute Callback to execute Sui transactions via wallet
 * @param onProgress  Optional callback for multi-step progress reporting
 */
export async function createIkaDwallet(
  address: string,
  rootSeed: Uint8Array,
  signAndExecute: (tx: SuiTransaction, client: any) => Promise<{ digest: string }>,
  onProgress?: (step: IkaDkgStep) => void,
): Promise<IkaDwalletInfo> {
  // Dynamic import — deferred so the SDK never loads on page load.
  const {
    IkaClient,
    getNetworkConfig,
    UserShareEncryptionKeys,
    prepareDKG,
    IkaTransaction,
    Curve,
  } = await import('@ika.xyz/sdk');
  // @ts-ignore
  const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc');
  onProgress?.('initializing');
  const ikaConfig = getNetworkConfig(IKA_NETWORK);
  console.log('PRISM: createIkaDwallet ikaConfig:', JSON.stringify(ikaConfig, null, 2));
  
  const suiClient = new SuiJsonRpcClient({ url: CLIENT_RPC_URL, network: 'testnet' });

  const ikaClient = new IkaClient({ suiClient, config: ikaConfig, cache: true });
  await ikaClient.initialize();

  onProgress?.('preparing_keys');

  let retryCount = 0;
  const userShareEncryptionKeys = await UserShareEncryptionKeys.fromRootSeedKey(
    rootSeed,
    Curve.SECP256K1,
  );

  const senderAddress = address;
  const encKeyAddress = userShareEncryptionKeys.getSuiAddress();
  console.log('PRISM: Using sender address:', senderAddress);
  console.log('PRISM: Using encryption key address:', encKeyAddress);

  // Register encryption key if not present.
  let existingEncKey = null;
  
  // 1. Resolve the encryption keys table ID dynamically.
  let encryptionKeysTableId = '';
  try {
    const coordId = (ikaClient as any).ikaConfig.objects.ikaDWalletCoordinator.objectID;
    const coordObj = await (suiClient as any).getObject({ id: coordId, objectId: coordId, options: { showContent: true } });
    const innerId = (coordObj.data?.content as any)?.fields?.version?.fields?.value;
    if (innerId) {
      const innerObj = await (suiClient as any).getObject({ id: innerId, objectId: innerId, options: { showContent: true } });
      const fields = (innerObj.data?.content as any)?.fields;
      const userEncKeys = fields?.encryption_keys;
      encryptionKeysTableId = userEncKeys?.fields?.id?.id;
    }
  } catch (err) {
    console.warn('PRISM: Could not resolve encryption keys table ID dynamically:', err);
  }

  // 2. Try to find the key.
  try {
    console.log(`PRISM: Checking for existing encryption key for ${encKeyAddress}...`);
    // Try SDK first
    existingEncKey = await ikaClient.getActiveEncryptionKey(encKeyAddress);
    console.log('PRISM: Existing encryption key found via SDK');
  } catch (sdkErr: any) {
    // If SDK fails with RangeError or not found, try manual lookup if we have the table ID
    if (encryptionKeysTableId) {
      try {
        console.log('PRISM: SDK failed/RangeError, trying manual dynamic field lookup...');
        const match = await suiClient.getDynamicFieldObject({
          parentId: encryptionKeysTableId,
          name: { type: 'address', value: encKeyAddress }
        });
        if (match.data) {
          console.log('PRISM: Manual lookup found existing key:', match.data.objectId);
          existingEncKey = { id: { id: match.data.objectId } };
        }
      } catch (manualErr) {
        console.log('PRISM: Manual lookup also failed (normal if new user)');
      }
    }
    
    if (!existingEncKey) {
      console.log('PRISM: No existing encryption key found. Proceeding to registration.');
    }
  }

  if (!existingEncKey) {
    onProgress?.('registering_encryption_key');
    console.log('PRISM: Starting encryption key registration...');
    const regTx = new SuiTransaction();
    regTx.setSender(senderAddress);
    
    const ikaTx = new IkaTransaction({ ikaClient, transaction: regTx, userShareEncryptionKeys });
    await ikaTx.registerEncryptionKey({ curve: Curve.SECP256K1 });
    try {
      console.log('PRISM: Starting encryption key registration transaction...');
      const { digest: regDigest } = await signAndExecute(regTx, suiClient);
      if (regDigest !== 'ALREADY_REGISTERED') {
        await suiClient.waitForTransaction({ digest: regDigest });
        console.log('PRISM: Encryption key registered successfully. Waiting 5s for consistency...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.warn('PRISM: Registration skipped (already exists).');
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.log('PRISM: Caught registration error (raw):', err);
      
      // Aggressive check for any abort code 0 or dynamic field error.
      const isAlreadyRegistered = 
        errMsg.includes('abort code: 0') || 
        errMsg.includes('dynamic_field::add') || 
        errMsg.includes('AlreadyExists') ||
        (err.toString && err.toString().includes('abort code: 0'));

      if (isAlreadyRegistered) {
        console.warn('PRISM: Detected existing registration via MoveAbort, continuing to DKG (after 2s delay)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('PRISM: Terminal registration error:', errMsg);
        throw err;
      }
    }
  } else {
    console.log('PRISM: Skipping registration, encryption key already exists.');
  }

  // DKG: CPU-intensive WASM computation (runs in-browser / Node).
  onProgress?.('running_dkg_wasm');

  // Fetch the network encryption key and protocol parameters together, then run the
  // WASM DKG computation with the SAME key — this guarantees the key ID we pass to
  // requestDWalletDKG matches what the WASM used, preventing NetworkRejectedDKGVerification.
  let networkEncKey: any;
  let networkKeyId: string | undefined;
  let protocolPublicParameters: Uint8Array | undefined;
  retryCount = 0;
  while (retryCount < 3) {
    try {
      networkEncKey = await ikaClient.getLatestNetworkEncryptionKey();
      console.log('PRISM: networkEncKey received:', JSON.stringify(networkEncKey, null, 2));

      const rawId = (networkEncKey as any).id?.id || (networkEncKey as any).id || (networkEncKey as any).objectId || networkEncKey;
      networkKeyId = typeof rawId === 'string' ? rawId : (rawId && typeof rawId === 'object' ? (rawId.id || rawId.objectId) : undefined);
      
      console.log('PRISM: networkKeyId resolved to:', networkKeyId);

      if (!networkKeyId || typeof networkKeyId !== 'string') {
        throw new Error(`Invalid Sui Object id: resolved to ${typeof networkKeyId} instead of string`);
      }

      // The SDK is the only source-of-truth for protocol_public_parameters.
      // The deep-search-through-Sui-objects path that lived here previously was unsafe:
      // it grabbed the first numeric array ≥ 64 bytes and treated it as params, which
      // produced a 45 MB blob (an unrelated serialized object). Feeding that into
      // prepareDKG yielded a malformed output that IKA's network later rejected with
      // NetworkRejectedDKGVerification.
      protocolPublicParameters = await ikaClient.getProtocolPublicParameters(
        undefined,
        Curve.SECP256K1,
      );
      console.log('PRISM: protocolPublicParameters length:', protocolPublicParameters?.length);
      break;
    } catch (err) {
      console.warn(`IKA: Attempt ${retryCount + 1} to fetch network key/params failed:`, err);
      retryCount++;
      if (retryCount === 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!protocolPublicParameters) {
    throw new Error(
      'IKA SDK getProtocolPublicParameters returned no parameters. ' +
      'Cannot run DKG without authentic protocol params.',
    );
  }

  // CRITICAL: this `entropy` (bytesToHash) must be byte-identical to the
  // sessionIdentifier registered on-chain in the Sui tx below. prepareDKG bakes
  // keccak_256(senderAddress || entropy) into the user's DKG output. The network
  // recomputes that digest from the on-chain session identifier and rejects with
  // NetworkRejectedDKGVerification if the bytes don't match. Using
  // ikaTx.createSessionIdentifier() (random) instead of registerSessionIdentifier(entropy)
  // produces a different value on-chain and the verification fails.
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  console.log('PRISM: DKG session entropy (hex):', Buffer.from(entropy).toString('hex'));

  let dkgOutput;
  retryCount = 0;
  while (retryCount < 3) {
    try {
      console.log(`PRISM: Running DKG preparation (attempt ${retryCount + 1})...`);
      dkgOutput = await prepareDKG(
        protocolPublicParameters,
        Curve.SECP256K1,
        (userShareEncryptionKeys as any).encryptionKey,
        entropy,
        senderAddress,
      );
      break;
    } catch (err) {
      console.warn(`IKA: DKG preparation attempt ${retryCount + 1} failed:`, err);
      retryCount++;
      if (retryCount === 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!dkgOutput) throw new Error('Failed to generate DKG output');

  console.log(`[${new Date().toISOString()}] PRISM: DKG preparation finished. Moving to key retrieval...`);
  console.log('PRISM: DKG output type:', typeof dkgOutput, 'keys:', dkgOutput && Object.keys(dkgOutput as object));
  console.log('PRISM: protocolPublicParameters used length:', protocolPublicParameters?.length);

  // Use the existing encryption key object we resolved earlier.
  let encKeyObj = existingEncKey;
  
  if (!encKeyObj) {
    // Final attempt to resolve if somehow missing
    try {
      console.log('PRISM: Final attempt to resolve encryption key...');
      encKeyObj = await ikaClient.getActiveEncryptionKey(encKeyAddress);
    } catch (e) {
      console.error('PRISM: Final key resolution failed. Cannot proceed with DKG.');
      throw new Error('Encryption key not found or registered.');
    }
  }

  // Submit the DKG + session-identifier registration in one Sui transaction.
  const dkgTx = new SuiTransaction();
  dkgTx.setSender(senderAddress);
  const coordRef = dkgTx.sharedObjectRef({
    objectId: ikaConfig.objects.ikaDWalletCoordinator.objectID,
    initialSharedVersion: ikaConfig.objects.ikaDWalletCoordinator.initialSharedVersion,
    mutable: true,
  });

  const ikaTx = new IkaTransaction({ ikaClient, transaction: dkgTx, userShareEncryptionKeys });
  // Register the SAME entropy bytes that were hashed into the DKG output above.
  // ikaTx.createSessionIdentifier() generates fresh random bytes and would mismatch.
  const sessionId = ikaTx.registerSessionIdentifier(entropy);

  const ikaCoinType = `${ikaConfig.packages.ikaPackage}::ika::IKA`;
  console.log('PRISM: Resolving IKA coin for fee...', ikaCoinType);
  const userIkaCoins = await suiClient.getCoins({
    owner: senderAddress,
    coinType: ikaCoinType,
  });

  let ikaCoin;
  let ikaCoinNeedsTransfer = false;
  if (userIkaCoins.data.length > 0) {
    console.log('PRISM: Found IKA coin(s), using:', userIkaCoins.data[0].coinObjectId);
    ikaCoin = dkgTx.object(userIkaCoins.data[0].coinObjectId);
  } else {
    console.log('PRISM: No IKA coins found, creating zero coin.');
    const [zeroIka] = dkgTx.moveCall({
      target: '0x2::coin::zero',
      typeArguments: [ikaCoinType],
    });
    ikaCoin = zeroIka;
    ikaCoinNeedsTransfer = true;
  }

  // Fee coins: split from the gas object (IKA Network accepts SUI for fees on testnet).
  // Use 1 MIST instead of 0 to avoid potential wallet extension validation issues.
  const [suiCoin] = dkgTx.splitCoins(dkgTx.gas, [dkgTx.pure.u64(1)]);

  const dkgTxResult = await ikaTx.requestDWalletDKG({
    dkgRequestInput: dkgOutput,
    ikaCoin,
    suiCoin,
    sessionIdentifier: sessionId,
    dwalletNetworkEncryptionKeyId: networkKeyId!,
    curve: Curve.SECP256K1,
  });

  // CLEANUP: Sui Programmable Transactions require all created/split objects to be 
  // consumed or transferred. Since coins and capabilities were passed by reference
  // or returned, we must send them back to the owner.
  // Note: dkgTxResult[0] is the DWalletCap (an object). dkgTxResult[1] is an 
  // Option<ID> (a value with the drop ability), so it doesn't need to be transferred.
  const objectsToTransfer: any[] = [suiCoin, dkgTxResult[0]];
  if (ikaCoinNeedsTransfer) {
    objectsToTransfer.push(ikaCoin);
  }
  dkgTx.transferObjects(objectsToTransfer, senderAddress);

  onProgress?.('submitting_sui_tx');
  const { digest } = await signAndExecute(dkgTx, suiClient);

  // Extract the created dWallet object ID from the tx result.
  onProgress?.('extracting_dwallet');
  let dkgResult;
  retryCount = 0;
  while (retryCount < 5) { // 5 retries for the final tx, as it's the most critical
    try {
      dkgResult = await suiClient.waitForTransaction({
        digest,
        options: {
          showObjectChanges: true,
        },
      });
      break;
    } catch (err) {
      console.warn(`IKA: Attempt ${retryCount + 1} to wait for DKG transaction failed:`, err);
      retryCount++;
      if (retryCount === 5) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!dkgResult) throw new Error('Failed to retrieve DKG transaction result');

  const createdObjects = dkgResult.objectChanges?.filter(
    (change: any): change is Extract<
      NonNullable<typeof dkgResult.objectChanges>[number],
      { type: 'created' }
    > => change.type === 'created',
  ) ?? [];

  console.log('PRISM: DKG tx created objects:',
    createdObjects.map((c: any) => `${c.objectType} @ ${c.objectId}`).join('\n  '));

  // Match exactly ::DWallet (not DWalletCap, DWalletCoordinator, etc.)
  // ::DWallet is always non-generic and ends the type string.
  const dwalletObj = createdObjects.find(
    (change: any) => /::DWallet$/.test(String(change.objectType)),
  );

  // Fallback: if DWallet wasn't in createdObjects (e.g. added to ObjectTable as child object),
  // find the DWalletCap and extract its dwallet_id field.
  if (!dwalletObj) {
    const capObj = createdObjects.find(
      (change: any) => /::DWalletCap$/.test(String(change.objectType)),
    );
    if (capObj) {
      console.log('PRISM: DWallet not in createdObjects; resolving via DWalletCap', capObj.objectId);
      const { CoordinatorInnerModule } = await import('@ika.xyz/sdk');
      const capRpc = await suiClient.getObject({
        id: capObj.objectId,
        options: { showBcs: true },
      });
      const capBcs = (capRpc as any).data?.bcs?.bcsBytes;
      if (capBcs) {
        const cap = CoordinatorInnerModule.DWalletCap.parse(
          Buffer.from(capBcs, 'base64'),
        ) as any;
        const resolvedId = '0x' + Buffer.from(cap.dwallet_id as Uint8Array).toString('hex');
        console.log('PRISM: Resolved dWallet ID from DWalletCap:', resolvedId);
        const dwalletId = Buffer.from(resolvedId.replace('0x', ''), 'hex');
        return { dwalletId, dwalletObjectId: resolvedId };
      }
    }
    throw new Error('DKG transaction completed but no DWallet object found in result');
  }

  const objectId = dwalletObj.objectId; // "0x<64 hex chars>"
  const dwalletId = Buffer.from(objectId.replace('0x', ''), 'hex');
  console.log('PRISM: dWallet object ID:', objectId);

  return { dwalletId, dwalletObjectId: objectId };
}

/**
 * Retrieves the target chain (BTC/ETH) address for a specific IKA dWallet.
 *
 * Uses the IKA SDK's IkaClient.getDWallet() which fetches raw BCS bytes via
 * IKA's specialized client (not standard Sui JSON-RPC), then parses the full
 * DWallet struct including the nested state.Active.public_output field.
 * publicKeyFromDWalletOutput() (WASM) extracts the 33-byte secp256k1 pubkey.
 */
export async function getDWalletAddress(
  dwalletObjectId: string,
  chainId: IkaChain,
): Promise<string> {
  console.log(`PRISM: Fetching dWallet object ${dwalletObjectId}...`);

  try {
    const {
      IkaClient,
      getNetworkConfig,
      publicKeyFromDWalletOutput,
      Curve,
    } = await import('@ika.xyz/sdk');
    // @ts-ignore
    const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc');

    const ikaConfig = getNetworkConfig(IKA_NETWORK);
    console.log('PRISM: ikaConfig:', JSON.stringify(ikaConfig, null, 2));
    console.log('PRISM: dwalletObjectId to fetch:', dwalletObjectId);
    const suiClient = new SuiJsonRpcClient({ url: CLIENT_RPC_URL, network: 'testnet' });
    const ikaClient = new IkaClient({ suiClient, config: ikaConfig, cache: true });
    await ikaClient.initialize();

    // getDWallet uses IKA's core client which returns raw BCS bytes,
    // bypassing the fields:{} problem with standard Sui JSON-RPC.
    // Poll until Active state — IKA network needs a moment to verify DKG output.
    let dwallet: any;
    try {
      dwallet = await ikaClient.getDWalletInParticularState(dwalletObjectId, 'Active', {
        timeoutMs: 120_000,
        pollingIntervalMs: 3_000,
      });
    } catch (pollErr) {
      // If polling throws "not found" or "deleted", fall through to the outer catch.
      const pollMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
      if (pollMsg.includes('deleted') || pollMsg.includes('not found') || pollMsg.includes('does not exist')) {
        throw pollErr;
      }
      // Timeout or other — try a single fetch to get the current state for a better error message.
      dwallet = await ikaClient.getDWallet(dwalletObjectId);
    }

    // public_output is in state.Active (guaranteed by getDWalletInParticularState)
    const state = (dwallet as any).state;
    const publicOutput: number[] | undefined =
      state?.Active?.public_output ??
      state?.AwaitingKeyHolderSignature?.public_output;

    if (!publicOutput || publicOutput.length === 0) {
      const kind = state?.$kind ?? 'unknown';
      const isRejected = kind.includes('Rejected');
      throw new Error(
        isRejected
          ? `dWallet DKG was rejected by the IKA network (state: ${kind}). ` +
            `Please create a new dWallet — the current one cannot be recovered.`
          : `dWallet is not yet Active (current state: ${kind}). ` +
            `Wait for the IKA network to finish DKG verification before fetching the deposit address.`,
      );
    }

    // WASM call: extracts the 33-byte compressed secp256k1 pubkey from the DKG output blob
    const pkBytes = await publicKeyFromDWalletOutput(Curve.SECP256K1, Uint8Array.from(publicOutput));
    if (!pkBytes || pkBytes.length !== 33) {
      throw new Error(`publicKeyFromDWalletOutput returned invalid key (${pkBytes?.length ?? 0} bytes)`);
    }

    const pkBuf = Buffer.from(pkBytes);
    console.log('PRISM: Derived public key:', pkBuf.toString('hex').slice(0, 16) + '...');

    if (chainId === IKA_CHAIN.BTC) {
      const network = bitcoin.networks.testnet;
      const { address } = bitcoin.payments.p2wpkh({ pubkey: pkBuf, network });
      if (!address) throw new Error('Failed to derive BTC address from public key');
      return address;
    }

    if (chainId === IKA_CHAIN.ETH) {
      return ethers.computeAddress('0x' + pkBuf.toString('hex'));
    }

    return dwalletObjectId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Deleted object — surface with a typed code so the UI can show a helpful message.
    if (msg.includes('deleted') || msg.includes('notExists') || msg.includes('not found')) {
      const e = new Error(
        `dWallet object was deleted on Sui testnet (pruning or testnet reset). ` +
        `Recreate your dWallet to get a new deposit address.`,
      );
      (e as any).code = 'DWALLET_DELETED';
      throw e;
    }

    throw new Error(`getDWalletAddress: could not derive real chain address for ${dwalletObjectId}: ${msg}`);
  }
}
