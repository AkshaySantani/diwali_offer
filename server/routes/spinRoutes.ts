import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { generateRewardCode } from '../utils.js';

export const spinRouter = Router();

// Get active prizes for the wheel display
spinRouter.get('/prizes', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const result = await db.query<{
      id: number;
      name: string;
      type: string;
      value: number;
      probability: number;
      active: boolean;
      display_order: number;
    }>(
      `SELECT id, name, type, value, probability, active, display_order
       FROM prizes
       WHERE active = true
       ORDER BY display_order ASC;`
    );

    return res.json({
      success: true,
      prizes: result.rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        value: Number(p.value),
        probability: Number(p.probability),
        displayOrder: p.display_order,
      })),
    });
  } catch (err: any) {
    console.error('[SpinRouter] Get prizes error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch prizes' });
  }
});

// Play spin: server-authoritative weighted selection
spinRouter.post('/play', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }

    const db = await getDb();

    // 1. Check active campaign
    const campaignRes = await db.query<{ id: number; name: string; active: boolean }>(
      `SELECT id, name, active FROM campaigns WHERE active = true ORDER BY id DESC LIMIT 1;`
    );

    if (campaignRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Diwali promotional campaign is not currently active' });
    }

    const campaign = campaignRes.rows[0];

    // 2. Verify customer exists
    const customerRes = await db.query<{ id: number; name: string; whatsapp_number: string }>(
      `SELECT id, name, whatsapp_number FROM customers WHERE id = $1;`,
      [customerId]
    );

    if (customerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer record not found. Please register first.' });
    }

    const customer = customerRes.rows[0];

    // 3. Strict check: Has customer already spun in this campaign?
    const existingSpin = await db.query<{
      id: number;
      prize_id: number;
      reward_code: string | null;
      status: string;
      created_at: string;
      prize_name: string;
      prize_type: string;
      prize_value: number;
      display_order: number;
    }>(
      `SELECT s.id, s.prize_id, s.reward_code, s.status, s.created_at,
              p.name as prize_name, p.type as prize_type, p.value as prize_value, p.display_order
       FROM spins s
       JOIN prizes p ON s.prize_id = p.id
       WHERE s.customer_id = $1 AND s.campaign_id = $2;`,
      [customerId, campaign.id]
    );

    if (existingSpin.rows.length > 0) {
      const prev = existingSpin.rows[0];
      return res.status(400).json({
        success: false,
        alreadySpun: true,
        message: 'You have already played your spin for this Diwali campaign! Only 1 spin per customer.',
        previousSpin: {
          id: prev.id,
          prizeName: prev.prize_name,
          prizeType: prev.prize_type,
          prizeValue: Number(prev.prize_value),
          rewardCode: prev.reward_code,
          status: prev.status,
          createdAt: prev.created_at,
          sliceIndex: prev.display_order,
        },
      });
    }

    // 4. Fetch all active prizes ordered by display_order
    const prizesRes = await db.query<{
      id: number;
      name: string;
      type: string;
      value: number;
      probability: number;
      display_order: number;
    }>(
      `SELECT id, name, type, value, probability, display_order
       FROM prizes
       WHERE active = true
       ORDER BY display_order ASC;`
    );

    const prizes = prizesRes.rows;
    if (prizes.length === 0) {
      return res.status(500).json({ success: false, message: 'No active prizes configured in campaign' });
    }

    // 5. Crypto-secure weighted random selection
    const totalWeight = prizes.reduce((acc, p) => acc + Number(p.probability), 0);
    if (totalWeight <= 0) {
      return res.status(500).json({ success: false, message: 'Prize probabilities configuration invalid' });
    }

    // Generate random float in [0, totalWeight)
    const randomBuffer = crypto.randomBytes(4);
    const randomUint32 = randomBuffer.readUInt32BE(0);
    const randomFloat = (randomUint32 / 0xffffffff) * totalWeight;

    let cumulative = 0;
    let selectedPrize = prizes[prizes.length - 1]; // fallback to last
    let sliceIndex = prizes.length - 1;

    for (let i = 0; i < prizes.length; i++) {
      cumulative += Number(prizes[i].probability);
      if (randomFloat < cumulative) {
        selectedPrize = prizes[i];
        sliceIndex = i; // 0-indexed position in wheel
        break;
      }
    }

    // 6. Generate reward code if won
    const isNoReward = selectedPrize.type === 'NO_REWARD';
    let rewardCode: string | null = null;
    let status = isNoReward ? 'NO_REWARD' : 'PENDING';

    if (!isNoReward) {
      rewardCode = generateRewardCode();
    }

    // 7. Insert spin record (Enforces UNIQUE constraint in DB)
    const insertRes = await db.query<{ id: number; created_at: string }>(
      `INSERT INTO spins (customer_id, campaign_id, prize_id, reward_code, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at;`,
      [customerId, campaign.id, selectedPrize.id, rewardCode, status]
    );

    const newSpin = insertRes.rows[0];

    return res.json({
      success: true,
      spin: {
        id: newSpin.id,
        sliceIndex: sliceIndex, // 0-indexed position for frontend wheel animation
        prizeId: selectedPrize.id,
        prizeName: selectedPrize.name,
        prizeType: selectedPrize.type,
        prizeValue: Number(selectedPrize.value),
        rewardCode: rewardCode,
        status: status,
        createdAt: newSpin.created_at,
        customerName: customer.name,
      },
    });
  } catch (err: any) {
    console.error('[SpinRouter] Play spin error:', err);
    // Handle unique constraint violation gracefully
    if (err.message && err.message.includes('unique_customer_campaign')) {
      return res.status(400).json({
        success: false,
        alreadySpun: true,
        message: 'You have already played your spin for this campaign!',
      });
    }
    return res.status(500).json({ success: false, message: 'Internal server error while processing spin' });
  }
});
