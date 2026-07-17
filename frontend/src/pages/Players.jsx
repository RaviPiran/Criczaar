import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuction } from '../context/AuctionContext';
import { useRehydrated } from '../App';
import { getPlayersByRoom, createPlayer, updatePlayer, deletePlayer } from '../utils/api';
import PlayerCard from '../components/PlayerCard';
import CricBg from '../components/CricBg';
import PlayerProfileCard from '../components/PlayerProfileCard';

const BATTING = ['Right-hand Bat','Left-hand Bat'];
const BOWLING = ['Right-arm Fast','Right-arm Medium','Right-arm Off-spin','Right-arm Leg-spin',
                 'Left-arm Fast','Left-arm Medium','Left-arm Orthodox','Left-arm Wrist-spin','N/A'];
const FILTERS = [
  { k:'all',       l:'All' },
  { k:'remaining', l:'⏳ Remaining' },
  { k:'sold',      l:'✅ Sold' },
  { k:'unsold',    l:'❌ Unsold' },
  { k:'retained',  l:'🔒 Retained' },
];
const emptyForm = { name:'', club:'', battingStyle:'Right-hand Bat', bowlingStyle:'N/A', basePrice:100, photo:'' };

function toBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

export default function Players() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuction();
  const { room, players } = state;
  const rehydrated = useRehydrated();
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null); // original player doc being edited, or null = adding new
  const photoRef = useRef();

  useEffect(() => {
    // Wait until RoomRehydrator has finished before deciding to redirect
    if (!rehydrated) return;
    if (!room) { navigate('/dashboard'); return; }
    // Always fetch fresh player data from server (handles post-logout refresh)
    fetchPlayers();
  }, [rehydrated, room?._id]);

  const fetchPlayers = async () => {
    if (!room?._id) return;
    setFetching(true);
    try {
      const { data } = await getPlayersByRoom(room._id);
      dispatch({ type: 'UPDATE_PLAYERS', payload: data.data });
    } catch {
      toast.error('Failed to load players');
    } finally {
      setFetching(false);
    }
  };

  const handlePhoto = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2*1024*1024) { toast.error('Photo < 2MB'); return; }
    const b64 = await toBase64(f);
    setForm(frm => ({ ...frm, photo: b64 }));
  };

  const handleEditClick = (player) => {
    setEditingPlayer(player);
    setForm({
      name: player.name, club: player.club || '',
      battingStyle: player.battingStyle || 'Right-hand Bat',
      bowlingStyle: player.bowlingStyle || 'N/A',
      basePrice: player.basePrice, photo: player.photo || '',
      role: player.role || 'Batsman',
    });
    setShowAdd(true);
    setPreviewPlayer(null);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingPlayer(null);
    setForm(emptyForm);
    if (photoRef.current) photoRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Enter player name');
    setLoading(true);
    try {
      if (editingPlayer) {
        const { data } = await updatePlayer(editingPlayer._id, { ...form });
        dispatch({ type:'UPDATE_PLAYERS', payload: players.map(p => p._id===data.data._id ? { ...p, ...data.data } : p) });
        toast.success('Player updated!');
      } else {
        const { data } = await createPlayer({ ...form, room:room._id, status:'remaining', auctionOrder:players.length });
        dispatch({ type:'UPDATE_PLAYERS', payload:[...players, data.data] });
        toast.success('Player added!');
      }
      closeForm();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete player?')) return;
    try { await deletePlayer(id); dispatch({ type:'UPDATE_PLAYERS', payload:players.filter(p=>p._id!==id) }); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const counts = {
    all:players.length,
    remaining:players.filter(p=>p.status==='remaining').length,
    sold:players.filter(p=>p.status==='sold').length,
    unsold:players.filter(p=>p.status==='unsold').length,
    retained:players.filter(p=>p.status==='retained').length,
  };

  const filtered = players.filter(p => {
    const q = search.toLowerCase();
    if (search && !p.name?.toLowerCase().includes(q) && !p.club?.toLowerCase().includes(q)) return false;
    return filter === 'all' || p.status === filter;
  });

  return (
    <CricBg><div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-3xl text-slate-900 tracking-wide">👥 Players</h2>
          <p className="text-slate-400 text-sm mt-1">{players.length} players registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            title="Download Player Logbook (landscape A4, 16 cards/page)"
            onClick={async () => {
              try {
                const token   = localStorage.getItem('ca_token');
                const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
                  .replace(/\/api\/?$/, '');          // strip trailing /api if present
                const res = await fetch(`${apiBase}/api/rooms/${room?._id}/players-pdf`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('PDF generation failed');
                const blob = await res.blob();
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `${room?.name || 'players'}_logbook.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                toast.error('Failed to download logbook');
              }
            }}
            className="px-4 py-2.5 text-sm font-raj font-bold rounded-xl border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all flex items-center gap-1.5">
            📄 Download Logbook
          </button>
          <button className="btn-primary px-5 py-2.5 text-sm" onClick={() => showAdd ? closeForm() : setShowAdd(true)}>
            {showAdd ? '✕ Close Form' : '+ Add Player'}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`px-4 py-1.5 rounded-full text-sm font-raj font-semibold transition-all border`}
            style={filter===f.k
              ? {background:'linear-gradient(135deg,var(--primary-600),var(--secondary-700))', color:'white', border:'none', boxShadow:'0 4px 12px rgba(220,38,38,0.25)'}
              : {background:'white', color:'#64748b', borderColor:'#e2e8f0'}}>
            {f.l} <span className="ml-1 font-orbitron text-xs opacity-70">{counts[f.k]}</span>
          </button>
        ))}
      </div>

      {/* ADD FORM + PREVIEW */}
      {showAdd && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
          <div className="bg-white rounded-2xl p-6 space-y-5 shadow-md border-2"
            style={{borderColor:'rgba(220,38,38,0.35)'}}>
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'var(--primary-600)'}}>{editingPlayer ? `Edit ${editingPlayer.name}` : 'Player Details'}</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Player Name *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
                  placeholder="Full name (e.g. Virat Kohli)"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Club / IPL Team</label>
                  <input className="input" value={form.club}
                    onChange={e => setForm(f => ({ ...f, club:e.target.value }))}
                    placeholder="e.g. Mumbai Indians"/>
                </div>
                <div>
                  <label className="label">Base Price (Pts)</label>
                  <input className="input" type="number" step="100" min="100"
                    value={form.basePrice}
                    onChange={e => setForm(f => ({ ...f, basePrice:+e.target.value }))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Batting Style</label>
                  <select className="input" value={form.battingStyle}
                    onChange={e => setForm(f => ({ ...f, battingStyle:e.target.value }))}>
                    {BATTING.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Bowling Style</label>
                  <select className="input" value={form.bowlingStyle}
                    onChange={e => setForm(f => ({ ...f, bowlingStyle:e.target.value }))}>
                    {BOWLING.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Batsman','Bowler','All-Rounder','Wicket-Keeper'].map(r => (
                    <button key={r} type="button"
                      onClick={() => setForm(f => ({ ...f, role:r }))}
                      className="py-2 rounded-xl text-xs font-bold border transition-all"
                      style={(form.role||'Batsman')===r
                        ? {background:'linear-gradient(135deg,var(--primary-600),var(--secondary-700))', color:'white', borderColor:'transparent'}
                        : {background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0'}}>
                      {r === 'Wicket-Keeper' ? 'WK' : r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Player Photo</label>
                <div onClick={() => photoRef.current.click()}
                  className="border-2 border-dashed border-slate-300 rounded-2xl min-h-[140px]
                    flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-slate-50 relative"
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary-600)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='#cbd5e1'}>
                  {form.photo ? (
                    <img src={form.photo} alt="preview" className="w-full h-full object-cover" style={{maxHeight:140}}/>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400 p-6">
                      <span className="text-4xl">📷</span>
                      <span className="text-sm font-semibold">Click to upload player photo</span>
                      <span className="text-xs opacity-70">JPG, PNG — max 2MB</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" ref={photoRef} className="hidden" onChange={handlePhoto}/>
                {form.photo && (
                  <button onClick={() => setForm(f => ({ ...f, photo:'' }))}
                    className="text-xs text-red-400 hover:text-red-600 mt-1 font-semibold">✕ Remove photo</button>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn-primary flex-1 py-3 text-base" onClick={handleSave} disabled={loading}>
                {loading ? '⏳ Saving...' : editingPlayer ? '💾 Save Changes' : '+ Add Player'}
              </button>
              <button className="btn-ghost px-5 py-3" onClick={closeForm}>Cancel</button>
            </div>
          </div>

          {/* PROFILE CARD PREVIEW */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{background:'var(--primary-600)'}}/>
              <span className="font-orbitron text-xs tracking-widest uppercase" style={{color:'var(--primary-600)'}}>
                Live Profile Card Preview
              </span>
            </div>
            {form.name ? (
              <PlayerProfileCard player={{ ...form, role: form.role || 'Batsman' }} size="large"/>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-300 bg-white min-h-[400px] text-slate-400">
                <div className="text-5xl opacity-30">🏏</div>
                <div className="text-sm text-center">
                  <div className="font-semibold">Start typing to see</div>
                  <div className="text-xs opacity-70 mt-1">the player profile card</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <input className="input max-w-md bg-white" value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Search by name or club..."/>

      {/* Player grid */}
      {fetching ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="text-5xl mb-4 animate-swing inline-block" style={{transformOrigin:'bottom center'}}>🏏</div>
          <p className="font-orbitron text-amber-500 text-sm tracking-widest animate-pulse">Loading players...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="text-5xl mb-4 opacity-30">👥</div>
          <p>No players found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(p => (
            <div key={p._id} className="relative group">
              <div onClick={() => setPreviewPlayer(p)} className="cursor-pointer">
                <PlayerCard player={p}/>
              </div>
              <button onClick={() => handleEditClick(p)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                  text-white rounded-lg px-2 py-1 text-xs font-bold shadow-md" style={{background:'var(--secondary-600)'}}>
                ✏️
              </button>
              {p.status === 'remaining' && (
                <button onClick={() => handleDelete(p._id)}
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity
                    bg-red-600 text-white rounded-lg px-2 py-1 text-xs font-bold shadow-md">
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewPlayer && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewPlayer(null)}>
          <div className="w-full max-w-lg animate-pop" onClick={e => e.stopPropagation()}>
            <PlayerProfileCard player={previewPlayer} size="large"/>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleEditClick(previewPlayer)}
                className="flex-1 py-3 bg-white rounded-2xl font-raj font-bold text-sm border border-slate-200 hover:border-slate-400 transition-all"
                style={{color:'var(--secondary-700)'}}>
                ✏️ Edit Player
              </button>
              <button onClick={() => setPreviewPlayer(null)}
                className="flex-1 py-3 bg-white rounded-2xl text-slate-600 font-raj font-bold
                  text-sm border border-slate-200 hover:border-slate-400 transition-all">
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CricBg>
  );
}