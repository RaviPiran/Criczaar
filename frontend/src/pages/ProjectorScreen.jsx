import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import FullscreenButton from '../components/FullscreenButton';
import PlayerProfileCard from '../components/PlayerProfileCard';
import {
  playBidChime,
  playCountdownTick,
  playSoldCelebration,
  playUnsoldSound,
  playWheelClick,
} from '../utils/audio';

/* ── Projector Broadcast Keyframes & Styling ────────────────────────── */
const PRJ_CSS = `
@property --prj-angle { syntax:'<angle>'; initial-value:0deg; inherits:false; }
@keyframes prjSpinRing { to { --prj-angle: 360deg; } }
@keyframes prjGlowPulse { 0%,100% { filter: drop-shadow(0 0 25px rgba(245,158,11,0.45)); } 50% { filter: drop-shadow(0 0 50px rgba(245,158,11,0.85)); } }
@keyframes prjBidPop { 0% { transform: scale(0.85); opacity: 0.4; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }
@keyframes prjRipple { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
@keyframes prjStampIn { 0% { transform: scale(3) rotate(-14deg); opacity: 0; filter: blur(10px); } 60% { transform: scale(0.92) rotate(-5deg); opacity: 1; filter: none; } 100% { transform: scale(1) rotate(-5deg); opacity: 1; } }
@keyframes prjConfettiFall { 0% { transform: translateY(-40px) rotate(0deg) scale(0.8); opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg) scale(1.1); opacity: 0; } }
@keyframes prjUrgentBeep { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); filter: drop-shadow(0 0 15px rgba(239,68,68,0.8)); } }
@keyframes prjFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes prjMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes prjBeam { 0%, 100% { opacity: 0.22; transform: rotate(-15deg) scaleY(1); } 50% { opacity: 0.55; transform: rotate(-8deg) scaleY(1.12); } }
@keyframes prjRiseUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes prjPointerTick { 0%, 100% { transform: translateX(-50%) rotate(0deg); } 50% { transform: translateX(-50%) rotate(-12deg); } }
@keyframes prjShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }

.prj-gold-gradient {
  background: linear-gradient(135deg, #FDE68A 0%, #F59E0B 45%, #D97706 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.prj-ticker-track {
  display: flex;
  width: max-content;
  animation: prjMarquee 35s linear infinite;
}
.prj-ticker-track:hover {
  animation-play-state: paused;
}

.prj-wheel-glow {
  box-shadow: 0 0 70px rgba(245,158,11,0.4), 0 0 120px rgba(99,102,241,0.3);
}

.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
`;

const API_URL         = process.env.REACT_APP_API_URL    || 'http://localhost:5000/api';
const SOCKET_URL      = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const PUB             = axios.create({ baseURL: API_URL });
const CONFETTI_COLORS = ['#F59E0B', '#FBBF24', '#38BDF8', '#10B981', '#EC4899', '#8B5CF6', '#FFFFFF'];
const WHEEL_PALETTE   = ['#F59E0B', '#6366F1', '#38BDF8', '#10B981', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6', '#EAB308', '#A855F7'];

export default function ProjectorScreen() {
  const { roomCode } = useParams();

  const [room,               setRoom]               = useState(null);
  const [teams,              setTeams]              = useState([]);
  const [players,            setPlayers]            = useState([]);
  const [currentPlayer,      setCurrentPlayer]      = useState(null);
  const [currentBid,         setCurrentBid]         = useState(0);
  const [currentBidder,      setCurrentBidder]      = useState(null);
  const [timer,              setTimer]              = useState(null);
  const [isPaused,           setIsPaused]           = useState(false);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [lastResult,         setLastResult]         = useState(null);
  const [recentBids,         setRecentBids]         = useState([]);
  const [soundEnabled,       setSoundEnabled]       = useState(() => {
    return localStorage.getItem('criczaar_projector_sound') !== 'false';
  });

  // Spin Wheel State on Projector
  const [wheelRotation,      setWheelRotation]      = useState(0);
  const [wheelSpinning,      setWheelSpinning]      = useState(false);
  const [wheelLandedPlayer,  setWheelLandedPlayer]  = useState(null);

  const socketRef          = useRef(null);
  const timerMaxRef        = useRef(30);
  const clickTickerRef     = useRef(null);
  const lastResultTimerRef = useRef(null);

  // Toggle sound & persist
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('criczaar_projector_sound', String(next));
      return next;
    });
  };

  // ── Load full room data ───────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    try {
      const { data: codeRes } = await PUB.get(`/rooms/${(roomCode || '').toUpperCase()}`);
      if (!codeRes.success) {
        setError('Auction room not found. Please verify the code.');
        setLoading(false);
        return;
      }
      const roomMeta = codeRes.data;

      const { data: fullRes } = await PUB.get(`/rooms/public/${roomMeta._id}/full`);
      if (!fullRes.success) {
        setError('Could not load tournament data.');
        setLoading(false);
        return;
      }

      const { room: r, teams: t, players: p } = fullRes.data;
      setRoom(r);
      setTeams(t || []);
      setPlayers(p || []);
      setCurrentPlayer(r.currentPlayer || null);
      setCurrentBid(r.currentBid || 0);
      setCurrentBidder(r.currentBidder || null);
      setIsPaused(r.status === 'paused');

      if (r.auctionLog?.length) {
        const bids = r.auctionLog
          .filter(l => l.type === 'bid')
          .slice(-8)
          .reverse();
        setRecentBids(bids);
      }

      setLoading(false);
      connectSocket(r._id);
    } catch (err) {
      setError('Unable to connect to live room. Please check your link.');
      setLoading(false);
    }
  }, [roomCode]);

  // ── Socket handling ───────────────────────────────────────────────────────
  const connectSocket = (roomId) => {
    if (socketRef.current?.connected) return;

    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
    });
    socketRef.current = s;

    s.on('connect',   () => s.emit('join-room', roomId));
    s.on('reconnect', () => s.emit('join-room', roomId));

    // Live bid placed
    s.on('bid-update', ({ currentBid: bid, currentBidder: bidder }) => {
      setCurrentBid(bid);
      setCurrentBidder(bidder);
      if (soundEnabled) playBidChime();

      setRecentBids(prev => [
        {
          teamName: bidder?.name || 'Team',
          teamColor: bidder?.color || '#F59E0B',
          amount: bid,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          _id: Date.now() + Math.random(),
        },
        ...prev.slice(0, 7),
      ]);
    });

    // Next player up on the stage
    s.on('next-player', (player) => {
      clearTimeout(lastResultTimerRef.current);
      setCurrentPlayer(player);
      setCurrentBid(player?.basePrice || 0);
      setCurrentBidder(null);
      setTimer(null);
      timerMaxRef.current = 30;
      setLastResult(null);
      setRecentBids([]);
      setWheelLandedPlayer(null);
      setWheelSpinning(false);
    });

    // Spin wheel broadcast event from host
    s.on('wheel-spin', ({ rotation, pickedPlayer }) => {
      setWheelSpinning(true);
      setWheelRotation(rotation);
      setWheelLandedPlayer(null);

      // Play ticking clicks during spin
      clearInterval(clickTickerRef.current);
      if (soundEnabled) {
        let count = 0;
        clickTickerRef.current = setInterval(() => {
          playWheelClick();
          count++;
          if (count > 28) clearInterval(clickTickerRef.current);
        }, 130);
      }

      // Finish spin after 4.2s
      setTimeout(() => {
        clearInterval(clickTickerRef.current);
        setWheelSpinning(false);
        setWheelLandedPlayer(pickedPlayer);
        if (soundEnabled) playBidChime();
      }, 4200);
    });

    // Timer ticks
    s.on('timer-tick', ({ remaining }) => {
      setTimer(remaining);
      if (remaining > timerMaxRef.current) timerMaxRef.current = remaining;
      if (soundEnabled && remaining <= 5 && remaining > 0) {
        playCountdownTick(true);
      }
    });

    s.on('timer-stopped', () => setTimer(null));
    s.on('timer-expired', () => setTimer(0));

    // Player Sold or Unsold
    s.on('player-result', (result) => {
      setLastResult(result);
      setCurrentPlayer(null);
      setCurrentBid(0);
      setCurrentBidder(null);
      setTimer(null);
      setWheelLandedPlayer(null);

      // Auto-dismiss the celebration takeover after 5.5s so the screen returns to the spin wheel for the next player!
      clearTimeout(lastResultTimerRef.current);
      lastResultTimerRef.current = setTimeout(() => {
        setLastResult(null);
      }, 5500);

      if (result?.type === 'sold') {
        if (soundEnabled) playSoldCelebration();
        setPlayers(prev => prev.map(p =>
          p._id === result.player?._id ? { ...p, status: 'sold', soldTo: result.team?._id, soldPrice: result.price } : p
        ));
        setTeams(prev => prev.map(t =>
          t._id === result.team?._id
            ? {
                ...t,
                budgetLeft: Math.round(((t.budgetLeft ?? t.budget) - result.price) * 10) / 10,
                players: [...(t.players || []), { player: result.player, soldPrice: result.price }],
              }
            : t
        ));
      } else if (result?.type === 'unsold') {
        if (soundEnabled) playUnsoldSound();
        setPlayers(prev => prev.map(p =>
          p._id === result.player?._id ? { ...p, status: 'unsold' } : p
        ));
      }
    });

    // Pause / Resume
    s.on('auction-paused',  () => setIsPaused(true));
    s.on('auction-resumed', () => setIsPaused(false));

    // Initial state catch-up
    s.on('room-state', (state) => {
      if (state.currentBid)    setCurrentBid(state.currentBid);
      if (state.currentBidder) setCurrentBidder(state.currentBidder);
    });

    // Admin dashboard corrected data
    s.on('admin-update', () => loadRoom());
  };

  useEffect(() => {
    loadRoom();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      clearInterval(clickTickerRef.current);
      clearTimeout(lastResultTimerRef.current);
    };
  }, [loadRoom]);

  // Keyboard shortcut: 'M' toggles audio, 'F' toggles Fullscreen
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleSound();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Derived statistics ────────────────────────────────────────────────────
  const soldPlayers   = useMemo(() => players.filter(p => p.status === 'sold' || p.status === 'retained'), [players]);
  const unsoldPlayers = useMemo(() => players.filter(p => p.status === 'unsold'), [players]);
  const remainPlayers = useMemo(() => players.filter(p => p.status === 'remaining'), [players]);
  const totalSpent    = useMemo(() => soldPlayers.reduce((acc, p) => acc + (p.soldPrice || 0), 0), [soldPlayers]);

  // Top 5 most expensive players sold so far
  const topBuys = useMemo(() => {
    return [...soldPlayers]
      .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
      .slice(0, 5);
  }, [soldPlayers]);

  // ── Leading team & Max Bid Color Theming ──────────────────────────────────
  const leaderId = currentBidder?._id || currentBidder?.id || (typeof currentBidder === 'string' ? currentBidder : null);
  const leadingTeam = teams.find(t => t._id === leaderId) || (currentBidder && typeof currentBidder === 'object' ? currentBidder : null);

  // DYNAMIC MAX BID TEAM COLOR CODE:
  // When a team places the max bid, their custom hex color illuminates the entire screen!
  const maxBidColor = leadingTeam?.color || '#F59E0B';

  // Base price from room rules
  const basePrice = room?.rules?.basePrice || 100;

  // Max a team can spend on ONE player = budgetLeft minus basePrice reserved for each remaining empty slot
  const getMaxBid = useCallback((team) => {
    if (!team) return 0;
    const maxSlots = team.slots || room?.rules?.squadSize || 11;
    const teamPlayerCount = team.players?.length || players.filter(p => (p.soldTo?._id || p.soldTo) === team._id).length;
    const slotsLeft = maxSlots - teamPlayerCount;
    if (slotsLeft <= 0) return 0;
    const budgetLeft = team.budgetLeft ?? team.budget ?? 0;
    return Math.max(0, Math.floor(budgetLeft - (slotsLeft - 1) * basePrice));
  }, [basePrice, players, room]);

  // Next incremental bid calculation
  const getNextIncrement = useCallback((bid) => {
    const defaultInc = room?.rules?.bidIncrement || 10;
    const bonusRules = room?.rules?.bidBonusRules || [];
    const tierRule = bonusRules.find(r => bid >= r.minBid && bid <= r.maxBid);
    if (tierRule?.bidIncrement != null) return tierRule.bidIncrement;
    const incRules = room?.rules?.bidIncrements || [];
    const incRule = incRules.find(r => bid >= r.minBid && bid <= r.maxBid);
    if (incRule?.increment != null) return incRule.increment;
    return defaultInc;
  }, [room]);

  const nextMinBid = currentBid > 0 ? currentBid + getNextIncrement(currentBid) : (currentPlayer?.basePrice || 0);

  // ── Spin Wheel geometry ───────────────────────────────────────────────────
  const wheelSegments = remainPlayers.length > 0 ? remainPlayers : [];
  const wheelCount = wheelSegments.length || 8;
  const wheelSliceAngle = 360 / wheelCount;
  const wheelSize = 430;
  const wheelRadius = wheelSize / 2 - 12;
  const wheelCenter = wheelSize / 2;

  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: wheelCenter + radius * Math.cos(rad), y: wheelCenter + radius * Math.sin(rad) };
  };

  const makeSlicePath = (i) => {
    const start = i * wheelSliceAngle;
    const end   = start + wheelSliceAngle;
    const p1    = polarToCartesian(start, wheelRadius);
    const p2    = polarToCartesian(end, wheelRadius);
    const large = wheelSliceAngle > 180 ? 1 : 0;
    return `M ${wheelCenter} ${wheelCenter} L ${p1.x} ${p1.y} A ${wheelRadius} ${wheelRadius} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#070B14] text-white">
        <style>{PRJ_CSS}</style>
        <div className="relative w-28 h-28 flex items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-ping"/>
          <span className="absolute inset-3 rounded-full border border-sky-400/40 animate-pulse"/>
          <span className="text-6xl animate-bounce">🏏</span>
        </div>
        <h2 className="font-display text-2xl tracking-[0.25em] text-amber-400 mt-6 font-bold uppercase">
          PROJECTOR STAGE SCREEN
        </h2>
        <p className="font-mono text-xs tracking-widest text-slate-400 mt-2">Connecting to auction floor…</p>
      </div>
    );
  }

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#070B14] text-white p-6 text-center">
        <style>{PRJ_CSS}</style>
        <div className="text-7xl mb-4">⚠️</div>
        <h1 className="font-display text-3xl font-bold text-red-400">{error}</h1>
        <p className="text-slate-400 font-mono text-sm mt-3">Check tournament code or network connection.</p>
        <button onClick={loadRoom} className="mt-6 px-6 py-3 rounded-xl bg-amber-500 text-black font-bold font-mono uppercase tracking-wider hover:bg-amber-400">
          🔄 Retry Connection
        </button>
      </div>
    );
  }

  const isCompleted = room?.status === 'completed';

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#070B14] text-white select-none relative font-sans">
      <style>{PRJ_CSS}</style>

      {/* ── Stadium Floodlights & Ambient Glow Background (Dynamically tinted with Max Bid Color) ── */}
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: 'radial-gradient(rgba(148,163,184,0.12) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}/>
      {/* Top Left Floodlight: Shifts to Max Bid Team Color */}
      <div
        className="fixed -top-40 -left-32 w-[650px] h-[650px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${maxBidColor}35 0%, transparent 65%)`,
          animation: 'prjBeam 10s ease-in-out infinite alternate',
        }}
      />
      {/* Bottom Right Floodlight */}
      <div
        className="fixed -bottom-40 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${maxBidColor}25 0%, transparent 65%)`,
          animation: 'prjBeam 12s 3s ease-in-out infinite alternate',
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          TOP BAR: Broadcast Arena Header
          ══════════════════════════════════════════════════════════════════════ */}
      <header className="h-16 px-6 border-b border-white/10 flex items-center justify-between z-30 backdrop-blur-md bg-[#0A0F1D]/90 flex-shrink-0">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-display text-2xl font-black text-slate-950 shadow-lg transition-colors duration-500 flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${maxBidColor}, #F59E0B)`,
              boxShadow: `0 4px 20px ${maxBidColor}66`,
            }}>
            C
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-xl font-black tracking-wider text-white">
                CRIC<span style={{ color: maxBidColor }} className="transition-colors duration-500">ZAAR</span>
              </span>
              <span
                className="text-[11px] font-mono uppercase tracking-[0.25em] px-2 py-0.5 rounded border transition-colors duration-500"
                style={{
                  background: `${maxBidColor}18`,
                  color: maxBidColor,
                  borderColor: `${maxBidColor}55`,
                }}>
                STAGE DISPLAY
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono truncate max-w-sm">
              {room?.name || 'LIVE CRICKET AUCTION'} · CODE: <span className="font-bold text-white">{room?.code}</span>
            </div>
          </div>
        </div>

        {/* Tournament Counters & Progress */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl text-xs font-mono">
            <span className="text-slate-400">TOTAL <strong className="text-white text-sm">{players.length}</strong></span>
            <span className="w-px h-3.5 bg-white/20"/>
            <span className="text-slate-400">SOLD <strong className="text-emerald-400 text-sm">{soldPlayers.length}</strong></span>
            <span className="w-px h-3.5 bg-white/20"/>
            <span className="text-slate-400">UNSOLD <strong className="text-red-400 text-sm">{unsoldPlayers.length}</strong></span>
            <span className="w-px h-3.5 bg-white/20"/>
            <span className="text-slate-400">AVAILABLE <strong className="text-sky-400 text-sm">{remainPlayers.length}</strong></span>
            <span className="w-px h-3.5 bg-white/20"/>
            <span className="text-slate-400">PURSE SPENT <strong className="text-amber-400 text-sm">{Math.round(totalSpent)} pts</strong></span>
          </div>
        </div>

        {/* Live Status Beacon + Audio Mute Toggle + Fullscreen */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {isPaused ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs font-bold tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"/>
              PAUSED
            </span>
          ) : isCompleted ? (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs font-bold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
              🏆 COMPLETED
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs font-bold tracking-wider bg-red-500/15 text-red-400 border border-red-500/40">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"/>
              ON AIR
            </span>
          )}

          {/* Audio toggle button */}
          <button
            onClick={toggleSound}
            title={`Sound ${soundEnabled ? 'Enabled' : 'Muted'} (Hotkey: M)`}
            className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              soundEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}>
            <span>{soundEnabled ? '🔊' : '🔇'}</span>
            <span className="hidden sm:inline">{soundEnabled ? 'AUDIO ON' : 'MUTED'}</span>
          </button>

          {/* Fullscreen Button */}
          <FullscreenButton showLabel={true} size="md" />
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE TICKER TAPE
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="h-7 bg-[#0F1629]/95 border-b border-white/10 flex items-center overflow-hidden z-20 flex-shrink-0">
        <div
          className="px-3 h-full flex items-center font-mono text-[10px] font-bold tracking-[0.2em] text-slate-950 flex-shrink-0 z-10 shadow-md transition-colors duration-500"
          style={{ background: `linear-gradient(135deg, ${maxBidColor}, #D97706)` }}>
          STAGE LIVE
        </div>
        <div className="overflow-hidden flex-1">
          <div className="prj-ticker-track py-0.5">
            {[0, 1].map(copyIdx => (
              <div key={copyIdx} className="flex items-center flex-shrink-0 space-x-8 text-xs font-mono text-slate-300">
                <span className="flex items-center gap-2">
                  <span style={{ color: maxBidColor }}>⚡</span>
                  Tournament: <strong>{room?.name || 'Live Auction'}</strong>
                </span>
                <span className="text-white/20">◆</span>
                <span className="flex items-center gap-2">
                  <span className="text-emerald-400">🎯</span>
                  Total Players: {players.length} | Available: {remainPlayers.length}
                </span>
                <span className="text-white/20">◆</span>
                <span className="flex items-center gap-2">
                  <span className="text-sky-400">🛡️</span>
                  Franchises: {teams.length} Teams
                </span>
                <span className="text-white/20">◆</span>
                {leadingTeam && (
                  <span className="flex items-center gap-2">
                    <span style={{ color: maxBidColor }}>👑</span>
                    Current Highest Bidder: <strong style={{ color: maxBidColor }}>{leadingTeam.name}</strong> ({Math.round(currentBid)} pts)
                  </span>
                )}
                <span className="text-white/20">◆</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN BODY LAYOUT (TWO DISTINCT REGIONS):
          - LEFT / CENTER ZONE: Big Player Card & Arena Bidding (or Spin Wheel / Sold Celebration)
          - RIGHT SIDEBAR ZONE: Full-Height Franchise Team Cards Rack (with Max/Player Points!)
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative z-10">

        {/* ══ LEFT / CENTER MAIN STAGE ZONE (Takes 70-75% width) ══ */}
        <main className="flex-1 min-w-0 flex flex-col p-4 sm:p-5 overflow-hidden min-h-0 relative">

          {/* ── PAUSED STAGE BANNER ── */}
          {isPaused && (
            <div className="mb-3 rounded-2xl py-2 px-6 text-center font-display text-sm tracking-widest bg-amber-500/15 border-2 border-amber-400 text-amber-300 flex-shrink-0 animate-pulse">
              ⏸ AUCTION IS CURRENTLY PAUSED BY THE AUCTIONEER
            </div>
          )}

          {/* ── 1. ACTIVE PLAYER ON THE BLOCK ── */}
          {currentPlayer ? (
            <div className="flex-1 flex flex-col justify-between gap-4 min-h-0 overflow-hidden">

              {/* TOP: BIGGER PLAYER PROFILE CARD CONTAINER */}
              <div className="flex-1 min-h-0 rounded-3xl p-2.5 sm:p-3 border border-white/10 relative overflow-hidden backdrop-blur-xl bg-gradient-to-b from-[#141C33]/90 to-[#0C1222]/90 shadow-2xl flex flex-col justify-between">
                {/* Backlight glow tinted with Max Bid Team Color */}
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none blur-3xl transition-all duration-700 opacity-30"
                  style={{ background: maxBidColor }}
                />

                {/* Top Lot Header HUD */}
                <div className="flex items-center justify-between mb-1.5 z-10 flex-shrink-0 px-2">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 rounded-full font-mono text-xs font-black tracking-[0.25em] bg-black/70 border border-amber-400/60 text-amber-400 shadow-md">
                      LOT #{soldPlayers.length + unsoldPlayers.length + 1}
                    </span>
                    <span className="font-mono text-xs text-slate-300 font-bold uppercase tracking-widest hidden sm:inline">
                      CRICZAAR STAGE LOT CARD
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                      BASE: <strong className="text-amber-400 font-bold">{currentPlayer.basePrice || 0} pts</strong>
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300">
                      NEXT MIN: <strong className="text-sky-400 font-bold">{Math.round(nextMinBid)} pts</strong>
                    </span>
                  </div>
                </div>

                {/* FULL-WIDTH STAGE PLAYER PROFILE CARD */}
                <div className="w-full flex-1 flex flex-col justify-center min-h-0 z-10">
                  <div className="w-full">
                    <PlayerProfileCard player={currentPlayer} size="large" />
                  </div>
                </div>
              </div>

              {/* BOTTOM: LIVE BIDDING ARENA + LEADER PODIUM + COUNTDOWN TIMER */}
              <div
                className="rounded-3xl p-4 sm:p-5 border border-white/10 bg-gradient-to-br from-[#151D36]/95 via-[#0F1629]/95 to-[#0A0F1D]/95 shadow-2xl relative overflow-hidden flex-shrink-0 transition-all duration-700"
                style={{
                  boxShadow: `0 16px 50px rgba(0,0,0,0.5), inset 0 0 40px ${maxBidColor}15`,
                }}>

                {/* Arena Sub-header */}
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: maxBidColor }}/>
                      <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: maxBidColor }}/>
                    </span>
                    <span
                      className="font-mono text-xs font-black tracking-[0.25em] uppercase transition-colors duration-500"
                      style={{ color: maxBidColor }}>
                      LIVE BIDDING ARENA
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    NEXT INCREMENT: <strong className="text-white font-bold">+{getNextIncrement(currentBid)} pts</strong>
                  </span>
                </div>

                {/* 3-Column Arena: Leader Podium (Left) | Circular Timer (Center) | Giant Bid Points (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">

                  {/* 1. Leading Franchise Showcase Podium (5 cols on Left) */}
                  <div className="md:col-span-5">
                    {leadingTeam ? (
                      <div
                        key={leadingTeam._id || leadingTeam.name}
                        style={{
                          animation: 'prjRiseUp 0.4s ease-out backwards',
                          borderColor: `${maxBidColor}88`,
                          background: `linear-gradient(135deg, ${maxBidColor}22, rgba(15,22,41,0.85))`,
                          boxShadow: `0 8px 30px ${maxBidColor}25`,
                        }}
                        className="rounded-2xl p-3 sm:p-3.5 border-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {leadingTeam.logo ? (
                            <img
                              src={leadingTeam.logo}
                              alt={leadingTeam.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border-2 shadow-md flex-shrink-0"
                              style={{ borderColor: maxBidColor }}
                            />
                          ) : (
                            <div
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center font-display text-xl font-black text-slate-950 flex-shrink-0 shadow-md"
                              style={{ background: maxBidColor }}>
                              {leadingTeam.name?.charAt(0) || 'T'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold block" style={{ color: maxBidColor }}>
                              👑 CURRENT HIGHEST BIDDER
                            </span>
                            <h3
                              className="font-display font-black text-xl sm:text-2xl truncate leading-tight mt-0.5"
                              style={{ color: maxBidColor }}>
                              {leadingTeam.name}
                            </h3>
                          </div>
                        </div>
                        <div className="text-right font-mono flex-shrink-0 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Purse Left</span>
                          <span className="text-sm sm:text-base font-bold text-emerald-400">
                            {Math.round(leadingTeam.budgetLeft ?? leadingTeam.budget ?? 0)} pts
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl p-4 border border-dashed border-white/10 bg-white/5 text-center text-slate-400 font-mono text-xs">
                        ⚡ WAITING FOR FIRST OPENING BID
                      </div>
                    )}
                  </div>

                  {/* 2. Circular High-Impact Countdown Timer (3 cols in Center) */}
                  <div className="md:col-span-3 flex items-center justify-center">
                    {timer !== null ? (
                      <div
                        className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center flex-shrink-0"
                        style={{
                          animation: timer <= 5 ? 'prjUrgentBeep 0.5s ease-in-out infinite alternate' : 'none',
                        }}>
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="transparent" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            stroke={timer <= 5 ? '#EF4444' : timer <= 10 ? '#F97316' : maxBidColor}
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 42}
                            strokeDashoffset={2 * Math.PI * 42 * (1 - Math.max(0, timer / (timerMaxRef.current || 30)))}
                            strokeLinecap="round"
                            fill="transparent"
                            style={{
                              transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s',
                              filter: `drop-shadow(0 0 10px ${timer <= 5 ? '#EF4444' : maxBidColor})`,
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                          <span
                            className={`text-3xl sm:text-4xl font-black ${
                              timer <= 5 ? 'text-red-400' : timer <= 10 ? 'text-orange-400' : 'text-amber-400'
                            }`}
                            style={timer > 10 ? { color: maxBidColor } : {}}>
                            {timer}
                          </span>
                          <span className="text-[8px] uppercase tracking-[0.2em] text-slate-400 mt-0.5">
                            SECONDS
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-slate-500 text-center uppercase tracking-widest">
                        Timer Ready
                      </div>
                    )}
                  </div>

                  {/* 3. Giant Current Bid Figure (4 cols on Right) */}
                  <div className="md:col-span-4 flex flex-col justify-center items-end text-right">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400 block mb-1">
                      CURRENT HIGHEST BID
                    </span>
                    <div className="relative inline-flex items-baseline justify-end">
                      {/* Ripple ring on bid update */}
                      <span
                        key={`rp-${currentBid}`}
                        className="absolute -inset-2 rounded-2xl pointer-events-none"
                        style={{
                          border: `2px solid ${maxBidColor}`,
                          animation: 'prjRipple 0.8s ease-out forwards',
                        }}
                      />
                      <div
                        key={currentBid}
                        style={{
                          animation: 'prjBidPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                          color: maxBidColor,
                          textShadow: `0 0 35px ${maxBidColor}77, 0 0 60px ${maxBidColor}33`,
                        }}
                        className="font-mono font-black text-5xl sm:text-6xl lg:text-7xl leading-none tracking-tight">
                        {Math.round(currentBid)}
                      </div>
                      <span
                        className="text-xl sm:text-2xl ml-2 font-black font-mono tracking-wider transition-colors duration-500"
                        style={{ color: maxBidColor, opacity: 0.85 }}>
                        PTS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Micro-Stream of Recent Bids */}
                {recentBids.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400 flex-shrink-0 mr-1">
                      Recent:
                    </span>
                    {recentBids.slice(0, 4).map((b, i) => (
                      <div
                        key={b._id || i}
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono flex items-center gap-2 flex-shrink-0 ${
                          i === 0
                            ? 'bg-amber-500/15 border-amber-400/50 text-amber-300 font-bold shadow-sm'
                            : 'bg-white/5 border-white/5 text-slate-400'
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.teamColor || '#F59E0B' }}/>
                        <span className="font-bold text-white truncate max-w-[100px]">{b.teamName}</span>
                        <span className="text-amber-400 font-black">{Math.round(b.amount)} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          ) : lastResult ? (
            /* ── 2. CELEBRATION TAKEOVER (SOLD / UNSOLD) ── */
            <div className="flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-[#16203D] to-[#0A0F1D] shadow-[0_0_80px_rgba(245,158,11,0.25)] p-8">

              {/* Confetti Explosion for SOLD */}
              {lastResult.type === 'sold' && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 rounded-sm"
                      style={{
                        left: `${(i * 2.1 * 17) % 100}%`,
                        width: `${6 + (i % 4) * 3}px`,
                        height: `${10 + (i % 5) * 4}px`,
                        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                        animation: `prjConfettiFall ${2.5 + (i % 5) * 0.4}s ${(i % 8) * 0.15}s ease-in infinite`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative z-10 max-w-2xl flex flex-col items-center">
                {/* 3D Stamp */}
                <div
                  style={{ animation: 'prjStampIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both' }}
                  className={`inline-block font-display font-black tracking-widest px-10 py-3 rounded-2xl border-4 shadow-2xl text-6xl sm:text-7xl lg:text-8xl uppercase mb-6 ${
                    lastResult.type === 'sold'
                      ? 'border-emerald-400 text-emerald-400 bg-emerald-500/15 shadow-emerald-500/40'
                      : 'border-red-500 text-red-500 bg-red-500/15 shadow-red-500/40'
                  }`}>
                  {lastResult.type === 'sold' ? 'SOLD!' : 'UNSOLD'}
                </div>

                {/* Player Image & Name */}
                <div className="flex flex-col sm:flex-row items-center gap-6 my-4">
                  {(lastResult.player?.photo || lastResult.playerPhoto) ? (
                    <img
                      src={lastResult.player?.photo || lastResult.playerPhoto}
                      alt={lastResult.playerName || lastResult.player?.name}
                      className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl object-cover border-4 border-amber-400 shadow-2xl shadow-amber-500/30"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-3xl bg-amber-500/20 border-4 border-amber-400 flex items-center justify-center font-display text-5xl font-black text-amber-400">
                      {(lastResult.playerName || lastResult.player?.name)?.charAt(0) || 'P'}
                    </div>
                  )}
                  <div className="text-center sm:text-left">
                    <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400 block mb-1">
                      AUCTION LOT RESULT
                    </span>
                    <h2 className="font-display font-black text-4xl sm:text-5xl text-white uppercase tracking-wide">
                      {lastResult.playerName || lastResult.player?.name}
                    </h2>
                  </div>
                </div>

                {/* "SOLD TO [TEAM]" DETAILS */}
                {lastResult.type === 'sold' ? (
                  <div className="mt-4 p-5 rounded-3xl bg-black/60 border border-amber-400/40 backdrop-blur-xl w-full max-w-lg">
                    <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">
                      SOLD TO FRANCHISE
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      {(lastResult.teamLogo || lastResult.team?.logo) ? (
                        <img
                          src={lastResult.teamLogo || lastResult.team?.logo}
                          alt={lastResult.teamName || lastResult.team?.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2"
                          style={{ borderColor: lastResult.teamColor || lastResult.team?.color || '#F59E0B' }}
                        />
                      ) : (
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-3xl font-black text-slate-950"
                          style={{ background: lastResult.teamColor || lastResult.team?.color || '#F59E0B' }}>
                          {(lastResult.teamName || lastResult.team?.name)?.charAt(0) || 'T'}
                        </div>
                      )}
                      <div className="text-left">
                        <div
                          className="font-display font-black text-3xl sm:text-4xl leading-tight"
                          style={{ color: lastResult.teamColor || lastResult.team?.color || '#F59E0B' }}>
                          {lastResult.teamName || lastResult.team?.name}
                        </div>
                        <div className="font-mono text-xs text-slate-400">OFFICIAL SIGNING</div>
                      </div>
                    </div>

                    {/* Final Hammer Price */}
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
                      <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">Winning Bid:</span>
                      <span className="font-mono font-black text-4xl text-amber-400">
                        {Math.round(lastResult.price || 0)} <span className="text-lg text-white/50">pts</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-5 rounded-3xl bg-black/50 border border-red-500/30 text-slate-300 font-mono text-sm max-w-md">
                    No franchise placed an opening bid. Player will enter the Unsold Pool for Round 2.
                  </div>
                )}

                <p className="font-mono text-xs text-slate-400 tracking-[0.25em] uppercase mt-5 animate-pulse">
                  WAITING FOR AUCTIONEER TO CALL NEXT PLAYER…
                </p>
              </div>
            </div>

          ) : isCompleted ? (
            /* ── 3. TOURNAMENT COMPLETED STAGE ── */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-white/10 bg-[#0F1629]/95">
              <div className="text-7xl mb-4 animate-bounce">🏆</div>
              <h1 className="font-display font-black text-5xl text-amber-400 tracking-wide uppercase">
                AUCTION CONCLUDED!
              </h1>
              <p className="font-mono text-slate-400 text-sm mt-3 max-w-md">
                All players have been auctioned. Rosters are complete and teams are locked!
              </p>
            </div>

          ) : (
            /* ── 4. GRAND PROJECTOR SPIN WHEEL & RECORD BUYS (BETWEEN PLAYERS) ── */
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 items-stretch">

              {/* LEFT: GRAND SPIN WHEEL (7 cols) */}
              <div className="lg:col-span-7 rounded-3xl p-5 border border-white/10 bg-gradient-to-br from-[#141C33]/95 to-[#0A0F1D]/95 flex flex-col items-center justify-between relative overflow-hidden shadow-2xl">
                {/* Backlight */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none opacity-25 bg-amber-400 blur-3xl"/>

                {/* Header */}
                <div className="w-full flex items-center justify-between z-10 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${wheelSpinning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}/>
                    <span className="font-mono text-xs font-black tracking-[0.25em] text-amber-400 uppercase">
                      {wheelSpinning ? 'SPINNING FOR NEXT LOT…' : (soldPlayers.length > 0 ? 'STAGE DRAW WHEEL' : 'OPENING STAGE DRAW WHEEL')}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    POOL: <strong className="text-white">{wheelSegments.length} PLAYERS</strong>
                  </span>
                </div>

                {/* Wheel + Pointer */}
                <div className="relative flex items-center justify-center my-auto py-2 z-10">
                  {/* Golden Top Pointer */}
                  <div
                    className={`absolute -top-3 left-1/2 z-20 pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] ${
                      wheelSpinning ? 'animate-[prjPointerTick_0.15s_infinite]' : ''
                    }`}
                    style={{ transform: 'translateX(-50%)' }}>
                    <svg width="34" height="42" viewBox="0 0 34 42">
                      <polygon points="17,42 0,0 17,8 34,0" fill="#F59E0B" stroke="#0A0F1D" strokeWidth="2"/>
                      <polygon points="17,35 6,4 17,9 28,4" fill="#FBBF24"/>
                    </svg>
                  </div>

                  {/* SVG Wheel */}
                  <div
                    className={`relative rounded-full ${wheelSpinning ? 'prj-wheel-glow' : 'shadow-2xl'}`}
                    style={{
                      width: wheelSize,
                      height: wheelSize,
                      transform: `rotate(${wheelRotation}deg)`,
                      transition: wheelSpinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 1)' : 'none',
                    }}>
                    <svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${wheelSize} ${wheelSize}`}>
                      <defs>
                        <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#2E3A5C" />
                          <stop offset="70%" stopColor="#121829" />
                          <stop offset="100%" stopColor="#0A0F1D" />
                        </radialGradient>
                      </defs>

                      {/* Slices */}
                      {wheelSegments.map((seg, i) => {
                        const midAngle = i * wheelSliceAngle + wheelSliceAngle / 2 - 90;
                        const midRad   = midAngle * (Math.PI / 180);
                        const textR    = wheelRadius * 0.68;
                        const tx       = wheelCenter + textR * Math.cos(midRad);
                        const ty       = wheelCenter + textR * Math.sin(midRad);
                        const name     = seg.name || '???';
                        const short    = name.length > 12 ? name.slice(0, 11) + '…' : name;
                        const sliceColor = WHEEL_PALETTE[i % WHEEL_PALETTE.length];

                        return (
                          <g key={seg._id || i}>
                            <path
                              d={makeSlicePath(i)}
                              fill={sliceColor}
                              stroke="#0A0F1D"
                              strokeWidth="2.5"
                            />
                            <text
                              x={tx}
                              y={ty}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                              fill={['#6366F1', '#818CF8', '#A78BFA', '#8B5CF6'].includes(sliceColor) ? '#FFFFFF' : '#0A0F1D'}
                              fontSize="12"
                              fontWeight="800"
                              fontFamily="'Outfit', sans-serif"
                              letterSpacing="0.04em"
                              style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                              {short.toUpperCase()}
                            </text>
                          </g>
                        );
                      })}

                      {/* Perimeter Gold Rim */}
                      <circle
                        cx={wheelCenter}
                        cy={wheelCenter}
                        r={wheelRadius}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="5"
                        style={{ filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.6))' }}
                      />
                      <circle cx={wheelCenter} cy={wheelCenter} r={wheelRadius + 4} fill="none" stroke="#0A0F1D" strokeWidth="3" />

                      {/* Perimeter Stadium LED Bulbs */}
                      {Array.from({ length: 24 }).map((_, bulbIdx) => {
                        const bulbAngle = (bulbIdx * (360 / 24)) * (Math.PI / 180);
                        const bx = wheelCenter + (wheelRadius - 2) * Math.cos(bulbAngle);
                        const by = wheelCenter + (wheelRadius - 2) * Math.sin(bulbAngle);
                        return (
                          <circle
                            key={bulbIdx}
                            cx={bx}
                            cy={by}
                            r={bulbIdx % 2 === 0 ? 3.5 : 2.5}
                            fill={bulbIdx % 2 === 0 ? '#FDE68A' : '#F59E0B'}
                            style={{ filter: 'drop-shadow(0 0 4px #FBBF24)' }}
                          />
                        );
                      })}

                      {/* Metallic Hub */}
                      <circle cx={wheelCenter} cy={wheelCenter} r={28} fill="url(#hubGrad)" stroke="#F59E0B" strokeWidth="4" />
                      <circle cx={wheelCenter} cy={wheelCenter} r={18} fill="#F59E0B" />
                      <circle cx={wheelCenter} cy={wheelCenter} r={10} fill="#121829" />
                    </svg>
                  </div>
                </div>

                {/* Landed Player Spotlight */}
                {wheelLandedPlayer && (
                  <div
                    key={wheelLandedPlayer._id || wheelLandedPlayer.name}
                    style={{ animation: 'prjStampIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both' }}
                    className="z-10 mt-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-black/80 to-amber-500/20 border-2 border-amber-400 flex items-center justify-between gap-4 w-full max-w-lg shadow-xl shadow-amber-500/20">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🎯</span>
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400 font-bold block">
                          SELECTED ON WHEEL
                        </span>
                        <h3 className="font-display font-black text-xl text-white uppercase truncate">
                          {wheelLandedPlayer.name}
                        </h3>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[9px] text-slate-400 block uppercase">Base Price</span>
                      <span className="text-base font-bold text-amber-400">
                        {wheelLandedPlayer.basePrice || 0} pts
                      </span>
                    </div>
                  </div>
                )}

                <div className="z-10 text-center font-mono text-xs text-slate-400 mt-2">
                  {wheelSpinning ? '🌀 DRAWING LOT IN REAL-TIME…' : '🎡 WHEEL SPINS IN SYNC WITH THE AUCTIONEER DESK'}
                </div>
              </div>

              {/* RIGHT: RECORD BUYS & LATEST SIGNING (5 cols) */}
              <div className="lg:col-span-5 rounded-3xl p-5 border border-white/10 bg-[#0F1629]/95 flex flex-col justify-between shadow-2xl overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Latest Confirmed Signing */}
                  {soldPlayers.length > 0 && (() => {
                    const latest = soldPlayers[soldPlayers.length - 1];
                    const buyer = teams.find(t => t._id === (latest?.soldTo?._id || latest?.soldTo));
                    return (
                      <div className="mb-3 p-3.5 rounded-2xl bg-white/5 border border-amber-400/30 backdrop-blur-md flex-shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"/>
                            LATEST CONFIRMED SIGNING
                          </span>
                          <span className="font-mono text-[10px] text-white/50">Hammer Price</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-amber-400 bg-slate-900 flex-shrink-0">
                              {latest?.photo ? (
                                <img src={latest.photo} alt={latest.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-display text-base font-black text-amber-400">
                                  {latest?.name?.charAt(0) || 'P'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-display font-black text-sm text-white truncate uppercase">
                                {latest?.name}
                              </h4>
                              <div
                                className="font-display font-bold text-xs truncate"
                                style={{ color: buyer?.color || '#34D399' }}>
                                🛡️ {buyer?.name || 'Franchise'}
                              </div>
                            </div>
                          </div>
                          <div className="font-mono font-black text-lg text-amber-400 flex-shrink-0 text-right">
                            {Math.round(latest?.soldPrice || 0)} <span className="text-[10px] text-white/40">pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Header */}
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      <h3 className="font-display font-bold text-sm text-white tracking-wide uppercase">
                        RECORD TOURNAMENT BUYS
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-amber-400 font-bold">HALL OF FAME</span>
                  </div>

                  {/* Top Buys List */}
                  {topBuys.length > 0 ? (
                    <div className="space-y-2 overflow-y-auto pr-1">
                      {topBuys.slice(0, soldPlayers.length > 0 ? 4 : 5).map((p, idx) => {
                        const buyerTeam = teams.find(t => t._id === (p.soldTo?._id || p.soldTo));
                        return (
                          <div
                            key={p._id || idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono font-bold text-amber-400 w-5 text-center text-xs">
                                #{idx + 1}
                              </span>
                              <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden border border-white/10 flex-shrink-0">
                                {p.photo ? (
                                  <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-400 text-xs">
                                    {p.name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-display font-bold text-xs text-white truncate uppercase">{p.name}</h4>
                                <span className="text-[10px] font-mono font-semibold" style={{ color: buyerTeam?.color || '#94A3B8' }}>
                                  🛡️ {buyerTeam?.name || 'Franchise'}
                                </span>
                              </div>
                            </div>
                            <div className="font-mono font-black text-amber-400 text-sm flex-shrink-0">
                              {Math.round(p.soldPrice || 0)} <span className="text-[9px] text-white/40">pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-500 font-mono text-xs">
                      No players sold yet. First bids will populate record buys!
                    </div>
                  )}
                </div>

                {/* Tournament stats box */}
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 font-mono flex-shrink-0">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Sold</span>
                    <span className="text-base font-bold text-emerald-400">{soldPlayers.length}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Available</span>
                    <span className="text-base font-bold text-sky-400">{remainPlayers.length}</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                    <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Purse Spent</span>
                    <span className="text-base font-bold text-amber-400">{Math.round(totalSpent)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT SIDEBAR: FULL-HEIGHT FRANCHISE DOCK & SQUAD / BUDGET CARDS
            (REPOSITIONED HERE FROM BOTTOM TO MAXIMIZE PROFILE CARD SIZE & READABILITY)
            ══════════════════════════════════════════════════════════════════════ */}
        <aside className="w-80 lg:w-96 xl:w-[400px] flex-shrink-0 flex flex-col border-l border-white/10 bg-[#0A0F1D]/90 backdrop-blur-xl z-20 overflow-hidden">

          {/* Sidebar Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="font-display font-black text-sm text-white tracking-wider uppercase">
                  FRANCHISE STANDINGS
                </h3>
                <span className="font-mono text-[9px] text-slate-400 block tracking-widest">
                  LIVE BUDGETS & SQUAD LIMITS
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold bg-white/5 border border-white/10 text-amber-400">
              {teams.length} TEAMS
            </span>
          </div>

          {/* Vertical Stack of Franchise Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            {teams.map(team => {
              const isLeader = leadingTeam && leadingTeam._id === team._id;
              const teamColor = team.color || '#F59E0B';
              const maxSlots = team.slots || room?.rules?.squadSize || 11;
              const teamPlayerCount = team.players?.length || players.filter(p => (p.soldTo?._id || p.soldTo) === team._id).length;
              const slotsLeft = Math.max(0, maxSlots - teamPlayerCount);
              const purseLeft = Math.round(team.budgetLeft ?? team.budget ?? 0);
              const maxBid = getMaxBid(team);
              const isFull = slotsLeft === 0;
              const wouldExceed = currentPlayer && !isFull && nextMinBid > maxBid;

              return (
                <div
                  key={team._id}
                  style={{
                    borderColor: isLeader ? teamColor : 'rgba(255,255,255,0.08)',
                    boxShadow: isLeader
                      ? `0 0 25px ${teamColor}55, inset 0 0 15px ${teamColor}15`
                      : '0 4px 15px rgba(0,0,0,0.3)',
                    background: isLeader
                      ? `linear-gradient(145deg, ${teamColor}22, rgba(15,22,41,0.95))`
                      : 'rgba(15,22,41,0.85)',
                  }}
                  className={`p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                    isLeader ? 'border-2 shadow-lg scale-[1.02]' : 'hover:border-white/20 hover:bg-white/5'
                  }`}>

                  {/* Accent Top Stripe */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 transition-all"
                    style={{ background: isLeader ? `linear-gradient(90deg, #F59E0B, ${teamColor})` : teamColor }}
                  />

                  {/* Header: Logo, Name, Badge */}
                  <div className="flex items-center justify-between gap-2 min-w-0 mb-1.5 mt-0.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="w-8 h-8 rounded-xl object-cover border flex-shrink-0 shadow-sm"
                          style={{ borderColor: teamColor }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm text-slate-950 flex-shrink-0 shadow-sm"
                          style={{ background: teamColor }}>
                          {team.name?.charAt(0) || 'T'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4
                          className="font-display font-bold text-sm truncate leading-tight"
                          style={{ color: isLeader ? teamColor : '#FFFFFF' }}>
                          {team.name}
                        </h4>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 mt-0.5">
                          <span>Squad: <strong className="text-white">{teamPlayerCount}</strong>/{maxSlots}</span>
                        </div>
                      </div>
                    </div>

                    {isLeader ? (
                      <span
                        className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse flex-shrink-0"
                        style={{ background: teamColor, color: '#0A0F1D' }}>
                        <span>👑</span> MAX BID
                      </span>
                    ) : isFull ? (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                        FULL
                      </span>
                    ) : wouldExceed ? (
                      <span
                        title={`Next minimum bid (${Math.round(nextMinBid)} pts) exceeds max allowed for this franchise`}
                        className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 flex-shrink-0">
                        OUTBID
                      </span>
                    ) : null}
                  </div>

                  {/* Slots Progress Micro-Bar */}
                  <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden my-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (teamPlayerCount / maxSlots) * 100)}%`,
                        background: teamColor,
                      }}
                    />
                  </div>

                  {/* Dual Stats Grid: Purse Left & Max / Player Points */}
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-white/5 font-mono text-center">
                    <div className="bg-black/30 rounded-lg p-1.5 border border-white/5">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block leading-none mb-0.5">
                        Purse Left
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {purseLeft} <span className="text-[8px] text-white/40">pts</span>
                      </span>
                    </div>

                    <div className="bg-black/30 rounded-lg p-1.5 border border-white/5">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block leading-none mb-0.5">
                        Max / Player
                      </span>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: isFull ? '#94A3B8' : isLeader ? teamColor : '#FBBF24',
                        }}>
                        {isFull ? '—' : `${maxBid}`} <span className="text-[8px] text-white/40">{isFull ? '' : 'pts'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer Summary Bar */}
          <div className="p-3 border-t border-white/10 bg-black/40 flex-shrink-0 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Total Spent</span>
            <span className="font-bold text-amber-400">{Math.round(totalSpent)} pts</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
