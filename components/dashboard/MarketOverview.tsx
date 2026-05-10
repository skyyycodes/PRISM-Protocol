'use client';

import { Layers, Star, TrendingUp, Database } from 'lucide-react';
import { useAllVaults } from '@/hooks/useAllVaults';
import { MarketHeader } from '@/components/marketplace/MarketHeader';
import { MarketSignals } from '@/components/marketplace/MarketSignals';
import { MarketFilter } from '@/components/marketplace/MarketFilter';
import { VaultMarketCard } from '@/components/marketplace/VaultMarketCard';

export function MarketOverview() {
  const { data: allVaults, isLoading: isLoadingVaults } = useAllVaults();

  return (
    <div className="w-full max-w-[1800px] mx-auto space-y-4 pb-8">
      {/* 1. Global Market Snapshot */}
      <section className="space-y-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.10] backdrop-blur-md bg-white/[0.04] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 80% at 100% 0%, rgba(56,89,106,0.18) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, rgba(173,123,33,0.10) 0%, transparent 50%)',
            }}
          />
          <div className="relative">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
              PRISM · Institutional Credit Terminal
            </div>
            <h1 className="mt-1.5 font-display text-4xl leading-none text-white tracking-tight">Marketplace</h1>
            <p className="mt-1.5 font-mono text-xs text-white/40">Protocol-wide credit liquidity & risk aggregation</p>
          </div>

          <div className="relative flex items-center gap-8">
            <div className="hidden lg:block text-right">
               <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Exchange Status</div>
               <div className="flex items-center gap-2 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500/80">Operational</span>
               </div>
            </div>

            <div className="hidden lg:block w-px h-12 bg-white/[0.06]" />

            <div className="hidden lg:block text-right">
               <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-1">Market Intel</div>
               <div className="font-mono text-xs text-white/50 uppercase tracking-widest font-bold">Mainnet Ready</div>
            </div>
          </div>
        </div>

        <MarketHeader />
      </section>

      {/* 2. Live Activity Ticker */}
      <MarketSignals />

      {/* 3. Market Discovery & Filters */}
      <section className="space-y-5">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.08] backdrop-blur-md bg-white/[0.02] px-6 py-1">
          <MarketFilter />
        </div>

        {/* Featured Markets Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">Institutional Grade</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
            <Star className="h-3.5 w-3.5 text-amber-500/50" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoadingVaults ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[380px] rounded-xl bg-white/[0.02] border border-white/5 animate-pulse" />
              ))
            ) : !allVaults || allVaults.length === 0 ? (
              <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                 <div className="font-mono text-xs uppercase tracking-widest text-white/20">No active markets detected</div>
              </div>
            ) : (
              allVaults.map((vault) => (
                <VaultMarketCard key={vault.publicKey.toString()} vault={vault} />
              ))
            )}
          </div>
        </div>

        {/* Trending / Deep Markets */}
        {!isLoadingVaults && allVaults && allVaults.length > 0 && (
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">Yield Discovery</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
              <TrendingUp className="h-3.5 w-3.5 text-blue-400/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
               {allVaults.slice(0, 4).map((vault) => (
                 <div
                   key={`small-${vault.id}`}
                   className="p-5 bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer rounded-xl group relative overflow-hidden backdrop-blur-sm"
                 >
                    <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">Market #{vault.id}</div>
                    <div className="flex items-center justify-between relative z-10">
                       <span className="font-display text-sm text-white/80 group-hover:text-white transition-colors">Structured Alpha</span>
                       <span className="font-mono text-xs text-amber-500">{(vault.tranches[2]?.targetApyBps / 100).toFixed(1)}%</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. Infrastructure Footer Intel */}
      <section className="pt-6 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-8">
          {footerIntel.map((item, i) => (
            <div key={i} className="group">
              <div className="flex items-center gap-3 mb-3">
                 <item.icon className="h-4 w-4 text-white/30 group-hover:text-white/50 transition-colors" />
                 <h4 className="font-mono text-[11px] uppercase tracking-widest text-white/30">{item.title}</h4>
              </div>
              <p className="text-xs leading-relaxed text-white/40 group-hover:text-white/50 transition-colors">{item.desc}</p>
            </div>
          ))}
      </section>
    </div>
  );
}

const footerIntel = [
  {
    title: 'Structural Safety',
    desc: 'Each vault utilizes a multi-tranche repayment waterfall ensuring senior capital protection through junior first-loss buffers.',
    icon: Layers
  },
  {
    title: 'Yield Engine',
    desc: 'Capital is deployed into high-grade institutional credit facilities, generating predictable, asset-backed cashflows.',
    icon: TrendingUp
  },
  {
    title: 'On-Chain Audit',
    desc: 'Vault states, tranche NAV, and waterfall flows are calculated and enforced directly by PRISM smart contracts.',
    icon: Database
  }
];
