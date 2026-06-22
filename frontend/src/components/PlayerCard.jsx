import React from 'react';

const ROLE_BADGE = {
  'Batsman':       'badge-batsman',
  'Bowler':        'badge-bowler',
  'All-Rounder':   'badge-allrounder',
  'Wicket-Keeper': 'badge-keeper',
};

export default function PlayerCard({ player, onClick, compact=false }) {
  if (!player) return null;
  const isRetained = player.status==='retained' || player.isRetained;
  const isSold     = player.status==='sold';
  const isUnsold   = player.status==='unsold';

  return (
    <div onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer
        hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/80 group
        ${isRetained ? 'bg-cyan-50 border-cyan-300'
          : isSold    ? 'bg-gray-50 border-gray-200 opacity-80'
          : isUnsold  ? 'bg-red-50/40 border-red-200 opacity-60'
          : 'bg-white border-gray-200 hover:border-amber-400'}`}>

      {/* Status ribbon */}
      {isSold && !isRetained && (
        <div className="absolute top-3 -right-5 bg-emerald-500 text-white text-[10px] font-black tracking-widest px-7 py-0.5 rotate-45 z-10">SOLD</div>
      )}
      {isUnsold && (
        <div className="absolute top-3 -right-6 bg-red-500 text-white text-[10px] font-black tracking-widest px-8 py-0.5 rotate-45 z-10">UNSOLD</div>
      )}
      {isRetained && (
        <div className="absolute top-3 -right-6 bg-cyan-500 text-white text-[10px] font-black tracking-widest px-7 py-0.5 rotate-45 z-10">RETAINED</div>
      )}

      <div className={`flex flex-col items-center text-center ${compact?'p-3 gap-2':'p-4 gap-3'}`}>
        {/* Photo */}
        <div className={`rounded-full overflow-hidden border-2 flex-shrink-0
          ${compact ? 'w-14 h-14' : 'w-16 h-16'}
          ${isRetained ? 'border-cyan-400' : 'border-gray-200 group-hover:border-amber-400'}
          transition-colors duration-300`}>
          {player.photo
            ? <img src={player.photo} alt={player.name} className="w-full h-full object-cover"/>
            : <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center font-display text-2xl text-amber-600">
                {player.name?.[0]}
              </div>}
        </div>

        <div className="w-full">
          <div className={`font-bold text-gray-900 leading-tight ${compact?'text-sm':'text-base'}`}>{player.name}</div>
          {player.club && <div className="text-xs text-amber-600 mt-0.5">🏏 {player.club}</div>}
        </div>

        {player.role && <span className={ROLE_BADGE[player.role]||'badge-batsman'}>{player.role}</span>}

        {!compact && (
          <div className="flex flex-wrap gap-1 justify-center">
            {player.battingStyle && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">{player.battingStyle}</span>}
            {player.bowlingStyle && player.bowlingStyle!=='N/A' && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">{player.bowlingStyle}</span>}
          </div>
        )}

        <div className="text-xs text-gray-400">Base: <span className="font-orbitron text-amber-600 text-xs">{player.basePrice} pts</span></div>

        {(isSold||isRetained) && player.soldTo && (
          <div className="text-xs font-bold truncate max-w-full" style={{color:player.soldTo?.color||(isRetained?'#0891b2':'#059669')}}>
            {isRetained?'🔒':'→'} {player.soldTo?.name}{player.soldPrice?` @ ${Math.round(player.soldPrice)} pts`:''}
          </div>
        )}
      </div>
    </div>
  );
}
