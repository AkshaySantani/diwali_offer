import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';
import { normalizePhoneNumber, isValidIndianPhone } from '../utils.js';

export const customerRouter = Router();

// Register customer or return existing registration
customerRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, whatsappNumber, marketingConsent } = req.body;

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

    // Check active campaign
    const campaignRes = await db.query<{ id: number; name: string; active: boolean }>(
      `SELECT id, name, active FROM campaigns WHERE active = true ORDER BY id DESC LIMIT 1;`
    );

    if (campaignRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Diwali promotional campaign is currently not active. Please ask store staff.',
      });
    }

    const activeCampaign = campaignRes.rows[0];

    // Find customer by phone
    let customerRes = await db.query<{
      id: number;
      name: string;
      whatsapp_number: string;
      marketing_consent: boolean;
    }>(`SELECT id, name, whatsapp_number, marketing_consent FROM customers WHERE whatsapp_number = $1;`, [cleanPhone]);

    let customer = customerRes.rows[0];

    if (!customer) {
      // Create new customer
      const insertRes = await db.query<{
        id: number;
        name: string;
        whatsapp_number: string;
        marketing_consent: boolean;
      }>(
        `INSERT INTO customers (name, whatsapp_number, marketing_consent)
         VALUES ($1, $2, $3)
         RETURNING id, name, whatsapp_number, marketing_consent;`,
        [name.trim(), cleanPhone, marketingConsent !== false]
      );
      customer = insertRes.rows[0];
    } else {
      // Update name if changed
      await db.query(`UPDATE customers SET name = $1 WHERE id = $2;`, [name.trim(), customer.id]);
      customer.name = name.trim();
    }

    // Check if customer already spun in this campaign
    const spinRes = await db.query<{
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
      [customer.id, activeCampaign.id]
    );

    if (spinRes.rows.length > 0) {
      const prevSpin = spinRes.rows[0];
      return res.json({
        success: true,
        hasSpun: true,
        customer: {
          id: customer.id,
          name: customer.name,
          whatsappNumber: customer.whatsapp_number,
        },
        previousSpin: {
          id: prevSpin.id,
          prizeName: prevSpin.prize_name,
          prizeType: prevSpin.prize_type,
          prizeValue: Number(prevSpin.prize_value),
          rewardCode: prevSpin.reward_code,
          status: prevSpin.status,
          createdAt: prevSpin.created_at,
          sliceIndex: prevSpin.display_order,
        },
        message: 'Welcome back! You have already played your Diwali spin for this campaign.',
      });
    }

    return res.json({
      success: true,
      hasSpun: false,
      customer: {
        id: customer.id,
        name: customer.name,
        whatsappNumber: customer.whatsapp_number,
      },
    });
  } catch (err: any) {
    console.error('[CustomerRouter] Register error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while registering customer' });
  }
});
