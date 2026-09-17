import React from 'react';
import { Sparkles, Store, Shield, Receipt, LogOut } from 'lucide-react';
import { AuthUser } from '../types/index.js';

interface FestiveHeaderProps {
  currentTab: 'customer' | 'cashier' | 'admin';
  onTabChange: (tab: 'customer' | 'cashier' | 'admin') => void;
  authUser: AuthUser | null;
  onLogout: () => void;
}

export const FestiveHeader: React.FC<FestiveHeaderProps> = ({
  currentTab,
  onTabChange,
  authUser,
  onLogout,
}) => {
  return (
    <header
      id="festive-header"
      className="sticky top-0 z-40 w-full bg-[#1A0505]/95 backdrop-blur-md border-b border-[#F5A623]/30 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand identity */}
        <div
          id="brand-logo-button"
          onClick={() => onTabChange('customer')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7B1A1A] via-[#9B2424] to-[#F5A623] p-0.5 shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#200505] rounded-[10px] flex items-center justify-center text-xl">
              🪔
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-['Poppins'] font-black text-lg sm:text-xl tracking-wider text-[#FFE082] group-hover:text-[#FFF8E7] transition-colors">
                AKSHAY FOOTWEAR
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40">
                DIWALI 2026
              </span>
            </div>
            <p className="text-[11px] text-[#F5D77F]/70 font-medium tracking-wide">
              Festive Dhamaka • Spin & Win In-Store Rewards
            </p>
          </div>
        </div>

        {/* Navigation & Portal Tabs */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center p-1 rounded-xl bg-[#2A0808] border border-[#F5A623]/30 text-xs sm:text-sm font-semibold">
            <button
              id="nav-customer-spin"
              onClick={() => onTabChange('customer')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentTab === 'customer'
                  ? 'bg-gradient-to-r from-[#F5A623] to-[#D48806] text-[#1A0505] shadow-sm font-bold'
                  : 'text-[#F5D77F]/80 hover:text-[#FFF8E7] hover:bg-[#3E0D0D]'
              }`}
            >
              <span>🎡</span>
              <span>Spin & Win</span>
            </button>

            <button
              id="nav-cashier-portal"
              onClick={() => onTabChange('cashier')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentTab === 'cashier'
                  ? 'bg-gradient-to-r from-[#F5A623] to-[#D48806] text-[#1A0505] shadow-sm font-bold'
                  : 'text-[#F5D77F]/80 hover:text-[#FFF8E7] hover:bg-[#3E0D0D]'
              }`}
            >
              <Receipt size={14} />
              <span>Cashier</span>
            </button>

            <button
              id="nav-admin-portal"
              onClick={() => onTabChange('admin')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                currentTab === 'admin'
                  ? 'bg-gradient-to-r from-[#F5A623] to-[#D48806] text-[#1A0505] shadow-sm font-bold'
                  : 'text-[#F5D77F]/80 hover:text-[#FFF8E7] hover:bg-[#3E0D0D]'
              }`}
            >
              <Shield size={14} />
              <span>Admin</span>
            </button>
          </nav>

          {/* User badge & Logout */}
          {authUser && (
            <div className="flex items-center gap-2 pl-2 border-l border-[#F5A623]/30">
              <span className="hidden md:inline text-xs text-[#F5D77F]">
                {authUser.role === 'ADMIN' ? '👑 Admin' : '👤 Cashier'} ({authUser.username})
              </span>
              <button
                id="header-logout-button"
                onClick={onLogout}
                title="Logout"
                className="p-1.5 rounded-lg bg-[#3A0C0C] hover:bg-red-900/60 text-red-300 border border-red-500/30 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
