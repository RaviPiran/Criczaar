import React from 'react';

const R    = 34;
const CIRC = 2 * Math.PI * R;

export default function TimerRing({ seconds, maxSeconds, size = 80 }) {
  const pct    = Math.max(0, seconds / maxSeconds);
  const offset = CIRC * (1 - pct);
  const color  = seconds <= 5 ? '#ef4444' : seconds <= 10 ? '#f97316' : '#f59e0b';
  const urgent = seconds <= 5;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={R} fill="none" stroke="#f3f4f6" strokeWidth="6" />
        <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }} />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-orbitron font-bold text-xl
        ${urgent ? 'animate-pulse-slow' : ''}`}
        style={{ color }}>
        {seconds}
      </div>
    </div>
  );
}
