'use client';

import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { PrismCore } from '@/app/lib/idl/prism_core';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';
import { getConfigPda, getVaultPda, getLoanPda } from '@/app/lib/pda';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export function useRepayLoan() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaultId, loanId, amountUsdc }: { vaultId: number; loanId: number; amountUsdc: number }) => {
      if (!wallet) throw new Error('Wallet not connected');

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = new Program<PrismCore>(prismCoreIdl as PrismCore, provider) as any;

      const [configPda] = getConfigPda();
      const [vaultPda] = getVaultPda(vaultId);
      const [loanPda] = getLoanPda(vaultPda, loanId);
      const [configAcc] = await Promise.all([program.account.globalConfig.fetch(configPda)]);
      
      const borrowerUsdcAta = getAssociatedTokenAddressSync(configAcc.usdcMint, wallet.publicKey);
      const [vaultUsdcReserve] = PublicKey.findProgramAddressSync(
        [Buffer.from('reserve'), vaultPda.toBuffer()],
        program.programId
      );

      const amount = new BN(Math.floor(amountUsdc * 1_000_000)); // Assuming 6 decimals for USDC

      const tx = await program.methods
        .repayLoan(amount)
        .accounts({
          borrower: wallet.publicKey,
          config: configPda,
          vault: vaultPda,
          loan: loanPda,
          borrowerUsdcAta,
          vaultUsdcReserve,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      return tx;
    },
    onSuccess: (sig, variables) => {
      const [vaultPda] = getVaultPda(variables.vaultId);
      const [loanPda] = getLoanPda(vaultPda, variables.loanId);
      qc.invalidateQueries({ queryKey: ['loan-account', loanPda.toBase58()] });
      qc.invalidateQueries({ queryKey: ['active-loans', variables.vaultId] });
      toast.success('Repayment successful', {
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
    },
    onError: (e: Error) => {
      console.error('Repayment failed:', e);
      toast.error(`Repayment failed: ${e.message}`);
    },
  });
}
