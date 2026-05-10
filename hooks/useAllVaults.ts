'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { buildPrograms } from '@/app/lib/program';
import { useIdentity } from '@/hooks/useIdentity';
import { toBigInt } from '@/app/lib/format';

export function useAllVaults() {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery({
    queryKey: ['all-vaults', connection.rpcEndpoint],
    refetchInterval: 10000,
    queryFn: async () => {
      const { core } = buildPrograms(connection, keypair);
      
      // 1. Fetch all vaults
      const allVaults = await core.account.vault.all();
      if (!allVaults || allVaults.length === 0) return [];

      // 2. Extract all tranche PDAs to fetch them in bulk
      const allTranchePdas = allVaults.flatMap(v => v.account.tranchePdas);
      const allTrancheData = await core.account.tranche.fetchMultiple(allTranchePdas);

      // 3. Map vaults to their tranches and compute metrics
      return allVaults.map((v, idx) => {
        const vaultTranches = allTrancheData.slice(idx * 3, idx * 3 + 3);
        const totalDeposits = toBigInt(v.account.totalDeposits);
        const totalLoaned = toBigInt(v.account.totalLoaned);
        const utilization = totalDeposits > 0n ? Number((totalLoaned * 10000n) / totalDeposits) / 100 : 0;

        return {
          publicKey: v.publicKey,
          ...v.account,
          utilization,
          tranches: vaultTranches.map((t, tIdx) => ({
            kind: tIdx === 0 ? 'Prime' : tIdx === 1 ? 'Core' : 'Alpha',
            ...t
          }))
        };
      });
    }
  });
}
