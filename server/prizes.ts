import crypto from 'crypto';

export interface PrizeConfig {
  id: number;
  name: string;
  type: 'PRODUCT' | 'PERCENTAGE_DISCOUNT' | 'NO_REWARD';
  value: number;
  probability: number;
  displayOrder: number;
  active: boolean;
}

// Exactly the 5 requested prizes with exact probabilities totaling 100%
export const DEFAULT_PRIZES: PrizeConfig[] = [
  { id: 1, name: 'Free Socks', type: 'PRODUCT', value: 150, probability: 35, displayOrder: 0, active: true },
  { id: 2, name: '10% OFF', type: 'PERCENTAGE_DISCOUNT', value: 10, probability: 35, displayOrder: 1, active: true },
  { id: 3, name: 'Free Belt', type: 'PRODUCT', value: 400, probability: 10, displayOrder: 2, active: true },
  { id: 4, name: '15% OFF', type: 'PERCENTAGE_DISCOUNT', value: 15, probability: 10, displayOrder: 3, active: true },
  { id: 5, name: 'Better Luck Next Time', type: 'NO_REWARD', value: 0, probability: 10, displayOrder: 4, active: true },
];

let activePrizes: PrizeConfig[] = JSON.parse(JSON.stringify(DEFAULT_PRIZES));

export function getActivePrizes(): PrizeConfig[] {
  return activePrizes;
}

export function updatePrizeProbabilities(
  updates: Array<{ id: number; probability: number }>
): { success: boolean; message?: string } {
  const sum = updates.reduce((acc, u) => acc + Number(u.probability), 0);
  if (Math.round(sum) !== 100) {
    return { success: false, message: `Total probability must equal 100% (currently ${sum}%)` };
  }

  for (const u of updates) {
    const target = activePrizes.find((p) => p.id === u.id);
    if (target) {
      target.probability = Number(u.probability);
    }
  }

  return { success: true };
}

// Crypto-secure server-authoritative prize selection
export function selectRandomPrize(): { prize: PrizeConfig; sliceIndex: number } {
  const prizes = activePrizes;
  const totalWeight = prizes.reduce((acc, p) => acc + p.probability, 0);

  const randomBuffer = crypto.randomBytes(4);
  const randomUint32 = randomBuffer.readUInt32BE(0);
  const randomFloat = (randomUint32 / 0xffffffff) * (totalWeight || 100);

  let cumulative = 0;
  for (let i = 0; i < prizes.length; i++) {
    cumulative += prizes[i].probability;
    if (randomFloat < cumulative || i === prizes.length - 1) {
      return {
        prize: prizes[i],
        sliceIndex: prizes[i].displayOrder,
      };
    }
  }

  return {
    prize: prizes[0],
    sliceIndex: 0,
  };
}

// In-memory registration session cache (bridges /customer/register to /spin/play)
export interface PendingCustomer {
  id: number;
  name: string;
  whatsappNumber: string;
  createdAt: number;
}

const pendingCustomers = new Map<number, PendingCustomer>();

export function storePendingCustomer(name: string, whatsappNumber: string): number {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  pendingCustomers.set(id, {
    id,
    name,
    whatsappNumber,
    createdAt: Date.now(),
  });

  // Prune entries older than 30 minutes
  const now = Date.now();
  for (const [key, val] of pendingCustomers.entries()) {
    if (now - val.createdAt > 30 * 60 * 1000) {
      pendingCustomers.delete(key);
    }
  }

  return id;
}

export function getPendingCustomer(id: number): PendingCustomer | undefined {
  return pendingCustomers.get(id);
}
