'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { SystemProgram } from '@solana/web3.js';
import { toast } from 'sonner';

import { getCoreIdl } from '@/app/lib/program';
import { USDC_MINT, TrancheKind } from '@/app/lib/constants';
import {
  getConfigPda,
  getTrancheMintPda,
  getTranchePda,
  getVaultPda,
  getVaultReservePda,
} from '@/app/lib/pda';
import { useSelectedVaultId } from '@/hooks/useSelectedVault';

const TRANCHE_LABELS = ['Prime', 'Core', 'Alpha'];

export function useDeposit() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { vaultId } = useSelectedVaultId();

  return useMutation({
    mutationFn: async ({
      trancheKind,
      usdcAmount,
    }: {
      trancheKind: TrancheKind;
      usdcAmount: bigint;
    }) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Connect your wallet first');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const program = new Program(getCoreIdl(), provider);

      const [configPda] = getConfigPda();
      const [vaultPda] = getVaultPda(vaultId);
      const [tranchePda] = getTranchePda(vaultPda, trancheKind);
      const [trancheMintPda] = getTrancheMintPda(vaultPda, trancheKind);
      const [vaultReservePda] = getVaultReservePda(vaultPda);

      const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
      const userTrancheAta = await getAssociatedTokenAddress(trancheMintPda, wallet.publicKey);

      const sig = await program.methods
        .deposit(trancheKind, new BN(usdcAmount.toString()))
        .accounts({
          user: wallet.publicKey,
          config: configPda,
          vault: vaultPda,
          tranche: tranchePda,
          trancheMint: trancheMintPda,
          vaultUsdcReserve: vaultReservePda,
          userUsdcAta,
          userTrancheAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      return sig;
    },
    onSuccess: (sig, { trancheKind }) => {
      toast.success(`Deposited into ${TRANCHE_LABELS[trancheKind]}! tx: ${sig.slice(0, 16)}…`);
      queryClient.invalidateQueries({ queryKey: ['vaultState'] });
      queryClient.invalidateQueries({ queryKey: ['userPosition'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Deposit failed');
    },
  });
}
