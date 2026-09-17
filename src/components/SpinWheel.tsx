import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Prize } from '../types/index.js';
import { playTickSound } from '../utils/audio.js';

interface SpinWheelProps {
  prizes: Prize[];
  isSpinning: boolean;
  targetSliceIndex: number | null;
  onSpinComplete: () => void;
  onSpinClick: () => void;
  disabled?: boolean;
}

const SLICE_COLORS = [
  { bg: '#7B1A1A', text: '#F5D77F', border: '#D4AF37' }, // Deep Maroon
  { bg: '#9A2424', text: '#FFF8E7', border: '#D4AF37' }, // Rich Ruby
  { bg: '#D48806', text: '#3E0D0D', border: '#F5D77F' }, // Warm Saffron Gold
  { bg: '#8B1E1E', text: '#F5D77F', border: '#D4AF37' }, // Royal Wine
  { bg: '#5A1010', text: '#FFF8E7', border: '#D4AF37' }, // Deep Velvet
];

const EMOJI_MAP: Record<string, string> = {
  'Free Socks': '🧦',
  '10% OFF': '💰',
  'Free Belt': '👔',
  '15% OFF': '🎉',
  'Better Luck Next Time': '😄',
};

export const SpinWheel: React.FC<SpinWheelProps> = ({
  prizes,
  isSpinning,
  targetSliceIndex,
  onSpinComplete,
  onSpinClick,
  disabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Rotation state in radians
  const currentRotationRef = useRef<number>(0);
  const lastPegRef = useRef<number>(-1);

  // Ease-out Quartic for smooth realistic spin friction
  const easeOutQuart = (x: number): number => {
    return 1 - Math.pow(1 - x, 4);
  };

  // Draw the entire wheel at rotation angle
  const drawWheel = useCallback(
    (rotation: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = canvas.width;
      const center = size / 2;
      const radius = center - 24; // Margin for pointer and outer rim

      ctx.clearRect(0, 0, size, size);

      if (prizes.length === 0) return;

      const numSlices = prizes.length;
      const sliceAngle = (2 * Math.PI) / numSlices;

      // 1. Outer rim shadow & glow
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius + 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#4A0C0C';
      ctx.shadowColor = 'rgba(245, 166, 35, 0.45)';
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.restore();

      // 2. Outer decorative golden rim
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius + 10, 0, 2 * Math.PI);
      const rimGrad = ctx.createLinearGradient(0, 0, size, size);
      rimGrad.addColorStop(0, '#FFE082');
      rimGrad.addColorStop(0.3, '#F5A623');
      rimGrad.addColorStop(0.7, '#D48806');
      rimGrad.addColorStop(1, '#B7791F');
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = 14;
      ctx.stroke();

      // Draw perimeter studs/lights
      const numStuds = numSlices * 4;
      for (let i = 0; i < numStuds; i++) {
        const angle = (i * (2 * Math.PI)) / numStuds;
        const studX = center + (radius + 10) * Math.cos(angle);
        const studY = center + (radius + 10) * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(studX, studY, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = i % 2 === 0 ? '#FFF8E7' : '#F5A623';
        ctx.shadowColor = '#F5A623';
        ctx.shadowBlur = 4;
        ctx.fill();
      }
      ctx.restore();

      // 3. Wheel slices
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(rotation);

      for (let i = 0; i < numSlices; i++) {
        const prize = prizes[i];
        const startAngle = i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const color = SLICE_COLORS[i % SLICE_COLORS.length];

        // Slice wedge
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = color.bg;
        ctx.fill();

        ctx.strokeStyle = color.border;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner subtle gradient overlay for depth
        const sliceGrad = ctx.createRadialGradient(0, 0, 30, 0, 0, radius);
        sliceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        sliceGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.1)');
        sliceGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = sliceGrad;
        ctx.fill();

        // Text and Icon
        ctx.save();
        const midAngle = startAngle + sliceAngle / 2;
        ctx.rotate(midAngle);

        // Emoji Icon
        const emoji = EMOJI_MAP[prize.name] || '🎁';
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, radius * 0.76, 0);

        // Prize Name text
        ctx.fillStyle = color.text;
        ctx.font = 'bold 15px Poppins, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Truncate or wrap if long
        const name = prize.name;
        if (name.length > 15) {
          const parts = name.split(' ');
          const line1 = parts.slice(0, 2).join(' ');
          const line2 = parts.slice(2).join(' ');
          ctx.fillText(line1, radius * 0.46, -9);
          ctx.font = 'bold 13px Poppins, sans-serif';
          ctx.fillText(line2, radius * 0.46, 10);
        } else {
          ctx.fillText(name, radius * 0.46, 0);
        }

        ctx.restore();
      }

      // Outer boundary pins
      for (let i = 0; i < numSlices; i++) {
        const pinAngle = i * sliceAngle;
        const pinX = radius * Math.cos(pinAngle);
        const pinY = radius * Math.sin(pinAngle);

        ctx.beginPath();
        ctx.arc(pinX, pinY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFF8E7';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.strokeStyle = '#B7791F';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();

      // 4. Center Diya Hub (Golden Diwali Emblem)
      ctx.save();
      ctx.translate(center, center);

      // Hub outer shadow
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, 2 * Math.PI);
      ctx.fillStyle = '#3A0808';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 10;
      ctx.fill();

      // Golden ring
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, 2 * Math.PI);
      const hubGrad = ctx.createLinearGradient(-30, -30, 30, 30);
      hubGrad.addColorStop(0, '#FFE082');
      hubGrad.addColorStop(0.5, '#F5A623');
      hubGrad.addColorStop(1, '#8B5704');
      ctx.fillStyle = hubGrad;
      ctx.fill();

      // Inner jewel circle
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, 2 * Math.PI);
      ctx.fillStyle = '#7B1A1A';
      ctx.fill();
      ctx.strokeStyle = '#FFE082';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Diwali Diya Icon in center
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪔', 0, 2);

      ctx.restore();

      // 5. Fixed Top Pointer (at 12 o'clock / -90 degrees)
      ctx.save();
      const pointerTopY = 4;
      const pointerHeight = 32;
      const pointerWidth = 22;

      ctx.beginPath();
      ctx.moveTo(center, pointerTopY + pointerHeight); // Tip pointing down into wheel
      ctx.lineTo(center - pointerWidth / 2, pointerTopY);
      ctx.lineTo(center + pointerWidth / 2, pointerTopY);
      ctx.closePath();

      // Pointer gradient
      const pointerGrad = ctx.createLinearGradient(center - 10, 0, center + 10, pointerHeight);
      pointerGrad.addColorStop(0, '#FFF3C4');
      pointerGrad.addColorStop(0.5, '#F5A623');
      pointerGrad.addColorStop(1, '#B7791F');
      ctx.fillStyle = pointerGrad;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fill();

      ctx.strokeStyle = '#3A0808';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pointer center gem
      ctx.beginPath();
      ctx.arc(center, pointerTopY + 8, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#7B1A1A';
      ctx.fill();

      ctx.restore();
    },
    [prizes]
  );

  // Render initial wheel
  useEffect(() => {
    drawWheel(currentRotationRef.current);
  }, [drawWheel]);

  // Handle animation trigger when isSpinning === true and targetSliceIndex is provided
  useEffect(() => {
    if (!isSpinning || targetSliceIndex === null || prizes.length === 0) {
      return;
    }

    const duration = 5000; // Exactly 5 seconds as specified
    const startTime = performance.now();
    const startAngle = currentRotationRef.current % (2 * Math.PI);

    const numSlices = prizes.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    // Pointer is at TOP (3 * Math.PI / 2 or 270 degrees in canvas space).
    // Slice i occupies [i * sliceAngle, (i + 1) * sliceAngle].
    // Center of slice i is at (i + 0.5) * sliceAngle.
    // When wheel rotates by R clockwise, angle θ moves to (θ + R) mod 2π.
    // We want (centerOfSlice + R) % 2π == 3π/2.
    // => R = 3π/2 - centerOfSlice.
    const sliceCenterAngle = (targetSliceIndex + 0.5) * sliceAngle;
    let targetAngleMod = (3 * Math.PI) / 2 - sliceCenterAngle;
    // Normalize targetAngleMod to [0, 2π)
    targetAngleMod = ((targetAngleMod % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    // Calculate delta to reach that angle from startAngle
    let delta = targetAngleMod - (startAngle % (2 * Math.PI));
    if (delta < 0) {
      delta += 2 * Math.PI;
    }

    // Add 6 complete dramatic 360-degree revolutions
    const totalRotation = 6 * (2 * Math.PI) + delta;
    const endRotation = startAngle + totalRotation;

    let hasCompleted = false;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const newRotation = startAngle + totalRotation * easedProgress;
      currentRotationRef.current = newRotation;

      // Audio tick calculation: track slice boundaries crossing pointer
      const currentSliceInPointer = Math.floor(
        ((((3 * Math.PI) / 2 - (newRotation % (2 * Math.PI))) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) /
          sliceAngle
      );

      if (currentSliceInPointer !== lastPegRef.current) {
        lastPegRef.current = currentSliceInPointer;
        playTickSound();
      }

      drawWheel(newRotation);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (!hasCompleted) {
        hasCompleted = true;
        currentRotationRef.current = endRotation;
        drawWheel(endRotation);
        // Spin finished: notify parent
        onSpinComplete();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpinning, targetSliceIndex, prizes, drawWheel, onSpinComplete]);

  return (
    <div id="wheel-container" className="flex flex-col items-center justify-center relative select-none">
      {/* Canvas Spin Wheel */}
      <div className="relative p-2 rounded-full bg-gradient-to-b from-[#3A0808]/80 to-[#1A0505]/90 shadow-[0_12px_40px_rgba(0,0,0,0.8)] border border-[#F5A623]/30">
        <canvas
          id="spin-wheel-canvas"
          ref={canvasRef}
          width={380}
          height={380}
          className="max-w-[340px] sm:max-w-[380px] w-full h-auto cursor-pointer transition-transform duration-300"
          onClick={() => {
            if (!isSpinning && !disabled) {
              onSpinClick();
            }
          }}
        />
      </div>

      {/* Primary Spin Action Button */}
      <div className="mt-6 w-full max-w-xs">
        <button
          id="spin-action-button"
          onClick={onSpinClick}
          disabled={isSpinning || disabled}
          className={`w-full py-4 px-8 rounded-full font-bold text-lg tracking-wider uppercase transition-all duration-300 shadow-xl flex items-center justify-center gap-2 ${
            isSpinning
              ? 'bg-gradient-to-r from-[#D48806] to-[#B7791F] text-[#1A0505] cursor-not-allowed opacity-90 animate-pulse'
              : disabled
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              : 'bg-gradient-to-r from-[#F5A623] via-[#FF6B35] to-[#D48806] hover:from-[#FFE082] hover:to-[#F5A623] text-[#2A0505] shadow-[0_0_25px_rgba(245,166,35,0.6)] hover:shadow-[0_0_35px_rgba(245,166,35,0.8)] hover:scale-105 active:scale-95 border border-[#FFE082]'
          }`}
        >
          {isSpinning ? (
            <>
              <span className="inline-block animate-spin text-xl">✨</span>
              <span>Spinning Diwali Wheel...</span>
            </>
          ) : (
            <>
              <span className="text-xl">🪔</span>
              <span>SPIN TO WIN</span>
              <span className="text-xl">🎡</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
