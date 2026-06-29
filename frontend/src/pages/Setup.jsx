import CricBg from '../components/CricBg';
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createRoom, createTeam, createPlayer, updateRoomStatus, retainPlayerAPI } from '../utils/api';
import { useAuction } from '../context/AuctionContext';

const COLORS  = ['#ef4444','#3b82f6','#10b981','#f59e0b','#06b6d4','#f97316','#a855f7','#f43f5e','#14b8a6','#eab308'];
const BATTING = ['Right-hand Bat','Left-hand Bat'];
const BOWLING = ['Right-arm Fast','Right-arm Medium','Right-arm Off-spin','Right-arm Leg-spin',
                 'Left-arm Fast','Left-arm Medium','Left-arm Orthodox','Left-arm Wrist-spin','N/A'];
const STEPS   = ['Room','Teams','Players','Retentions','Review'];

const STEP_ICONS = ['⚙️','🛡','👥','🔒','🚀'];

function toBase64(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

/* ── shared input class ── */
const IC = 'input bg-white';

export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useAuction();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode]       = useState('create');

  // Pre-fill tournament info if coming from Tournaments page
  const navTournament = location.state?.tournament || { name: '', logo: '' };

  const [roomName, setRoomName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [rules, setRules] = useState({
    basePrice:100, bidIncrement:10, timerSeconds:30, rtmCards:2, maxPlayers:11,
    bidBonusRules:[
      {minBid:100,  maxBid:250,  bonusPoints:10, bidIncrement:10, label:'Silver'},
      {minBid:250,  maxBid:500,  bonusPoints:25, bidIncrement:25, label:'Gold'},
      {minBid:500,  maxBid:1000, bonusPoints:50, bidIncrement:50, label:'Platinum'},
    ],
  });

  const [teams,      setTeams]      = useState([]);
  const [players,    setPlayers]    = useState([]);
  const [retentions, setRetentions] = useState([]);
  const [teamForm,   setTeamForm]   = useState({name:'',budget:5000,slots:15,logo:''});
  const [playerForm, setPlayerForm] = useState({name:'',club:'',battingStyle:'Right-hand Bat',bowlingStyle:'N/A',basePrice:100,photo:''});
  const [retainForm, setRetainForm] = useState({teamIdx:'',playerIdx:'',price:500});
  const teamLogoRef    = useRef();
  const playerPhotoRef = useRef();

  const addTeam = () => {
    if(!teamForm.name.trim()) return toast.error('Enter team name');
    if(teams.length>=10) return toast.error('Max 10 teams');
    setTeams(t=>[...t,{...teamForm,color:COLORS[t.length%COLORS.length],id:Date.now()}]);
    setTeamForm({name:'',budget:5000,slots:15,logo:''});
    if(teamLogoRef.current) teamLogoRef.current.value='';
  };

  const addPlayer = () => {
    if(!playerForm.name.trim()) return toast.error('Enter name');
    setPlayers(p=>[...p,{...playerForm,id:Date.now()}]);
    setPlayerForm({name:'',club:'',battingStyle:'Right-hand Bat',bowlingStyle:'N/A',basePrice:100,photo:''});
    if(playerPhotoRef.current) playerPhotoRef.current.value='';
  };

  const addRetention = () => {
    if(retainForm.teamIdx===''||retainForm.playerIdx==='') return toast.error('Select team and player');
    if(retentions.find(r=>r.playerIdx===retainForm.playerIdx)) return toast.error('Already retained');
    setRetentions(r=>[...r,{...retainForm}]);
    setRetainForm({teamIdx:'',playerIdx:'',price:500});
  };

  const startAuction = async () => {
    if(!roomName.trim()) return toast.error('Enter room name');
    if(teams.length<2)   return toast.error('Add at least 2 teams');
    if(players.length<1) return toast.error('Add at least 1 player');
    setLoading(true);
    try {
      // Clear any previous room from state before creating a new one
      dispatch({ type: 'RESET' });

      const{data:roomRes}=await createRoom({name:roomName,rules,tournament:navTournament,scheduledAt:scheduledAt||null});
      const room=roomRes.data;
      const createdTeams=await Promise.all(teams.map(t=>
        createTeam({name:t.name,color:t.color,logo:t.logo,budget:t.budget,budgetLeft:t.budget,slots:t.slots,room:room._id,players:[],retainedPlayers:[]})
          .then(r=>({...r.data.data,localId:t.id}))));
      const createdPlayers=await Promise.all(players.map((p,i)=>
        createPlayer({...p,room:room._id,status:'remaining',auctionOrder:i})
          .then(r=>({...r.data.data,localId:p.id}))));

      // Apply retentions — report failures but don't block auction creation
      const retainErrors = [];
      for(const ret of retentions){
        const team=createdTeams[parseInt(ret.teamIdx)];
        const player=createdPlayers[parseInt(ret.playerIdx)];
        if(team&&player){
          try {
            await retainPlayerAPI(room._id,{teamId:team._id,playerId:player._id,retainPrice:parseFloat(ret.price)});
          } catch(e) {
            retainErrors.push(`${player.name}: ${e.response?.data?.message||'failed'}`);
          }
        }
      }
      if(retainErrors.length>0){
        toast.error(`Some retentions failed:\n${retainErrors.join('\n')}`,{duration:6000});
      }
      await updateRoomStatus(room._id,'active');

      // Load the full freshly-created room so teams + players are all in state
      const { getFullRoom } = await import('../utils/api');
      const { data: fullData } = await getFullRoom(room._id);
      dispatch({ type: 'SET_FULL_DATA', payload: fullData.data });

      toast.success(`Room "${room.name}" created! 🚀`);
      navigate('/auction');
    }catch(err){toast.error(err.response?.data?.message||'Failed');}
    setLoading(false);
  };

  const joinRoom = async () => {
    if(!joinCode.trim()) return toast.error('Enter room code');
    setLoading(true);
    try {
      // BUG FIX: getRoomByCode only returns room — no teams/players.
      // Use getRoomByCode to get _id, then getFullRoom for everything.
      const { getRoomByCode, getFullRoom } = await import('../utils/api');
      const { data: codeRes } = await getRoomByCode(joinCode.toUpperCase());
      const roomId = codeRes.data._id;
      const { data: fullRes } = await getFullRoom(roomId);
      dispatch({ type: 'SET_FULL_DATA', payload: fullRes.data });
      navigate('/auction');
    } catch(err) {
      toast.error(err?.response?.data?.message || 'Room not found');
    }
    setLoading(false);
  };

  /* ── active card style ── */
  const cardStyle = {
    background:'rgba(255,255,255,0.82)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1.5px solid rgba(220,38,38,0.22)', borderRadius:20, padding:24,
  };

  return (
    <CricBg><div className="p-6 max-w-4xl animate-fade-in">
      <div className="mb-6">
        <h2 className="font-display text-3xl text-slate-900 tracking-wide">⚙️ Setup Auction</h2>
        <p className="text-slate-400 text-sm mt-1">Create a new room or join an existing one</p>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 w-fit mb-8 gap-1 shadow-sm">
        {['create','join'].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            className="px-6 py-2 rounded-xl font-raj font-bold text-sm tracking-widest uppercase transition-all"
            style={mode===m
              ? {background:'linear-gradient(135deg,#dc2626,#1d4ed8)', color:'white', boxShadow:'0 4px 12px rgba(220,38,38,0.3)'}
              : {color:'#94a3b8'}}>
            {m==='create'?'🏟 Create':'🔗 Join'}
          </button>
        ))}
      </div>

      {/* ═══ JOIN MODE ═══ */}
      {mode==='join' ? (
        <div className="glass-card rounded-2xl p-8 max-w-md space-y-4">
          <h3 className="font-display text-xl text-slate-900 tracking-wide">Join Existing Room</h3>
          <div>
            <label className="label">Room Code</label>
            <input className={IC} value={joinCode}
              onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. IPL2025" maxLength={8}/>
          </div>
          <button className="w-full py-3 rounded-xl text-white font-display tracking-widest font-bold transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{background:'linear-gradient(135deg,#dc2626,#1d4ed8)'}}
            onClick={joinRoom} disabled={loading}>
            {loading?'⏳ Joining...':'🔗 Join Room'}
          </button>
        </div>
      ) : (

      /* ═══ CREATE MODE ═══ */
      <div className="space-y-6">

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s,i)=>(
            <React.Fragment key={i}>
              <button onClick={()=>setStep(i)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap text-sm font-raj font-bold border"
                style={step===i
                  ? {background:'linear-gradient(135deg,#dc2626,#1d4ed8)', color:'white', border:'none', boxShadow:'0 4px 12px rgba(220,38,38,0.25)'}
                  : i<step
                  ? {background:'rgba(5,150,105,0.08)', color:'#059669', borderColor:'rgba(5,150,105,0.3)'}
                  : {background:'white', color:'#94a3b8', borderColor:'#e2e8f0'}}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={step===i
                    ? {background:'rgba(255,255,255,0.25)', color:'white'}
                    : i<step
                    ? {background:'#059669', color:'white'}
                    : {background:'#e2e8f0', color:'#94a3b8'}}>
                  {i<step ? '✓' : i+1}
                </span>
                <span>{STEP_ICONS[i]} {s}</span>
              </button>
              {i<STEPS.length-1 && <div className="w-4 h-px bg-slate-200 flex-shrink-0"/>}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 0: Room ── */}
        {step===0 && (
          <div style={cardStyle} className="space-y-6 animate-fade-in">
            {/* Tournament banner if coming from Tournaments page */}
            {navTournament.name && (
              <div className="flex items-center gap-3 p-3 rounded-2xl border border-blue-200 bg-blue-50">
                {navTournament.logo && <img src={navTournament.logo} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0"/>}
                <div>
                  <div className="text-xs text-blue-400 font-orbitron uppercase tracking-widest">Tournament</div>
                  <div className="font-display text-lg text-blue-800">{navTournament.name}</div>
                </div>
              </div>
            )}
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>Room Configuration</h3>
            <div>
              <label className="label">Auction Room Name *</label>
              <input className={IC} value={roomName}
                onChange={e=>setRoomName(e.target.value)}
                placeholder="e.g. IPL Mega Auction 2025"/>
            </div>
            <div>
              <label className="label">Scheduled Start (optional)</label>
              <input className={IC} type="datetime-local" value={scheduledAt}
                onChange={e=>setScheduledAt(e.target.value)}/>
              <p className="text-xs text-white/30 mt-1 font-raj">Leave blank to start whenever you're ready.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['Base Price (Pts)','basePrice',0.1,0.1],['Bid Increment (Pts)','bidIncrement',0.1,0.1],
                ['Timer (seconds)','timerSeconds',1,10],['RTM Cards','rtmCards',1,0]].map(([l,k,s,m])=>(
                <div key={k}>
                  <label className="label">{l}</label>
                  <input className={IC} type="number" step={s} min={m} value={rules[k]}
                    onChange={e=>setRules(r=>({...r,[k]:+e.target.value}))}/>
                </div>
              ))}
            </div>

            {/* Bonus tiers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#1d4ed8'}}>Bid Bonus Tiers</span>
                <button className="btn-blue px-3 py-1 text-xs"
                  onClick={()=>setRules(r=>({...r,bidBonusRules:[...r.bidBonusRules,{minBid:0,maxBid:0,bonusPoints:0,bidIncrement:10,label:'New'}]}))}>
                  + Add
                </button>
              </div>
              {rules.bidBonusRules.map((rule,i)=>(
                <div key={i} className="flex gap-2 items-end rounded-xl p-3 border"
                  style={{background:'rgba(29,78,216,0.04)', borderColor:'rgba(29,78,216,0.2)'}}>
                  <div className="flex-1">
                    <label className="label">Label</label>
                    <input className={IC+' text-sm py-1.5'} value={rule.label}
                      onChange={e=>{const a=[...rules.bidBonusRules];a[i]={...a[i],label:e.target.value};setRules(r=>({...r,bidBonusRules:a}))}}/>
                  </div>
                  <div className="w-20">
                    <label className="label">Min</label>
                    <input className={IC+' text-sm py-1.5'} type="number" value={rule.minBid}
                      onChange={e=>{const a=[...rules.bidBonusRules];a[i]={...a[i],minBid:+e.target.value};setRules(r=>({...r,bidBonusRules:a}))}}/>
                  </div>
                  <div className="w-20">
                    <label className="label">Max</label>
                    <input className={IC+' text-sm py-1.5'} type="number"
                      value={rule.maxBid===9999?9999:rule.maxBid}
                      onChange={e=>{const a=[...rules.bidBonusRules];a[i]={...a[i],maxBid:+e.target.value};setRules(r=>({...r,bidBonusRules:a}))}}/>
                  </div>
                  <div className="w-20">
                    <label className="label">Pts</label>
                    <input className={IC+' text-sm py-1.5'} type="number" value={rule.bonusPoints}
                      onChange={e=>{const a=[...rules.bidBonusRules];a[i]={...a[i],bonusPoints:+e.target.value};setRules(r=>({...r,bidBonusRules:a}))}}/>
                  </div>
                  <div className="w-20">
                    <label className="label">Bid Inc</label>
                    <input className={IC+' text-sm py-1.5'} type="number" value={rule.bidIncrement??''}
                      placeholder="default"
                      onChange={e=>{const a=[...rules.bidBonusRules];a[i]={...a[i],bidIncrement:e.target.value===''?null:+e.target.value};setRules(r=>({...r,bidBonusRules:a}))}}/>
                  </div>
                  <button onClick={()=>setRules(r=>({...r,bidBonusRules:r.bidBonusRules.filter((_,idx)=>idx!==i)}))}
                    className="text-red-400 hover:text-red-600 pb-2 text-lg transition-colors">✕</button>
                </div>
              ))}
            </div>
            <button className="btn-primary px-8 py-2.5" onClick={()=>setStep(1)}>Next: Add Teams →</button>
          </div>
        )}

        {/* ── Step 1: Teams ── */}
        {step===1 && (
          <div style={cardStyle} className="space-y-4 animate-fade-in">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>
              Teams <span className="text-slate-400">({teams.length}/10)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label">Team Name</label>
                <input className={IC} value={teamForm.name}
                  onChange={e=>setTeamForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Mumbai Indians"
                  onKeyDown={e=>e.key==='Enter'&&addTeam()}/>
              </div>
              <div>
                <label className="label">Budget (Pts)</label>
                <input className={IC} type="number" value={teamForm.budget} min="10"
                  onChange={e=>setTeamForm(f=>({...f,budget:+e.target.value}))}/>
              </div>
              <div>
                <label className="label">Slots</label>
                <input className={IC} type="number" value={teamForm.slots} min="3" max="25"
                  onChange={e=>setTeamForm(f=>({...f,slots:+e.target.value}))}/>
              </div>
              <div>
                <label className="label">Logo</label>
                <div onClick={()=>teamLogoRef.current.click()}
                  className={IC+' flex items-center gap-2 cursor-pointer min-h-[42px]'}>
                  {teamForm.logo
                    ? <img src={teamForm.logo} alt="l" className="h-6 w-6 rounded-full object-cover"/>
                    : <span className="text-slate-400 text-sm">📁 Upload</span>}
                </div>
                <input type="file" accept="image/*" ref={teamLogoRef} className="hidden"
                  onChange={async e=>{
                    const f=e.target.files[0]; if(!f) return;
                    if(f.size>2*1024*1024){toast.error('Logo < 2MB');return;}
                    setTeamForm(frm=>({...frm,logo:''}));
                    const b=await toBase64(f); setTeamForm(frm=>({...frm,logo:b}));
                  }}/>
              </div>
            </div>
            <button className="btn-primary px-5 py-2" onClick={addTeam}>+ Add Team</button>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {teams.map(t=>(
                <div key={t.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 flex-shrink-0" style={{borderColor:t.color}}>
                    {t.logo
                      ? <img src={t.logo} alt={t.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center font-display text-sm text-white" style={{background:t.color}}>{t.name[0]}</div>}
                  </div>
                  <span className="font-bold text-sm flex-1" style={{color:t.color}}>{t.name}</span>
                  <span className="text-xs text-slate-400">{t.budget}Pts · {t.slots} slots</span>
                  <button onClick={()=>setTeams(ts=>ts.filter(x=>x.id!==t.id))}
                    className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                </div>
              ))}
              {teams.length===0 && (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-300 rounded-xl text-sm bg-slate-50">
                  No teams yet — add at least 2
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost px-5 py-2" onClick={()=>setStep(0)}>← Back</button>
              <button className="btn-primary px-8 py-2" onClick={()=>setStep(2)} disabled={teams.length<2}>
                Next: Players →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Players ── */}
        {step===2 && (
          <div style={cardStyle} className="space-y-4 animate-fade-in">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>
              Players <span className="text-slate-400">({players.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Name *</label>
                <input className={IC} value={playerForm.name}
                  onChange={e=>setPlayerForm(f=>({...f,name:e.target.value}))}
                  placeholder="Full name"/>
              </div>
              <div>
                <label className="label">Club</label>
                <input className={IC} value={playerForm.club}
                  onChange={e=>setPlayerForm(f=>({...f,club:e.target.value}))}
                  placeholder="e.g. Mumbai Indians"/>
              </div>
              <div>
                <label className="label">Base Price (Cr)</label>
                <input className={IC} type="number" step="100" min="100"
                  value={playerForm.basePrice}
                  onChange={e=>setPlayerForm(f=>({...f,basePrice:+e.target.value}))}/>
              </div>
              <div>
                <label className="label">Batting Style</label>
                <select className={IC} value={playerForm.battingStyle}
                  onChange={e=>setPlayerForm(f=>({...f,battingStyle:e.target.value}))}>
                  {BATTING.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bowling Style</label>
                <select className={IC} value={playerForm.bowlingStyle}
                  onChange={e=>setPlayerForm(f=>({...f,bowlingStyle:e.target.value}))}>
                  {BOWLING.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Photo</label>
                <div onClick={()=>playerPhotoRef.current.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl min-h-[90px]
                    flex items-center justify-center cursor-pointer transition-colors bg-slate-50 overflow-hidden"
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#dc2626'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='#cbd5e1'}>
                  {playerForm.photo
                    ? <img src={playerForm.photo} alt="prev" className="max-h-20 object-contain rounded-lg"/>
                    : <div className="flex flex-col items-center gap-1 text-slate-400">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">Click to upload</span>
                      </div>}
                </div>
                <input type="file" accept="image/*" ref={playerPhotoRef} className="hidden"
                  onChange={async e=>{
                    const f=e.target.files[0]; if(!f) return;
                    if(f.size>2*1024*1024){toast.error('Photo < 2MB');return;}
                    const b=await toBase64(f); setPlayerForm(frm=>({...frm,photo:b}));
                  }}/>
              </div>
            </div>
            <button className="btn-primary px-5 py-2" onClick={addPlayer}>+ Add Player</button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-52 overflow-y-auto">
              {players.map(p=>(
                <div key={p.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-slate-200">
                    {p.photo
                      ? <img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full bg-red-50 flex items-center justify-center text-xs font-bold text-red-500">{p.name[0]}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate text-slate-800">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.basePrice}Pts</div>
                  </div>
                  <button onClick={()=>setPlayers(ps=>ps.filter(x=>x.id!==p.id))}
                    className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 transition-colors">✕</button>
                </div>
              ))}
              {players.length===0 && (
                <div className="col-span-2 sm:col-span-3 text-center py-6 text-slate-400 border border-dashed border-slate-300 rounded-xl text-sm bg-slate-50">
                  No players yet — add at least 1
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost px-5 py-2" onClick={()=>setStep(1)}>← Back</button>
              <button className="btn-primary px-8 py-2" onClick={()=>setStep(3)} disabled={players.length<1}>
                Next: Retentions →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Retentions ── */}
        {step===3 && (
          <div style={cardStyle} className="space-y-4 animate-fade-in">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#1d4ed8'}}>
              Retentions <span className="text-slate-400">(optional)</span>
            </h3>
            <p className="text-xs text-slate-400">Retain players to teams before auction. Budget deducted automatically.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end rounded-xl p-4 border"
              style={{background:'rgba(29,78,216,0.04)', borderColor:'rgba(29,78,216,0.2)'}}>
              <div>
                <label className="label">Team</label>
                <select className={IC} value={retainForm.teamIdx}
                  onChange={e=>setRetainForm(f=>({...f,teamIdx:e.target.value}))}>
                  <option value="">-- Select Team --</option>
                  {teams.map((t,i)=><option key={i} value={i}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Player</label>
                <select className={IC} value={retainForm.playerIdx}
                  onChange={e=>setRetainForm(f=>({...f,playerIdx:e.target.value}))}>
                  <option value="">-- Select Player --</option>
                  {players.map((p,i)=>{
                    const taken=retentions.find(r=>r.playerIdx===String(i));
                    return <option key={i} value={i} disabled={!!taken}>{p.name}{taken?' (retained)':''}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="label">Price (Pts)</label>
                <div className="flex gap-2">
                  <input className={IC} type="number" step="0.5" min="0.5"
                    value={retainForm.price}
                    onChange={e=>setRetainForm(f=>({...f,price:+e.target.value}))}/>
                  <button className="btn-blue px-4 py-2 whitespace-nowrap" onClick={addRetention}>🔒</button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {retentions.length===0 && (
                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-300 rounded-xl text-sm bg-slate-50">
                  No retentions — skip for fresh auction
                </div>
              )}
              {retentions.map((r,i)=>(
                <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-2.5 border"
                  style={{background:'rgba(29,78,216,0.05)', borderColor:'rgba(29,78,216,0.2)'}}>
                  <span>🔒</span>
                  <div className="flex-1">
                    <strong className="text-sm text-slate-800">{players[r.playerIdx]?.name}</strong>
                    <span className="text-slate-400 text-xs"> → {teams[r.teamIdx]?.name}</span>
                  </div>
                  <span className="font-orbitron text-sm font-bold" style={{color:'#dc2626'}}>{r.price}Pts</span>
                  <button onClick={()=>setRetentions(rs=>rs.filter((_,idx)=>idx!==i))}
                    className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost px-5 py-2" onClick={()=>setStep(2)}>← Back</button>
              <button className="btn-primary px-8 py-2" onClick={()=>setStep(4)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step===4 && (
          <div style={cardStyle} className="space-y-6 animate-fade-in">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>
              Review & Launch
            </h3>

            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Room',       roomName||'—'],
                ['Scheduled',  scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Not scheduled'],
                ['Teams',      teams.length],
                ['Players',    players.length],
                ['Retained',   retentions.length],
                ['Base Price', `${rules.basePrice}Pts`],
                ['Bid Inc.',   `${rules.bidIncrement}Pts`],
                ['Timer',      `${rules.timerSeconds}s`],
                ['Bonus Tiers',rules.bidBonusRules.length],
              ].map(([l,v])=>(
                <div key={l} className="rounded-xl p-3 text-center border"
                  style={{background:'linear-gradient(135deg,rgba(220,38,38,0.04),rgba(29,78,216,0.04))', borderColor:'rgba(29,78,216,0.15)'}}>
                  <div className="font-orbitron text-base font-bold" style={{color:'#dc2626'}}>{v}</div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">{l}</div>
                </div>
              ))}
            </div>

            {/* Teams preview */}
            {teams.length>0 && (
              <div>
                <div className="font-orbitron text-xs text-slate-400 uppercase tracking-widest mb-2">Teams</div>
                <div className="flex flex-wrap gap-2">
                  {teams.map(t=>(
                    <div key={t.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                      <div className="w-5 h-5 rounded-full flex-shrink-0" style={{background:t.color}}/>
                      <span className="text-sm font-bold text-slate-700">{t.name}</span>
                      <span className="text-xs text-slate-400">{t.budget}Pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button className="btn-ghost px-5 py-2" onClick={()=>setStep(3)}>← Back</button>
              <button
                className="px-12 py-3 rounded-2xl text-white font-display tracking-widest text-xl
                  transition-all hover:-translate-y-1 hover:shadow-xl disabled:opacity-60 cursor-pointer border-none"
                style={{background:'linear-gradient(135deg,#dc2626 0%,#1d4ed8 100%)',
                  boxShadow:loading?'none':'0 8px 32px rgba(220,38,38,0.3)'}}
                onClick={startAuction} disabled={loading}>
                {loading ? '⏳ Creating...' : '🚀 LAUNCH AUCTION'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
    </CricBg>
  );
}