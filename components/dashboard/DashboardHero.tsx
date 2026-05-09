'use client';

import { 
  ArrowDown, 
  ArrowUp, 
  ShieldCheck, 
  Zap, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { TrancheKind, Q64_ONE } from '@/app/lib/constants';
import { formatUsdc, formatNavQ } from '@/app/lib/format';

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    label: 'PRIME',
    color: '#38596a',
    glow: 'rgba(56,89,106,0.3)',
    desc: 'SENIOR · PROTECTED',
    protection: 'Protected by Core & Alpha layers',
  },
  [TrancheKind.Core]: {
    label: 'CORE',
    color: '#ad7b21',
    glow: 'rgba(173,123,33,0.3)',
    desc: 'MEZZANINE · BALANCED',
    protection: 'Protected by Alpha layer',
  },
  [TrancheKind.Alpha]: {
    label: 'ALPHA',
    color: '#9f442b',
    glow: 'rgba(159,68,43,0.3)',
    desc: 'JUNIOR · FIRST LOSS',
    protection: 'Absorbs first protocol losses',
  },
} as const;

interface DashboardHeroProps {
  tranches: any[];
  userPositions: Array<{ kind: TrancheKind; balance: bigint }>;
}

export function DashboardHero({ tranches, userPositions }: DashboardHeroProps) {
  const totalPositionValue = userPositions.reduce((acc, p) => {
    const t = tranches.find(tr => tr.kind === p.kind);
    return acc + (t ? (p.balance * t.navPerShareQ) / Q64_ONE : 0n);
  }, 0n);

  return (
    <section className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#080808]">
      <div className="flex flex-col xl:flex-row">
        
        {/* LEFT: EXPOSURE ENGINE (60%) */}
        <div className="border-b border-white/[0.08] p-8 xl:w-[60%] xl:border-b-0 xl:border-r">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">Exposure Engine v1.0</h2>
              <div className="mt-1 font-display text-2xl text-white">Capital Allocation Hierarchy</div>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
                 <Activity className="h-2.5 w-2.5 text-emerald-500 animate-pulse" />
                 <span className="font-mono text-[9px] uppercase tracking-widest text-white/40">Real-time sync</span>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            {TRANCHE_ORDER.map((kind) => {
              const meta = TRANCHE_META[kind];
              const tranche = tranches.find(t => t.kind === kind) || {};
              const userPos = userPositions.find(p => p.kind === kind);
              const posValue = userPos ? (userPos.balance * tranche.navPerShareQ) / Q64_ONE : 0n;
              const hasPosition = posValue > 0n;
              
              const allocationPct = totalPositionValue > 0n 
                ? Number((posValue * 10000n) / totalPositionValue) / 100 
                : 0;

              return (
                <div key={kind} className="group relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-3 w-1 rounded-full"
                        style={{ backgroundColor: meta.color, boxShadow: `0 0 10px ${meta.glow}` }}
                      />
                      <span className="font-mono text-[11px] font-bold tracking-wider text-white/80">{meta.label}</span>
                      <span className="font-mono text-[9px] text-white/20">{meta.desc}</span>
                    </div>
                    <div className="text-right">
                       <span className="font-mono text-[13px] text-white/90 tabular-nums">${formatUsdc(posValue, 2)}</span>
                       <span className="ml-2 font-mono text-[10px] text-white/20">{allocationPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Layered Exposure Bar */}
                  <div className="relative h-10 w-full overflow-hidden rounded-sm border border-white/[0.04] bg-white/[0.02]">
                    {/* Background Progress (Total TVL Context) */}
                    <div 
                      className="absolute inset-y-0 left-0 opacity-[0.05]"
                      style={{ backgroundColor: meta.color, width: '100%' }}
                    />
                    
                    {/* User Allocation Fill */}
                    <div 
                      className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out flex items-center px-4"
                      style={{ 
                        width: hasPosition ? `${Math.max(allocationPct, 15)}%` : '0%', 
                        backgroundColor: `${meta.color}30`,
                        borderRight: `2px solid ${meta.color}`
                      }}
                    >
                      {hasPosition && (
                        <div className="flex items-center gap-2">
                           <Zap className="h-3 w-3" style={{ color: meta.color }} />
                           <span className="font-mono text-[9px] text-white/40 uppercase tracking-tighter">Active Exposure</span>
                        </div>
                      )}
                    </div>

                    {/* Protection Indicators */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       <span className="font-mono text-[8px] text-white/10 uppercase tracking-widest">{meta.protection}</span>
                       <ShieldCheck className="h-3 w-3 text-white/10" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: OPERATIONAL METRICS (40%) */}
        <div className="flex-1 p-8 bg-white/[0.01]">
          <div className="mb-8">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">Capital Health</h2>
            <div className="mt-1 font-display text-2xl text-white">Risk Concentration</div>
          </div>

          <div className="space-y-8">
            {/* Yield Concentration */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] text-white/40 uppercase">Yield Efficiency</span>
                <span className="font-mono text-[10px] text-emerald-400">Optimal</span>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {TRANCHE_ORDER.map(kind => {
                  const userPos = userPositions.find(p => p.kind === kind);
                  const hasPos = (userPos?.balance ?? 0n) > 0n;
                  return (
                    <div 
                      key={kind} 
                      className="flex-1 rounded-t-sm transition-all duration-700" 
                      style={{ 
                        height: hasPos ? '100%' : '10%', 
                        backgroundColor: TRANCHE_META[kind].color,
                        opacity: hasPos ? 0.6 : 0.1
                      }} 
                    />
                  );
                })}
              </div>
            </div>

            {/* Protection Buffer */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Protection Buffer</span>
                <span className="font-mono text-[10px] text-white/60">Nominal</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-1.5 rounded-full ${i < 4 ? 'bg-white/20' : 'bg-white/5'}`} />
                ))}
              </div>
              <p className="mt-3 font-mono text-[9px] text-white/20 uppercase tracking-wide leading-relaxed">
                Your capital is currently protected by $42,500 of Junior & Mezzanine first-loss capital.
              </p>
            </div>

            {/* Action Cluster */}
            <div className="pt-4 flex flex-col gap-2">
              <button className="w-full py-3 bg-white text-black font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/90 transition-colors">
                Manage All Positions
              </button>
              <button className="w-full py-3 border border-white/10 text-white/60 font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-colors">
                Extract Yield
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Flow Indicator */}
      <div className="h-[2px] w-full bg-white/[0.02]">
        <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/3 animate-marquee-ticker" />
      </div>
    </section>
  );
}
