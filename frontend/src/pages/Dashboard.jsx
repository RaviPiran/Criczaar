import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../context/AuctionContext';
import { getUserRooms, getFullRoom } from '../utils/api';
import CricBg from '../components/CricBg';
import ShareLiveLink from '../components/ShareLiveLink';

const QuickCard = ({ icon, title, desc, action, onClick, accent='red' }) => {
  const styles = {
    red:     { border:'rgba(220,38,38,0.28)',  text:'#dc2626' },
    blue:    { border:'rgba(29,78,216,0.28)',   text:'#1d4ed8' },
    emerald: { border:'rgba(5,150,105,0.28)',   text:'#059669' },
    violet:  { border:'rgba(109,40,217,0.28)',  text:'#7c3aed' },
    cyan:    { border:'rgba(8,145,178,0.28)',   text:'#0891b2' },
  };
  const s = styles[accent] || styles.red;
  return (
    <div onClick={onClick}
      className="glass-card rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{borderColor:s.border}}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-display text-xl tracking-wide text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 font-raj mb-4 leading-relaxed">{desc}</p>
      <span className="text-xs font-bold tracking-widest uppercase font-raj" style={{color:s.text}}>{action} →</span>
    </div>
  );
};

const statusBadge = (status) => {
  const map = {
    active:    { bg:'bg-emerald-100', text:'text-emerald-700', dot:'bg-emerald-500', label:'Active' },
    paused:    { bg:'bg-yellow-100',  text:'text-yellow-700',  dot:'bg-yellow-500',  label:'Paused' },
    completed: { bg:'bg-slate-100',   text:'text-slate-500',   dot:'bg-slate-400',   label:'Completed' },
    setup:     { bg:'bg-blue-100',    text:'text-blue-700',    dot:'bg-blue-400',    label:'Setup' },
  };
  const s = map[status] || map.setup;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status==='active'?'animate-pulse':''}`}/>
      {s.label}
    </span>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, dispatch } = useAuction();
  const { room, teams = [], players = [] } = state;

  const tournament = room?.tournament;

  const [pastRooms, setPastRooms]         = useState([]);
  const [loadingRooms, setLoadingRooms]   = useState(false);
  const [loadingSwitch, setLoadingSwitch] = useState(null);

  const sold      = players.filter(p=>p.status==='sold').length;
  const unsold    = players.filter(p=>p.status==='unsold').length;
  const retained  = players.filter(p=>p.status==='retained').length;
  const remain    = players.filter(p=>p.status==='remaining').length;
  const totalSpent= teams.reduce((s,t)=>s+((t.budget||0)-(t.budgetLeft??t.budget??0)),0);

  useEffect(() => { fetchPastRooms(); }, []);

  const fetchPastRooms = async () => {
    setLoadingRooms(true);
    try {
      const { data } = await getUserRooms();
      // Show only rooms from same tournament
      const all = data.data || [];
      const sameTournament = tournament?.name
        ? all.filter(r => r.tournament?.name === tournament.name)
        : all;
      setPastRooms(sameTournament);
    } catch { /* silently fail */ }
    setLoadingRooms(false);
  };

  const handleSwitchRoom = async (roomId) => {
    if (room?._id === roomId) return;
    setLoadingSwitch(roomId);
    try {
      const { data } = await getFullRoom(roomId);
      dispatch({ type: 'SET_FULL_DATA', payload: data.data });
    } catch { /* room may be deleted */ }
    setLoadingSwitch(null);
  };

  return (
    <CricBg>
      <div className="p-6 space-y-8 animate-fade-in">

        {/* Back to tournaments */}
        <button onClick={() => navigate('/tournaments')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors font-raj font-semibold">
          ← All Tournaments
        </button>

        {/* Tournament + Welcome banner */}
        <div className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden"
          style={{background:'linear-gradient(135deg,#dc2626 0%,#1e1b4b 50%,#1d4ed8 100%)'}}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20"
              style={{background:'radial-gradient(circle,white 0%,transparent 70%)'}}/>
            <div className="absolute top-4 right-4 text-5xl opacity-10">🏏</div>
          </div>
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {tournament?.logo && (
                <img src={tournament.logo} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 flex-shrink-0"/>
              )}
              <div>
                {tournament?.name && (
                  <div className="text-white/60 font-raj text-sm mb-0.5 tracking-widest uppercase">🏆 {tournament.name}</div>
                )}
                <h2 className="font-display text-3xl tracking-wide drop-shadow">
                  {room ? room.name : `Welcome, ${user?.name?.split(' ')[0]}! 🏏`}
                </h2>
                <p className="text-white/70 font-raj mt-1 text-sm">
                  {room
                    ? `Code: ${room.code}`
                    : 'No active room — create or join one to start'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {room && <ShareLiveLink roomCode={room.code} />}
              <button
                onClick={() => { dispatch({ type: 'RESET' }); navigate('/setup', { state: { tournament } }); }}
                className="bg-white/10 border border-white/30 font-raj font-bold px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all text-sm tracking-wide text-white">
                + New Auction
              </button>
            </div>
          </div>
        </div>

        {/* Active room stats */}
        {room && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['Players',   players.length,               'text-slate-800',  'glass-card'],
              ['Sold',      sold,                         'text-emerald-700','glass-card'],
              ['Unsold',    unsold,                       'text-red-600',    'glass-card-red'],
              ['Retained',  retained,                     'text-blue-700',   'glass-card'],
              ['Remaining', remain,                       'text-slate-600',  'glass-card'],
              ['Spent',     `${Math.round(totalSpent)} pts`,'text-red-700','glass-card-red'],
            ].map(([l,v,c,cls]) => (
              <div key={l} className={`${cls} rounded-2xl p-4 text-center`}>
                <div className={`font-orbitron text-xl font-bold ${c}`}>{v}</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest mt-1">{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h3 className="font-orbitron text-xs text-slate-500 tracking-widest uppercase mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <QuickCard icon="⚙️" accent="red"     title="Setup Room"   desc="Configure rules, teams and players"   action="Start Setup"   onClick={()=>navigate('/setup')}/>
            <QuickCard icon="🔴" accent="red"     title="Live Auction" desc="Enter the bidding floor"               action="Go Live"       onClick={()=>navigate('/auction')}/>
            <QuickCard icon="🛡" accent="blue"    title="Teams"        desc="Rosters, budgets and retained players" action="View Teams"    onClick={()=>navigate('/teams')}/>
            <QuickCard icon="👥" accent="emerald" title="Players"      desc="Browse and manage player registry"     action="View Players"  onClick={()=>navigate('/players')}/>
            <QuickCard icon="🔒" accent="cyan"    title="Retentions"   desc="Pre-auction player retentions"         action="Manage"        onClick={()=>navigate('/retentions')}/>
            <QuickCard icon="🎯" accent="violet"  title="Bid Rules"    desc="Set bonus points for price ranges"     action="Configure"     onClick={()=>navigate('/bid-rules')}/>
            <QuickCard icon="📊" accent="blue"    title="Results"      desc="Final results and team squads"         action="View Results"  onClick={()=>navigate('/results')}/>
          </div>
        </div>

        {/* Other auctions in this tournament */}
        {pastRooms.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-orbitron text-xs text-slate-500 tracking-widest uppercase">
                {tournament?.name ? `${tournament.name} — Auctions` : 'Auction History'}
              </h3>
              <button onClick={fetchPastRooms}
                className="text-xs font-raj font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                ↻ Refresh
              </button>
            </div>

            {loadingRooms ? (
              <div className="glass-card rounded-2xl p-6 text-center text-slate-400 text-sm">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pastRooms.map(r => {
                  const isActive  = room?._id === r._id;
                  const switching = loadingSwitch === r._id;
                  return (
                    <div key={r._id}
                      className={`glass-card rounded-2xl p-4 border-2 transition-all ${isActive ? 'border-red-400 shadow-md' : 'border-transparent hover:border-slate-300'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-base text-slate-800 truncate">{r.name}</div>
                          <div className="font-orbitron text-xs text-slate-400 mt-0.5">{r.code}</div>
                        </div>
                        {statusBadge(r.status)}
                      </div>
                      <div className="text-xs text-slate-400 font-raj mb-3">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                      </div>
                      <div className="flex gap-2">
                        {isActive ? (
                          <span className="flex-1 text-center text-xs font-bold text-red-600 py-1.5 bg-red-50 rounded-lg border border-red-200">
                            ● Current Auction
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSwitchRoom(r._id)}
                            disabled={switching}
                            className="flex-1 text-xs font-bold py-1.5 rounded-lg border transition-all hover:-translate-y-0.5 disabled:opacity-40"
                            style={{borderColor:'#1d4ed8', color:'#1d4ed8', background:'rgba(29,78,216,0.05)'}}>
                            {switching ? '⏳ Loading...' : '↩ Switch to this'}
                          </button>
                        )}
                        {r.status === 'completed' && (
                          <button
                            onClick={async () => { await handleSwitchRoom(r._id); navigate('/results'); }}
                            className="px-3 text-xs font-bold py-1.5 rounded-lg border"
                            style={{borderColor:'#059669', color:'#059669', background:'rgba(5,150,105,0.05)'}}>
                            📊
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent activity log */}
        {room && room.auctionLog?.length > 0 && (
          <div>
            <h3 className="font-orbitron text-xs text-slate-500 uppercase tracking-widest mb-4">Recent Activity</h3>
            <div className="glass-card rounded-2xl p-4 space-y-1 max-h-52 overflow-y-auto">
              {[...room.auctionLog].reverse().slice(0,15).map((e,i)=>(
                <div key={i} className={`flex items-start gap-3 text-sm py-1.5 border-b border-slate-100/60 last:border-0
                  ${e.type==='sold'?'text-emerald-600':e.type==='unsold'?'text-red-500':e.type==='retain'?'text-blue-600':'text-slate-500'}`}>
                  <span className="text-xs text-slate-400 font-orbitron flex-shrink-0 mt-0.5">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="font-raj">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CricBg>
  );
}