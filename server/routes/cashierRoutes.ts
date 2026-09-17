import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../auth.js';
import { normalizePhoneNumber } from '../utils.js';

export const cashierRouter = Router();

// Login endpoint for Cashier and Admin
const handleLoginRoute = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const db = await getDb();
    const result = await db.query<{
      id: number;
      username: string;
      password_hash: string;
      role: 'ADMIN' | 'CASHIER';
    }>(`SELECT id, username, password_hash, role FROM admin_users WHERE username = $1;`, [username.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = result.rows[0];
    let isMatch = await bcrypt.compare(password, user.password_hash);
    // Allow plaintext fallback if seeded directly
    if (!isMatch && password === user.password_hash) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('[CashierRouter] Login error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

cashierRouter.post('/login', handleLoginRoute);
cashierRouter.post('/auth/login', handleLoginRoute);

// Search reward code or customer phone
cashierRouter.get('/search', requireAuth(['ADMIN', 'CASHIER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q ? String(req.query.q).trim().toUpperCase() : '';
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please enter a reward code or phone number' });
    }

    const cleanPhone = normalizePhoneNumber(query);
    const db = await getDb();

    const sql = `
      SELECT s.id, s.reward_code, s.status, s.created_at, s.redeemed_at, s.redeemed_by,
             c.id as customer_id, c.name as customer_name, c.whatsapp_number,
             p.id as prize_id, p.name as prize_name, p.type as prize_type, p.value as prize_value
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      WHERE UPPER(s.reward_code) = $1 OR c.whatsapp_number = $2
      ORDER BY s.id DESC
      LIMIT 10;
    `;

    const result = await db.query(sql, [query, cleanPhone]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No spin or reward record found matching that code or WhatsApp number',
      });
    }

    return res.json({
      success: true,
      records: result.rows.map((row: any) => ({
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
    console.error('[CashierRouter] Search error:', err);
    return res.status(500).json({ success: false, message: 'Search lookup failed' });
  }
});

// Redeem reward code
cashierRouter.post('/redeem', requireAuth(['ADMIN', 'CASHIER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rewardCode, spinId } = req.body;
    if (!rewardCode && !spinId) {
      return res.status(400).json({ success: false, message: 'Reward code or spin ID is required for redemption' });
    }

    const db = await getDb();
    let query = `
      SELECT s.id, s.reward_code, s.status, s.created_at, s.redeemed_at, s.redeemed_by,
             c.name as customer_name, c.whatsapp_number,
             p.name as prize_name, p.type as prize_type, p.value as prize_value
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      WHERE ${spinId ? 's.id = $1' : 'UPPER(s.reward_code) = $1'};
    `;

    const param = spinId ? spinId : String(rewardCode).trim().toUpperCase();
    const result = await db.query(query, [param]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward code not found' });
    }

    const spin: any = result.rows[0];

    if (spin.status === 'REDEEMED') {
      const redeemedDate = spin.redeemed_at ? new Date(spin.redeemed_at).toLocaleString() : 'previously';
      return res.status(400).json({
        success: false,
        alreadyRedeemed: true,
        message: `This reward was already redeemed on ${redeemedDate} by cashier "${spin.redeemed_by || 'Staff'}". Rewards are strictly one-time use.`,
        spin: {
          id: spin.id,
          rewardCode: spin.reward_code,
          status: spin.status,
          redeemedAt: spin.redeemed_at,
          redeemedBy: spin.redeemed_by,
          customerName: spin.customer_name,
          prizeName: spin.prize_name,
        },
      });
    }

    if (spin.status === 'NO_REWARD' || spin.prize_type === 'NO_REWARD') {
      return res.status(400).json({
        success: false,
        message: 'This spin was "Better Luck Next Time" and has no redeemable reward.',
      });
    }

    // Execute atomic redemption
    const cashierUsername = req.user?.username || 'cashier';
    const updateRes = await db.query(
      `UPDATE spins
       SET status = 'REDEEMED', redeemed_at = CURRENT_TIMESTAMP, redeemed_by = $1
       WHERE id = $2
       RETURNING id, status, redeemed_at, redeemed_by;`,
      [cashierUsername, spin.id]
    );

    const updated: any = updateRes.rows[0];

    return res.json({
      success: true,
      message: `🎉 Reward claimed! ${spin.customer_name} received ${spin.prize_name}`,
      spin: {
        id: spin.id,
        rewardCode: spin.reward_code,
        status: updated.status,
        redeemedAt: updated.redeemed_at,
        redeemedBy: updated.redeemed_by,
        customerName: spin.customer_name,
        whatsappNumber: spin.whatsapp_number,
        prizeName: spin.prize_name,
        prizeType: spin.prize_type,
        prizeValue: Number(spin.prize_value),
      },
    });
  } catch (err: any) {
    console.error('[CashierRouter] Redeem error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process redemption' });
  }
});

// Recent redemptions for cashier log
cashierRouter.get('/recent', requireAuth(['ADMIN', 'CASHIER']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT s.id, s.reward_code, s.status, s.redeemed_at, s.redeemed_by, s.created_at,
             c.name as customer_name, c.whatsapp_number,
             p.name as prize_name, p.type as prize_type, p.value as prize_value
      FROM spins s
      JOIN customers c ON s.customer_id = c.id
      JOIN prizes p ON s.prize_id = p.id
      WHERE s.status = 'REDEEMED'
      ORDER BY s.redeemed_at DESC
      LIMIT 25;
    `);

    return res.json({
      success: true,
      redemptions: result.rows.map((row: any) => ({
        id: row.id,
        rewardCode: row.reward_code,
        customerName: row.customer_name,
        whatsappNumber: row.whatsapp_number,
        prizeName: row.prize_name,
        prizeType: row.prize_type,
        prizeValue: Number(row.prize_value),
        redeemedAt: row.redeemed_at,
        redeemedBy: row.redeemed_by,
      })),
    });
  } catch (err: any) {
    console.error('[CashierRouter] Recent redemptions error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch recent redemptions' });
  }
});
