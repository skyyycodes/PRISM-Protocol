'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { VAULT_ID } from '@/app/lib/constants';
import { getLoanPda, getVaultPda } from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import { useIdentity } from '@/hooks/useIdentity';

export type LoanRecord = {
  id: number;
  pda: string;
  borrower: string;
  principal: bigint;
  aprBps: number;
  originationTs: number;
  maturityTs: number;
  state: string;
  totalRepaid: bigint;
};

function queryKey(vaultId: number) {
  return ['active-loans', vaultId] as const;
}

/** Scans on-chain loan PDAs 0..maxScan until an account is missing, returns all found. */
export function useActiveLoans(vaultId = VAULT_ID, maxScan = 20) {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery({
    queryKey: queryKey(vaultId),
    refetchInterval: 8000,
    queryFn: async (): Promise<LoanRecord[]> => {
      const { core } = buildPrograms(connection, keypair);
      const [vaultPda] = getVaultPda(vaultId, core.programId);
      const loans: LoanRecord[] = [];

      for (let id = 0; id < maxScan; id++) {
        const [loanPda] = getLoanPda(vaultPda, id, core.programId);
        const loan = await core.account.loan.fetchNullable(loanPda);
        if (!loan) break;

        const stateKey = Object.keys(loan.state as Record<string, unknown>)[0] ?? 'Originated';
        loans.push({
          id,
          pda: loanPda.toBase58(),
          borrower: loan.borrower.toBase58(),
          principal: BigInt(loan.principal.toString()),
          aprBps: loan.aprBps,
          originationTs: Number(loan.originationTs.toString()),
          maturityTs: Number(loan.maturityTs.toString()),
          state: stateKey,
          totalRepaid: BigInt(loan.totalRepaid.toString()),
        });
      }

      return loans;
    },
  });
}

// ─── DB write-through (called from ActionPanel after each mutation) ────────────

export type UpsertLoanPayload = {
  loanId: number;
  vaultId?: number;
  pda: string;
  borrower: string;
  principal: bigint;
  aprBps: number;
  originationTs: number;
  maturityTs: number;
  state: string;
  totalRepaid?: bigint;
};

export function useUpsertLoan(vaultId = VAULT_ID) {
  const qc = useQueryClient();
  return useMutation<void, Error, UpsertLoanPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          vaultId: payload.vaultId ?? vaultId,
          principal: payload.principal.toString(),
          totalRepaid: (payload.totalRepaid ?? 0n).toString(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'failed to save loan');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(vaultId) }),
  });
}
