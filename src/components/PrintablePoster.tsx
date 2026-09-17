import React from 'react';
import { Sparkles, Printer, X, Store, Gift } from 'lucide-react';

interface PrintablePosterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintablePoster: React.FC<PrintablePosterProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="printable-poster-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-[#2A0808] border-2 border-[#F5A623] rounded-3xl p-6 sm:p-8 text-[#FFF8E7] shadow-2xl">
        <div className="flex justify-between items-center mb-4 no-print">
          <span className="text-xs font-bold uppercase tracking-wider text-[#F5D77F]">
            In-Store Promotional Poster (A4 Printable)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#F5A623] text-[#1A0505] font-bold text-xs flex items-center gap-1 hover:bg-[#FFE082]"
            >
              <Printer size={14} />
              <span>Print Poster</span>
            </button>
            <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Poster Area */}
        <div className="bg-gradient-to-b from-[#4A0D0D] via-[#2F0808] to-[#1A0404] border-4 border-[#F5A623] p-6 rounded-2xl text-center space-y-4 shadow-inner">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7B1A1A] border border-[#F5A623] text-xs font-bold text-[#FFE082] uppercase">
            <Store size={14} />
            <span>AKSHAY FOOTWEAR</span>
          </div>

          <div className="text-3xl sm:text-4xl font-black font-['Poppins'] text-[#FFE082] tracking-wide leading-tight">
            DIWALI DHAMAKA! 🪔
          </div>

          <div className="text-base sm:text-lg font-bold text-[#FFF8E7]">
            SPIN THE WHEEL & WIN INSTANT PRIZES!
          </div>

          {/* Prizes list banner */}
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold py-2 bg-[#1A0404]/60 rounded-xl border border-[#F5A623]/30 text-[#FFE082]">
            <div className="p-1.5">🧦 Free Premium Socks</div>
            <div className="p-1.5">💰 10% Flat Bill OFF</div>
            <div className="p-1.5">👔 Free Genuine Leather Belt</div>
            <div className="p-1.5">🎉 15% Flat Bill OFF</div>
          </div>

          {/* Simulated High-Res QR Code */}
          <div className="inline-block p-4 bg-white rounded-2xl shadow-xl mx-auto border-2 border-[#F5A623]">
            {/* SVG QR Code pattern */}
            <svg
              className="w-40 h-40"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="100" height="100" fill="white" />
              {/* Corner squares */}
              <rect x="10" y="10" width="24" height="24" fill="#7B1A1A" />
              <rect x="14" y="14" width="16" height="16" fill="white" />
              <rect x="18" y="18" width="8" height="8" fill="#7B1A1A" />

              <rect x="66" y="10" width="24" height="24" fill="#7B1A1A" />
              <rect x="70" y="14" width="16" height="16" fill="white" />
              <rect x="74" y="18" width="8" height="8" fill="#7B1A1A" />

              <rect x="10" y="66" width="24" height="24" fill="#7B1A1A" />
              <rect x="14" y="70" width="16" height="16" fill="white" />
              <rect x="18" y="74" width="8" height="8" fill="#7B1A1A" />

              {/* Data dots */}
              <rect x="40" y="12" width="6" height="6" fill="#7B1A1A" />
              <rect x="50" y="16" width="8" height="8" fill="#F5A623" />
              <rect x="42" y="30" width="16" height="16" fill="#7B1A1A" />
              <rect x="46" y="34" width="8" height="8" fill="#FFF8E7" />
              <rect x="12" y="44" width="8" height="8" fill="#F5A623" />
              <rect x="24" y="42" width="6" height="6" fill="#7B1A1A" />
              <rect x="66" y="44" width="8" height="8" fill="#7B1A1A" />
              <rect x="78" y="40" width="10" height="6" fill="#F5A623" />
              <rect x="40" y="66" width="8" height="8" fill="#7B1A1A" />
              <rect x="54" y="70" width="10" height="8" fill="#F5A623" />
              <rect x="68" y="66" width="20" height="6" fill="#7B1A1A" />
              <rect x="72" y="78" width="16" height="10" fill="#7B1A1A" />
              <rect x="40" y="82" width="8" height="8" fill="#F5A623" />
            </svg>
            <div className="text-[10px] font-bold text-[#7B1A1A] mt-1 font-mono tracking-wider">
              SCAN WITH ANY PHONE CAMERA
            </div>
          </div>

          <div className="text-xs text-[#F5D77F]/90 font-medium">
            1. Scan QR Code with Phone • 2. Register WhatsApp • 3. Spin & Win
            <br />
            <strong>Show winning screen to Cashier at billing counter to redeem!</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
