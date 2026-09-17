import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Copy, Check, Store, ShieldCheck, Heart } from 'lucide-react';
import { SpinResult } from '../types/index.js';
import { playWinFanfare, playEncourageSound } from '../utils/audio.js';

interface PrizeResultModalProps {
  isOpen: boolean;
  spinResult: SpinResult | null;
  onClose: () => void;
}

export const PrizeResultModal: React.FC<PrizeResultModalProps> = ({
  isOpen,
  spinResult,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !spinResult) return;

    const isWinner = spinResult.prizeType !== 'NO_REWARD';

    if (isWinner) {
      playWinFanfare();

      // Launch multiple vibrant Diwali confetti bursts
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#F5A623', '#FF6B35', '#FFF8E7', '#7B1A1A', '#00C853'],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#F5A623', '#FF6B35', '#FFF8E7', '#7B1A1A', '#00C853'],
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else {
      playEncourageSound();
    }
  }, [isOpen, spinResult]);

  if (!isOpen || !spinResult) return null;

  const isWinner = spinResult.prizeType !== 'NO_REWARD';

  const handleCopyCode = () => {
    if (!spinResult.rewardCode) return;
    navigator.clipboard.writeText(spinResult.rewardCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="prize-result-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        id="prize-result-card"
        className="relative w-full max-w-lg bg-gradient-to-b from-[#2F0B0B] via-[#200606] to-[#120303] border-2 border-[#F5A623] rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,166,35,0.4)] text-center text-[#FFF8E7] overflow-hidden"
      >
        {/* Decorative Festive Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-transparent via-[#F5A623] to-transparent shadow-[0_0_20px_#F5A623]" />

        {/* Shop Name Badge */}
        <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#7B1A1A]/80 border border-[#F5A623]/50 text-xs font-semibold tracking-wider text-[#F5D77F] uppercase mb-4">
          <Store size={14} />
          <span>AKSHAY FOOTWEAR • DIWALI SPECIAL</span>
        </div>

        {isWinner ? (
          <>
            {/* Header Celebration */}
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-[#F5A623] to-[#FF6B35] shadow-[0_0_25px_rgba(245,166,35,0.7)] text-3xl mb-2 animate-bounce">
                🎉
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-['Poppins'] text-[#FFE082] tracking-wide">
                CONGRATULATIONS!
              </h2>
              <p className="text-sm text-[#F5D77F]/90 mt-1">
                Diwali Lakshmi has smiled upon you! You have won:
              </p>
            </div>

            {/* Prize Won Banner */}
            <div className="my-5 p-5 rounded-2xl bg-gradient-to-r from-[#7B1A1A] via-[#9B2424] to-[#7B1A1A] border-2 border-[#FFE082] shadow-inner">
              <div className="text-xs uppercase tracking-widest text-[#F5D77F] font-bold mb-1">
                Your Diwali Reward
              </div>
              <div className="text-3xl sm:text-4xl font-black text-[#FFF8E7] font-['Poppins'] drop-shadow-md">
                {spinResult.prizeName}
              </div>
              {spinResult.prizeType === 'PRODUCT' && (
                <div className="text-xs font-semibold text-[#FFE082] mt-1">
                  Complimentary Diwali Gift with your footwear purchase!
                </div>
              )}
              {spinResult.prizeType === 'PERCENTAGE_DISCOUNT' && (
                <div className="text-xs font-semibold text-[#FFE082] mt-1">
                  Instant bill discount applied at the cashier counter!
                </div>
              )}
            </div>

            {/* Reward Code Section */}
            {spinResult.rewardCode && (
              <div className="mb-5 p-4 rounded-xl bg-[#140404] border border-[#F5A623]/60 shadow-lg">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#F5D77F]/80 mb-2">
                  Official Verification Reward Code
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span
                    id="reward-code-display"
                    className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-[#F5A623] bg-[#240606] px-4 py-2 rounded-lg border border-[#F5A623]/40 select-all"
                  >
                    {spinResult.rewardCode}
                  </span>
                  <button
                    id="copy-reward-code-button"
                    onClick={handleCopyCode}
                    className="p-3 bg-[#7B1A1A] hover:bg-[#9B2424] text-[#FFE082] border border-[#F5A623]/50 rounded-lg transition-all active:scale-90"
                    title="Copy code"
                  >
                    {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-emerald-400 mt-2 font-medium">
                    ✓ Reward code copied to clipboard!
                  </p>
                )}
              </div>
            )}

            {/* In-Store Claim Instruction */}
            <div className="p-3.5 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/30 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-[#FFE082] mb-6">
              <ShieldCheck className="w-5 h-5 text-[#F5A623] shrink-0" />
              <span>
                👉 <strong>Show this screen to the cashier</strong> to claim your prize!
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Better Luck Next Time */}
            <div className="py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-800 text-3xl mb-3 border border-neutral-700">
                😄
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#FFE082]">
                Better Luck Next Time!
              </h2>
              <p className="text-sm text-neutral-300 mt-2 leading-relaxed max-w-sm mx-auto">
                Thank you for celebrating Diwali with <strong>Akshay Footwear</strong>! Visit our store today to explore exclusive festive shoe collections and seasonal store discounts.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-[#1A0505] border border-[#F5A623]/30 text-xs text-[#F5D77F] flex items-center justify-center gap-1.5">
                <Heart size={14} className="text-red-400" />
                <span>Wishing you and your family a very Happy & Prosperous Diwali! 🪔</span>
              </div>
            </div>
          </>
        )}

        {/* Dismiss Button */}
        <button
          id="close-result-modal-button"
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-xl font-bold text-base bg-gradient-to-r from-[#F5A623] to-[#D48806] hover:from-[#FFE082] hover:to-[#F5A623] text-[#2A0505] shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {isWinner ? 'Got It, Claim In Store' : 'Back to Store Deals'}
        </button>
      </div>
    </div>
  );
};
