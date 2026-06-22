/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        navy: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a8a',
          900: '#0f172a',
        },
      },
      fontFamily: {
        display:  ['"Bebas Neue"',  'sans-serif'],
        orbitron: ['"Orbitron"',    'sans-serif'],
        raj:      ['"Rajdhani"',    'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease both',
        'slide-up':   'slideUp 0.4s cubic-bezier(.34,1.56,.64,1) both',
        'pop':        'pop 0.35s cubic-bezier(.34,1.56,.64,1) both',
        'pulse-slow': 'pulse 2s infinite',
        'swing':      'swing 0.6s ease-in-out infinite alternate',
        'slide-right':'slideRight 0.3s cubic-bezier(.34,1.56,.64,1)',
      },
      keyframes: {
        fadeIn:     { from:{opacity:0},                                to:{opacity:1} },
        slideUp:    { from:{opacity:0,transform:'translateY(24px)'},   to:{opacity:1,transform:'translateY(0)'} },
        pop:        { from:{opacity:0,transform:'scale(.4) rotate(-8deg)'}, to:{opacity:1,transform:'scale(1) rotate(0)'} },
        swing:      { from:{transform:'rotate(-28deg)'},               to:{transform:'rotate(28deg)'} },
        slideRight: { from:{transform:'translateX(120%)',opacity:0},   to:{transform:'translateX(0)',opacity:1} },
      },
    },
  },
  plugins: [],
};
