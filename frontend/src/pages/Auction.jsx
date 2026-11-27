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
import FullscreenButton from '../components/FullscreenButton';
import ShareLiveLink from '../components/ShareLiveLink';
import { playWheelClick, playBidChime } from '../utils/audio';
import LuxurySpinWheel from '../components/LuxurySpinWheel';
import criczaarLogo from '../logo.png';

function SpinWheel({ players, onSpin, isCompleted, onResults, round2Ready, onPickUnsold, onCompleteAuction, loading, roomId }) {
  const remaining = players.filter(p => p.status === 'remaining');
  const unsoldPlayers = players.filter(p => p.status === 'unsold');
  const shouldShowPickUnsold = round2Ready || (remaining.length === 0 && unsoldPlayers.length > 0 && !isCompleted);

  if (shouldShowPickUnsold) return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed bg-white p-10 text-center animate-rise"
      style={{borderColor:'rgba(234,179,8,0.5)'}}>
      <div className="text-6xl animate-float">✅</div>
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
          style={{background:'linear-gradient(135deg,#F59E0B,#D97706)'}}
          onClick={onCompleteAuction} disabled={loading}>
          🏆 Complete Auction
        </button>
      </div>
    </div>
  );

  if (isCompleted) return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-14 text-center animate-rise">
      <div className="text-5xl animate-float">🏆</div>
      <p className="font-display text-xl tracking-wide text-slate-700">Auction Complete!</p>
      <button className="btn-primary px-8 py-2.5" onClick={onResults}>View Results</button>
    </div>
  );

  return (
    <div className="relative overflow-hidden flex-shrink-0 flex flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 py-5 px-4 animate-rise w-full max-w-xl mx-auto shadow-2xl"
      style={{background:'linear-gradient(160deg,rgba(23,30,51,0.96),rgba(14,19,34,0.95))'}}>
      <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full pointer-events-none animate-drift"
        style={{background:'radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)'}}/>
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full pointer-events-none animate-drift"
        style={{background:'radial-gradient(circle,rgba(99,102,241,0.22),transparent 70%)', animationDelay:'-9s'}}/>
      <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none"/>

      <p className="relative font-display text-2xl tracking-widest text-gradient mb-1">
        SPIN TO PICK NEXT PLAYER
      </p>

      <LuxurySpinWheel
        players={players}
        isHost={true}
        size={390}
        disabled={loading}
        onSpinStart={(spinData) => {
          if (roomId) {
            try {
              getSocket().emit('wheel-spin', {
                roomId,
                ...spinData,
              });
            } catch (err) {}
          }
        }}
        onLoadPlayer={(winnerId) => {
          onSpin(winnerId);
        }}
      />
    </div>
  );
}

/* ── "NEXT UP" reveal shown while the next player loads ─────────── */
const NEXTUP_CSS = `
@property --nu-ang { syntax:'<angle>'; initial-value:0deg; inherits:false; }
@keyframes nuSpin  { to { --nu-ang:360deg; } }
@keyframes nuBack  { from{opacity:0} to{opacity:1} }
@keyframes nuRing  { 0%{transform:scale(.3);opacity:.8} 100%{transform:scale(2.6);opacity:0} }
@keyframes nuTitle { 0%{opacity:0;letter-spacing:.9em;transform:scale(1.35)} 100%{opacity:1;letter-spacing:.26em;transform:none} }
@keyframes nuCard  { 0%{opacity:0;transform:translateY(70px) scale(.8)} 100%{opacity:1;transform:none} }
@keyframes nuAvatar{ 0%{transform:scale(0) rotate(-90deg)} 70%{transform:scale(1.1) rotate(6deg)} 100%{transform:none} }
@keyframes nuWipeL { from{transform:translateX(-110%)} to{transform:translateX(0)} }
@keyframes nuWipeR { from{transform:translateX(110%)}  to{transform:translateX(0)} }
@keyframes nuUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
@keyframes nuBat   { 0%,100%{transform:rotate(-40deg)} 50%{transform:rotate(28deg)} }
@keyframes nuDot   { 0%,80%,100%{opacity:.2} 40%{opacity:1} }
@keyframes nuFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
`;

const PersonIcon = ({ size = 64, color = '#8591B0' }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill={color} style={{ display:'block' }}>
    <circle cx="60" cy="40" r="22"/>
    <path d="M12 120c0-30 21-50 48-50s48 20 48 50z"/>
  </svg>
);

function NextUpOverlay({ player }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 overflow-hidden"
      style={{
        background:'radial-gradient(circle at 50% 42%,rgba(99,102,241,0.30),transparent 55%),radial-gradient(circle at 50% 105%,rgba(245,158,11,0.28),transparent 55%),rgba(10,15,29,0.94)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', animation:'nuBack .25s ease',
      }}>
      <style>{NEXTUP_CSS}</style>

      {/* expanding rings */}
      {[0, 0.4, 0.8].map(d => (
        <span key={d} className="absolute rounded-full pointer-events-none"
          style={{ width:300, height:300, border:'2px solid rgba(245,158,11,0.5)', animation:`nuRing 2s ${d}s ease-out infinite` }}/>
      ))}

      {/* sliding light bars */}
      <div className="absolute left-0 top-[16%] h-[2px] w-1/2 pointer-events-none"
        style={{ background:'linear-gradient(90deg,transparent,#F59E0B)', animation:'nuWipeL .6s cubic-bezier(.22,1,.36,1)' }}/>
      <div className="absolute right-0 top-[16%] h-[2px] w-1/2 pointer-events-none"
        style={{ background:'linear-gradient(270deg,transparent,#38BDF8)', animation:'nuWipeR .6s .1s cubic-bezier(.22,1,.36,1) backwards' }}/>
      <div className="absolute left-0 bottom-[16%] h-[2px] w-1/2 pointer-events-none"
        style={{ background:'linear-gradient(90deg,transparent,#6366F1)', animation:'nuWipeL .6s .2s cubic-bezier(.22,1,.36,1) backwards' }}/>
      <div className="absolute right-0 bottom-[16%] h-[2px] w-1/2 pointer-events-none"
        style={{ background:'linear-gradient(270deg,transparent,#F59E0B)', animation:'nuWipeR .6s .3s cubic-bezier(.22,1,.36,1) backwards' }}/>

      <div className="w-16 h-16 rounded-2xl p-2.5 bg-black/70 border border-amber-400/50 shadow-xl shadow-amber-500/25 flex items-center justify-center animate-bounce">
        <img src={criczaarLogo} alt="CricZaar" className="w-full h-full object-contain" />
      </div>

      <div className="relative font-display font-extrabold text-center"
        style={{ fontSize:'clamp(40px,8vw,84px)', lineHeight:1, animation:'nuTitle .40s cubic-bezier(.22,1,.36,1) backwards' }}>
        <span className="text-gradient">NEXT UP</span>
      </div>

      {/* player reveal card */}
      <div className="relative flex flex-col items-center gap-3 px-12 py-7 rounded-3xl border"
        style={{
          background:'rgba(18,24,41,0.82)', borderColor:'rgba(255,255,255,0.10)',
          boxShadow:'0 24px 70px rgba(0,0,0,0.55), 0 0 60px rgba(245,158,11,0.12)',
          animation:'nuCard .75s .25s cubic-bezier(.22,1,.36,1) backwards', minWidth:300,
        }}>
        {/* avatar with rotating ring */}
        <div className="relative" style={{ width:136, height:136, animation:'nuAvatar .8s .45s cubic-bezier(.34,1.56,.64,1) backwards' }}>
          <div className="absolute rounded-full" style={{
            inset:-5, background:'conic-gradient(from var(--nu-ang),#F59E0B,#38BDF8,#6366F1,#F59E0B)',
            animation:'nuSpin 3s linear infinite', boxShadow:'0 0 34px rgba(245,158,11,0.45)' }}/>
          <div className="absolute inset-0 rounded-full overflow-hidden flex items-end justify-center"
            style={{ background:'linear-gradient(160deg,#171E33,#0A0F1D)' }}>
            {player?.photo
              ? <img src={player.photo} alt={player.name} className="w-full h-full object-cover"/>
              : <img src={`${process.env.PUBLIC_URL || ''}/non-profile.png`} alt="Player"
                  className="w-full h-full object-cover" draggable={false}
                  style={{ objectPosition:'center 18%', transform:'scale(1.12)', animation: player ? 'nuFloat 3s ease-in-out infinite' : 'none',
                           opacity: player ? 1 : 0.45, filter: player ? 'none' : 'grayscale(1)' }}/>}
          </div>
        </div>

        {player ? (
          <>
            <div className="font-display font-extrabold text-white text-center"
              style={{ fontSize:34, lineHeight:1.05, letterSpacing:1, animation:'nuUp .5s .7s cubic-bezier(.22,1,.36,1) backwards' }}>
              {player.name}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center" style={{ animation:'nuUp .5s .85s cubic-bezier(.22,1,.36,1) backwards' }}>
              {player.role && (
                <span className="px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.18em] uppercase"
                  style={{ background:'rgba(99,102,241,0.18)', border:'1px solid rgba(99,102,241,0.5)', color:'#A5B4FC' }}>
                  {player.role}
                </span>
              )}
              {player.club && (
                <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/45">{player.club}</span>
              )}
            </div>
            <div className="font-mono font-bold" style={{ color:'#F59E0B', fontSize:22, textShadow:'0 0 22px rgba(245,158,11,0.55)', animation:'nuUp .5s 1s cubic-bezier(.22,1,.36,1) backwards' }}>
              <span className="text-[10px] tracking-[0.2em] text-white/40 mr-2 font-medium">BASE</span>
              {player.basePrice || 0} <span className="text-xs opacity-70">pts</span>
            </div>
          </>
        ) : (
          <div className="font-mono text-sm tracking-[0.25em] uppercase text-white/55" style={{ animation:'nuUp .5s .7s backwards' }}>
            Drawing player
            {[0, 1, 2].map(i => <span key={i} style={{ animation:`nuDot 1.2s ${i * .2}s infinite` }}>.</span>)}
          </div>
        )}
      </div>
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
  const [nextUp, setNextUp]               = useState(null);   // player shown in the NEXT UP reveal
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
    setNextUp(playerId ? (players.find(p => p._id === playerId) || null) : null);
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
    }, 1900);
  };

  const handleBackToWheel = () => {
    stopLocalTimer();
    dispatch({ type: 'SET_CURRENT_PLAYER', payload: null });
    setShowWheel(true);
    const s = getSocket();
    s.emit('next-player', { roomId: room._id, player: null });
    s.emit('timer-stopped', { roomId: room._id });
    toast('🎡 Returned to Spin Wheel', { icon: '🎡' });
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
          team:{ _id:assignedTeam, name:assignedTeamObj?.name||'', color:assignedTeamObj?.color||'#F59E0B', logo:assignedTeamObj?.logo||'' },
          playerName:assignedName, playerPhoto:pickUnsoldPlayer_.photo,
          teamName:assignedTeamObj?.name||'', teamColor:assignedTeamObj?.color||'#F59E0B',
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
        team:{ _id:selectedTeam, name:team?.name||'', color:team?.color||'#F59E0B', logo:team?.logo||'' },
        playerName:currentPlayer.name, playerPhoto:currentPlayer.photo,
        teamName:team?.name||'', teamColor:team?.color||'#F59E0B',
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
          <div className="rounded-2xl px-6 py-3 text-center font-display text-lg tracking-widest pause-stripes flex-shrink-0 border-2"
            style={{background:'rgba(234,179,8,0.1)', borderColor:'#FBBF24', color:'#FBBF24'}}>
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
            roomId={room._id}
          />
        ) : currentPlayer ? (
          <div className={`flex-shrink-0 flex gap-3 items-stretch transition-opacity duration-300 ${isPaused ? 'opacity-60' : ''}`}>
            {/* Player card — widened for a bigger photo, matched to bid panel's height */}
            <div className="w-[700px] flex-shrink-0">
              <PlayerProfileCard player={currentPlayer} size="large"/>
            </div>
            {/* Current Bid + Timer panel — arena look */}
            <div className="flex-1 arena-panel p-6 flex flex-col justify-between gap-5 min-w-[260px] overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none animate-drift"
                style={{background:'radial-gradient(circle,rgba(245,158,11,0.18),transparent 70%)'}}/>
              <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full pointer-events-none animate-drift"
                style={{background:'radial-gradient(circle,rgba(99,102,241,0.18),transparent 70%)', animationDelay:'-8s'}}/>

              <div className="relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-[10px] font-bold tracking-[0.18em] uppercase"
                  style={{background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)', color:'#FBBF24'}}>
                  <span className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${isPaused ? '' : 'live-dot'}`}/>
                  {isPaused ? 'Paused' : 'Live Bidding'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-widest uppercase text-white/40 px-2.5 py-1 rounded-md border border-white/10">
                    Lot #{sold + unsold + 1}
                  </span>
                  <FullscreenButton size="sm" />
                </div>
              </div>

              <div className="relative">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">Current Highest Bid</div>
                <div className="relative inline-block">
                  {/* ripple + number re-mount on every new bid → pop animation */}
                  <span key={`rp-${currentBid}`} className="bid-ripple absolute left-1/2 top-1/2 w-24 h-24 -ml-12 -mt-12 rounded-full pointer-events-none"
                    style={{border:'2px solid rgba(245,158,11,0.6)'}}/>
                  <div key={currentBid} className="bid-pop font-mono font-black text-6xl leading-none"
                    style={{color:'#F59E0B', textShadow:'0 0 28px rgba(245,158,11,0.45)'}}>
                    {Math.round(currentBid)}<span className="text-xl ml-2 text-white/40 font-bold"> pts</span>
                  </div>
                </div>

                <div className="mt-4 min-h-[30px]">
                  {winningTeam ? (
                    <span key={winningTeam._id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold animate-rise"
                      style={{background:'rgba(255,255,255,0.05)', border:`1px solid ${winningTeam.color}`, color:winningTeam.color}}>
                      <span className="w-2 h-2 rounded-full live-dot" style={{background:winningTeam.color}}/>
                      🏆 {winningTeam.name}
                      <span className="font-mono text-[9px] opacity-70 tracking-[0.18em]">HOLDING BID</span>
                    </span>
                  ) : (
                    <span className="text-sm text-white/40">No bid yet — base price</span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-white/35 mt-2 tracking-wider">
                  NEXT BID <span className="text-white/75 font-bold">{Math.round(currentBid + getNextIncrement(currentBid))}</span> PTS
                </div>
              </div>

              <div className="relative flex items-center gap-5 flex-wrap">
                <TimerRing seconds={timerSecs} maxSeconds={maxTimer}/>
                <div className="flex-1 min-w-[140px]">
                  <div className="flex justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-white/40 mb-1.5">
                    <span>Auction Progress</span><span className="text-white/70">{Math.round(pct)}%</span>
                  </div>
                  <div className="w-full rounded-full h-2 overflow-hidden" style={{background:'rgba(255,255,255,0.07)'}}>
                    <div className="h-full rounded-full"
                      style={{width:`${pct}%`, background:'linear-gradient(90deg,#F59E0B,#38BDF8,#6366F1)', transition:'width 1s cubic-bezier(.22,1,.36,1)'}}/>
                  </div>
                  <div className="flex gap-3 mt-2 font-mono text-[10px] text-white/45">
                    <span>✅ {sold}</span><span>❌ {unsold}</span><span>⏳ {remain}</span>
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
            {teams.map((t, ti) => {
              const isWin      = (currentBidder?._id || currentBidder?.id || currentBidder) === t._id;
              const slotsLeft  = t.slots - (t.players?.length || 0);
              const maxBid     = getMaxBid(t);
              const budgetPct  = Math.round(((t.budget - t.budgetLeft) / t.budget) * 100);
              const nextBidAmt = Math.round(currentBid + getNextIncrement(currentBid));
              const wouldExceed = nextBidAmt > maxBid;
              const nextBidBonus = room?.rules?.bidBonusRules?.find(r => nextBidAmt >= r.minBid && nextBidAmt <= r.maxBid);

              return (
                <div key={t._id}
                  className={`relative rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1 ${isWin ? 'lead-glow border-amber-500' : 'border-white/10 hover:border-white/25'}`}
                  style={{
                    background: isWin ? 'linear-gradient(160deg,rgba(245,158,11,0.12),rgba(18,24,41,0.92))' : 'rgba(18,24,41,0.85)',
                    animation: 'riseIn .55s cubic-bezier(.22,1,.36,1) backwards',
                    animationDelay: `${ti * 50}ms`,
                  }}>
                  {isWin && <span key={`fl-${currentBid}`} className="bid-flash"/>}

                  <div className="h-1.5 w-full" style={{background: isWin ? 'linear-gradient(90deg,#F59E0B,#D97706)' : t.color}}/>

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
                                style={{background: i < (t.players?.length||0) ? t.color : '#222B45'}}/>
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400 font-raj">{t.players?.length||0}/{t.slots}</span>
                        </div>
                      </div>
                      {isWin && (
                        <span className="font-mono text-[9px] font-black text-amber-400 border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0 tracking-widest animate-pop">LEAD</span>
                      )}
                    </div>

                    {/* Budget bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400 font-raj">Budget left</span>
                        <span className="font-orbitron font-bold" style={{color: t.budgetLeft < 100 ? '#F59E0B' : t.color}}>
                          {Math.round(t.budgetLeft)} <span className="font-normal text-slate-400">pts</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{width:`${budgetPct}%`, background:`linear-gradient(90deg,${t.color},#F59E0B)`}}/>
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
                      className={`bid-btn w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold font-raj tracking-widest transition-all uppercase
                        text-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
                        ${!(slotsLeft === 0 || wouldExceed) ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}
                      style={{
                        background: slotsLeft === 0
                          ? '#2E3A5C'
                          : wouldExceed
                            ? 'linear-gradient(135deg,#f97316,#ea580c)'
                            : isWin
                              ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                              : `linear-gradient(135deg,${t.color},#6366F1)`,
                        color: isWin && slotsLeft > 0 && !wouldExceed ? '#0A0F1D' : '#fff',
                        boxShadow: isWin && slotsLeft > 0 ? '0 4px 12px rgba(245,158,11,0.35)' : 'none',
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
      <div className="w-80 border-l border-white/60 flex flex-col overflow-hidden flex-shrink-0" style={{background:"rgba(18,24,41,0.82)", backdropFilter:"blur(12px)"}}>
        <div className="section-title">🎯 Bid Rules</div>
        <div className="flex-shrink-0 p-3 space-y-3">
          {/* Active bonus */}
          {activeBonusRule && (
            <div className="rounded-xl px-3 py-2.5 text-xs flex items-center gap-2 border"
              style={{background:'rgba(99,102,241,0.06)', borderColor:'rgba(99,102,241,0.25)', color:'#818CF8'}}>
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
                      ? {background:'rgba(99,102,241,0.08)', borderColor:'rgba(99,102,241,0.4)', color:'#818CF8'}
                      : {background:'#0F1629', borderColor:'#222B45', color:'#94a3b8'}}>
                    <span className="flex items-center gap-1.5">
                      {isActive && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{background:'#6366F1'}}/>}
                      {r.label}
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-orbitron" style={isActive?{color:'#818CF8'}:{color:'#94a3b8'}}>+{r.bonusPoints}pts</span>
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
              className="flex-1 min-w-[70px] px-3 py-2.5 rounded-xl text-sm font-raj font-bold border border-white/10 bg-white/5
                hover:border-amber-500 hover:text-amber-400 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-30">
              +{inc} pts
            </button>
          ))}
        </div>

        <div className="section-title">⚡ Auction Controls</div>
        <div className="flex-shrink-0 p-3 space-y-2.5">
          <button
            className="w-full px-6 py-3.5 text-base font-display tracking-widest rounded-xl text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#059669,#38BDF8)'}}
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
                ? {background:'#FBBF24', color:'#0A0F1D', borderColor:'#FBBF24'}
                : {background:'rgba(234,179,8,0.08)', borderColor:'rgba(234,179,8,0.4)', color:'#FBBF24'}}>
              {isPaused ? '▶ RESUME' : '⏸ PAUSE'}
            </button>
            <button className="btn-blue px-3 py-3 text-sm font-display tracking-widest rounded-xl"
              onClick={handleNext} disabled={loading || isPaused}>
              ➡ NEXT
            </button>
          </div>

          <button
            onClick={handleBackToWheel}
            disabled={loading || isPaused}
            className="w-full px-4 py-3 text-xs font-display tracking-widest rounded-xl border transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 shadow-md active:scale-95 font-bold"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(99,102,241,0.22))',
              borderColor: 'rgba(245,158,11,0.45)',
              color: '#FBBF24',
            }}
            title="Return to Spin Wheel to draw or change player">
            🎡 {currentPlayer ? 'CHANGE PLAYER / BACK TO WHEEL' : 'OPEN SPIN WHEEL'}
          </button>

          <button
            className="w-full px-5 py-3 text-sm font-display tracking-widest rounded-xl text-white font-bold border-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#6366F1,#F59E0B)'}}
            onClick={handleCompleteAuction} disabled={loading}
            title="Mark auction as complete (unsold players will remain unsold)">
            🏆 FINISH AUCTION
          </button>
        </div>

        <div className="section-title">📋 Bid Log</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {(room.auctionLog||[]).slice().reverse().slice(0,25).map((e,i) => (
            <div key={`${e.timestamp}-${e.message}`} style={{animation:'navIn .45s cubic-bezier(.22,1,.36,1) backwards'}} className={`text-xs px-2.5 py-1.5 rounded-lg font-raj
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
                        : {borderColor:'#222B45', background:'#0F1629'}}>
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
                                  : {borderColor:'#222B45', background:'#0F1629'}}>
                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white text-sm" style={{background: t.color}}>
                                  {t.logo ? <img src={t.logo} alt="" className="w-full h-full object-cover"/> : t.name[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800 truncate">{t.name}</div>
                                  <div className="text-[10px]" style={{color: canAfford ? '#059669' : '#F59E0B'}}>
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

      {/* NEXT UP reveal */}
      {showSwing && <NextUpOverlay player={nextUp}/>}

      {/* Bonus popup */}
      {bonusPopup && (
        <div className="fixed top-20 right-6 z-[350] animate-slide-right">
          <div className="bg-white border-2 rounded-2xl p-5 text-center min-w-[190px] shadow-xl"
            style={{borderColor:'#6366F1'}}>
            <div className="text-3xl mb-2">🎯</div>
            <div className="font-display text-xl tracking-wide" style={{color:'#818CF8'}}>{bonusPopup.rule.label}!</div>
            <div className="text-xs text-slate-400 my-1 font-raj">{bonusPopup.team}</div>
            <div className="font-orbitron text-emerald-600 font-bold text-sm">+{bonusPopup.rule.bonusPoints} POINTS</div>
          </div>
        </div>
      )}

      {/* Sold burst */}
      {soldResult && (
        <SoldBurst
          result={soldResult}
          onClose={() => {
            setSoldResult(null);
            if (!round2ReadyRef.current) {
              setShowWheel(true);
              getSocket().emit('next-player', { roomId: room._id, player: null });
            }
          }}
        />
      )}

      {/* Pick modal */}
      {pickModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          onClick={() => { setPickModal(false); startLocalTimer(); }}>
          <div className="bg-white rounded-3xl p-7 w-full max-w-lg animate-pop shadow-2xl border-2"
            style={{borderColor:'rgba(245,158,11,0.4)'}}
            onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-2xl tracking-widest mb-4" style={{color:'#F59E0B'}}>🏏 PICK PLAYER</h2>

            {currentPlayer && (
              <div className="mb-5 rounded-2xl overflow-hidden" style={{height:180}}>
                <PlayerProfileCard player={currentPlayer} size="small"/>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="font-orbitron text-xs text-slate-400 uppercase tracking-widest">Assign to team</span>
              <span className="font-orbitron text-xl font-bold" style={{color:'#F59E0B'}}>{Math.round(currentBid)} pts</span>
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
                    ? {borderColor:'#F59E0B', background:'rgba(245,158,11,0.05)'}
                    : {borderColor:'#222B45', background:'#0F1629'}}>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
                    {t.logo
                      ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm"
                          style={{background:t.color}}>{t.name[0]}</div>}
                  </div>
                  <div className="text-xs font-bold text-center leading-tight text-slate-800">{t.name}</div>
                  <div className="font-orbitron text-[10px]" style={{color: canAfford ? t.color : '#F59E0B'}}>
                    {Math.round(t.budgetLeft || 0)} pts left
                  </div>
                  <div className="text-[9px] text-slate-400">max/player: <span className="font-bold text-blue-600">{slotsLeft > 0 ? maxBid : '—'} pts</span></div>
                  <div className="text-[10px] text-slate-400">{slotsLeft} slots left</div>
                  {!canAfford && slotsLeft > 0 && (
                    <div className="text-[9px] text-amber-500 font-bold">⚠ Over max</div>
                  )}
                </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-3"
                onClick={() => { setPickModal(false); startLocalTimer(); }}>Cancel</button>
              <button className="flex-1 py-3 text-sm font-display tracking-widest rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{background:'linear-gradient(135deg,#059669,#38BDF8)'}}
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