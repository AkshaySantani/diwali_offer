import pg, { QueryResultRow } from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required to connect to Neon PostgreSQL');
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[Neon Database] Unexpected idle client error:', err);
    });
  }
  return pool;
}

export interface DbClient {
  query: <R extends QueryResultRow = any>(text: string, params?: any[]) => Promise<{ rows: R[]; rowCount: number | null }>;
}

export async function getDb(): Promise<DbClient> {
  const p = getPool();
  return {
    query: async <R extends QueryResultRow = any>(text: string, params?: any[]) => {
      const res = await p.query<R>(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    },
  };
}

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

export async function initSchemaAndSeed(): Promise<void> {
  if (schemaInitialized) return;
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      const p = getPool();
      console.log('[Neon Database] Verifying diwali_spins table on Neon PostgreSQL...');

      // Create single official diwali_spins table
      await p.query(`
        CREATE TABLE IF NOT EXISTS diwali_spins (
          spin_id SERIAL PRIMARY KEY,
          date_time TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          customer VARCHAR(255) NOT NULL,
          whatsapp VARCHAR(20) NOT NULL,
          prize_won VARCHAR(100) NOT NULL,
          prize_type VARCHAR(50) NOT NULL,
          prize_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
          reward_code VARCHAR(50),
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          redeemed BOOLEAN NOT NULL DEFAULT false,
          redeemed_by VARCHAR(100),
          redeemed_at TIMESTAMPTZ
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_diwali_spins_whatsapp ON diwali_spins (whatsapp);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_diwali_spins_reward_code ON diwali_spins (reward_code) WHERE reward_code IS NOT NULL AND reward_code <> '';
        CREATE INDEX IF NOT EXISTS idx_diwali_spins_status ON diwali_spins (status);
      `);

      schemaInitialized = true;
      console.log('[Neon Database] diwali_spins schema and indexes verified successfully.');
    })();
  }
  await schemaInitPromise;
}
