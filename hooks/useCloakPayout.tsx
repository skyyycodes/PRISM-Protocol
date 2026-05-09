'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { type Keypair, type PublicKey } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  buildRecordCloakPayoutTx,
  fetchCloakAttestation,
  type CloakAttestation,
  type CloakViewingKeys,
} from '@/app/lib/cloak';
import { getCloakPayoutPda } from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import { useIdentity } from '@/hooks/useIdentity';

export type CloakPayoutStatus = 'Pending' | 'Shielded';

export interface CloakPayoutState {
  vault: PublicKey;
  cloakOracle: PublicKey;
  batchId: Uint8Array;
  totalShieldedAmount: bigint;
  yieldEpochTs: number;
  status: CloakPayoutStatus;
  confirmedTs: number;
  bump: number;
}

export interface RecordCloakPayoutParams {
  signer: Keypair;
  vaultPda: PublicKey;
  configPda: PublicKey;
  totalShieldedAmount: bigint;
}

export interface RecordCloakPayoutResult {
  signature: string;
  attestation: CloakAttestation;
}

export const CLOAK_VIEWING_KEYS_QUERY_KEY = ['cloak-viewing-keys'] as const;
const CLOAK_VIEWING_KEYS_STORAGE_KEY = 'prism-cloak-viewing-keys';

function statusFromAccount(raw: unknown): CloakPayoutStatus {
  if (!raw || typeof raw !== 'object') return 'Pending';
  const key = Object.keys(raw as Record<string, unknown>)[0] ?? 'pending';
  return (key.charAt(0).toUpperCase() + key.slice(1)) as CloakPayoutStatus;
}

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return BigInt(String((value as { toString: () => string }).toString()));
  }
  return 0n;
}

function asNumber(value: unknown): number {
  return Number(asBigInt(value));
}

function readViewingKeysFromStorage(): CloakViewingKeys | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CLOAK_VIEWING_KEYS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloakViewingKeys>;
    if (!parsed.prime || !parsed.core || !parsed.alpha) return null;
    return {
      prime: parsed.prime,
      core: parsed.core,
      alpha: parsed.alpha,
    };
  } catch {
    return null;
  }
}

function writeViewingKeysToStorage(keys: CloakViewingKeys) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CLOAK_VIEWING_KEYS_STORAGE_KEY, JSON.stringify(keys));
}

/** Polls the CloakPayoutRecord PDA for this vault. */
export function useCloakPayout(vaultPda: PublicKey | null | undefined) {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery<CloakPayoutState | null>({
    queryKey: ['cloak-payout', connection.rpcEndpoint, vaultPda?.toBase58() ?? 'none'],
    enabled: !!vaultPda,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!vaultPda) return null;
      const { core } = buildPrograms(connection, keypair);
      const [pda] = getCloakPayoutPda(vaultPda, core.programId);
      const acc = await core.account.cloakPayoutRecord.fetchNullable(pda);
      if (!acc) return null;

      const anyAcc = acc as any;
      return {
        vault: anyAcc.vault as PublicKey,
        cloakOracle: (anyAcc.cloakOracle ?? anyAcc.cloak_oracle) as PublicKey,
        batchId: new Uint8Array(anyAcc.batchId ?? anyAcc.batch_id ?? []),
        totalShieldedAmount: asBigInt(anyAcc.totalShieldedAmount ?? anyAcc.total_shielded_amount),
        yieldEpochTs: asNumber(anyAcc.yieldEpochTs ?? anyAcc.yield_epoch_ts),
        status: statusFromAccount(anyAcc.status),
        confirmedTs: asNumber(anyAcc.confirmedTs ?? anyAcc.confirmed_ts),
        bump: Number(anyAcc.bump ?? 0),
      };
    },
  });
}

/** Shared viewing keys produced by the latest Cloak oracle attestation. */
export function useCloakViewingKeys() {
  return useQuery<CloakViewingKeys | null>({
    queryKey: CLOAK_VIEWING_KEYS_QUERY_KEY,
    queryFn: async () => readViewingKeysFromStorage(),
    staleTime: Infinity,
  });
}

/**
 * Mutation flow:
 *  1) request oracle attestation
 *  2) build dual-ix tx (Ed25519 + record_cloak_payout)
 *  3) send tx and cache viewing keys
 */
export function useRecordCloakPayout() {
  const { connection } = useConnection();
  const qc = useQueryClient();

  return useMutation<RecordCloakPayoutResult, Error, RecordCloakPayoutParams>({
    mutationFn: async (params) => {
      const { core, provider } = buildPrograms(connection, params.signer);

      toast.loading('Cloak oracle: preparing shielded batch attestation…', {
        id: 'cloak-shield',
        duration: 30_000,
      });

      const attestation = await fetchCloakAttestation({
        vaultPubkey: params.vaultPda.toBase58(),
        totalShieldedAmount: params.totalShieldedAmount,
      });

      if (!attestation.batchConfirmed) {
        throw new Error('Cloak oracle did not confirm the payout batch (result=0x00)');
      }

      const tx = await buildRecordCloakPayoutTx({
        program: core,
        attestation,
        vault: params.vaultPda,
        config: params.configPda,
        totalShieldedAmount: params.totalShieldedAmount,
      });

      const signature = await provider.sendAndConfirm(tx, [params.signer], {
        commitment: 'confirmed',
      });

      return { signature, attestation };
    },
    onSuccess: ({ signature, attestation }, params) => {
      writeViewingKeysToStorage(attestation.viewingKeys);
      qc.setQueryData(CLOAK_VIEWING_KEYS_QUERY_KEY, attestation.viewingKeys);

      qc.invalidateQueries({
        queryKey: ['cloak-payout', connection.rpcEndpoint, params.vaultPda.toBase58()],
      });
      qc.invalidateQueries({ queryKey: ['vault-state'] });

      toast.success(
        `Yield shielded via Cloak (tx ${signature.slice(0, 8)}…). Viewing keys are ready.`,
        { id: 'cloak-shield' },
      );
    },
    onError: (e) => {
      toast.error(`Cloak shield failed: ${e.message}`, { id: 'cloak-shield' });
    },
  });
}
