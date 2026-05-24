import { NextResponse } from 'next/server';

const COIN_IDS = 'usd-coin,tether,solana,bitcoin,ethereum,jupiter-ag';
const COINGECKO_URL =
  `https://api.coingecko.com/api/v3/simple/price` +
  `?ids=${COIN_IDS}&vs_currencies=usd&include_24hr_change=true`;

// Cache at the CDN / Next.js data cache level for 60 s
export const revalidate = 60;

export async function GET() {
  try {
    const res = await fetch(COINGECKO_URL, {
      next: { revalidate: 60 },
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko responded ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[market-prices]', err);
    // Return an empty object so the client gracefully falls back to defaults
    return NextResponse.json({}, { status: 502 });
  }
}
