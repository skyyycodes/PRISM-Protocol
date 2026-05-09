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
      const allVaults = await core.account.vault.all();
      
      return allVaults.map(v => ({
        publicKey: v.publicKey,
        id: v.account.id,
        state: v.account.state,
        // In a real app we might fetch more metadata here or in a separate query
      }));
    }
  });
}
