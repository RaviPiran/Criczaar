import CricBg from '../components/CricBg';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuction } from '../context/AuctionContext';
import { getSocket } from '../utils/socket';
import { getFullRoom, nextPlayer, placeBidAPI, sellPlayer, markUnsoldAPI, updateRoomStatus, startRound2, completeAuction, pickUnsoldPlayer } from '../utils/api';
import TimerRing from '../components/TimerRing';
import SoldBurst from '../components/SoldBurst';
import PlayerProfileCard from '../components/PlayerProfileCard';

function SpinWheel({ players, onSpin, isCompleted, onResults, round2Ready, onPickUnsold, onCompleteAuction, loading }) {
  const remaining = players.filter(p => p.status === 'remaining');
  const segments  = remaining.length > 0 ? remaining : [];
  const count     = segments.length || 6; // fallback for display

  const COLORS = ['#dc2626','#1d4ed8','#059669','#d97706','#7c3aed','#db2777','#0891b2','#65a30d','#ea580c','#6366f1'];

  const [rotation, setRotation]     = useState(0);
  const [spinning, setSpinning]     = useState(false);
  const [landed, setLanded]         = useState(false);
  const [landedPlayer, setLandedPlayer] = useState(null); // the player the wheel actually landed on
  const spinRef                     = useRef(null);
  const finalRotationRef            = useRef(0);

  const sliceAngle = 360 / count;

  // Pick a random player first, then spin the wheel to land exactly on them
  const handleSpin = () => {
    if (spinning || landed || isCompleted || round2Ready || segments.length === 0) return;

    const n = segments.length;
    const slice = 360 / n;

    // 1. Pick a random player
    const pickedIdx    = Math.floor(Math.random() * n);
    const pickedPlayer = segments[pickedIdx];

    // 2. Pointer is at the TOP (0° / 12 o'clock).
    //    polarToCartesian uses (angle - 90), so angle=0 → top of SVG.
    //    Segment i draws from angle (i*slice) to ((i+1)*slice), starting at top going clockwise.
    //    Segment i's visual centre angle = i*slice + slice/2  (from top, clockwise).
    //    After rotating the wheel by R degrees clockwise, the segment centre sits at:
    //      (segCentre + R) % 360
    //    We want that to equal 0 (top pointer):
    //      R_needed = ((-segCentre) % 360 + 360) % 360
    const segCentre  = pickedIdx * slice + slice / 2;
    const neededAngle = ((-segCentre) % 360 + 360) % 360;

    // 3. Spin from current position: enough full turns so it looks good
    const currentNorm = ((rotation % 360) + 360) % 360;
    let delta = neededAngle - currentNorm;
    if (delta < 0) delta += 360;
    const extraTurns = (5 + Math.floor(Math.random() * 5)) * 360;
    const target = rotation + delta + extraTurns;

    setSpinning(true);
    setRotation(target);
    finalRotationRef.current = target;
    clearTimeout(spinRef.current);
    spinRef.current = setTimeout(() => {
      setSpinning(false);
      setLanded(true);
      setLandedPlayer(pickedPlayer);
    }, 4200);
  };

  const size   = 300;
  const cx     = size / 2;
  const cy     = size / 2;
  const r      = size / 2 - 8;

  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const makeSlicePath = (i) => {
    const start = i * sliceAngle;
    const end   = start + sliceAngle;
    const p1    = polarToCartesian(start, r);
    const p2    = polarToCartesian(end, r);
    const large = sliceAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
  };

  /* ── Round 2 / Post-auction fill state ──
     Show whenever: round2Ready flag is set OR no remaining players exist with unsold ones present
     This handles both the normal flow AND page-reload before loadData async completes ── */
  const unsoldPlayers = players.filter(p => p.status === 'unsold');
  const shouldShowPickUnsold = round2Ready || (remaining.length === 0 && unsoldPlayers.length > 0 && !isCompleted);

  if (shouldShowPickUnsold) return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed bg-white p-10 text-center"
      style={{borderColor:'rgba(234,179,8,0.5)'}}>
      <div className="text-6xl">✅</div>
      <div>
        <p className="font-display text-2xl tracking-wide text-slate-800">Round 1 Complete!</p>
        <p className="text-slate-500 text-sm mt-1">
          There are <strong className="text-red-600">{unsoldPlayers.length} unsold player{unsoldPlayers.length !== 1 ? 's' : ''}</strong>.
          Teams can pick from the unsold pool to fill their squads.
        </p>
      </div>
      <div className="flex gap-3 flex-wrap justify-center">
        <button className="px-8 py-3 rounded-xl font-display tracking-widest text-white font-bold text-base transition-all hover:-translate-y-0.5"
          style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}
          onClick={onPickUnsold}>
          📋 Pick Unsold Players
        </button>
        <button className="px-8 py-3 rounded-xl font-display tracking-widest text-white font-bold text-base transition-all hover:-translate-y-0.5 disabled:opacity-40"
          style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)'}}
          onClick={onCompleteAuction} disabled={loading}>
          🏆 Complete Auction
        </button>
      </div>
    </div>
  );

  /* ── Completed state ── */
  if (isCompleted) return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-14 text-center">
      <div className="text-5xl">🏆</div>
      <p className="font-display text-xl tracking-wide text-slate-700">Auction Complete!</p>
      <button className="btn-primary px-8 py-2.5" onClick={onResults}>View Results</button>
    </div>
  );

  /* ── Normal spin wheel ── */
  return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white py-8 px-4">
      <p className="font-display text-lg tracking-widest" style={{color:'#1d4ed8'}}>
        🏏 SPIN TO PICK NEXT PLAYER
      </p>

      {/* Wheel + pointer */}
      <div className="relative flex items-center justify-center" style={{width: size}}>
        {/* Pointer arrow — TOP centre, pointing DOWN into wheel */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'}}>
          <svg width="24" height="32" viewBox="0 0 24 32">
            <polygon points="12,32 0,0 12,6 24,0" fill="#dc2626"/>
          </svg>
        </div>

        {/* SVG Wheel */}
        <div style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4.2s cubic-bezier(0.17,0.67,0.12,1)' : 'none',
          borderRadius: '50%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg, i) => {
              const midAngle = i * sliceAngle + sliceAngle / 2 - 90;
              const midRad   = midAngle * (Math.PI / 180);
              const textR    = r * 0.65;
              const tx       = cx + textR * Math.cos(midRad);
              const ty       = cy + textR * Math.sin(midRad);
              const name     = seg.name || '???';
              const short    = name.length > 10 ? name.slice(0, 9) + '…' : name;
              return (
                <g key={i}>
                  <path d={makeSlicePath(i)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="2"/>
                  <text
                    x={tx} y={ty}
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}
                    fill="#fff" fontSize="11" fontWeight="bold"
                    fontFamily="Rajdhani, sans-serif"
                    style={{pointerEvents:'none'}}>
                    {short}
                  </text>
                </g>
              );
            })}
            {/* Centre hub */}
            <circle cx={cx} cy={cy} r={18} fill="#fff" stroke="#e2e8f0" strokeWidth="3"/>
            <circle cx={cx} cy={cy} r={10} fill="#1d4ed8"/>
          </svg>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-1">
        <button
          onClick={handleSpin}
          disabled={spinning || landed}
          className="px-8 py-3 rounded-xl font-display tracking-widest text-white font-bold text-base transition-all hover:-translate-y-0.5 disabled:opacity-40"
          style={{background: landed ? '#94a3b8' : 'linear-gradient(135deg,#dc2626,#b91c1c)'}}>
          {spinning ? '🌀 Spinning…' : landed ? '✅ Spun!' : '🎰 SPIN!'}
        </button>
        {landed && (
          <button
            onClick={() => landedPlayer && onSpin(landedPlayer._id)}
            className="px-8 py-3 rounded-xl font-display tracking-widest text-white font-bold text-base transition-all hover:-translate-y-0.5"
            style={{background:'linear-gradient(135deg,#059669,#0d9488)'}}>
            🏏 Load {landedPlayer ? landedPlayer.name : 'Player'}
          </button>
        )}
      </div>
      {landed && landedPlayer && (
        <p className="text-sm font-bold mt-1" style={{color:'#059669'}}>🎯 Landed on: {landedPlayer.name}</p>
      )}
      <p className="text-xs text-slate-400 font-raj">Spin the wheel, then load the player!</p>
    </div>
  );
}


export default function Auction() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuction();
  const { room, teams, players, currentPlayer, currentBid, currentBidder } = state;

  const [timerSecs, setTimerSecs]       = useState(30);
  const [soldResult, setSoldResult]     = useState(null);
  const [showSwing, setShowSwing]       = useState(false);
  const [showWheel, setShowWheel]       = useState(true);  // show wheel before first player too
  const [pickModal, setPickModal]       = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [bonusPopup, setBonusPopup]     = useState(null);
  const [round2Ready, setRound2Ready]   = useState(false); // true when remaining=0 but unsold>0
  const [unsoldPickModal, setUnsoldPickModal] = useState(false);
  const [pickUnsoldPlayer_, setPickUnsoldPlayer_] = useState(null); // selected unsold player
  const [pickUnsoldTeam, setPickUnsoldTeam] = useState(null);
  const [pickUnsoldPrice, setPickUnsoldPrice] = useState('');
  const round2ReadyRef = useRef(false);
  useEffect(() => { round2ReadyRef.current = round2Ready; }, [round2Ready]);
  const timerRef = useRef(null);
  const maxTimer = room?.rules?.timerSeconds || 30;

  useEffect(() => {
    if (!room) { navigate('/dashboard'); return; }
    setIsPaused(room.status === 'paused');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await getFullRoom(room._id);
      dispatch({ type:'SET_FULL_DATA', payload:data.data });
      setIsPaused(data.data.room.status === 'paused');
      if (data.data.room.currentPlayer) {
        setTimerSecs(maxTimer); startLocalTimer();
        setShowWheel(false); // a player is active, show player card not wheel
      } else {
        // No active player — check if round is done
        const allPlayers = data.data.players || [];
        const remainingCount = allPlayers.filter(p => p.status === 'remaining').length;
        const unsoldCount    = allPlayers.filter(p => p.status === 'unsold').length;
        if (remainingCount === 0 && unsoldCount > 0) {
          setRound2Ready(true);
          setShowWheel(true);
        }
      }
    } catch { toast.error('Failed to load'); }
  };

  useEffect(() => {
    if (!room) return;
    const s = getSocket();
    s.emit('join-room', room._id);
    s.on('bid-update',     ({ currentBid:b, currentBidder:bd }) => { dispatch({ type:'UPDATE_BID', payload:{amount:b, bidder:bd} }); resetLocalTimer(); });
    s.on('timer-tick',     ({ remaining }) => setTimerSecs(remaining));
    s.on('timer-expired',  () => stopLocalTimer());
    s.on('player-result',  r  => { setSoldResult(r); stopLocalTimer(); });
    s.on('next-player',    p  => { dispatch({ type:'SET_CURRENT_PLAYER', payload:p }); setTimerSecs(maxTimer); startLocalTimer(); });
    s.on('auction-paused',  () => { setIsPaused(true);  stopLocalTimer();  toast('⏸ Paused',  {icon:'⏸'}); });
    s.on('auction-resumed', () => { setIsPaused(false); startLocalTimer(); toast('▶ Resumed', {icon:'▶'}); });
    s.on('admin-update',    () => { loadData(); toast('🛠 Auction data updated by admin', { icon: '🛠' }); });
    return () => {
      ['bid-update','timer-tick','timer-expired','player-result','next-player','auction-paused','auction-resumed','admin-update']
        .forEach(e => s.off(e));
    };
  }, [room]);

  const stopLocalTimer  = () => clearInterval(timerRef.current);
  const startLocalTimer = useCallback(() => {
    stopLocalTimer();
    timerRef.current = setInterval(() =>
      setTimerSecs(s => { if (s <= 1) { clearInterval(timerRef.current); return 0; } return s - 1; }), 1000);
  }, []);
  const resetLocalTimer = () => { setTimerSecs(maxTimer); startLocalTimer(); };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleNext = async (playerId) => {
    if (loading || isPaused) return;
    setShowSwing(true); stopLocalTimer();
    setTimeout(async () => {
      try {
        const { data } = await nextPlayer(room._id, playerId ? { playerId } : {});
        if (!data.data) {
          // No more 'remaining' players — fetch fresh data and check unsold count
          const full = await getFullRoom(room._id);
          const freshData = full.data?.data;
          const freshPlayers = freshData?.players || [];
          const unsoldCount = freshPlayers.filter(p => p.status === 'unsold').length;

          // Always load fresh data into state first
          if (freshData) dispatch({ type: 'SET_FULL_DATA', payload: freshData });
          dispatch({ type: 'SET_CURRENT_PLAYER', payload: null });

          if (unsoldCount > 0) {
            setRound2Ready(true);
            setShowWheel(true);
            toast('✅ Round 1 done! Pick unsold players to fill squads.', { icon: '📋', duration: 5000 });
          } else {
            // No unsold players either — truly complete
            await completeAuction(room._id);
            dispatch({ type: 'SET_ROOM', payload: { ...(freshData?.room || room), status: 'completed' } });
            toast.success('🏆 Auction Complete! All players have been auctioned.');
          }
        } else {
          setRound2Ready(false);
          setShowWheel(false);
          const p = data.data.currentPlayer;
          dispatch({ type: 'SET_CURRENT_PLAYER', payload: p });
          getSocket().emit('next-player', { roomId: room._id, player: p });
          setTimerSecs(maxTimer); startLocalTimer();
          getSocket().emit('start-timer', { roomId: room._id, seconds: maxTimer });
        }
      } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
      setShowSwing(false);
    }, 1100);
  };

  const handleStartRound2 = async () => {
    setLoading(true);
    try {
      const { data } = await startRound2(room._id);
      // Reload full fresh data — players array will be updated server-side
      const full = await getFullRoom(room._id);
      if (!full.data?.data) throw new Error('Failed to reload room');
      dispatch({ type: 'SET_FULL_DATA', payload: full.data.data });
      setRound2Ready(false);
      setShowWheel(true);
      toast.success(`🔄 Round 2 started! ${data.resetCount} player(s) re-entered.`);
    } catch(err) { toast.error(err.response?.data?.message || err.message || 'Failed to start round 2'); }
    setLoading(false);
  };

  const handleCompleteAuction = async () => {
    if (!window.confirm('Are you sure you want to complete the auction? This cannot be undone.')) return;
    setLoading(true);
    try {
      await completeAuction(room._id);
      dispatch({ type: 'SET_ROOM', payload: { ...room, status: 'completed' } });
      setRound2Ready(false);
      toast.success('🏆 Auction marked as complete!');
      navigate('/results');
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  const handlePickUnsoldConfirm = async () => {
    if (!pickUnsoldPlayer_ || !pickUnsoldTeam) return toast.error('Select a player and a team');
    const price = parseInt(pickUnsoldPrice, 10);
    if (isNaN(price) || price < 0) return toast.error('Enter a valid price (0 or more)');

    const assignedName  = pickUnsoldPlayer_.name;
    const assignedId    = pickUnsoldPlayer_._id;
    const assignedTeam  = pickUnsoldTeam;

    setLoading(true);
    try {
      const res = await pickUnsoldPlayer(room._id, {
        playerId: assignedId,
        teamId:   assignedTeam,
        price,
      });

      if (!res?.data?.success) {
        toast.error(res?.data?.message || 'Assignment failed');
        setLoading(false);
        return;
      }

      // FIX: Dispatch PICK_UNSOLD immediately — this removes the player from the
      // unsold list and updates team budget in local state RIGHT NOW, before the
      // getFullRoom reload returns. The old code only called SET_FULL_DATA after
      // getFullRoom, causing the modal to show the assigned player for ~1s and
      // team budgets to remain stale until the reload finished.
      dispatch({
        type: 'PICK_UNSOLD',
        payload: { playerId: assignedId, teamId: assignedTeam, price },
      });

      // Notify Live Spectator (share-link) viewers about this direct-pick sale
      const assignedTeamObj = teams.find(t => t._id === assignedTeam);
      getSocket().emit('player-result', {
        roomId: room._id,
        result: {
          type:'sold',
          player:{ _id:assignedId, name:assignedName, photo:pickUnsoldPlayer_.photo },
          team:{ _id:assignedTeam, name:assignedTeamObj?.name||'', color:assignedTeamObj?.color||'#dc2626', logo:assignedTeamObj?.logo||'' },
          playerName:assignedName, playerPhoto:pickUnsoldPlayer_.photo,
          teamName:assignedTeamObj?.name||'', teamColor:assignedTeamObj?.color||'#dc2626',
          teamLogo:assignedTeamObj?.logo||'', price, bonusPoints:0, isUnsold:false,
        },
      });

      // Clear selections immediately so the modal reflects the change
      setPickUnsoldPlayer_(null);
      setPickUnsoldTeam(null);
      setPickUnsoldPrice('');

      toast.success(`✅ ${assignedName} assigned!`);

      // Then sync full server data in background to confirm consistency
      try {
        const full = await getFullRoom(room._id);
        if (full?.data?.data) {
          dispatch({ type: 'SET_FULL_DATA', payload: full.data.data });
          const stillUnsold = (full.data.data.players || []).filter(p => p.status === 'unsold').length;
          if (stillUnsold === 0) {
            setUnsoldPickModal(false);
            setRound2Ready(false);
            setLoading(false);
            toast.success('🏆 All squads filled! Auction complete.');
            navigate('/results');
            return;
          }
        }
      } catch (_) { /* silent — optimistic update already applied */ }

    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Assignment failed';
      toast.error(msg);
    }
    setLoading(false);
  };


  const getNextIncrement = (bid) => {
    const defaultInc = room?.rules?.bidIncrement || 10;
    const rules = [...(room?.rules?.bidBonusRules || [])].sort((a, b) => b.minBid - a.minBid);
    // Find the highest tier where bid >= minBid (so 250 hits Gold 250-500, not Silver 100-250)
    const tierRule = rules.find(r => bid >= r.minBid && bid <= r.maxBid);
    return (tierRule?.bidIncrement != null) ? tierRule.bidIncrement : defaultInc;
  };

  // Max a team can spend on ONE player = budgetLeft minus basePrice reserved for each remaining empty slot
  const getMaxBid = (team) => {
    const base      = room?.rules?.basePrice || 100;
    const slotsLeft = team.slots - (team.players?.length || 0);
    if (slotsLeft <= 0) return 0;
    // must keep at least basePrice per remaining slot after this one
    return Math.max(0, Math.floor(team.budgetLeft - (slotsLeft - 1) * base));
  };

  const handleBid = async (teamId) => {
    if (!currentPlayer || isPaused) return;
    const inc    = getNextIncrement(currentBid);
    const newBid = Math.round(currentBid + inc);
    const team   = teams.find(t => t._id === teamId);
    if (team && newBid > team.budgetLeft) { toast.error('Insufficient points!'); return; }
    const maxBid = team ? getMaxBid(team) : Infinity;
    if (newBid > maxBid) { toast.error(`Max bid for ${team.name} is ${maxBid} pts (must keep ${room?.rules?.basePrice||100} pts per remaining slot)`); return; }
    try {
      await placeBidAPI(room._id, { teamId, amount:newBid });
      dispatch({ type:'UPDATE_BID', payload:{ amount:newBid, bidder:team } });
      getSocket().emit('place-bid', { roomId:room._id, teamId, teamName:team?.name, amount:newBid });
      resetLocalTimer();
      const bonus = room?.rules?.bidBonusRules?.find(r => newBid >= r.minBid && newBid <= r.maxBid);
      if (bonus) { setBonusPopup({ team:team?.name, rule:bonus }); setTimeout(() => setBonusPopup(null), 2500); }
    } catch(err) { toast.error(err.response?.data?.message || 'Bid failed'); }
  };

  const manualInc = (inc) => {
    if (isPaused) return;
    dispatch({ type:'UPDATE_BID', payload:{ amount:Math.round(currentBid + inc), bidder:currentBidder } });
    resetLocalTimer();
  };

  const confirmSell = async () => {
    if (!selectedTeam) return toast.error('Select a team');
    setLoading(true);
    try {
      const { data } = await sellPlayer(room._id, { teamId:selectedTeam, price:currentBid });
      const team = teams.find(t => t._id === selectedTeam);
      const result = {
        type:'sold',
        player:{ _id:currentPlayer._id, name:currentPlayer.name, photo:currentPlayer.photo },
        team:{ _id:selectedTeam, name:team?.name||'', color:team?.color||'#dc2626', logo:team?.logo||'' },
        playerName:currentPlayer.name, playerPhoto:currentPlayer.photo,
        teamName:team?.name||'', teamColor:team?.color||'#dc2626',
        teamLogo:team?.logo||'', price:currentBid,
        bonusPoints:data.data.bonusPoints||0, isUnsold:false,
      };
      setSoldResult(result);
      getSocket().emit('player-result', { roomId:room._id, result });
      dispatch({ type:'PLAYER_SOLD', payload:{ playerId:currentPlayer._id, teamId:selectedTeam, price:currentBid } });
      setPickModal(false);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  const handleUnsold = async () => {
    if (!currentPlayer || loading || isPaused) return;
    stopLocalTimer(); setLoading(true);
    try {
      await markUnsoldAPI(room._id);
      const result = { type:'unsold', player:{ _id:currentPlayer._id, name:currentPlayer.name, photo:currentPlayer.photo }, playerName:currentPlayer.name, playerPhoto:currentPlayer.photo, isUnsold:true };
      setSoldResult(result);
      getSocket().emit('player-result', { roomId:room._id, result });
      dispatch({ type:'PLAYER_UNSOLD', payload:currentPlayer._id });
    } catch { toast.error('Failed'); }
    setLoading(false);
  };

  const handlePauseResume = async () => {
    try {
      const ns = isPaused ? 'active' : 'paused';
      await updateRoomStatus(room._id, ns);
      setIsPaused(!isPaused);
      dispatch({ type:'SET_ROOM', payload:{ ...room, status:ns } });
      const s = getSocket();
      if (isPaused) { s.emit('auction-resumed', { roomId:room._id }); startLocalTimer(); }
      else          { s.emit('auction-paused',  { roomId:room._id }); stopLocalTimer(); }
      toast(isPaused ? '▶ Auction Resumed' : '⏸ Auction Paused');
    } catch { toast.error('Failed'); }
  };

  const sold   = players.filter(p => p.status === 'sold').length;
  const unsold = players.filter(p => p.status === 'unsold').length;
  const remain = players.filter(p => p.status === 'remaining').length;
  const pct    = players.length > 0 ? ((sold + unsold) / players.length) * 100 : 0;
  const winningTeam     = teams.find(t => t._id === (currentBidder?._id || currentBidder?.id || currentBidder));
  const activeBonusRule = room?.rules?.bidBonusRules?.find(r => currentBid >= r.minBid && currentBid <= r.maxBid);

  if (!room) return null;

  return (
    <CricBg><div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ══ LEFT MAIN ══ */}
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto min-w-0">

        {/* Pause banner */}
        {isPaused && (
          <div className="rounded-2xl px-6 py-3 text-center font-display text-lg tracking-widest animate-pulse-slow flex-shrink-0 border-2"
            style={{background:'rgba(234,179,8,0.1)', borderColor:'#eab308', color:'#854d0e'}}>
            ⏸ AUCTION PAUSED — Click RESUME to continue
          </div>
        )}

        {/* PLAYER CARD / SPIN WHEEL */}
        {showWheel ? (
          <SpinWheel
            players={players}
            onSpin={handleNext}
            isCompleted={room.status === 'completed'}
            onResults={() => navigate('/results')}
            round2Ready={round2Ready}
            onPickUnsold={() => setUnsoldPickModal(true)}
            onCompleteAuction={handleCompleteAuction}
            loading={loading}
          />
        ) : currentPlayer ? (
          <div className={`flex-shrink-0 flex gap-3 items-stretch transition-opacity duration-300 ${isPaused ? 'opacity-60' : ''}`}>
            {/* Player card — widened for a bigger photo, matched to bid panel's height */}
            <div className="w-[700px] flex-shrink-0">
              <PlayerProfileCard player={currentPlayer} size="large"/>
            </div>
            {/* Current Bid + Timer panel */}
            <div className="flex-1 glass-card rounded-2xl p-5 flex items-center gap-10 flex-wrap min-w-[200px]">
              <div>
                <div className="text-xs text-slate-400 font-orbitron tracking-widest uppercase mb-1">Current Bid</div>
                <div className="font-orbitron font-black text-5xl leading-none" style={{color:'#dc2626'}}>
                  {Math.round(currentBid)}<span className="text-2xl ml-1" style={{color:'#fca5a5'}}> pts</span>
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  {winningTeam
                    ? <span className="font-bold" style={{color:winningTeam.color}}>🏆 {winningTeam.name} is leading</span>
                    : 'No bid yet — base price'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <TimerRing seconds={timerSecs} maxSeconds={maxTimer}/>
                <div className="hidden sm:block">
                  <div className="text-xs text-slate-400 font-orbitron tracking-widest uppercase mb-2">Progress</div>
                  <div className="w-32">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all"
                        style={{width:`${pct}%`, background:'linear-gradient(90deg,#dc2626,#1d4ed8)'}}/>
                    </div>
                    <div className="flex gap-2 text-[10px] text-slate-400 font-orbitron">
                      <span>✅{sold}</span><span>❌{unsold}</span><span>⏳{remain}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* TEAM BID GRID — moved here from the sidebar; wide column = room for up to 5 cards per row, easier to bid at a glance */}
        <div className="flex-shrink-0 glass-card rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-orbitron tracking-widest uppercase mb-3 px-1">🛡 Teams — Click to Bid</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {teams.map(t => {
              const isWin      = (currentBidder?._id || currentBidder?.id || currentBidder) === t._id;
              const slotsLeft  = t.slots - (t.players?.length || 0);
              const maxBid     = getMaxBid(t);
              const budgetPct  = Math.round(((t.budget - t.budgetLeft) / t.budget) * 100);
              const nextBidAmt = Math.round(currentBid + getNextIncrement(currentBid));
              const wouldExceed = nextBidAmt > maxBid;
              const nextBidBonus = room?.rules?.bidBonusRules?.find(r => nextBidAmt >= r.minBid && nextBidAmt <= r.maxBid);

              return (
                <div key={t._id}
                  className={`rounded-2xl border transition-all overflow-hidden ${isWin ? 'border-emerald-300 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                  style={isWin ? {background:'rgba(5,150,105,0.04)'} : {}}>

                  <div className="h-1.5 w-full" style={{background: isWin ? 'linear-gradient(90deg,#dc2626,#b91c1c)' : t.color}}/>

                  <div className="p-3">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden border-2 flex-shrink-0" style={{borderColor:t.color}}>
                        {t.logo
                          ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white" style={{background:t.color}}>{t.name[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate text-slate-800 leading-tight">{t.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex gap-0.5">
                            {Array.from({length: t.slots}).map((_,i) => (
                              <div key={i} className="w-2 h-2 rounded-sm"
                                style={{background: i < (t.players?.length||0) ? t.color : '#e2e8f0'}}/>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400 font-raj">{t.players?.length||0}/{t.slots}</span>
                        </div>
                      </div>
                      {isWin && (
                        <span className="text-[10px] font-black text-emerald-600 border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 rounded-full flex-shrink-0 tracking-wide">LEAD</span>
                      )}
                    </div>

                    {/* Budget bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 font-raj">Budget left</span>
                        <span className="font-orbitron font-bold" style={{color: t.budgetLeft < 100 ? '#dc2626' : t.color}}>
                          {Math.round(t.budgetLeft)} <span className="font-normal text-slate-400">pts</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{width:`${budgetPct}%`, background:`linear-gradient(90deg,${t.color},#dc2626)`}}/>
                      </div>
                    </div>

                    {/* Max bid per player row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-raj">Max/player</span>
                        <span title={`Max points this team can spend on ONE player while keeping ${room?.rules?.basePrice||100} pts per remaining slot`}
                          className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[9px] flex items-center justify-center cursor-help font-bold">?</span>
                      </div>
                      <span className={`font-orbitron text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                        slotsLeft === 0 ? 'text-slate-400 bg-slate-100' :
                        wouldExceed    ? 'text-orange-600 bg-orange-50 border border-orange-200' :
                                         'text-blue-700 bg-blue-50 border border-blue-200'
                      }`}>
                        {slotsLeft === 0 ? '— full' : `${maxBid} pts`}
                      </span>
                    </div>

                    {/* Bonus tier hint — surfaces the bid rules right on the card */}
                    {nextBidBonus && !wouldExceed && slotsLeft > 0 && (
                      <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold" style={{color:'#059669'}}>
                        <span>🎯</span>
                        <span>{nextBidBonus.label} tier — +{nextBidBonus.bonusPoints} bonus pts</span>
                      </div>
                    )}

                    {/* BID button */}
                    <button onClick={() => handleBid(t._id)}
                      disabled={!currentPlayer || isPaused || slotsLeft === 0}
                      title={slotsLeft === 0 ? 'Squad full' : wouldExceed ? `Next bid (${nextBidAmt}) exceeds max allowed (${maxBid})` : `Bid ${nextBidAmt} pts`}
                      className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold font-raj tracking-widest transition-all uppercase
                        text-white disabled:opacity-30 disabled:cursor-not-allowed
                        ${!(slotsLeft === 0 || wouldExceed) ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}
                      style={{
                        background: slotsLeft === 0
                          ? '#94a3b8'
                          : wouldExceed
                            ? 'linear-gradient(135deg,#f97316,#ea580c)'
                            : isWin
                              ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
                              : `linear-gradient(135deg,${t.color},#1d4ed8)`,
                        boxShadow: isWin && slotsLeft > 0 ? '0 4px 12px rgba(220,38,38,0.35)' : 'none',
                      }}>
                      {slotsLeft === 0
                        ? <>🔒 Squad Full</>
                        : wouldExceed
                          ? <>⚠ Bid {nextBidAmt} pts</>
                          : <>🏏 Bid {nextBidAmt} pts {nextBidBonus && <span className="opacity-90">🎯</span>}</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="w-80 border-l border-white/60 flex flex-col overflow-hidden flex-shrink-0" style={{background:"rgba(255,255,255,0.82)", backdropFilter:"blur(12px)"}}>
        <div className="section-title">🎯 Bid Rules</div>
        <div className="flex-shrink-0 p-3 space-y-3">
          {/* Active bonus */}
          {activeBonusRule && (
            <div className="rounded-xl px-3 py-2.5 text-xs flex items-center gap-2 border"
              style={{background:'rgba(29,78,216,0.06)', borderColor:'rgba(29,78,216,0.25)', color:'#1d4ed8'}}>
              <span className="text-lg">🎯</span>
              <span><strong>{activeBonusRule.label}</strong> — selling here awards <strong>+{activeBonusRule.bonusPoints} pts!</strong></span>
            </div>
          )}

          {/* Bonus pills */}
          {room?.rules?.bidBonusRules?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {room.rules.bidBonusRules.map((r,i) => {
                const isActive = currentBid >= r.minBid && currentBid <= r.maxBid;
                return (
                  <div key={i} className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all
                    ${isActive ? 'font-bold shadow-sm' : ''}`}
                    style={isActive
                      ? {background:'rgba(29,78,216,0.08)', borderColor:'rgba(29,78,216,0.4)', color:'#1d4ed8'}
                      : {background:'#f8fafc', borderColor:'#e2e8f0', color:'#94a3b8'}}>
                    <span className="flex items-center gap-1.5">
                      {isActive && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{background:'#1d4ed8'}}/>}
                      {r.label}
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-orbitron" style={isActive?{color:'#1d4ed8'}:{color:'#94a3b8'}}>+{r.bonusPoints}pts</span>
                      <span className="opacity-50">{r.minBid}–{r.maxBid===9999?'∞':r.maxBid}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section-title">📈 Raise Bid</div>
        <div className="flex-shrink-0 p-3 flex flex-wrap gap-2">
          {[10, 25, 50, 100, 200].map(inc => (
            <button key={inc} onClick={() => manualInc(inc)}
              disabled={!currentPlayer || isPaused}
              className="flex-1 min-w-[70px] px-3 py-2.5 rounded-xl text-sm font-raj font-bold border border-slate-300 bg-white
                hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-30">
              +{inc} pts
            </button>
          ))}
        </div>

        <div className="section-title">⚡ Auction Controls</div>
        <div className="flex-shrink-0 p-3 space-y-2.5">
          <button
            className="w-full px-6 py-3.5 text-base font-display tracking-widest rounded-xl text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#059669,#0d9488)'}}
            onClick={() => { stopLocalTimer(); setSelectedTeam(winningTeam?._id||null); setPickModal(true); }}
            disabled={!currentPlayer || loading || isPaused}>
            🏏 PICK PLAYER
          </button>

          <button className="btn-red w-full px-6 py-3.5 text-base font-display tracking-widest rounded-xl"
            onClick={handleUnsold} disabled={!currentPlayer || loading || isPaused}>
            ❌ UNSOLD
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={handlePauseResume}
              className="px-3 py-3 font-display tracking-widest text-sm rounded-xl border transition-all"
              style={isPaused
                ? {background:'#eab308', color:'white', borderColor:'#eab308'}
                : {background:'rgba(234,179,8,0.08)', borderColor:'rgba(234,179,8,0.4)', color:'#854d0e'}}>
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button className="btn-blue px-3 py-3 text-sm font-display tracking-widest rounded-xl"
              onClick={handleNext} disabled={loading || isPaused}>
              ➡ NEXT
            </button>
          </div>

          <button
            className="w-full px-5 py-3 text-sm font-display tracking-widest rounded-xl text-white font-bold border-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#7c3aed,#dc2626)'}}
            onClick={handleCompleteAuction} disabled={loading}
            title="Mark auction as complete (unsold players will remain unsold)">
            🏆 FINISH AUCTION
          </button>
        </div>

        <div className="section-title">📋 Bid Log</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {(room.auctionLog||[]).slice().reverse().slice(0,25).map((e,i) => (
            <div key={i} className={`text-xs px-2.5 py-1.5 rounded-lg font-raj
              ${e.type==='sold'    ? 'text-emerald-700 bg-emerald-50'
                : e.type==='unsold' ? 'text-red-600 bg-red-50'
                : e.type==='retain' ? 'text-blue-600 bg-blue-50'
                : e.type==='pause'||e.type==='resume' ? 'text-yellow-600 bg-yellow-50'
                : 'text-slate-600 bg-slate-50'}`}>
              <span className="text-slate-400 font-orbitron text-[10px] mr-1.5">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
              {e.message}
            </div>
          ))}
        </div>
      </div>

      {/* Pick Unsold Players Modal */}
      {unsoldPickModal && (() => {
        const unsoldPlayers = players.filter(p => p.status === 'unsold');
        const basePrice = room?.rules?.basePrice || 100;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => { setUnsoldPickModal(false); setPickUnsoldPlayer_(null); setPickUnsoldTeam(null); setPickUnsoldPrice(''); }}>
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border-2 animate-pop"
              style={{borderColor:'rgba(217,119,6,0.4)'}}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-2xl tracking-widest" style={{color:'#d97706'}}>📋 PICK UNSOLD PLAYERS</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{unsoldPlayers.length} unsold player{unsoldPlayers.length!==1?'s':''} available — assign to a team</p>
                </div>
                <button onClick={() => { setUnsoldPickModal(false); setPickUnsoldPlayer_(null); setPickUnsoldTeam(null); setPickUnsoldPrice(''); }}
                  className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">×</button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Left: unsold player list */}
                <div className="w-56 border-r border-slate-100 overflow-y-auto p-3 space-y-2 flex-shrink-0">
                  <p className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest px-1 mb-2">Select Player</p>
                  {unsoldPlayers.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-8">No unsold players</div>
                  ) : unsoldPlayers.map(p => (
                    <div key={p._id}
                      onClick={() => { setPickUnsoldPlayer_(p); setPickUnsoldPrice(String(p.basePrice || basePrice)); setPickUnsoldTeam(null); }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-all`}
                      style={pickUnsoldPlayer_?._id === p._id
                        ? {borderColor:'#d97706', background:'rgba(217,119,6,0.06)'}
                        : {borderColor:'#e2e8f0', background:'#f8fafc'}}>
                      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 border border-slate-300">
                        {p.photo ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/> : p.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.role || 'Player'}</div>
                        <div className="text-[10px] font-orbitron" style={{color:'#d97706'}}>{p.basePrice || basePrice} pts base</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right: team + price assignment */}
                <div className="flex-1 overflow-y-auto p-5">
                  {!pickUnsoldPlayer_ ? (
                    <div className="flex items-center justify-center h-full text-slate-300 text-sm">← Select a player first</div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected player summary */}
                      <div className="flex items-center gap-3 p-3 rounded-2xl border border-amber-200 bg-amber-50">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center font-bold text-slate-500 border-2 border-amber-300">
                          {pickUnsoldPlayer_.photo ? <img src={pickUnsoldPlayer_.photo} alt="" className="w-full h-full object-cover"/> : pickUnsoldPlayer_.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{pickUnsoldPlayer_.name}</div>
                          <div className="text-xs text-slate-500">{pickUnsoldPlayer_.role || ''} · Base: {pickUnsoldPlayer_.basePrice || basePrice} pts</div>
                        </div>
                      </div>

                      {/* Price input */}
                      <div>
                        <label className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest block mb-1.5">Pick Price (pts)</label>
                        <input type="number" min={0} value={pickUnsoldPrice}
                          onChange={e => setPickUnsoldPrice(e.target.value)}
                          className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 font-orbitron text-lg font-bold text-slate-800 focus:outline-none focus:border-amber-400 transition-colors"
                          placeholder={String(basePrice)}/>
                      </div>

                      {/* Team grid */}
                      <div>
                        <label className="text-[10px] font-orbitron text-slate-400 uppercase tracking-widest block mb-2">Assign to Team</label>
                        <div className="grid grid-cols-2 gap-2">
                          {teams.map(t => {
                            const price = parseInt(pickUnsoldPrice, 10) || 0;
                            const slotsLeft = t.slots - (t.players?.length || 0);
                            const canAfford = price <= t.budgetLeft;
                            const disabled = slotsLeft === 0 || !canAfford;
                            return (
                              <div key={t._id}
                                onClick={() => !disabled && setPickUnsoldTeam(t._id)}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
                                style={pickUnsoldTeam === t._id
                                  ? {borderColor: t.color, background:`${t.color}10`}
                                  : {borderColor:'#e2e8f0', background:'#f8fafc'}}>
                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-sm" style={{background: t.color}}>
                                  {t.logo ? <img src={t.logo} alt="" className="w-full h-full object-cover"/> : t.name[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800 truncate">{t.name}</div>
                                  <div className="text-[10px]" style={{color: canAfford ? '#059669' : '#dc2626'}}>
                                    {Math.round(t.budgetLeft)} pts left
                                  </div>
                                  <div className="text-[10px] text-slate-400">{slotsLeft} slot{slotsLeft!==1?'s':''} left</div>
                                </div>
                                {pickUnsoldTeam === t._id && <span className="text-amber-500 text-sm">✓</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Confirm */}
                      <button
                        onClick={handlePickUnsoldConfirm}
                        disabled={loading || !pickUnsoldTeam || !pickUnsoldPlayer_}
                        className="w-full py-3 rounded-xl font-display tracking-widest text-white font-bold text-sm transition-all hover:-translate-y-0.5 disabled:opacity-40"
                        style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}>
                        {loading ? '⏳ Saving...' : `✅ ASSIGN ${pickUnsoldPlayer_?.name?.toUpperCase()} →  TEAM`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Swing overlay */}
      {showSwing && (
        <div className="fixed inset-0 bg-white/85 backdrop-blur-sm z-[200] flex flex-col items-center justify-center gap-6">
          <div className="text-8xl animate-swing inline-block" style={{transformOrigin:'bottom center'}}>🏏</div>
          <div className="font-display text-5xl tracking-widest animate-fade-in" style={{color:'#dc2626'}}>NEXT UP...</div>
        </div>
      )}

      {/* Bonus popup */}
      {bonusPopup && (
        <div className="fixed top-20 right-6 z-[350] animate-slide-right">
          <div className="bg-white border-2 rounded-2xl p-5 text-center min-w-[190px] shadow-xl"
            style={{borderColor:'#1d4ed8'}}>
            <div className="text-3xl mb-2">🎯</div>
            <div className="font-display text-xl tracking-wide" style={{color:'#1d4ed8'}}>{bonusPopup.rule.label}!</div>
            <div className="text-xs text-slate-400 my-1 font-raj">{bonusPopup.team}</div>
            <div className="font-orbitron text-emerald-600 font-bold text-sm">+{bonusPopup.rule.bonusPoints} POINTS</div>
          </div>
        </div>
      )}

      {/* Sold burst */}
      {soldResult && <SoldBurst result={soldResult} onClose={() => { setSoldResult(null); if (!round2ReadyRef.current) setShowWheel(true); }}/>}

      {/* Pick modal */}
      {pickModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          onClick={() => { setPickModal(false); startLocalTimer(); }}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-lg animate-pop shadow-2xl border-2"
            style={{borderColor:'rgba(220,38,38,0.4)'}}
            onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-2xl tracking-widest mb-4" style={{color:'#dc2626'}}>🏏 PICK PLAYER</h2>

            {currentPlayer && (
              <div className="mb-5 rounded-2xl overflow-hidden" style={{height:180}}>
                <PlayerProfileCard player={currentPlayer} size="small"/>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="font-orbitron text-xs text-slate-400 uppercase tracking-widest">Assign to team</span>
              <span className="font-orbitron text-xl font-bold" style={{color:'#dc2626'}}>{Math.round(currentBid)} pts</span>
            </div>

            {activeBonusRule && (
              <div className="mb-3 text-xs font-bold rounded-lg px-3 py-2 border"
                style={{color:'#059669', background:'rgba(5,150,105,0.06)', borderColor:'rgba(5,150,105,0.3)'}}>
                🎯 +{activeBonusRule.bonusPoints} bonus points will be awarded!
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-5 max-h-52 overflow-y-auto">
              {teams.map(t => {
                const slotsLeft = t.slots - (t.players?.length || 0);
                const maxBid    = getMaxBid(t);
                const canAfford = currentBid <= t.budgetLeft && currentBid <= maxBid;
                return (
                <div key={t._id} onClick={() => slotsLeft > 0 ? setSelectedTeam(t._id) : null}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${slotsLeft === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={selectedTeam===t._id
                    ? {borderColor:'#dc2626', background:'rgba(220,38,38,0.05)'}
                    : {borderColor:'#e2e8f0', background:'#f8fafc'}}>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                    {t.logo
                      ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm"
                          style={{background:t.color}}>{t.name[0]}</div>}
                  </div>
                  <div className="text-xs font-bold text-center leading-tight text-slate-800">{t.name}</div>
                  <div className="font-orbitron text-[10px]" style={{color: canAfford ? t.color : '#dc2626'}}>
                    {Math.round(t.budgetLeft || 0)} pts left
                  </div>
                  <div className="text-[9px] text-slate-400">max/player: <span className="font-bold text-blue-600">{slotsLeft > 0 ? maxBid : '—'} pts</span></div>
                  <div className="text-[10px] text-slate-400">{slotsLeft} slots left</div>
                  {!canAfford && slotsLeft > 0 && (
                    <div className="text-[9px] text-red-500 font-bold">⚠ Over max</div>
                  )}
                </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-3"
                onClick={() => { setPickModal(false); startLocalTimer(); }}>Cancel</button>
              <button className="flex-1 py-3 text-sm font-display tracking-widest rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#059669,#0d9488)'}}
                onClick={confirmSell} disabled={loading || !selectedTeam}>
                {loading ? '⏳ Saving...' : '✅ CONFIRM SOLD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CricBg>
  );
}