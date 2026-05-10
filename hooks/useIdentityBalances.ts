'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import type { Connection, PublicKey } from '@solana/web3.js';

import { USDC_MINT, VAULT_ID, TrancheKind } from '@/app/lib/constants';
import { getTrancheMintPda, getVaultPda } from '@/app/lib/pda';
import { useIdentity } from '@/hooks/useIdentity';

const TRANCHE_KINDS = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

async function tokenBal(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    const res = await connection.getTokenAccountBalance(ata);
    return BigInt(res.value.amount);
  } catch {
    return 0n;
  }
}

export function useIdentityBalances() {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery({
    queryKey: ['identity-balances', keypair.publicKey.toBase58()],
    refetchInterval: 8000,
    queryFn: async () => {
      const [vaultPda] = getVaultPda(VAULT_ID);
      const usdcAta = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);
      const usdc = await tokenBal(connection, usdcAta);

      const tranches = await Promise.all(
        TRANCHE_KINDS.map(async (kind) => {
          const [mint] = getTrancheMintPda(vaultPda, kind);
          const ata = await getAssociatedTokenAddress(mint, keypair.publicKey);
          const balance = await tokenBal(connection, ata);
          return { kind, balance };
        }),
      );

      return { usdc, tranches };
    },
  });
}
