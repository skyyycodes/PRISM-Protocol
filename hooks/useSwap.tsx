'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotent,
} from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import { toast } from 'sonner';

import { USDC_MINT, VAULT_ID, TrancheKind } from '@/app/lib/constants';
import {
  getPoolPda,
  getPoolQuoteReservePda,
  getPoolTrancheReservePda,
  getTrancheMintPda,
  getVaultPda,
} from '@/app/lib/pda';
import { buildPrograms } from '@/app/lib/program';
import { useIdentity } from '@/hooks/useIdentity';

export const SWAP_DIR_TRANCHE_TO_USDC = 0 as const;
export const SWAP_DIR_USDC_TO_TRANCHE = 1 as const;
export type SwapDirection = 0 | 1;

export interface SwapParams {
  trancheKind: TrancheKind;
  amountIn: bigint;
  minAmountOut: bigint;
  direction: SwapDirection;
}

const TRANCHE_LABELS = ['pPRIME', 'pCORE', 'pALPHA'] as const;

export function useSwap() {
  const { connection } = useConnection();
  const { keypair } = useIdentity();
  const { signTransaction, publicKey: walletPublicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trancheKind, amountIn, minAmountOut, direction }: SwapParams) => {
      const { amm } = buildPrograms(connection, keypair);
      const [vaultPda] = getVaultPda(VAULT_ID);
      const [trancheMint] = getTrancheMintPda(vaultPda, trancheKind);
      const [poolPda] = getPoolPda(trancheMint, amm.programId);
      const [trancheReserve] = getPoolTrancheReservePda(trancheMint, amm.programId);
      const [quoteReserve] = getPoolQuoteReservePda(trancheMint, amm.programId);

      const userTrancheAta = await getAssociatedTokenAddress(trancheMint, keypair.publicKey);
      const userQuoteAta = await getAssociatedTokenAddress(USDC_MINT, keypair.publicKey);

      // Ensure the destination ATA exists; the AMM does not create it.
      const destAta = direction === SWAP_DIR_USDC_TO_TRANCHE ? userTrancheAta : userQuoteAta;
      const destMint = direction === SWAP_DIR_USDC_TO_TRANCHE ? trancheMint : USDC_MINT;
      const destAccountInfo = await connection.getAccountInfo(destAta);
      if (!destAccountInfo) {
        await createAssociatedTokenAccountIdempotent(connection, keypair, destMint, keypair.publicKey);
      }

      const ix = await amm.methods
        .swap(new BN(amountIn.toString()), new BN(minAmountOut.toString()), direction)
        .accounts({
          user: keypair.publicKey,
          pool: poolPda,
          trancheReserve,
          quoteReserve,
          userTrancheAta,
          userQuoteAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      const tx = new Transaction().add(ix);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      if (walletPublicKey && signTransaction) {
        // Wallet-confirmed path:
        //   1. Wallet signs as fee payer → Phantom/Solflare popup appears
        //   2. Identity keypair partial-signs as the instruction authority
        //   3. We send the fully-signed tx ourselves
        tx.feePayer = walletPublicKey;
        const walletSigned = await signTransaction(tx);
        walletSigned.partialSign(keypair);
        const raw = walletSigned.serialize();
        const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        return sig;
      }

      // Fallback: no wallet connected — silent keypair signing.
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      return sig;
    },
    onSuccess: (sig, { trancheKind, direction }) => {
      const trancheLabel = TRANCHE_LABELS[trancheKind];
      const label =
        direction === SWAP_DIR_USDC_TO_TRANCHE
          ? `Bought ${trancheLabel}`
          : `Sold ${trancheLabel} for USDC`;
      toast.success(`${label} · tx: ${sig.slice(0, 16)}…`);
      queryClient.invalidateQueries({ queryKey: ['vault-state'] });
      queryClient.invalidateQueries({ queryKey: ['identity-balances'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Swap failed');
    },
  });
}
