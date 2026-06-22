import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuction } from '../context/AuctionContext';

const PAGE_TITLES = {
  '/dashboard':  { title:'Dashboard',    icon:'🏠', sub:'Overview of your auction' },
  '/setup':      { title:'Setup Room',   icon:'⚙️',  sub:'Configure teams, players & rules' },
  '/auction':    { title:'Live Auction', icon:'🔴', sub:'Real-time bidding floor' },
  '/teams':      { title:'Teams',        icon:'🛡', sub:'Manage franchises & rosters' },
  '/players':    { title:'Players',      icon:'👥', sub:'Player registry & profiles' },
  '/retentions': { title:'Retentions',   icon:'🔒', sub:'Pre-auction player retentions' },
  '/bid-rules':  { title:'Bid Rules',    icon:'🎯', sub:'Points & bonus configuration' },
  '/results':    { title:'Results',      icon:'📊', sub:'Final auction summary' },
};

export default function TopBar({ onMenuClick }) {
  const location = useLocation();
  const { state } = useAuction();
  const { room, players } = state;
  const meta = PAGE_TITLES[location.pathname] || { title:'Cricket Auction', icon:'🏏', sub:'' };
  const sold   = players.filter(p=>p.status==='sold').length;
  const remain = players.filter(p=>p.status==='remaining').length;

  return (
    <header className="h-16 border-b border-white/70 flex items-center gap-4 px-4 sticky top-0 z-20" style={{background:"rgba(255,255,255,0.82)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",boxShadow:"0 2px 16px rgba(29,78,216,0.06)"}}>
      <button onClick={onMenuClick} className="lg:hidden text-slate-500 hover:text-red-600 text-xl p-1 transition-colors">☰</button>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
          style={{background:'linear-gradient(135deg,#dc2626 0%,#1d4ed8 100%)'}}>
          <span className="text-white text-sm">{meta.icon}</span>
        </div>
        <div>
          <h1 className="font-display text-lg leading-none tracking-wider text-slate-900">{meta.title}</h1>
          {meta.sub && <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{meta.sub}</p>}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {room && room.status !== 'setup' && (
          <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-raj">
            <span className="text-slate-500">Sold <strong className="text-emerald-600 font-orbitron">{sold}</strong></span>
            <span className="w-px h-3 bg-slate-300"/>
            <span className="text-slate-500">Left <strong className="text-blue-600 font-orbitron">{remain}</strong></span>
            {room.status==='paused' && (
              <><span className="w-px h-3 bg-slate-300"/>
              <span className="flex items-center gap-1.5 text-yellow-600"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"/>PAUSED</span></>
            )}
            {room.status==='active' && (
              <><span className="w-px h-3 bg-slate-300"/>
              <span className="flex items-center gap-1.5 text-red-600"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>LIVE</span></>
            )}
          </div>
        )}
        {room && (
          <div className="rounded-lg px-3 py-1.5 hidden md:block border"
            style={{background:'linear-gradient(135deg,rgba(220,38,38,0.08) 0%,rgba(29,78,216,0.08) 100%)',borderColor:'rgba(220,38,38,0.25)'}}>
            <span className="text-xs text-slate-400 font-raj mr-1">Room</span>
            <span className="font-orbitron text-red-600 text-sm font-bold">{room.code}</span>
          </div>
        )}
      </div>
    </header>
  );
}
