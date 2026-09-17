import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { maskPhone } from '../utils.js';

export const adminRouter = Router();

// Stats summary
adminRouter.get('/stats', requireAuth(['ADMIN']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    // 1. Total counts
    const totalSpinsRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM spins;`);
    const totalSpins = parseInt(totalSpinsRes.rows[0]?.count || '0', 10);

    const totalCustomersRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM customers;`);
    const totalCustomers = parseInt(totalCustomersRes.rows[0]?.count || '0', 10);

    const redeemedSpinsRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM spins WHERE status = 'REDEEMED';`);
    const redeemedSpins = parseInt(redeemedSpinsRes.rows[0]?.count || '0', 10);

    const pendingSpinsRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM spins WHERE status = 'PENDING';`);
    const pendingSpins = parseInt(pendingSpinsRes.rows[0]?.count || '0', 10);

    // 2. Active campaign
    const campaignRes = await db.query<{ id: number; name: string; active: boolean; created_at: string }>(
      `SELECT id, name, active, created_at FROM campaigns ORDER BY id DESC LIMIT 1;`
    );
    const campaign = campaignRes.rows[0] || null;

    // 3. Breakdown by prize
    const prizesRes = await db.query<{
      id: number;
      name: string;
      type: string;
      value: number;
      probability: number;
      active: boolean;
      display_order: number;
    }>(`SELECT id, name, type, value, probability, active, display_order FROM prizes ORDER BY display_order ASC;`);

    const prizeStatsMap: Record<number, { won: number; redeemed: number }> = {};
    for (const p of prizesRes.rows) {
      prizeStatsMap[p.id] = { won: 0, redeemed: 0 };
    }

    const spinsBreakdown = await db.query<{ prize_id: number; status: string; count: string }>(`
      SELECT prize_id, status, COUNT(*) as count
      FROM spins
      GROUP BY prize_id, status;
    `);

    for (const row of spinsBreakdown.rows) {
      const pid = row.prize_id;
      const count = parseInt(row.count, 10);
      if (prizeStatsMap[pid]) {
        prizeStatsMap[pid].won += count;
        if (row.status === 'REDEEMED') {
          prizeStatsMap[pid].redeemed += count;
        }
      }
    }

    const prizeBreakdown = prizesRes.rows.map((p) => {
      const stats = prizeStatsMap[p.id] || { won: 0, redeemed: 0 };
      const actualPercentage = totalSpins > 0 ? (stats.won / totalSpins) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        value: Number(p.value),
        probability: Number(p.probability),
        active: p.active,
        displayOrder: p.display_order,
        wonCount: stats.won,
        redeemedCount: stats.redeemed,
        actualPercentage: Number(actualPercentage.toFixed(1)),
      };
    });

    const redemptionRate = totalSpins > 0 ? Number(((redeemedSpins / (totalSpins - (prizeStatsMap[5]?.won || 0) || 1)) * 100).toFixed(1)) : 0;

    return res.json({
      success: true,
      stats: {
        totalSpins,
        totalCustomers,
        redeemedSpins,
        pendingSpins,
        redemptionRate: Math.min(redemptionRate, 100),
        campaign,
        prizeBreakdown,
      },
    });
  } catch (err: any) {
    console.error('[AdminRouter] Stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
});

// All spins table with search & filter
adminRouter.get('/spins', requireAuth(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : 'ALL';
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10), 0);

    const db = await getDb();

    let whereClauses: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(c.name ILIKE $${paramIndex} OR c.whatsapp_number LIKE $${paramIndex} OR s.reward_code ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'ALL') {
      whereClauses.push(`s.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as total
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      ${whereSql};
    `;

    const countRes = await db.query<{ total: string }>(countSql, params);
    const totalRecords = parseInt(countRes.rows[0]?.total || '0', 10);

    const dataSql = `
      SELECT s.id, s.reward_code, s.status, s.created_at, s.redeemed_at, s.redeemed_by,
             c.id as customer_id, c.name as customer_name, c.whatsapp_number,
             p.id as prize_id, p.name as prize_name, p.type as prize_type, p.value as prize_value
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      ${whereSql}
      ORDER BY s.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    params.push(limit, offset);
    const dataRes = await db.query(dataSql, params);

    return res.json({
      success: true,
      total: totalRecords,
      spins: dataRes.rows.map((row: any) => ({
        id: row.id,
        rewardCode: row.reward_code,
        status: row.status,
        createdAt: row.created_at,
        redeemedAt: row.redeemed_at,
        redeemedBy: row.redeemed_by,
        customer: {
          id: row.customer_id,
          name: row.customer_name,
          whatsappNumber: row.whatsapp_number,
          maskedPhone: maskPhone(row.whatsapp_number),
        },
        prize: {
          id: row.prize_id,
          name: row.prize_name,
          type: row.prize_type,
          value: Number(row.prize_value),
        },
      })),
    });
  } catch (err: any) {
    console.error('[AdminRouter] Spins error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch spins data' });
  }
});

// Update prize probabilities (Strict validation: must sum to 100%)
const handleUpdatePrizes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prizes } = req.body;
    if (!Array.isArray(prizes) || prizes.length === 0) {
      return res.status(400).json({ success: false, message: 'Prizes list is required' });
    }

    // Check sum of active probabilities
    let activeSum = 0;
    for (const p of prizes) {
      const prob = Number(p.probability);
      if (isNaN(prob) || prob < 0) {
        return res.status(400).json({ success: false, message: `Invalid probability for prize "${p.name || p.id}"` });
      }
      if (p.active !== false) {
        activeSum += prob;
      }
    }

    if (Math.round(activeSum * 100) / 100 !== 100) {
      return res.status(400).json({
        success: false,
        message: `Total active probabilities must sum to exactly 100%. Current sum is ${activeSum}%.`,
      });
    }

    const db = await getDb();

    // Update in database
    for (const p of prizes) {
      await db.query(
        `UPDATE prizes
         SET probability = $1,
             active = $2
         WHERE id = $3;`,
        [Number(p.probability), p.active !== false, p.id]
      );
    }

    return res.json({ success: true, message: 'Prize configuration updated successfully!' });
  } catch (err: any) {
    console.error('[AdminRouter] Update prizes error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update prizes' });
  }
};

adminRouter.put('/prizes', requireAuth(['ADMIN']), handleUpdatePrizes);
adminRouter.post('/prizes', requireAuth(['ADMIN']), handleUpdatePrizes);

// Toggle campaign status
adminRouter.put('/campaign', requireAuth(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { active, name } = req.body;
    const db = await getDb();

    if (typeof active === 'boolean') {
      await db.query(`UPDATE campaigns SET active = $1;`, [active]);
    }
    if (name && typeof name === 'string') {
      await db.query(`UPDATE campaigns SET name = $1;`, [name.trim()]);
    }

    return res.json({ success: true, message: 'Campaign settings updated successfully!' });
  } catch (err: any) {
    console.error('[AdminRouter] Campaign toggle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update campaign settings' });
  }
});

// Export CSV of all spins
adminRouter.get('/export-csv', requireAuth(['ADMIN']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT s.id, s.reward_code, s.status, s.created_at, s.redeemed_at, s.redeemed_by,
             c.name as customer_name, c.whatsapp_number,
             p.name as prize_name, p.type as prize_type, p.value as prize_value
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      ORDER BY s.id DESC;
    `);

    const headers = [
      'Spin ID',
      'Date & Time',
      'Customer Name',
      'WhatsApp Number',
      'Prize Won',
      'Prize Type',
      'Prize Value',
      'Reward Code',
      'Status',
      'Redeemed At',
      'Redeemed By',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];

    for (const row of result.rows as any[]) {
      csvRows.push(
        [
          row.id,
          new Date(row.created_at).toISOString(),
          escapeCsv(row.customer_name),
          escapeCsv(row.whatsapp_number),
          escapeCsv(row.prize_name),
          escapeCsv(row.prize_type),
          row.prize_value,
          escapeCsv(row.reward_code || 'N/A'),
          escapeCsv(row.status),
          row.redeemed_at ? new Date(row.redeemed_at).toISOString() : 'N/A',
          escapeCsv(row.redeemed_by || 'N/A'),
        ].join(',')
      );
    }

    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="akshay_footwear_diwali_spins.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    console.error('[AdminRouter] Export CSV error:', err);
    return res.status(500).json({ success: false, message: 'Failed to export CSV' });
  }
});
