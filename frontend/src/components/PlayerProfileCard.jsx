import React, { useEffect, useRef, useState } from 'react';

/* ── role themes (palette: amber / indigo / sky on ink) ───────────── */
const ROLE_COLORS = {
  'Batsman':       { bg1:'#4F46E5', bg2:'#0A0F1D', accent:'#A5B4FC', badge:'#4F46E5', glow:'99,102,241'  },
  'Bowler':        { bg1:'#D97706', bg2:'#1A0F02', accent:'#FCD34D', badge:'#D97706', glow:'245,158,11'  },
  'All-Rounder':   { bg1:'#0284C7', bg2:'#06182A', accent:'#7DD3FC', badge:'#0284C7', glow:'56,189,248'  },
  'Wicket-Keeper': { bg1:'#7C3AED', bg2:'#0E0A1F', accent:'#C4B5FD', badge:'#7C3AED', glow:'167,139,250' },
};

/* ── keyframes live in this file so no other file needs editing ──── */
const CSS = `
@property --ppc-ang { syntax:'<angle>'; initial-value:0deg; inherits:false; }
@keyframes ppcSpin   { to { --ppc-ang:360deg; } }
@keyframes ppcIn     { from{opacity:0;transform:translateY(26px) scale(.95)} to{opacity:1;transform:none} }
@keyframes ppcWord   { from{transform:translateY(110%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes ppcChip   { from{opacity:0;transform:translateX(-22px)} to{opacity:1;transform:none} }
@keyframes ppcFade   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes ppcPhoto  { from{opacity:0;transform:scale(1.2) translateX(36px)} to{opacity:1;transform:none} }
@keyframes ppcFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes ppcAura   { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
@keyframes ppcSheen  { 0%{transform:translateX(-160%) skewX(-18deg)} 55%,100%{transform:translateX(320%) skewX(-18deg)} }
@keyframes ppcBar    { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@keyframes ppcDot    { 0%{transform:translateY(0) scale(.6);opacity:0} 20%{opacity:.9} 100%{transform:translateY(-190px) scale(1.1);opacity:0} }
@keyframes ppcBadge  { from{opacity:0;transform:scale(.5) rotate(-8deg)} to{opacity:1;transform:none} }
@keyframes ppcPulse  { 0%{box-shadow:0 0 0 0 rgba(var(--ppc-glow),.55)} 100%{box-shadow:0 0 0 10px rgba(var(--ppc-glow),0)} }
.ppc-card::before {
  content:''; position:absolute; inset:0; border-radius:inherit; padding:1.5px; z-index:12; pointer-events:none;
  background:conic-gradient(from var(--ppc-ang), rgba(var(--ppc-glow),.95), rgba(255,255,255,.05) 25%, rgba(var(--ppc-glow),.95) 50%, rgba(255,255,255,.05) 75%, rgba(var(--ppc-glow),.95));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  animation:ppcSpin 7s linear infinite;
}
.ppc-wrap { width: 100% !important; max-width: 100% !important; display: block !important; }
.ppc-card { width: 100% !important; }
@media (prefers-reduced-motion: reduce){
  .ppc-card *, .ppc-card::before, .ppc-wrap { animation-duration:.01ms !important; animation-iteration-count:1 !important; }
}
`;

// counts 0 → target once on mount
function useCountUp(target, duration = 900, resetKey) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const to = Number(target) || 0;
    let raf, t0;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, resetKey]);
  return v;
}

export default function PlayerProfileCard({ player, size = 'large' }) {
  const cardRef = useRef(null);
  const price   = useCountUp(player?.basePrice || 0, 900, player?._id || player?.id || player?.name);

  if (!player || !player.name) return null;

  const c  = ROLE_COLORS[player.role] || ROLE_COLORS['Batsman'];
  const lg = size === 'large';
  const cardHeight = lg ? 420 : 240;

  // subtle 3-D tilt that follows the cursor (large card only)
  const onMove = (e) => {
    if (!lg || !cardRef.current) return;
    const r  = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width  - 0.5;
    const py = (e.clientY - r.top)  / r.height - 0.5;
    cardRef.current.style.transform = `rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  };
  const onLeave = () => { if (cardRef.current) cardRef.current.style.transform = 'rotateY(0) rotateX(0)'; };

  const chips = [
    player.battingStyle && ['BAT', player.battingStyle],
    player.bowlingStyle && player.bowlingStyle !== 'N/A' && ['BOWL', player.bowlingStyle],
  ].filter(Boolean);

  const words = (player.name || '').split(' ');
  const base  = 0.15; // stagger origin (s)

  return (
    // key → whole card re-plays its entrance every time a new player is loaded
    <div key={player._id || player.id || player.name} className="ppc-wrap"
      style={{ perspective: 1200, animation: 'ppcIn .7s cubic-bezier(.22,1,.36,1) backwards', width: '100%' }}>
      <style>{CSS}</style>

      <div ref={cardRef} className="ppc-card" onMouseMove={onMove} onMouseLeave={onLeave}
        style={{
          '--ppc-glow': c.glow,
          position: 'relative', overflow: 'hidden',
          borderRadius: lg ? 24 : 16,
          background: `radial-gradient(120% 90% at 85% 40%, rgba(${c.glow},0.30) 0%, transparent 60%), linear-gradient(150deg, ${c.bg1} 0%, ${c.bg2} 62%)`,
          height: cardHeight, width: '100%',
          fontFamily: "'Inter', sans-serif", userSelect: 'none',
          transition: 'transform .25s ease-out',
          transformStyle: 'preserve-3d',
          boxShadow: lg
            ? `0 24px 70px rgba(0,0,0,0.55), 0 0 50px rgba(${c.glow},0.18)`
            : '0 8px 30px rgba(0,0,0,0.4)',
        }}>

        {/* dark glass overlay so text always reads */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, rgba(10,15,29,0.78) 0%, rgba(10,15,29,0.35) 55%, transparent 100%)', zIndex:1, pointerEvents:'none' }}/>

        {/* dot grid texture */}
        <div style={{ position:'absolute', inset:0, zIndex:1, opacity:.35, pointerEvents:'none',
          backgroundImage:'radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px)', backgroundSize:'18px 18px' }}/>

        {/* shimmering top bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3, zIndex:11,
          background:`linear-gradient(90deg, ${c.accent}, rgba(${c.glow},0.1))`,
          transformOrigin:'left', animation:'ppcBar .9s .1s cubic-bezier(.22,1,.36,1) backwards' }}/>

        {/* pulsing aura behind photo */}
        <div style={{ position:'absolute', right: lg ? -30 : -20, top:'50%', marginTop: lg ? -190 : -120,
          width: lg ? 380 : 240, height: lg ? 380 : 240, borderRadius:'50%', zIndex:1, pointerEvents:'none',
          background:`radial-gradient(circle, rgba(${c.glow},0.55) 0%, transparent 68%)`,
          animation:'ppcAura 3.6s ease-in-out infinite' }}/>

        {/* rising particles */}
        {(lg ? [12, 30, 48, 66, 82] : [20, 55, 80]).map((left, i) => (
          <span key={i} style={{ position:'absolute', bottom:-6, left:`${left}%`, width: lg ? 5 : 3, height: lg ? 5 : 3,
            borderRadius:'50%', background:c.accent, boxShadow:`0 0 10px ${c.accent}`, zIndex:2, pointerEvents:'none',
            animation:`ppcDot ${4 + i * .7}s ${i * .8}s ease-in infinite` }}/>
        ))}

        {/* sheen sweep */}
        <div style={{ position:'absolute', top:0, bottom:0, left:0, width:'28%', zIndex:9, pointerEvents:'none',
          background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
          animation:'ppcSheen 5.5s 1.2s ease-in-out infinite' }}/>

        {/* label chip */}
        <div style={{
          position:'absolute', top: lg ? 20 : 12, left: lg ? 20 : 12, zIndex:10,
          display:'flex', alignItems:'center', gap:7,
          background:'rgba(10,15,29,0.65)', backdropFilter:'blur(8px)',
          border:`1px solid rgba(${c.glow},0.55)`, color:c.accent,
          padding: lg ? '5px 14px' : '3px 9px', borderRadius:999,
          fontFamily:"'JetBrains Mono', monospace", fontWeight:700,
          fontSize: lg ? 10 : 7, letterSpacing: 2, textTransform:'uppercase',
          animation:'ppcChip .5s .1s cubic-bezier(.22,1,.36,1) backwards',
        }}>
          <span style={{ width: lg ? 7 : 5, height: lg ? 7 : 5, borderRadius:'50%', background:c.accent,
            '--ppc-glow': c.glow, animation:'ppcPulse 1.6s ease-out infinite' }}/>
          Player Profile
        </div>

        {/* role badge */}
        <div style={{
          position:'absolute', top: lg ? 20 : 12, right: lg ? 20 : 12, zIndex:10,
          background:c.badge, color:'#fff',
          padding: lg ? '5px 16px' : '3px 10px', borderRadius:20,
          fontFamily:"'JetBrains Mono', monospace", fontWeight:700,
          fontSize: lg ? 10 : 7, letterSpacing:2, textTransform:'uppercase',
          border:`1px solid ${c.accent}60`, boxShadow:`0 4px 16px rgba(${c.glow},0.45)`,
          animation:'ppcBadge .6s .35s cubic-bezier(.34,1.56,.64,1) backwards',
        }}>
          {player.role || 'Player'}
        </div>

        {/* photo */}
        {player.photo ? (
          <div style={{ position:'absolute', top:0, right:0, width: lg ? '40%' : '38%', height:'100%', zIndex:3, overflow:'hidden',
            animation:'ppcPhoto .9s .15s cubic-bezier(.22,1,.36,1) backwards' }}>
            <img src={player.photo} alt={player.name}
              style={{
                width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block',
                animation:'ppcFloat 6s 1s ease-in-out infinite',
                WebkitMaskImage:'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.65) 28%, #000 58%), linear-gradient(to top, transparent 0%, #000 22%)',
                WebkitMaskComposite:'source-in',
                maskImage:'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.65) 28%, #000 58%), linear-gradient(to top, transparent 0%, #000 22%)',
                maskComposite:'intersect',
              }}/>
          </div>
        ) : (
          /* no photo → default CricZaar avatar */
          <div style={{ position:'absolute', top:0, right:0, width: lg ? '42%' : '40%', height:'100%', zIndex:3,
            display:'flex', alignItems:'flex-end', justifyContent:'center', overflow:'hidden',
            animation:'ppcPhoto .9s .15s cubic-bezier(.22,1,.36,1) backwards' }}>
            <img src={`${process.env.PUBLIC_URL || ''}/non-profile.png`} alt={player.name}
              draggable={false}
              style={{
                width:'auto',
                height:'92%',
                maxWidth:'92%',
                maxHeight:'92%',
                objectFit:'contain',
                objectPosition:'bottom center',
                display:'block',
                marginBottom: lg ? -4 : -2,
                animation:'ppcFloat 6s 1s ease-in-out infinite',
                filter:`drop-shadow(0 0 24px rgba(${c.glow},0.55))`,
              }}/>
          </div>
        )}

        {/* bottom-right tag over photo */}
        {lg && (
          <div style={{ position:'absolute', right:20, bottom:20, zIndex:10,
            background:'rgba(10,15,29,0.7)', backdropFilter:'blur(8px)',
            border:`1px solid ${c.accent}55`, color:'#fff', borderRadius:8, padding:'5px 12px',
            fontFamily:"'JetBrains Mono', monospace", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase',
            animation:'ppcFade .6s .8s cubic-bezier(.22,1,.36,1) backwards' }}>
            {player.role || 'Player'}{player.battingStyle ? ` • ${player.battingStyle}` : ''}
          </div>
        )}

        {/* left content */}
        <div style={{
          position:'relative', zIndex:5,
          padding: lg ? '66px 24px 24px' : '40px 14px 14px',
          width:'60%', height:'100%',
          display:'flex', flexDirection:'column', justifyContent:'space-between',
        }}>
          <div>
            {/* name — each word slides up from a mask */}
            <div style={{
              fontFamily:"'Outfit', sans-serif", fontWeight:800, textTransform:'uppercase',
              fontSize: lg ? 50 : 26, lineHeight:0.95, color:'#fff', letterSpacing:1,
              textShadow:'0 2px 24px rgba(0,0,0,0.8)',
            }}>
              {words.map((w, i) => (
                <div key={i} style={{ overflow:'hidden', paddingBottom:2 }}>
                  <div style={{ animation:`ppcWord .7s ${base + i * .12}s cubic-bezier(.22,1,.36,1) backwards` }}>{w}</div>
                </div>
              ))}
            </div>

            {player.club && (
              <div style={{
                color:c.accent, fontFamily:"'JetBrains Mono', monospace",
                fontSize: lg ? 11 : 8, fontWeight:700, letterSpacing:3, textTransform:'uppercase',
                marginTop: lg ? 8 : 4,
                animation:`ppcFade .5s ${base + words.length * .12 + .05}s ease backwards`,
              }}>{player.club}</div>
            )}

            <div style={{
              width: lg ? 64 : 40, height:3, borderRadius:2, margin: lg ? '14px 0' : '7px 0',
              background:`linear-gradient(90deg,${c.accent},transparent)`,
              transformOrigin:'left', animation:'ppcBar .7s .45s cubic-bezier(.22,1,.36,1) backwards',
            }}/>

            <div style={{ display:'flex', flexDirection:'column', gap: lg ? 8 : 4 }}>
              {chips.map(([lbl, val], i) => (
                <div key={lbl} style={{
                  display:'flex', alignItems:'center', gap:10,
                  background:'rgba(255,255,255,0.07)', backdropFilter:'blur(6px)',
                  borderLeft:`3px solid ${c.accent}`, borderRadius:'0 10px 10px 0',
                  padding: lg ? '8px 14px' : '4px 8px', width:'fit-content', minWidth: lg ? 190 : 110,
                  animation:`ppcChip .55s ${.55 + i * .12}s cubic-bezier(.22,1,.36,1) backwards`,
                }}>
                  <span style={{
                    color:'rgba(255,255,255,0.5)', fontFamily:"'JetBrains Mono', monospace",
                    fontSize: lg ? 10 : 7, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', minWidth: lg ? 36 : 24,
                  }}>{lbl}</span>
                  <span style={{ color:'#fff', fontSize: lg ? 13 : 9, fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* base price */}
          <div style={{ animation:'ppcFade .6s .7s cubic-bezier(.22,1,.36,1) backwards' }}>
            <div style={{
              color:'rgba(255,255,255,0.4)', fontFamily:"'JetBrains Mono', monospace",
              fontSize: lg ? 10 : 7, letterSpacing:3, textTransform:'uppercase', marginBottom:4,
            }}>Base Price</div>
            <div style={{
              fontFamily:"'JetBrains Mono', monospace", fontSize: lg ? 36 : 18, fontWeight:800,
              color:c.accent, textShadow:`0 0 26px rgba(${c.glow},0.8)`, lineHeight:1,
            }}>
              {price} <span style={{ fontSize: lg ? 16 : 10, fontWeight:700, opacity:0.7 }}>pts</span>
            </div>
          </div>
        </div>

        {/* bottom fade */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:60, zIndex:4, pointerEvents:'none',
          background:'linear-gradient(to top, rgba(0,0,0,0.45), transparent)' }}/>
      </div>
    </div>
  );
}