/**
 * Encrypt Protocol (FHE / REFHE) integration.
 *
 * The Encrypt FHE oracle runs homomorphic computation on encrypted borrower
 * data and proves boolean conditions (e.g. `total_repaid < principal`) without
 * revealing the underlying numbers. The oracle signs a 73-byte attestation
 * that the on-chain `verify_encrypt_default` instruction reads via the Solana
 * instructions sysvar — same pattern as IKA, different message layout.
 *
 *   ix[0]  Ed25519Program native precompile (validates oracle sig)
 *   ix[1]  prism_core::verify_encrypt_default (reads ix[0] via sysvar,
 *                                              fires the credit-event cascade)
 */

import { Buffer } from 'buffer';

import {
  Ed25519Program,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import type { PrismCore } from './idl/prism_core';
import { getEncryptHealthPda } from './pda';

// ─────────────────────────────────────────────────────────────────────────────
// Attestation message (73 bytes — must match verify_encrypt_default.rs)
//
//   bytes  0..8    b"enc_atts"
//   bytes  8..40   loan pubkey
//   bytes 40..72   sha256 commitment of borrower's Encrypt-sealed credit data
//   byte  72       result: 0x01 = default proven
// ─────────────────────────────────────────────────────────────────────────────

const MSG_PREFIX = Buffer.from('enc_atts'); // 8 bytes
export const ENCRYPT_MSG_LEN = 73;

export function buildEncryptAttestationMessage(params: {
  loanPubkey: PublicKey;
  scoreCommitment: Uint8Array; // exactly 32 bytes
  defaultProven: boolean;
}): Buffer {
  if (params.scoreCommitment.length !== 32) {
    throw new Error(
      `Encrypt scoreCommitment must be 32 bytes (got ${params.scoreCommitment.length})`,
    );
  }
  const buf = Buffer.alloc(ENCRYPT_MSG_LEN);
  MSG_PREFIX.copy(buf, 0);
  params.loanPubkey.toBuffer().copy(buf, 8);
  Buffer.from(params.scoreCommitment).copy(buf, 40);
  buf.writeUInt8(params.defaultProven ? 0x01 : 0x00, 72);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Oracle attestation type
// ─────────────────────────────────────────────────────────────────────────────

export interface EncryptAttestation {
  /** 64-byte Ed25519 signature from the Encrypt FHE oracle */
  signature: Uint8Array;
  oraclePubkey: PublicKey;
  loanPubkey: PublicKey;
  /** 32-byte sha256 commitment registered at attach time */
  scoreCommitment: Uint8Array;
  /** Result of homomorphic comparison: total_repaid < principal */
  defaultProven: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client for the Encrypt FHE oracle
// ─────────────────────────────────────────────────────────────────────────────

const ENCRYPT_ORACLE_URL =
  process.env.NEXT_PUBLIC_ENCRYPT_ORACLE_URL ?? '/api/encrypt-oracle';

/**
 * Request an FHE default-attestation from the Encrypt oracle.
 *
 * The oracle:
 *   1. Loads the borrower's Encrypt-sealed credit data via score_commitment.
 *   2. Runs `total_repaid < principal` homomorphically inside its FHE circuit.
 *   3. Signs the 73-byte message indicating the result.
 */
export async function getEncryptAttestation(
  loanPubkey: PublicKey,
  scoreCommitment: Uint8Array,
): Promise<EncryptAttestation> {
  const res = await fetch(`${ENCRYPT_ORACLE_URL}/attest_default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loan_pubkey: loanPubkey.toBase58(),
      score_commitment: Buffer.from(scoreCommitment).toString('hex'),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Encrypt oracle (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    signature: Buffer.from(data.signature, 'hex'),
    oraclePubkey: new PublicKey(data.oracle_pubkey),
    loanPubkey,
    scoreCommitment,
    defaultProven: data.default_proven === true,
  };
}

export async function pollEncryptAttestation(
  loanPubkey: PublicKey,
  scoreCommitment: Uint8Array,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<EncryptAttestation> {
  const intervalMs = opts.intervalMs ?? 4_000;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      return await getEncryptAttestation(loanPubkey, scoreCommitment);
    } catch (e: unknown) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('404')) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Encrypt oracle did not respond within ${timeoutMs / 1000}s${lastErr ? `: ${String(lastErr)}` : ''}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Solana two-instruction tx builder
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildVerifyEncryptDefaultTxParams {
  program: Program<PrismCore>;
  attestation: EncryptAttestation;
  configPda: PublicKey;
  vaultPda: PublicKey;
  tranchePrimePda: PublicKey;
  trancheCorePda: PublicKey;
  trancheAlphaPda: PublicKey;
  vaultReservePda: PublicKey;
  lossBucketPda: PublicKey;
  creditEventPda: PublicKey;
  lossAmount: bigint;
  severityBps: number;
}

/**
 * Build the ed25519 + verify_encrypt_default transaction.
 *
 *   ix[0] = native Ed25519 precompile — Solana validates the oracle sig
 *   ix[1] = verify_encrypt_default     — atomically proves default + cascades losses
 */
export async function buildVerifyEncryptDefaultTx(
  params: BuildVerifyEncryptDefaultTxParams,
): Promise<Transaction> {
  const {
    program,
    attestation,
    configPda,
    vaultPda,
    tranchePrimePda,
    trancheCorePda,
    trancheAlphaPda,
    vaultReservePda,
    lossBucketPda,
    creditEventPda,
    lossAmount,
    severityBps,
  } = params;

  const [encryptHealthPda] = getEncryptHealthPda(
    attestation.loanPubkey,
    program.programId,
  );

  const message = buildEncryptAttestationMessage({
    loanPubkey: attestation.loanPubkey,
    scoreCommitment: attestation.scoreCommitment,
    defaultProven: attestation.defaultProven,
  });

  const ed25519Ix: TransactionInstruction = Ed25519Program.createInstructionWithPublicKey({
    publicKey: attestation.oraclePubkey.toBytes(),
    message: new Uint8Array(message),
    signature: new Uint8Array(attestation.signature),
  });

  const verifyIx = await program.methods
    .verifyEncryptDefault(new BN(lossAmount.toString()), severityBps)
    .accounts({
      signer: program.provider.publicKey!,
      config: configPda,
      loan: attestation.loanPubkey,
      encryptHealth: encryptHealthPda,
      vault: vaultPda,
      tranchePrime: tranchePrimePda,
      trancheCore: trancheCorePda,
      trancheAlpha: trancheAlphaPda,
      vaultUsdcReserve: vaultReservePda,
      lossBucket: lossBucketPda,
      creditEvent: creditEventPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  const tx = new Transaction();
  tx.add(ed25519Ix, verifyIx);
  return tx;
}
