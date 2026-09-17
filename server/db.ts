import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

let dbInstance: PGlite | null = null;

export async function getDb(): Promise<PGlite> {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), 'data', 'pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    dbInstance = new PGlite(dataDir);
    await dbInstance.waitReady;
    console.log(`[Database] PGlite initialized successfully with storage at ${dataDir}`);
  } catch (err) {
    console.warn(`[Database] File-based PGlite init failed, falling back to memory:`, err);
    dbInstance = new PGlite();
    await dbInstance.waitReady;
  }

  await initSchemaAndSeed(dbInstance);
  return dbInstance;
}

async function initSchemaAndSeed(db: PGlite) {
  // 1. Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
      marketing_consent BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      end_date TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prizes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      value NUMERIC DEFAULT 0,
      probability NUMERIC NOT NULL,
      active BOOLEAN DEFAULT true,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spins (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      prize_id INTEGER REFERENCES prizes(id) ON DELETE CASCADE,
      reward_code VARCHAR(50) UNIQUE,
      status VARCHAR(50) DEFAULT 'PENDING',
      redeemed_at TIMESTAMP WITH TIME ZONE,
      redeemed_by VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_customer_campaign UNIQUE(customer_id, campaign_id)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL
    );
  `);

  // 2. Seed campaign if none exists
  const campaignRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM campaigns;`);
  const campaignCount = parseInt(campaignRes.rows[0]?.count || '0', 10);
  if (campaignCount === 0) {
    await db.query(`
      INSERT INTO campaigns (name, active)
      VALUES ('Akshay Footwear Diwali Dhamaka 2026', true);
    `);
    console.log('[Database] Seeded Diwali campaign');
  }

  // 3. Seed prizes if none exist
  const prizesRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM prizes;`);
  const prizeCount = parseInt(prizesRes.rows[0]?.count || '0', 10);
  if (prizeCount === 0) {
    // 5 prizes as requested:
    // Slot 0: Free Socks (35%, PRODUCT)
    // Slot 1: 10% OFF (35%, PERCENTAGE_DISCOUNT)
    // Slot 2: Free Belt (10%, PRODUCT)
    // Slot 3: 15% OFF (10%, PERCENTAGE_DISCOUNT)
    // Slot 4: Better Luck Next Time (10%, NO_REWARD)
    const initialPrizes = [
      { name: 'Free Socks', type: 'PRODUCT', value: 150, probability: 35, display_order: 0 },
      { name: '10% OFF', type: 'PERCENTAGE_DISCOUNT', value: 10, probability: 35, display_order: 1 },
      { name: 'Free Belt', type: 'PRODUCT', value: 400, probability: 10, display_order: 2 },
      { name: '15% OFF', type: 'PERCENTAGE_DISCOUNT', value: 15, probability: 10, display_order: 3 },
      { name: 'Better Luck Next Time', type: 'NO_REWARD', value: 0, probability: 10, display_order: 4 },
    ];

    for (const p of initialPrizes) {
      await db.query(
        `INSERT INTO prizes (name, type, value, probability, active, display_order)
         VALUES ($1, $2, $3, $4, true, $5);`,
        [p.name, p.type, p.value, p.probability, p.display_order]
      );
    }
    console.log('[Database] Seeded 5 official Diwali prizes');
  }

  // 4. Seed admin users if none exist
  const adminRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM admin_users;`);
  const adminCount = parseInt(adminRes.rows[0]?.count || '0', 10);
  if (adminCount === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('cashier123', 10);

    await db.query(
      `INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3);`,
      ['admin', adminHash, 'ADMIN']
    );
    await db.query(
      `INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3);`,
      ['cashier', cashierHash, 'CASHIER']
    );
    console.log('[Database] Seeded admin (admin/admin123) and cashier (cashier/cashier123) users');
  }
}
