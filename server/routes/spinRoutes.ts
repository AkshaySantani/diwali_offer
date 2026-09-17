import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { generateRewardCode, normalizePhoneNumber, isValidIndianPhone } from '../utils.js';
import { getActivePrizes, selectRandomPrize, getPendingCustomer, DEFAULT_PRIZES } from '../prizes.js';

export const spinRouter = Router();

// GET /api/spin/prizes - Public prize list for wheel slices
spinRouter.get('/prizes', async (_req: Request, res: Response) => {
  try {
    const prizes = getActivePrizes();
    return res.json({
      success: true,
      prizes: prizes.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        value: p.value,
        probability: p.probability,
        displayOrder: p.displayOrder,
        active: p.active,
      })),
    });
  } catch (err: any) {
    console.error('[SpinRouter] Get prizes error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch prizes' });
  }
});

// POST /api/spin/play - Play spin and save record to Neon diwali_spins table
spinRouter.post('/play', async (req: Request, res: Response) => {
  try {
    const { customerId, name: bodyName, whatsappNumber: bodyPhone } = req.body;

    let customerName = '';
    let rawPhone = '';

    // Check pending registration cache first if customerId provided
    if (customerId) {
      const pending = getPendingCustomer(Number(customerId));
      if (pending) {
        customerName = pending.name;
        rawPhone = pending.whatsappNumber;
      }
    }

    // Fallback to body parameters
    if (bodyName && typeof bodyName === 'string') {
      customerName = bodyName.trim();
    }
    if (bodyPhone && typeof bodyPhone === 'string') {
      rawPhone = bodyPhone.trim();
    }

    if (!customerName) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone);
    if (!isValidIndianPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Valid 10-digit Indian WhatsApp number is required to play the spin',
      });
    }

    const db = await getDb();

    // 1. Strict One-Spin Protection: Check if customer already spun in diwali_spins
    const existingSpinRes = await db.query<{
      spin_id: number;
      date_time: string;
      customer: string;
      whatsapp: string;
      prize_won: string;
      prize_type: string;
      prize_value: number;
      reward_code: string | null;
      status: string;
      redeemed: boolean;
      redeemed_by: string | null;
      redeemed_at: string | null;
    }>(
      `SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value,
              reward_code, status, redeemed, redeemed_by, redeemed_at
       FROM diwali_spins
       WHERE whatsapp = $1
       LIMIT 1;`,
      [cleanPhone]
    );

    if (existingSpinRes.rows.length > 0) {
      const prev = existingSpinRes.rows[0];
      const matchedPrize = DEFAULT_PRIZES.find((p) => p.name.toLowerCase() === prev.prize_won.toLowerCase());
      const sliceIndex = matchedPrize ? matchedPrize.displayOrder : 0;

      return res.status(400).json({
        success: false,
        alreadySpun: true,
        message: 'You have already played your spin for this Diwali campaign! Only 1 spin per customer.',
        previousSpin: {
          id: prev.spin_id,
          prizeName: prev.prize_won,
          prizeType: prev.prize_type,
          prizeValue: Number(prev.prize_value),
          rewardCode: prev.reward_code,
          status: prev.status,
          createdAt: prev.date_time,
          sliceIndex: sliceIndex,
        },
      });
    }

    // 2. Server authoritatively selects the prize using crypto RNG
    // Frontend never determines or passes the prize
    const { prize, sliceIndex } = selectRandomPrize();

    // 3. Configure reward code & status according to rules:
    // - Free Socks, 10% OFF, Free Belt, 15% OFF get unique reward code & status PENDING
    // - Better Luck Next Time has no reward code & status NO_REWARD
    const isNoReward = prize.type === 'NO_REWARD' || prize.name === 'Better Luck Next Time';
    let rewardCode: string | null = null;
    let status = 'PENDING';

    if (isNoReward) {
      rewardCode = null;
      status = 'NO_REWARD';
    } else {
      rewardCode = generateRewardCode();
      status = 'PENDING';
    }

    // 4. Save into Neon diwali_spins table using parameterized query
    let newSpin: any;
    try {
      const insertRes = await db.query(
        `INSERT INTO diwali_spins (
          date_time,
          customer,
          whatsapp,
          prize_won,
          prize_type,
          prize_value,
          reward_code,
          status,
          redeemed,
          redeemed_by,
          redeemed_at
        )
        VALUES (
          CURRENT_TIMESTAMP,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          false,
          NULL,
          NULL
        )
        RETURNING spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value, reward_code, status, redeemed;`,
        [customerName, cleanPhone, prize.name, prize.type, prize.value, rewardCode, status]
      );

      newSpin = insertRes.rows[0];
    } catch (insertErr: any) {
      // Catch unique index violation (concurrent race conditions or duplicate clicks)
      if (insertErr.code === '23505' || insertErr.message?.includes('idx_diwali_spins_whatsapp')) {
        const fetchExisting = await db.query(
          `SELECT spin_id, date_time, customer, whatsapp, prize_won, prize_type, prize_value, reward_code, status
           FROM diwali_spins WHERE whatsapp = $1 LIMIT 1;`,
          [cleanPhone]
        );
        if (fetchExisting.rows.length > 0) {
          const prev = fetchExisting.rows[0];
          return res.status(400).json({
            success: false,
            alreadySpun: true,
            message: 'You have already played your spin for this Diwali campaign! Only 1 spin per customer.',
            previousSpin: {
              id: prev.spin_id,
              prizeName: prev.prize_won,
              prizeType: prev.prize_type,
              prizeValue: Number(prev.prize_value),
              rewardCode: prev.reward_code,
              status: prev.status,
              createdAt: prev.date_time,
              sliceIndex: 0,
            },
          });
        }
      }
      throw insertErr;
    }

    return res.json({
      success: true,
      spin: {
        id: newSpin.spin_id,
        sliceIndex: sliceIndex, // Exact wheel slice index for the frontend animation
        prizeId: prize.id,
        prizeName: newSpin.prize_won,
        prizeType: newSpin.prize_type,
        prizeValue: Number(newSpin.prize_value),
        rewardCode: newSpin.reward_code,
        status: newSpin.status,
        createdAt: newSpin.date_time,
        customerName: newSpin.customer,
      },
    });
  } catch (err: any) {
    console.error('[SpinRouter] Play spin error:', err);
    return res.status(500).json({ success: false, message: 'Internal error while processing spin' });
  }
});
