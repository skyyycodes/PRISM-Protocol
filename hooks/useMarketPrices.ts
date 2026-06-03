'use client';

import { useQuery } from '@tanstack/react-query';

// CoinGecko ID → display symbol
const COIN_SYMBOL: Record<string, string> = {
  'usd-coin':   'USDC',
  'tether':     'USDT',
  'solana':     'SOL',
  'bitcoin':    'BTC',
  'ethereum':   'ETH',
  'jupiter-ag': 'JUP',
};

export interface TokenPrice {
  price: number;
  change24h: number;
}

async function fetchPrices(): Promise<Record<string, TokenPrice>> {
  const res = await fetch('/api/market-prices');
  // On non-200 or network failure just return empty — UI falls back to defaults
  if (!res.ok) return {};
  const raw = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;

  const out: Record<string, TokenPrice> = {};
  for (const [id, symbol] of Object.entries(COIN_SYMBOL)) {
    const entry = raw[id];
    if (entry?.usd !== undefined) {
      out[symbol] = {
        price:    entry.usd,
        change24h: entry.usd_24h_change ?? 0,
      };
    }
  }
  return out;
}

export function useMarketPrices() {
  return useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchPrices,
    refetchInterval: 60_000,
    staleTime: 30_000,
    // Never throw — the component handles empty gracefully
    throwOnError: false,
  });
}
