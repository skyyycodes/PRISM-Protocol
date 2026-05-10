'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useLoanApplications } from '@/hooks/useLoanApplications';
import { BorrowerProvider, useBorrowerState } from '@/hooks/useBorrowerState';
import { BorrowingWorkflow } from '@/components/borrower/BorrowingWorkflow';
import { LoanIntelligencePanel } from '@/components/borrower/LoanIntelligencePanel';
import { useVaultState } from '@/hooks/useVaultState';
import { useAllVaults } from '@/hooks/useAllVaults';
import { formatUsdc } from '@/app/lib/format';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Wallet, TrendingUp, Layers, Zap } from 'lucide-react';

// ─── Status Bar ───────────────────────────────────────────────────────────────
function StatusBar() {
  const { publicKey, connected } = useWallet();
  const { getByBorrower } = useLoanApplications();
  const allVaults = useAllVaults();

  const existingApp = publicKey ? getByBorrower(publicKey.toBase58()) : undefined;
  const totalMarkets = (allVaults.data ?? []).length;
  const isHealthy = true; // Simplified for UI

  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}…${publicKey.toBase58().slice(-6)}`
    : 'Not connected';

  const bars = [
    {
      label: 'Identity',
      value: connected ? walletShort : 'Disconnected',
      icon: Wallet,
      accent: connected ? 'text-white/85' : 'text-rose-400/70',
      dot: connected ? 'bg-pink-400' : 'bg-rose-500',
    },
    {
      label: 'Credit Capacity',
      value: connected ? '$500,000 USDC' : '—',
      icon: TrendingUp,
      accent: 'text-white/85',
    },
    {
      label: 'Active Markets',
      value: `${totalMarkets} Live Pools`,
      icon: Layers,
      accent: 'text-white/85',
    },
    {
      label: 'Protocol Status',
      value: isHealthy ? 'Operational' : 'Maintenance',
      icon: Activity,
      accent: isHealthy ? 'text-pink-400' : 'text-amber-400',
      dot: isHealthy ? 'bg-pink-400' : 'bg-amber-500',
    },
    ...(existingApp
      ? [{
          label: 'Current Application',
          value: existingApp.status === 'pending' ? 'Under Review' : existingApp.status === 'approved' ? 'Approved' : 'Rejected',
          icon: AlertTriangle,
          accent: existingApp.status === 'approved' ? 'text-pink-400' : existingApp.status === 'pending' ? 'text-amber-400' : 'text-rose-400',
          dot: existingApp.status === 'approved' ? 'bg-pink-400' : existingApp.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500',
        }]
      : []),
  ];

  return (
    <div className="mb-3 flex items-stretch overflow-x-auto rounded-sm border border-white/[0.22] bg-black/30">
      {bars.map(({ label, value, icon: Icon, accent, dot }, i) => (
        <div
          key={label}
          className={cn(
            'flex shrink-0 flex-col gap-1 border-r border-white/[0.18] px-4 py-2.5 last:border-r-0',
          )}
        >
          <div className="flex items-center gap-2">
            {dot && <div className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/85">{label}</span>
          </div>
          <span className={cn('font-mono text-xs font-medium whitespace-nowrap', accent)}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
function PageHeader() {
  const { clearApplications } = useLoanApplications();
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-sm border border-white/[0.25] bg-white/[0.09] px-2.5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-white/65">
            Structured Credit Terminal
          </span>
          <span className="rounded-sm border border-white/[0.20] bg-white/[0.06] px-2.5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-white/85">
            IKA Collateral
          </span>
        </div>
        <h1 className="font-display text-4xl leading-none tracking-tight text-white">
          Credit Facility Application
        </h1>
        <p className="mt-2 font-mono text-sm uppercase tracking-[0.18em] text-white/85">
          Institutional underwriting · Threshold custody · On-chain execution
        </p>
      </div>

      <button
        onClick={() => {
          if (confirm('Clear application history and reset session?')) {
            clearApplications();
            window.location.reload();
          }
        }}
        className="shrink-0 rounded-sm border border-white/[0.22] bg-white/[0.06] px-3 py-2 font-mono text-xs uppercase tracking-widest text-white/85 hover:border-white/30 hover:text-white/90 transition-colors"
      >
        Reset Session
      </button>
    </div>
  );
}

// ─── Inner Layout (needs BorrowerProvider context) ────────────────────────────
function BorrowPageInner() {
  return (
    <div data-app-scroll className="relative flex-1 overflow-y-auto px-4 py-2 [overscroll-behavior:contain]">
      <div className="mx-auto w-full max-w-[1600px]">
        <PageHeader />
        <StatusBar />

        {/* Main 70/30 Layout */}
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left — Workflow */}
          <div className="min-w-0">
            <BorrowingWorkflow />
          </div>

          {/* Right — Intelligence Panel */}
          <aside className="space-y-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/85">
                Live Intelligence
              </span>
              <div className="h-px flex-1 bg-white/[0.10]" />
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-pink-400/60 animate-pulse" />
                <span className="font-mono text-xs uppercase tracking-wider text-white/85">Live</span>
              </div>
            </div>
            <LoanIntelligencePanel />
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────────────
export default function BorrowPage() {
  return (
    <BorrowerProvider>
      <BorrowPageInner />
    </BorrowerProvider>
  );
}
