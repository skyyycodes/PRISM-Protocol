'use client';

import { Loader2, TrendingUp } from 'lucide-react';

import { formatUsdc, type BagsValuation } from '@/app/lib/bags-valuation';

interface Props {
  valuation: BagsValuation | undefined;
  shareBps: number;
  loading?: boolean;
}

export function LoanQuoteCard({ valuation, shareBps, loading }: Props) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-300/70" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
          USDC loan quote
        </p>
      </div>

      {loading || !valuation ? (
        <div className="flex h-32 items-center justify-center text-emerald-200/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-200/50 mb-1">
              Max USDC
            </p>
            <p className="font-mono text-3xl tabular-nums text-emerald-100">
              ${formatUsdc(valuation.maxLoanUsdc)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <Stat
              label="Pledged share"
              value={`${(shareBps / 100).toFixed(0)}%`}
            />
            <Stat
              label="LTV cap"
              value={`${(valuation.ltvBps / 100).toFixed(0)}%`}
            />
            <Stat
              label="Annualised pledged"
              value={`$${valuation.pledgedAnnualisedUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <Stat
              label="Effective APR"
              value="8.5%"
              note="reference"
            />
          </div>

          <p className="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] p-3 font-mono text-[10px] leading-relaxed text-emerald-200/60">
            Loan is sized to {(valuation.ltvBps / 100).toFixed(0)}% of the
            annualised pledged revenue. The Bags fee claimer PDA collects fees
            continuously and the keeper applies them as partial repayments.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
      <p className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-200/40">
        {label}
      </p>
      <p className="font-mono text-sm tabular-nums text-emerald-100">
        {value}{' '}
        {note && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-200/40">
            {note}
          </span>
        )}
      </p>
    </div>
  );
}
