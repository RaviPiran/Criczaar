import React from 'react';
import { useAuction } from '../context/AuctionContext';
import CricBg from '../components/CricBg';
import { useNavigate } from 'react-router-dom';

export default function Results() {
  const { state } = useAuction();
  const navigate = useNavigate();
  const { room, teams = [], players = [] } = state;

  // BUG FIX #11: Old code used soldTo OR retainedBy filter which double-counted retained players.
  // Now we use each team's own players[] array (populated from server) as the authoritative source.
  // Falls back to player-level soldTo for robustness.
  const getTeamPlayers = (team) => {
    // Prefer team.players[] populated array (has isRetained flag)
    if (team.players && team.players.length > 0) {
      return team.players
        .filter(tp => tp.player) // guard against unpopulated refs
        .map(tp => ({
          ...(tp.player._id ? tp.player : { _id: tp.player, name: '—' }),
          soldPrice: tp.soldPrice,
          isRetained: tp.isRetained,
        }));
    }
    // Fallback: scan global players array — deduplicated by _id
    const seen = new Set();
    return players
      .filter(p => {
        const teamId = p.soldTo?._id || p.soldTo;
        if (teamId !== team._id) return false;
        if (seen.has(p._id)) return false;
        seen.add(p._id);
        return true;
      });
  };

  const sold       = players.filter(p => p.status === 'sold' || p.status === 'retained');
  const unsold     = players.filter(p => p.status === 'unsold');
  const totalSpent = teams.reduce((s, t) => s + ((t.budget || 0) - (t.budgetLeft ?? t.budget ?? 0)), 0);
  const topSale    = [...sold].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))[0];

  // Top Sellers leaderboard — highest priced sold players across all teams
  const teamById = Object.fromEntries(teams.map(t => [t._id, t]));
  const topSellers = [...sold]
    .filter(p => (p.soldPrice || 0) > 0)
    .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
    .slice(0, 10)
    .map(p => ({ ...p, team: teamById[p.soldTo?._id || p.soldTo] }));
  const RANK_BADGE = ['🥇', '🥈', '🥉'];

  if (!room) return (
    <CricBg>
      <div className="p-6 text-center text-slate-400 min-h-full flex flex-col items-center justify-center">
        <div className="text-6xl mb-4 opacity-30">📊</div>
        <p>No active room. <button className="underline text-blue-500" onClick={() => navigate('/tournaments')}>Go to tournaments</button></p>
      </div>
    </CricBg>
  );

  return (
    <CricBg>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-3xl text-slate-900 tracking-wide">📊 Auction Results</h2>
            <p className="text-slate-500 text-sm mt-1">{room.name} — {room.code}</p>
          </div>
          {room.status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>🏆 Completed
            </span>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ['Total Sold',  sold.length,                                      'text-emerald-700', 'glass-card'],
            ['Unsold',      unsold.length,                                    'text-red-600',     'glass-card-red'],
            ['Total Spent', `${Math.round(totalSpent)} pts`,                  'text-blue-700',    'glass-card'],
            ['Top Sale',    topSale ? `${Math.round(topSale.soldPrice || 0)} pts` : '—', 'text-red-700', 'glass-card-red'],
          ].map(([l, v, c, cls]) => (
            <div key={l} className={`${cls} rounded-2xl p-5 text-center`}>
              <div className={`font-orbitron text-2xl font-bold ${c}`}>{v}</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {/* Top Sellers */}
        {topSellers.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-orbitron text-xs text-slate-500 uppercase tracking-widest">🏆 Top Sellers</h3>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-100/70">
                {topSellers.map((p, i) => (
                  <div key={p._id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 text-center font-orbitron text-sm font-bold text-slate-400 flex-shrink-0">
                      {RANK_BADGE[i] || `#${i + 1}`}
                    </div>
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">
                      {p.photo
                        ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                        : <div className="w-full h-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">{p.name?.[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                        {p.team && (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.team.color || '#dc2626' }}/>
                            {p.team.name}
                          </span>
                        )}
                        {p.role && <span>· {p.role}</span>}
                        {p.isRetained && <span className="text-blue-500">🔒 Retained</span>}
                      </div>
                    </div>
                    <div className="font-orbitron text-sm font-bold text-red-600 flex-shrink-0">
                      {Math.round(p.soldPrice || 0)} pts
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Team Squads */}
        <div className="space-y-4">
          <h3 className="font-orbitron text-xs text-slate-500 uppercase tracking-widest">Team Squads</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(team => {
              const teamPlayers = getTeamPlayers(team);
              const spent = (team.budget || 0) - (team.budgetLeft ?? team.budget ?? 0);
              return (
                <div key={team._id} className="glass-card rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg,${team.color},rgba(29,78,216,0.6))` }}/>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: team.color }}>
                        {team.logo
                          ? <img src={team.logo} alt={team.name} className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center font-display text-xl text-white" style={{ background: team.color }}>{team.name[0]}</div>}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-lg text-slate-900 tracking-wide">{team.name}</div>
                        <div className="text-xs text-slate-400">
                          {teamPlayers.length} players · {Math.round(spent)} pts spent · {Math.round(team.budgetLeft ?? 0)} pts left
                        </div>
                      </div>
                    </div>

                    {/* Budget bar */}
                    <div className="w-full bg-slate-200/60 rounded-full h-1.5 mb-4 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(Math.round((spent / (team.budget || 1)) * 100), 100)}%`, background: 'linear-gradient(90deg,#dc2626,#1d4ed8)' }}/>
                    </div>

                    {/* Player list */}
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {teamPlayers.length === 0
                        ? <div className="text-slate-400 text-xs text-center py-4">No players assigned yet</div>
                        : teamPlayers.map((p, i) => (
                          <div key={p._id || i} className="flex items-center gap-3 text-sm py-1 border-b border-slate-100/60 last:border-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">
                              {p.photo
                                ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                                : <div className="w-full h-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{(p.name || '?')[0]}</div>}
                            </div>
                            <span className="flex-1 text-slate-700 font-semibold truncate">{p.name || 'Unknown'}</span>
                            {p.role && <span className="text-[10px] text-slate-400 hidden sm:inline">{p.role}</span>}
                            {p.isRetained && <span className="text-xs text-blue-500 flex-shrink-0">🔒</span>}
                            <span className="font-orbitron text-xs flex-shrink-0" style={{ color: '#dc2626' }}>
                              {Math.round(p.soldPrice || p.retainPrice || 0)} pts
                            </span>
                          </div>
                        ))
                      }
                    </div>

                    {/* Slots summary */}
                    <div className="mt-3 flex gap-0.5">
                      {Array.from({ length: team.slots }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-sm"
                          style={{ background: i < teamPlayers.length ? team.color : '#e2e8f0' }}/>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{teamPlayers.length}/{team.slots} slots filled</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unsold players */}
        {unsold.length > 0 && (
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <h3 className="font-orbitron text-xs text-red-500 uppercase tracking-widest">Unsold Players ({unsold.length})</h3>
            <div className="flex flex-wrap gap-2">
              {unsold.map(p => (
                <div key={p._id} className="flex items-center gap-2 bg-red-50/80 border border-red-200 rounded-lg px-3 py-1.5">
                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                    {p.photo
                      ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full bg-red-100 flex items-center justify-center text-xs text-red-500">{p.name[0]}</div>}
                  </div>
                  <span className="text-sm text-slate-600 font-semibold">{p.name}</span>
                  <span className="text-xs text-slate-400">{p.basePrice} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CricBg>
  );
}
