/**
 * Bags.fm integration — Solana launchpad with fee sharing.
 *
 * Bags creators earn 1% of all trading volume on their token, paid in SOL.
 * Fee shares are programmable (basis points across up to 100 claimers), and
 * the protocol can register itself as a fee claimer PDA against a creator's
 * token to act as collateral on a USDC loan.
 *
 * This module is intentionally network-tolerant. When `BAGS_API_KEY` is not
 * set (the common dev case while waiting for credentials), every public
 * function returns a deterministic mock that is structurally identical to
 * the real Bags response. Swap the key in and live data flows automatically.
 *
 * Real endpoints are documented at https://docs.bags.fm — this file only
 * speaks the surface PRISM actually consumes:
 *   - getTokenCreators          (creator identity + royaltyBps)
 *   - getTokenLifetimeFees      (historical fee revenue, SOL)
 *   - getTokenClaimStats        (rolling 30-day fee revenue, SOL)
 *   - getClaimablePositions     (unclaimed fees per wallet/PDA)
 *   - getTradeQuote             (SOL <-> USDC swap quote)
 *
 * The launch flow (createTokenInfo + createBagsFeeShareConfig +
 * createLaunchTransaction) is exercised by `scripts/launch-bags-token.ts`,
 * not this module, because launches happen once per environment and must
 * be driven from a server-side wallet.
 */

import { PublicKey } from '@solana/web3.js';

import { BAGS_API_BASE_URL } from './constants';

// ── Types ───────────────────────────────────────────────────────────────────

export type BagsSocialProvider = 'twitter' | 'kick' | 'github' | 'tiktok' | 'bags';

export interface BagsCreator {
  /** True for the primary creator; at most one per token. */
  isCreator: boolean;
  provider: BagsSocialProvider;
  providerUsername: string;
  username: string;
  /** Solana wallet that receives this creator's fee share. */
  wallet: string;
  pfp: string | null;
  /** Fee share allocation in basis points (10_000 = 100%). */
  royaltyBps: number;
  twitterUsername?: string;
  bagsUsername?: string;
  isAdmin?: boolean;
}

export interface BagsLifetimeFees {
  /** Token mint queried. */
  tokenMint: string;
  /** Cumulative SOL earned since token launch, in lamports. */
  lifetimeLamports: bigint;
  /** Human-readable SOL value. */
  lifetimeSol: number;
}

export interface BagsClaimStats {
  tokenMint: string;
  /** Rolling 30-day SOL fee revenue, lamports. */
  trailing30dLamports: bigint;
  /** Rolling 7-day SOL fee revenue, lamports. */
  trailing7dLamports: bigint;
  /** Number of distinct holders that have received dividends. */
  uniqueDividendRecipients: number;
}

export interface BagsClaimablePosition {
  /** The fee-claimer wallet (may be a PDA). */
  wallet: string;
  tokenMint: string;
  /** Unclaimed fees from virtual pool v1, lamports. */
  virtualPoolClaimableLamports: bigint;
  /** Unclaimed fees from DAMM v2 pool, lamports. */
  dammPoolClaimableLamports: bigint;
  /** Sum of both, lamports. */
  totalClaimableLamports: bigint;
}

export interface BagsTradeQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  /** Best-case output amount in atomic units. */
  outputAmount: bigint;
  /** Output amount adjusted for slippage tolerance. */
  minOutputAmount: bigint;
  /** Price impact in basis points (0-10000). */
  priceImpactBps: number;
  /** Platform fee in basis points charged on input. */
  platformFeeBps: number;
  /** Quote provider chain (Jupiter, Meteora, etc.). */
  route: string;
}

// ── Auth + transport ────────────────────────────────────────────────────────

/**
 * The Bags API key. Read at function-call time so server vs. client and
 * test vs. prod environments can override it via env without restart.
 */
function getApiKey(): string | undefined {
  // Server-side first (Node scripts, keeper, route handlers).
  if (typeof process !== 'undefined' && process.env?.BAGS_API_KEY) {
    return process.env.BAGS_API_KEY;
  }
  // Public mirror so client-side reads can light up demo widgets.
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BAGS_API_KEY) {
    return process.env.NEXT_PUBLIC_BAGS_API_KEY;
  }
  return undefined;
}

export function bagsApiConfigured(): boolean {
  return Boolean(getApiKey());
}

interface BagsFetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string>;
}

async function bagsFetch<T>(path: string, opts: BagsFetchOptions = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new BagsApiUnconfiguredError(`Bags API key not set; cannot call ${path}`);
  }

  const url = new URL(path, BAGS_API_BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? 'GET',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bags API ${res.status} on ${path}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export class BagsApiUnconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BagsApiUnconfiguredError';
  }
}

// ── Mock fixtures ───────────────────────────────────────────────────────────
// Used when no API key is set so the UI can render real-looking values
// during scaffold work. Deterministic per tokenMint so screenshots and
// demos are reproducible.

function deterministicSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockCreators(tokenMint: string): BagsCreator[] {
  const seed = deterministicSeed(tokenMint);
  return [
    {
      isCreator: true,
      provider: 'twitter',
      providerUsername: `creator_${seed % 1000}`,
      username: `creator_${seed % 1000}`,
      wallet: tokenMint, // not a real wallet — just a stable mock value
      pfp: null,
      royaltyBps: 8_000,
      twitterUsername: `creator_${seed % 1000}`,
    },
    {
      isCreator: false,
      provider: 'bags',
      providerUsername: 'prism-protocol',
      username: 'prism-protocol',
      wallet: tokenMint,
      pfp: null,
      royaltyBps: 2_000,
    },
  ];
}

function mockLifetimeFees(tokenMint: string): BagsLifetimeFees {
  const seed = deterministicSeed(tokenMint);
  const lamports = BigInt(1_000_000_000) * BigInt((seed % 500) + 50); // 50–550 SOL
  return {
    tokenMint,
    lifetimeLamports: lamports,
    lifetimeSol: Number(lamports) / 1e9,
  };
}

function mockClaimStats(tokenMint: string): BagsClaimStats {
  const seed = deterministicSeed(tokenMint);
  const t30 = BigInt(1_000_000_000) * BigInt((seed % 80) + 5); // 5–85 SOL/30d
  const t7 = t30 / 4n;
  return {
    tokenMint,
    trailing30dLamports: t30,
    trailing7dLamports: t7,
    uniqueDividendRecipients: (seed % 90) + 10,
  };
}

function mockClaimable(wallet: string, tokenMint: string): BagsClaimablePosition {
  const seed = deterministicSeed(wallet + tokenMint);
  const v = BigInt(1_000_000) * BigInt((seed % 8000) + 100); // 0.0001–0.008 SOL virtual
  const d = BigInt(1_000_000_000) * BigInt(((seed >> 3) % 5) + 0); // 0–5 SOL damm
  return {
    wallet,
    tokenMint,
    virtualPoolClaimableLamports: v,
    dammPoolClaimableLamports: d,
    totalClaimableLamports: v + d,
  };
}

function mockTradeQuote(
  inputMint: string,
  outputMint: string,
  inputAmount: bigint,
): BagsTradeQuote {
  const priceImpactBps = 12;
  const platformFeeBps = 25;
  // 1 SOL ≈ 160 USDC at our scaffold's reference rate, applied symmetrically.
  // Real quotes route through Bags' segmenter; this is only a placeholder.
  const SOL_PER_USDC_BPS = 160n;
  const out =
    outputMint === inputMint
      ? inputAmount
      : (inputAmount * SOL_PER_USDC_BPS) / 1_000_000n; // crude lamport→usdc
  return {
    inputMint,
    outputMint,
    inputAmount,
    outputAmount: out,
    minOutputAmount: (out * 9970n) / 10000n,
    priceImpactBps,
    platformFeeBps,
    route: 'mock',
  };
}

// ── Public reads ────────────────────────────────────────────────────────────

/** GET /token-launch/creator/v3 */
export async function getTokenCreators(tokenMint: PublicKey | string): Promise<BagsCreator[]> {
  const mint = typeof tokenMint === 'string' ? tokenMint : tokenMint.toBase58();
  if (!bagsApiConfigured()) return mockCreators(mint);
  return bagsFetch<BagsCreator[]>(`/token-launch/creator/v3`, {
    query: { tokenMint: mint },
  });
}

/** GET /token-launch/lifetime-fees */
export async function getTokenLifetimeFees(
  tokenMint: PublicKey | string,
): Promise<BagsLifetimeFees> {
  const mint = typeof tokenMint === 'string' ? tokenMint : tokenMint.toBase58();
  if (!bagsApiConfigured()) return mockLifetimeFees(mint);
  const raw = await bagsFetch<{ lifetimeLamports: string; lifetimeSol: number }>(
    `/token-launch/lifetime-fees`,
    { query: { tokenMint: mint } },
  );
  return {
    tokenMint: mint,
    lifetimeLamports: BigInt(raw.lifetimeLamports),
    lifetimeSol: raw.lifetimeSol,
  };
}

/** GET /token-launch/claim-stats */
export async function getTokenClaimStats(
  tokenMint: PublicKey | string,
): Promise<BagsClaimStats> {
  const mint = typeof tokenMint === 'string' ? tokenMint : tokenMint.toBase58();
  if (!bagsApiConfigured()) return mockClaimStats(mint);
  const raw = await bagsFetch<{
    trailing30dLamports: string;
    trailing7dLamports: string;
    uniqueDividendRecipients: number;
  }>(`/token-launch/claim-stats`, { query: { tokenMint: mint } });
  return {
    tokenMint: mint,
    trailing30dLamports: BigInt(raw.trailing30dLamports),
    trailing7dLamports: BigInt(raw.trailing7dLamports),
    uniqueDividendRecipients: raw.uniqueDividendRecipients,
  };
}

/** GET /fee-share/claimable */
export async function getClaimablePositions(
  wallet: PublicKey | string,
  tokenMint?: PublicKey | string,
): Promise<BagsClaimablePosition[]> {
  const walletStr = typeof wallet === 'string' ? wallet : wallet.toBase58();
  const mintStr = tokenMint
    ? typeof tokenMint === 'string'
      ? tokenMint
      : tokenMint.toBase58()
    : undefined;
  if (!bagsApiConfigured()) {
    return mintStr ? [mockClaimable(walletStr, mintStr)] : [];
  }
  const query: Record<string, string> = { wallet: walletStr };
  if (mintStr) query.tokenMint = mintStr;
  const raw = await bagsFetch<
    Array<{
      wallet: string;
      tokenMint: string;
      virtualPoolClaimableLamports: string;
      dammPoolClaimableLamports: string;
    }>
  >(`/fee-share/claimable`, { query });
  return raw.map((p) => {
    const v = BigInt(p.virtualPoolClaimableLamports);
    const d = BigInt(p.dammPoolClaimableLamports);
    return {
      wallet: p.wallet,
      tokenMint: p.tokenMint,
      virtualPoolClaimableLamports: v,
      dammPoolClaimableLamports: d,
      totalClaimableLamports: v + d,
    };
  });
}

/** POST /trade/quote */
export async function getTradeQuote(args: {
  inputMint: PublicKey | string;
  outputMint: PublicKey | string;
  amount: bigint;
  slippageBps?: number;
}): Promise<BagsTradeQuote> {
  const inputMint =
    typeof args.inputMint === 'string' ? args.inputMint : args.inputMint.toBase58();
  const outputMint =
    typeof args.outputMint === 'string' ? args.outputMint : args.outputMint.toBase58();
  if (!bagsApiConfigured()) return mockTradeQuote(inputMint, outputMint, args.amount);
  return bagsFetch<BagsTradeQuote>(`/trade/quote`, {
    method: 'POST',
    body: {
      inputMint,
      outputMint,
      amount: args.amount.toString(),
      slippageBps: args.slippageBps ?? 50,
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1e9));
}

/** Resolve the primary creator's wallet for a Bags token. Throws if none found. */
export async function getPrimaryCreatorWallet(
  tokenMint: PublicKey | string,
): Promise<PublicKey> {
  const creators = await getTokenCreators(tokenMint);
  const primary = creators.find((c) => c.isCreator);
  if (!primary) {
    throw new Error(`No primary creator found for token ${String(tokenMint)}`);
  }
  return new PublicKey(primary.wallet);
}
