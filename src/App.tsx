import React, { useState, useEffect } from 'react';
import { FestiveHeader } from './components/FestiveHeader.js';
import { LandingPage } from './pages/LandingPage.js';
import { CashierView } from './components/CashierView.js';
import { AdminView } from './components/AdminView.js';
import { AuthUser } from './types/index.js';
import { api } from './services/api.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'customer' | 'cashier' | 'admin'>('customer');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Sync with window.location.hash or URL for direct /cashier or /admin access
  useEffect(() => {
    const handleHash = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      if (path.includes('admin') || hash.includes('admin')) {
        setCurrentTab('admin');
      } else if (path.includes('cashier') || hash.includes('cashier')) {
        setCurrentTab('cashier');
      } else {
        setCurrentTab('customer');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleLogout = (keepTab = true) => {
    setAuthUser(null);
    setToken(null);
    try {
      localStorage.removeItem('af_diwali_token');
      localStorage.removeItem('af_diwali_user');
    } catch (e) {}
    if (!keepTab) {
      setCurrentTab('customer');
      window.location.hash = '';
    }
  };

  // Restore and verify session token from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem('af_diwali_token');
        const savedUser = localStorage.getItem('af_diwali_user');
        if (savedToken && savedUser) {
          // Verify with server before assuming session is valid
          try {
            const res = await api.verifySession(savedToken);
            if (res.success && res.user) {
              setToken(savedToken);
              setAuthUser(res.user);
            } else {
              handleLogout(true);
            }
          } catch (err) {
            // Token is expired or invalid - silently clean up
            handleLogout(true);
          }
        }
      } catch (err) {
        handleLogout(true);
      }
    };

    restoreSession();

    // Listen for auth expiration events triggered by api.ts on 401
    const handleAuthExpired = () => {
      handleLogout(true);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  const handleTabChange = (tab: 'customer' | 'cashier' | 'admin') => {
    setCurrentTab(tab);
    window.location.hash = tab === 'customer' ? '' : tab;
  };

  const handleLoginSuccess = (user: AuthUser, sessionToken: string) => {
    setAuthUser(user);
    setToken(sessionToken);
    try {
      localStorage.setItem('af_diwali_token', sessionToken);
      localStorage.setItem('af_diwali_user', JSON.stringify(user));
    } catch (e) {}
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#140303] text-[#FFF8E7] flex flex-col font-['Inter'] selection:bg-[#F5A623] selection:text-[#1A0505]">
      {/* Festive Navigation Header */}
      <FestiveHeader
        currentTab={currentTab}
        onTabChange={handleTabChange}
        authUser={authUser}
        onLogout={() => handleLogout(false)}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {currentTab === 'customer' && <LandingPage />}
        {currentTab === 'cashier' && (
          <CashierView
            authUser={authUser}
            token={token}
            onLoginSuccess={handleLoginSuccess}
            onLogout={() => handleLogout(true)}
          />
        )}
        {currentTab === 'admin' && (
          <AdminView
            authUser={authUser}
            token={token}
            onLoginSuccess={handleLoginSuccess}
            onLogout={() => handleLogout(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer id="app-footer" className="w-full py-6 border-t border-[#F5A623]/20 bg-[#100202] text-center text-xs text-[#F5D77F]/60">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <div className="font-bold text-[#FFE082] tracking-wider font-['Poppins']">
            AKSHAY FOOTWEAR • DIWALI DHAMAKA 2026
          </div>
          <p>
            Official in-store festival rewards program. One spin per verified customer.
          </p>
          <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-[#F5A623]/80 font-medium">
            <button onClick={() => handleTabChange('customer')} className="hover:underline">
              Customer Spin
            </button>
            <span>•</span>
            <button onClick={() => handleTabChange('cashier')} className="hover:underline">
              Cashier Portal
            </button>
            <span>•</span>
            <button onClick={() => handleTabChange('admin')} className="hover:underline">
              Admin Suite
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
