'use client';

import { useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, BN, type Idl } from '@coral-xyz/anchor';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress 
} from '@solana/spl-token';
import { toast } from 'sonner';
import { Banknote, CheckCircle2 } from 'lucide-react';

import {
  PRISM_CORE_PROGRAM_ID,
  USDC_MINT,
  VAULT_ID,
} from '@/app/lib/constants';
import {
  getConfigPda,
  getVaultPda,
  getVaultReservePda,
  getLoanPda,
} from '@/app/lib/pda';
import prismCoreIdl from '@/app/lib/idl/prism_core.json';

interface LoanRepaymentProps {
  loanId: number;
}

export function LoanRepayment({ loanId }: LoanRepaymentProps) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [repayAmount, setRepayAmount] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRepay() {
    if (!wallet) {
      toast.error('Connect wallet first');
      return;
    }

    setLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      const core = new Program(prismCoreIdl as Idl, provider) as any;
      
      const [config] = getConfigPda(PRISM_CORE_PROGRAM_ID);
      const [vault] = getVaultPda(VAULT_ID, PRISM_CORE_PROGRAM_ID);
      const [reserve] = getVaultReservePda(vault, PRISM_CORE_PROGRAM_ID);
      const [loan] = getLoanPda(vault, loanId, PRISM_CORE_PROGRAM_ID);
      
      const amount = new BN(parseFloat(repayAmount) * 1_000_000);
      const borrowerUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);

      const sig = await core.methods
        .repayLoan(amount)
        .accounts({
          borrower: wallet.publicKey,
          config,
          vault,
          loan,
          borrowerUsdcAta,
          vaultUsdcReserve: reserve,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'confirmed' });

      toast.success('Repayment successful!');
      setRepayAmount('');
      console.log('Repayment signature:', sig);
    } catch (e: any) {
      console.error(e);
      toast.error(`Repayment failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/35 p-6 shadow-[0_8px_24px_rgba(60,46,22,0.05)]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Banknote className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Loan Repayment</h3>
          <p className="text-sm text-white/50 text-emerald-400/70">Loan ID: {loanId}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Amount to Repay (USDC)</label>
          <div className="relative">
            <input
              type="number"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 uppercase">USDC</div>
          </div>
        </div>

        <button
          onClick={handleRepay}
          disabled={loading || !repayAmount}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(16,185,129,0.05)]"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Complete Repayment
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-white/30 leading-relaxed italic">
          Repayment will restore the vault's USDC reserves. Once fully repaid, your IKA collateral will be eligible for withdrawal.
        </p>
      </div>
    </div>
  );
}
