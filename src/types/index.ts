export interface Prize {
  id: number;
  name: string;
  type: 'PRODUCT' | 'PERCENTAGE_DISCOUNT' | 'NO_REWARD';
  value: number;
  probability: number;
  displayOrder: number;
  active?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  whatsappNumber: string;
}

export interface SpinResult {
  id: number;
  sliceIndex: number;
  prizeId?: number;
  prizeName: string;
  prizeType: string;
  prizeValue: number;
  rewardCode: string | null;
  status: string;
  createdAt: string;
  customerName?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'CASHIER';
}

export interface RedemptionRecord {
  id: number;
  rewardCode: string | null;
  status: string;
  createdAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  customer: {
    id: number;
    name: string;
    whatsappNumber: string;
  };
  prize: {
    id: number;
    name: string;
    type: string;
    value: number;
  };
}

export interface AdminStats {
  totalSpins: number;
  totalCustomers: number;
  redeemedSpins: number;
  pendingSpins: number;
  redemptionRate: number;
  prizeCounts?: {
    freeSocks: number;
    tenPercentOff: number;
    freeBelt: number;
    fifteenPercentOff: number;
    betterLuckNextTime: number;
  };
  campaign: {
    id: number;
    name: string;
    active: boolean;
    created_at?: string;
  } | null;
  prizeBreakdown: Array<{
    id: number;
    name: string;
    type: string;
    value: number;
    probability: number;
    active: boolean;
    displayOrder: number;
    wonCount: number;
    redeemedCount: number;
    actualPercentage: number;
  }>;
}
