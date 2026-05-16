'use client';

import { Loader2, Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  shareBps: number;
  onShareChange: (v: number) => void;
  loading?: boolean;
}

export function BagsTokenLookup({
  value,
  onChange,
  shareBps,
  onShareChange,
  loading,
}: Props) {
  return (
    <div className="rounded-xl border border-white/[0.10] bg-white/[0.03] p-5 backdrop-blur-md">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
        Step 1 — Pick your Bags token
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="bags-mint"
            className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/40"
          >
            Token mint
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              id="bags-mint"
              type="text"
              spellCheck={false}
              value={value}
              onChange={(e) => onChange(e.target.value.trim())}
              placeholder="So11111111111111111111111111111111111111112"
              className="w-full rounded-lg border border-white/[0.10] bg-black/30 py-2.5 pl-9 pr-10 font-mono text-xs text-white placeholder:text-white/20 focus:border-fuchsia-400/40 focus:outline-none"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white/40" />
            )}
          </div>
        </div>

        <div className="sm:w-44">
          <label
            htmlFor="bags-share"
            className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/40"
          >
            Pledge share
          </label>
          <div className="relative">
            <input
              id="bags-share"
              type="number"
              min={100}
              max={10_000}
              step={100}
              value={shareBps}
              onChange={(e) => onShareChange(Math.max(100, Math.min(10_000, Number(e.target.value) || 0)))}
              className="w-full rounded-lg border border-white/[0.10] bg-black/30 py-2.5 pl-3 pr-12 font-mono text-xs text-white focus:border-fuchsia-400/40 focus:outline-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-wider text-white/40">
              bps
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-white/30">
            {(shareBps / 100).toFixed(0)}% of trading fees
          </p>
        </div>
      </div>
    </div>
  );
}
