'use client';

import { Activity, AlertCircle, Loader2, User } from 'lucide-react';

import type { BagsCreator } from '@/app/lib/bags';
import type { BagsValuation } from '@/app/lib/bags-valuation';

interface Props {
  creator: BagsCreator | undefined;
  valuation: BagsValuation | undefined;
  loading?: boolean;
  error?: unknown;
}

export function FeeStreamPreview({ creator, valuation, loading, error }: Props) {
  if (error) {
    return (
      <Card title="Token / fee stream" tone="rose">
        <div className="flex items-start gap-3 text-rose-200/80">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-xs">
            <p className="font-mono uppercase tracking-wider text-rose-300 mb-1">
              Bags read failed
            </p>
            <p className="text-rose-200/70">
              {(error as Error)?.message ?? 'Unknown error'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading || !valuation) {
    return (
      <Card title="Token / fee stream">
        <div className="flex h-32 items-center justify-center text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Token / fee stream">
      <div className="space-y-3">
        <Row label="Primary creator" value={
          <div className="flex items-center gap-2 font-mono text-xs text-white/85">
            <User className="h-3.5 w-3.5 text-white/40" />
            <span>{creator ? `@${creator.providerUsername}` : '—'}</span>
            {creator && (
              <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
                {creator.provider}
              </span>
            )}
          </div>
        } />
        <Row label="Trailing 30-day fees" value={
          <span className="font-mono text-sm tabular-nums text-white">
            {valuation.trailing30dSol.toFixed(3)} <span className="text-white/40">SOL</span>
          </span>
        } />
        <Row label="Lifetime fees" value={
          <span className="font-mono text-sm tabular-nums text-white/80">
            {(Number(valuation.lifetimeLamports) / 1e9).toFixed(2)} <span className="text-white/40">SOL</span>
          </span>
        } />
        <Row label="Annualised (USD)" value={
          <span className="font-mono text-sm tabular-nums text-white/80">
            ${valuation.annualisedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        } />
        <Row label="SOL/USD reference" value={
          <span className="font-mono text-xs tabular-nums text-white/50">
            ${valuation.solUsdPrice.toFixed(2)}
          </span>
        } />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </span>
      {value}
    </div>
  );
}

function Card({
  title,
  tone = 'default',
  children,
}: {
  title: string;
  tone?: 'default' | 'rose';
  children: React.ReactNode;
}) {
  const border =
    tone === 'rose' ? 'border-rose-500/20' : 'border-white/[0.10]';
  const bg = tone === 'rose' ? 'bg-rose-500/[0.04]' : 'bg-white/[0.03]';
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5 backdrop-blur-md`}>
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-white/40" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
