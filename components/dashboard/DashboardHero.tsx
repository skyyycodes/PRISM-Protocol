'use client';

import { Activity } from 'lucide-react';
import { TrancheKind } from '@/app/lib/constants';
import { formatUsdc } from '@/app/lib/format';

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    label: 'PRIME',
    sub: 'SENIOR · PROTECTED',
    tag: 'Paid first · loss last',
    color: '#4a7d94',
    bg: 'rgba(45,78,92,0.50)',
    border: '#3d6678',
    glow: 'rgba(74,125,148,0.55)',
    stackWidth: '100%',
    apy: '5.0%',
  },
  [TrancheKind.Core]: {
    label: 'CORE',
    sub: 'MEZZANINE · BALANCED',
    tag: 'Middle risk layer',
    color: '#c8963a',
    bg: 'rgba(107,74,16,0.50)',
    border: '#8f6518',
    glow: 'rgba(200,150,58,0.55)',
    stackWidth: '72%',
    apy: '8.0%',
  },
  [TrancheKind.Alpha]: {
    label: 'ALPHA',
    sub: 'EQUITY · FIRST LOSS',
    tag: 'Levered yield · absorbs losses',
    color: '#c07060',
    bg: 'rgba(92,36,22,0.50)',
    border: '#7a3020',
    glow: 'rgba(192,112,96,0.55)',
    stackWidth: '46%',
    apy: '15.0%',
  },
} as const;

interface DashboardHeroProps {
  tranches: any[];
  userPositions: Array<{ kind: TrancheKind; balance: bigint }>;
}

export function DashboardHero({ tranches, userPositions }: DashboardHeroProps) {
  const totalTVL = tranches.reduce((sum, t) => sum + (t.totalAssets ?? 0n), 0n);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.10] backdrop-blur-md bg-white/[0.04]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.07]">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/30">
            Exposure Engine v1.0
          </p>
          <h2 className="mt-1.5 font-display text-2xl text-white">Capital Stack</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03]">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-white/40">Real-time sync</span>
        </div>
      </div>

      {/* ── Tranche blocks ── */}
      <div className="px-8 py-7 space-y-4">
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
              className="relative overflow-hidden rounded-lg"
              style={{
                width: meta.stackWidth,
                border: `1px solid ${meta.border}`,
                backgroundColor: meta.bg,
              }}
            >
              {/* Top shine line */}
              <div
                className="absolute inset-x-0 top-0 h-px opacity-30"
                style={{ backgroundColor: meta.color }}
              />

              {/* Content */}
              <div className="flex items-center justify-between px-5 py-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold tracking-[0.15em]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] text-white/35 uppercase tracking-wider">
                      {meta.sub}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold"
                      style={{ borderColor: meta.border, color: meta.color }}
                    >
                      {meta.apy}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-white/20">{meta.tag}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-mono text-base font-medium text-white/85 tabular-nums">
                    ${formatUsdc(tvl, 2)}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-bold tabular-nums" style={{ color: meta.color }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-white/[0.07] px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          {/* Protection buffer */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/25">
              Protection Buffer
            </span>
            <div className="mt-2 flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1.5 w-10 rounded-full ${i < 4 ? 'bg-white/20' : 'bg-white/5'}`} />
              ))}
            </div>
          </div>
          {/* Total */}
          <div className="text-right">
            <span className="font-mono text-[11px] uppercase tracking-widest text-white/25">
              Total Capital Stack
            </span>
            <div className="mt-1 font-mono text-xl font-medium text-white/65 tabular-nums">
              ${formatUsdc(totalTVL, 2)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button className="flex-1 py-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-[0.2em] hover:bg-white/90 transition-colors rounded">
            Manage All Positions
          </button>
          <button className="flex-1 py-3 border border-white/10 text-white/50 font-mono text-xs font-bold uppercase tracking-[0.2em] hover:bg-white/5 transition-colors rounded">
            Extract Yield
          </button>
        </div>
      </div>

    </section>
  );
}
