import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuction } from '../context/AuctionContext';
import { getTeamsByRoom, createTeam, updateTeam, deleteTeam } from '../utils/api';
import TeamCard from '../components/TeamCard';
import PlayerCard from '../components/PlayerCard';
import CricBg from '../components/CricBg';
import { downloadTeamCard } from '../utils/teamPoster';

const COLORS = ['var(--primary-500)','var(--secondary-500)','#10b981','#f59e0b','#06b6d4','#f97316','#a855f7','#f43f5e','#14b8a6','#eab308'];
function toBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}

// Shows this team's bidding link + code (only known to admin — teamCode is
// hidden from every public endpoint, only returned here via the protected
// GET /teams/room/:roomId call).
function TeamBidLink({ team, roomCode }) {
  const link = `${window.location.origin}/team/${roomCode}`;
  const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} copied!`); };
  if (!team.teamCode) return null;
  return (
    <div className="glass-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
      <div className="min-w-0">
        <div className="text-slate-400 uppercase tracking-widest text-[10px]">Bid Link · Code</div>
        <div className="truncate font-raj text-slate-700">{link}</div>
        <div className="font-display tracking-[0.2em] text-red-600">{team.teamCode}</div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button onClick={()=>copy(link,'Link')} className="btn-ghost px-3 py-1 text-[11px]">Copy Link</button>
        <button onClick={()=>copy(team.teamCode,'Code')} className="btn-ghost px-3 py-1 text-[11px]">Copy Code</button>
      </div>
    </div>
  );
}

// Popup shown when a team card is clicked — squad as full player cards.
function TeamDetailModal({ team, onClose }) {
  if (!team) return null;
  const spent = team.budget - team.budgetLeft;
  const pct   = Math.round((spent/team.budget)*100);
  const entries = team.players || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div className="glass-card rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e=>e.stopPropagation()}>
        <div className="h-1.5 w-full flex-shrink-0" style={{background:team.color}}/>
        <div className="p-5 flex items-center gap-4 border-b border-slate-200 flex-shrink-0">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 flex-shrink-0" style={{borderColor:team.color}}>
            {team.logo
              ? <img src={team.logo} alt={team.name} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center font-display text-2xl text-white" style={{background:team.color}}>{team.name[0]}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl text-slate-900 tracking-wide truncate">{team.name}</div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1 font-raj">
              <span>Spent <strong style={{color:team.color}}>{Math.round(spent)} pts</strong></span>
              <span>Left <strong className="text-slate-700">{Math.round(team.budgetLeft)} pts</strong></span>
              <span>{pct}% used</span>
              <span>{entries.length}/{team.slots} slots filled</span>
            </div>
          </div>
          <button
            onClick={()=>downloadTeamCard(team).then(()=>toast.success('Card downloaded!')).catch(()=>toast.error('Could not generate card'))}
            className="btn-ghost px-3 py-2 text-xs flex-shrink-0">📥 Download Card</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none flex-shrink-0 px-2">✕</button>
        </div>

        <div className="p-5 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="text-center text-slate-400 py-16">No players bought yet</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {entries.map((entry, i) => {
                const p = entry.player || entry;
                const flatPlayer = {
                  ...p,
                  status: entry.isRetained ? 'retained' : 'sold',
                  soldPrice: entry.soldPrice ?? p.soldPrice,
                  soldTo: { name: team.name, color: team.color },
                };
                return <PlayerCard key={p._id || i} player={flatPlayer} />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuction();
  const { room, teams } = state;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name:'', budget:5000, slots:11, logo:'' });
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null); // the original team doc being edited, or null = adding new
  const logoRef = useRef();

  useEffect(()=>{ if(!room){navigate('/dashboard');return;} fetchTeams(); },[]);
  const fetchTeams = async () => {
    try { const{data}=await getTeamsByRoom(room._id); dispatch({type:'UPDATE_TEAMS',payload:data.data}); }
    catch { toast.error('Failed to load teams'); }
  };
  const handleLogo = async (e) => {
    const f=e.target.files[0]; if(!f) return;
    if(f.size>2*1024*1024){toast.error('Logo < 2MB');return;}
    const b64 = await toBase64(f);
    setForm(frm=>({...frm,logo:b64}));
  };
  const handleEditClick = (team) => {
    setEditingTeam(team);
    setForm({ name: team.name, budget: team.budget, slots: team.slots, logo: team.logo || '' });
    setShowAdd(true);
  };
  const closeForm = () => {
    setShowAdd(false);
    setEditingTeam(null);
    setForm({ name:'', budget:5000, slots:11, logo:'' });
    if (logoRef.current) logoRef.current.value = '';
  };
  const handleSave = async () => {
    if(!form.name.trim()) return toast.error('Enter team name');
    setLoading(true);
    try {
      if (editingTeam) {
        // Keep "spent so far" consistent when the budget is changed —
        // shift budgetLeft by the same delta instead of overwriting it.
        const delta = form.budget - editingTeam.budget;
        const { data } = await updateTeam(editingTeam._id, {
          name: form.name, budget: form.budget, slots: form.slots, logo: form.logo,
          budgetLeft: Math.max(0, (editingTeam.budgetLeft ?? form.budget) + delta),
        });
        dispatch({ type:'UPDATE_TEAMS', payload: teams.map(t => t._id===data.data._id ? { ...t, ...data.data } : t) });
        toast.success('Team updated!');
      } else {
        const color=COLORS[teams.length%COLORS.length];
        const{data}=await createTeam({...form,color,budgetLeft:form.budget,room:room._id,players:[],retainedPlayers:[]});
        dispatch({type:'UPDATE_TEAMS',payload:[...teams,data.data]});
        toast.success('Team added!');
      }
      closeForm();
    } catch(err){toast.error(err.response?.data?.message||'Failed');}
    setLoading(false);
  };
  const handleDelete = async (id) => {
    if(!window.confirm('Delete this team?')) return;
    try { await deleteTeam(id); dispatch({type:'UPDATE_TEAMS',payload:teams.filter(t=>t._id!==id)}); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };
  const totalSpent   = teams.reduce((s,t)=>s+(t.budget-t.budgetLeft),0);
  const totalPlayers = teams.reduce((s,t)=>s+(t.players?.length||0),0);
  const totalRetained= teams.reduce((s,t)=>s+(t.retainedPlayers?.length||0),0);

  return (
    <CricBg>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-3xl text-slate-900 tracking-wide">🛡 Teams</h2>
            <p className="text-slate-500 text-sm mt-1">{teams.length} teams registered</p>
          </div>
          <button className="btn-primary px-5 py-2.5 text-sm" onClick={()=> showAdd ? closeForm() : setShowAdd(true)}>
            {showAdd ? '✕ Cancel' : '+ Add Team'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ['Teams',        teams.length,                                         'text-slate-800', 'glass-card'],
            ['Players',      totalPlayers,                                         'text-blue-700',  'glass-card'],
            ['Retained',     totalRetained,                                        'text-blue-600',  'glass-card'],
            ['Total Budget', `${teams.reduce((s,t)=>s+t.budget,0)} pts`,          'text-slate-700', 'glass-card'],
            ['Total Spent',  `${Math.round(totalSpent)} pts`,                     'text-red-600',   'glass-card-red'],
          ].map(([l,v,c,cls])=>(
            <div key={l} className={`${cls} rounded-2xl p-4 text-center`}>
              <div className={`font-orbitron text-lg font-bold ${c}`}>{v}</div>
              <div className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">{l}</div>
            </div>
          ))}
        </div>

        {showAdd && (
          <div className="glass-card-red rounded-2xl p-6 space-y-4 animate-slide-up">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'var(--primary-600)'}}>{editingTeam ? `Edit ${editingTeam.name}` : 'Add New Team'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div><label className="label">Team Name *</label>
                <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Mumbai Indians" onKeyDown={e=>e.key==='Enter'&&handleSave()}/></div>
              <div><label className="label">Budget (pts)</label>
                <input className="input" type="number" value={form.budget} min="100" onChange={e=>setForm(f=>({...f,budget:+e.target.value}))}/></div>
              <div><label className="label">Player Slots</label>
                <input className="input" type="number" value={form.slots} min="3" max="25" onChange={e=>setForm(f=>({...f,slots:+e.target.value}))}/></div>
              <div><label className="label">Team Logo</label>
                <div onClick={()=>logoRef.current.click()} className="input flex items-center gap-2 cursor-pointer min-h-[42px]">
                  {form.logo?<img src={form.logo} alt="logo" className="h-7 w-7 rounded-full object-cover"/>
                    :<span className="text-slate-400 text-sm">📁 Upload logo...</span>}
                </div>
                <input type="file" accept="image/*" ref={logoRef} className="hidden" onChange={handleLogo}/></div>
            </div>
            <div className="flex gap-3">
              <button className="btn-primary px-6 py-2.5" onClick={handleSave} disabled={loading}>
                {loading ? '⏳ Saving...' : editingTeam ? '💾 Save Changes' : '+ Add Team'}
              </button>
              <button className="btn-ghost px-6 py-2.5" onClick={closeForm}>Cancel</button>
            </div>
          </div>
        )}

        {teams.length===0 ? (
          <div className="glass-card text-center py-20 text-slate-400 rounded-2xl border border-dashed border-slate-300">
            <div className="text-5xl mb-4 opacity-40">🛡</div>
            <p>No teams yet. Add teams above or use the Setup wizard.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {teams.map(t=>(
              <div key={t._id} className="space-y-2">
                <TeamCard team={t} onSelect={setSelectedTeam}/>
                <TeamBidLink team={t} roomCode={room.code}/>
                <div className="flex gap-2">
                  <button onClick={()=>handleEditClick(t)}
                    className="flex-1 py-2 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl transition-all font-raj font-semibold glass-card">
                    ✏️ Edit
                  </button>
                  <button onClick={()=>handleDelete(t._id)}
                    className="flex-1 py-2 text-xs text-red-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-xl transition-all font-raj font-semibold glass-card hover:bg-red-50">
                    🗑 Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <TeamDetailModal team={selectedTeam} onClose={()=>setSelectedTeam(null)}/>
    </CricBg>
  );
}