'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Droplets,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';

import { Q64_ONE, TRANCHE_CONFIG, TrancheKind } from '@/app/lib/constants';
import { formatNavQ, formatUsdc, shortKey, stateName, toBigInt } from '@/app/lib/format';
import { EventTickerPanel } from '@/components/simulation/EventTickerPanel';
import { useDeposit } from '@/hooks/useDeposit';
import { useIdentity } from '@/hooks/useIdentity';
import { useCancelInvestIntent, useFiatInvestCheckout, useFiatInvestStatus } from '@/hooks/useFiatInvest';
import { useUserPosition } from '@/hooks/useUserPosition';
import { useVaultState } from '@/hooks/useVaultState';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANCHE_ORDER = [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const;

const TRANCHE_META = {
  [TrancheKind.Prime]: {
    token: 'pPRIME',
    label: 'Prime',
    apy: '5%',
    allocation: 70,
    color: '#38596a',
    risk: 'Lowest risk · absorbs losses last',
  },
  [TrancheKind.Core]: {
    token: 'pCORE',
    label: 'Core',
    apy: '8%',
    allocation: 20,
    color: '#ad7b21',
    risk: 'Balanced risk · middle of the stack',
  },
  [TrancheKind.Alpha]: {
    token: 'pALPHA',
    label: 'Alpha',
    apy: '15%',
    allocation: 10,
    color: '#9f442b',
    risk: 'Highest risk · absorbs losses first',
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

  const trancheAssets = sum(tranches.map((t) => t.totalAssets));
  const reserveBalance = toBigInt(raw?.reserveBalance ?? 0n);

  return {
    connected,
    walletLabel: connected && publicKey ? shortKey(publicKey) : 'Not connected',
    vaultLabel: raw ? shortKey(raw.vaultPda) : 'Vault #0',
    vaultStatus: stateName(raw?.vault?.state),
    tranches,
    vaultCapital: trancheAssets > 0n ? trancheAssets : reserveBalance,
    yieldDistributed: sum(tranches.map((t) => t.cumulativeYield)),
    poolLiquidity: sum(tranches.map((t) => t.ammQuoteBalance)),
    lossBucket: toBigInt(raw?.lossBucketBalance ?? 0n),
    totalLoss: sum(tranches.map((t) => t.cumulativeLoss)),
    isLoading: vaultQuery.isLoading,
    error: vaultQuery.error instanceof Error ? vaultQuery.error : undefined,
  };
}

type DashboardData = ReturnType<typeof useDashboardData>;

// ─── Utils ────────────────────────────────────────────────────────────────────

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── DataState ────────────────────────────────────────────────────────────────

function DataState({ data }: { data: DashboardData }) {
  if (!data.isLoading && !data.error) return null;
  return (
    <div className="mb-4 space-y-2">
      {data.isLoading && (
        <div className="flex items-center gap-2 rounded border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 font-mono text-xs text-white/35">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading vault state…
        </div>
      )}
      {data.error && (
        <div className="flex items-start gap-2.5 rounded border border-[#c45a45]/25 bg-[#9f442b]/[0.08] px-4 py-2.5 text-sm text-[#e8a090]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {data.error.message}
        </div>
      )}
    </div>
  );
}

// ─── SummaryStrip ─────────────────────────────────────────────────────────────

function SummaryStrip({ data }: { data: DashboardData }) {
  const metrics = [
    { label: 'Vault Capital',       value: `$${formatUsdc(data.vaultCapital, 2)}`,     sub: '1 active vault',         icon: Wallet,    accent: '#38596a' },
    { label: 'Yield Distributed',   value: `$${formatUsdc(data.yieldDistributed, 2)}`, sub: 'Since genesis',          icon: TrendingUp, accent: '#ad7b21' },
    { label: 'Protection Buffer',   value: `$${formatUsdc(data.lossBucket, 2)}`,       sub: 'On-chain loss bucket',   icon: Shield,    accent: '#9f442b' },
    { label: 'AMM Liquidity',       value: `$${formatUsdc(data.poolLiquidity, 2)}`,    sub: 'Across tranche pools',   icon: Droplets,  accent: '#eca8d6' },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.04] xl:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="flex flex-col gap-2.5 bg-[#0a0a0a] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">{m.label}</span>
              <Icon className="h-3.5 w-3.5" style={{ color: m.accent }} strokeWidth={1.5} />
            </div>
            <div className="font-mono text-2xl leading-none text-white">{m.value}</div>
            <div className="text-[11px] text-white/25">{m.sub}</div>
          </div>
        );
      })}
    </div>
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
  const navStr = formatNavQ(tranche.navPerShareQ);
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
    <div className={cx(!isLast && 'border-b border-white/[0.05]')}>
      {/* Main row */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_64px_80px_100px] items-center gap-3 px-5 py-3.5">
        {/* Tranche name */}
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
          <div className="min-w-0">
            <div className="text-sm font-medium leading-none text-white">{meta.label}</div>
            <div className="mt-1 font-mono text-[11px] text-white/25">{meta.token}</div>
          </div>
        </div>

        {/* Vault TVL for this tranche */}
        <div>
          <div className="font-mono text-sm text-white/80">${formatUsdc(tranche.totalAssets, 2)}</div>
          <div className="mt-0.5 text-[11px] text-white/25">{meta.allocation}% of vault</div>
        </div>

        {/* User position */}
        <div>
          {hasPosition ? (
            <>
              <div className="font-mono text-sm text-white">${formatUsdc(currentValue, 2)}</div>
              <div className="mt-0.5 font-mono text-[11px] text-white/25">{formatUsdc(userBalance, 2)} {meta.token}</div>
            </>
          ) : (
            <span className="font-mono text-sm text-white/20">—</span>
          )}
        </div>

        {/* APY */}
        <div className="font-mono text-sm font-medium" style={{ color: meta.color }}>{meta.apy}</div>

        {/* NAV/Share */}
        <div className={cx('font-mono text-sm', hasLoss ? 'text-[#e8a090]' : 'text-white/50')}>
          {navStr}
        </div>

        {/* Action */}
        <div className="flex justify-end">
          {connected ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className={cx(
                'rounded border px-2.5 py-1.5 font-mono text-[11px] transition-colors',
                open
                  ? 'border-white/20 bg-white/[0.08] text-white'
                  : 'border-white/[0.07] text-white/35 hover:border-white/15 hover:text-white/65',
              )}
            >
              {open ? 'Cancel' : hasPosition ? 'Add' : 'Invest'}
            </button>
          ) : (
            <Link href="/earn" className="font-mono text-[11px] text-white/20 transition-colors hover:text-white/45">
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

// ─── MyPositionsTable ─────────────────────────────────────────────────────────

function MyPositionsTable({
  data,
  positions,
}: {
  data: DashboardData;
  positions: Array<{ kind: TrancheKind; balance: bigint }> | undefined;
}) {
  const { connected } = useWallet();

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0a0a0a]">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">My Positions</span>
          {!connected && (
            <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-white/20">
              wallet not connected
            </span>
          )}
        </div>
        <Link
          href="/earn"
          className="flex items-center gap-1 font-mono text-[11px] text-white/25 transition-colors hover:text-white/55"
        >
          Earn page
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_64px_80px_100px] gap-3 border-b border-white/[0.04] px-5 py-2.5">
        {['Tranche', 'Vault TVL', 'Your Position', 'APY', 'NAV / Share', ''].map((h) => (
          <div key={h} className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/18">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
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

// ─── ProtocolHealthPanel ──────────────────────────────────────────────────────

function ProtocolHealthPanel({ data }: { data: DashboardData }) {
  const isActive = data.vaultCapital > 0n || data.vaultStatus.toLowerCase() === 'active';

  const rows: Array<{ label: string; value: string; danger?: boolean; dim?: boolean }> = [
    { label: 'Vault ID',       value: data.vaultLabel, dim: true },
    { label: 'TVL',            value: `$${formatUsdc(data.vaultCapital, 2)}` },
    { label: 'Yield out',      value: `$${formatUsdc(data.yieldDistributed, 2)}` },
    { label: 'Loss bucket',    value: `$${formatUsdc(data.lossBucket, 2)}` },
    { label: 'Total losses',   value: `$${formatUsdc(data.totalLoss, 2)}`, danger: data.totalLoss > 0n },
    { label: 'AMM liquidity',  value: `$${formatUsdc(data.poolLiquidity, 2)}` },
  ];

  return (
    <section className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Protocol Health</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cx('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-400' : 'bg-white/15')}
            style={isActive ? { boxShadow: '0 0 5px rgba(52,211,153,0.6)' } : undefined}
          />
          <span className={cx('font-mono text-[11px]', isActive ? 'text-emerald-400' : 'text-white/25')}>
            {isActive ? 'Active' : data.vaultStatus}
          </span>
        </div>
      </div>

      {/* Tranche NAV bars */}
      <div className="space-y-2 border-b border-white/[0.05] px-5 py-4">
        <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/20">Tranche NAVs</div>
        {data.tranches.map((t) => {
          const meta = TRANCHE_META[t.kind];
          const navNum = Number(t.navPerShareQ) / Number(Q64_ONE);
          const pct = Math.min(navNum * 100, 100);
          const hasLoss = t.cumulativeLoss > 0n;
          return (
            <div key={t.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="font-mono text-[11px] text-white/40">{meta.label}</span>
                </div>
                <span className={cx('font-mono text-[11px]', hasLoss ? 'text-[#e8a090]' : 'text-white/50')}>
                  {formatNavQ(t.navPerShareQ)}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: hasLoss ? '#9f442b' : meta.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stat rows */}
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <span className="font-mono text-[11px] text-white/28">{row.label}</span>
            <span
              className={cx(
                'font-mono text-sm',
                row.danger ? 'text-[#e8a090]' : row.dim ? 'text-white/25' : 'text-white/60',
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-3">
        <Link href="/admin" className="font-mono text-[11px] text-white/20 transition-colors hover:text-white/45">
          Admin →
        </Link>
        <Link href="/trade" className="font-mono text-[11px] text-white/20 transition-colors hover:text-white/45">
          Analytics →
        </Link>
        <Link href="/earn" className="font-mono text-[11px] text-white/20 transition-colors hover:text-white/45">
          Earn →
        </Link>
      </div>
    </section>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({ data }: { data: DashboardData }) {
  const { label: roleLabel } = useIdentity();

  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">Portfolio</div>
        <h1 className="mt-2 font-display text-[2.6rem] leading-none text-white">Overview</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Demo role indicator */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#eca8d6]" style={{ boxShadow: '0 0 4px rgba(236,168,214,0.5)' }} />
          <span className="font-mono text-[11px] text-white/40">{roleLabel}</span>
        </div>

        {/* Wallet status */}
        <div
          className={cx(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5',
            data.connected ? 'border-white/[0.07] bg-white/[0.02]' : 'border-white/[0.04]',
          )}
        >
          <span
            className={cx('h-1.5 w-1.5 rounded-full', data.connected ? 'bg-emerald-400' : 'bg-white/15')}
          />
          <span className="font-mono text-[11px] text-white/35">{data.walletLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ─── PrismOverview (main export) ──────────────────────────────────────────────

export function PrismOverview() {
  const data = useDashboardData();
  const { data: positions } = useUserPosition();

  return (
    <div className="mx-auto w-full max-w-[1456px] space-y-5 px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <DataState data={data} />
      <PageHeader data={data} />
      <SummaryStrip data={data} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <MyPositionsTable data={data} positions={positions} />
        <ProtocolHealthPanel data={data} />
      </div>

      <EventTickerPanel />
    </div>
  );
}
