import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../context/AuctionContext';
import { getUserRooms, getFullRoom } from '../utils/api';
import CricBg from '../components/CricBg';

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const statusBadge = (status) => {
  const map = {
    active:    { bg:'bg-emerald-100', text:'text-emerald-700', dot:'bg-emerald-500', label:'Active' },
    paused:    { bg:'bg-yellow-100',  text:'text-yellow-700',  dot:'bg-yellow-500',  label:'Paused' },
    completed: { bg:'bg-slate-100',   text:'text-slate-500',   dot:'bg-slate-400',   label:'Completed' },
    setup:     { bg:'bg-blue-100',    text:'text-blue-700',    dot:'bg-blue-400',    label:'Setup' },
  };
  const s = map[status] || map.setup;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status==='active'?'animate-pulse':''}`}/>
      {s.label}
    </span>
  );
};

export default function Tournaments() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { state, dispatch } = useAuction();

  const [rooms, setRooms]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [switching, setSwitching]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tName, setTName]           = useState('');
  const [tLogo, setTLogo]           = useState('');
  const logoRef = useRef();

  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const { data } = await getUserRooms();
      setRooms(data.data || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const grouped = rooms.reduce((acc, room) => {
    const tname = room.tournament?.name?.trim() || '— No Tournament —';
    if (!acc[tname]) acc[tname] = { logo: room.tournament?.logo || '', rooms: [] };
    acc[tname].rooms.push(room);
    return acc;
  }, {});

  // FIX: Enter Auction now routes based on room status.
  // Completed rooms → /results, all others → /dashboard (was always /dashboard before).
  // Also loads full data (teams + players) before navigating so old data is visible.
  const handleEnterRoom = async (room) => {
    const roomId = room._id || room;
    setSwitching(roomId);
    try {
      const { data } = await getFullRoom(roomId);
      dispatch({ type: 'SET_FULL_DATA', payload: data.data });
      setSwitching(null);
      const status = data.data?.room?.status;
      if (status === 'completed') {
        navigate('/results');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setSwitching(null);
      toast.error(err?.response?.data?.message || 'Failed to load auction');
    }
  };

  const handleCreateNew = () => {
    if (!tName.trim()) { setShowCreate(true); return; }
    dispatch({ type: 'RESET' });
    navigate('/setup', { state: { tournament: { name: tName.trim(), logo: tLogo } } });
  };

  return (
    <CricBg>
      <div className="min-h-screen" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)'}}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-blue-700 flex items-center justify-center">
              <span className="text-white font-display text-lg">C</span>
            </div>
            <div>
              <div className="font-display text-2xl text-white leading-none">CRIC<span className="text-red-500">ZAAR</span></div>
              <div className="text-xs text-white/40 font-raj tracking-widest">AUCTION PLATFORM</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
      <div className="text-sm text-white/60 font-raj hidden sm:block">👋 {user?.name}</div>
      {user?.role === 'admin' && (
        <button onClick={() => navigate('/admin')}
          className="text-xs font-raj font-semibold text-red-400 hover:text-red-300 transition-colors border border-red-400/30 px-3 py-1.5 rounded-lg hover:border-red-400/60">
          🛠 Admin Panel
        </button>
      )}
      <button onClick={logout}
        className="text-xs font-raj font-semibold text-white/40 hover:text-red-400 transition-colors border border-white/10 px-3 py-1.5 rounded-lg hover:border-red-400/40">
        Logout
      </button>
    </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">

          {/* Hero */}
          <div className="text-center space-y-3">
            <h1 className="font-display text-5xl text-white tracking-wide drop-shadow">
              My <span className="text-red-500">Tournaments</span>
            </h1>
            <p className="text-white/50 font-raj text-base">Create a tournament, run auctions, view history — all in one place.</p>
          </div>

          {/* Create Tournament Button */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowCreate(s => !s)}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-display tracking-widest text-white font-bold text-base shadow-lg hover:-translate-y-0.5 transition-all"
              style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)'}}>
              {showCreate ? '✕ Cancel' : '+ New Tournament'}
            </button>
          </div>

          {/* Create Tournament Form */}
          {showCreate && (
            <div className="max-w-md mx-auto rounded-3xl border border-white/10 p-8 space-y-5 animate-fade-in"
              style={{background:'rgba(255,255,255,0.04)', backdropFilter:'blur(12px)'}}>
              <h2 className="font-display text-2xl text-white tracking-wide text-center">🏆 Create Tournament</h2>
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => logoRef.current?.click()}
                  className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-red-400/60 transition-colors overflow-hidden"
                  style={{background:'rgba(255,255,255,0.04)'}}>
                  {tLogo
                    ? <img src={tLogo} alt="logo" className="w-full h-full object-cover"/>
                    : <div className="text-center"><div className="text-3xl">🏆</div><div className="text-[10px] text-white/30 mt-1">Upload Logo</div></div>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => { if (e.target.files[0]) setTLogo(await toBase64(e.target.files[0])); }}/>
                {tLogo && <button onClick={() => { setTLogo(''); if(logoRef.current) logoRef.current.value=''; }}
                  className="text-xs text-white/30 hover:text-red-400 transition-colors">Remove logo</button>}
              </div>
              <div>
                <label className="text-xs text-white/40 font-orbitron uppercase tracking-widest block mb-1.5">Tournament Name *</label>
                <input
                  value={tName} onChange={e => setTName(e.target.value)}
                  placeholder="e.g. IPL 2025, Office League..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-raj focus:outline-none focus:border-red-400/60 transition-colors placeholder:text-white/20"/>
              </div>
              <button
                onClick={handleCreateNew}
                disabled={!tName.trim()}
                className="w-full py-3 rounded-xl font-display tracking-widest text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                style={{background:'linear-gradient(135deg,#dc2626,#1d4ed8)'}}>
                🚀 Setup Auction →
              </button>
            </div>
          )}

          {/* Tournament Groups */}
          {loading ? (
            <div className="text-center text-white/40 font-raj py-16">Loading tournaments...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center text-white/30 font-raj py-16">
              <div className="text-5xl mb-4">🏏</div>
              <p>No tournaments yet. Create your first one above!</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([tname, { logo, rooms: tRooms }]) => (
                <div key={tname}>
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 flex items-center justify-center flex-shrink-0"
                      style={{background:'rgba(255,255,255,0.06)'}}>
                      {logo
                        ? <img src={logo} alt={tname} className="w-full h-full object-cover"/>
                        : <span className="text-2xl">🏆</span>}
                    </div>
                    <div>
                      <h2 className="font-display text-2xl text-white tracking-wide">{tname}</h2>
                      <p className="text-white/40 text-xs font-raj">{tRooms.length} auction{tRooms.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => {
                        dispatch({ type: 'RESET' });
                        navigate('/setup', { state: { tournament: { name: tname === '— No Tournament —' ? '' : tname, logo } } });
                      }}
                      className="ml-auto text-xs font-raj font-bold px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all">
                      + New Auction
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tRooms.map(room => {
                      const isCurrentlyLoaded = state.room?._id === room._id;
                      const isSwitching       = switching === room._id;
                      const isCompleted       = room.status === 'completed';
                      return (
                        <div key={room._id}
                          className="rounded-2xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                          style={{
                            background: isCurrentlyLoaded ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.03)',
                            borderColor: isCurrentlyLoaded ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(12px)',
                          }}>
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-display text-lg text-white truncate">{room.name}</div>
                                <div className="font-orbitron text-xs text-white/30 mt-0.5">{room.code}</div>
                              </div>
                              {statusBadge(room.status)}
                            </div>
                            <div className="text-xs text-white/30 font-raj mb-4">
                              {new Date(room.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                            </div>

                            {/* FIX: Completed rooms get "View Results" button.
                                Active/paused rooms get "Enter Auction".
                                Both load full data before navigating.
                                Previously completed rooms still showed "Enter Auction" → /dashboard with no data. */}
                            <div className="flex gap-2">
                              {isCurrentlyLoaded && !isCompleted ? (
                                <button
                                  onClick={() => navigate('/dashboard')}
                                  className="flex-1 text-xs font-bold py-2 rounded-xl border transition-all"
                                  style={{borderColor:'rgba(220,38,38,0.5)', color:'#ef4444', background:'rgba(220,38,38,0.08)'}}>
                                  ● Currently Active
                                </button>
                              ) : isCompleted ? (
                                <button
                                  onClick={() => handleEnterRoom(room)}
                                  disabled={isSwitching}
                                  className="flex-1 text-xs font-bold py-2 rounded-xl border transition-all hover:-translate-y-0.5 disabled:opacity-40"
                                  style={{borderColor:'rgba(5,150,105,0.4)', color:'#34d399', background:'rgba(5,150,105,0.08)'}}>
                                  {isSwitching ? '⏳ Loading…' : '📊 View Results'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEnterRoom(room)}
                                  disabled={isSwitching}
                                  className="flex-1 text-xs font-bold py-2 rounded-xl border transition-all hover:-translate-y-0.5 disabled:opacity-40"
                                  style={{borderColor:'rgba(29,78,216,0.4)', color:'#60a5fa', background:'rgba(29,78,216,0.08)'}}>
                                  {isSwitching ? '⏳ Loading…' : '→ Enter Auction'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CricBg>
  );
}