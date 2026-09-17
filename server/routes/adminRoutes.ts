import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { maskPhone } from '../utils.js';
import { getActivePrizes, updatePrizeProbabilities } from '../prizes.js';

export const adminRouter = Router();

// GET /api/admin/stats - Live metrics calculated directly from Neon diwali_spins
adminRouter.get('/stats', requireAuth(['ADMIN']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    // 1. Total spins
    const totalSpinsRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM diwali_spins;`);
    const totalSpins = parseInt(totalSpinsRes.rows[0]?.count || '0', 10);

    // 2. Total unique customers by WhatsApp
    const totalCustomersRes = await db.query<{ count: string }>(
      `SELECT COUNT(DISTINCT whatsapp) as count FROM diwali_spins;`
    );
    const totalCustomers = parseInt(totalCustomersRes.rows[0]?.count || '0', 10);

    // 3. Redeemed rewards
    const redeemedSpinsRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM diwali_spins WHERE redeemed = true OR status = 'REDEEMED';`
    );
    const redeemedSpins = parseInt(redeemedSpinsRes.rows[0]?.count || '0', 10);

    // 4. Pending rewards
    const pendingSpinsRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM diwali_spins WHERE status = 'PENDING';`
    );
    const pendingSpins = parseInt(pendingSpinsRes.rows[0]?.count || '0', 10);

    // 5. Prize counts breakdown from diwali_spins
    const breakdownRes = await db.query<{ prize_won: string; status: string; count: string }>(`
      SELECT prize_won, status, COUNT(*) as count
      FROM diwali_spins
      GROUP BY prize_won, status;
    `);

    const prizeStatsMap: Record<string, { won: number; redeemed: number }> = {
      'free socks': { won: 0, redeemed: 0 },
      '10% off': { won: 0, redeemed: 0 },
      'free belt': { won: 0, redeemed: 0 },
      '15% off': { won: 0, redeemed: 0 },
      'better luck next time': { won: 0, redeemed: 0 },
    };

    for (const row of breakdownRes.rows) {
      const key = (row.prize_won || '').trim().toLowerCase();
      const count = parseInt(row.count, 10);
      if (!prizeStatsMap[key]) {
        prizeStatsMap[key] = { won: 0, redeemed: 0 };
      }
      prizeStatsMap[key].won += count;
      if (row.status === 'REDEEMED') {
        prizeStatsMap[key].redeemed += count;
      }
    }

    const currentPrizes = getActivePrizes();
    const prizeBreakdown = currentPrizes.map((p) => {
      const key = p.name.trim().toLowerCase();
      const stats = prizeStatsMap[key] || { won: 0, redeemed: 0 };
      const actualPercentage = totalSpins > 0 ? (stats.won / totalSpins) * 100 : 0;
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        value: p.value,
        probability: p.probability,
        active: p.active,
        displayOrder: p.displayOrder,
        wonCount: stats.won,
        redeemedCount: stats.redeemed,
        actualPercentage: Number(actualPercentage.toFixed(1)),
      };
    });

    const nonWinningCount = prizeStatsMap['better luck next time']?.won || 0;
    const winningSpins = totalSpins - nonWinningCount;
    const redemptionRate = winningSpins > 0 ? Number(((redeemedSpins / winningSpins) * 100).toFixed(1)) : 0;

    return res.json({
      success: true,
      stats: {
        totalSpins,
        totalCustomers,
        redeemedSpins,
        pendingSpins,
        redemptionRate: Math.min(redemptionRate, 100),
        prizeCounts: {
          freeSocks: prizeStatsMap['free socks']?.won || 0,
          tenPercentOff: prizeStatsMap['10% off']?.won || 0,
          freeBelt: prizeStatsMap['free belt']?.won || 0,
          fifteenPercentOff: prizeStatsMap['15% off']?.won || 0,
          betterLuckNextTime: prizeStatsMap['better luck next time']?.won || 0,
        },
        campaign: {
          id: 1,
          name: 'Akshay Footwear Diwali Dhamaka 2026',
          active: true,
        },
        prizeBreakdown,
      },
    });
  } catch (err: any) {
    console.error('[AdminRouter] Stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch admin stats from database' });
  }
});

// GET /api/admin/spins - Query records from diwali_spins with filters & pagination
adminRouter.get('/spins', requireAuth(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : 'ALL';
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10), 500);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10), 0);

    const db = await getDb();

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(
        `(customer ILIKE $${paramIndex} OR whatsapp LIKE $${paramIndex} OR reward_code ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status !== 'ALL') {
      whereClauses.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total matching count
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM diwali_spins ${whereSQL};`,
      params
    );
    const totalMatching = parseInt(countRes.rows[0]?.count || '0', 10);

    // Query records
    const recordsRes = await db.query(
      `SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
              reward_code, status, redeemed, redeemed_by, redeemed_at
       FROM diwali_spins
       ${whereSQL}
       ORDER BY spin_id DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1};`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      total: totalMatching,
      limit,
      offset,
      spins: recordsRes.rows.map((row: any) => ({
        id: row.spin_id,
        rewardCode: row.reward_code,
        status: row.status,
        redeemed: row.redeemed,
        createdAt: row.date_time,
        redeemedAt: row.redeemed_at,
        redeemedBy: row.redeemed_by,
        customerName: row.customer,
        whatsappNumber: row.whatsapp,
        maskedPhone: maskPhone(row.whatsapp),
        prizeName: row.prize_won,
        prizeType: row.prize_type,
        prizeValue: Number(row.prize_value),
        customer: {
          name: row.customer,
          whatsappNumber: row.whatsapp,
        },
        prize: {
          name: row.prize_won,
          type: row.prize_type,
          value: Number(row.prize_value),
        },
      })),
    });
  } catch (err: any) {
    console.error('[AdminRouter] Get spins error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch spin records' });
  }
});

// PUT /api/admin/prizes/probabilities - Update prize probabilities
adminRouter.put('/prizes/probabilities', requireAuth(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { probabilities } = req.body;
    if (!Array.isArray(probabilities) || probabilities.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of probabilities is required' });
    }

    const result = updatePrizeProbabilities(probabilities);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({ success: true, message: 'Prize probabilities updated successfully' });
  } catch (err: any) {
    console.error('[AdminRouter] Update probabilities error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update prize probabilities' });
  }
});

// GET /api/admin/export-csv - Export exact Excel format specified by user
adminRouter.get('/export-csv', requireAuth(['ADMIN']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
             reward_code, status, redeemed, redeemed_by, redeemed_at
      FROM diwali_spins
      ORDER BY spin_id DESC;
    `);

    // EXACT columns in the EXACT order requested:
    // Spin ID, Date & Time, Customer, WhatsApp, Prize Won, Prize Type, Prize Value, Reward Code, Status, Redeemed, Redeemed By
    const headers = [
      'Spin ID',
      'Date & Time',
      'Customer',
      'WhatsApp',
      'Prize Won',
      'Prize Type',
      'Prize Value',
      'Reward Code',
      'Status',
      'Redeemed',
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
          row.spin_id,
          escapeCsv(new Date(row.date_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
          escapeCsv(row.customer),
          escapeCsv(row.whatsapp),
          escapeCsv(row.prize_won),
          escapeCsv(row.prize_type),
          row.prize_value,
          escapeCsv(row.reward_code || ''),
          escapeCsv(row.status),
          escapeCsv(row.redeemed ? 'TRUE' : 'FALSE'),
          escapeCsv(row.redeemed_by || ''),
        ].join(',')
      );
    }

    const csvContent = csvRows.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="akshay_footwear_diwali_spins.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    console.error('[AdminRouter] Export CSV error:', err);
    return res.status(500).json({ success: false, message: 'Failed to export CSV' });
  }
});
