'use client';

import { formatUsdc, stateName } from '@/app/lib/format';

interface TrancheData {
  kind: any;
  totalAssets: any;
  targetApyBps: number;
}

interface TrancheVisualProps {
  tranches: TrancheData[];
  totalDeposits: any;
}

export function TrancheVisual({ tranches, totalDeposits }: TrancheVisualProps) {
  const total = Number(totalDeposits);
  
  return (
    <div className="w-full space-y-4">
      {/* Structural Bars */}
      <div className="flex h-12 w-full gap-1.5 overflow-hidden rounded-[2px] bg-white/[0.03] p-1 border border-white/[0.05]">
        {tranches.map((t, idx) => {
          const kindStr = stateName(t.kind);
          const assets = Number(t.totalAssets);
          const percentage = total > 0 ? (assets / total) * 100 : 33.33;
          
          const colors = [
            'bg-emerald-500/20 border-emerald-500/30', // Prime
            'bg-blue-500/20 border-blue-500/30',       // Core
            'bg-amber-500/20 border-amber-500/30',     // Alpha
          ];
          
          const labelColors = [
            'text-emerald-500',
            'text-blue-500',
            'text-amber-500',
          ];

          return (
            <div 
              key={kindStr}
              className={`relative h-full border transition-all duration-500 group/tranche ${colors[idx]}`}
              style={{ width: `${Math.max(percentage, 5)}%` }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
                <span className={`font-mono text-[8px] font-bold uppercase tracking-tighter ${labelColors[idx]}`}>
                  {kindStr}
                </span>
              </div>
              
              {/* Tooltip-like on hover */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/tranche:opacity-100 transition-opacity pointer-events-none bg-black border border-white/10 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap z-10 shadow-xl">
                 <span className="text-white/40 uppercase">{kindStr}: </span>
                 <span className="text-white">{formatUsdc(t.totalAssets)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Yield Legend */}
      <div className="grid grid-cols-3 gap-2">
        {tranches.map((t, idx) => {
          const kindStr = stateName(t.kind);
          return (
            <div key={kindStr} className="text-center">
               <div className="font-mono text-[9px] text-white/20 uppercase tracking-widest">{kindStr} Yield</div>
               <div className={`mt-0.5 font-mono text-xs font-bold ${
                 idx === 0 ? 'text-emerald-500' : idx === 1 ? 'text-blue-400' : 'text-amber-500'
               }`}>
                 {(t.targetApyBps / 100).toFixed(2)}%
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
