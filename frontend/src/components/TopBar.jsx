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
    <header className="h-16 border-b flex items-center gap-4 px-4 sticky top-0 z-20" style={{background:"rgba(10,15,29,0.78)",borderColor:"rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",boxShadow:"0 2px 24px rgba(0,0,0,0.35)"}}>
      <button onClick={onMenuClick} className="lg:hidden text-slate-500 hover:text-amber-500 text-xl p-1 transition-colors">☰</button>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
          style={{background:'linear-gradient(135deg,#FBBF24,#F59E0B)'}}>
          <span className="text-white text-sm">{meta.icon}</span>
        </div>
        <div>
          <h1 className="font-display text-lg leading-none tracking-wide text-ink-900">{meta.title}</h1>
          {meta.sub && <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{meta.sub}</p>}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {room && room.status !== 'setup' && (
          <div className="hidden sm:flex items-center gap-3 bg-ink-50 border border-ink-200 rounded-xl px-4 py-2 text-xs font-mono">
            <span className="text-slate-500">Sold <strong className="text-emerald-500 font-mono">{sold}</strong></span>
            <span className="w-px h-3 bg-slate-300"/>
            <span className="text-slate-500">Left <strong className="text-sky-400 font-mono">{remain}</strong></span>
            {room.status==='paused' && (
              <><span className="w-px h-3 bg-slate-300"/>
              <span className="flex items-center gap-1.5 text-amber-500"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full live-dot"/>PAUSED</span></>
            )}
            {room.status==='active' && (
              <><span className="w-px h-3 bg-slate-300"/>
              <span className="flex items-center gap-1.5 text-amber-400"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full live-dot"/>LIVE</span></>
            )}
          </div>
        )}
        {room && (
          <div className="rounded-lg px-3 py-1.5 hidden md:block border"
            style={{background:'linear-gradient(135deg,rgba(245,158,11,0.10) 0%,rgba(99,102,241,0.10) 100%)',borderColor:'rgba(245,158,11,0.35)'}}>
            <span className="text-[10px] text-slate-400 font-mono mr-1 uppercase tracking-wider">Room</span>
            <span className="font-mono text-amber-500 text-sm font-bold">{room.code}</span>
          </div>
        )}
      </div>
    </header>
  );
}
