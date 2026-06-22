import React, { useEffect } from 'react';

export default function SoldBurst({ result, onClose }) {
  useEffect(()=>{
    if(!result) return;
    const t = setTimeout(onClose, 2800);
    if(!result.isUnsold) spawnConfetti();
    return ()=>clearTimeout(t);
  },[result,onClose]);
  if(!result) return null;

  return (
    <div className="fixed inset-0 z-[400] bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white border-4 border-amber-400 rounded-3xl p-10 text-center max-w-sm w-[90vw] animate-pop shadow-2xl shadow-amber-200/60">
        {result.playerPhoto && (
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-amber-400 shadow-lg shadow-amber-200 mx-auto mb-4">
            <img src={result.playerPhoto} alt={result.playerName} className="w-full h-full object-cover"/>
          </div>
        )}
        {!result.playerPhoto && (
          <div className="w-24 h-24 rounded-full border-3 border-amber-300 bg-amber-50 mx-auto mb-4 flex items-center justify-center font-display text-4xl text-amber-600">
            {result.playerName?.[0]}
          </div>
        )}
        <div className={`font-display text-7xl leading-none tracking-widest ${result.isUnsold?'text-red-500':'text-amber-500'}`}>
          {result.isUnsold?'UNSOLD':'SOLD!'}
        </div>
        <div className="font-display text-2xl text-gray-900 mt-2 tracking-wider">{result.playerName}</div>
        {!result.isUnsold && (
          <>
            <div className="flex items-center justify-center gap-2 mt-3">
              {result.teamLogo
                ? <img src={result.teamLogo} alt={result.teamName} className="w-8 h-8 rounded-full object-cover border border-gray-200"/>
                : <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:result.teamColor}}/>}
              <span className="font-bold text-lg" style={{color:result.teamColor}}>→ {result.teamName}</span>
            </div>
            <div className="font-orbitron text-3xl text-emerald-600 mt-2 font-bold">{Math.round(result.price || 0)} <span className="text-xl font-semibold opacity-80">pts</span></div>
            {result.bonusPoints>0 && (
              <div className="mt-3 px-4 py-2 bg-amber-50 border border-amber-300 rounded-xl font-orbitron text-amber-600 text-sm animate-fade-in">
                🎯 +{result.bonusPoints} BONUS POINTS!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function spawnConfetti() {
  const colors=['#f59e0b','#ef4444','#10b981','#3b82f6','#06b6d4','#8b5cf6'];
  for(let i=0;i<60;i++){
    const el=document.createElement('div');
    const size=Math.random()*10+5;
    el.style.cssText=`position:fixed;left:${Math.random()*100}vw;top:-20px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation:confettiFall ${Math.random()*1+1.5}s ease-in ${Math.random()*0.4}s forwards;z-index:500;pointer-events:none;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2600);
  }
}
