'use client';

import { 
  ArrowUpRight, 
  ShieldAlert, 
  History,
  AlertCircle,
  Zap,
  Info
} from 'lucide-react';
import { formatUsdc } from '@/app/lib/format';

interface Loan {
  id: string;
  collateral: string;
  borrowed: bigint;
  apr: number;
  healthFactor: number;
  status: string;
}

interface LoansSectionProps {
  loans: Loan[];
  borrowingCapacity: bigint;
}

export function LoansSection({ loans = [], borrowingCapacity = 0n }: LoansSectionProps) {
  function getHealthColor(hf: number) {
    if (hf >= 2.0) return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', label: 'Safe' };
    if (hf >= 1.2) return { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Warning' };
    return { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Danger' };
  }

  const hasLoans = loans?.length > 0;

  return (
    <section className="rounded-sm border border-white/[0.08] bg-[#080808] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">My Loans & Credit</span>
          {hasLoans && (
            <span className="px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 font-mono text-[9px] text-white/40">
              {loans.length} Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button className="font-mono text-[9px] uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors flex items-center gap-1.5">
            <History className="h-2.5 w-2.5" /> History
          </button>
        </div>
      </div>

      {!hasLoans ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.04]">
           <div className="bg-[#070707] p-6 flex flex-col justify-between h-48">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-2">Borrowing Capacity</div>
                <div className="font-mono text-3xl text-white/90 font-medium">${formatUsdc(borrowingCapacity, 0)}</div>
              </div>
              <div className="flex items-center gap-2 text-emerald-400/60 font-mono text-[9px] uppercase tracking-wider">
                <Zap className="h-3 w-3" /> Available Now
              </div>
           </div>
           
           <div className="bg-[#070707] p-6 flex flex-col justify-between h-48 border-l border-white/[0.04]">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-2">Estimated Health</div>
                <div className="font-mono text-3xl text-white/40 font-medium">Optimal</div>
              </div>
              <div className="flex items-center gap-2 text-white/20 font-mono text-[9px] uppercase tracking-wider">
                <Info className="h-3 w-3" /> Based on collateral
              </div>
           </div>

           <div className="bg-[#070707] p-6 flex flex-col justify-center h-48 border-l border-white/[0.04]">
              <p className="font-mono text-[11px] text-white/40 leading-relaxed mb-6">
                No active borrowing exposure.<br/>
                Lock IKA collateral to access your line of credit.
              </p>
              <button className="w-full py-3 bg-white text-black font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/90 transition-colors">
                 Open Credit Line
              </button>
           </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Collateral', 'Principal', 'APR', 'Health Factor', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-mono text-[9px] uppercase tracking-wider text-white/20 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loans.map((loan) => {
                const health = getHealthColor(loan.healthFactor);
                return (
                  <tr key={loan.id} className="group hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-mono text-[13px] text-white/80">{loan.collateral}</div>
                      <div className="mt-0.5 font-mono text-[9px] text-white/20 uppercase">Locked IKA</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-[13px] text-white/80">${formatUsdc(loan.borrowed, 2)}</div>
                      <div className="mt-0.5 font-mono text-[9px] text-white/20 uppercase">USDC</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-[13px] text-white/80">{loan.apr.toFixed(2)}%</div>
                      <div className="mt-0.5 font-mono text-[9px] text-white/20 uppercase">Fixed rate</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className={`flex items-center gap-2 ${health.text}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${health.text.replace('text', 'bg')}`} />
                        <span className="font-mono text-[13px] font-medium">{loan.healthFactor.toFixed(2)}</span>
                        <span className={`px-1.5 py-0.5 rounded-full border text-[9px] uppercase tracking-tighter ${health.bg} ${health.border}`}>
                          {health.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 font-mono text-[10px] text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                          Repay
                        </button>
                        <button className="px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 font-mono text-[10px] text-white/60 hover:bg-white/10 hover:text-white transition-colors">
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasLoans && (
        <div className="bg-white/[0.02] px-5 py-3 border-t border-white/[0.04] flex items-center gap-3">
          <ShieldAlert className="h-3 w-3 text-white/20" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">
            Current weighted liquidation threshold: 85.0% · Monitoring 24/7 via PRISM Risk Engine
          </span>
        </div>
      )}
    </section>
  );
}
