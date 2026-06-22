import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuction } from '../context/AuctionContext';
import { getTeamsByRoom, createTeam, deleteTeam } from '../utils/api';
import TeamCard from '../components/TeamCard';
import CricBg from '../components/CricBg';

const COLORS = ['#ef4444','#3b82f6','#10b981','#f59e0b','#06b6d4','#f97316','#a855f7','#f43f5e','#14b8a6','#eab308'];
function toBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}

export default function Teams() {
  const navigate = useNavigate();
  const { state, dispatch } = useAuction();
  const { room, teams } = state;
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name:'', budget:5000, slots:11, logo:'' });
  const [loading, setLoading] = useState(false);
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
  const handleAdd = async () => {
    if(!form.name.trim()) return toast.error('Enter team name');
    setLoading(true);
    try {
      const color=COLORS[teams.length%COLORS.length];
      const{data}=await createTeam({...form,color,budgetLeft:form.budget,room:room._id,players:[],retainedPlayers:[]});
      dispatch({type:'UPDATE_TEAMS',payload:[...teams,data.data]});
      setForm({name:'',budget:5000,slots:11,logo:''}); if(logoRef.current)logoRef.current.value='';
      setShowAdd(false); toast.success('Team added!');
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
          <button className="btn-primary px-5 py-2.5 text-sm" onClick={()=>setShowAdd(s=>!s)}>
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
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>Add New Team</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div><label className="label">Team Name *</label>
                <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Mumbai Indians" onKeyDown={e=>e.key==='Enter'&&handleAdd()}/></div>
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
              <button className="btn-primary px-6 py-2.5" onClick={handleAdd} disabled={loading}>{loading?'⏳ Adding...':'+ Add Team'}</button>
              <button className="btn-ghost px-6 py-2.5" onClick={()=>setShowAdd(false)}>Cancel</button>
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
                <TeamCard team={t}/>
                <button onClick={()=>handleDelete(t._id)}
                  className="w-full py-2 text-xs text-red-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-xl transition-all font-raj font-semibold glass-card hover:bg-red-50">
                  🗑 Remove Team
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </CricBg>
  );
}
