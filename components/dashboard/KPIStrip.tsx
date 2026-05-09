'use client';

import { 
  Wallet, 
  TrendingUp, 
  ArrowDownToLine, 
  Activity, 
  ShieldCheck, 
  Gift,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatUsdc } from '@/app/lib/format';

interface KPIStripProps {
  netWorth: bigint;
  totalSupplied: bigint;
  totalBorrowed: bigint;
  dailyYield: bigint;
  healthFactor: number | string;
  claimableRewards: bigint;
}

export function KPIStrip({
  netWorth,
  totalSupplied,
  totalBorrowed,
  dailyYield,
  healthFactor,
  claimableRewards
}: KPIStripProps) {
  const metrics = [
    { 
      label: 'Net Worth', 
      value: `$${formatUsdc(netWorth, 2)}`, 
      icon: Wallet, 
      color: '#FFFFFF',
      delta: '+2.4%',
      trend: 'up'
    },
    { 
      label: 'Total Supplied', 
      value: `$${formatUsdc(totalSupplied, 2)}`, 
      icon: ArrowDownToLine, 
      color: '#38596a',
      delta: 'Active',
      trend: 'neutral'
    },
    { 
      label: 'Total Borrowed', 
      value: `$${formatUsdc(totalBorrowed, 2)}`, 
      icon: Activity, 
      color: '#ad7b21',
      delta: '-1.2%',
      trend: 'down'
    },
    { 
      label: 'Daily Yield', 
      value: `$${formatUsdc(dailyYield, 2)}`, 
      icon: TrendingUp, 
      color: '#34d399',
      delta: '↑ 0.3%',
      trend: 'up'
    },
    { 
      label: 'Health Factor', 
      value: healthFactor, 
      icon: ShieldCheck, 
      color: typeof healthFactor === 'number' && healthFactor < 1.5 ? '#9f442b' : '#34d399',
      delta: 'Optimal',
      trend: 'up'
    },
    { 
      label: 'Claimable', 
      value: `$${formatUsdc(claimableRewards, 2)}`, 
      icon: Gift, 
      color: '#eca8d6',
      delta: 'New',
      trend: 'up'
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="group relative bg-[#070707] px-4 py-3.5 transition-colors hover:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/20">{m.label}</span>
              <Icon className="h-3 w-3 opacity-20 transition-opacity group-hover:opacity-50" style={{ color: m.color }} strokeWidth={1.5} />
            </div>
            
            <div className="mt-2 flex items-baseline justify-between gap-1">
              <div className="font-mono text-xl font-medium leading-none text-white/90 tabular-nums">
                {m.value}
              </div>
              
              {m.delta && (
                <div className={`flex items-center gap-0.5 font-mono text-[9px] font-bold uppercase tracking-tight ${
                  m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-rose-500' : 'text-white/30'
                }`}>
                  {m.trend === 'up' && <ArrowUpRight className="h-2 w-2" />}
                  {m.trend === 'down' && <ArrowDownRight className="h-2 w-2" />}
                  {m.delta}
                </div>
              )}
            </div>

            {/* Subtle Pulse Line for "Alive" feel */}
            <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-white/5 transition-all duration-1000 group-hover:w-full" />
          </div>
        );
      })}
    </div>
  );
}
