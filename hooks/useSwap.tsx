'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import { Transaction, SendTransactionError } from '@solana/web3.js';
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
  const { sendTransaction, publicKey: walletPublicKey } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ trancheKind, amountIn, minAmountOut, direction }: SwapParams) => {
      try {
        const { amm } = buildPrograms(connection, keypair);
        const authority = walletPublicKey || keypair.publicKey;

        const [vaultPda] = getVaultPda(VAULT_ID);
        const [trancheMint] = getTrancheMintPda(vaultPda, trancheKind);
        const [poolPda] = getPoolPda(trancheMint, amm.programId);
        const [trancheReserve] = getPoolTrancheReservePda(trancheMint, amm.programId);
        const [quoteReserve] = getPoolQuoteReservePda(trancheMint, amm.programId);

        const userTrancheAta = await getAssociatedTokenAddress(trancheMint, authority);
        const userQuoteAta = await getAssociatedTokenAddress(USDC_MINT, authority);

        const destAta = direction === SWAP_DIR_USDC_TO_TRANCHE ? userTrancheAta : userQuoteAta;
        const destMint = direction === SWAP_DIR_USDC_TO_TRANCHE ? trancheMint : USDC_MINT;
        
        const destAccountInfo = await Promise.race([
          connection.getAccountInfo(destAta),
          new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout checking destination account')), 10000))
        ]) as any;
        
        const transaction = new Transaction();

        if (!destAccountInfo) {
          transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
              authority,
              destAta,
              authority,
              destMint
            )
          );
        }

        const ix = await amm.methods
          .swap(new BN(amountIn.toString()), new BN(minAmountOut.toString()), direction)
          .accounts({
            user: authority,
            pool: poolPda,
            trancheReserve,
            quoteReserve,
            userTrancheAta,
            userQuoteAta,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();

        transaction.add(ix);

        const { blockhash, lastValidBlockHeight } = await Promise.race([
          connection.getLatestBlockhash('processed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout fetching blockhash')), 10000))
        ]) as any;

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = authority;

        if (walletPublicKey) {
          const sig = await sendTransaction(transaction, connection, { 
            skipPreflight: false,
            preflightCommitment: 'processed' 
          });
          
          await Promise.race([
            connection.confirmTransaction(sig, 'confirmed'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout (30s)')), 30000))
          ]);
          return sig;
        }

        // Fallback signing logic
        transaction.sign(keypair);
        const sig = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'processed'
        });
        
        await Promise.race([
          connection.confirmTransaction(sig, 'confirmed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout (30s)')), 30000))
        ]);
        return sig;
      } catch (err) {
        console.error('Swap Execution Error:', err);
        if (err instanceof SendTransactionError) {
          try {
            const logs = await err.getLogs(connection);
            console.error('On-chain Logs:', logs);
          } catch {
            // ignore log fetch error
          }
        }
        throw err;
      }
    },
    onSuccess: (sig, { trancheKind, direction }) => {
      const trancheLabel = TRANCHE_LABELS[trancheKind];
      const label =
        direction === SWAP_DIR_USDC_TO_TRANCHE
          ? `Bought ${trancheLabel}`
          : `Sold ${trancheLabel} for USDC`;
      
      toast.success(label, {
        description: (
          <a
            href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-1 font-mono text-[10px] text-pink-400/80 hover:text-pink-400 hover:underline"
          >
            TX: {sig.slice(0, 8)}...{sig.slice(-8)}
          </a>
        ),
      });
      queryClient.invalidateQueries({ queryKey: ['vault-state'] });
      queryClient.invalidateQueries({ queryKey: ['identity-balances'] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Swap failed');
    },
  });
}
