import React, { useState, useEffect } from 'react';
import { Sparkles, Gift, Store, ShieldCheck, QrCode, ArrowRight } from 'lucide-react';
import { SpinWheel } from '../components/SpinWheel.js';
import { CustomerFormModal } from '../components/CustomerFormModal.js';
import { PrizeResultModal } from '../components/PrizeResultModal.js';
import { PrintablePoster } from '../components/PrintablePoster.js';
import { api } from '../services/api.js';
import { Prize, SpinResult } from '../types/index.js';

export const LandingPage: React.FC = () => {
  // State
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(true);

  // Spin lifecycle states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetSliceIndex, setTargetSliceIndex] = useState<number | null>(null);
  const [activeSpinResult, setActiveSpinResult] = useState<SpinResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);

  // In-Store Poster
  const [showPoster, setShowPoster] = useState(false);

  // Fetch prizes on load
  useEffect(() => {
    const loadPrizes = async () => {
      try {
        setIsLoadingPrizes(true);
        const res = await api.getPrizes();
        if (res.success && res.prizes.length > 0) {
          setPrizes(res.prizes);
        }
      } catch (err) {
        console.error('Failed to fetch prizes:', err);
      } finally {
        setIsLoadingPrizes(false);
      }
    };
    loadPrizes();
  }, []);

  // When customer clicks "SPIN NOW" on the wheel or CTA
  const handleSpinClick = () => {
    if (isSpinning) return;
    setSpinError(null);
    setIsFormOpen(true);
  };

  // When customer submits registration form
  const handleCustomerSubmit = async (
    name: string,
    whatsappNumber: string,
    consent: boolean
  ) => {
    setIsRegistering(true);
    setSpinError(null);

    try {
      // 1. Register customer
      const regRes = await api.registerCustomer(name, whatsappNumber, consent);

      // If customer already spun in this campaign
      if (regRes.hasSpun && regRes.previousSpin) {
        setIsRegistering(false);
        setIsFormOpen(false);
        setActiveSpinResult(regRes.previousSpin);
        setShowResultModal(true);
        return;
      }

      const customerId = regRes.customer.id;

      // 2. Play spin on the server - saves result into Neon diwali_spins
      const spinRes = await api.playSpin(customerId, { name, whatsappNumber });
      if (!spinRes.success || !spinRes.spin) {
        throw new Error(spinRes.message || 'Failed to initiate spin');
      }

      // Close modal and start the 5-second wheel animation!
      setIsRegistering(false);
      setIsFormOpen(false);

      // CRITICAL FIX FOR THE BUG:
      // Set the targetSliceIndex from the backend and set isSpinning to true together
      setActiveSpinResult(spinRes.spin);
      setTargetSliceIndex(spinRes.spin.sliceIndex);
      setIsSpinning(true);
    } catch (err: any) {
      setIsRegistering(false);
      throw err;
    }
  };

  // Called when the 5-second wheel animation stops
  const handleSpinComplete = () => {
    setIsSpinning(false);
    setShowResultModal(true);
  };

  return (
    <div id="landing-page-content" className="min-h-[calc(100vh-70px)] pb-16">
      {/* Hero Diwali Header */}
      <section className="relative overflow-hidden pt-6 pb-4 sm:py-8 px-4 text-center">
        {/* Background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F5A623]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7B1A1A]/90 border border-[#F5A623]/50 text-xs font-bold tracking-wider text-[#F5D77F] uppercase shadow-lg animate-pulse">
            <Sparkles size={14} className="text-[#FFE082]" />
            <span>EXCLUSIVE IN-STORE DIWALI PROMOTION 🪔</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black font-['Poppins'] tracking-tight text-[#FFE082] drop-shadow-md">
            Spin the Diwali Wheel & Win!
          </h1>

          <p className="text-sm sm:text-base text-[#F5D77F]/90 max-w-xl mx-auto font-medium">
            Celebrate the Festival of Lights with <strong>Akshay Footwear</strong>. Every spin wins an authentic in-store discount or footwear accessory gift!
          </p>
        </div>
      </section>

      {/* Main Wheel Stage */}
      <section className="max-w-4xl mx-auto px-4">
        {spinError && (
          <div className="max-w-md mx-auto mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs text-center">
            {spinError}
          </div>
        )}

        {isLoadingPrizes ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#F5D77F]">
            <div className="w-12 h-12 border-4 border-[#F5A623] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-semibold">Preparing Festive Wheel...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* The Animated Spin Wheel Component */}
            <SpinWheel
              prizes={prizes}
              isSpinning={isSpinning}
              targetSliceIndex={targetSliceIndex}
              onSpinComplete={handleSpinComplete}
              onSpinClick={handleSpinClick}
            />
          </div>
        )}
      </section>

      {/* Available Diwali Prizes Showcase */}
      <section className="max-w-4xl mx-auto px-4 mt-12">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-2xl font-bold font-['Poppins'] text-[#FFE082]">
            What You Can Win Today 🎁
          </h2>
          <p className="text-xs text-[#F5D77F]/70 mt-1">
            Redeemable immediately at the Akshay Footwear billing counter
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-[#240606] border border-[#F5A623]/30 text-center space-y-1 hover:border-[#F5A623] transition-colors shadow-md">
            <div className="text-3xl">🧦</div>
            <div className="font-bold text-xs sm:text-sm text-[#FFF8E7]">Free Socks</div>
            <div className="text-[10px] text-[#F5D77F]/70">Premium Cotton</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240606] border border-[#F5A623]/30 text-center space-y-1 hover:border-[#F5A623] transition-colors shadow-md">
            <div className="text-3xl">💰</div>
            <div className="font-bold text-xs sm:text-sm text-[#FFF8E7]">10% OFF</div>
            <div className="text-[10px] text-[#F5D77F]/70">On Any Footwear</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240606] border border-[#F5A623]/30 text-center space-y-1 hover:border-[#F5A623] transition-colors shadow-md">
            <div className="text-3xl">👔</div>
            <div className="font-bold text-xs sm:text-sm text-[#FFF8E7]">Free Belt</div>
            <div className="text-[10px] text-[#F5D77F]/70">Genuine Quality</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240606] border border-[#F5A623]/30 text-center space-y-1 hover:border-[#F5A623] transition-colors shadow-md">
            <div className="text-3xl">🎉</div>
            <div className="font-bold text-xs sm:text-sm text-[#FFF8E7]">15% OFF</div>
            <div className="text-[10px] text-[#F5D77F]/70">Mega Diwali Bill OFF</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#240606] border border-[#F5A623]/30 text-center space-y-1 hover:border-[#F5A623] transition-colors shadow-md col-span-2 sm:col-span-1">
            <div className="text-3xl">😄</div>
            <div className="font-bold text-xs sm:text-sm text-[#FFF8E7]">Diwali Cheer</div>
            <div className="text-[10px] text-[#F5D77F]/70">Special In-Store Deals</div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="max-w-4xl mx-auto px-4 mt-12">
        <div className="bg-[#240606]/90 border border-[#F5A623]/30 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F5A623]">
              Simple 3-Step Process
            </span>
            <h3 className="text-xl font-bold font-['Poppins'] text-[#FFE082] mt-1">
              How to Claim Your Diwali Prize
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-[#7B1A1A] border border-[#F5A623] flex items-center justify-center font-bold text-xs text-[#FFE082] shrink-0 mt-0.5">
                1
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#FFF8E7]">Register & Spin</h4>
                <p className="text-xs text-[#F5D77F]/80 mt-1 leading-relaxed">
                  Enter your name and WhatsApp number. Press the big button and watch the Diwali wheel spin.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-[#7B1A1A] border border-[#F5A623] flex items-center justify-center font-bold text-xs text-[#FFE082] shrink-0 mt-0.5">
                2
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#FFF8E7]">Get Reward Code</h4>
                <p className="text-xs text-[#F5D77F]/80 mt-1 leading-relaxed">
                  The wheel stops at your prize! A unique, tamper-proof reward voucher code is generated on your screen.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-full bg-[#7B1A1A] border border-[#F5A623] flex items-center justify-center font-bold text-xs text-[#FFE082] shrink-0 mt-0.5">
                3
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#FFF8E7]">Show to Cashier</h4>
                <p className="text-xs text-[#F5D77F]/80 mt-1 leading-relaxed">
                  Show your mobile screen to our cashier desk at Akshay Footwear to claim your instant discount or gift.
                </p>
              </div>
            </div>
          </div>

          {/* Store Staff Poster Link */}
          <div className="mt-8 pt-6 border-t border-[#F5A623]/20 flex flex-wrap items-center justify-between gap-4 text-xs text-[#F5D77F]/80">
            <div className="flex items-center gap-2">
              <Store size={16} className="text-[#F5A623]" />
              <span>Are you Akshay Footwear store staff?</span>
            </div>
            <button
              onClick={() => setShowPoster(true)}
              className="px-3 py-1.5 rounded-lg bg-[#3A0C0C] hover:bg-[#4E1010] text-[#FFE082] border border-[#F5A623]/40 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <QrCode size={14} />
              <span>View / Print In-Store QR Poster</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modals */}
      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCustomerSubmit}
        isLoading={isRegistering}
      />

      <PrizeResultModal
        isOpen={showResultModal}
        spinResult={activeSpinResult}
        onClose={() => setShowResultModal(false)}
      />

      <PrintablePoster
        isOpen={showPoster}
        onClose={() => setShowPoster(false)}
      />
    </div>
  );
};
