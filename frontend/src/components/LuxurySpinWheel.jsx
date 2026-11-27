import React, { useEffect, useRef, useState, useCallback } from 'react';
import { playWheelClick, playBidChime, playCountdownTick } from '../utils/audio';
import criczaarLogo from '../logo.png';

// Vibrant luxury jewel palette
const JEWEL_PALETTE = [
  '#F59E0B', // Amber Gold
  '#3B82F6', // Royal Blue
  '#10B981', // Emerald Green
  '#8B5CF6', // Purple Orchid
  '#EC4899', // Hot Pink
  '#06B6D4', // Electric Cyan
  '#F97316', // Bright Orange
  '#6366F1', // Indigo Night
  '#14B8A6', // Caribbean Teal
  '#E11D48', // Ruby Crimson
  '#84CC16', // Lime Glow
  '#A855F7', // Deep Violet
];

export default function LuxurySpinWheel({
  players = [],
  onSpinStart,
  onLanded,
  onLoadPlayer,
  externalSpin = null,
  isHost = true,
  size = 420,
  disabled = false,
}) {
  const canvasRef = useRef(null);

  // Remaining contenders pool
  const remaining = players.filter(p => p.status === 'remaining');

  // Filter mode: 'all' (all players on wheel) vs 'featured' (12 wide slices)
  const [filterMode, setFilterMode] = useState('all');

  // Slices display mode: 'mystery' (Secret LOT #01... names hidden!) vs 'names'
  const [sliceDisplayMode, setSliceDisplayMode] = useState('mystery');

  // Active slice candidates
  const [activeSegments, setActiveSegments] = useState([]);

  // Spin & Reveal Stages: 'idle' | 'spinning' | 'countdown' | 'revealed'
  const [revealStage, setRevealStage] = useState('idle');
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasLanded, setHasLanded] = useState(false);
  const [landedPlayer, setLandedPlayer] = useState(null);
  const [winnerLotNumber, setWinnerLotNumber] = useState(null);
  const [revealCountdown, setRevealCountdown] = useState(3);
  const [activePlayerUnderPointer, setActivePlayerUnderPointer] = useState(null);

  // References for animation
  const currentAngleRef = useRef(0);
  const animFrameRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const flapperAngleRef = useRef(0);
  const lastPegIndexRef = useRef(-1);
  const lastClickTimeRef = useRef(0);
  const confettiParticlesRef = useRef([]);
  const ledPhaseRef = useRef(0);
  const logoImgRef = useRef(null);

  // Load CricZaar logo for central wheel hub
  useEffect(() => {
    const img = new Image();
    img.src = criczaarLogo;
    img.onload = () => {
      logoImgRef.current = img;
      drawWheel(currentAngleRef.current, flapperAngleRef.current, confettiParticlesRef.current, ledPhaseRef.current);
    };
  }, []);

  // Update active segments when pool or filterMode changes and idle
  useEffect(() => {
    if (isSpinning || hasLanded) return;
    if (remaining.length === 0) {
      setActiveSegments([]);
      return;
    }

    if (filterMode === 'featured' && remaining.length > 12) {
      setActiveSegments(remaining.slice(0, 12));
    } else {
      setActiveSegments(remaining);
    }
  }, [remaining.length, filterMode, isSpinning, hasLanded]);

  // Keep active player under pointer updated
  const segments = activeSegments.length > 0 ? activeSegments : remaining;
  const numSegments = segments.length || 1;
  const sliceAngle = (2 * Math.PI) / numSegments;

  // Main Canvas Rendering Loop
  const drawWheel = useCallback((angle, flapperAngle, particles, ledPhase) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = size;
    const cx = w / 2;
    const cy = h / 2;
    const outerR = (w / 2) - 16;
    const innerR = Math.max(34, outerR * 0.32);

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // ── 1. DRAW OUTER CASING & STADIUM LED BEZEL ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#0A0F1D';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#222B45';
    ctx.stroke();

    // Metallic Outer Rim
    const rimGrad = ctx.createLinearGradient(0, cy - outerR, 0, cy + outerR);
    rimGrad.addColorStop(0, '#F59E0B');
    rimGrad.addColorStop(0.5, '#78350F');
    rimGrad.addColorStop(1, '#FBBF24');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2, 0, 2 * Math.PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = rimGrad;
    ctx.stroke();

    // 28 Stadium LED Bulbs around the bezel
    const NUM_LEDS = 28;
    for (let i = 0; i < NUM_LEDS; i++) {
      const bulbAngle = (i * (2 * Math.PI / NUM_LEDS));
      const bx = cx + (outerR + 7) * Math.cos(bulbAngle);
      const by = cy + (outerR + 7) * Math.sin(bulbAngle);
      const isLit = (Math.floor(i + ledPhase) % 3 === 0);

      ctx.beginPath();
      ctx.arc(bx, by, isLit ? 3.5 : 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = isLit ? '#FDE68A' : '#78350F';
      if (isLit) {
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // ── 2. DRAW ROTATING WHEEL SLICES ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    if (segments.length === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, outerR, 0, 2 * Math.PI);
      ctx.fillStyle = '#171E33';
      ctx.fill();
      ctx.restore();
    } else {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const startA = i * sliceAngle;
        const endA = (i + 1) * sliceAngle;
        const color = JEWEL_PALETTE[i % JEWEL_PALETTE.length];

        // Slice Wedge
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, outerR, startA, endA);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Slice Divider Stroke
        ctx.lineWidth = segments.length > 36 ? 1 : 2;
        ctx.strokeStyle = '#0B1120';
        ctx.stroke();

        // Brass Peg at slice boundary
        const pegX = (outerR - 5) * Math.cos(startA);
        const pegY = (outerR - 5) * Math.sin(startA);
        ctx.beginPath();
        ctx.arc(pegX, pegY, segments.length > 36 ? 2 : 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#FEF3C7';
        ctx.fill();
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1;
        ctx.stroke();

        // ── SLICE TEXT RENDERING ──
        ctx.save();
        const midA = startA + sliceAngle / 2;
        ctx.rotate(midA);

        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        if (sliceDisplayMode === 'mystery') {
          // ── MYSTERY LOT MODE (Secret names, ready-to-bid suspense!) ──
          const lotLabel = `LOT #${i + 1}`;
          ctx.font = segments.length > 36
            ? '900 10px "Outfit", system-ui, sans-serif'
            : '900 12px "Outfit", system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(lotLabel, outerR - 12, 0, outerR - innerR - 14);
        } else {
          // ── SHOW NAMES MODE ──
          const name = (seg.name || '???').trim().toUpperCase();
          if (segments.length <= 16) {
            ctx.font = '800 13px "Outfit", system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const maxW = outerR - innerR - 20;
            const short = name.length > 13 ? name.slice(0, 12) + '…' : name;
            ctx.fillText(short, outerR - 14, 0, maxW);
          } else if (segments.length <= 32) {
            ctx.font = '800 11px "Outfit", system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const maxW = outerR - innerR - 16;
            const short = name.length > 10 ? name.slice(0, 9) + '…' : name;
            ctx.fillText(short, outerR - 12, 0, maxW);
          } else {
            ctx.font = '800 9px "Outfit", system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = `#${i + 1} ${name.slice(0, 7)}`;
            ctx.fillText(label, outerR - 10, 0, outerR - innerR - 12);
          }
        }

        ctx.restore();
      }
      ctx.restore();
    }

    // ── 3. METALLIC 3D CENTER HUB (Features CricZaar logo) ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerR + 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    // Outer Beveled Brass Ring
    const hubGrad = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, innerR);
    hubGrad.addColorStop(0, '#FDE68A');
    hubGrad.addColorStop(0.3, '#F59E0B');
    hubGrad.addColorStop(0.8, '#B45309');
    hubGrad.addColorStop(1, '#78350F');
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Inner Deep Dome
    const domeGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, innerR - 6);
    domeGrad.addColorStop(0, '#1E293B');
    domeGrad.addColorStop(0.7, '#0F172A');
    domeGrad.addColorStop(1, '#020617');
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 6, 0, 2 * Math.PI);
    ctx.fillStyle = domeGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();

    // Center CricZaar Logo Emblem
    if (logoImgRef.current && logoImgRef.current.complete) {
      const logoW = (innerR - 6) * 1.5;
      ctx.drawImage(logoImgRef.current, cx - logoW / 2, cy - logoW / 2, logoW, logoW);
    } else {
      ctx.font = `${Math.round(innerR * 0.75)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏏', cx, cy);
    }
    ctx.restore();

    // ── 4. PHYSICAL BOUNCING FLAPPER POINTER (12 o'clock) ──
    ctx.save();
    const flapperPivotX = cx;
    const flapperPivotY = 8;
    ctx.translate(flapperPivotX, flapperPivotY);
    ctx.rotate(flapperAngle);

    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(0, 36);      // Tip pointing down onto the rim
    ctx.lineTo(-12, 0);     // Left shoulder
    ctx.lineTo(0, 6);       // Center notch
    ctx.lineTo(12, 0);      // Right shoulder
    ctx.closePath();

    const ptrGrad = ctx.createLinearGradient(-12, 0, 12, 36);
    ptrGrad.addColorStop(0, '#FDE68A');
    ptrGrad.addColorStop(0.5, '#F59E0B');
    ptrGrad.addColorStop(1, '#D97706');
    ctx.fillStyle = ptrGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0A0F1D';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    // ── 5. CONFETTI PARTICLES EXPLOSION ──
    if (particles && particles.length > 0) {
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [size, segments, sliceAngle, sliceDisplayMode]);

  // Canvas setup on mount and resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    drawWheel(currentAngleRef.current, flapperAngleRef.current, confettiParticlesRef.current, ledPhaseRef.current);
  }, [size, drawWheel]);

  // Sound throttled peg click
  const triggerPegTick = useCallback(() => {
    const now = performance.now();
    if (now - lastClickTimeRef.current > 40) {
      try {
        playWheelClick();
      } catch (e) {}
      lastClickTimeRef.current = now;
    }
    flapperAngleRef.current = -0.38; // ~-22 deg deflection
  }, []);

  // Spawn confetti burst on winner landing
  const spawnConfetti = useCallback((cx, cy) => {
    const particles = [];
    const colors = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#FBBF24', '#FFFFFF', '#06B6D4'];
    for (let i = 0; i < 75; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = 2 + Math.random() * 7;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 5 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      });
    }
    confettiParticlesRef.current = particles;
  }, []);

  // Run the physics spin animation
  const runSpinAnimation = useCallback((targetAngle, totalDuration, winner, winnerIdx, dispMode = 'mystery') => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    setIsSpinning(true);
    setHasLanded(false);
    setLandedPlayer(null);
    setWinnerLotNumber(winnerIdx + 1);
    setRevealStage('spinning');

    const startAngle = currentAngleRef.current;
    const distance = targetAngle - startAngle;
    const startTime = performance.now();
    const cx = size / 2;
    const cy = size / 2;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / totalDuration);

      // Quartic Ease-Out curve
      let eased = 1 - Math.pow(1 - progress, 4);

      // Elastic micro-settle bounce
      if (progress >= 0.96) {
        const bounceP = (progress - 0.96) / 0.04;
        const bounceOffset = Math.sin(bounceP * Math.PI) * 0.008;
        eased += bounceOffset;
      }

      const currentAngle = startAngle + distance * eased;
      currentAngleRef.current = currentAngle;

      // Check peg crossing for flapper deflection & audio
      const pointerAngle = 1.5 * Math.PI;
      const norm = ((pointerAngle - (currentAngle % (2 * Math.PI))) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const currentPegIdx = Math.floor(norm / sliceAngle);

      if (currentPegIdx !== lastPegIndexRef.current) {
        lastPegIndexRef.current = currentPegIdx;
        triggerPegTick();
        const active = segments[currentPegIdx] || null;
        if (active) setActivePlayerUnderPointer(active);
      }

      // Spring flapper back to center
      flapperAngleRef.current += (0 - flapperAngleRef.current) * 0.28;

      // Animate LED bulbs
      ledPhaseRef.current += 0.25;

      // Update confetti particles if active
      if (confettiParticlesRef.current.length > 0) {
        for (let i = 0; i < confettiParticlesRef.current.length; i++) {
          const p = confettiParticlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.22;
          p.vx *= 0.98;
          p.rotation += p.vRot;
          p.alpha -= 0.012;
        }
        confettiParticlesRef.current = confettiParticlesRef.current.filter(p => p.alpha > 0);
      }

      // Draw frame
      drawWheel(currentAngle, flapperAngleRef.current, confettiParticlesRef.current, ledPhaseRef.current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // ── WHEEL STOPPED! ──
        currentAngleRef.current = targetAngle;
        flapperAngleRef.current = 0;
        setIsSpinning(false);
        setHasLanded(true);
        setLandedPlayer(winner);
        setActivePlayerUnderPointer(winner);

        if (dispMode === 'mystery') {
          // ── STEP 1: "ARE OWNERS READY?" COUNTDOWN ──
          setRevealStage('countdown');
          setRevealCountdown(3);
          try { playCountdownTick(true); } catch (e) {}

          let step = 3;
          countdownTimerRef.current = setInterval(() => {
            step--;
            if (step > 0) {
              setRevealCountdown(step);
              try { playCountdownTick(true); } catch (e) {}
            } else {
              clearInterval(countdownTimerRef.current);
              // ── STEP 2: THE GRAND REVEAL! ──
              setRevealStage('revealed');
              spawnConfetti(cx, cy);
              try { playBidChime(); } catch (e) {}
              if (onLanded) onLanded(winner);
            }
          }, 550);
        } else {
          // Direct reveal
          setRevealStage('revealed');
          spawnConfetti(cx, cy);
          try { playBidChime(); } catch (e) {}
          if (onLanded) onLanded(winner);
        }

        // Keep animating confetti until faded
        const fadeConfettiLoop = () => {
          if (confettiParticlesRef.current.length > 0) {
            for (let i = 0; i < confettiParticlesRef.current.length; i++) {
              const p = confettiParticlesRef.current[i];
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.22;
              p.vx *= 0.98;
              p.rotation += p.vRot;
              p.alpha -= 0.012;
            }
            confettiParticlesRef.current = confettiParticlesRef.current.filter(p => p.alpha > 0);
            drawWheel(currentAngleRef.current, 0, confettiParticlesRef.current, ledPhaseRef.current);
            requestAnimationFrame(fadeConfettiLoop);
          } else {
            drawWheel(currentAngleRef.current, 0, [], ledPhaseRef.current);
          }
        };
        requestAnimationFrame(fadeConfettiLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, [size, sliceAngle, segments, triggerPegTick, drawWheel, spawnConfetti, onLanded]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Handle external spin trigger (e.g. on Projector Screen via Socket.io)
  useEffect(() => {
    if (!externalSpin) return;
    const { targetAngle, duration = 4800, winnerPlayer, activeSegments: extSegs, sliceDisplayMode: extMode = 'mystery', winnerLotNumber: extLotNum } = externalSpin;
    if (extSegs && extSegs.length > 0) {
      setActiveSegments(extSegs);
    }
    if (extMode) {
      setSliceDisplayMode(extMode);
    }
    if (targetAngle != null && winnerPlayer) {
      const wIdx = extLotNum ? (extLotNum - 1) : 0;
      runSpinAnimation(targetAngle, duration, winnerPlayer, wIdx, extMode);
    }
  }, [externalSpin, runSpinAnimation]);

  // Host clicks "SPIN TO DRAW"
  const handleHostSpin = () => {
    if (isSpinning || (hasLanded && revealStage !== 'revealed') || segments.length === 0 || disabled) return;

    // 1. Pick true random winner uniformly from ALL active contenders
    const winnerIdx = Math.floor(Math.random() * segments.length);
    const winnerPlayer = segments[winnerIdx];

    // 2. Compute exact target angle so slice center lands at 12 o'clock (-PI/2 or 3PI/2)
    const winnerSliceCenter = winnerIdx * sliceAngle + sliceAngle / 2;
    const targetNorm = ((1.5 * Math.PI - winnerSliceCenter) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const currentNorm = (currentAngleRef.current % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    let delta = targetNorm - currentNorm;
    if (delta < 0) delta += 2 * Math.PI;

    // 7 to 9 full spins for maximum TV suspense
    const extraTurns = (7 + Math.floor(Math.random() * 3)) * (2 * Math.PI);
    const targetAngle = currentAngleRef.current + delta + extraTurns;
    const duration = 4800; // 4.8 seconds

    // 3. Notify parent/socket
    if (onSpinStart) {
      onSpinStart({
        targetAngle,
        duration,
        winnerPlayer,
        winnerLotNumber: winnerIdx + 1,
        activeSegments: segments,
        filterMode,
        sliceDisplayMode,
      });
    }

    // 4. Run local physics animation
    runSpinAnimation(targetAngle, duration, winnerPlayer, winnerIdx, sliceDisplayMode);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto select-none">
      {/* ── TOP BAR: Mode Selector & Live Status ── */}
      <div className="w-full flex items-center justify-between gap-2 mb-2 px-2 flex-wrap">
        {/* Mode Toggles (Host only) */}
        {isHost && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mystery vs Names Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => { setSliceDisplayMode('mystery'); }}
                className={`px-3 py-1 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  sliceDisplayMode === 'mystery'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Hides player names on slices — builds suspense for team owners!">
                <span>🎟️</span>
                <span>MYSTERY LOTS</span>
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => { setSliceDisplayMode('names'); }}
                className={`px-3 py-1 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  sliceDisplayMode === 'names'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Shows player names on wheel slices">
                <span>👤</span>
                <span>NAMES</span>
              </button>
            </div>

            {/* Filter Toggle (All Players vs 12 Featured) */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => { setFilterMode('all'); setHasLanded(false); setRevealStage('idle'); }}
                className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center gap-1 ${
                  filterMode === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}>
                <span>ALL ({remaining.length})</span>
              </button>
              <button
                type="button"
                disabled={isSpinning || remaining.length <= 12}
                onClick={() => { setFilterMode('featured'); setHasLanded(false); setRevealStage('idle'); }}
                className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-bold transition-all flex items-center gap-1 ${
                  filterMode === 'featured'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white disabled:opacity-40'
                }`}>
                <span>12 SLICES</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Pool Pill */}
        <span className="ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[11px] font-bold tracking-[0.15em] uppercase bg-amber-500/10 border border-amber-500/30 text-amber-300">
          <span className={`w-2 h-2 rounded-full bg-amber-400 ${isSpinning ? 'animate-ping' : ''}`} />
          {isSpinning ? 'DRAWING LOT…' : `${remaining.length} IN POOL`}
        </span>
      </div>

      {/* ── BROADCAST STATUS HUD: "ARE OWNERS READY TO BID?" ── */}
      <div
        className={`w-full max-w-md mb-2 px-4 py-2.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 shadow-lg ${
          revealStage === 'revealed' && landedPlayer
            ? 'bg-gradient-to-r from-amber-500/25 via-emerald-500/20 to-amber-500/25 border-emerald-400 shadow-emerald-500/20 animate-pop'
            : revealStage === 'countdown'
            ? 'bg-gradient-to-r from-amber-500/30 via-red-500/20 to-amber-500/30 border-amber-400 animate-pulse shadow-amber-500/30'
            : isSpinning
            ? 'bg-black/85 border-amber-500/50 shadow-amber-500/15'
            : 'bg-black/60 border-white/10'
        }`}>
        <div className="flex items-center gap-3 min-w-0">
          {revealStage === 'revealed' ? (
            <span className="text-3xl flex-shrink-0 animate-bounce">🏆</span>
          ) : revealStage === 'countdown' ? (
            <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-display font-black text-lg flex items-center justify-center animate-ping flex-shrink-0">
              {revealCountdown}
            </div>
          ) : isSpinning ? (
            <span className="text-2xl flex-shrink-0 animate-spin">🌀</span>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-black/60 border border-amber-400/40 flex items-center justify-center p-1 flex-shrink-0 shadow-md">
              <img src={criczaarLogo} alt="CricZaar" className="w-full h-full object-contain" />
            </div>
          )}

          <div className="min-w-0">
            {revealStage === 'revealed' && landedPlayer ? (
              <>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400 font-bold block">
                  🎯 LOT #{winnerLotNumber} UNVEILED — OWNERS READY!
                </span>
                <h3 className="font-display font-black text-xl text-white uppercase truncate leading-tight">
                  {landedPlayer.name}
                </h3>
              </>
            ) : revealStage === 'countdown' ? (
              <>
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber-300 font-bold block">
                  🎯 LOT #{winnerLotNumber} DRAWN!
                </span>
                <h3 className="font-display font-black text-base text-white uppercase truncate leading-tight animate-pulse">
                  ⚡ ARE OWNERS READY? REVEALING IN {revealCountdown}…
                </h3>
              </>
            ) : isSpinning ? (
              <>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400 font-bold block animate-pulse">
                  DRAWING LOT ON WHEEL…
                </span>
                <h3 className="font-display font-black text-base text-amber-300 uppercase truncate leading-tight">
                  ⚡ FRANCHISES READY YOUR BIDS!
                </h3>
              </>
            ) : (
              <>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400 font-bold block">
                  CRICZAAR LOTTERY STAGE
                </span>
                <h3 className="font-display font-black text-base text-white uppercase truncate leading-tight">
                  ⚡ READY TO BID? OWNERS ON STANDBY!
                </h3>
              </>
            )}
          </div>
        </div>

        <div className="text-right font-mono flex-shrink-0 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
          {revealStage === 'revealed' && landedPlayer ? (
            <>
              <span className="text-[9px] text-slate-400 block uppercase">Base</span>
              <span className="text-sm font-bold text-amber-400">
                {landedPlayer.basePrice || 0} pts
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] text-slate-400 block uppercase">STATUS</span>
              <span className="text-xs font-bold text-emerald-400">
                {isSpinning ? 'DRAWING' : 'STANDBY'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── CANVAS WHEEL VIEWPORT ── */}
      <div className="relative flex items-center justify-center my-1" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          className="rounded-full shadow-2xl transition-transform"
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      </div>

      {/* ── REVEALED SPOTLIGHT CARD (Appears only after suspense countdown!) ── */}
      {revealStage === 'revealed' && landedPlayer && (
        <div
          key={landedPlayer._id}
          className="relative z-10 w-full max-w-md p-3.5 mt-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-black/85 to-emerald-500/20 border-2 border-emerald-400 flex items-center justify-between gap-3 shadow-2xl shadow-emerald-500/20 animate-pop">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
              {landedPlayer.photo ? (
                <img src={landedPlayer.photo} alt={landedPlayer.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🏏</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400 font-bold block">
                LOT #{winnerLotNumber} · {landedPlayer.role || 'PLAYER'}
              </span>
              <h3 className="font-display font-black text-xl text-white uppercase truncate leading-tight">
                {landedPlayer.name}
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                {landedPlayer.battingStyle || 'Cricket Pro'}
              </p>
            </div>
          </div>
          <div className="text-right font-mono flex-shrink-0 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-[9px] text-slate-400 block uppercase">Base Price</span>
            <span className="text-base font-bold text-amber-400">
              {landedPlayer.basePrice || 0} pts
            </span>
          </div>
        </div>
      )}

      {/* ── HOST ACTION CONTROLS ── */}
      {isHost && (
        <div className="relative z-10 flex gap-3 mt-3 items-center flex-wrap justify-center">
          <button
            type="button"
            onClick={handleHostSpin}
            disabled={isSpinning || (hasLanded && revealStage !== 'revealed') || remaining.length === 0 || disabled}
            className={`btn-gold relative px-9 py-3.5 rounded-2xl font-display tracking-widest font-black text-lg transition-all hover:-translate-y-0.5 disabled:opacity-40 shadow-xl ${
              !isSpinning && !hasLanded ? 'animate-glow-pulse' : ''
            }`}>
            {isSpinning
              ? '🌀 DRAWING LOT…'
              : revealStage === 'countdown'
              ? '⏳ REVEALING CONTENDER…'
              : hasLanded
              ? '✅ LOT DRAWN!'
              : '🎰 SPIN TO DRAW!'}
          </button>

          {revealStage === 'revealed' && landedPlayer && (
            <button
              type="button"
              onClick={() => onLoadPlayer && onLoadPlayer(landedPlayer._id)}
              className="px-9 py-3.5 rounded-2xl font-display tracking-widest text-white font-black text-lg transition-all hover:-translate-y-0.5 shadow-xl shadow-emerald-500/30 animate-pulse"
              style={{ background: 'linear-gradient(135deg,#059669,#10B981)' }}>
              🏏 LOAD {landedPlayer.name.toUpperCase()}
            </button>
          )}

          {hasLanded && !isSpinning && revealStage === 'revealed' && (
            <button
              type="button"
              onClick={() => {
                setHasLanded(false);
                setLandedPlayer(null);
                setRevealStage('idle');
              }}
              className="px-5 py-3.5 rounded-2xl font-mono text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
              🔄 SPIN AGAIN
            </button>
          )}
        </div>
      )}

      {/* ── MARQUEE TICKER OF CONTENDERS POOL ── */}
      {remaining.length > 0 && (
        <div className="relative z-10 w-full max-w-md mt-3 overflow-hidden rounded-xl bg-black/40 border border-white/10 py-1.5 px-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              TOTAL CONTENDERS IN POOL
            </span>
            <span className="text-amber-400 font-bold">{remaining.length} CONTENDERS</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap">
            <div className="prj-ticker-track py-0.5 text-[11px] font-mono text-slate-300">
              {[0, 1].map((copyIdx) => (
                <div key={copyIdx} className="flex items-center flex-shrink-0 space-x-3">
                  {remaining.map((p, idx) => (
                    <span
                      key={`${copyIdx}-${p._id || idx}`}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      <span className="text-amber-400 font-bold">#{idx + 1}</span>
                      <span>{sliceDisplayMode === 'mystery' ? `LOT #${idx + 1}` : p.name}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
