'use client';

import { useRouter } from 'next/navigation';
import { TrancheVisual } from './TrancheVisual';
import { formatUsdc, stateName } from '@/app/lib/format';
import {
  Database,
  ArrowRight,
  Activity,
  ShieldCheck,
  Globe,
} from 'lucide-react';

interface VaultMarketCardProps {
  vault: any;
}

export function VaultMarketCard({ vault }: VaultMarketCardProps) {
  const router = useRouter();

  const getCategory = (id: number) => {
    const categories = ['Structured Credit', 'Institutional SOL', 'RWA Financed', 'Liquidity Alpha'];
    return categories[id % categories.length];
  };

  const getHealth = (id: number) => {
     if (id === 1) return { label: 'High Demand', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' };
     return { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
  };

  const health = getHealth(vault.id);
  const category = getCategory(vault.id);

  return (
    <div
      onClick={() => router.push(`/earn/${vault.id}`)}
      className="group relative backdrop-blur-md bg-white/[0.04] border border-white/[0.10] hover:border-white/20 transition-all cursor-pointer overflow-hidden rounded-xl flex flex-col h-full"
    >
      {/* Top Section */}
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center justify-center group-hover:border-white/20 transition-colors shadow-inner">
                <Database className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
             </div>
             <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">{category}</div>
                <h3 className="font-display text-xl text-white tracking-tight">Credit Vault #{vault.id}</h3>
             </div>
          </div>
          <div className={`px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.15em] font-bold ${health.bg} ${health.color} ${health.border} backdrop-blur-sm`}>
            {health.label}
          </div>
        </div>

        {/* Tranche Breakdown */}
        <div>
           <div className="flex items-center gap-2 mb-3">
              <div className="h-px w-4 bg-white/[0.10]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">Capital Structure</span>
           </div>
           <TrancheVisual tranches={vault.tranches} totalDeposits={vault.totalDeposits} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 px-6 py-4 grid grid-cols-2 gap-y-4 gap-x-6 border-y border-white/[0.06] bg-white/[0.01]">
         <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Total TVL</div>
            <div className="font-mono text-base font-medium text-white/90 tabular-nums">${formatUsdc(vault.totalDeposits, 0)}</div>
         </div>
         <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Utilization</div>
            <div className="font-mono text-base font-medium text-white/90 tabular-nums">{vault.utilization}%</div>
         </div>
         <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Market Status</div>
            <div className="font-mono text-sm text-emerald-500 uppercase tracking-widest font-bold">{stateName(vault.state)}</div>
         </div>
         <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Risk Buffer</div>
            <div className="font-mono text-sm text-blue-400 uppercase tracking-widest font-bold">95% Protected</div>
         </div>
      </div>

      {/* Footer */}
      <div className="p-5 flex items-center justify-between bg-white/[0.01]">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/50" />
               <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Insured</span>
            </div>
            <div className="flex items-center gap-2">
               <Globe className="h-3.5 w-3.5 text-blue-500/50" />
               <span className="font-mono text-xs uppercase tracking-widest text-white/40">Global</span>
            </div>
         </div>

         <div className="h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center transition-all group-hover:border-white group-hover:bg-white group-hover:text-black shadow-lg">
            <ArrowRight className="h-4 w-4" />
         </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-none">
         <Activity className="h-3.5 w-3.5 text-emerald-500/0 group-hover:text-emerald-500/30 transition-colors animate-pulse" />
      </div>
    </div>
  );
}
