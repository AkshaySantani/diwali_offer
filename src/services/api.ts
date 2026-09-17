import { Prize, SpinResult, RedemptionRecord, AdminStats } from '../types/index.js';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg) as any;
    error.data = data;
    error.status = response.status;
    if (response.status === 401) {
      try {
        localStorage.removeItem('af_diwali_token');
        localStorage.removeItem('af_diwali_user');
        window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message: errorMsg } }));
      } catch (e) {}
    }
    throw error;
  }

  return data as T;
}

export const api = {
  // Public Customer & Spin APIs
  getPrizes: async (): Promise<{ success: boolean; prizes: Prize[] }> => {
    return request<{ success: boolean; prizes: Prize[] }>('/spin/prizes');
  },

  registerCustomer: async (
    name: string,
    whatsappNumber: string,
    marketingConsent: boolean = true
  ): Promise<{
    success: boolean;
    hasSpun: boolean;
    customer: { id: number; name: string; whatsappNumber: string };
    previousSpin?: SpinResult;
    message?: string;
  }> => {
    return request('/customer/register', {
      method: 'POST',
      body: JSON.stringify({ name, whatsappNumber, marketingConsent }),
    });
  },

  playSpin: async (
    customerId: number,
    customerData?: { name?: string; whatsappNumber?: string }
  ): Promise<{ success: boolean; spin: SpinResult; message?: string }> => {
    return request('/spin/play', {
      method: 'POST',
      body: JSON.stringify({ customerId, ...customerData }),
    });
  },

  // Auth
  login: async (
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    token: string;
    user: { id: number; username: string; role: 'ADMIN' | 'CASHIER' };
  }> => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  verifySession: async (
    token: string
  ): Promise<{
    success: boolean;
    user: { id: number; username: string; role: 'ADMIN' | 'CASHIER' };
  }> => {
    return request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // Cashier & Redemption
  searchRedemption: async (query: string, token: string): Promise<{ success: boolean; records: RedemptionRecord[] }> => {
    return request(`/redemption/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  redeemCode: async (
    rewardCode: string,
    token: string
  ): Promise<{ success: boolean; message: string; spin: any }> => {
    return request('/redemption/redeem', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rewardCode }),
    });
  },

  getRecentRedemptions: async (token: string): Promise<{ success: boolean; redemptions: any[] }> => {
    return request('/redemption/recent', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // Admin
  getAdminStats: async (token: string): Promise<{ success: boolean; stats: AdminStats }> => {
    return request('/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getAdminSpins: async (
    params: { search?: string; status?: string; limit?: number; offset?: number },
    token: string
  ): Promise<{ success: boolean; total: number; spins: any[] }> => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    return request(`/admin/spins?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  updatePrizes: async (prizes: any[], token: string): Promise<{ success: boolean; message: string }> => {
    return request('/admin/prizes', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prizes }),
    });
  },

  updateCampaign: async (
    data: { active?: boolean; name?: string },
    token: string
  ): Promise<{ success: boolean; message: string }> => {
    return request('/admin/campaign', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  },

  downloadCsv: async (token: string): Promise<void> => {
    const res = await fetch('/api/admin/export-csv', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akshay_footwear_spins_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};
