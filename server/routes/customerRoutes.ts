import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { normalizePhoneNumber, isValidIndianPhone } from '../utils.js';
import { storePendingCustomer, DEFAULT_PRIZES } from '../prizes.js';

export const customerRouter = Router();

// Register customer or return existing spin record from diwali_spins
customerRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, whatsappNumber } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter a valid full name' });
    }

    if (!whatsappNumber || typeof whatsappNumber !== 'string') {
      return res.status(400).json({ success: false, message: 'WhatsApp number is required' });
    }

    const cleanPhone = normalizePhoneNumber(whatsappNumber);
    if (!isValidIndianPhone(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian WhatsApp mobile number (starting with 6-9)',
      });
    }

    const db = await getDb();

    // Check if customer already has a spin recorded in diwali_spins
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

      return res.json({
        success: true,
        hasSpun: true,
        customer: {
          id: prev.spin_id,
          name: prev.customer,
          whatsappNumber: prev.whatsapp,
        },
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
        message: 'Welcome back! You have already played your Diwali spin. Only 1 spin per customer.',
      });
    }

    // Customer has not spun yet - store in pending memory cache to bridge to /spin/play
    const tempCustomerId = storePendingCustomer(name.trim(), cleanPhone);

    return res.json({
      success: true,
      hasSpun: false,
      customer: {
        id: tempCustomerId,
        name: name.trim(),
        whatsappNumber: cleanPhone,
      },
    });
  } catch (err: any) {
    console.error('[CustomerRouter] Register error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process customer registration' });
  }
});
