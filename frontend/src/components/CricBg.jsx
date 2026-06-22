import React from 'react';

/**
 * CricBg — wraps any page with the cricket stadium background.
 * Renders:
 *  1. A gradient base (red+blue tinted light slate)
 *  2. SVG cricket pitch overlay
 *  3. Diagonal lines texture
 *  4. Scattered cricket emoji blobs
 *  5. Children on top (z-index 1)
 */
export default function CricBg({ children, className = '' }) {
  return (
    <div className={`relative min-h-full ${className}`}
      style={{
        background: 'linear-gradient(160deg,#dde5f4 0%,#e8ecf7 40%,#dde8f5 70%,#e6ddf4 100%)',
      }}>

      {/* Cricket pitch SVG — centred, faint */}
      <div className="pitch-overlay" aria-hidden="true"/>

      {/* Diagonal lines texture */}
      <div className="lines-overlay" aria-hidden="true"/>

      {/* Red glow — top left */}
      <div aria-hidden="true" style={{
        position:'fixed', top:'-80px', left:'-80px',
        width:380, height:380, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(220,38,38,0.10) 0%,transparent 70%)',
        pointerEvents:'none', zIndex:0,
      }}/>

      {/* Blue glow — bottom right */}
      <div aria-hidden="true" style={{
        position:'fixed', bottom:'-80px', right:'-80px',
        width:420, height:420, borderRadius:'50%',
        background:'radial-gradient(circle,rgba(29,78,216,0.10) 0%,transparent 70%)',
        pointerEvents:'none', zIndex:0,
      }}/>

      {/* Floating cricket emojis — decorative, fixed */}
      {[
        { emoji:'🏏', top:'8%',  left:'3%',  size:28, opacity:0.12, rotate:-20 },
        { emoji:'🏟', top:'18%', right:'4%', size:32, opacity:0.09, rotate:10 },
        { emoji:'🎯', top:'55%', left:'2%',  size:24, opacity:0.10, rotate:0  },
        { emoji:'🏆', top:'72%', right:'3%', size:28, opacity:0.10, rotate:15 },
        { emoji:'🏏', top:'85%', left:'6%',  size:22, opacity:0.08, rotate:35 },
        { emoji:'⚡', top:'40%', right:'2%', size:20, opacity:0.09, rotate:-10},
      ].map((d, i) => (
        <div key={i} aria-hidden="true" style={{
          position:'fixed',
          top:    d.top    || 'auto',
          bottom: d.bottom || 'auto',
          left:   d.left   || 'auto',
          right:  d.right  || 'auto',
          fontSize: d.size,
          opacity:  d.opacity,
          transform:`rotate(${d.rotate}deg)`,
          pointerEvents:'none',
          zIndex: 0,
          userSelect:'none',
          lineHeight:1,
        }}>{d.emoji}</div>
      ))}

      {/* Page content */}
      <div style={{position:'relative', zIndex:1}}>
        {children}
      </div>
    </div>
  );
}
