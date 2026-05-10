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
  Lock
} from 'lucide-react';

interface VaultMarketCardProps {
  vault: any;
}

export function VaultMarketCard({ vault }: VaultMarketCardProps) {
  const router = useRouter();
  
  // Mock some descriptive data based on ID for visual variety
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
      <div className="p-8 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
             <div className="h-11 w-11 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center justify-center group-hover:border-white/20 transition-colors shadow-inner">
                <Database className="h-5 w-5 text-white/20 group-hover:text-white/60 transition-colors" />
             </div>
             <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/20">{category}</div>
                <h3 className="font-display text-xl text-white tracking-tight">Credit Vault #{vault.id}</h3>
             </div>
          </div>
          <div className={`px-3 py-1 rounded-full border text-[9px] uppercase tracking-[0.2em] font-bold ${health.bg} ${health.color} ${health.border} backdrop-blur-sm shadow-sm`}>
            {health.label}
          </div>
        </div>

        {/* Tranche Breakdown */}
        <div className="pt-2">
           <div className="flex items-center gap-2 mb-4">
              <div className="h-px w-4 bg-white/[0.10]" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">Capital Structure</span>
           </div>
           <TrancheVisual tranches={vault.tranches} totalDeposits={vault.totalDeposits} />
        </div>
      </div>

      {/* Stats Divider */}
      <div className="flex-1 px-8 py-5 grid grid-cols-2 gap-y-5 gap-x-8 border-y border-white/[0.06] bg-white/[0.01]">
         <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1.5">Total TVL</div>
            <div className="font-mono text-base font-medium text-white/80 tabular-nums">${formatUsdc(vault.totalDeposits, 0)}</div>
         </div>
         <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1.5">Utilization</div>
            <div className="font-mono text-base font-medium text-white/80 tabular-nums">{vault.utilization}%</div>
         </div>
         <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1.5">Market Status</div>
            <div className="font-mono text-[11px] text-emerald-500 uppercase tracking-widest font-bold">{stateName(vault.state)}</div>
         </div>
         <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1.5">Risk Buffer</div>
            <div className="font-mono text-[11px] text-blue-400 uppercase tracking-widest font-bold">95% Protected</div>
         </div>
      </div>

      {/* Footer / Actions */}
      <div className="p-5 flex items-center justify-between bg-white/[0.01]">
         <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
               <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/40" />
               <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">Insured</span>
            </div>
            <div className="flex items-center gap-2">
               <Globe className="h-3.5 w-3.5 text-blue-500/40" />
               <span className="font-mono text-[9px] uppercase tracking-widest text-white/30">Global</span>
            </div>
         </div>
         
         <div className="h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center transition-all group-hover:border-white group-hover:bg-white group-hover:text-black shadow-lg">
            <ArrowRight className="h-4 w-4" />
         </div>
      </div>

      {/* Hover Pulse Effect */}
      <div className="absolute top-4 right-4 pointer-events-none">
         <Activity className="h-3.5 w-3.5 text-emerald-500/0 group-hover:text-emerald-500/30 transition-colors animate-pulse" />
      </div>
    </div>
  );
}
