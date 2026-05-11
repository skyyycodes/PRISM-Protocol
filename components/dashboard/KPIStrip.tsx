'use client';

import { useState, useEffect } from 'react';
import { formatUsdc } from '@/app/lib/format';

// ─── Sparkline ────────────────────────────────────────────────────────────────

const PINK = '#e879a0';

const SPARKLINE_DATA = [
  [4, 6, 5, 8, 7, 10, 9, 13, 12, 15, 14, 18],   // net worth   – uptrend
  [3, 5, 4, 7, 6, 8,  9, 11, 10, 13, 15, 16],   // supplied    – steady up
  [10, 8, 9, 7, 8, 6, 7,  5,  6,  4,  5,  3],   // borrowed    – downtrend
  [2, 3, 2, 4, 3, 5, 4,  6,  5,  8,  7, 10],   // daily yield – accelerating
  [14, 15, 13, 15, 14, 16, 15, 16, 15, 17, 16, 18], // health – stable high
  [0, 0, 1, 0, 1, 2, 1, 3, 2, 4, 3, 5],         // claimable  – step-up
];

function Sparkline({ points }: { points: number[] }) {
  const VW = 100;
  const VH = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * VW;
      const y = VH - ((p - min) / range) * (VH - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      width="100%"
      height={VH}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      className="opacity-60"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={PINK}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── KPIStrip ─────────────────────────────────────────────────────────────────

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
  claimableRewards,
}: KPIStripProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hfSafe = typeof healthFactor === 'number' ? healthFactor >= 1.5 : true;

  const metrics = [
    {
      label: 'Net Worth',
      value: isMounted ? `$${formatUsdc(netWorth, 2)}` : '$0.00',
      sub: netWorth > 0n ? '+2.4% this week' : 'No positions yet',
      subColor: netWorth > 0n ? 'text-emerald-400/70' : 'text-white/25',
      sparkIdx: 0,
    },
    {
      label: 'Total Supplied',
      value: isMounted ? `$${formatUsdc(totalSupplied, 2)}` : '$0.00',
      sub: totalSupplied > 0n ? 'Earning across tranches' : 'Nothing earning yet',
      subColor: 'text-white/30',
      sparkIdx: 1,
    },
    {
      label: 'Total Borrowed',
      value: isMounted ? `$${formatUsdc(totalBorrowed, 2)}` : '$0.00',
      sub: totalBorrowed > 0n ? 'Active credit position' : 'No active loans',
      subColor: 'text-white/30',
      sparkIdx: 2,
    },
    {
      label: 'Daily Yield',
      value: isMounted ? `$${formatUsdc(dailyYield, 2)}` : '$0.00',
      sub: dailyYield > 0n ? '↑ 0.3% from yesterday' : 'Accrues on deposit',
      subColor: dailyYield > 0n ? 'text-emerald-400/70' : 'text-white/25',
      sparkIdx: 3,
    },
    {
      label: 'Health Factor',
      value: isMounted ? String(healthFactor) : '—',
      sub: hfSafe ? 'Position is healthy' : 'At risk — add collateral',
      subColor: hfSafe ? 'text-emerald-400/70' : 'text-rose-400/80',
      sparkIdx: 4,
    },
    {
      label: 'Claimable',
      value: isMounted ? `$${formatUsdc(claimableRewards, 2)}` : '$0.00',
      sub: claimableRewards > 0n ? 'Ready to withdraw →' : 'No rewards pending',
      subColor: claimableRewards > 0n ? 'text-[#eca8d6]/70' : 'text-white/25',
      sparkIdx: 5,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 overflow-hidden rounded-xl border border-white/[0.10] backdrop-blur-md bg-white/[0.04] divide-x divide-white/[0.08]">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="group flex flex-col gap-2 px-5 py-5 transition-colors hover:bg-white/[0.04] overflow-hidden"
        >
          {/* Label */}
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
            {m.label}
          </span>

          {/* Value — full width, never truncated */}
          <div className="font-mono text-[22px] font-medium leading-none text-white/90 tabular-nums">
            {m.value}
          </div>

          {/* Sparkline — full card width */}
          <div className="w-full">
            <Sparkline points={SPARKLINE_DATA[m.sparkIdx]} />
          </div>

          {/* Subtitle */}
          <span className={`font-mono text-[10px] ${m.subColor}`}>
            {m.sub}
          </span>
        </div>
      ))}
    </div>
  );
}
