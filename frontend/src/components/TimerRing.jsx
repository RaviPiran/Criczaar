import React from 'react';

const R    = 34;
const CIRC = 2 * Math.PI * R;

export default function TimerRing({ seconds, maxSeconds, size = 88 }) {
  const pct    = Math.max(0, seconds / maxSeconds);
  const offset = CIRC * (1 - pct);
  const color  = seconds <= 5 ? '#F87171' : seconds <= 10 ? '#FB923C' : '#F59E0B';
  const urgent = seconds <= 5;

  return (
    <div className={`relative flex-shrink-0 ${urgent ? 'timer-urgent' : ''}`} style={{ width: size, height: size }}>
      {/* soft glow behind the ring */}
      <div className="absolute inset-1 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`, transition: 'background .3s' }} />
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s', filter: `drop-shadow(0 0 5px ${color})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-bold leading-none"
        style={{ color }}>
        <span key={seconds} className="text-2xl tick-pop">{seconds}</span>
        <span className="text-[8px] tracking-[0.2em] mt-0.5 opacity-60">SEC</span>
      </div>
    </div>
  );
}