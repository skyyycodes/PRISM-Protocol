/**
 * Cloak batch payout integration.
 *
 * Mirrors the Encrypt two-instruction pattern:
 *   ix[0] Ed25519Program signature verify
 *   ix[1] prism_core::record_cloak_payout
 */

import { Buffer } from 'buffer';

import { BN, Program } from '@coral-xyz/anchor';
import {
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import type { PrismCore } from './idl/prism_core';
import { getCloakPayoutPda } from './pda';

const MSG_PREFIX = Buffer.from('clk_atts'); // 8 bytes
export const CLOAK_MSG_LEN = 73;

export interface CloakViewingKeys {
  prime: string;
  core: string;
  alpha: string;
}

export interface CloakAttestation {
  /** 64-byte Ed25519 signature from the Cloak oracle */
  signature: Uint8Array;
  oraclePubkey: PublicKey;
  vaultPubkey: PublicKey;
  /** 32-byte batch commitment (sha256 receipt hash) */
  batchId: Uint8Array;
  batchConfirmed: boolean;
  viewingKeys: CloakViewingKeys;
}

export function buildCloakAttestationMessage(params: {
  vaultKey: PublicKey;
  batchId: Uint8Array;
  batchConfirmed?: boolean;
}): Buffer {
  if (params.batchId.length !== 32) {
    throw new Error(`Cloak batchId must be 32 bytes (got ${params.batchId.length})`);
  }

  const buf = Buffer.alloc(CLOAK_MSG_LEN);
  MSG_PREFIX.copy(buf, 0);
  params.vaultKey.toBuffer().copy(buf, 8);
  Buffer.from(params.batchId).copy(buf, 40);
  buf.writeUInt8(params.batchConfirmed === false ? 0x00 : 0x01, 72);
  return buf;
}

const CLOAK_ORACLE_URL = process.env.NEXT_PUBLIC_CLOAK_ORACLE_URL ?? '/api/cloak-oracle';

export async function fetchCloakAttestation(params: {
  vaultPubkey: string;
  totalShieldedAmount: bigint;
}): Promise<CloakAttestation> {
  const res = await fetch(`${CLOAK_ORACLE_URL}/shield_payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vault_pubkey: params.vaultPubkey,
      total_shielded_amount: params.totalShieldedAmount.toString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloak oracle (${res.status}): ${text}`);
  }

  const data = await res.json();
  const batchId = Buffer.from(data.batch_id, 'hex');
  const signature = Buffer.from(data.signature, 'hex');

  if (batchId.length !== 32) {
    throw new Error(`Cloak oracle returned invalid batch_id length (${batchId.length})`);
  }
  if (signature.length !== 64) {
    throw new Error(`Cloak oracle returned invalid signature length (${signature.length})`);
  }

  return {
    signature: new Uint8Array(signature),
    oraclePubkey: new PublicKey(data.oracle_pubkey),
    vaultPubkey: new PublicKey(params.vaultPubkey),
    batchId: new Uint8Array(batchId),
    batchConfirmed: data.batch_confirmed !== false,
    viewingKeys: {
      prime: data.viewing_keys?.prime ?? '',
      core: data.viewing_keys?.core ?? '',
      alpha: data.viewing_keys?.alpha ?? '',
    },
  };
}

export async function buildRecordCloakPayoutTx(params: {
  program: Program<PrismCore>;
  attestation: CloakAttestation;
  vault: PublicKey;
  config: PublicKey;
  totalShieldedAmount: bigint;
}): Promise<Transaction> {
  const [cloakPayoutPda] = getCloakPayoutPda(params.vault, params.program.programId);

  const message = buildCloakAttestationMessage({
    vaultKey: params.vault,
    batchId: params.attestation.batchId,
    batchConfirmed: params.attestation.batchConfirmed,
  });

  const ed25519Ix: TransactionInstruction = Ed25519Program.createInstructionWithPublicKey({
    publicKey: params.attestation.oraclePubkey.toBytes(),
    message: new Uint8Array(message),
    signature: new Uint8Array(params.attestation.signature),
  });

  const recordIx = await params.program.methods
    .recordCloakPayout(new BN(params.totalShieldedAmount.toString()))
    .accounts({
      signer: params.program.provider.publicKey!,
      config: params.config,
      vault: params.vault,
      cloakPayout: cloakPayoutPda,
      systemProgram: SystemProgram.programId,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  return new Transaction().add(ed25519Ix, recordIx);
}
