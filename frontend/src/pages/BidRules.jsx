import React, { useState } from 'react';
import { useAuction } from '../context/AuctionContext';
import API from '../utils/api';
import toast from 'react-hot-toast';
import CricBg from '../components/CricBg';

export default function BidRules() {
  const { state, dispatch } = useAuction();
  const { room } = state;
  const [rules, setRules] = useState(room?.rules || {
    basePrice:100, bidIncrement:10, timerSeconds:30, rtmCards:2,
    bidBonusRules:[
      {minBid:100,  maxBid:250,   bonusPoints:10, label:'Silver'},
      {minBid:250, maxBid:500,   bonusPoints:25, label:'Gold'},
      {minBid:500, maxBid:1000, bonusPoints:50, label:'Platinum'},
    ],
  });
  const [saving, setSaving] = useState(false);
  const upd = (k,v)=>setRules(r=>({...r,[k]:v}));
  const updBonus=(i,k,v)=>setRules(r=>{const arr=[...r.bidBonusRules];arr[i]={...arr[i],[k]:k==='label'?v:parseFloat(v)||0};return{...r,bidBonusRules:arr};});
  const addBonus=()=>setRules(r=>({...r,bidBonusRules:[...r.bidBonusRules,{minBid:0,maxBid:0,bonusPoints:0,label:'New Range'}]}));
  const removeBonus=(i)=>setRules(r=>({...r,bidBonusRules:r.bidBonusRules.filter((_,idx)=>idx!==i)}));
  const save=async()=>{
    if(!room)return toast.error('No active room');setSaving(true);
    try{const{data}=await API.patch(`/rooms/${room._id}/rules`,{rules});dispatch({type:'SET_ROOM',payload:{...room,rules:data.data.rules}});toast.success('Rules saved!');}
    catch{toast.error('Failed');}setSaving(false);
  };

  return (
    <CricBg>
      <div className="p-6 max-w-3xl space-y-8 animate-fade-in">
        <div>
          <h2 className="font-display text-3xl text-slate-900 tracking-wide">🎯 Bid Rules</h2>
          <p className="text-slate-500 text-sm mt-1">Configure auction mechanics and bonus point tiers</p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5">
          <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#dc2626'}}>Core Auction Rules</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{k:'basePrice',l:'Base Price (Cr)',s:0.1,m:0.1},{k:'bidIncrement',l:'Bid Increment (Cr)',s:0.1,m:0.1},
              {k:'timerSeconds',l:'Timer (seconds)',s:1,m:10},{k:'rtmCards',l:'RTM Cards / Team',s:1,m:0}].map(({k,l,s,m})=>(
              <div key={k}><label className="label">{l}</label>
                <input className="input" type="number" step={s} min={m} value={rules[k]} onChange={e=>upd(k,parseFloat(e.target.value)||0)}/></div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-orbitron text-xs tracking-widest uppercase" style={{color:'#1d4ed8'}}>Bid Bonus Point Tiers</h3>
            <button className="btn-blue px-3 py-1.5 text-xs" onClick={addBonus}>+ Add Tier</button>
          </div>
          <p className="text-xs text-slate-400">Teams earn bonus points when a player sells within a price range.</p>
          <div className="space-y-3">
            {rules.bidBonusRules?.map((rule,i)=>(
              <div key={i} className="flex gap-3 items-end rounded-xl p-4 border"
                style={{background:'rgba(29,78,216,0.04)',borderColor:'rgba(29,78,216,0.2)'}}>
                <div className="w-1 self-stretch rounded-full flex-shrink-0"
                  style={{background:`linear-gradient(180deg,#dc2626,#1d4ed8)`}}/>
                <div className="flex-1"><label className="label">Label</label>
                  <input className="input" value={rule.label} onChange={e=>updBonus(i,'label',e.target.value)} placeholder="e.g. Gold Range"/></div>
                <div className="w-28"><label className="label">Min (Cr)</label>
                  <input className="input" type="number" step="0.5" value={rule.minBid} onChange={e=>updBonus(i,'minBid',e.target.value)}/></div>
                <div className="w-28"><label className="label">Max (Cr)</label>
                  <input className="input" type="number" step="0.5" value={rule.maxBid===9999?9999:rule.maxBid} onChange={e=>updBonus(i,'maxBid',e.target.value)}/></div>
                <div className="w-28"><label className="label">Bonus Pts</label>
                  <input className="input" type="number" value={rule.bonusPoints} onChange={e=>updBonus(i,'bonusPoints',e.target.value)}/></div>
                <button onClick={()=>removeBonus(i)} className="text-red-400 hover:text-red-600 text-xl pb-2.5 transition-colors">✕</button>
              </div>
            ))}
            {rules.bidBonusRules?.length===0&&(
              <div className="text-center py-8 text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/40">
                No bonus tiers. Click "+ Add Tier" to create one.
              </div>
            )}
          </div>
        </div>

        <button className="px-8 py-3 text-base rounded-xl text-white font-display tracking-widest font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40"
          style={{background:'linear-gradient(135deg,#dc2626,#1d4ed8)'}}
          onClick={save} disabled={saving||!room}>
          {saving?'⏳ Saving...':'💾 Save Rules'}
        </button>
        {!room&&<p className="text-xs text-slate-400">Create a room first to save rules.</p>}
      </div>
    </CricBg>
  );
}
