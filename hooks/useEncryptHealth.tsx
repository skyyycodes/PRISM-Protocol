'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { type Keypair, type PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getEncryptHealthPda } from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import {
  buildVerifyEncryptDefaultTx,
  pollEncryptAttestation,
  type EncryptAttestation,
} from '@/app/lib/encrypt';
import { useIdentity } from '@/hooks/useIdentity';

export type EncryptStatus = 'Pending' | 'Verified' | 'DefaultProven';

export interface EncryptHealthState {
  loan: PublicKey;
  scoreCommitment: Uint8Array;
  encryptOracle: PublicKey;
  status: EncryptStatus;
  defaultProvenTs: number;
  bump: number;
}

function statusFromAccount(raw: unknown): EncryptStatus {
  if (!raw || typeof raw !== 'object') return 'Pending';
  const key = Object.keys(raw as Record<string, unknown>)[0] ?? 'pending';
  return (key.charAt(0).toUpperCase() + key.slice(1)) as EncryptStatus;
}

/**
 * Polls the EncryptLoanHealth PDA for a given loan. Returns null if the borrower
 * has not yet attached a credit-score commitment.
 */
export function useEncryptHealth(loanPda: PublicKey | null | undefined) {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery<EncryptHealthState | null>({
    queryKey: [
      'encrypt-health',
      connection.rpcEndpoint,
      loanPda?.toBase58() ?? 'none',
    ],
    enabled: !!loanPda,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!loanPda) return null;
      const { core } = buildPrograms(connection, keypair);
      const [pda] = getEncryptHealthPda(loanPda, core.programId);
      const acc = await core.account.encryptLoanHealth.fetchNullable(pda);
      if (!acc) return null;
      return {
        loan: acc.loan as PublicKey,
        scoreCommitment: new Uint8Array(acc.scoreCommitment as number[]),
        encryptOracle: acc.encryptOracle as PublicKey,
        status: statusFromAccount(acc.status),
        defaultProvenTs: Number(acc.defaultProvenTs?.toString?.() ?? acc.defaultProvenTs ?? 0),
        bump: Number(acc.bump),
      };
    },
  });
}

export interface VerifyEncryptDefaultParams {
  loanPubkey: PublicKey;
  scoreCommitment: Uint8Array;
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
  /** The signer for this tx — typically the admin demo keypair. */
  signer: Keypair;
}

export interface VerifyEncryptDefaultResult {
  signature: string;
  attestation: EncryptAttestation;
}

/**
 * The "magic moment" mutation:
 *   1. Calls the Encrypt FHE oracle for an attestation
 *   2. Builds the dual-ix tx (Ed25519 precompile + verify_encrypt_default)
 *   3. Signs and sends — the on-chain handler atomically marks DefaultProven
 *      and fires the credit-event cascade
 */
export function useVerifyEncryptDefault() {
  const { connection } = useConnection();
  const qc = useQueryClient();

  return useMutation<VerifyEncryptDefaultResult, Error, VerifyEncryptDefaultParams>({
    mutationFn: async (params) => {
      const { core, provider } = buildPrograms(connection, params.signer);

      toast.loading('Encrypt FHE oracle: computing default attestation…', {
        id: 'encrypt-fhe',
        duration: 30_000,
      });

      const attestation = await pollEncryptAttestation(
        params.loanPubkey,
        params.scoreCommitment,
      );

      if (!attestation.defaultProven) {
        throw new Error(
          'Encrypt FHE oracle: loan is NOT in default (total_repaid >= principal)',
        );
      }

      const tx = await buildVerifyEncryptDefaultTx({
        program: core,
        attestation,
        configPda: params.configPda,
        vaultPda: params.vaultPda,
        tranchePrimePda: params.tranchePrimePda,
        trancheCorePda: params.trancheCorePda,
        trancheAlphaPda: params.trancheAlphaPda,
        vaultReservePda: params.vaultReservePda,
        lossBucketPda: params.lossBucketPda,
        creditEventPda: params.creditEventPda,
        lossAmount: params.lossAmount,
        severityBps: params.severityBps,
      });

      const signature = await provider.sendAndConfirm(tx, [params.signer], {
        commitment: 'confirmed',
      });

      return { signature, attestation };
    },
    onSuccess: ({ signature, attestation }) => {
      toast.success(
        `FHE default proven on-chain (tx ${signature.slice(0, 8)}…). Cascade complete.`,
        { id: 'encrypt-fhe' },
      );
      qc.invalidateQueries({
        queryKey: ['encrypt-health', connection.rpcEndpoint, attestation.loanPubkey.toBase58()],
      });
      qc.invalidateQueries({ queryKey: ['vault-state'] });
    },
    onError: (e) => {
      toast.error(`FHE verify failed: ${e.message}`, { id: 'encrypt-fhe' });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Borrower-side mutation: register the Encrypt-sealed score commitment on-chain.
// ─────────────────────────────────────────────────────────────────────────────

export interface AttachEncryptScoreParams {
  borrower: Keypair;
  loanPda: PublicKey;
  configPda: PublicKey;
  /** sha256 of the borrower's Encrypt-sealed credit data (32 bytes). */
  commitment: Uint8Array;
  encryptOracle: PublicKey;
}

export function useAttachEncryptScore() {
  const { connection } = useConnection();
  const qc = useQueryClient();

  return useMutation<string, Error, AttachEncryptScoreParams>({
    mutationFn: async (params) => {
      if (params.commitment.length !== 32) {
        throw new Error(`commitment must be 32 bytes (got ${params.commitment.length})`);
      }
      const { core } = buildPrograms(connection, params.borrower);
      const [encryptHealthPda] = getEncryptHealthPda(params.loanPda, core.programId);
      const sig = await core.methods
        .attachEncryptScore(Array.from(params.commitment), params.encryptOracle)
        .accounts({
          borrower: params.borrower.publicKey,
          config: params.configPda,
          loan: params.loanPda,
          encryptHealth: encryptHealthPda,
          systemProgram: (await import('@solana/web3.js')).SystemProgram.programId,
        })
        .signers([params.borrower])
        .rpc({ commitment: 'confirmed' });
      return sig;
    },
    onSuccess: (sig, params) => {
      toast.success(`Encrypt score commitment attached (tx ${sig.slice(0, 8)}…)`);
      qc.invalidateQueries({
        queryKey: ['encrypt-health', connection.rpcEndpoint, params.loanPda.toBase58()],
      });
    },
    onError: (e) => toast.error(`Attach FHE score failed: ${e.message}`),
  });
}
