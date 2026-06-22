import React from 'react';

const ROLE_COLORS = {
  'Batsman':       { bg1:'#1d4ed8', bg2:'#0f172a', accent:'#93c5fd', badge:'#2563eb' },
  'Bowler':        { bg1:'#dc2626', bg2:'#450a0a',  accent:'#fca5a5', badge:'#b91c1c' },
  'All-Rounder':   { bg1:'#7c3aed', bg2:'#1e1b4b',  accent:'#c4b5fd', badge:'#6d28d9' },
  'Wicket-Keeper': { bg1:'#0f172a', bg2:'#1e3a8a',  accent:'#60a5fa', badge:'#1d4ed8' },
};

export default function PlayerProfileCard({ player, size = 'large' }) {
  if (!player || !player.name) return null;

  const c  = ROLE_COLORS[player.role] || ROLE_COLORS['Batsman'];
  const lg = size === 'large';

  const cardHeight = lg ? 420 : 240;
  const cardStyle  = {
    position:     'relative',
    overflow:     'hidden',
    borderRadius:  lg ? 24 : 16,
    background:   `linear-gradient(150deg, ${c.bg1} 0%, ${c.bg2} 100%)`,
    height:        cardHeight,
    width:         '100%',
    fontFamily:   "'Rajdhani', sans-serif",
    userSelect:   'none',
    boxShadow:     lg
      ? '0 20px 60px rgba(0,0,0,0.45)'
      : '0 8px 30px rgba(0,0,0,0.35)',
  };

  return (
    <div style={cardStyle}>

      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${c.accent}, transparent)`,
        zIndex: 10,
      }}/>

      {/* Glow blob */}
      <div style={{
        position:     'absolute',
        bottom:       -80,
        right:        -80,
        width:         320,
        height:        320,
        background:   `radial-gradient(circle, ${c.accent}28 0%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents:'none',
      }}/>

      {/* Diagonal lines */}
      <svg
        style={{ position:'absolute', bottom:0, right:0, opacity:0.12, pointerEvents:'none' }}
        width={lg ? 220 : 140}
        height={lg ? 220 : 140}
        viewBox="0 0 220 220"
      >
        {[0, 35, 70, 105].map(o => (
          <line key={o} x1={o} y1="220" x2="220" y2={o}
            stroke={c.accent} strokeWidth="2"/>
        ))}
      </svg>

      {/* PLAYER Profile label */}
      <div style={{
        position:    'absolute',
        top:          lg ? 20 : 12,
        left:         lg ? 20 : 12,
        background:   c.accent,
        color:        '#0f172a',
        padding:      lg ? '5px 16px' : '3px 10px',
        borderRadius: 5,
        fontStyle:   'italic',
        fontWeight:   700,
        fontSize:     lg ? 13 : 9,
        letterSpacing:1,
        zIndex:       10,
      }}>
        PLAYER Profile
      </div>

      {/* Role badge */}
      <div style={{
        position:     'absolute',
        top:           lg ? 20 : 12,
        right:         lg ? 20 : 12,
        background:    c.badge,
        color:        '#fff',
        padding:       lg ? '5px 16px' : '3px 10px',
        borderRadius:  20,
        fontWeight:    700,
        fontSize:      lg ? 11 : 8,
        letterSpacing: 2,
        textTransform:'uppercase',
        zIndex:        10,
        border:        `1px solid ${c.accent}40`,
      }}>
        {player.role || 'Player'}
      </div>

      {/* Player Photo */}
      {player.photo && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '32%', height: '100%',
          zIndex: 2, overflow: 'hidden',
        }}>
          <img
            src={player.photo}
            alt={player.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,1) 55%)',
              maskImage:       'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 25%, rgba(0,0,0,1) 55%)',
            }}
          />
        </div>
      )}

      {/* No-photo cricket icon */}
      {!player.photo && (
        <div style={{
          position:'absolute', right:0, top:0, width:'52%', height:'100%',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize: lg ? 100 : 60, opacity:0.08, zIndex:2,
        }}>🏏</div>
      )}

      {/* Left text content */}
      <div style={{
        position: 'relative', zIndex: 3,
        padding:   lg ? '62px 22px 22px' : '40px 14px 14px',
        width:    '56%', height: '100%',
        display:  'flex', flexDirection:'column', justifyContent:'space-between',
      }}>
        <div>
          <div style={{
            fontFamily:   "'Bebas Neue', sans-serif",
            fontSize:      lg ? 52 : 28,
            lineHeight:    0.92,
            color:        '#ffffff',
            letterSpacing: 2,
            textShadow:   '0 2px 20px rgba(0,0,0,0.7)',
          }}>
            {(player.name || '').split(' ').map((word, i) => (
              <div key={i}>{word}</div>
            ))}
          </div>

          {player.club && (
            <div style={{
              color:         c.accent,
              fontSize:      lg ? 13 : 9,
              fontWeight:    700,
              letterSpacing: 3,
              textTransform:'uppercase',
              marginTop:     lg ? 4 : 2,
            }}>
              {player.club}
            </div>
          )}

          <div style={{
            width:50, height:3,
            background: `linear-gradient(90deg,${c.accent},transparent)`,
            borderRadius:2, margin: lg ? '12px 0' : '6px 0',
          }}/>

          <div style={{ display:'flex', flexDirection:'column', gap: lg ? 7 : 4 }}>
            {[
              player.battingStyle && player.bowlingStyle !== 'N/A'
                ? null
                : player.battingStyle && ['BAT', player.battingStyle],
              player.battingStyle && ['BAT', player.battingStyle],
              player.bowlingStyle && player.bowlingStyle !== 'N/A' && ['BOWL', player.bowlingStyle],
            ]
              .filter(Boolean)
              .filter((v, i, arr) => arr.findIndex(x => x && x[0] === v[0]) === i)
              .map(([lbl, val]) => (
                <div key={lbl} style={{
                  display:'flex', alignItems:'center', gap:8,
                  background:'rgba(255,255,255,0.08)',
                  borderLeft:`3px solid ${c.accent}`,
                  borderRadius:'0 8px 8px 0',
                  padding: lg ? '7px 12px' : '4px 8px',
                }}>
                  <span style={{
                    color:'rgba(255,255,255,0.5)', fontSize: lg ? 10 : 8,
                    fontWeight:700, letterSpacing:1, textTransform:'uppercase', minWidth: lg ? 34 : 26,
                  }}>{lbl}</span>
                  <span style={{ color:'#fff', fontSize: lg ? 12 : 9, fontWeight:700 }}>{val}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Base price */}
        <div>
          <div style={{
            color:'rgba(255,255,255,0.35)', fontSize: lg ? 10 : 7,
            letterSpacing:3, textTransform:'uppercase', marginBottom:3,
          }}>BASE PRICE</div>
          <div style={{
            fontFamily:"'Orbitron', sans-serif",
            fontSize: lg ? 32 : 18, fontWeight:900,
            color: c.accent,
            textShadow:`0 0 24px ${c.accent}99`, lineHeight:1,
          }}>
            {player.basePrice || 0} <span style={{ fontSize: lg ? 18 : 11, fontWeight: 700, opacity: 0.8 }}>pts</span>
          </div>
        </div>
      </div>

      {/* Bottom shadow */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:50,
        background:'linear-gradient(to top, rgba(0,0,0,0.35), transparent)',
        zIndex:4, pointerEvents:'none',
      }}/>
    </div>
  );
}
