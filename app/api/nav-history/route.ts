import { NextRequest, NextResponse } from 'next/server';
import { getNavHistory, insertNavPoints } from '@/lib/navHistory';

export async function GET(req: NextRequest) {
  try {
    const since = req.nextUrl.searchParams.get('since');
    const rows = await getNavHistory(since ? Number(since) : undefined);
    return NextResponse.json(
      rows.map((r) => ({
        tranche: r.tranche,
        timestamp: new Date(r.recorded_at).getTime(),
        navPerShare: r.nav_per_share,
        ammSpotPrice: r.amm_spot_price,
      })),
    );
  } catch (err) {
    console.error('[nav-history GET]', err);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body?.points) || body.points.length === 0) {
      return NextResponse.json({ ok: true });
    }
    await insertNavPoints(body.points);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[nav-history POST]', err);
    return NextResponse.json({ error: 'Failed to insert points' }, { status: 500 });
  }
}
