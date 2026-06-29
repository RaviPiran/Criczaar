import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

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

  const socketRef = useRef(null);
  const logRef    = useRef(null);

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

  const timerColor = timer === null ? '#94a3b8'
    : timer > 15 ? '#10b981'
    : timer > 5  ? '#f59e0b'
    : '#ef4444';

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div className="text-6xl animate-bounce">🏏</div>
      <p className="text-white/50 font-raj tracking-widest text-sm animate-pulse">Loading live auction…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
      style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div className="text-6xl">❌</div>
      <h2 className="text-white font-display text-2xl">Not Found</h2>
      <p className="text-white/50 text-sm text-center">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#0f172a 100%)', fontFamily: 'sans-serif' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-xl"
        style={{ background: 'rgba(15,23,42,0.85)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-lg"
              style={{ background: 'linear-gradient(135deg,#dc2626,#1d4ed8)' }}>C</div>
            <div>
              <div className="font-display text-xl leading-none">CRIC<span className="text-red-500">ZAAR</span></div>
              <div className="text-[10px] text-white/30 tracking-widest">LIVE AUCTION</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-base text-white/80">{room?.name}</span>
            <span className="font-mono text-xs text-white/30 border border-white/10 px-2 py-0.5 rounded-lg">{roomCode?.toUpperCase()}</span>
            {isPaused ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>⏸ PAUSED
              </span>
            ) : room?.status === 'completed' ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                🏆 COMPLETED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>● LIVE
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ── Stats bar ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            ['🏏', totalCount,     'Total',     '#94a3b8'],
            ['✅', soldCount,      'Sold',       '#10b981'],
            ['❌', unsoldCount,    'Unsold',     '#ef4444'],
            ['⏳', remainingCount, 'Remaining',  '#60a5fa'],
          ].map(([em, v, l, c]) => (
            <div key={l} className="rounded-2xl p-3 text-center border border-white/8"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}>
              <div className="text-lg">{em}</div>
              <div className="font-orbitron text-xl font-bold" style={{ color: c }}>{v}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-widest">{l}</div>
            </div>
          ))}
        </div>

        {/* ── Current Player on Auction ──────────────────────────────────────── */}
        {currentPlayer ? (
          <div className="rounded-3xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg,#dc2626,#1d4ed8,#dc2626)', backgroundSize: '200%', animation: 'shimmer 2s linear infinite' }}/>
            <div className="p-6">
              <div className="flex items-start gap-5 flex-wrap sm:flex-nowrap">
                {/* Photo */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-white/20 flex-shrink-0 mx-auto sm:mx-0">
                  {currentPlayer.photo
                    ? <img src={currentPlayer.photo} alt={currentPlayer.name} className="w-full h-full object-cover"/>
                    : <div className="w-full h-full flex items-center justify-center font-display text-4xl"
                        style={{ background: 'linear-gradient(135deg,#dc2626,#1d4ed8)' }}>
                        {currentPlayer.name?.[0]}
                      </div>}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="text-xs text-white/40 uppercase tracking-widest mb-1">🎯 Now on Auction</div>
                  <h2 className="font-display text-3xl sm:text-4xl text-white tracking-wide leading-tight">{currentPlayer.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                    {currentPlayer.role  && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">{currentPlayer.role}</span>}
                    {currentPlayer.club  && <span className="px-2 py-0.5 rounded-full text-xs text-white/40 border border-white/10">{currentPlayer.club}</span>}
                    {currentPlayer.battingStyle && <span className="px-2 py-0.5 rounded-full text-xs text-white/40 border border-white/10">🏏 {currentPlayer.battingStyle}</span>}
                  </div>

                  {/* Bid info */}
                  <div className="flex items-center gap-4 mt-4 flex-wrap justify-center sm:justify-start">
                    <div>
                      <div className="text-xs text-white/40 uppercase tracking-widest">Current Bid</div>
                      <div className="font-orbitron text-3xl font-bold text-yellow-400">{currentBid} <span className="text-sm text-white/30">pts</span></div>
                    </div>
                    {currentBidder && (
                      <div>
                        <div className="text-xs text-white/40 uppercase tracking-widest">Leading</div>
                        <div className="font-bold text-emerald-400 text-lg">{currentBidder?.name || currentBidder}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-white/40 uppercase tracking-widest">Base</div>
                      <div className="font-orbitron text-sm text-white/50">{currentPlayer.basePrice} pts</div>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                {timer !== null && (
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 mx-auto sm:mx-0"
                    style={{ borderColor: timerColor, background: `${timerColor}15` }}>
                    <div className="font-orbitron text-3xl font-bold" style={{ color: timerColor }}>{timer}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest">secs</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : lastResult ? (
          // Last result flash card
          <div className="rounded-3xl border p-6 text-center"
            style={{
              borderColor: lastResult.type === 'sold' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
              background:  lastResult.type === 'sold' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            }}>
            <div className="text-5xl mb-2">{lastResult.type === 'sold' ? '🏆' : '❌'}</div>
            <div className="font-display text-2xl text-white">{lastResult.player?.name}</div>
            {lastResult.type === 'sold'
              ? <div className="text-emerald-400 font-bold mt-1">Sold to {lastResult.team?.name} for {lastResult.price} pts</div>
              : <div className="text-red-400 font-bold mt-1">Went Unsold</div>}
            <div className="text-white/30 text-xs mt-2">Waiting for next player…</div>
          </div>
        ) : room?.status === 'completed' ? (
          <div className="rounded-3xl border border-emerald-500/30 p-8 text-center"
            style={{ background: 'rgba(16,185,129,0.06)' }}>
            <div className="text-6xl mb-3">🏆</div>
            <h2 className="font-display text-3xl text-white">Auction Completed!</h2>
            <p className="text-white/40 mt-2">All players have been auctioned. See the squads below.</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="text-5xl mb-3 opacity-40">🏏</div>
            <p className="text-white/40">{isPaused ? '⏸ Auction is paused' : 'Waiting for auction to start…'}</p>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 border-b border-white/10 pb-0">
          {[['squads','🏟 Squads'], ['players','👥 Players'], ['log','📜 Live Log']].map(([k, l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-2.5 text-sm font-bold transition-all rounded-t-xl border-b-2 ${
                activeTab === k
                  ? 'text-white border-red-500'
                  : 'text-white/40 border-transparent hover:text-white/70'
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* ── SQUADS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'squads' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map(team => {
              const tp     = getTeamPlayers(team);
              const spent  = (team.budget || 0) - (team.budgetLeft ?? 0);
              const pct    = Math.min(Math.round((spent / (team.budget || 1)) * 100), 100);
              return (
                <div key={team._id} className="rounded-2xl overflow-hidden border border-white/8"
                  style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)' }}>
                  <div className="h-1" style={{ background: `linear-gradient(90deg,${team.color || '#dc2626'},rgba(29,78,216,0.6))` }}/>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: team.color || '#dc2626' }}>
                        {team.logo
                          ? <img src={team.logo} alt={team.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center font-display text-xl text-white" style={{ background: team.color || '#dc2626' }}>{team.name?.[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-lg text-white truncate">{team.name}</div>
                        <div className="text-xs text-white/40">{tp.length} players · {Math.round(team.budgetLeft ?? 0)} pts left</div>
                      </div>
                    </div>
                    {/* Budget bar */}
                    <div className="w-full bg-white/10 rounded-full h-1.5 mb-3 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#dc2626,#1d4ed8)' }}/>
                    </div>
                    {/* Players */}
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {tp.length === 0
                        ? <div className="text-white/20 text-xs text-center py-4">No players yet</div>
                        : tp.map((p, i) => (
                          <div key={p._id || i} className="flex items-center gap-2 text-sm py-1 border-b border-white/5 last:border-0">
                            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                              {p.photo
                                ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                                : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ background: team.color || '#1d4ed8', color:'#fff' }}>{p.name?.[0]}</div>}
                            </div>
                            <span className="flex-1 text-white/80 truncate">{p.name}</span>
                            {p.isRetained && <span className="text-xs text-blue-400 flex-shrink-0">🔒</span>}
                            <span className="font-orbitron text-xs text-yellow-400 flex-shrink-0">{Math.round(p.soldPrice || 0)}</span>
                          </div>
                        ))}
                    </div>
                    {/* Slots */}
                    <div className="flex gap-0.5 mt-3">
                      {Array.from({ length: team.slots || 11 }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < tp.length ? (team.color || '#dc2626') : 'rgba(255,255,255,0.1)' }}/>
                      ))}
                    </div>
                    <div className="text-[10px] text-white/25 mt-1">{tp.length}/{team.slots || 11} slots</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PLAYERS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'players' && (
          <div className="space-y-2">
            {['remaining','sold','unsold','retained'].map(status => {
              const list = players.filter(p => p.status === status || (status === 'sold' && p.isRetained));
              if (list.length === 0) return null;
              const label = { remaining:'⏳ Remaining', sold:'✅ Sold', unsold:'❌ Unsold', retained:'🔒 Retained' }[status];
              const color = { remaining:'#60a5fa', sold:'#10b981', unsold:'#ef4444', retained:'#818cf8' }[status];
              return (
                <div key={status}>
                  <div className="text-xs font-orbitron uppercase tracking-widest mb-2 mt-4" style={{ color }}>{label} ({list.length})</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {list.map(p => {
                      const buyerTeam = teams.find(t => t._id === (p.soldTo?._id || p.soldTo));
                      return (
                        <div key={p._id} className="rounded-xl p-3 border border-white/8 flex items-center gap-2"
                          style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                            {p.photo
                              ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                              : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
                                  style={{ background: buyerTeam?.color || '#334155' }}>{p.name?.[0]}</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-white/30 truncate">
                              {buyerTeam ? buyerTeam.name : (p.role || '—')}
                            </div>
                          </div>
                          {(p.soldPrice || p.retainPrice) ? (
                            <div className="font-orbitron text-[10px] text-yellow-400 flex-shrink-0">
                              {Math.round(p.soldPrice || p.retainPrice)}
                            </div>
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

        {/* ── LOG TAB ──────────────────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div ref={logRef} className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {log.length === 0
              ? <div className="text-white/20 text-center py-12 text-sm">No activity yet</div>
              : log.map((entry, i) => {
                const color = { bid:'#f59e0b', sold:'#10b981', unsold:'#ef4444', info:'#94a3b8', pause:'#f59e0b', resume:'#60a5fa', retain:'#818cf8' }[entry.type] || '#94a3b8';
                return (
                  <div key={entry._key || i} className="flex items-start gap-3 px-4 py-2.5 rounded-xl border border-white/5"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }}/>
                    <span className="text-sm flex-1" style={{ color }}>{entry.message}</span>
                    <span className="text-[10px] text-white/20 flex-shrink-0 whitespace-nowrap">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : ''}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

      </div>

      {/* shimmer keyframe */}
      <style>{`
        @keyframes shimmer { 0%{background-position:0%} 100%{background-position:200%} }
      `}</style>
    </div>
  );
}