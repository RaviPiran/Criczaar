import React, { useState, useMemo } from 'react';
import { useAuction } from '../context/AuctionContext';
import { retainPlayerAPI, releaseRetention, getFullRoom } from '../utils/api';
import toast from 'react-hot-toast';
import CricBg from '../components/CricBg';
import { useNavigate } from 'react-router-dom';

export default function Retentions() {
  const { state, dispatch } = useAuction();
  const { room, teams = [], players = [] } = state;
  const navigate = useNavigate();

  const [form, setForm]           = useState({ teamId: '', playerId: '', price: '' });
  const [loading, setLoading]     = useState(false);
  const [releasing, setReleasing] = useState(null);

  // FIX: Only show players that are still 'remaining' (not already retained/sold)
  const availablePlayers = useMemo(
    // FIX: exclude both retained and sold players
    () => players.filter(p => p.status === 'remaining' && !p.isRetained),
    [players]
  );
  const retainedPlayers = useMemo(
    // FIX: include isRetained:true as fallback in case status field lags behind
    () => players.filter(p => p.status === 'retained' || p.isRetained === true),
    [players]
  );

  // FIX: Auto-fill base price when player is selected
  const handlePlayerChange = (playerId) => {
    const player = players.find(p => p._id === playerId);
    setForm(f => ({
      ...f,
      playerId,
      price: player ? player.basePrice : f.price,
    }));
  };

  const reload = async () => {
    if (!room?._id) return;
    try {
      const { data } = await getFullRoom(room._id);
      dispatch({ type: 'SET_FULL_DATA', payload: data.data });
    } catch { /* silent */ }
  };

  const handleRetain = async () => {
    if (!form.teamId)   return toast.error('Select a team');
    if (!form.playerId) return toast.error('Select a player');
    if (!room)          return toast.error('No active room');

    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) return toast.error('Enter a valid retain price');

    const team   = teams.find(t => t._id === form.teamId);
    const player = players.find(p => p._id === form.playerId);

    // FIX: Validate budget before calling API
    if (team && price > (team.budgetLeft ?? 0)) {
      return toast.error(`❌ ${team.name} only has ${team.budgetLeft} pts left — can't retain at ${price} pts`);
    }

    // FIX: Validate player still available (may have been retained in another tab)
    if (player && player.status !== 'remaining') {
      return toast.error(`${player.name} is no longer available (status: ${player.status})`);
    }

    // FIX: Optimistic local update — set status:'retained' not 'sold'
    // Previous code used PICK_UNSOLD which set status:'sold', so player never
    // appeared in the retainedPlayers list (filtered by status === 'retained')
    dispatch({
      type: 'RETAIN_PLAYER',
      payload: { playerId: form.playerId, teamId: form.teamId, price },
    });
    // Reset form immediately
    setForm({ teamId: '', playerId: '', price: '' });

    setLoading(true);
    try {
      await retainPlayerAPI(room._id, {
        teamId:      form.teamId,
        playerId:    form.playerId,
        retainPrice: price,
      });
      toast.success(`🔒 ${player?.name || 'Player'} retained!`);
      // Sync with server for accurate retained status in state
      await reload();
    } catch (err) {
      // Rollback optimistic update on failure
      toast.error(err?.response?.data?.message || 'Failed to retain player');
      await reload(); // reload to restore correct state
    }
    setLoading(false);
  };

  const handleRelease = async (player) => {
    if (!window.confirm(`Release ${player.name} back to auction pool?`)) return;
    setReleasing(player._id);
    try {
      await releaseRetention(room._id, player._id);
      toast.success(`🔓 ${player.name} released`);
      await reload();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to release');
    }
    setReleasing(null);
  };

  const selectedTeam = teams.find(t => t._id === form.teamId);
  const budgetLeft   = selectedTeam?.budgetLeft ?? 0;
  const retainPrice  = parseFloat(form.price) || 0;
  const budgetOk     = !form.teamId || retainPrice <= budgetLeft;

  if (!room) return (
    <CricBg>
      <div className="p-6 text-center text-slate-400 min-h-full flex flex-col items-center justify-center gap-4">
        <div className="text-6xl opacity-30">🔒</div>
        <p>No active room.</p>
        <button onClick={() => navigate('/tournaments')} className="btn-primary px-5 py-2">
          ← Go to Tournaments
        </button>
      </div>
    </CricBg>
  );

  return (
    <CricBg>
      <div className="p-6 max-w-4xl space-y-8 animate-fade-in">
        <div>
          <h2 className="font-display text-3xl text-slate-900 tracking-wide">🔒 Retentions</h2>
          <p className="text-slate-500 text-sm mt-1">
            Retain players to teams before the auction starts. Budget is deducted immediately.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 flex-wrap">
          {[
            ['🔒', retainedPlayers.length,  'Retained',  'text-blue-700',  'glass-card'],
            ['⏳', availablePlayers.length,  'Available', 'text-slate-700', 'glass-card'],
            ['💰', teams.length,             'Teams',     'text-red-700',   'glass-card-red'],
          ].map(([em, v, l, c, cls]) => (
            <div key={l} className={`${cls} flex items-center gap-2 rounded-xl px-4 py-2.5`}>
              <span className="text-2xl">{em}</span>
              <div>
                <div className={`font-orbitron text-lg font-bold ${c}`}>{v}</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest">{l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Retention Form */}
        <div className="glass-card-red rounded-2xl p-6 space-y-4">
          <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{ color: '#dc2626' }}>
            Add Retention
          </h3>

          {availablePlayers.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl bg-white/30">
              No available players to retain. All players are already retained or sold.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              {/* Team select */}
              <div>
                <label className="label">Team</label>
                <select className="input" value={form.teamId}
                  onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}>
                  <option value="">-- Select Team --</option>
                  {teams.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({(t.budgetLeft ?? 0).toFixed(1)} pts left)
                    </option>
                  ))}
                </select>
                {/* FIX: Show team budget live */}
                {selectedTeam && (
                  <div className="text-xs mt-1 font-semibold" style={{ color: budgetOk ? '#059669' : '#dc2626' }}>
                    Budget: {budgetLeft.toFixed(1)} pts {!budgetOk && '⚠ Not enough'}
                  </div>
                )}
              </div>

              {/* Player select — FIX: only shows 'remaining' players */}
              <div>
                <label className="label">Player</label>
                <select className="input" value={form.playerId}
                  onChange={e => handlePlayerChange(e.target.value)}>
                  <option value="">-- Select Player --</option>
                  {availablePlayers.map(p => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Base {p.basePrice} pts)
                    </option>
                  ))}
                </select>
              </div>

              {/* Price — FIX: auto-fills base price, shows budget warning */}
              <div>
                <label className="label">Retain Price (pts)</label>
                <div className="flex gap-2">
                  <input
                    className={`input ${!budgetOk && form.price ? 'border-red-400 focus:ring-red-300' : ''}`}
                    type="number" step="0.5" min="0"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="pts"
                  />
                  <button
                    className="btn-primary px-5 py-2.5 whitespace-nowrap"
                    onClick={handleRetain}
                    disabled={loading || !form.teamId || !form.playerId || !form.price || !budgetOk}>
                    {loading ? '⏳' : '🔒 Retain'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Retained players list */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{ color: '#1d4ed8' }}>
            Retained Players <span className="text-slate-400">({retainedPlayers.length})</span>
          </h3>

          {retainedPlayers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/40">
              <div className="text-4xl mb-3 opacity-30">🔒</div>
              No retentions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {retainedPlayers.map(p => {
                const team = teams.find(t =>
                  t._id === (p.retainedBy?._id || p.retainedBy) ||
                  t._id === (p.soldTo?._id     || p.soldTo)     // fallback
                );
                return (
                  <div key={p._id}
                    className="flex items-center gap-4 rounded-xl p-4 border"
                    style={{ background: 'rgba(29,78,216,0.04)', borderColor: 'rgba(29,78,216,0.2)' }}>

                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: '#1d4ed8' }}>
                      {p.photo
                        ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full bg-blue-100 flex items-center justify-center font-display text-lg text-blue-600">{p.name?.[0]}</div>}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {p.role  && <div className="text-xs text-slate-400">{p.role}</div>}
                      {p.club  && <div className="text-xs text-slate-400">{p.club}</div>}
                    </div>

                    {/* Team */}
                    {team ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {team.logo
                          ? <img src={team.logo} alt={team.name} className="w-7 h-7 rounded-full object-cover border border-slate-200"/>
                          : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                              style={{ background: team.color }}>{team.name?.[0]}</div>}
                        <span className="text-sm font-semibold text-slate-700">{team.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic flex-shrink-0">Unknown team</span>
                    )}

                    {/* Price */}
                    <div className="font-orbitron font-bold text-sm flex-shrink-0" style={{ color: '#dc2626' }}>
                      {(p.retainPrice ?? p.soldPrice ?? 0)} pts
                    </div>

                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex-shrink-0">
                      🔒 Retained
                    </span>

                    {/* Release */}
                    <button
                      onClick={() => handleRelease(p)}
                      disabled={releasing === p._id}
                      className="ml-2 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40 flex-shrink-0">
                      {releasing === p._id ? '⏳' : '🔓 Release'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CricBg>
  );
}