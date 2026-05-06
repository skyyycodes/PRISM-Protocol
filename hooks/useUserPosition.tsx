'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { getAssociatedTokenAddress } from '@solana/spl-token';

import { VAULT_ID, TrancheKind } from '@/app/lib/constants';
import { getTrancheMintPda, getVaultPda } from '@/app/lib/pda';

const KINDS = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha];

export interface TranchePosition {
  kind: TrancheKind;
  balance: bigint;
}

export function useUserPosition() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery<TranchePosition[]>({
    queryKey: ['userPosition', publicKey?.toBase58()],
    enabled: !!publicKey,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicKey) return [];
      const [vaultPda] = getVaultPda(VAULT_ID);

      return Promise.all(
        KINDS.map(async (kind) => {
          const [mintPda] = getTrancheMintPda(vaultPda, kind);
          const ata = await getAssociatedTokenAddress(mintPda, publicKey);
          try {
            const bal = await connection.getTokenAccountBalance(ata);
            return { kind, balance: BigInt(bal.value.amount) };
          } catch {
            return { kind, balance: 0n };
          }
        }),
      );
    },
  });
}
