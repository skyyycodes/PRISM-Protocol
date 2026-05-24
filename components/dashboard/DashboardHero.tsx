'use client';

import { Activity, Target, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { TrancheKind } from '@/app/lib/constants';
import { formatUsdc } from '@/app/lib/format';
import Link from 'next/link';

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    label: 'PRIME',
    sub: 'SENIOR · PROTECTED',
    tag: 'Paid first · loss last',
    color: '#647b8c',
    bg: 'rgba(50,61,70,0.04)',
    border: 'rgba(100,123,140,0.2)',
    stackWidth: '100%',
    apy: '5.0%',
  },
  [TrancheKind.Core]: {
    label: 'CORE',
    sub: 'MEZZANINE · BALANCED',
    tag: 'Middle risk layer',
    color: '#b29b70',
    bg: 'rgba(178,155,112,0.04)',
    border: 'rgba(178,155,112,0.2)',
    stackWidth: '72%',
    apy: '8.0%',
  },
  [TrancheKind.Alpha]: {
    label: 'ALPHA',
    sub: 'EQUITY · FIRST LOSS',
    tag: 'Levered yield · absorbs losses',
    color: '#b07073',
    bg: 'rgba(176,112,115,0.04)',
    border: 'rgba(176,112,115,0.2)',
    stackWidth: '46%',
    apy: '15.0%',
  },
} as const;

interface DashboardHeroProps {
  tranches: any[];
  userPositions: Array<{ kind: TrancheKind; balance: bigint }>;
  exposure: Array<{ label: string; value: number; color: string }>;
}

export function DashboardHero({ tranches, exposure = [] }: DashboardHeroProps) {
  const totalTVL = tranches.reduce((sum, t) => sum + (t.totalAssets ?? 0n), 0n);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.03] bg-[#0c0c0f] transition-all duration-250">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 font-semibold">
            Exposure Engine v1.0
          </p>
          <h2 className="mt-1 font-sans text-xl font-semibold tracking-tight text-white">Capital Stack</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.03] bg-white/[0.01]">
          <Activity className="h-3 w-3 text-emerald-500" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/30 font-bold">Synced</span>
        </div>
      </div>

      {/* ── Body: split layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">

        {/* Left — Tranche blocks & Concentration Graph */}
        <div className="px-8 py-5 lg:border-r border-white/[0.03] flex flex-col justify-between">
          {/* Concentrated Capital stack liquidity-like graph */}
          <div className="p-5 border border-white/[0.03] bg-white/[0.005] rounded-xl mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/35 font-bold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9945ff] animate-pulse" />
                Capital Stack & Liquidity Distribution
              </span>
              <div className="flex items-center gap-1">
                <button className="p-1 rounded bg-white/[0.02] border border-white/[0.03] text-white/40 hover:text-white/80 transition-colors">
                  <RefreshCw className="h-2.5 w-2.5" />
                </button>
                <button className="p-1 rounded bg-white/[0.02] border border-white/[0.03] text-white/40 hover:text-white/80 transition-colors">
                  <ZoomIn className="h-2.5 w-2.5" />
                </button>
                <button className="p-1 rounded bg-white/[0.02] border border-white/[0.03] text-white/40 hover:text-white/80 transition-colors">
                  <ZoomOut className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6">
              {/* SVG graph area */}
              <div className="relative h-[120px] w-full flex items-end">
                {/* Draw vertical dashed background lines */}
                {[0.2, 0.4, 0.6, 0.8].map((frac, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 border-l border-dashed border-white/[0.015] pointer-events-none"
                    style={{ left: `${frac * 100}%` }}
                  />
                ))}

                {/* Custom SVG */}
                <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="primeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#647b8c" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#647b8c" stopOpacity="0.01" />
                    </linearGradient>
                    <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b29b70" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#b29b70" stopOpacity="0.01" />
                    </linearGradient>
                    <linearGradient id="alphaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b07073" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#b07073" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>

                  {/* Render the bars */}
                  {(() => {
                    const barHeights = [15, 20, 25, 32, 45, 58, 70, 75, 82, 88, 92, 95, 92, 85, 78, 72, 65, 60, 52, 45, 38, 30, 25, 20, 15, 12, 10, 8, 6, 4];
                    const barWidth = 10;
                    const barGap = 3;
                    return barHeights.map((h, i) => {
                      const x = i * (barWidth + barGap);
                      const y = 120 - h;
                      let fill = "url(#primeGrad)";
                      let stroke = "#647b8c70";
                      if (i > 12 && i <= 21) {
                        fill = "url(#coreGrad)";
                        stroke = "#b29b7070";
                      } else if (i > 21) {
                        fill = "url(#alphaGrad)";
                        stroke = "#b0707370";
                      }

                      return (
                        <rect
                          key={i}
                          x={x}
                          y={y}
                          width={barWidth}
                          height={h}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="1"
                          rx="1.5"
                        />
                      );
                    });
                  })()}

                  {/* Boundary Separator 1 (PRIME to CORE) at index 13 */}
                  <line x1="167" y1="0" x2="167" y2="120" stroke="white" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2 4" />
                  {/* Active Range Highlight overlay between line 1 and 2 */}
                  <rect x="167" y="0" width="116" height="120" fill="white" fillOpacity="0.015" pointerEvents="none" />

                  {/* Boundary Separator 2 (CORE to ALPHA) at index 22 */}
                  <line x1="283" y1="0" x2="283" y2="120" stroke="white" strokeOpacity="0.1" strokeWidth="1" strokeDasharray="2 4" />

                  {/* Current utilization indicator */}
                  <line x1="117" y1="0" x2="117" y2="120" stroke="white" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="1 3" />
                  <circle cx="117" cy="40" r="3" fill="#8ab59d" fillOpacity="0.8" />
                </svg>

                {/* Sliders top handles labels in HTML layer */}
                <div className="absolute top-2 left-[42%] -translate-x-1/2 flex flex-col items-center pointer-events-none">
                  <span className="font-sans text-[9px] font-medium bg-white/[0.03] text-white/50 px-1.5 py-0.5 rounded border border-white/[0.05]">
                    -0.78%
                  </span>
                  <div className="h-2 w-px bg-white/[0.1]" />
                </div>

                <div className="absolute top-2 left-[71%] -translate-x-1/2 flex flex-col items-center pointer-events-none">
                  <span className="font-sans text-[9px] font-medium bg-white/[0.03] text-white/50 px-1.5 py-0.5 rounded border border-white/[0.05]">
                    -0.08%
                  </span>
                  <div className="h-2 w-px bg-white/[0.1]" />
                </div>

                <div className="absolute top-8 left-[29%] -translate-x-1/2 flex flex-col items-center pointer-events-none">
                  <span className="font-sans text-[9px] font-medium bg-[#1e2722] text-[#8ab59d] px-2 py-0.5 rounded shadow-[0_2px_4px_rgba(0,0,0,0.1)] border border-white/[0.03]">
                    Active
                  </span>
                </div>
              </div>

              {/* Right details sidebar */}
              <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/[0.03] pt-4 md:pt-0 md:pl-6 gap-3.5">
                <div>
                  <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest block mb-0.5">
                    Current NAV
                  </span>
                  <span className="font-mono text-sm font-bold text-white tracking-tight">
                    1.045200 <span className="text-white/30 text-[10px]">USDC</span>
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest block mb-0.5">
                    24h Index Range
                  </span>
                  <span className="font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                    1.0000 — 1.0850
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest block mb-0.5">
                    Liquidity Density
                  </span>
                  <span className="font-mono text-[9px] text-white/50 font-bold uppercase tracking-wider">
                    High Concentration
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Column Tranche Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRANCHE_ORDER.map((kind, idx) => {
              const meta = TRANCHE_META[kind];
              const tranche = tranches.find(t => t.kind === kind);
              const tvl = tranche?.totalAssets ?? 0n;
              const pct = totalTVL > 0n
                ? Number((tvl * 10000n) / totalTVL) / 100
                : [70, 20, 10][idx];

              return (
                <div
                  key={kind}
                  className="relative overflow-hidden rounded-xl border border-white/[0.03] bg-white/[0.005] hover:bg-white/[0.015] hover:border-white/[0.08] transition-all duration-200 p-4 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-sans text-xs font-bold tracking-wider" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                      <span
                        className="rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold"
                        style={{ borderColor: meta.border, color: meta.color }}
                      >
                        {meta.apy} APY
                      </span>
                    </div>
                    <div className="font-mono text-[8px] text-white/30 uppercase tracking-wider mb-2">
                      {meta.sub}
                    </div>
                    <p className="text-[10px] text-white/40 leading-normal min-h-[32px] mb-4 group-hover:text-white/60 transition-colors">
                      {meta.tag}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-white/[0.03] pt-3">
                    <span className="font-mono text-[8px] text-white/25 uppercase font-bold">TVL</span>
                    <div className="text-right">
                      <span className="font-mono text-xs font-semibold text-white/90 tabular-nums">
                        ${formatUsdc(tvl, 2)}
                      </span>
                      <span className="ml-1.5 font-mono text-[9px] font-bold tabular-nums" style={{ color: meta.color }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Risk Distribution */}
        <div className="flex flex-col px-8 py-5 justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Target className="h-3.5 w-3.5 text-white/20" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/30 font-semibold">Risk Distribution</span>
            </div>

            <div className="space-y-3.5">
              {exposure.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest font-semibold">
                      {item.label}
                    </span>
                    <span className="font-mono text-[11px] text-white/50 font-medium tabular-nums">{item.value}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/[0.01]">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${item.value}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/[0.03] flex items-center justify-between">
            <span className="font-mono text-[9px] text-white/25 uppercase tracking-widest font-semibold">Div. Score</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-white/70 font-semibold">9.2/10</span>
              <span className="font-mono text-[8px] text-emerald-500/80 px-1 py-0.5 rounded border border-emerald-500/10 bg-emerald-500/[0.04] font-bold">OPTIMAL</span>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
