'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';

import { TRANCHE_CONFIG, TrancheKind, USDC_MINT, VAULT_ID } from '@/app/lib/constants';
import { toBigInt } from '@/app/lib/format';
import {
  getConfigPda,
  getLoanPda,
  getLossBucketPda,
  getPoolPda,
  getPoolQuoteReservePda,
  getPoolTrancheReservePda,
  getTrancheMintPda,
  getTranchePda,
  getVaultPda,
  getVaultReservePda,
} from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import { useIdentity } from '@/hooks/useIdentity';

async function tokenBalance(connection: import('@solana/web3.js').Connection, address: import('@solana/web3.js').PublicKey) {
  try {
    const balance = await connection.getTokenAccountBalance(address);
    return BigInt(balance.value.amount);
  } catch {
    return 0n;
  }
}

export function useVaultState() {
  const { connection } = useConnection();
  const { keypair } = useIdentity();

  return useQuery({
    queryKey: ['vault-state', connection.rpcEndpoint, VAULT_ID],
    refetchInterval: 5000,
    queryFn: async () => {
      const { core, amm } = buildPrograms(connection, keypair);
      const [configPda] = getConfigPda(core.programId);
      const [vaultPda] = getVaultPda(VAULT_ID, core.programId);
      const [reservePda] = getVaultReservePda(vaultPda, core.programId);
      const [lossBucketPda] = getLossBucketPda(vaultPda, core.programId);
      const [loanPda] = getLoanPda(vaultPda, 0, core.programId);

      const [config, vault, loan] = await Promise.all([
        core.account.globalConfig.fetchNullable(configPda),
        core.account.vault.fetchNullable(vaultPda),
        core.account.loan.fetchNullable(loanPda),
      ]);

      const usdcMint = config?.usdcMint ?? USDC_MINT;
      const trancheKinds = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

      const tranches = await Promise.all(
        trancheKinds.map(async (kind) => {
          const [tranchePda] = getTranchePda(vaultPda, kind, core.programId);
          const [mintPda] = getTrancheMintPda(vaultPda, kind, core.programId);
          const [poolPda] = getPoolPda(mintPda, amm.programId);
          const [poolTrancheReserve] = getPoolTrancheReservePda(mintPda, amm.programId);
          const [poolQuoteReserve] = getPoolQuoteReservePda(mintPda, amm.programId);
          const [account, pool, ammTrancheBalance, ammQuoteBalance] = await Promise.all([
            core.account.tranche.fetchNullable(tranchePda),
            amm.account.ammPool.fetchNullable(poolPda),
            tokenBalance(connection, poolTrancheReserve),
            tokenBalance(connection, poolQuoteReserve),
          ]);
          return {
            kind,
            ...TRANCHE_CONFIG[kind],
            pda: tranchePda,
            mint: mintPda,
            account,
            pool,
            poolPda,
            poolTrancheReserve,
            poolQuoteReserve,
            totalAssets: toBigInt(account?.totalAssets ?? 0),
            totalSupply: toBigInt(account?.totalSupply ?? 0),
            navPerShareQ: toBigInt(account?.navPerShareQ ?? 0),
            cumulativeYield: toBigInt(account?.cumulativeYield ?? 0),
            cumulativeLoss: toBigInt(account?.cumulativeLoss ?? 0),
            ammTrancheBalance,
            ammQuoteBalance,
          };
        }),
      );

      const [reserveBalance, lossBucketBalance] = await Promise.all([
        tokenBalance(connection, reservePda),
        tokenBalance(connection, lossBucketPda),
      ]);

      return {
        config,
        configPda,
        vault,
        vaultPda,
        reservePda,
        reserveBalance,
        lossBucketPda,
        lossBucketBalance,
        loan,
        loanPda,
        usdcMint,
        tranches,
        programIds: {
          core: core.programId,
          amm: amm.programId,
        },
      };
    },
  });
}
