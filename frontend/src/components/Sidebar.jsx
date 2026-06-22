import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../context/AuctionContext';
import icon from '../../src/logo.png';

const NAV = [
  { path:'/dashboard',  icon:'🏠', label:'Dashboard' },
  { path:'/setup',      icon:'⚙️',  label:'Setup Room' },
  { path:'/auction',    icon:'🔴', label:'Live Auction' },
  { path:'/teams',      icon:'🛡', label:'Teams' },
  { path:'/players',         icon:'👥', label:'Players' },
  { path:'/player-requests', icon:'📋', label:'Registrations' },
  { path:'/retentions', icon:'🔒', label:'Retentions' },
  { path:'/bid-rules',  icon:'🎯', label:'Bid Rules' },
  { path:'/results',    icon:'📊', label:'Results' },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const { state } = useAuction();
  const { room }  = state;

  const tournament = room?.tournament;

  return (
    <>
      {!collapsed && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={()=>setCollapsed(true)}/>
      )}
      <aside className={`
        fixed top-0 left-0 h-full z-40 flex flex-col
        border-r border-blue-900/60 shadow-2xl
        transition-all duration-300 ease-in-out
        ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-64'}
      `} style={{background:'linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)'}}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 min-h-[64px]"
          style={{background:'linear-gradient(90deg,rgba(220,38,38,0.15) 0%,rgba(29,78,216,0.15) 100%)'}}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20">
            <img src={icon} alt="icon" className="w-9 h-9 object-contain"/>
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <div className="font-display text-xl leading-none text-white">CRIC</div>
              <div className="font-display text-xl leading-none text-red-500">ZAAR</div>
            </div>
          )}
          <button onClick={()=>setCollapsed(c=>!c)}
            className="ml-auto text-white/40 hover:text-white transition-colors hidden lg:block text-xl leading-none">
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Tournament badge */}
        {tournament?.name && !collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl border border-white/10 animate-fade-in"
            style={{background:'rgba(29,78,216,0.12)'}}>
            <div className="flex items-center gap-2">
              {tournament.logo && (
                <img src={tournament.logo} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0 border border-white/10"/>
              )}
              <div className="min-w-0">
                <div className="text-[10px] text-white/30 font-raj tracking-widest uppercase">Tournament</div>
                <div className="font-display text-sm text-blue-300 truncate">{tournament.name}</div>
              </div>
            </div>
          </div>
        )}

        {/* Room badge */}
        {room && !collapsed && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-xl animate-fade-in border border-white/10"
            style={{background:'rgba(220,38,38,0.12)'}}>
            <div className="text-xs text-white/40 font-raj tracking-widest uppercase">Active Room</div>
            <div className="font-orbitron text-red-400 font-bold text-sm mt-0.5 truncate">{room.name}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${room.status==='paused'?'bg-yellow-400':room.status==='active'?'bg-green-400 animate-pulse':'bg-white/30'}`}/>
                <span className="text-xs text-white/40 uppercase tracking-wider">{room.status}</span>
              </div>
              <span className="font-orbitron text-[10px] text-white/20">{room.code}</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {/* Back to tournaments */}
          <button onClick={()=>navigate('/tournaments')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-raj font-semibold text-sm mb-2
              ${location.pathname==='/tournaments' ? 'text-white border-l-2 border-amber-400' : 'text-white/40 hover:text-white hover:bg-white/5'}
              ${collapsed ? 'justify-center px-2' : ''}`}
            style={location.pathname==='/tournaments'?{background:'rgba(245,158,11,0.15)'}:{}}
            title={collapsed?'All Tournaments':''}>
            <span className="text-base flex-shrink-0">🏆</span>
            {!collapsed && <span className="animate-fade-in tracking-wide">All Tournaments</span>}
          </button>

          <div className="mx-2 h-px bg-white/5 mb-2"/>

          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} onClick={()=>navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-raj font-semibold text-sm
                  ${active ? 'text-white border-l-2 border-red-500' : 'text-white/50 hover:text-white hover:bg-white/5'}
                  ${collapsed ? 'justify-center px-2' : ''}`}
                style={active?{background:'linear-gradient(90deg,rgba(220,38,38,0.25) 0%,rgba(29,78,216,0.15) 100%)'}:{}}
                title={collapsed?item.label:''}>
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="animate-fade-in tracking-wide">{item.label}</span>}
                {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 bg-red-500 rounded-full"/>}
              </button>
            );
          })}
        </nav>

        <div className="mx-3 h-px bg-gradient-to-r from-red-600/40 via-blue-600/40 to-transparent mb-1"/>

        {/* User */}
        <div className={`p-3 ${collapsed?'flex justify-center':''}`}>
          {collapsed ? (
            <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400 font-bold text-sm cursor-pointer hover:bg-red-600/30 transition-colors"
              title={user?.name} onClick={logout}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-fade-in bg-white/5 rounded-xl p-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate text-white">{user?.name}</div>
                <div className="text-xs text-white/40 truncate">{user?.email}</div>
              </div>
              <button onClick={logout} title="Logout"
                className="text-white/30 hover:text-red-400 transition-colors text-lg flex-shrink-0">⏏</button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
