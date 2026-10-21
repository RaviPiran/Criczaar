import React from 'react';

/**
 * CricBg — wraps any page with the CricZaar dark stadium background.
 *  1. Ink base (#0A0F1D) with soft amber / indigo / sky tint
 *  2. SVG cricket pitch overlay + diagonal line texture + dot grid
 *  3. Drifting colour orbs (primary / secondary / tertiary)
 *  4. Floating cricket emojis that gently bob
 *  5. Children on top (z-index 1)
 */
export default function CricBg({ children, className = '' }) {
  return (
    <div className={`relative min-h-full ${className}`}
      style={{
        background: 'radial-gradient(1200px 600px at 12% -10%,rgba(245,158,11,0.07),transparent 60%),radial-gradient(900px 600px at 100% 110%,rgba(99,102,241,0.10),transparent 60%),#0A0F1D',
      }}>

      <div className="pitch-overlay" aria-hidden="true"/>
      <div className="lines-overlay" aria-hidden="true"/>
      <div className="dot-grid" aria-hidden="true" style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',opacity:.6}}/>

      {/* Amber orb — top left */}
      <div className="orb" aria-hidden="true" style={{
        top:'-120px', left:'-120px', width:420, height:420,
        background:'radial-gradient(circle,rgba(245,158,11,0.16) 0%,transparent 70%)',
      }}/>
      {/* Indigo orb — bottom right */}
      <div className="orb" aria-hidden="true" style={{
        bottom:'-140px', right:'-120px', width:480, height:480, animationDelay:'-6s',
        background:'radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)',
      }}/>
      {/* Sky orb — middle right */}
      <div className="orb" aria-hidden="true" style={{
        top:'38%', right:'18%', width:300, height:300, animationDelay:'-11s',
        background:'radial-gradient(circle,rgba(56,189,248,0.10) 0%,transparent 70%)',
      }}/>

      {[
        { emoji:'🏏', top:'8%',  left:'3%',  size:28, opacity:0.14, rotate:-20, delay:0 },
        { emoji:'🏟', top:'18%', right:'4%', size:32, opacity:0.10, rotate:10,  delay:-1.5 },
        { emoji:'🎯', top:'55%', left:'2%',  size:24, opacity:0.12, rotate:0,   delay:-3 },
        { emoji:'🏆', top:'72%', right:'3%', size:28, opacity:0.12, rotate:15,  delay:-4.5 },
        { emoji:'🏏', top:'85%', left:'6%',  size:22, opacity:0.10, rotate:35,  delay:-2 },
        { emoji:'⚡', top:'40%', right:'2%', size:20, opacity:0.12, rotate:-10, delay:-5 },
      ].map((d, i) => (
        <div key={i} aria-hidden="true" className="bob" style={{
          position:'fixed',
          top:    d.top    || 'auto',
          bottom: d.bottom || 'auto',
          left:   d.left   || 'auto',
          right:  d.right  || 'auto',
          fontSize: d.size,
          opacity:  d.opacity,
          '--r': `${d.rotate}deg`,
          animationDelay: `${d.delay}s`,
          pointerEvents:'none',
          zIndex: 0,
          userSelect:'none',
          lineHeight:1,
        }}>{d.emoji}</div>
      ))}

      <div style={{position:'relative', zIndex:1}}>
        {children}
      </div>
    </div>
  );
}
