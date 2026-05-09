'use client';

import { useState } from 'react';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  Info,
  Layers,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useConnection } from '@solana/wallet-adapter-react';
import { TrancheKind, Q64_ONE } from '@/app/lib/constants';
import { formatUsdc, getNetworkName } from '@/app/lib/format';
import { usePrismData } from '@/hooks/usePrismData';
import { useDeposit } from '@/hooks/useDeposit';
import { useUserPosition } from '@/hooks/useUserPosition';
import { useAllVaults } from '@/hooks/useAllVaults';

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    label: 'PRIME',
    color: '#38596a',
    glow: 'rgba(56,89,106,0.3)',
    apy: '5.2%',
    risk: 'SENIOR · LOW RISK',
    protection: 'Maximum',
    desc: 'Highest safety. Protected by all subordinated tranches. Ideal for treasury management.',
  },
  [TrancheKind.Core]: {
    label: 'CORE',
    color: '#ad7b21',
    glow: 'rgba(173,123,33,0.3)',
    apy: '8.5%',
    risk: 'MEZZANINE · BALANCED',
    protection: 'High',
    desc: 'Balanced risk and yield. First loss absorbed by Alpha capital. Target return 8.5% APY.',
  },
  [TrancheKind.Alpha]: {
    label: 'ALPHA',
    color: '#9f442b',
    glow: 'rgba(159,68,43,0.3)',
    apy: '15.4%',
    risk: 'JUNIOR · HIGH YIELD',
    protection: 'None',
    desc: 'First-loss capital. Levered exposure to portfolio yield. Highest risk/reward profile.',
  },
} as const;

interface VaultDetailProps {
  vaultId: number;
}

export function VaultDetail({ vaultId }: VaultDetailProps) {
  const { connection } = useConnection();
  const data = usePrismData(vaultId);
  const { data: allVaults } = useAllVaults();
  const deposit = useDeposit();
  const { data: userPositions } = useUserPosition();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const network = getNetworkName(connection.rpcEndpoint);

  function handleDeposit(kind: TrancheKind) {
    const val = parseFloat(amounts[kind] || '');
    if (isNaN(val) || val <= 0) return;
    
    deposit.mutate({
      trancheKind: kind,
      usdcAmount: BigInt(Math.round(val * 1_000_000))
    }, {
      onSuccess: () => setAmounts(prev => ({ ...prev, [kind]: '' }))
    });
  }

  const vaultName = allVaults?.find(v => v.id === vaultId) ? `Credit Vault #${vaultId}` : 'Loading...';

  return (
    <div className="w-full space-y-12 pb-20">
      {/* Back to Marketplace */}
      <div>
        <Link 
          href="/earn"
          className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
          Back to Registry
        </Link>
      </div>

      {/* Header */}
      <section className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/20">{network} Pool</span>
              <div className="h-px w-12 bg-white/10" />
            </div>
            <h1 className="font-display text-5xl text-white tracking-tight">{vaultName}</h1>
            <p className="mt-4 text-sm leading-relaxed text-white/40">
              This pool aggregates diversified Solana-based credit assets. By selecting a tranche, you are choosing your position in the structural repayment waterfall.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="px-6 py-3 rounded-sm border border-white/[0.06] bg-white/[0.02]">
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1">Vault Health</div>
                <div className={`font-mono text-[13px] font-medium ${data.vaultHealth > 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {data.vaultHealth.toFixed(2)}% NOMINAL
                </div>
             </div>
          </div>
        </div>

        {/* Tranche Market Cards */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {TRANCHE_ORDER.map((kind) => {
            const meta = TRANCHE_META[kind];
            const tranche = data.tranches?.find(t => t.kind === kind) || {};
            const userPos = userPositions?.find(p => p.kind === kind);
            const posValue = userPos ? (userPos.balance * (tranche.navPerShareQ || 0n)) / Q64_ONE : 0n;

            return (
              <div key={kind} className="group relative flex flex-col rounded-sm border border-white/[0.08] bg-[#080808] transition-all hover:border-white/[0.15]">
                {/* Header */}
                <div className="border-b border-white/[0.04] p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-10 w-1 rounded-full" 
                        style={{ backgroundColor: meta.color, boxShadow: `0 0 15px ${meta.glow}` }}
                      />
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">{meta.risk}</div>
                        <div className="mt-1 font-mono text-xl font-bold text-white tracking-wider">{meta.label}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400/60 flex items-center gap-1.5 justify-end">
                         <TrendingUp className="h-2.5 w-2.5" /> Target APY
                      </div>
                      <div className="mt-1 font-mono text-3xl font-medium text-white tracking-tighter" style={{ color: meta.color }}>
                        {meta.apy}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                  <div className="bg-[#070707] p-5">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1">Total Assets</div>
                    <div className="font-mono text-[13px] text-white/80">${formatUsdc(tranche.totalAssets || 0n, 0)}</div>
                  </div>
                  <div className="bg-[#070707] p-5">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1">Protection</div>
                    <div className="font-mono text-[13px] text-emerald-400/80 uppercase">{meta.protection}</div>
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1 p-6">
                  <p className="text-[11px] leading-relaxed text-white/40">
                    {meta.desc}
                  </p>
                  <div className="mt-6 flex items-center gap-4 pt-4 border-t border-white/[0.04]">
                     <div className="flex-1">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-2">My Position</div>
                        <div className="font-mono text-[13px] text-white/80">
                          {posValue > 0n ? `$${formatUsdc(posValue, 2)}` : '—'}
                        </div>
                     </div>
                     <div className="flex-1 text-right">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-2">Utilization</div>
                        <div className="font-mono text-[13px] text-white/40">{tranche.utilization.toFixed(2)}%</div>
                     </div>
                  </div>
                </div>

                {/* Action Area */}
                <div className="p-6 pt-0 mt-auto">
                  {!data.connected ? (
                    <button className="w-full py-4 border border-white/10 bg-white/5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:bg-white/10 transition-colors">
                      Connect Wallet to Invest
                    </button>
                  ) : (
                    <>
                      <div className="mb-4 flex items-center gap-2 rounded-sm border border-white/[0.06] bg-black px-3 py-2">
                        <span className="font-mono text-[10px] text-white/20">$</span>
                        <input 
                          type="text" 
                          placeholder="0.00"
                          value={amounts[kind] || ''}
                          onChange={(e) => setAmounts(prev => ({ ...prev, [kind]: e.target.value }))}
                          className="flex-1 bg-transparent font-mono text-[12px] text-white outline-none placeholder:text-white/10"
                        />
                        <span className="font-mono text-[9px] uppercase tracking-widest text-white/20">USDC</span>
                      </div>
                      <button 
                        onClick={() => handleDeposit(kind)}
                        disabled={deposit.isPending}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white text-black font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-white/90 disabled:opacity-50"
                      >
                        Confirm Allocation
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Institutional Details */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <section className="rounded-sm border border-white/[0.08] bg-[#080808] p-8">
             <div className="flex items-center gap-2.5 mb-6">
               <Layers className="h-4 w-4 text-white/40" />
               <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">The Waterfall Structure</h2>
             </div>
             <div className="space-y-4">
                <p className="text-[11px] leading-relaxed text-white/50">
                  PRISM uses a structural credit hierarchy to re-allocate risk. Yield flows from the underlying credit portfolio down the waterfall, while potential losses are absorbed from the bottom up.
                </p>
                <div className="pt-4 space-y-1">
                   {TRANCHE_ORDER.map(kind => (
                     <div key={kind} className="flex items-center justify-between px-4 py-3 rounded-sm border border-white/[0.03] bg-white/[0.01]">
                        <div className="flex items-center gap-3">
                           <div className="h-2 w-2 rounded-full" style={{ backgroundColor: TRANCHE_META[kind].color }} />
                           <span className="font-mono text-[10px] uppercase text-white/60">{TRANCHE_META[kind].label}</span>
                        </div>
                        <span className="font-mono text-[9px] text-white/20 uppercase tracking-widest">
                          {kind === TrancheKind.Alpha ? 'Absorbs first dollar of loss' : `Protected by ${kind === TrancheKind.Core ? 'Alpha' : 'Core & Alpha'}`}
                        </span>
                     </div>
                   ))}
                </div>
             </div>
          </section>

          <section className="rounded-sm border border-white/[0.08] bg-[#080808] p-8 flex flex-col justify-between">
             <div>
               <div className="flex items-center gap-2.5 mb-6">
                 <ShieldCheck className="h-4 w-4 text-white/40" />
                 <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">Risk Intelligence</h2>
               </div>
               <div className="space-y-6">
                  <div className="flex gap-4">
                     <div className="mt-1 shrink-0"><Zap className="h-3.5 w-3.5 text-emerald-400/50" /></div>
                     <div>
                        <div className="font-mono text-[10px] uppercase text-white/80 mb-1">Live NAV Tracking</div>
                        <p className="text-[10px] leading-relaxed text-white/30">Net Asset Value is recalculated every 5 seconds based on real-time credit portfolio health.</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="mt-1 shrink-0"><Info className="h-3.5 w-3.5 text-blue-400/50" /></div>
                     <div>
                        <div className="font-mono text-[10px] uppercase text-white/80 mb-1">Instant Liquidity</div>
                        <p className="text-[10px] leading-relaxed text-white/30">PRISM AMM pools provide secondary market liquidity for all tranche positions.</p>
                     </div>
                  </div>
               </div>
             </div>
             <button className="mt-8 w-full py-4 border border-white/10 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:bg-white/5 transition-colors">
                Download Investor Prospectus (PDF)
             </button>
          </section>
        </div>
      </section>
    </div>
  );
}
