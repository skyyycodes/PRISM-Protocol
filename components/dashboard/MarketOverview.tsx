'use client';

import { 
  ArrowRight, 
  Database,
  Layers
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { stateName, getNetworkName } from '@/app/lib/format';
import { useAllVaults } from '@/hooks/useAllVaults';

export function MarketOverview() {
  const router = useRouter();
  const { connection } = useConnection();
  const { data: allVaults, isLoading: isLoadingVaults } = useAllVaults();
  const network = getNetworkName(connection.rpcEndpoint);

  return (
    <div className="w-full space-y-12 pb-20">
      {/* Page Header */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/20">
          PRISM · Institutional Marketplace
        </div>
        <h1 className="mt-2 font-display text-5xl leading-none text-white tracking-tight">Marketplace</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/40">
          Select an on-chain credit pool to view structural tranches, risk parameters, and deployment options.
        </p>
      </div>

      {/* Vault Registry Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-white/40" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">Vault Registry</h2>
        </div>
        
        <div className="grid grid-cols-1 gap-px bg-white/[0.08] border border-white/[0.08] rounded-sm overflow-hidden">
          {isLoadingVaults ? (
            <div className="bg-[#070707] p-12 text-center font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">
              Scanning on-chain credit pools...
            </div>
          ) : !allVaults || allVaults.length === 0 ? (
            <div className="bg-[#070707] p-12 text-center font-mono text-[10px] text-white/20 uppercase tracking-[0.2em]">
              No active credit pools discovered
            </div>
          ) : (
            allVaults.map((vault) => (
              <div 
                key={vault.id}
                onClick={() => router.push(`/earn/${vault.id}`)}
                className="group flex flex-col md:flex-row md:items-center justify-between p-8 bg-[#070707] hover:bg-white/[0.02] cursor-pointer transition-all border-b border-white/[0.02] last:border-0"
              >
                <div className="flex items-center gap-8">
                   <div className="h-14 w-14 rounded-sm border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:border-white/20 transition-colors">
                      <Database className="h-6 w-6 text-white/20 group-hover:text-white/60 transition-colors" />
                   </div>
                   <div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-lg font-bold tracking-wider text-white/90">Credit Vault #{vault.id}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-[0.15em] ${
                          stateName(vault.state) === 'Active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-white/10 bg-white/5 text-white/40'
                        }`}>
                          {stateName(vault.state)}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-white/30 uppercase tracking-widest">
                        {network} · {vault.publicKey.toString().slice(0, 12)}...{vault.publicKey.toString().slice(-12)}
                      </div>
                   </div>
                </div>

                <div className="mt-6 md:mt-0 flex items-center gap-16 text-right">
                   <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-white/10 mb-1">Status</div>
                      <div className="font-mono text-sm text-white/60 uppercase">{stateName(vault.state)}</div>
                   </div>
                   <div className="w-12 flex justify-end">
                      <div className="h-10 w-10 rounded-full border border-white/5 flex items-center justify-center transition-all group-hover:border-white group-hover:bg-white group-hover:text-black">
                         <ArrowRight className="h-4 w-4" />
                      </div>
                   </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Market Intel (Optional but adds value) */}
      <section className="pt-8 border-t border-white/[0.04] grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-white/20 mb-3">Structural Safety</h4>
            <p className="text-[11px] leading-relaxed text-white/30">Each vault utilizes a multi-tranche repayment waterfall ensuring senior capital protection through junior first-loss buffers.</p>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-white/20 mb-3">Yield Engine</h4>
            <p className="text-[11px] leading-relaxed text-white/30">Capital is deployed into high-grade institutional credit facilities, generating predictable, asset-backed cashflows.</p>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-white/20 mb-3">On-Chain Audit</h4>
            <p className="text-[11px] leading-relaxed text-white/30">Vault states, tranche NAV, and waterfall flows are calculated and enforced directly by PRISM smart contracts.</p>
          </div>
      </section>
    </div>
  );
}
