import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { requireAuth, AuthenticatedRequest, generateToken } from '../auth.js';
import { normalizePhoneNumber } from '../utils.js';

export const cashierRouter = Router();

// Staff authentication (no extra table needed, checks credentials & issues JWT)
const handleLoginRoute = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const trimmedUser = String(username).trim().toLowerCase();
    let role: 'ADMIN' | 'CASHIER' | null = null;
    let userId = 1;

    if (trimmedUser === 'admin' && password === 'admin123') {
      role = 'ADMIN';
      userId = 1;
    } else if (trimmedUser === 'cashier' && password === 'cashier123') {
      role = 'CASHIER';
      userId = 2;
    }

    if (!role) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = generateToken({
      id: userId,
      username: trimmedUser,
      role: role,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        username: trimmedUser,
        role: role,
      },
    });
  } catch (err: any) {
    console.error('[CashierRouter] Login error:', err);
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

cashierRouter.post('/login', handleLoginRoute);
cashierRouter.post('/auth/login', handleLoginRoute);

// Session check / verification endpoint
const handleMeRoute = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.json({ success: true, user: req.user });
};

cashierRouter.get('/me', requireAuth(['ADMIN', 'CASHIER']), handleMeRoute);
cashierRouter.get('/auth/me', requireAuth(['ADMIN', 'CASHIER']), handleMeRoute);
cashierRouter.get('/verify', requireAuth(['ADMIN', 'CASHIER']), handleMeRoute);
cashierRouter.get('/auth/verify', requireAuth(['ADMIN', 'CASHIER']), handleMeRoute);

// Search reward code or customer phone in diwali_spins
cashierRouter.get('/search', requireAuth(['ADMIN', 'CASHIER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q ? String(req.query.q).trim().toUpperCase() : '';
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please enter a reward code or WhatsApp number' });
    }

    const cleanPhone = normalizePhoneNumber(query);
    const db = await getDb();

    const sql = `
      SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
             reward_code, status, redeemed, redeemed_by, redeemed_at
      FROM diwali_spins
      WHERE UPPER(reward_code) = $1 OR whatsapp = $2
      ORDER BY spin_id DESC
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
        id: row.spin_id,
        rewardCode: row.reward_code,
        status: row.status,
        createdAt: row.date_time,
        redeemedAt: row.redeemed_at,
        redeemedBy: row.redeemed_by,
        customer: {
          id: row.spin_id,
          name: row.customer,
          whatsappNumber: row.whatsapp,
        },
        prize: {
          id: row.spin_id,
          name: row.prize_won,
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

// Redeem reward code - updates the same diwali_spins row
cashierRouter.post('/redeem', requireAuth(['ADMIN', 'CASHIER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rewardCode, spinId } = req.body;
    if (!rewardCode && !spinId) {
      return res.status(400).json({ success: false, message: 'Reward code or spin ID is required for redemption' });
    }

    const db = await getDb();
    const query = `
      SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
             reward_code, status, redeemed, redeemed_by, redeemed_at
      FROM diwali_spins
      WHERE ${spinId ? 'spin_id = $1' : 'UPPER(reward_code) = $1'};
    `;

    const param = spinId ? spinId : String(rewardCode).trim().toUpperCase();
    const result = await db.query(query, [param]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward code or spin ID not found' });
    }

    const spin: any = result.rows[0];

    // Check if already redeemed
    if (spin.status === 'REDEEMED' || spin.redeemed === true) {
      const redeemedDate = spin.redeemed_at ? new Date(spin.redeemed_at).toLocaleString() : 'previously';
      return res.status(400).json({
        success: false,
        alreadyRedeemed: true,
        message: `This reward was already redeemed on ${redeemedDate} by cashier "${spin.redeemed_by || 'Staff'}". Rewards are strictly one-time use.`,
        spin: {
          id: spin.spin_id,
          rewardCode: spin.reward_code,
          status: spin.status,
          redeemedAt: spin.redeemed_at,
          redeemedBy: spin.redeemed_by,
          customerName: spin.customer,
          prizeName: spin.prize_won,
        },
      });
    }

    // Check if Better Luck Next Time
    if (spin.status === 'NO_REWARD' || spin.prize_type === 'NO_REWARD' || spin.prize_won === 'Better Luck Next Time') {
      return res.status(400).json({
        success: false,
        message: 'This spin was "Better Luck Next Time" and has no redeemable reward.',
      });
    }

    // Atomic update on the single diwali_spins table
    const cashierUsername = req.user?.username || 'cashier';
    const updateRes = await db.query(
      `UPDATE diwali_spins
       SET status = 'REDEEMED',
           redeemed = true,
           redeemed_by = $1,
           redeemed_at = CURRENT_TIMESTAMP
       WHERE spin_id = $2 AND status = 'PENDING' AND redeemed = false
       RETURNING spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
                 reward_code, status, redeemed, redeemed_by, redeemed_at;`,
      [cashierUsername, spin.spin_id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reward could not be redeemed. It may have already been redeemed by another cashier.',
      });
    }

    const updated: any = updateRes.rows[0];

    return res.json({
      success: true,
      message: `🎉 Reward claimed! ${updated.customer} received ${updated.prize_won}`,
      spin: {
        id: updated.spin_id,
        rewardCode: updated.reward_code,
        status: updated.status,
        redeemedAt: updated.redeemed_at,
        redeemedBy: updated.redeemed_by,
        customerName: updated.customer,
        whatsappNumber: updated.whatsapp,
        prizeName: updated.prize_won,
        prizeType: updated.prize_type,
        prizeValue: Number(updated.prize_value),
      },
    });
  } catch (err: any) {
    console.error('[CashierRouter] Redeem error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process redemption' });
  }
});

// Recent redemptions from diwali_spins
cashierRouter.get('/recent', requireAuth(['ADMIN', 'CASHIER']), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query(`
      SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
             reward_code, status, redeemed, redeemed_by, redeemed_at
      FROM diwali_spins
      WHERE redeemed = true OR status = 'REDEEMED'
      ORDER BY redeemed_at DESC NULLS LAST
      LIMIT 25;
    `);

    return res.json({
      success: true,
      redemptions: result.rows.map((row: any) => ({
        id: row.spin_id,
        rewardCode: row.reward_code,
        customerName: row.customer,
        whatsappNumber: row.whatsapp,
        prizeName: row.prize_won,
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
