import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Download,
  Users,
  Award,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  EyeOff,
  Power,
  Save,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../services/api.js';
import { AuthUser, AdminStats } from '../types/index.js';

interface AdminViewProps {
  authUser: AuthUser | null;
  token: string | null;
  onLoginSuccess: (user: AuthUser, token: string) => void;
  onLogout: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  authUser,
  token,
  onLoginSuccess,
  onLogout,
}) => {
  // Login State
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Data State
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [spinsList, setSpinsList] = useState<any[]>([]);
  const [totalSpins, setTotalSpins] = useState(0);
  const [isLoadingSpins, setIsLoadingSpins] = useState(false);

  // Filter & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [revealPhones, setRevealPhones] = useState(false);

  // Prize Probability Editor
  const [editedPrizes, setEditedPrizes] = useState<any[]>([]);
  const [isSavingPrizes, setIsSavingPrizes] = useState(false);
  const [prizeSaveMsg, setPrizeSaveMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Campaign Toggle
  const [isTogglingCampaign, setIsTogglingCampaign] = useState(false);

  // Fetch stats & prizes
  const fetchStats = async () => {
    if (!token) return;
    try {
      setIsLoadingStats(true);
      const res = await api.getAdminStats(token);
      if (res.success) {
        setStats(res.stats);
        setEditedPrizes(
          res.stats.prizeBreakdown.map((p) => ({
            id: p.id,
            name: p.name,
            probability: p.probability,
            active: p.active,
            type: p.type,
            value: p.value,
          }))
        );
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with admin credentials.');
        onLogout();
        return;
      }
      console.error('Failed to load admin stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch spins table
  const fetchSpins = async () => {
    if (!token) return;
    try {
      setIsLoadingSpins(true);
      const res = await api.getAdminSpins(
        { search, status: statusFilter, limit: 100 },
        token
      );
      if (res.success) {
        setSpinsList(res.spins);
        setTotalSpins(res.total);
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with admin credentials.');
        onLogout();
        return;
      }
      console.error('Failed to load spins:', err);
    } finally {
      setIsLoadingSpins(false);
    }
  };

  useEffect(() => {
    if (authUser && token && authUser.role === 'ADMIN') {
      fetchStats();
      fetchSpins();
    }
  }, [authUser, token]);

  useEffect(() => {
    if (authUser && token && authUser.role === 'ADMIN') {
      const delay = setTimeout(() => {
        fetchSpins();
      }, 300);
      return () => clearTimeout(delay);
    }
  }, [search, statusFilter]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await api.login(username, password);
      if (res.success) {
        if (res.user.role !== 'ADMIN') {
          setLoginError('Access denied. Administrator privileges required.');
          return;
        }
        onLoginSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Check admin credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Probability sum calculation
  const totalProbability = useMemo(() => {
    return editedPrizes.reduce((sum, p) => (p.active !== false ? sum + Number(p.probability || 0) : sum), 0);
  }, [editedPrizes]);

  const isProbValid = Math.round(totalProbability * 100) / 100 === 100;

  // Save prize probabilities
  const handleSavePrizes = async () => {
    if (!token || !isProbValid) return;
    setIsSavingPrizes(true);
    setPrizeSaveMsg(null);

    try {
      const res = await api.updatePrizes(editedPrizes, token);
      if (res.success) {
        setPrizeSaveMsg({ text: 'Prize probabilities updated successfully!', isError: false });
        fetchStats();
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with admin credentials.');
        onLogout();
        return;
      }
      setPrizeSaveMsg({ text: err.message || 'Failed to update prizes', isError: true });
    } finally {
      setIsSavingPrizes(false);
    }
  };

  // Toggle Campaign active
  const handleToggleCampaign = async () => {
    if (!token || !stats?.campaign) return;
    setIsTogglingCampaign(true);
    try {
      const newActive = !stats.campaign.active;
      const res = await api.updateCampaign({ active: newActive }, token);
      if (res.success) {
        fetchStats();
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with admin credentials.');
        onLogout();
        return;
      }
      console.error('Failed to toggle campaign:', err);
    } finally {
      setIsTogglingCampaign(false);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    if (!token) return;
    try {
      await api.downloadCsv(token);
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.includes('session token') || err?.message?.includes('Authentication required')) {
        setLoginError('Session expired. Please log in with admin credentials.');
        onLogout();
        return;
      }
      alert(err.message || 'Failed to download CSV');
    }
  };

  // If not logged in as Admin, show login form
  if (!authUser || !token || authUser.role !== 'ADMIN') {
    return (
      <div id="admin-login-section" className="max-w-md mx-auto py-12 px-4">
        <div className="bg-gradient-to-b from-[#2B0A0A] to-[#170404] border border-[#F5A623]/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-[#FFF8E7]">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#7B1A1A] border border-[#F5A623]/60 mb-3 shadow-md">
              <Shield className="w-7 h-7 text-[#F5D77F]" />
            </div>
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#F5D77F]">
              Admin Control Center
            </h2>
            <p className="text-xs text-[#F5D77F]/70 mt-1">
              Akshay Footwear Diwali Campaign Management
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-500/50 flex items-start gap-2.5 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#F5D77F]/90 mb-1.5">
                Administrator Username
              </label>
              <input
                id="admin-username-input"
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
                id="admin-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#140303] border border-[#F5A623]/40 rounded-xl text-[#FFF8E7] focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-[#3A0C0C]/50 border border-[#F5A623]/20 text-[11px] text-[#F5D77F]/80">
              💡 Admin credentials: <strong>admin / admin123</strong>
            </div>

            <button
              id="admin-login-submit"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-[#F5A623] to-[#D48806] text-[#1A0505] hover:from-[#FFE082] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isLoggingIn ? 'Authenticating...' : 'Access Admin Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-dashboard-view" className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Top Banner with Campaign Switcher */}
      <div className="bg-gradient-to-r from-[#2F0B0B] via-[#4A0D0D] to-[#2F0B0B] border border-[#F5A623]/40 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#F5A623] uppercase tracking-wider">
            <Shield size={16} />
            <span>Campaign Operations • Executive Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-['Poppins'] text-[#FFE082] mt-1">
            Akshay Footwear Admin Suite
          </h1>
          <p className="text-xs text-[#F5D77F]/80 mt-0.5">
            Real-time analytics, prize probability management, and customer redemption records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Campaign Status Button */}
          {stats?.campaign && (
            <button
              onClick={handleToggleCampaign}
              disabled={isTogglingCampaign}
              className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                stats.campaign.active
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                  : 'bg-red-950/80 border-red-500/60 text-red-300 hover:bg-red-900'
              }`}
            >
              <Power size={14} className={isTogglingCampaign ? 'animate-spin' : ''} />
              <span>Campaign: {stats.campaign.active ? 'ACTIVE (Accepting Spins)' : 'PAUSED'}</span>
            </button>
          )}

          {/* Export CSV Button */}
          <button
            id="admin-export-csv-button"
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F5A623] to-[#D48806] hover:from-[#FFE082] text-[#1A0505] font-bold text-xs flex items-center gap-2 transition-all shadow-md"
          >
            <Download size={14} />
            <span>EXPORT CSV</span>
          </button>

          <button
            onClick={() => {
              fetchStats();
              fetchSpins();
            }}
            className="p-2.5 rounded-xl bg-[#3A0C0C] hover:bg-[#4E1010] text-[#F5D77F] border border-[#F5A623]/30 transition-colors"
            title="Refresh All"
          >
            <RefreshCw size={16} className={isLoadingStats || isLoadingSpins ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#240606] border border-[#F5A623]/30 shadow-lg">
          <div className="flex items-center justify-between text-[#F5D77F]/70 text-xs font-semibold uppercase tracking-wider">
            <span>Total Spins</span>
            <Award className="w-5 h-5 text-[#F5A623]" />
          </div>
          <div className="text-3xl font-extrabold font-['Poppins'] text-[#FFF8E7] mt-2">
            {stats?.totalSpins ?? 0}
          </div>
          <div className="text-[11px] text-[#F5D77F]/60 mt-1">
            Total records in Neon diwali_spins
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#240606] border border-[#F5A623]/30 shadow-lg">
          <div className="flex items-center justify-between text-[#F5D77F]/70 text-xs font-semibold uppercase tracking-wider">
            <span>Total Customers</span>
            <Users className="w-5 h-5 text-[#F5A623]" />
          </div>
          <div className="text-3xl font-extrabold font-['Poppins'] text-[#FFF8E7] mt-2">
            {stats?.totalCustomers ?? 0}
          </div>
          <div className="text-[11px] text-[#F5D77F]/60 mt-1">
            Unique WhatsApp numbers
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#240606] border border-[#F5A623]/30 shadow-lg">
          <div className="flex items-center justify-between text-[#F5D77F]/70 text-xs font-semibold uppercase tracking-wider">
            <span>Pending Rewards</span>
            <TrendingUp className="w-5 h-5 text-[#F5A623]" />
          </div>
          <div className="text-3xl font-extrabold font-['Poppins'] text-[#FFE082] mt-2">
            {stats?.pendingSpins ?? 0}
          </div>
          <div className="text-[11px] text-[#F5D77F]/60 mt-1">
            Status: PENDING
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#240606] border border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <span>Redeemed Rewards</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold font-['Poppins'] text-emerald-300 mt-2">
            {stats?.redeemedSpins ?? 0}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">
            Redemption rate: {stats?.redemptionRate ?? 0}%
          </div>
        </div>
      </div>

      {/* Prize Won Counters Live from Neon Database */}
      <div className="bg-[#240606] border border-[#F5A623]/40 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-[#F5A623]/20 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#F5D77F] flex items-center gap-2">
            <span>🎁 Neon Live Prize Distribution</span>
            <span className="text-[10px] text-[#F5A623] bg-[#F5A623]/10 px-2 py-0.5 rounded-full border border-[#F5A623]/30">Live Table Counts</span>
          </h2>
          <span className="text-[11px] text-[#F5D77F]/60">Table: diwali_spins</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#F5D77F]/80 flex items-center gap-1.5">
              <span>🧦</span> Free Socks (35%)
            </span>
            <div className="text-2xl font-extrabold text-[#FFE082] mt-1.5 font-['Poppins']">
              {stats?.prizeCounts?.freeSocks ?? 0}
            </div>
            <span className="text-[10px] text-[#F5D77F]/60 mt-0.5">Product reward</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#F5D77F]/80 flex items-center gap-1.5">
              <span>💰</span> 10% OFF (35%)
            </span>
            <div className="text-2xl font-extrabold text-[#FFE082] mt-1.5 font-['Poppins']">
              {stats?.prizeCounts?.tenPercentOff ?? 0}
            </div>
            <span className="text-[10px] text-[#F5D77F]/60 mt-0.5">Discount voucher</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#F5D77F]/80 flex items-center gap-1.5">
              <span>👔</span> Free Belt (10%)
            </span>
            <div className="text-2xl font-extrabold text-[#FFE082] mt-1.5 font-['Poppins']">
              {stats?.prizeCounts?.freeBelt ?? 0}
            </div>
            <span className="text-[10px] text-[#F5D77F]/60 mt-0.5">Product reward</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 flex flex-col justify-between">
            <span className="text-xs font-semibold text-[#F5D77F]/80 flex items-center gap-1.5">
              <span>🎉</span> 15% OFF (10%)
            </span>
            <div className="text-2xl font-extrabold text-[#FFE082] mt-1.5 font-['Poppins']">
              {stats?.prizeCounts?.fifteenPercentOff ?? 0}
            </div>
            <span className="text-[10px] text-[#F5D77F]/60 mt-0.5">Discount voucher</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-[#F5D77F]/80 flex items-center gap-1.5">
              <span>😄</span> Better Luck Next Time (10%)
            </span>
            <div className="text-2xl font-extrabold text-[#FFF8E7]/70 mt-1.5 font-['Poppins']">
              {stats?.prizeCounts?.betterLuckNextTime ?? 0}
            </div>
            <span className="text-[10px] text-[#F5D77F]/60 mt-0.5">No reward</span>
          </div>
        </div>
      </div>

      {/* Prize Breakdown & Probability Editor */}
      <div className="bg-[#240606] border border-[#F5A623]/40 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F5A623]/20 pb-4">
          <div>
            <h2 className="text-lg font-bold font-['Poppins'] text-[#FFE082] flex items-center gap-2">
              <Sliders size={20} className="text-[#F5A623]" />
              <span>Prize Distribution & Probability Editor</span>
            </h2>
            <p className="text-xs text-[#F5D77F]/70 mt-0.5">
              Live odds configuration for the 5 wheel slots. Probabilities must sum to exactly 100%.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border ${
                isProbValid
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : 'bg-red-950 text-red-300 border-red-500/50 animate-pulse'
              }`}
            >
              Total: {totalProbability}% {isProbValid ? '✓ Valid' : '⚠️ Must equal 100%'}
            </span>

            <button
              id="save-prizes-button"
              onClick={handleSavePrizes}
              disabled={isSavingPrizes || !isProbValid}
              className="py-2 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-[#F5A623] to-[#D48806] hover:from-[#FFE082] text-[#1A0505] shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>{isSavingPrizes ? 'Saving...' : 'Save Probabilities'}</span>
            </button>
          </div>
        </div>

        {prizeSaveMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              prizeSaveMsg.isError
                ? 'bg-red-950 border-red-500 text-red-200'
                : 'bg-emerald-950 border-emerald-500 text-emerald-200'
            }`}
          >
            {prizeSaveMsg.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>{prizeSaveMsg.text}</span>
          </div>
        )}

        {/* Prizes Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#FFF8E7]">
            <thead>
              <tr className="border-b border-[#F5A623]/20 text-[#F5D77F]/70 uppercase tracking-wider">
                <th className="pb-3">Slot #</th>
                <th className="pb-3">Prize Name</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Configured Probability</th>
                <th className="pb-3">Spins Won</th>
                <th className="pb-3">Redeemed</th>
                <th className="pb-3">Actual Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {editedPrizes.map((prize, idx) => {
                const stat = stats?.prizeBreakdown.find((p) => p.id === prize.id);
                return (
                  <tr key={prize.id} className="hover:bg-[#2F0A0A]/40 transition-colors">
                    <td className="py-3 font-mono font-bold text-[#F5A623]">
                      Slot {idx}
                    </td>
                    <td className="py-3 font-semibold text-[#FFF8E7] flex items-center gap-2">
                      <span>{prize.name}</span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#7B1A1A] text-[#FFE082] border border-[#F5A623]/30">
                        {prize.type}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={prize.probability}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditedPrizes((prev) =>
                              prev.map((p) => (p.id === prize.id ? { ...p, probability: val } : p))
                            );
                          }}
                          className="w-20 px-2 py-1 bg-[#140303] border border-[#F5A623]/50 rounded-lg text-center font-mono font-bold text-[#FFE082] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                        />
                        <span className="text-[#F5D77F]/80 font-mono">%</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono font-semibold text-neutral-300">
                      {stat?.wonCount ?? 0}
                    </td>
                    <td className="py-3 font-mono font-semibold text-emerald-400">
                      {stat?.redeemedCount ?? 0}
                    </td>
                    <td className="py-3 font-mono text-[#F5A623]">
                      {stat?.actualPercentage ?? 0}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Spins & Redemption Table */}
      <div className="bg-[#240606] border border-[#F5A623]/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F5A623]/20 pb-4">
          <div>
            <h2 className="text-lg font-bold font-['Poppins'] text-[#FFE082] flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-[#F5A623]" />
              <span>Customer Spins Database ({totalSpins})</span>
            </h2>
            <p className="text-xs text-[#F5D77F]/70 mt-0.5">
              Complete verifiable log of every spin generated by customers
            </p>
          </div>

          <button
            onClick={() => setRevealPhones(!revealPhones)}
            className="px-3 py-1.5 rounded-lg bg-[#3A0C0C] hover:bg-[#4E1010] text-[#F5D77F] border border-[#F5A623]/30 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
          >
            {revealPhones ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{revealPhones ? 'Mask Phone Numbers' : 'Reveal Full Numbers'}</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, WhatsApp, or reward code..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#140303] border border-[#F5A623]/40 rounded-xl text-xs text-[#FFF8E7] placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[#F5A623]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-[#140303] border border-[#F5A623]/40 rounded-xl text-xs text-[#FFF8E7] focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Redemption</option>
              <option value="REDEEMED">Redeemed</option>
              <option value="NO_REWARD">Better Luck Next Time</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#FFF8E7]">
            <thead>
              <tr className="border-b border-[#F5A623]/20 text-[#F5D77F]/70 uppercase tracking-wider">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Customer Name</th>
                <th className="pb-3">WhatsApp</th>
                <th className="pb-3">Prize Won</th>
                <th className="pb-3">Reward Code</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Redeemed At / By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {spinsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                    {isLoadingSpins ? 'Loading database records...' : 'No spin records match your filters.'}
                  </td>
                </tr>
              ) : (
                spinsList.map((spin) => (
                  <tr key={spin.id} className="hover:bg-[#2F0A0A]/40 transition-colors">
                    <td className="py-3 font-mono text-neutral-400">
                      {new Date(spin.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 font-bold text-[#FFF8E7]">
                      {spin.customer.name}
                    </td>
                    <td className="py-3 font-mono text-neutral-300">
                      {revealPhones ? spin.customer.whatsappNumber : spin.customer.maskedPhone}
                    </td>
                    <td className="py-3 font-bold text-[#FFE082]">
                      {spin.prize.name}
                    </td>
                    <td className="py-3 font-mono text-[#00E676] font-bold">
                      {spin.rewardCode || '—'}
                    </td>
                    <td className="py-3">
                      {spin.status === 'REDEEMED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                          ✓ REDEEMED
                        </span>
                      ) : spin.status === 'PENDING' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
                          ⏳ PENDING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                          NO REWARD
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-neutral-400 text-[11px]">
                      {spin.redeemedAt ? (
                        <span>
                          {new Date(spin.redeemedAt).toLocaleDateString()} by {spin.redeemedBy || 'Staff'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
