'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Droplets,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Zap,
} from 'lucide-react';
import type { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';

import { Q64_ONE, TRANCHE_CONFIG, TrancheKind } from '@/app/lib/constants';
import { formatNavQ, formatUsdc, shortKey, stateName, toBigInt } from '@/app/lib/format';
import type { ProtocolEvent } from '@/app/lib/dune-sim';
import { useDeposit } from '@/hooks/useDeposit';
import { useCloakPayout, useCloakViewingKeys } from '@/hooks/useCloakPayout';
import { useEncryptHealth } from '@/hooks/useEncryptHealth';
import { useEvents } from '@/hooks/useEvents';
import { useIdentity } from '@/hooks/useIdentity';
import { useCancelInvestIntent, useFiatInvestCheckout, useFiatInvestStatus } from '@/hooks/useFiatInvest';
import { useSimulationLog } from '@/hooks/useSimulationLog';
import { useUserPosition } from '@/hooks/useUserPosition';
import { useVaultState } from '@/hooks/useVaultState';
import { useLoanApplications } from '@/hooks/useLoanApplications';

import { KPIStrip } from '@/components/dashboard/KPIStrip';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { LoansSection } from '@/components/dashboard/LoansSection';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    token: 'pPRIME',
    label: 'Prime',
    apy: '5%',
    allocation: 70,
    color: '#38596a',
    glow: 'rgba(56,89,106,0.4)',
    soft: '#0f1c21',
    border: '#1d3540',
    risk: 'Lowest risk · absorbs losses last',
    tag: 'Paid first · loss last',
  },
  [TrancheKind.Core]: {
    token: 'pCORE',
    label: 'Core',
    apy: '8%',
    allocation: 20,
    color: '#ad7b21',
    glow: 'rgba(173,123,33,0.4)',
    soft: '#1c1408',
    border: '#3d2d10',
    risk: 'Balanced risk · middle of the stack',
    tag: 'Middle risk layer',
  },
  [TrancheKind.Alpha]: {
    token: 'pALPHA',
    label: 'Alpha',
    apy: '15%',
    allocation: 10,
    color: '#9f442b',
    glow: 'rgba(159,68,43,0.4)',
    soft: '#1c0f0a',
    border: '#3d1f14',
    risk: 'Highest risk · absorbs losses first',
    tag: 'First loss · levered yield',
  },
} as const;

// ─── Data hook ────────────────────────────────────────────────────────────────

function useDashboardData() {
  const { connected, publicKey } = useWallet();
  const vaultQuery = useVaultState();
  const raw = vaultQuery.data;

  function sum(vals: bigint[]) {
    return vals.reduce((a, b) => a + b, 0n);
  }

  const tranches = TRANCHE_ORDER.map((kind) => {
    const config = TRANCHE_CONFIG[kind];
    const live = raw?.tranches.find((t) => t.kind === kind);
    return {
      kind,
      key: config.key,
      totalAssets: live?.totalAssets ?? 0n,
      totalSupply: live?.totalSupply ?? 0n,
      navPerShareQ: live?.navPerShareQ ?? 0n,
      cumulativeYield: live?.cumulativeYield ?? 0n,
      cumulativeLoss: live?.cumulativeLoss ?? 0n,
      ammQuoteBalance: live?.ammQuoteBalance ?? 0n,
    };
  });

  const { data: userPositions } = useUserPosition();
  const { applications } = useLoanApplications();

  const trancheAssets = sum(tranches.map((t) => t.totalAssets));
  const reserveBalance = toBigInt(raw?.reserveBalance ?? 0n);

  const totalSupplied = sum(userPositions?.map(p => {
    const t = tranches.find(tr => tr.kind === p.kind);
    return t ? (p.balance * t.navPerShareQ) / Q64_ONE : 0n;
  }) ?? []);

  const activeLoans = applications.filter(a => a.status === 'approved' && a.loanId !== undefined);
  const totalBorrowed = sum(activeLoans.map(a => BigInt(Math.round(a.requestedUSDC * 1_000_000))));

  const netWorth = totalSupplied - totalBorrowed;
  
  const avgApy = 0.082;
  const dailyYield = (totalSupplied * BigInt(Math.round(avgApy * 10000))) / (10000n * 365n);

  const healthFactor = totalBorrowed > 0n ? 2.45 : '∞';

  const borrowingCapacity = totalBorrowed > 0n ? 15000000000n : 24500000000n;

  const exposure = [
    { label: 'Prime', value: totalSupplied > 0n ? Math.round(Number((totalSupplied / 2n) * 100n / totalSupplied)) : 60, color: '#38596a' },
    { label: 'Core', value: totalSupplied > 0n ? Math.round(Number((totalSupplied / 4n) * 100n / totalSupplied)) : 30, color: '#ad7b21' },
    { label: 'Alpha', value: totalSupplied > 0n ? Math.round(Number((totalSupplied / 4n) * 100n / totalSupplied)) : 10, color: '#9f442b' },
  ];

  const insights: Array<{ text: string, type: 'info' | 'warning' | 'alert' }> = [
    { text: 'Alpha exposure is currently 12% above your target allocation.', type: 'info' },
    { text: 'Borrowing health is optimal. Current capacity: $24.5k.', type: 'info' },
    { text: 'Prime yield distribution increased by 2.4% in the last 24h.', type: 'info' },
  ];

  if (totalBorrowed > 0n && typeof healthFactor === 'number' && healthFactor < 1.5) {
    insights.unshift({ text: 'Borrowing health weakening. Consider adding collateral.', type: 'alert' });
  }

  const loans = activeLoans.map(a => ({
    id: a.id,
    collateral: 'Sui/IKA',
    borrowed: BigInt(Math.round(a.requestedUSDC * 1_000_000)),
    apr: 6.5,
    healthFactor: 2.45,
    status: a.status
  }));

  return {
    connected,
    publicKey,
    walletLabel: connected && publicKey ? shortKey(publicKey) : 'Not connected',
    vaultLabel: raw ? shortKey(raw.vaultPda) : 'Vault #0',
    vaultPda: raw?.vaultPda as PublicKey | undefined,
    vaultStatus: stateName(raw?.vault?.state),
    tranches,
    userPositions: userPositions ?? [],
    vaultCapital: trancheAssets > 0n ? trancheAssets : reserveBalance,
    yieldDistributed: sum(tranches.map((t) => t.cumulativeYield)),
    poolLiquidity: sum(tranches.map((t) => t.ammQuoteBalance)),
    lossBucket: toBigInt(raw?.lossBucketBalance ?? 0n),
    netWorth,
    totalSupplied,
    totalBorrowed,
    dailyYield,
    healthFactor,
    claimableRewards: 0n,
    borrowingCapacity,
    loans,
    exposure,
    insights,
    applications,
    totalLoss: sum(tranches.map((t) => t.cumulativeLoss)),
    loanPda: raw?.loanPda as PublicKey | undefined,
    isLoading: vaultQuery.isLoading,
    error: vaultQuery.error instanceof Error ? vaultQuery.error : undefined,
  };
}

type DashboardData = ReturnType<typeof useDashboardData>;

// ─── Utils ────────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── LivePulse ────────────────────────────────────────────────────────────────

function LivePulse({ active, color = '#34d399' }: { active: boolean; color?: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
      {active && (
        <span
          className="pulse-ring-anim absolute inline-flex h-full w-full rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? color : 'rgba(255,255,255,0.12)' }}
      />
    </span>
  );
}

function decodeViewingKeyAmount(viewingKey: string): bigint | null {
  const [, amount] = viewingKey.split(':');
  if (!amount) return null;
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

// ─── DataState ────────────────────────────────────────────────────────────────

function DataState({ data }: { data: DashboardData }) {
  if (!data.isLoading && !data.error) return null;
  return (
    <div className="space-y-2">
      {data.isLoading && (
        <div className="flex items-center gap-2 rounded border border-white/[0.05] bg-white/[0.015] px-4 py-2.5 font-mono text-xs text-white/30">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading vault state…
        </div>
      )}
      {data.error && (
        <div className="flex items-start gap-2.5 rounded border border-[#c45a45]/20 bg-[#9f442b]/[0.06] px-4 py-2.5 text-sm text-[#e8a090]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {data.error.message}
        </div>
      )}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader({ data }: { data: DashboardData }) {
  const { label: roleLabel } = useIdentity();

  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/20">
          Welcome back, {roleLabel}
        </div>
        <h1 className="mt-1 font-display text-4xl leading-none text-white tracking-tight">Dashboard</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#eca8d6]" style={{ boxShadow: '0 0 4px rgba(236,168,214,0.45)' }} />
          <span className="font-mono text-[11px] text-white/35">{roleLabel}</span>
        </div>
        <div className={cx(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5',
          data.connected ? 'border-white/[0.06] bg-white/[0.015]' : 'border-white/[0.03]',
        )}>
          <span className={cx('h-1.5 w-1.5 rounded-full', data.connected ? 'bg-emerald-400' : 'bg-white/12')} />
          <span className="font-mono text-[11px] text-white/30">{data.walletLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MetricsStrip ─────────────────────────────────────────────────────────────

function MetricsStrip({ data }: { data: DashboardData }) {
  const metrics = [
    { label: 'Vault Capital',     value: `$${formatUsdc(data.vaultCapital, 2)}`,     sub: '1 active vault',      icon: Wallet,    accent: '#38596a' },
    { label: 'Yield Distributed', value: `$${formatUsdc(data.yieldDistributed, 2)}`, sub: 'Since genesis',       icon: TrendingUp, accent: '#ad7b21' },
    { label: 'Protection Buffer', value: `$${formatUsdc(data.lossBucket, 2)}`,       sub: 'On-chain loss bucket', icon: Shield,   accent: '#9f442b' },
    { label: 'AMM Liquidity',     value: `$${formatUsdc(data.poolLiquidity, 2)}`,    sub: 'Across tranche pools', icon: Droplets, accent: '#eca8d6' },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/[0.06] bg-white/[0.03] xl:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="group relative bg-[#070707] px-5 py-4 transition-colors hover:bg-white/[0.02]">
            <div
              className="absolute inset-y-0 left-0 w-[2px] opacity-40 transition-opacity group-hover:opacity-90"
              style={{ backgroundColor: m.accent }}
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/22">{m.label}</span>
              <Icon className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover:opacity-60" style={{ color: m.accent }} strokeWidth={1.5} />
            </div>
            <div className="mt-2.5 font-mono text-2xl leading-none text-white">{m.value}</div>
            <div className="mt-1.5 text-[11px] text-white/18">{m.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── WaterfallEngine ──────────────────────────────────────────────────────────

const PARTICLE_DELAYS = [0, 0.45, 0.9, 1.35, 1.8] as const;

function FlowConnector({ fromColor, toColor }: { fromColor: string; toColor: string }) {
  return (
    <div className="relative mx-5 flex h-8 justify-start">
      <div className="relative ml-3 w-px">
        <div
          className="absolute inset-x-0 top-0 h-full"
          style={{ borderLeft: `1px dashed ${fromColor}35` }}
        />
        {PARTICLE_DELAYS.map((delay) => (
          <span
            key={delay}
            className="flow-particle-down absolute"
            style={{
              left: '-1.5px',
              top: 0,
              width: 3,
              height: 3,
              borderRadius: '50%',
              backgroundColor: toColor,
              boxShadow: `0 0 5px ${toColor}`,
              animationDelay: `${delay}s`,
              animationDuration: '1.8s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TrancheEngineBlock({
  meta,
  tranche,
  delay,
}: {
  meta: typeof TRANCHE_META[TrancheKind];
  tranche: DashboardData['tranches'][number];
  delay: number;
}) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFilled(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const hasLoss = tranche.cumulativeLoss > 0n;

  return (
    <div
      className="group relative overflow-hidden rounded border transition-all duration-300 hover:border-opacity-60"
      style={{ borderColor: meta.border, backgroundColor: meta.soft }}
    >
      {/* Animated allocation fill */}
      <div
        className="absolute inset-y-0 left-0 rounded transition-all duration-1000 ease-out"
        style={{
          width: filled ? `${meta.allocation}%` : '0%',
          background: `linear-gradient(90deg, ${meta.color}28 0%, ${meta.color}08 100%)`,
        }}
      />
      {/* Scanline sweep */}
      <div className="scan-line-anim pointer-events-none" />

      <div className="relative flex items-center justify-between gap-4 px-4 py-3.5">
        {/* Left: tranche identity */}
        <div className="flex items-center gap-3">
          <div
            className="h-7 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.glow}` }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[11px] font-medium uppercase tracking-[0.22em]"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="font-mono text-[10px] text-white/20">{meta.token}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-white/25">
              {meta.allocation}% stack · {meta.tag}
            </div>
          </div>
        </div>

        {/* Right: metrics */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="font-mono text-[10px] text-white/22">TVL</div>
            <div className="font-mono text-[13px] text-white/60">${formatUsdc(tranche.totalAssets, 2)}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-white/22">NAV/sh</div>
            <div className={cx('font-mono text-[13px]', hasLoss ? 'text-[#e8a090]' : 'text-white/50')}>
              {formatNavQ(tranche.navPerShareQ)}
            </div>
          </div>
          <div className="min-w-[44px] text-right">
            <div className="font-mono text-[10px] text-white/22">APY</div>
            <div
              className="font-mono text-[20px] font-medium leading-none tabular-nums"
              style={{ color: meta.color, textShadow: `0 0 12px ${meta.glow}` }}
            >
              {meta.apy}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaterfallEngine({ data }: { data: DashboardData }) {
  const isActive = data.vaultCapital > 0n;

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.06] bg-[#060606]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/28">Yield Routing Engine</span>
          <LivePulse active color="#38596a" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/18">
            <ArrowDown className="h-2.5 w-2.5" strokeWidth={2} />
            Cashflow
            <span className="mx-2 text-white/10">·</span>
            <ArrowUp className="h-2.5 w-2.5 text-[#9f442b]/60" strokeWidth={2} />
            <span className="text-[#9f442b]/50">Loss</span>
          </div>
          <Link
            href="/earn"
            className="flex items-center gap-1 font-mono text-[10px] text-white/18 transition-colors hover:text-white/45"
          >
            Full view <ArrowUpRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* Capital source: Borrowers */}
        <div className="mb-1 flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <Zap className="h-3 w-3 text-white/25" strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
              Borrowers · Credit Positions
            </span>
          </div>
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="font-mono text-[10px] text-white/15">Capital source</span>
        </div>

        {/* Tranche stack with animated connectors */}
        <div className="space-y-0">
          {TRANCHE_ORDER.map((kind, i) => {
            const meta = TRANCHE_META[kind];
            const tranche = data.tranches.find((t) => t.kind === kind) ?? data.tranches[i];
            const nextMeta = i < TRANCHE_ORDER.length - 1 ? TRANCHE_META[TRANCHE_ORDER[i + 1]] : null;
            return (
              <div key={kind}>
                <TrancheEngineBlock meta={meta} tranche={tranche} delay={200 + i * 180} />
                {nextMeta && (
                  <FlowConnector fromColor={meta.color} toColor={nextMeta.color} />
                )}
              </div>
            );
          })}
        </div>

        {/* Yield sink + loss indicator */}
        <div className="mt-1 flex items-stretch gap-2.5">
          <div className="flex flex-1 items-center gap-2 rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <TrendingUp className="h-3 w-3 text-[#ad7b21]/50" strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
              Yield out
              {data.yieldDistributed > 0n
                ? ` · $${formatUsdc(data.yieldDistributed, 2)}`
                : ' · Pending first accrual'}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded border border-[#9f442b]/15 bg-[#9f442b]/[0.05] px-3 py-2">
            <ArrowUp className="h-3 w-3 text-[#9f442b]/50" strokeWidth={1.5} />
            <span className="font-mono text-[10px] text-[#c47f68]/55">Alpha first</span>
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.04] pt-4">
          {[
            { label: 'Capital stack', value: `$${formatUsdc(data.vaultCapital, 2)}` },
            { label: 'Loss buffer',   value: `$${formatUsdc(data.lossBucket, 2)}` },
            { label: 'AMM pools',     value: `$${formatUsdc(data.poolLiquidity, 2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded border border-white/[0.04] bg-white/[0.01] px-3 py-2.5 text-center">
              <div className="font-mono text-[10px] text-white/18">{s.label}</div>
              <div className="mt-1 font-mono text-sm text-white/55">{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── PositionRow ──────────────────────────────────────────────────────────────

function PositionRow({
  tranche,
  userBalance,
  isLast,
}: {
  tranche: DashboardData['tranches'][number];
  userBalance: bigint;
  isLast: boolean;
}) {
  const meta = TRANCHE_META[tranche.kind];
  const deposit = useDeposit();
  const fiatCheckout = useFiatInvestCheckout();
  const { connected, publicKey } = useWallet();
  const cancelIntent = useCancelInvestIntent(publicKey?.toBase58() ?? null, tranche.kind);

  const [amount, setAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'usdc' | 'inr'>('usdc');

  // DB-backed status — no localStorage
  const fiatStatus = useFiatInvestStatus(
    publicKey?.toBase58() ?? null,
    tranche.kind,
  );
  const status = fiatStatus.data?.status ?? 'none';
  const creditedAmountMicro = fiatStatus.data?.amountUsdMicro;

  const hasPosition = userBalance > 0n;
  const currentValue = hasPosition ? (userBalance * tranche.navPerShareQ) / Q64_ONE : 0n;
  const hasLoss = tranche.cumulativeLoss > 0n;

  function handleDeposit() {
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd <= 0) return;
    deposit.mutate(
      { trancheKind: tranche.kind, usdcAmount: BigInt(Math.round(usd * 1_000_000)) },
      { onSuccess: () => { setAmount(''); setOpen(false); } },
    );
  }

  function handleFiatCheckout() {
    const usd = parseFloat(fiatAmount);
    if (isNaN(usd) || usd <= 0 || !publicKey) return;
    fiatCheckout.mutate({
      trancheKind: tranche.kind,
      amountUsd: usd,
      investorPubkey: publicKey.toBase58(),
    });
  }

  function handleCompleteDeposit() {
    if (!creditedAmountMicro) return;
    const usdcAmount = BigInt(creditedAmountMicro);
    deposit.mutate(
      { trancheKind: tranche.kind, usdcAmount },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <div className={cx('group', !isLast && 'border-b border-white/[0.04]')}>
      <div
        className="grid cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-white/[0.018]"
        style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 50px 66px 84px' }}
        onClick={() => connected && setOpen(!open)}
      >
        {/* Tranche identity */}
        <div className="flex items-center gap-2.5">
          <div
            className="h-5 w-[3px] shrink-0 rounded-full transition-all duration-200 group-hover:h-6"
            style={{ backgroundColor: meta.color }}
          />
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-none text-white">{meta.label}</div>
            <div className="mt-0.5 font-mono text-[10px] text-white/18">{meta.token}</div>
          </div>
        </div>

        {/* Vault TVL + allocation bar */}
        <div>
          <div className="font-mono text-[13px] text-white/65">${formatUsdc(tranche.totalAssets, 2)}</div>
          <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${meta.allocation}%`, backgroundColor: `${meta.color}70` }}
            />
          </div>
        </div>

        {/* My position */}
        <div>
          {hasPosition ? (
            <>
              <div className="font-mono text-[13px] text-white">${formatUsdc(currentValue, 2)}</div>
              <div className="mt-0.5 font-mono text-[10px] text-white/22">
                {formatUsdc(userBalance, 2)} {meta.token}
              </div>
            </>
          ) : (
            <span className="font-mono text-[13px] text-white/15">—</span>
          )}
        </div>

        {/* APY */}
        <div
          className="font-mono text-sm font-medium tabular-nums"
          style={{ color: meta.color }}
        >
          {meta.apy}
        </div>

        {/* NAV/share */}
        <div className={cx('font-mono text-sm tabular-nums', hasLoss ? 'text-[#e8a090]' : 'text-white/38')}>
          {formatNavQ(tranche.navPerShareQ)}
        </div>

        {/* Action */}
        <div className="flex justify-end">
          {connected ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              className={cx(
                'rounded border px-2 py-1 font-mono text-[11px] transition-colors',
                open
                  ? 'border-white/12 bg-white/[0.06] text-white'
                  : 'border-white/[0.04] text-white/22 hover:border-white/10 hover:text-white/45',
              )}
            >
              {open ? 'Cancel' : hasPosition ? 'Add' : 'Invest'}
            </button>
          ) : (
            <Link href="/earn" className="font-mono text-[11px] text-white/14 transition-colors hover:text-white/32">
              Earn →
            </Link>
          )}
        </div>
      </div>

      {/* Inline invest form */}
      {open && (
        <div className="border-t border-white/[0.05] bg-white/[0.015] px-5 py-3.5 space-y-3">
          {/* Tab switcher */}
          <div className="flex gap-px overflow-hidden rounded border border-white/[0.08] w-fit">
            <button
              type="button"
              onClick={() => setTab('usdc')}
              className={cx(
                'px-3 py-1.5 font-mono text-[11px] transition-colors',
                tab === 'usdc' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/55',
              )}
            >
              USDC
            </button>
            <button
              type="button"
              onClick={() => setTab('inr')}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] transition-colors',
                tab === 'inr' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/55',
              )}
            >
              <CreditCard className="h-3 w-3" />
              INR via Dodo
            </button>
          </div>

          {tab === 'usdc' && (
            <div className="flex max-w-[280px] items-center gap-2">
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDeposit()}
                placeholder="USDC amount"
                className="min-w-0 flex-1 rounded border border-white/[0.08] bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/15"
              />
              <button
                onClick={handleDeposit}
                disabled={deposit.isPending || !amount}
                className="shrink-0 rounded bg-white px-4 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {deposit.isPending ? '…' : 'Confirm'}
              </button>
            </div>
          )}

          {tab === 'inr' && (
            <div className="space-y-2.5 max-w-[320px]">
              {/* Status banner when returning from Dodo */}
              {status !== 'none' && (
                <div className={cx(
                  'flex items-start gap-2.5 rounded border px-3 py-2.5 text-xs',
                  status === 'pending' || status === 'paid'
                    ? 'border-yellow-500/30 bg-yellow-500/[0.07] text-yellow-200'
                    : status === 'credited'
                    ? 'border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-200'
                    : 'border-red-500/30 bg-red-500/[0.07] text-red-200',
                )}>
                  {status === 'pending' || status === 'paid'
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />
                    : status === 'credited'
                    ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    : <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-semibold">
                      {status === 'pending' && 'Awaiting payment confirmation…'}
                      {status === 'paid' && 'Payment received — bridging USDC…'}
                      {status === 'credited' && 'USDC received — complete your deposit'}
                      {status === 'failed' && 'Payment failed — try again'}
                    </div>
                    {status === 'credited' && creditedAmountMicro && (
                      <div className="mt-0.5 opacity-75">
                        ${(Number(BigInt(creditedAmountMicro)) / 1_000_000).toFixed(2)} USDC ready in your wallet
                      </div>
                    )}
                  </div>
                  {(status === 'pending' || status === 'paid') && (
                    <button
                      type="button"
                      onClick={() => cancelIntent.mutate()}
                      disabled={cancelIntent.isPending}
                      className="shrink-0 rounded border border-yellow-500/25 px-2 py-1 font-mono text-[10px] text-yellow-200/60 transition-colors hover:border-yellow-500/50 hover:text-yellow-200 disabled:opacity-40"
                    >
                      {cancelIntent.isPending ? '…' : 'Cancel'}
                    </button>
                  )}
                </div>
              )}

              {/* Amount input — hidden once credited */}
              {status !== 'credited' && status !== 'paid' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      value={fiatAmount}
                      onChange={(e) => setFiatAmount(e.target.value)}
                      placeholder="Amount in USD"
                      disabled={status === 'pending' || fiatCheckout.isPending}
                      className="w-full rounded border border-white/[0.08] bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/15 disabled:opacity-40"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/20">USD</span>
                  </div>
                  <button
                    onClick={handleFiatCheckout}
                    disabled={!fiatAmount || fiatCheckout.isPending || status === 'pending'}
                    className="shrink-0 flex items-center gap-1.5 rounded border border-purple-500/30 bg-purple-500/[0.12] px-3 py-2 font-mono text-[11px] text-purple-200 transition-colors hover:bg-purple-500/20 disabled:opacity-40"
                  >
                    {fiatCheckout.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                    Pay with Dodo
                  </button>
                </div>
              )}

              {/* Complete deposit button once USDC is credited */}
              {status === 'credited' && (
                <button
                  onClick={handleCompleteDeposit}
                  disabled={deposit.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/[0.12] py-2.5 font-mono text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  {deposit.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Complete deposit into {meta.label}
                </button>
              )}

              {status === 'none' && (
                <p className="font-mono text-[10px] text-white/20 leading-relaxed">
                  Pay with UPI, cards, or netbanking. USDC is bridged to your wallet server-side. You sign the final deposit yourself.
                </p>
              )}
            </div>
          )}

          <p className="font-mono text-[11px] text-white/20">{meta.risk}</p>
        </div>
      )}
    </div>
  );
}

// ─── PositionsPanel ───────────────────────────────────────────────────────────

function PositionsPanel({
  data,
  positions,
}: {
  data: DashboardData;
  positions: Array<{ kind: TrancheKind; balance: bigint }> | undefined;
}) {
  const { connected } = useWallet();

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.06] bg-[#060606]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/28">Positions</span>
          {!connected && (
            <span className="rounded-full border border-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/14">
              wallet offline
            </span>
          )}
        </div>
        <Link href="/earn" className="flex items-center gap-1 font-mono text-[11px] text-white/18 transition-colors hover:text-white/42">
          Earn page <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Column headers */}
      <div
        className="grid gap-2 border-b border-white/[0.03] px-4 py-2"
        style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 50px 66px 84px' }}
      >
        {['Tranche', 'Vault TVL', 'My Position', 'APY', 'NAV/sh', ''].map((h) => (
          <div key={h} className="font-mono text-[10px] text-white/14">{h}</div>
        ))}
      </div>

      <div className="overflow-x-auto">
        {data.tranches.map((tranche, i) => {
          const pos = positions?.find((p) => p.kind === tranche.kind);
          return (
            <PositionRow
              key={tranche.key}
              tranche={tranche}
              userBalance={pos?.balance ?? 0n}
              isLast={i === data.tranches.length - 1}
            />
          );
        })}
      </div>
    </section>
  );
}

// ─── HealthPanel ──────────────────────────────────────────────────────────────

function EncryptHealthBadge({ loanPda }: { loanPda: PublicKey | undefined }) {
  const { data: health, isLoading } = useEncryptHealth(loanPda ?? null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="font-mono text-[11px] text-white/28">Loan health (FHE)</span>
        <span className="font-mono text-[11px] text-white/20">…</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="font-mono text-[11px] text-white/28">Loan health (FHE)</span>
        <span className="font-mono text-[11px] text-white/25">unencrypted</span>
      </div>
    );
  }

  const isProven = health.status === 'DefaultProven';
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <span className="font-mono text-[11px] text-white/28">Loan health (FHE)</span>
      <div className="flex items-center gap-1.5">
        {isProven ? (
          <>
            <ShieldCheck className="h-3 w-3 text-[#e8a090]" />
            <span className="font-mono text-[11px] text-[#e8a090]">default proven</span>
          </>
        ) : (
          <>
            <Lock className="h-3 w-3 text-emerald-400" />
            <span className="font-mono text-[11px] text-emerald-400">encrypted</span>
          </>
        )}
      </div>
    </div>
  );
}

function CloakPayoutBadge({ vaultPda }: { vaultPda: PublicKey | undefined }) {
  const { role } = useIdentity();
  const { data: payout, isLoading } = useCloakPayout(vaultPda ?? null);
  const { data: viewingKeys } = useCloakViewingKeys();

  if (isLoading) {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="font-mono text-[11px] text-white/28">Cloak payout</span>
        <span className="font-mono text-[11px] text-white/20">…</span>
      </div>
    );
  }

  if (!payout || payout.status !== 'Shielded') {
    return (
      <div className="flex items-center justify-between gap-3 px-5 py-2.5">
        <span className="font-mono text-[11px] text-white/28">Cloak payout</span>
        <span className="font-mono text-[11px] text-white/25">payouts public</span>
      </div>
    );
  }

  const revealableTranches: Array<'prime' | 'core' | 'alpha'> =
    role === 'admin'
      ? ['prime', 'core', 'alpha']
      : role === 'senior'
        ? ['prime']
        : role === 'junior'
          ? ['alpha']
          : [];

  function revealViewingKey(tranche: 'prime' | 'core' | 'alpha') {
    const key = viewingKeys?.[tranche];
    if (!key) {
      toast.error(`No viewing key available for ${tranche}. Shield again to refresh keys.`);
      return;
    }
    const amount = decodeViewingKeyAmount(key);
    const trancheLabel = tranche.charAt(0).toUpperCase() + tranche.slice(1);
    if (amount === null) {
      toast(`${trancheLabel} viewing key: ${key}`);
      return;
    }
    toast.success(`${trancheLabel} payout: ${formatUsdc(amount, 2)} USDC`, {
      description: `Viewing key: ${key}`,
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5">
      <span className="font-mono text-[11px] text-white/28">Cloak payout</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-sky-300" />
          <span className="font-mono text-[11px] text-sky-200">shielded via Cloak</span>
        </span>
        {revealableTranches.length > 0 ? (
          <div className="flex items-center gap-1">
            {revealableTranches.map((tranche) => (
              <button
                key={tranche}
                type="button"
                onClick={() => revealViewingKey(tranche)}
                className="rounded border border-sky-300/25 px-1.5 py-0.5 font-mono text-[10px] text-sky-200/80 transition-colors hover:border-sky-300/40 hover:text-sky-200"
              >
                View {tranche}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProtocolHealthPanel({ data }: { data: DashboardData }) {
  const isActive = data.vaultCapital > 0n || data.vaultStatus.toLowerCase() === 'active';

  const rows: Array<{ label: string; value: string; danger?: boolean; dim?: boolean }> = [
    { label: 'Vault',       value: data.vaultLabel,                           dim: true },
    { label: 'TVL',         value: `$${formatUsdc(data.vaultCapital, 2)}` },
    { label: 'Yield out',   value: `$${formatUsdc(data.yieldDistributed, 2)}` },
    { label: 'Loss bucket', value: `$${formatUsdc(data.lossBucket, 2)}` },
    { label: 'Total loss',  value: `$${formatUsdc(data.totalLoss, 2)}`, danger: data.totalLoss > 0n },
  ];

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.06] bg-[#060606]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/28">Protocol Health</span>
        <div className="flex items-center gap-1.5">
          <LivePulse active={isActive} />
          <span className={cx('font-mono text-[11px]', isActive ? 'text-emerald-400' : 'text-white/18')}>
            {isActive ? 'Active' : data.vaultStatus}
          </span>
        </div>
      </div>

      {/* Tranche NAV bars */}
      <div className="space-y-2.5 border-b border-white/[0.04] px-4 py-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/16">Tranche NAVs</div>
        {data.tranches.map((t) => {
          const meta = TRANCHE_META[t.kind];
          const navNum = Number(t.navPerShareQ) / Number(Q64_ONE);
          const pct = Math.min(navNum * 100, 100);
          const hasLoss = t.cumulativeLoss > 0n;
          return (
            <div key={t.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="font-mono text-[11px] text-white/32">{meta.label}</span>
                </div>
                <span className={cx('font-mono text-[11px]', hasLoss ? 'text-[#e8a090]' : 'text-white/38')}>
                  {formatNavQ(t.navPerShareQ)}
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: hasLoss ? '#9f442b' : meta.color,
                    boxShadow: hasLoss ? '0 0 6px rgba(159,68,43,0.5)' : `0 0 6px ${meta.color}60`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stat rows */}
      <div className="divide-y divide-white/[0.03]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="font-mono text-[11px] text-white/20">{row.label}</span>
            <span className={cx(
              'font-mono text-[13px]',
              row.danger ? 'text-[#e8a090]' : row.dim ? 'text-white/18' : 'text-white/52',
            )}>
              {row.value}
            </span>
          </div>
        ))}
        <EncryptHealthBadge loanPda={data.loanPda} />
        <CloakPayoutBadge vaultPda={data.vaultPda} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-2.5">
        {[
          { href: '/admin',   label: 'Admin' },
          { href: '/trade',   label: 'Analytics' },
          { href: '/earn',    label: 'Earn' },
        ].map((link) => (
          <Link key={link.href} href={link.href} className="font-mono text-[11px] text-white/16 transition-colors hover:text-white/38">
            {link.label} →
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── HorizontalTicker ─────────────────────────────────────────────────────────

const TICKER_STYLES: Record<string, { dot: string; text: string }> = {
  'Deposit':       { dot: 'bg-blue-400',   text: 'text-blue-300/70' },
  'Withdraw':      { dot: 'bg-white/35',   text: 'text-white/38' },
  'Yield Accrual': { dot: 'bg-amber-400',  text: 'text-amber-300/70' },
  'Credit Event':  { dot: 'bg-red-400',    text: 'text-red-300/70' },
  'Disbursement':  { dot: 'bg-green-400',  text: 'text-green-300/70' },
  'Repayment':     { dot: 'bg-teal-400',   text: 'text-teal-300/70' },
  'Loan Created':  { dot: 'bg-violet-400', text: 'text-violet-300/70' },
  'AMM Swap':      { dot: 'bg-pink-400',   text: 'text-pink-300/70' },
  'Add Liquidity': { dot: 'bg-cyan-400',   text: 'text-cyan-300/70' },
  'Transaction':   { dot: 'bg-white/20',   text: 'text-white/28' },
};

function getTickerStyle(type: string) {
  return TICKER_STYLES[type] ?? TICKER_STYLES['Transaction'];
}

function relTime(unixSec: number): string {
  const d = Math.floor(Date.now() / 1000) - unixSec;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  return `${Math.floor(d / 3600)}h`;
}

function HorizontalTicker() {
  const { data: duneEvents, isFetching } = useEvents();
  const { entries: logEntries } = useSimulationLog();

  const hasDuneData = duneEvents.length > 0;
  const localEvents: ProtocolEvent[] = logEntries.slice(0, 20).map((e) => ({
    signature: e.id,
    timestamp: Math.floor(new Date(e.timestamp).getTime() / 1000),
    success: e.status !== 'error',
    eventType: e.action,
    signer: e.role,
  }));

  const events = hasDuneData ? duneEvents.slice(0, 20) : localEvents;
  const isLocal = !hasDuneData;

  if (events.length === 0) {
    return (
      <section className="overflow-hidden rounded-md border border-white/[0.05] bg-[#060606]">
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-white/18">Live Events</span>
          <div className="h-px flex-1 bg-white/[0.04]" />
          <span className="font-mono text-[11px] text-white/14">
            {isFetching ? 'Fetching on-chain activity…' : 'No events yet · run a simulation action'}
          </span>
          {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-white/18" />}
        </div>
      </section>
    );
  }

  const doubled = [...events, ...events];

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.05] bg-[#060606]">
      <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-2">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-white/18">Live Events</span>
        <div className="h-px flex-1 bg-white/[0.04]" />
        <div className="flex items-center gap-1.5">
          {isFetching && <RefreshCw className="h-2.5 w-2.5 animate-spin text-white/18" />}
          <span className="font-mono text-[10px] text-white/14">{isLocal ? 'devnet sim' : 'dune sim'}</span>
        </div>
      </div>

      <div className="relative overflow-hidden py-2.5">
        {/* Fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#060606] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#060606] to-transparent" />

        <div className="flex whitespace-nowrap marquee-ticker">
          {doubled.map((event, i) => {
            const style = getTickerStyle(event.eventType);
            const sig = event.signature.length > 10
              ? `${event.signature.slice(0, 6)}…${event.signature.slice(-4)}`
              : event.signature;
            return (
              <span key={`${event.signature}-${i}`} className="mx-6 inline-flex items-center gap-2">
                <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
                <span className={cx('font-mono text-[11px]', style.text)}>{event.eventType}</span>
                <span className="font-mono text-[10px] text-white/14">{sig}</span>
                <span className="font-mono text-[10px] text-white/10">{relTime(event.timestamp)}</span>
                <span className="ml-4 text-white/[0.08]">·</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── PrismOverview ────────────────────────────────────────────────────────────

export default function PrismOverview() {
  const data = useDashboardData();

  return (
    <div className="w-full space-y-8 pb-12">
      <div className="flex flex-col gap-6">
        <PageHeader data={data} />
        <DataState data={data} />
        
        <KPIStrip 
          netWorth={data.netWorth}
          totalSupplied={data.totalSupplied}
          totalBorrowed={data.totalBorrowed}
          dailyYield={data.dailyYield}
          healthFactor={data.healthFactor}
          claimableRewards={0n}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="space-y-8">
          <DashboardHero 
            tranches={data.tranches} 
            userPositions={data.userPositions}
          />
          <LoansSection 
            loans={data.loans} 
            borrowingCapacity={data.borrowingCapacity} 
          />
        </div>

        <div className="relative">
          <div className="sticky top-8">
            <DashboardSidebar 
              exposure={data.exposure}
              insights={data.insights}
            />
          </div>
        </div>
      </div>

      {/* Market Pulse Footer */}
      <div className="pt-8 border-t border-white/[0.04]">
        <HorizontalTicker />
      </div>
    </div>
  );
}
