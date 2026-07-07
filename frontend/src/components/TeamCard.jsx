import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadTeamCard } from '../utils/teamPoster';

export default function TeamCard({ team, basePrice = 100, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const spent       = team.budget - team.budgetLeft;
  const pct         = Math.round((spent/team.budget)*100);
  const playerCount = team.players?.length || 0;
  const slotsLeft   = team.slots - playerCount;
  const retainedCnt = team.players?.filter(p=>p.isRetained)?.length || 0;

  // Max pts for ONE player = budgetLeft minus basePrice reserved for each remaining slot
  const maxPtsPerPlayer = slotsLeft > 0
    ? Math.max(0, Math.floor(team.budgetLeft - (slotsLeft - 1) * basePrice))
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:-translate-y-1 transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/80 shadow-sm">
      <div className="h-1.5 w-full" style={{background:team.color}}/>
      <div className="p-5">
        {/* Header — click opens the full player popup */}
        <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={()=>onSelect?.(team)}>
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0" style={{borderColor:team.color}}>
            {team.logo
              ? <img src={team.logo} alt={team.name} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center font-display text-xl text-white" style={{background:team.color}}>{team.name[0]}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-lg text-gray-900 tracking-wide leading-tight truncate">{team.name}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={{background:`${team.color}18`,color:team.color,borderColor:`${team.color}40`}}>{playerCount} players</span>
              {retainedCnt>0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">🔒 {retainedCnt}</span>}
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${slotsLeft===0?'bg-red-50 text-red-600 border-red-200':'bg-gray-50 text-gray-500 border-gray-200'}`}>{slotsLeft} slots</span>
            </div>
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (downloading) return;
              setDownloading(true);
              try { await downloadTeamCard(team); toast.success('Card downloaded!'); }
              catch { toast.error('Could not generate card'); }
              setDownloading(false);
            }}
            title="Download team card"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-700 transition-colors"
          >
            {downloading ? '⏳' : '📥'}
          </button>
          <span className="text-gray-300 text-lg leading-none flex-shrink-0">›</span>
        </div>

        {/* Budget */}
        <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-raj">
          <span>Spent <strong style={{color:team.color}}>{Math.round(spent)} pts</strong></span>
          <span>Left <strong className="text-gray-700">{Math.round(team.budgetLeft)} pts</strong></span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:team.color}}/>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            [slotsLeft===0 ? '— full' : `${maxPtsPerPlayer}`, 'Max/Player'],
            [playerCount,'Players'],
            [retainedCnt,'Retained'],
            [`${pct}%`,'Used']
          ].map(([v,l])=>(
            <div key={l} className="bg-gray-50 border border-gray-100 rounded-xl p-2 text-center">
              <div className={`font-orbitron text-sm font-bold ${l==='Max/Player' ? 'text-blue-600' : 'text-amber-600'}`}>{v}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        {/* Toggle */}
        {playerCount>0 && (
          <button onClick={()=>setExpanded(e=>!e)}
            className="w-full text-xs text-gray-400 hover:text-amber-600 border border-gray-200 hover:border-amber-300 rounded-lg py-2 transition-all font-raj font-semibold bg-gray-50 hover:bg-amber-50">
            {expanded?'▲ Hide Players':`▼ Show ${playerCount} Players`}
          </button>
        )}

        {expanded && (
          <div className="mt-3 space-y-1 max-h-52 overflow-y-auto animate-fade-in">
            {(team.players||[]).map((entry,i)=>{
              const p = entry.player||entry;
              return (
                <div key={i} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg border-b border-gray-50 last:border-0 text-sm ${entry.isRetained?'bg-cyan-50/60':''}`}>
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                    {p.photo?<img src={p.photo} alt={p.name} className="w-full h-full object-cover"/>
                      :<div className="w-full h-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">{p.name?.[0]}</div>}
                  </div>
                  <span className="flex-1 text-gray-700 font-semibold truncate">{p.name}</span>
                  {entry.isRetained&&<span className="text-xs text-cyan-600">🔒</span>}
                  <span className="font-orbitron text-[11px] text-amber-600 flex-shrink-0">{Math.round(entry.soldPrice||p.soldPrice||0)} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}