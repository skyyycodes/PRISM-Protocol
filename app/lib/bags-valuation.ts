/**
 * Collateral valuation for Bags fee streams.
 *
 * A creator pledges `share_bps` of their token's perpetual fee stream as
 * collateral for a USDC loan. To size that loan responsibly, we need:
 *
 *   1. The trailing 30-day SOL fee revenue (volatility proxy).
 *   2. A SOL/USD reference price (Pyth in prod; placeholder here).
 *   3. A conservative LTV cap (BAGS_MAX_LTV_BPS, ~30%) — fee streams are
 *      volatile collateral, so we cap loans well below the headline number.
 *
 * The valuation is intentionally simple: 30-day SOL × USD × share × LTV.
 * Production should layer in volatility-adjusted haircuts and holder
 * concentration risk. See docs/bags-hackathon-strategy.md (Tier C).
 */

import { BAGS_MAX_LTV_BPS } from './constants';
import {
  getTokenClaimStats,
  getTokenLifetimeFees,
  lamportsToSol,
  type BagsClaimStats,
  type BagsLifetimeFees,
} from './bags';

export interface BagsValuation {
  tokenMint: string;
  /** Trailing 30-day SOL fees, lamports. */
  trailing30dLamports: bigint;
  /** Trailing 30-day SOL fees, SOL. */
  trailing30dSol: number;
  /** Cumulative SOL fees since launch, lamports. */
  lifetimeLamports: bigint;
  /** SOL/USD reference price used. */
  solUsdPrice: number;
  /** Annualised SOL fee revenue, in USD (30d × 12). */
  annualisedUsd: number;
  /** Borrower's share of that revenue, in USD (× share_bps / 10000). */
  pledgedAnnualisedUsd: number;
  /** Max USDC loan we'd quote (× BAGS_MAX_LTV_BPS / 10000). */
  maxLoanUsdc: bigint;
  /** Effective LTV applied. */
  ltvBps: number;
}

const DEFAULT_SOL_USD = 160; // scaffold reference; replaced by Pyth in prod

/**
 * Compute a conservative USDC loan quote for a creator's fee stream.
 *
 * @param tokenMint     Bags token mint
 * @param shareBps      Fee share the creator is pledging (out of 10_000)
 * @param solUsdPrice   Override SOL/USD price (Pyth feed in prod)
 */
export async function quoteFeeStreamLoan(args: {
  tokenMint: string;
  shareBps: number;
  solUsdPrice?: number;
}): Promise<BagsValuation> {
  const { tokenMint, shareBps } = args;
  const solUsd = args.solUsdPrice ?? DEFAULT_SOL_USD;

  const [stats, lifetime]: [BagsClaimStats, BagsLifetimeFees] = await Promise.all([
    getTokenClaimStats(tokenMint),
    getTokenLifetimeFees(tokenMint),
  ]);

  const trailing30dSol = lamportsToSol(stats.trailing30dLamports);
  const annualisedUsd = trailing30dSol * 12 * solUsd;
  const pledgedAnnualisedUsd = (annualisedUsd * shareBps) / 10_000;
  const maxLoanUsd = (pledgedAnnualisedUsd * BAGS_MAX_LTV_BPS) / 10_000;

  // USDC has 6 decimals — convert USD → base units (1 USD = 1_000_000).
  const maxLoanUsdc = BigInt(Math.floor(maxLoanUsd * 1_000_000));

  return {
    tokenMint,
    trailing30dLamports: stats.trailing30dLamports,
    trailing30dSol,
    lifetimeLamports: lifetime.lifetimeLamports,
    solUsdPrice: solUsd,
    annualisedUsd,
    pledgedAnnualisedUsd,
    maxLoanUsdc,
    ltvBps: BAGS_MAX_LTV_BPS,
  };
}

/** USDC base units (6 decimals) → display string. */
export function formatUsdc(amountBase: bigint, decimals = 2): string {
  const whole = amountBase / 1_000_000n;
  const frac = amountBase % 1_000_000n;
  const fracStr = String(frac).padStart(6, '0').slice(0, decimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}
