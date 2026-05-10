'use client';

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
  const W = 72;
  const H = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 opacity-70"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={PINK}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  const hfSafe = typeof healthFactor === 'number' ? healthFactor >= 1.5 : true;

  const metrics = [
    {
      label: 'Net Worth',
      value: `$${formatUsdc(netWorth, 2)}`,
      sub: netWorth > 0n ? '+2.4% this week' : 'No positions yet',
      subColor: netWorth > 0n ? 'text-emerald-400/70' : 'text-white/25',
      sparkIdx: 0,
    },
    {
      label: 'Total Supplied',
      value: `$${formatUsdc(totalSupplied, 2)}`,
      sub: totalSupplied > 0n ? 'Earning across tranches' : 'Nothing earning yet',
      subColor: 'text-white/30',
      sparkIdx: 1,
    },
    {
      label: 'Total Borrowed',
      value: `$${formatUsdc(totalBorrowed, 2)}`,
      sub: totalBorrowed > 0n ? 'Active credit position' : 'No active loans',
      subColor: 'text-white/30',
      sparkIdx: 2,
    },
    {
      label: 'Daily Yield',
      value: `$${formatUsdc(dailyYield, 2)}`,
      sub: dailyYield > 0n ? '↑ 0.3% from yesterday' : 'Accrues on deposit',
      subColor: dailyYield > 0n ? 'text-emerald-400/70' : 'text-white/25',
      sparkIdx: 3,
    },
    {
      label: 'Health Factor',
      value: String(healthFactor),
      sub: hfSafe ? 'Position is healthy' : 'At risk — add collateral',
      subColor: hfSafe ? 'text-emerald-400/70' : 'text-rose-400/80',
      sparkIdx: 4,
    },
    {
      label: 'Claimable',
      value: `$${formatUsdc(claimableRewards, 2)}`,
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
          className="group flex flex-col justify-between px-6 py-6 transition-colors hover:bg-white/[0.04] min-h-[110px]"
        >
          {/* Label */}
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">
            {m.label}
          </span>

          {/* Value + sparkline */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="font-mono text-[26px] font-medium leading-none text-white/90 tabular-nums">
              {m.value}
            </div>
            <Sparkline points={SPARKLINE_DATA[m.sparkIdx]} />
          </div>

          {/* Subtitle */}
          <span className={`mt-3 font-mono text-[11px] ${m.subColor}`}>
            {m.sub}
          </span>
        </div>
      ))}
    </div>
  );
}
