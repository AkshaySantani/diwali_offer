import React, { useState } from 'react';
import { Sparkles, Phone, User, CheckCircle, X, AlertCircle } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, whatsappNumber: string, consent: boolean) => Promise<void>;
  isLoading: boolean;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError('Please enter your full name (minimum 2 characters)');
      return;
    }

    const cleanDigits = phone.replace(/\D/g, '');
    let finalPhone = cleanDigits;
    if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
      finalPhone = cleanDigits.slice(2);
    }
    if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
      finalPhone = cleanDigits.slice(1);
    }

    if (!/^[6-9]\d{9}$/.test(finalPhone)) {
      setError('Please enter a valid 10-digit Indian WhatsApp mobile number');
      return;
    }

    try {
      await onSubmit(cleanName, finalPhone, consent);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div
      id="customer-form-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div
        id="customer-form-modal-card"
        className="relative w-full max-w-md bg-gradient-to-b from-[#2B0A0A] via-[#1F0707] to-[#120303] border border-[#F5A623]/40 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-[#FFF8E7]"
      >
        {/* Close button */}
        <button
          id="modal-close-button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-[#F5D77F]/70 hover:text-[#FFF8E7] transition-colors p-1"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#7B1A1A] to-[#D48806] border border-[#F5A623]/60 mb-3 shadow-lg">
            <Sparkles className="w-7 h-7 text-[#FFF8E7]" />
          </div>
          <h2 className="text-2xl font-bold font-['Poppins'] text-[#F5D77F] tracking-wide">
            Akshay Footwear Diwali Dhamaka
          </h2>
          <p className="text-sm text-[#F5D77F]/80 mt-1">
            Register your WhatsApp number to unlock your free spin!
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-500/50 flex items-start gap-2.5 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#F5D77F]/90 mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#F5A623]/70">
                <User size={18} />
              </div>
              <input
                id="input-customer-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                disabled={isLoading}
                required
                className="w-full pl-10 pr-4 py-3 bg-[#170505] border border-[#F5A623]/40 rounded-xl text-[#FFF8E7] placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#F5D77F]/90 mb-1.5">
              WhatsApp Mobile Number *
            </label>
            <div className="relative flex">
              <div className="inline-flex items-center px-3 bg-[#1A0505] border border-r-0 border-[#F5A623]/40 rounded-l-xl text-[#F5D77F] font-semibold text-sm">
                🇮🇳 +91
              </div>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#F5A623]/70">
                  <Phone size={16} />
                </div>
                <input
                  id="input-customer-whatsapp"
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="98765 43210"
                  disabled={isLoading}
                  required
                  className="w-full pl-9 pr-4 py-3 bg-[#170505] border border-[#F5A623]/40 rounded-r-xl text-[#FFF8E7] placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              One spin per WhatsApp number. Reward code is sent here.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#F5D77F]/90 leading-relaxed">
              <input
                id="checkbox-marketing-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={isLoading}
                className="mt-0.5 rounded border-[#F5A623] text-[#F5A623] focus:ring-[#F5A623] bg-[#170505] w-4 h-4"
              />
              <span>
                I agree to receive festival offers and reward redemption updates from Akshay Footwear.
              </span>
            </label>
          </div>

          {/* Submit button */}
          <button
            id="button-submit-registration"
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 py-3.5 px-6 rounded-xl font-bold text-base tracking-wide bg-gradient-to-r from-[#F5A623] via-[#FF6B35] to-[#D48806] hover:from-[#FFE082] hover:to-[#F5A623] text-[#2A0505] shadow-[0_4px_20px_rgba(245,166,35,0.5)] transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-[#1A0505] border-t-transparent rounded-full animate-spin"></span>
                <span>Unlocking Your Spin...</span>
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                <span>CONFIRM & SPIN THE WHEEL</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
