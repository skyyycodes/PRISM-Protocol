'use client';

import { useMemo } from 'react';
import { useBorrowerState } from '@/hooks/useBorrowerState';
import { useVaultState } from '@/hooks/useVaultState';
import { formatUsdc } from '@/app/lib/format';
import {
  BarChart3,
  Activity,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Layers,
  Zap,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function PanelSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-white/[0.22] bg-white/[0.06]">
      <div className="flex items-center gap-2 border-b border-white/[0.18] px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-white/85" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/65">{title}</span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Metric({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="font-mono text-xs uppercase tracking-wider text-white/85 leading-tight">{label}</span>
      <div className="text-right">
        <div className={cn('font-mono text-xs font-semibold leading-tight', color ?? 'text-white/65')}>{value}</div>
        {sub && <div className="mt-0.5 font-mono text-xs uppercase tracking-wider text-white/85">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-0.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function LoanIntelligencePanel() {
  const {
    amount, duration, collateralUsd, borrowerType, selectedVaultId, currentStep,
  } = useBorrowerState();

  const effectiveVaultId = selectedVaultId ?? 0;
  const vaultState = useVaultState(effectiveVaultId);
  const data = vaultState.data;

  const numAmount = Number(amount) || 0;
  const numCollateral = Number(collateralUsd) || 0;

  const apr = 8.5;
  const ltv = numCollateral > 0 ? (numAmount / numCollateral) * 100 : 0;
  const collateralRatio = numAmount > 0 ? (numCollateral / numAmount) * 100 : 0;
  const healthFactor = ltv > 0 ? 1.2 / (ltv / 100) : 0;

  const interest = numAmount * (apr / 100) * (duration / 365);
  const totalDue = numAmount + interest;

  const poolLiquidity = (data?.tranches ?? []).reduce((s, t) => s + t.ammQuoteBalance, 0n);
  const tvl = (data?.tranches ?? []).reduce((s, t) => s + t.totalAssets, 0n);
  const utilization = tvl > 0n ? Number(((tvl - poolLiquidity) * 100n) / tvl) : 0;
  const isHealthy = (data?.lossBucketBalance ?? 0n) === 0n;

  const liquidityImpact = poolLiquidity > 0n
    ? (numAmount / (Number(poolLiquidity) / 1_000_000)) * 100
    : 0;

  const approvalProb = useMemo(() => {
    if (numAmount === 0) return 0;
    if (selectedVaultId === null) return 0;
    if (ltv > 80) return 28;
    if (ltv > 65) return 62;
    if (ltv > 0) return 94;
    return 75;
  }, [ltv, numAmount, selectedVaultId]);

  const ltvColor =
    ltv === 0 ? 'text-white/65' :
    ltv > 80   ? 'text-rose-400' :
    ltv > 65   ? 'text-amber-400' :
                 'text-pink-400';

  const approvalColor =
    approvalProb > 80 ? 'bg-pink-400/50' :
    approvalProb > 50 ? 'bg-amber-500/50' :
                        'bg-rose-500/50';

  // PROGRESSIVE REVELATION LOGIC
  return (
    <div className="space-y-3">
      {/* STEP 1: PROFILE */}
      {(currentStep === 1 || currentStep === 6 || currentStep === 7) && (
        <PanelSection title="Borrower Status" icon={ShieldCheck}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-sm border border-pink-400/10 bg-pink-400/[0.03] p-3">
              <div className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <div className="flex-1">
                <div className="font-mono text-sm font-bold text-white/90">Identity Verified</div>
                <div className="font-mono text-xs uppercase tracking-wider text-white/65">Ref: PRISM-AUTH-9921</div>
              </div>
            </div>

            <Metric
              label="Borrower Type"
              value={borrowerType === 'institutional' ? 'Institutional' : 'Individual'}
              sub="Tier 1 Classification"
            />
            <Metric
              label="Credit Eligibility"
              value="Qualified"
              color="text-pink-400"
            />
            <Metric
              label="Limit Capacity"
              value="$500,000 USDC"
              sub="Standard Protocol Limit"
            />
          </div>
        </PanelSection>
      )}

      {/* STEP 2: POOL */}
      {(currentStep === 2 || currentStep >= 6) && (
        <PanelSection title="Pool Intelligence" icon={Building2}>
          {selectedVaultId !== null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-white/85">Selected Pool</span>
                <span className="font-mono text-sm font-bold text-white">#{selectedVaultId}</span>
              </div>
              <Metric
                label="Pool Health"
                value={isHealthy ? 'Institutional Grade' : 'Loss Active'}
                color={isHealthy ? 'text-pink-400' : 'text-rose-400'}
                sub={isHealthy ? '0.00% Default Rate' : 'Recovery Mode'}
              />
              <Metric
                label="Available Reserve"
                value={`$${formatUsdc(poolLiquidity, 0)}`}
                sub="Total USDC Liquidity"
              />
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-white/85">Market Utilization</span>
                  <span className={cn("font-mono text-sm", utilization > 85 ? 'text-rose-400' : 'text-white/85')}>
                    {utilization.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar value={utilization} color={utilization > 85 ? 'bg-rose-500/50' : utilization > 65 ? 'bg-amber-500/50' : 'bg-pink-400/40'} />
              </div>
            </div>
          ) : (
            <div className="py-2.5 text-center border border-dashed border-white/[0.22] rounded-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-white/85">Awaiting Selection</div>
              <div className="mt-2 text-xs text-white/80">Select a market to view depth</div>
            </div>
          )}
        </PanelSection>
      )}

      {/* STEP 3 & 4: STRUCTURE & COLLATERAL */}
      {(currentStep === 3 || currentStep === 4 || currentStep >= 6) && (
        <PanelSection title="Facility Projection" icon={TrendingUp}>
          <div className="space-y-3">
            <Metric label="Principal" value={numAmount > 0 ? `$${numAmount.toLocaleString()}` : '—'} />
            <Metric label="Duration" value={`${duration} Days`} sub="Fixed maturity term" />
            <Metric label="Estimated APR" value={`${apr.toFixed(2)}%`} color="text-white/80" />
            
            <div className="h-px w-full bg-white/[0.10]" />
            
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-white/85">Repayment at Maturity</span>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-white">${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="font-mono text-xs uppercase tracking-wider text-white/85">USDC Settlement</div>
              </div>
            </div>
          </div>
        </PanelSection>
      )}

      {/* STEP 5: RISK (also visible in submission) */}
      {(currentStep === 5 || currentStep >= 6) && (
        <>
          <PanelSection title="Underwriting Analysis" icon={Zap}>
            <div className="space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-white/85">Approval Confidence</span>
                  <span className={cn(
                    'font-mono text-xs font-bold',
                    approvalProb > 80 ? 'text-pink-400' : approvalProb > 50 ? 'text-amber-400' : 'text-rose-400',
                  )}>
                    {approvalProb}%
                  </span>
                </div>
                <ProgressBar value={approvalProb} color={approvalColor} />
                <p className="text-xs text-white/85 leading-relaxed italic">
                  {approvalProb > 80 ? 'Optimized for institutional approval.' : 
                   approvalProb > 50 ? 'Consider increasing collateral to improve odds.' : 
                   'High risk profile. Protocol rejection likely.'}
                </p>
              </div>

              <Metric label="Risk Grade" value={ltv < 65 ? 'A1 — Prime' : ltv < 80 ? 'B1 — Core' : 'C1 — Alpha'} color={ltvColor} />
              <Metric label="LTV Ratio" value={`${ltv.toFixed(1)}%`} sub="Max Limit: 80%" color={ltvColor} />
              <Metric label="Liquidity Impact" value={`${liquidityImpact.toFixed(2)}%`} sub="Protocol utilization delta" />
            </div>
          </PanelSection>

          <PanelSection title="Tranche Structure" icon={Layers}>
            <div className="space-y-3">
              {[
                { label: 'Prime Tranche',  pct: 50, color: 'bg-sky-400/30',   note: 'Senior / Low Yield' },
                { label: 'Core Tranche',   pct: 35, color: 'bg-amber-400/30', note: 'Mezzanine / Med Yield' },
                { label: 'Alpha Tranche',  pct: 15, color: 'bg-rose-400/30',  note: 'Junior / High Yield' },
              ].map(({ label, pct, color, note }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs uppercase tracking-wider text-white/85">{label}</span>
                    <span className="font-mono text-xs text-white/85">{note}</span>
                  </div>
                  <ProgressBar value={pct} color={color} />
                </div>
              ))}
              <p className="text-xs text-white/85 leading-relaxed pt-2 border-t border-white/[0.15]">
                Your facility is backed by tiered liquidity. The Alpha tranche provides loss-absorption protection.
              </p>
            </div>
          </PanelSection>
        </>
      )}

      {/* Protocol State (General Info) */}
      {currentStep === 1 && (
        <PanelSection title="Network State" icon={Activity}>
          <div className="space-y-3">
            <Metric label="Active Markets" value="4 Live" color="text-white/80" />
            <Metric label="Global TVL" value="$12.4M" color="text-white/80" />
            <Metric label="24H Volume" value="$2.1M" color="text-white/75" />
          </div>
        </PanelSection>
      )}
    </div>
  );
}
