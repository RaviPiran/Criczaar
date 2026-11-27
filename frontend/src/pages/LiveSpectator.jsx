import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import FullscreenButton from '../components/FullscreenButton';
import criczaarLogo from '../logo.png';

/* ── page-local styles & keyframes (prefixed ls-) ───────────────────── */
const LS_CSS = `
@property --ls-ang { syntax:'<angle>'; initial-value:0deg; inherits:false; }
@keyframes lsSpin    { to { --ls-ang:360deg; } }
@keyframes lsRise    { from{opacity:0;transform:translateY(22px) scale(.98)} to{opacity:1;transform:none} }
@keyframes lsFade    { from{opacity:0} to{opacity:1} }
@keyframes lsPop     { 0%{transform:scale(.7);opacity:.2;filter:blur(6px)} 55%{transform:scale(1.1);opacity:1;filter:none} 100%{transform:scale(1)} }
@keyframes lsRipple  { from{transform:scale(.4);opacity:.7} to{transform:scale(3);opacity:0} }
@keyframes lsMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes lsDrift   { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,40px) scale(1.15)} }
@keyframes lsPing    { 0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)} 100%{box-shadow:0 0 0 12px rgba(245,158,11,0)} }
@keyframes lsFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes lsStamp   { 0%{transform:scale(2.6) rotate(-16deg);opacity:0} 60%{transform:scale(.92) rotate(-6deg);opacity:1} 100%{transform:scale(1) rotate(-6deg);opacity:1} }
@keyframes lsConfetti{ 0%{transform:translateY(-30px) rotate(0);opacity:1} 100%{transform:translateY(360px) rotate(720deg);opacity:0} }
@keyframes lsGrad    { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
@keyframes lsSlide   { from{opacity:0;transform:translateX(-18px)} to{opacity:1;transform:none} }
@keyframes lsUrgent  { from{transform:scale(1)} to{transform:scale(1.08)} }
@keyframes lsBar     { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@keyframes lsGlow    { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.4),0 10px 30px rgba(245,158,11,.10)} 50%{box-shadow:0 0 0 6px rgba(245,158,11,0),0 10px 34px rgba(245,158,11,.28)} }
@keyframes lsFlash   { from{opacity:.9} to{opacity:0} }
.ls-stage { position:relative; isolation:isolate; }
.ls-stage::before { content:''; position:absolute; inset:0; border-radius:inherit; padding:1.5px; pointer-events:none; z-index:3;
  background:conic-gradient(from var(--ls-ang),#F59E0B,#38BDF8,#6366F1,#F59E0B);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude;
  animation:lsSpin 6s linear infinite; opacity:.85; }
.ls-gradtext { background:linear-gradient(100deg,#F59E0B,#FBBF24 30%,#38BDF8 65%,#6366F1); background-size:220% 100%;
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:lsGrad 6s ease infinite; }
.ls-card { transition:transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
.ls-card:hover { transform:translateY(-3px); border-color:rgba(245,158,11,.4)!important; box-shadow:0 14px 40px rgba(0,0,0,.45); }
.ls-marquee { display:flex; width:max-content; animation:lsMarquee 38s linear infinite; }
.ls-marquee:hover { animation-play-state:paused; }
.ls-scroll::-webkit-scrollbar { width:5px; height:5px; }
.ls-scroll::-webkit-scrollbar-thumb { background:#2E3A5C; border-radius:5px; }
@media (prefers-reduced-motion: reduce){ .ls-root *, .ls-root *::before { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; } }
`;

// eased count-up (re-runs when target / key changes)
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

function Stat({ icon, value, label, color, delay = 0 }) {
  const n = useCountUp(value);
  return (
    <div className="ls-card rounded-2xl p-3 sm:p-4 border" style={{ background:'rgba(18,24,41,0.7)', borderColor:'rgba(255,255,255,0.08)', backdropFilter:'blur(8px)', animation:`lsRise .6s ${delay}ms cubic-bezier(.22,1,.36,1) backwards` }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase text-white/40">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="font-mono text-2xl sm:text-3xl font-bold mt-1 leading-none" style={{ color }}>{n}</div>
    </div>
  );
}

function TimerRing({ seconds, max, size = 92 }) {
  const R = 34, C = 2 * Math.PI * R;
  const pct = max > 0 ? Math.max(0, Math.min(seconds / max, 1)) : 1;
  const color = seconds <= 5 ? '#F87171' : seconds <= 10 ? '#FB923C' : '#F59E0B';
  return (
    <div className="relative flex-shrink-0" style={{ width:size, height:size, animation: seconds <= 5 ? 'lsUrgent .5s ease-in-out infinite alternate' : 'none' }}>
      <div className="absolute inset-1 rounded-full" style={{ background:`radial-gradient(circle,${color}33,transparent 70%)` }}/>
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
        <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
          style={{ transition:'stroke-dashoffset .9s linear, stroke .3s', filter:`drop-shadow(0 0 5px ${color})` }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-bold leading-none" style={{ color }}>
        <span className="text-2xl">{seconds}</span>
        <span className="text-[8px] tracking-[0.2em] mt-0.5 opacity-60">SEC</span>
      </div>
    </div>
  );
}

const CONFETTI = ['#F59E0B','#FBBF24','#38BDF8','#6366F1','#10B981','#F87171'];
const AVATAR = `${process.env.PUBLIC_URL || ''}/non-profile.png`;

const API_URL    = process.env.REACT_APP_API_URL    || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// ── tiny public axios (no auth header) ───────────────────────────────────────
const PUB = axios.create({ baseURL: API_URL });

export default function LiveSpectator() {
  const { roomCode } = useParams();

  const [room,          setRoom]          = useState(null);
  const [teams,         setTeams]         = useState([]);
  const [players,       setPlayers]       = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid,    setCurrentBid]    = useState(0);
  const [currentBidder, setCurrentBidder] = useState(null);
  const [timer,         setTimer]         = useState(null);
  const [isPaused,      setIsPaused]      = useState(false);
  const [log,           setLog]           = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [lastResult,    setLastResult]    = useState(null); // { player, team, price, type }
  const [activeTab,     setActiveTab]     = useState('squads'); // squads | players | log
  const [copied,        setCopied]        = useState(false);

  const socketRef = useRef(null);
  const logRef    = useRef(null);
  const timerMaxRef = useRef(0);   // highest timer value seen for the current player (ring scale)

  // ── Load full room data ───────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    try {
      // Step 1: get room _id from code
      const { data: codeRes } = await PUB.get(`/rooms/${roomCode.toUpperCase()}`);
      if (!codeRes.success) { setError('Auction not found.'); setLoading(false); return; }
      const roomData = codeRes.data;

      // Step 2: get full data (teams + players) — public endpoint no auth needed
      const { data: fullRes } = await PUB.get(`/rooms/public/${roomData._id}/full`);
      if (!fullRes.success) { setError('Could not load auction data.'); setLoading(false); return; }

      const { room: r, teams: t, players: p } = fullRes.data;
      setRoom(r);
      setTeams(t || []);
      setPlayers(p || []);
      setCurrentPlayer(r.currentPlayer || null);
      setCurrentBid(r.currentBid || 0);
      setCurrentBidder(r.currentBidder || null);
      setIsPaused(r.status === 'paused');
      setLog(
        (r.auctionLog || [])
          .slice(-50)
          .reverse()
          .map((l, i) => ({ ...l, _key: i }))
      );
      setLoading(false);

      // Step 3: connect socket and join room
      connectSocket(r._id);
    } catch (err) {
      setError('Auction not found. Check your link.');
      setLoading(false);
    }
  }, [roomCode]);

  const connectSocket = (roomId) => {
    if (socketRef.current?.connected) return;
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
    });
    socketRef.current = s;

    s.on('connect',    () => s.emit('join-room', roomId));
    s.on('reconnect',  () => s.emit('join-room', roomId));

    // Live bid update
    s.on('bid-update', ({ currentBid: bid, currentBidder: bidder }) => {
      setCurrentBid(bid);
      setCurrentBidder(bidder);
      pushLog(`💰 ${bidder?.name || 'Team'} bids ${bid} pts`, 'bid');
    });

    // Next player up
    s.on('next-player', (player) => {
      setCurrentPlayer(player);
      setCurrentBid(player?.basePrice || 0);
      setCurrentBidder(null);
      setTimer(null);
      timerMaxRef.current = 0;
      setLastResult(null);
      if (player) pushLog(`🎯 Now on auction: ${player.name}`, 'info');
    });

    // Timer ticks
    s.on('timer-tick',    ({ remaining }) => setTimer(remaining));
    s.on('timer-stopped', ()             => setTimer(null));
    s.on('timer-expired', ()             => setTimer(0));

    // Player sold
    s.on('player-result', (result) => {
      if (result?.type === 'sold') {
        setLastResult(result);
        setCurrentPlayer(null);
        setCurrentBid(0);
        setCurrentBidder(null);
        setTimer(null);
        pushLog(`✅ ${result.player?.name} → ${result.team?.name} @ ${result.price} pts`, 'sold');
        // Update local player & team state
        setPlayers(prev => prev.map(p =>
          p._id === result.player?._id ? { ...p, status: 'sold', soldTo: result.team?._id, soldPrice: result.price } : p
        ));
        setTeams(prev => prev.map(t =>
          t._id === result.team?._id
            ? { ...t, budgetLeft: Math.round((t.budgetLeft - result.price) * 10) / 10,
                players: [...(t.players || []), { player: result.player, soldPrice: result.price }] }
            : t
        ));
      } else if (result?.type === 'unsold') {
        setLastResult(result);
        setCurrentPlayer(null);
        setCurrentBid(0);
        setCurrentBidder(null);
        setTimer(null);
        pushLog(`❌ ${result.player?.name} — UNSOLD`, 'unsold');
        setPlayers(prev => prev.map(p =>
          p._id === result.player?._id ? { ...p, status: 'unsold' } : p
        ));
      }
    });

    // Pause / resume
    s.on('auction-paused',  () => { setIsPaused(true);  pushLog('⏸ Auction paused',  'info'); });
    s.on('auction-resumed', () => { setIsPaused(false); pushLog('▶ Auction resumed', 'info'); });

    // Full state sync (emitted when spectator first joins)
    s.on('room-state', (state) => {
      if (state.currentBid)    setCurrentBid(state.currentBid);
      if (state.currentBidder) setCurrentBidder(state.currentBidder);
    });

    // Admin made a live correction (price fix / sent player back to pool) — refresh everything
    s.on('admin-update', () => { loadRoom(); pushLog('🛠 Auction data updated by admin', 'info'); });

    s.on('disconnect', () => {});
  };

  const pushLog = (message, type = 'info') => {
    setLog(prev => [{ message, type, timestamp: new Date(), _key: Date.now() }, ...prev.slice(0, 99)]);
  };

  useEffect(() => {
    loadRoom();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [loadRoom]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [log]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const soldCount      = players.filter(p => p.status === 'sold' || p.status === 'retained').length;
  const unsoldCount    = players.filter(p => p.status === 'unsold').length;
  const remainingCount = players.filter(p => p.status === 'remaining').length;
  const totalCount     = players.length;

  const getTeamPlayers = (team) => {
    if (team.players?.length) {
      return team.players.filter(tp => tp.player).map(tp => ({
        ...(tp.player._id ? tp.player : { _id: tp.player, name: '—' }),
        soldPrice: tp.soldPrice, isRetained: tp.isRetained,
      }));
    }
    return players.filter(p => {
      const id = p.soldTo?._id || p.soldTo;
      return id === team._id;
    });
  };

  // timer ring scale — highest value seen for this player
  if (timer !== null && timer > timerMaxRef.current) timerMaxRef.current = timer;

  // resolve the leading team (socket may send an object or just an id)
  const leaderId   = currentBidder?._id || (typeof currentBidder === 'string' ? currentBidder : null);
  const leaderTeam = teams.find(t => t._id === leaderId) || (currentBidder && typeof currentBidder === 'object' ? currentBidder : null);
  const leaderName  = leaderTeam?.name || null;
  const leaderColor = leaderTeam?.color || '#34D399';

  const bidLadder = log.filter(l => l.type === 'bid').slice(0, 5);
  const tickerItems = log.filter(l => ['sold', 'unsold', 'bid', 'info'].includes(l.type)).slice(0, 14);
  const progressPct = totalCount ? Math.round(((soldCount + unsoldCount) / totalCount) * 100) : 0;
  const animatedBid = useCountUp(currentBid, 450, currentBid);
  const soldPrice   = useCountUp(lastResult?.price || 0, 900, lastResult?.player?._id);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="ls-root min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: 'radial-gradient(circle at 50% 40%,rgba(245,158,11,0.12),transparent 55%),#0A0F1D' }}>
      <style>{LS_CSS}</style>
      <div className="relative w-24 h-24 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full" style={{ border:'2px solid rgba(245,158,11,0.5)', animation:'lsRipple 1.8s ease-out infinite' }}/>
        <span className="absolute inset-0 rounded-full" style={{ border:'2px solid rgba(99,102,241,0.5)', animation:'lsRipple 1.8s .6s ease-out infinite' }}/>
        <div className="text-5xl" style={{ animation:'lsFloat 1.6s ease-in-out infinite' }}>🏏</div>
      </div>
      <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/50" style={{ animation:'lsFade 1s ease infinite alternate' }}>Joining live auction…</p>
    </div>
  );

  if (error) return (
    <div className="ls-root min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ background: 'radial-gradient(circle at 50% 40%,rgba(248,113,113,0.10),transparent 55%),#0A0F1D' }}>
      <style>{LS_CSS}</style>
      <div className="text-6xl" style={{ animation:'lsFloat 3s ease-in-out infinite' }}>📡</div>
      <h2 className="text-white font-display text-3xl" style={{ animation:'lsRise .6s backwards' }}>Auction not found</h2>
      <p className="text-white/50 text-sm max-w-xs" style={{ animation:'lsRise .6s .1s backwards' }}>{error}</p>
      <a href="/" className="mt-2 px-5 py-2.5 rounded-xl font-bold text-sm" style={{ background:'linear-gradient(135deg,#FBBF24,#F59E0B)', color:'#0A0F1D' }}>Go to CricZaar</a>
    </div>
  );

  const isCompleted = room?.status === 'completed';

  return (
    <div className="ls-root min-h-screen text-white relative overflow-x-hidden"
      style={{ background: 'radial-gradient(1100px 560px at 10% -10%,rgba(245,158,11,0.08),transparent 60%),radial-gradient(900px 600px at 100% 100%,rgba(99,102,241,0.12),transparent 60%),#0A0F1D', fontFamily: "'Inter', sans-serif", paddingBottom: currentPlayer ? 84 : 0 }}>
      <style>{LS_CSS}</style>

      {/* ambient background */}
      <div className="fixed inset-0 pointer-events-none" style={{ opacity:.5, backgroundImage:'radial-gradient(rgba(133,145,176,.16) 1px,transparent 1px)', backgroundSize:'22px 22px' }}/>
      <div className="fixed pointer-events-none rounded-full" style={{ top:-120, left:-120, width:420, height:420, background:'radial-gradient(circle,rgba(245,158,11,0.16),transparent 70%)', animation:'lsDrift 18s ease-in-out infinite alternate' }}/>
      <div className="fixed pointer-events-none rounded-full" style={{ bottom:-140, right:-120, width:480, height:480, background:'radial-gradient(circle,rgba(99,102,241,0.18),transparent 70%)', animation:'lsDrift 18s -7s ease-in-out infinite alternate' }}/>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-xl" style={{ background:'rgba(10,15,29,0.82)', borderColor:'rgba(255,255,255,0.07)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl p-1 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background:'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(10,15,29,0.9))', animation:'lsGlow 2.4s ease-in-out infinite' }}>
              <img src={criczaarLogo} alt="CricZaar" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl leading-none">CRIC<span className="ls-gradtext">ZAAR</span></div>
              <div className="font-mono text-[9px] tracking-[0.25em] text-white/35 mt-1 truncate">{room?.name || 'LIVE AUCTION'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPaused ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-widest" style={{ background:'rgba(251,191,36,0.14)', color:'#FBBF24', border:'1px solid rgba(251,191,36,0.4)' }}>⏸ PAUSED</span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-widest" style={{ background:'rgba(16,185,129,0.14)', color:'#34D399', border:'1px solid rgba(16,185,129,0.4)' }}>🏆 COMPLETED</span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-widest" style={{ background:'rgba(245,158,11,0.14)', color:'#FBBF24', border:'1px solid rgba(245,158,11,0.4)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation:'lsPing 1.6s ease-out infinite' }}/>LIVE
              </span>
            )}
            <button onClick={copyLink}
              className="px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold tracking-widest uppercase border transition-all active:scale-95"
              style={{ borderColor:'rgba(255,255,255,0.12)', color: copied ? '#34D399' : 'rgba(255,255,255,0.6)', background:'rgba(255,255,255,0.04)' }}>
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>
            <FullscreenButton size="sm" />
          </div>
        </div>

        {/* ticker */}
        <div className="overflow-hidden border-t flex items-center" style={{ borderColor:'rgba(255,255,255,0.05)', background:'rgba(18,24,41,0.6)' }}>
          <div className="flex-shrink-0 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] z-10" style={{ background:'linear-gradient(135deg,#FBBF24,#F59E0B)', color:'#0A0F1D' }}>LIVE FEED</div>
          <div className="overflow-hidden flex-1">
            <div className="ls-marquee py-1.5">
              {[0, 1].map(k => (
                <div key={k} className="flex items-center flex-shrink-0">
                  {(tickerItems.length ? tickerItems : [{ message:'Welcome to the live auction — share this link with friends', type:'info' }]).map((t, i) => (
                    <span key={`${k}-${i}`} className="px-6 text-xs whitespace-nowrap" style={{ color: { sold:'#34D399', unsold:'#F87171', bid:'#FBBF24', info:'#B6BFD8' }[t.type] || '#B6BFD8' }}>
                      {t.message}<span className="ml-6 text-white/15">◆</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 py-6 space-y-6" style={{ zIndex:1 }}>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon="🏏" value={totalCount}     label="Players"   color="#B6BFD8" delay={0}/>
          <Stat icon="✅" value={soldCount}      label="Sold"      color="#34D399" delay={70}/>
          <Stat icon="⛔" value={unsoldCount}    label="Unsold"    color="#F87171" delay={140}/>
          <Stat icon="⏳" value={remainingCount} label="Remaining" color="#38BDF8" delay={210}/>
        </div>

        {/* ── Auction progress ─────────────────────────────────────────── */}
        <div style={{ animation:'lsRise .6s .25s backwards' }}>
          <div className="flex justify-between font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1.5">
            <span>Auction progress</span><span className="text-white/70">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full" style={{ width:`${progressPct}%`, background:'linear-gradient(90deg,#F59E0B,#38BDF8,#6366F1)', transition:'width 1.2s cubic-bezier(.22,1,.36,1)' }}/>
          </div>
        </div>

        {/* ══ STAGE ════════════════════════════════════════════════════════ */}
        <section className="ls-stage rounded-3xl overflow-hidden"
          style={{ background:'linear-gradient(160deg,rgba(23,30,51,0.95),rgba(18,24,41,0.92))', boxShadow:'0 24px 70px rgba(0,0,0,0.5)', animation:'lsRise .7s .1s cubic-bezier(.22,1,.36,1) backwards' }}>
          <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full pointer-events-none" style={{ background:'radial-gradient(circle,rgba(99,102,241,0.25),transparent 70%)', animation:'lsDrift 16s ease-in-out infinite alternate' }}/>
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full pointer-events-none" style={{ background:'radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)', animation:'lsDrift 16s -8s ease-in-out infinite alternate' }}/>

          {currentPlayer ? (
            <div key={currentPlayer._id || currentPlayer.name} className="relative grid md:grid-cols-[300px_1fr] gap-6 p-5 sm:p-7" style={{ animation:'lsRise .7s cubic-bezier(.22,1,.36,1) backwards' }}>
              {/* photo */}
              <div className="relative mx-auto w-full max-w-[300px] rounded-2xl overflow-hidden border"
                style={{ aspectRatio:'4 / 5', borderColor:'rgba(255,255,255,0.12)', background:'linear-gradient(160deg,#1B2440,#0A0F1D)', boxShadow:'0 0 40px rgba(245,158,11,0.15)' }}>
                {currentPlayer.photo
                  ? <img src={currentPlayer.photo} alt={currentPlayer.name} className="w-full h-full object-cover" style={{ animation:'lsFade .8s ease' }}/>
                  : <img src={AVATAR} alt={currentPlayer.name} draggable={false} className="absolute bottom-0" style={{ width:'118%', maxWidth:'none', transform:'translateX(-50%)', animation:'lsFloat 6s ease-in-out infinite' }}/>}
                <div className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none" style={{ background:'linear-gradient(to top,rgba(10,15,29,0.85),transparent)' }}/>
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ background:'rgba(10,15,29,0.7)', border:'1px solid rgba(245,158,11,0.5)', color:'#FBBF24' }}>
                  Lot #{soldCount + unsoldCount + 1}
                </span>
                {currentPlayer.role && (
                  <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.18em] uppercase" style={{ background:'rgba(99,102,241,0.85)', color:'#fff' }}>{currentPlayer.role}</span>
                )}
              </div>

              {/* info */}
              <div className="min-w-0 flex flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.18em] uppercase mb-3"
                      style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)', color:'#FBBF24' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: isPaused ? 'none' : 'lsPing 1.6s ease-out infinite' }}/>
                      {isPaused ? 'Paused' : 'Now on the block'}
                    </div>
                    <h2 className="font-display font-extrabold text-white leading-[0.98]" style={{ fontSize:'clamp(32px,6vw,58px)', textShadow:'0 2px 24px rgba(0,0,0,0.6)' }}>
                      {(currentPlayer.name || '').split(' ').map((w, i) => (
                        <span key={i} className="inline-block mr-3" style={{ animation:`lsRise .6s ${i * 120 + 100}ms cubic-bezier(.22,1,.36,1) backwards` }}>{w}</span>
                      ))}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentPlayer.club && <span className="px-2.5 py-1 rounded-full text-xs text-white/60 border" style={{ borderColor:'rgba(255,255,255,0.12)' }}>{currentPlayer.club}</span>}
                      {currentPlayer.battingStyle && <span className="px-2.5 py-1 rounded-full text-xs text-white/60 border" style={{ borderColor:'rgba(255,255,255,0.12)' }}>🏏 {currentPlayer.battingStyle}</span>}
                      {currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'N/A' && <span className="px-2.5 py-1 rounded-full text-xs text-white/60 border" style={{ borderColor:'rgba(255,255,255,0.12)' }}>🎯 {currentPlayer.bowlingStyle}</span>}
                    </div>
                  </div>
                  {timer !== null && <TimerRing seconds={timer} max={timerMaxRef.current}/>}
                </div>

                {/* bid */}
                <div className="relative rounded-2xl p-4 sm:p-5 border overflow-hidden" style={{ background:'rgba(10,15,29,0.55)', borderColor:'rgba(255,255,255,0.08)' }}>
                  <span key={`fl-${currentBid}`} className="absolute inset-0 pointer-events-none" style={{ background:'linear-gradient(120deg,transparent,rgba(245,158,11,0.35),transparent)', animation:'lsFlash .8s ease-out forwards' }}/>
                  <div className="flex items-end justify-between gap-4 flex-wrap relative">
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1">Current highest bid</div>
                      <div className="relative inline-block">
                        <span key={`rp-${currentBid}`} className="absolute left-1/2 top-1/2 w-20 h-20 -ml-10 -mt-10 rounded-full pointer-events-none" style={{ border:'2px solid rgba(245,158,11,0.6)', animation:'lsRipple .9s ease-out forwards' }}/>
                        <div key={currentBid} className="font-mono font-black leading-none" style={{ fontSize:'clamp(44px,9vw,72px)', color:'#F59E0B', textShadow:'0 0 30px rgba(245,158,11,0.45)', animation:'lsPop .55s cubic-bezier(.34,1.56,.64,1) both' }}>
                          {Math.round(currentBid)}<span className="text-xl ml-2 text-white/40 font-bold">pts</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] tracking-wider text-white/40 space-y-1">
                      <div>BASE <span className="text-white/70 font-bold">{currentPlayer.basePrice} pts</span></div>
                      {room?.rules?.maxPlayerPrice ? <div>CAP <span className="text-amber-400 font-bold">{room.rules.maxPlayerPrice} pts</span></div> : null}
                    </div>
                  </div>

                  <div className="mt-4 min-h-[34px] relative">
                    {leaderName ? (
                      <span key={leaderId || leaderName} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold"
                        style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${leaderColor}`, color:leaderColor, animation:'lsRise .5s cubic-bezier(.22,1,.36,1) backwards' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background:leaderColor, animation:'lsPing 1.6s ease-out infinite' }}/>
                        🏆 {leaderName}
                        <span className="font-mono text-[9px] tracking-[0.18em] opacity-70">HOLDING BID</span>
                      </span>
                    ) : (
                      <span className="text-sm text-white/40">No bids yet — be ready!</span>
                    )}
                  </div>
                </div>

                {/* bid ladder */}
                {bidLadder.length > 0 && (
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/35 mb-2">Latest bids</div>
                    <div className="space-y-1.5">
                      {bidLadder.map((b, i) => (
                        <div key={b._key || i} className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs border"
                          style={{ background: i === 0 ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.03)', borderColor: i === 0 ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.05)', opacity: 1 - i * 0.15, animation:'lsSlide .45s cubic-bezier(.22,1,.36,1) backwards' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? '#F59E0B' : '#8591B0' }}/>
                          <span className="flex-1 truncate" style={{ color: i === 0 ? '#FBBF24' : '#B6BFD8' }}>{b.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          ) : lastResult ? (
            <div key={lastResult.player?._id || 'res'} className="relative p-8 sm:p-12 text-center overflow-hidden" style={{ animation:'lsFade .4s ease' }}>
              {lastResult.type === 'sold' && Array.from({ length: 26 }).map((_, i) => (
                <span key={i} className="absolute top-0 pointer-events-none" style={{
                  left:`${(i * 37) % 100}%`, width: 6 + (i % 3) * 3, height: 10 + (i % 4) * 3,
                  background: CONFETTI[i % CONFETTI.length], borderRadius: i % 2 ? 2 : 9,
                  animation:`lsConfetti ${2.2 + (i % 5) * .4}s ${(i % 7) * .12}s ease-in forwards`,
                }}/>
              ))}
              <div className="relative">
                <div className="inline-block font-display font-black tracking-[0.12em] px-8 py-2 rounded-xl"
                  style={{
                    fontSize:'clamp(40px,9vw,76px)', lineHeight:1.1,
                    color: lastResult.type === 'sold' ? '#34D399' : '#F87171',
                    border:`4px solid ${lastResult.type === 'sold' ? '#34D399' : '#F87171'}`,
                    textShadow:`0 0 30px ${lastResult.type === 'sold' ? 'rgba(16,185,129,0.6)' : 'rgba(248,113,113,0.6)'}`,
                    animation:'lsStamp .7s cubic-bezier(.22,1,.36,1) both',
                  }}>
                  {lastResult.type === 'sold' ? 'SOLD!' : 'UNSOLD'}
                </div>
                <div className="font-display font-extrabold text-white mt-6" style={{ fontSize:'clamp(26px,5vw,42px)', animation:'lsRise .6s .4s backwards' }}>{lastResult.player?.name}</div>
                {lastResult.type === 'sold' ? (
                  <div className="mt-2" style={{ animation:'lsRise .6s .55s backwards' }}>
                    <span className="text-white/50">to </span>
                    <span className="font-bold text-lg" style={{ color: lastResult.team?.color || '#34D399' }}>{lastResult.team?.name}</span>
                    <div className="font-mono font-black mt-1" style={{ fontSize:36, color:'#F59E0B', textShadow:'0 0 26px rgba(245,158,11,0.5)' }}>{soldPrice} <span className="text-base text-white/40">pts</span></div>
                  </div>
                ) : (
                  <div className="text-white/45 mt-2" style={{ animation:'lsRise .6s .55s backwards' }}>No team picked this player</div>
                )}
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/30 mt-6" style={{ animation:'lsFade 1s 1s ease infinite alternate backwards' }}>Waiting for next player…</div>
              </div>
            </div>

          ) : isCompleted ? (
            <div className="relative p-10 text-center">
              <div className="text-6xl mb-3" style={{ animation:'lsFloat 3s ease-in-out infinite' }}>🏆</div>
              <h2 className="font-display font-extrabold text-4xl ls-gradtext">Auction Completed!</h2>
              <p className="text-white/45 mt-2">All players have been auctioned. Check out the final squads below.</p>
            </div>

          ) : (
            <div className="relative p-12 text-center">
              <div className="relative w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full" style={{ border:'2px solid rgba(245,158,11,0.5)', animation:'lsRipple 2s ease-out infinite' }}/>
                <span className="absolute inset-0 rounded-full" style={{ border:'2px solid rgba(99,102,241,0.5)', animation:'lsRipple 2s .7s ease-out infinite' }}/>
                <span className="text-5xl" style={{ animation:'lsFloat 3s ease-in-out infinite' }}>🏏</span>
              </div>
              <p className="font-display text-2xl text-white/80">{isPaused ? 'Auction is paused' : 'Waiting for the auction to start'}</p>
              <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/35 mt-2">This page updates automatically</p>
            </div>
          )}
        </section>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 p-1 rounded-2xl w-full sm:w-fit" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
          {[['squads','🏟 Teams'], ['players','👥 Players'], ['log','📜 Activity']].map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className="flex-1 sm:flex-none px-5 py-2 text-sm font-bold rounded-xl transition-all duration-300 active:scale-95"
              style={activeTab === k
                ? { background:'linear-gradient(135deg,#FBBF24,#F59E0B)', color:'#0A0F1D', boxShadow:'0 6px 18px rgba(245,158,11,0.3)' }
                : { color:'rgba(255,255,255,0.5)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── TEAMS ────────────────────────────────────────────────────── */}
        {activeTab === 'squads' && (
          <div key="squads" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map((team, ti) => {
              const tp        = getTeamPlayers(team);
              const spent     = (team.budget || 0) - (team.budgetLeft ?? 0);
              const pct       = Math.min(Math.round((spent / (team.budget || 1)) * 100), 100);
              const slotsLeft = (team.slots || 11) - tp.length;
              const basePrice = room?.rules?.basePrice || 0;
              const maxPlayerPrice = room?.rules?.maxPlayerPrice;
              const computedMax = slotsLeft > 0 ? Math.max(0, Math.round((team.budgetLeft ?? 0) - basePrice * (slotsLeft - 1))) : 0;
              const maxBid    = maxPlayerPrice ? Math.min(computedMax, maxPlayerPrice) : computedMax;
              const isLeading = !!currentPlayer && leaderId === team._id;
              const tc        = team.color || '#F59E0B';
              return (
                <div key={team._id} className="ls-card relative rounded-2xl overflow-hidden border"
                  style={{
                    background: isLeading ? `linear-gradient(160deg,${tc}22,rgba(18,24,41,0.92))` : 'rgba(18,24,41,0.75)',
                    borderColor: isLeading ? tc : 'rgba(255,255,255,0.08)',
                    backdropFilter:'blur(8px)',
                    animation:`lsRise .6s ${ti * 70}ms cubic-bezier(.22,1,.36,1) backwards${isLeading ? ', lsGlow 2s ease-in-out infinite' : ''}`,
                  }}>
                  <div className="h-1" style={{ background:`linear-gradient(90deg,${tc},rgba(99,102,241,0.6))`, transformOrigin:'left', animation:`lsBar .8s ${ti * 70 + 200}ms cubic-bezier(.22,1,.36,1) backwards` }}/>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: tc, boxShadow:`0 0 18px ${tc}55` }}>
                        {team.logo
                          ? <img src={team.logo} alt={team.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center font-display text-xl text-white" style={{ background: tc }}>{team.name?.[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-xl text-white truncate">{team.name}</div>
                        <div className="font-mono text-[10px] tracking-widest text-white/40">{tp.length}/{team.slots || 11} PLAYERS</div>
                      </div>
                      {isLeading && <span className="font-mono text-[9px] font-black tracking-widest px-2 py-1 rounded-full" style={{ color:tc, border:`1px solid ${tc}`, animation:'lsPop .5s both' }}>LEADING</span>}
                    </div>

                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/35">Purse left</div>
                        <div className="font-mono font-bold text-lg" style={{ color:(team.budgetLeft ?? 0) < 100 ? '#F87171' : '#34D399' }}>{Math.round(team.budgetLeft ?? 0)} <span className="text-xs opacity-60">pts</span></div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/35">Max / player</div>
                        <div className="font-mono font-bold text-lg" style={{ color: slotsLeft === 0 ? '#6B7280' : '#FBBF24' }}>{slotsLeft === 0 ? 'FULL' : `${maxBid}`}{slotsLeft !== 0 && <span className="text-xs opacity-60"> pts</span>}</div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background:'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${tc},#F59E0B)`, transition:'width 1s cubic-bezier(.22,1,.36,1)' }}/>
                    </div>

                    <div className="space-y-1 max-h-44 overflow-y-auto ls-scroll pr-1">
                      {tp.length === 0
                        ? <div className="text-white/25 text-xs text-center py-4">No players yet</div>
                        : tp.map((p, i) => (
                          <div key={p._id || i} className="flex items-center gap-2.5 text-sm py-1.5 border-b last:border-0" style={{ borderColor:'rgba(255,255,255,0.05)', animation:'lsSlide .4s backwards' }}>
                            <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border" style={{ borderColor:'rgba(255,255,255,0.12)' }}>
                              {p.photo
                                ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white" style={{ background: tc }}>{p.name?.[0]}</div>}
                            </div>
                            <span className="flex-1 text-white/85 truncate">{p.name}</span>
                            {p.isRetained && <span className="text-xs flex-shrink-0">🔒</span>}
                            <span className="font-mono text-xs font-bold text-amber-400 flex-shrink-0">{Math.round(p.soldPrice || 0)}</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex gap-0.5 mt-4">
                      {Array.from({ length: team.slots || 11 }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < tp.length ? tc : 'rgba(255,255,255,0.1)', transition:'background .5s' }}/>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PLAYERS ──────────────────────────────────────────────────── */}
        {activeTab === 'players' && (
          <div key="players" className="space-y-2">
            {['remaining', 'sold', 'unsold', 'retained'].map(status => {
              const list = players.filter(p => p.status === status || (status === 'sold' && p.isRetained));
              if (list.length === 0) return null;
              const label = { remaining:'⏳ Up next', sold:'✅ Sold', unsold:'⛔ Unsold', retained:'🔒 Retained' }[status];
              const color = { remaining:'#38BDF8', sold:'#34D399', unsold:'#F87171', retained:'#818CF8' }[status];
              return (
                <div key={status}>
                  <div className="font-mono text-[11px] uppercase tracking-[0.2em] mb-2 mt-4 flex items-center gap-2" style={{ color }}>
                    <span className="w-1 h-4 rounded-full" style={{ background:color }}/>{label} <span className="text-white/30">({list.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {list.map((p, i) => {
                      const buyerTeam = teams.find(t => t._id === (p.soldTo?._id || p.soldTo));
                      return (
                        <div key={p._id} className="ls-card rounded-xl p-3 border flex items-center gap-3"
                          style={{ background:'rgba(18,24,41,0.7)', borderColor:'rgba(255,255,255,0.07)', animation:`lsRise .5s ${Math.min(i, 12) * 40}ms cubic-bezier(.22,1,.36,1) backwards` }}>
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border" style={{ borderColor: buyerTeam?.color || 'rgba(255,255,255,0.15)' }}>
                            {p.photo
                              ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                              : <img src={AVATAR} alt="" draggable={false} className="w-full h-full object-cover" style={{ objectPosition:'center 15%', transform:'scale(1.15)' }}/>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white truncate">{p.name}</div>
                            <div className="text-[11px] text-white/40 truncate">{buyerTeam ? buyerTeam.name : (p.role || '—')}</div>
                          </div>
                          {(p.soldPrice || p.retainPrice) ? (
                            <div className="font-mono text-xs font-bold text-amber-400 flex-shrink-0">{Math.round(p.soldPrice || p.retainPrice)}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ACTIVITY ─────────────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div key="log" ref={logRef} className="space-y-1.5 max-h-[60vh] overflow-y-auto ls-scroll">
            {log.length === 0
              ? <div className="text-white/25 text-center py-12 text-sm">No activity yet</div>
              : log.map((entry, i) => {
                const color = { bid:'#FBBF24', sold:'#34D399', unsold:'#F87171', info:'#B6BFD8', pause:'#FBBF24', resume:'#38BDF8', retain:'#818CF8' }[entry.type] || '#B6BFD8';
                return (
                  <div key={entry._key || i} className="flex items-start gap-3 px-4 py-2.5 rounded-xl border"
                    style={{ background:'rgba(18,24,41,0.7)', borderColor:'rgba(255,255,255,0.05)', animation:'lsSlide .45s cubic-bezier(.22,1,.36,1) backwards' }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background:color, boxShadow:`0 0 8px ${color}` }}/>
                    <span className="text-sm flex-1" style={{ color }}>{entry.message}</span>
                    <span className="font-mono text-[10px] text-white/25 flex-shrink-0 whitespace-nowrap">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : ''}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        <footer className="text-center py-6 font-mono text-[10px] tracking-[0.25em] uppercase text-white/30 flex items-center justify-center gap-1.5">
          <img src={criczaarLogo} alt="" className="w-3.5 h-3.5 object-contain inline-block opacity-60" />
          Powered by <span className="ls-gradtext font-bold">CricZaar</span> · live auction platform
        </footer>
      </main>

      {/* ── Mobile sticky bid bar ─────────────────────────────────────── */}
      {currentPlayer && (
        <div className="fixed bottom-0 inset-x-0 z-30 md:hidden px-3 pb-3 pt-2" style={{ animation:'lsRise .5s cubic-bezier(.22,1,.36,1) backwards' }}>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border backdrop-blur-xl"
            style={{ background:'rgba(18,24,41,0.92)', borderColor:'rgba(245,158,11,0.4)', boxShadow:'0 -8px 30px rgba(0,0,0,0.5), 0 0 24px rgba(245,158,11,0.12)' }}>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base text-white truncate">{currentPlayer.name}</div>
              <div className="font-mono text-[10px] tracking-wider truncate" style={{ color: leaderName ? leaderColor : 'rgba(255,255,255,0.4)' }}>
                {leaderName ? `🏆 ${leaderName}` : 'No bids yet'}
              </div>
            </div>
            <div key={currentBid} className="font-mono font-black text-2xl" style={{ color:'#F59E0B', animation:'lsPop .5s both' }}>{animatedBid}<span className="text-xs text-white/40"> pts</span></div>
            {timer !== null && (
              <div className="font-mono font-bold text-lg w-9 h-9 rounded-full flex items-center justify-center border-2"
                style={{ color: timer <= 5 ? '#F87171' : '#F59E0B', borderColor: timer <= 5 ? '#F87171' : '#F59E0B' }}>{timer}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}