'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ExternalLink, AlertTriangle } from 'lucide-react';

import { bagsApiConfigured, getTokenCreators } from '@/app/lib/bags';
import { quoteFeeStreamLoan } from '@/app/lib/bags-valuation';
import { BAGS_MAX_LTV_BPS, BAGS_TOKEN_URL } from '@/app/lib/constants';
import { BagsTokenLookup } from '@/components/creator-credit/BagsTokenLookup';
import { FeeStreamPreview } from '@/components/creator-credit/FeeStreamPreview';
import { LoanQuoteCard } from '@/components/creator-credit/LoanQuoteCard';
import { PledgeFeeClaimerStep } from '@/components/creator-credit/PledgeFeeClaimerStep';

export default function CreatorCreditPage() {
  const [tokenMint, setTokenMint] = useState('');
  const [shareBps, setShareBps] = useState(2_000); // 20% pledge by default
  const apiLive = bagsApiConfigured();

  const creatorsQuery = useQuery({
    queryKey: ['bags-creators', tokenMint],
    queryFn: () => getTokenCreators(tokenMint),
    enabled: tokenMint.length >= 32,
    staleTime: 60_000,
  });

  const valuationQuery = useQuery({
    queryKey: ['bags-valuation', tokenMint, shareBps],
    queryFn: () => quoteFeeStreamLoan({ tokenMint, shareBps }),
    enabled: tokenMint.length >= 32,
    staleTime: 60_000,
  });

  const primaryCreator = useMemo(
    () => creatorsQuery.data?.find((c) => c.isCreator),
    [creatorsQuery.data],
  );

  return (
    <div className="relative flex-1 overflow-y-auto px-8 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero apiLive={apiLive} />

        {!apiLive && <MockBanner />}

        <BagsTokenLookup
          value={tokenMint}
          onChange={setTokenMint}
          loading={creatorsQuery.isFetching || valuationQuery.isFetching}
          shareBps={shareBps}
          onShareChange={setShareBps}
        />

        {tokenMint.length >= 32 && (
          <div className="grid gap-5 md:grid-cols-2">
            <FeeStreamPreview
              creator={primaryCreator}
              valuation={valuationQuery.data}
              loading={creatorsQuery.isLoading || valuationQuery.isLoading}
              error={creatorsQuery.error ?? valuationQuery.error}
            />
            <LoanQuoteCard
              valuation={valuationQuery.data}
              shareBps={shareBps}
              loading={valuationQuery.isLoading}
            />
          </div>
        )}

        {valuationQuery.data && primaryCreator && (
          <PledgeFeeClaimerStep
            tokenMint={tokenMint}
            shareBps={shareBps}
            creatorWallet={primaryCreator.wallet}
            maxLoanUsdcBase={valuationQuery.data.maxLoanUsdc}
          />
        )}

        <ProtocolDisclaimer />
      </div>
    </div>
  );
}

function PageHero({ apiLive }: { apiLive: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-md">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 100% 0%, rgba(232,121,160,0.10) 0%, transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, rgba(168,85,247,0.08) 0%, transparent 50%)',
        }}
      />
      <div className="relative flex flex-col gap-5 px-8 py-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.06] shadow-[0_0_24px_rgba(217,70,239,0.10)]">
            <Sparkles className="h-5 w-5 text-fuchsia-300/90" strokeWidth={1.75} />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                Bags Creator Credit
              </span>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/30">
                Fee-stream collateral
              </span>
              <span
                className={`ml-1 flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
                  apiLive
                    ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                    : 'border-amber-500/20 bg-amber-500/[0.06]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    apiLive ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                    apiLive ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {apiLive ? 'Live API' : 'Mock data'}
                </span>
              </span>
            </div>
            <h1 className="font-display text-3xl leading-none tracking-tight text-white">
              Borrow USDC against your Bags fees.
            </h1>
            <p className="mt-3 max-w-xl font-mono text-xs leading-relaxed text-white/40">
              Pledge a share of your Bags token&apos;s perpetual 1% trading fees as
              collateral. PRISM tranches absorb the credit risk; you get USDC up front
              without selling your bag.
            </p>
          </div>
        </div>
        <a
          href={BAGS_TOKEN_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.02] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 hover:border-white/25 hover:bg-white/[0.05] hover:text-white/80 transition-all sm:flex"
        >
          Bags.fm
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function MockBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <div className="text-xs text-amber-200/80 leading-relaxed">
        <p className="font-mono uppercase tracking-[0.2em] text-amber-300 mb-1">
          Bags API key not configured
        </p>
        <p>
          All Bags reads on this page return deterministic mock data. Set{' '}
          <code className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono">
            BAGS_API_KEY
          </code>{' '}
          in <code>.env.local</code> to swap in live data. Mock values are stable per
          token mint so demos remain reproducible.
        </p>
      </div>
    </div>
  );
}

function ProtocolDisclaimer() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 mb-3">
        How the underwriting works
      </p>
      <ul className="space-y-2 font-mono text-[11px] leading-relaxed text-white/55">
        <li>
          1. We read the token&apos;s trailing 30-day SOL fee revenue from the Bags API
          (<code className="text-white/70">getTokenClaimStats</code>) and annualise it.
        </li>
        <li>
          2. Your pledge share (basis points) determines the slice routed to a
          PRISM-controlled fee-claimer PDA via Bags&apos; multi-claimer fee config.
        </li>
        <li>
          3. We apply a {(BAGS_MAX_LTV_BPS / 100).toFixed(0)}% LTV cap on the
          annualised USD revenue to size the USDC loan — fee streams are volatile.
        </li>
        <li>
          4. The off-chain keeper polls{' '}
          <code className="text-white/70">getClaimablePositions</code>, claims SOL,
          swaps to USDC, and applies it as a partial repayment through{' '}
          <code className="text-white/70">repay_loan</code>.
        </li>
        <li>
          5. On default, the PDA retains the fee-claimer assignment — fees accrue to
          the loss bucket until the loan is whole or the credit event is recorded.
        </li>
      </ul>
    </div>
  );
}
