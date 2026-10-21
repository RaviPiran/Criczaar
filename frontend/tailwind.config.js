/** @type {import('tailwindcss').Config} */

// ── CricZaar design tokens ─────────────────────────────────────────────
// Primary   #F59E0B (amber)   Secondary #6366F1 (indigo)
// Tertiary  #38BDF8 (sky)     Neutral   #0A0F1D (ink)
// Fonts: Outfit (headline) · Inter (body) · JetBrains Mono (label)

const amber = {
  50:  'rgba(245,158,11,0.10)',
  100: 'rgba(245,158,11,0.16)',
  200: 'rgba(245,158,11,0.28)',
  300: 'rgba(245,158,11,0.45)',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#FBBF24',
  800: '#FCD34D',
  900: '#FDE68A',
};

const indigo = {
  50:  'rgba(99,102,241,0.12)',
  100: 'rgba(99,102,241,0.18)',
  200: 'rgba(99,102,241,0.30)',
  300: '#A5B4FC',
  400: '#818CF8',
  500: '#6366F1',
  600: '#818CF8',
  700: '#A5B4FC',
  800: '#C7D2FE',
  900: '#E0E7FF',
};

const sky = {
  50:  'rgba(56,189,248,0.10)',
  100: 'rgba(56,189,248,0.16)',
  200: 'rgba(56,189,248,0.28)',
  300: '#7DD3FC',
  400: '#38BDF8',
  500: '#38BDF8',
  600: '#38BDF8',
  700: '#7DD3FC',
  800: '#BAE6FD',
  900: '#E0F2FE',
};

const danger = {
  50:  'rgba(248,113,113,0.10)',
  100: 'rgba(248,113,113,0.16)',
  200: 'rgba(248,113,113,0.28)',
  300: 'rgba(248,113,113,0.45)',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
  700: '#FCA5A5',
  800: '#FECACA',
  900: '#FEE2E2',
};

const success = {
  50:  'rgba(16,185,129,0.10)',
  100: 'rgba(16,185,129,0.16)',
  200: 'rgba(16,185,129,0.28)',
  300: 'rgba(16,185,129,0.45)',
  400: '#34D399',
  500: '#10B981',
  600: '#10B981',
  700: '#34D399',
  800: '#6EE7B7',
  900: '#A7F3D0',
};

const orange = {
  50:  'rgba(251,146,60,0.10)',
  100: 'rgba(251,146,60,0.16)',
  200: 'rgba(251,146,60,0.28)',
  300: 'rgba(251,146,60,0.45)',
  400: '#FB923C',
  500: '#F97316',
  600: '#FB923C',
  700: '#FDBA74',
};

// Neutral ramp — INVERTED so every existing light-theme class
// (bg-slate-50, text-slate-800 …) automatically becomes dark-theme.
const ink = {
  50:  '#0F1629',
  100: '#131A2E',
  200: '#222B45',
  300: '#2E3A5C',
  400: '#8591B0',
  500: '#9AA5C2',
  600: '#B6BFD8',
  700: '#CDD4E8',
  800: '#E3E8F6',
  900: '#EEF1FA',
};

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand:  { ...amber, 50: '#FFFBEB', 100: '#FEF3C7' },
        navy:   { 50: '#EEF1FA', 100: '#E3E8F6', 400: '#6366F1', 500: '#6366F1',
                  600: '#4F46E5', 700: '#4338CA', 800: '#151B2D', 900: '#0A0F1D' },
        ink:    { ...ink, 950: '#0A0F1D' },
        surface:{ DEFAULT: '#121829', raised: '#171E33', line: '#222B45' },
        primary:   amber,
        secondary: indigo,
        tertiary:  sky,
        amber, yellow: amber, indigo, blue: indigo,
        cyan: sky, sky, teal: sky,
        red: danger, rose: danger,
        emerald: success, green: success,
        orange,
        slate: ink,
        gray:  ink,
        zinc:  ink,
      },
      fontFamily: {
        // new semantic names
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        inter:  ['Inter', 'system-ui', 'sans-serif'],
        mono:   ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // legacy names kept so every page picks up the new fonts untouched
        display:  ['Outfit', 'system-ui', 'sans-serif'],
        orbitron: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        raj:      ['Inter', 'system-ui', 'sans-serif'],
        sans:     ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow:     '0 0 28px rgba(245,158,11,0.35)',
        'glow-sm':'0 0 14px rgba(245,158,11,0.30)',
        'glow-indigo': '0 0 28px rgba(99,102,241,0.35)',
        'glow-sky':    '0 0 28px rgba(56,189,248,0.30)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease both',
        'slide-up':   'slideUp 0.55s cubic-bezier(.22,1,.36,1) both',
        'pop':        'pop 0.4s cubic-bezier(.34,1.56,.64,1) both',
        'pulse-slow': 'pulse 2s infinite',
        'swing':      'swing 0.6s ease-in-out infinite alternate',
        'slide-right':'slideRight 0.35s cubic-bezier(.22,1,.36,1)',
        'rise':       'rise 0.55s cubic-bezier(.22,1,.36,1) both',
        'float':      'float 6s ease-in-out infinite',
        'drift':      'drift 18s ease-in-out infinite alternate',
        'shimmer':    'shimmer 2.8s linear infinite',
        'glow-pulse': 'glowPulse 2.4s ease-in-out infinite',
        'ping-slow':  'pingSlow 2s cubic-bezier(0,0,.2,1) infinite',
        'gradient-x': 'gradientX 6s ease infinite',
      },
      keyframes: {
        fadeIn:     { from:{opacity:0},                                to:{opacity:1} },
        slideUp:    { from:{opacity:0,transform:'translateY(28px)'},   to:{opacity:1,transform:'translateY(0)'} },
        pop:        { from:{opacity:0,transform:'scale(.5) rotate(-6deg)'}, to:{opacity:1,transform:'scale(1) rotate(0)'} },
        swing:      { from:{transform:'rotate(-28deg)'},               to:{transform:'rotate(28deg)'} },
        slideRight: { from:{transform:'translateX(120%)',opacity:0},   to:{transform:'translateX(0)',opacity:1} },
        rise:       { from:{opacity:0,transform:'translateY(18px) scale(.985)'}, to:{opacity:1,transform:'translateY(0) scale(1)'} },
        float:      { '0%,100%':{transform:'translateY(0)'}, '50%':{transform:'translateY(-12px)'} },
        drift:      { from:{transform:'translate(0,0) scale(1)'}, to:{transform:'translate(60px,40px) scale(1.15)'} },
        shimmer:    { from:{backgroundPosition:'200% 0'}, to:{backgroundPosition:'-200% 0'} },
        glowPulse:  { '0%,100%':{boxShadow:'0 0 0 0 rgba(245,158,11,0.45)'}, '50%':{boxShadow:'0 0 0 10px rgba(245,158,11,0)'} },
        pingSlow:   { '75%,100%':{transform:'scale(2.2)',opacity:0} },
        gradientX:  { '0%,100%':{backgroundPosition:'0% 50%'}, '50%':{backgroundPosition:'100% 50%'} },

          // Number pops when the bid / budget changes
          'bid-pop': {
            '0%':   { transform: 'scale(1)' },
            '40%':  { transform: 'scale(1.25)', textShadow: '0 0 24px rgba(245,158,11,.7)' },
            '100%': { transform: 'scale(1)' },
          },
          // Cards / panels / modal content entering
          'slide-up': {
            '0%':   { opacity: '0', transform: 'translateY(24px) scale(.97)' },
            '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          },
          // Log rows, hints, list items
          'slide-in-left': {
            '0%':   { opacity: '0', transform: 'translateX(-16px)' },
            '100%': { opacity: '1', transform: 'translateX(0)' },
          },
          // Right sidebar on page load
          'slide-in-right': {
            '0%':   { opacity: '0', transform: 'translateX(32px)' },
            '100%': { opacity: '1', transform: 'translateX(0)' },
          },
          // Timer ring in the last 5 seconds
          'shake': {
            '0%,100%': { transform: 'translateX(0)' },
            '20%,60%': { transform: 'translateX(-4px)' },
            '40%,80%': { transform: 'translateX(4px)' },
          },
          // Bid panel red pulse in the last 5 seconds
          'danger-pulse': {
            '0%,100%': { boxShadow: '0 0 0 0 rgba(248,113,113,0)' },
            '50%':     { boxShadow: '0 0 0 8px rgba(248,113,113,.35)' },
          },
          // Leading team card glow
          'lead-glow': {
            '0%,100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
            '50%':     { boxShadow: '0 0 22px 2px rgba(16,185,129,.35)' },
          },
          // Wheel pointer ticking while spinning
          'wobble': {
            '0%,100%': { transform: 'translateX(-50%) rotate(0deg)' },
            '25%':     { transform: 'translateX(-50%) rotate(-14deg)' },
            '75%':     { transform: 'translateX(-50%) rotate(14deg)' },
          },
          // Winner / badge reveal with overshoot
          'reveal': {
            '0%':   { opacity: '0', transform: 'scale(.6) translateY(10px)' },
            '60%':  { opacity: '1', transform: 'scale(1.12)' },
            '100%': { transform: 'scale(1)' },
          },
          // Light sweep across the leading team's bid button
          'shine': {
            '0%':   { transform: 'translateX(-120%)' },
            '100%': { transform: 'translateX(300%)' },
          },
          // Gentle attention pulse (SPIN button, hints)
          'pulse-soft': {
            '0%,100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(245,158,11,.0)' },
            '50%':     { transform: 'scale(1.04)', boxShadow: '0 0 0 10px rgba(245,158,11,.25)' },
          },
          // Tiny settle bounce when the wheel stops
          'wheel-land': {
            '0%':   { filter: 'brightness(1)' },
            '40%':  { filter: 'brightness(1.25)' },
            '100%': { filter: 'brightness(1)' },
          },
      },
      animation: {
        'bid-pop':        'bid-pop .45s ease-out',
        'slide-up':       'slide-up .5s cubic-bezier(.22,1,.36,1) both',
        'slide-in-left':  'slide-in-left .35s ease-out both',
        'slide-in-right': 'slide-in-right .6s cubic-bezier(.22,1,.36,1) both',
        'shake':          'shake .4s ease-in-out infinite',
        'danger-pulse':   'danger-pulse 1s ease-in-out infinite',
        'lead-glow':      'lead-glow 1.8s ease-in-out infinite',
        'wobble':         'wobble .12s linear infinite',
        'reveal':         'reveal .55s cubic-bezier(.34,1.56,.64,1) both',
        'shine':          'shine 1.6s ease-in-out infinite',
        'pulse-soft':     'pulse-soft 1.8s ease-in-out infinite',
        'wheel-land':     'wheel-land .6s ease-out',
      },
    },
  },
  plugins: [],
};
