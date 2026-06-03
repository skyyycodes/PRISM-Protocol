import postgres from 'postgres';

const globalForNav = globalThis as typeof globalThis & {
  navSql?: ReturnType<typeof postgres>;
  navSchemaReady?: Promise<void>;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured.');
  if (!globalForNav.navSql) {
    globalForNav.navSql = postgres(url, { max: 3, prepare: false });
  }
  return globalForNav.navSql;
}

async function ensureTable(sql: ReturnType<typeof postgres>) {
  if (!globalForNav.navSchemaReady) {
    globalForNav.navSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS nav_history (
          id            BIGSERIAL PRIMARY KEY,
          tranche       SMALLINT NOT NULL,
          recorded_at   TIMESTAMPTZ NOT NULL,
          nav_per_share DOUBLE PRECISION NOT NULL,
          amm_spot_price DOUBLE PRECISION
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS nav_history_unique
          ON nav_history (tranche, recorded_at)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS nav_history_lookup
          ON nav_history (tranche, recorded_at DESC)
      `;
    })().catch((e) => {
      globalForNav.navSchemaReady = undefined;
      throw e;
    });
  }
  await globalForNav.navSchemaReady;
}

export interface NavRow {
  tranche: number;
  recorded_at: Date;
  nav_per_share: number;
  amm_spot_price: number | null;
}

export interface NavPoint {
  tranche: number;
  recordedAt: number; // Unix ms
  navPerShare: number;
  ammSpotPrice: number | null;
}

export async function insertNavPoints(points: NavPoint[]) {
  if (!points.length) return;
  const sql = getSql();
  await ensureTable(sql);

  const rows = points.map((p) => ({
    tranche: p.tranche,
    recorded_at: new Date(p.recordedAt),
    nav_per_share: p.navPerShare,
    amm_spot_price: p.ammSpotPrice ?? null,
  }));

  await sql`
    INSERT INTO nav_history ${sql(rows, 'tranche', 'recorded_at', 'nav_per_share', 'amm_spot_price')}
    ON CONFLICT (tranche, recorded_at) DO NOTHING
  `;
}

export async function getNavHistory(since?: number): Promise<NavRow[]> {
  const sql = getSql();
  await ensureTable(sql);
  const sinceDate = since ? new Date(since) : new Date(0);
  return sql<NavRow[]>`
    SELECT tranche, recorded_at, nav_per_share, amm_spot_price
    FROM nav_history
    WHERE recorded_at > ${sinceDate}
    ORDER BY tranche, recorded_at ASC
    LIMIT 200000
  `;
}
