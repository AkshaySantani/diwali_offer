import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, AlertTriangle, Clock, RefreshCw, Key, UserCheck, ShieldAlert, Award } from 'lucide-react';
import { api } from '../services/api.js';
import { AuthUser, RedemptionRecord } from '../types/index.js';
import confetti from 'canvas-confetti';

interface CashierViewProps {
  authUser: AuthUser | null;
  token: string | null;
  onLoginSuccess: (user: AuthUser, token: string) => void;
  onLogout: () => void;
}

export const CashierView: React.FC<CashierViewProps> = ({
  authUser,
  token,
  onLoginSuccess,
  onLogout,
}) => {
  // Login State
  const [username, setUsername] = useState('cashier');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Search & Redemption State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<RedemptionRecord[]>([]);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccessMsg, setRedeemSuccessMsg] = useState<string | null>(null);

  // Recent Redemptions Log
  const [recentList, setRecentList] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  const fetchRecent = async () => {
    if (!token) return;
    try {
      setIsLoadingRecent(true);
      const res = await api.getRecentRedemptions(token);
      if (res.success) {
        setRecentList(res.redemptions);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with cashier credentials.');
        onLogout();
        return;
      }
      console.error('Failed to fetch recent redemptions:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    if (authUser && token) {
      fetchRecent();
    }
  }, [authUser, token]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await api.login(username, password);
      if (res.success) {
        onLoginSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Check credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Search handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !token) return;

    setIsSearching(true);
    setSearchError(null);
    setRedeemSuccessMsg(null);

    try {
      const res = await api.searchRedemption(searchQuery.trim(), token);
      if (res.success && res.records.length > 0) {
        setSearchResults(res.records);
      } else {
        setSearchResults([]);
        setSearchError('No prize or spin record found.');
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with cashier credentials.');
        onLogout();
        return;
      }
      setSearchResults([]);
      setSearchError(err.message || 'Lookup failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Redeem handler
  const handleRedeem = async (code: string) => {
    if (!token || isRedeeming) return;
    setIsRedeeming(true);
    setRedeemSuccessMsg(null);
    setSearchError(null);

    try {
      const res = await api.redeemCode(code, token);
      if (res.success) {
        setRedeemSuccessMsg(res.message);
        // Fire cashier celebration confetti
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00E676', '#F5A623', '#FFF8E7'],
        });

        // Update current search results
        setSearchResults((prev) =>
          prev.map((rec) =>
            rec.rewardCode === code
              ? {
                  ...rec,
                  status: 'REDEEMED',
                  redeemedAt: new Date().toISOString(),
                  redeemedBy: authUser?.username || 'cashier',
                }
              : rec
          )
        );

        // Refresh recent logs
        fetchRecent();
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with cashier credentials.');
        onLogout();
        return;
      }
      setSearchError(err.message || 'Failed to redeem prize.');
    } finally {
      setIsRedeeming(false);
    }
  };

  // If not logged in, render Cashier Login Card
  if (!authUser || !token) {
    return (
      <div id="cashier-login-section" className="max-w-md mx-auto py-12 px-4">
        <div className="bg-gradient-to-b from-[#2B0A0A] to-[#170404] border border-[#F5A623]/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-[#FFF8E7]">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#7B1A1A] border border-[#F5A623]/60 mb-3 shadow-md">
              <Key className="w-7 h-7 text-[#F5D77F]" />
            </div>
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#F5D77F]">
              Cashier Portal
            </h2>
            <p className="text-xs text-[#F5D77F]/70 mt-1">
              Verify and redeem customer Diwali Spin & Win vouchers
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-500/50 flex items-start gap-2.5 text-red-200 text-xs">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#F5D77F]/90 mb-1.5">
                Cashier Username
              </label>
              <input
                id="cashier-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#140303] border border-[#F5A623]/40 rounded-xl text-[#FFF8E7] focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#F5D77F]/90 mb-1.5">
                Password
              </label>
              <input
                id="cashier-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter cashier password"
                required
                className="w-full px-3.5 py-2.5 bg-[#140303] border border-[#F5A623]/40 rounded-xl text-[#FFF8E7] focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-[#3A0C0C]/50 border border-[#F5A623]/20 text-[11px] text-[#F5D77F]/80">
              💡 Credentials: <strong>cashier</strong> (Default: <code>cashier123</code> or your custom <code>CASHIER_PASSWORD</code>)
            </div>

            <button
              id="cashier-login-submit"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-[#F5A623] to-[#D48806] text-[#1A0505] hover:from-[#FFE082] hover:to-[#F5A623] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isLoggingIn ? 'Authenticating...' : 'Login to Cashier Counter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="cashier-portal-view" className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#2F0B0B] via-[#4A0D0D] to-[#2F0B0B] border border-[#F5A623]/40 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#F5A623] uppercase tracking-wider">
            <UserCheck size={16} />
            <span>Counter Active • {authUser.role} Session</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#FFE082] mt-1">
            Akshay Footwear Cashier Desk
          </h1>
          <p className="text-xs text-[#F5D77F]/80 mt-0.5">
            Search customer vouchers by Reward Code or WhatsApp number to apply discounts
          </p>
        </div>
        <button
          onClick={fetchRecent}
          className="px-3.5 py-2 rounded-xl bg-[#3A0C0C] hover:bg-[#4E1010] text-[#F5D77F] border border-[#F5A623]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={14} className={isLoadingRecent ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Search Input Section */}
      <div className="bg-[#240606] border border-[#F5A623]/40 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#F5D77F]">
            Enter Customer Reward Code or WhatsApp Number
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#F5A623]">
                <Search size={18} />
              </div>
              <input
                id="cashier-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. AF-K79A2X or 9876543210"
                className="w-full pl-10 pr-4 py-3 bg-[#140303] border border-[#F5A623]/50 rounded-xl text-[#FFF8E7] placeholder-neutral-500 font-mono text-base focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
              />
            </div>
            <button
              id="cashier-search-button"
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="py-3 px-6 rounded-xl font-bold bg-gradient-to-r from-[#F5A623] to-[#D48806] hover:from-[#FFE082] text-[#1A0505] transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSearching ? 'Searching...' : 'VERIFY VOUCHER'}
            </button>
          </div>
          <p className="text-[11px] text-[#F5D77F]/60">
            Customers will show this code on their mobile screen after spinning the wheel.
          </p>
        </form>

        {/* Notifications */}
        {searchError && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 flex items-start gap-2 text-red-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{searchError}</span>
          </div>
        )}

        {redeemSuccessMsg && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-start gap-3 text-emerald-200 text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-300">Voucher Successfully Redeemed!</div>
              <div>{redeemSuccessMsg}</div>
            </div>
          </div>
        )}
      </div>

      {/* Search Results Display */}
      {searchResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5D77F] flex items-center gap-2">
            <Award size={16} />
            <span>Verification Record ({searchResults.length})</span>
          </h3>

          {searchResults.map((rec) => {
            const isRedeemed = rec.status === 'REDEEMED';
            const isNoReward = rec.status === 'NO_REWARD' || rec.prize.type === 'NO_REWARD';
            const isPending = rec.status === 'PENDING';

            return (
              <div
                key={rec.id}
                id={`record-card-${rec.id}`}
                className={`p-6 rounded-2xl border-2 transition-all shadow-xl ${
                  isRedeemed
                    ? 'bg-[#1E0808] border-red-500/40'
                    : isPending
                    ? 'bg-gradient-to-r from-[#2E0B0B] via-[#380E0E] to-[#2E0B0B] border-[#00E676] shadow-[0_0_25px_rgba(0,230,118,0.2)]'
                    : 'bg-[#1A0505] border-neutral-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Customer & Prize Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-bold font-['Poppins'] text-[#FFF8E7]">
                        {rec.customer.name}
                      </span>
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        📱 {rec.customer.whatsappNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-black font-['Poppins'] text-[#FFE082]">
                        🎁 {rec.prize.name}
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40 font-semibold">
                        {rec.prize.type}
                      </span>
                    </div>

                    {rec.rewardCode && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#F5D77F]/70">Code:</span>
                        <span className="font-mono text-lg font-bold tracking-wider text-[#00E676] bg-[#120404] px-3 py-0.5 rounded border border-[#00E676]/30">
                          {rec.rewardCode}
                        </span>
                      </div>
                    )}

                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>Spun on: {new Date(rec.createdAt).toLocaleString()}</span>
                    </div>

                    {isRedeemed && (
                      <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-300 font-medium">
                        ⚠️ Already redeemed on {new Date(rec.redeemedAt || '').toLocaleString()} by cashier &ldquo;{rec.redeemedBy || 'Staff'}&rdquo;.
                      </div>
                    )}
                  </div>

                  {/* Status & Action Button */}
                  <div className="flex flex-col items-end justify-center gap-3">
                    {isPending && (
                      <div className="w-full md:w-auto">
                        <button
                          id={`button-redeem-${rec.id}`}
                          onClick={() => handleRedeem(rec.rewardCode || '')}
                          disabled={isRedeeming}
                          className="w-full md:w-auto py-4 px-8 rounded-xl font-extrabold text-base bg-gradient-to-r from-[#00E676] to-[#00C853] hover:from-[#69F0AE] hover:to-[#00E676] text-[#0A2E12] shadow-[0_0_20px_rgba(0,230,118,0.5)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={20} />
                          <span>REDEEM NOW</span>
                        </button>
                        <p className="text-[11px] text-emerald-400 text-center mt-1 font-semibold">
                          ✓ One-time redemption
                        </p>
                      </div>
                    )}

                    {isRedeemed && (
                      <div className="px-4 py-2 rounded-xl bg-red-900/40 border border-red-500/60 text-red-300 text-xs font-bold flex items-center gap-1.5">
                        <ShieldAlert size={14} />
                        <span>CLAIMED & REDEEMED</span>
                      </div>
                    )}

                    {isNoReward && (
                      <div className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-400 text-xs font-bold">
                        NO REWARD SLICE
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Redemptions Table */}
      <div className="bg-[#200505] border border-[#F5A623]/30 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5D77F] mb-4 flex items-center gap-2">
          <Clock size={16} />
          <span>Recently Redeemed In-Store ({recentList.length})</span>
        </h3>

        {recentList.length === 0 ? (
          <div className="text-center py-6 text-neutral-400 text-xs">
            No vouchers redeemed yet today. Ready for customer visits!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#FFF8E7]">
              <thead>
                <tr className="border-b border-[#F5A623]/20 text-[#F5D77F]/70 uppercase tracking-wider">
                  <th className="pb-2.5">Time</th>
                  <th className="pb-2.5">Customer</th>
                  <th className="pb-2.5">Prize</th>
                  <th className="pb-2.5">Reward Code</th>
                  <th className="pb-2.5">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80 font-mono">
                {recentList.map((item) => (
                  <tr key={item.id} className="hover:bg-[#2F0A0A]/50 transition-colors">
                    <td className="py-2.5 text-neutral-400">
                      {new Date(item.redeemedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 font-sans font-medium text-[#FFF8E7]">
                      {item.customerName}
                    </td>
                    <td className="py-2.5 font-sans font-bold text-[#FFE082]">
                      {item.prizeName}
                    </td>
                    <td className="py-2.5 text-emerald-400 font-bold">
                      {item.rewardCode}
                    </td>
                    <td className="py-2.5 font-sans text-neutral-300">
                      {item.redeemedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
