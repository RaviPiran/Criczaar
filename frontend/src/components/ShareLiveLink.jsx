import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function ShareLiveLink({ roomCode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('projector'); // 'projector' | 'live' | 'team'

  if (!roomCode) return null;

  const origin = window.location.origin;
  const links = {
    projector: {
      url: `${origin}/projector/${roomCode}`,
      title: '📽️ Projector & Stage Screen',
      badge: 'RECOMMENDED FOR BIG SCREENS',
      badgeColor: '#F59E0B',
      desc: 'Designed for stage projectors, large LED walls & TVs. Displays 16:9 borderless auction ring, giant live bid numbers, countdown timer, team scoreboard, and full-screen SOLD TO celebration!',
      buttonText: 'Open Projector Screen',
    },
    live: {
      url: `${origin}/live/${roomCode}`,
      title: '📡 Public Spectator Feed',
      badge: 'FOR FANS & MOBILE',
      badgeColor: '#38BDF8',
      desc: 'For public audiences watching on phones, laptops, and tablets. Includes live bid feed, squads browser, and auction log.',
      buttonText: 'Open Spectator View',
    },
    team: {
      url: `${origin}/team/${roomCode}`,
      title: '📱 Team Bidding Floor',
      badge: 'FOR FRANCHISE OWNERS',
      badgeColor: '#10B981',
      desc: 'For franchise captains to place real-time bids during the auction with live purse tracking and team roster.',
      buttonText: 'Open Team Floor',
    },
  };

  const current = links[activeTab];

  const copy = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300 text-amber-500 hover:bg-amber-500/10 transition-all whitespace-nowrap shadow-sm">
        📽️ Broadcast Links
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C1222] text-white shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📽️</span>
                <div>
                  <h4 className="font-display font-black text-lg text-white">
                    Broadcast & Display Links
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Room Code: <strong className="text-amber-400">{roomCode}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-all">
                ✕
              </button>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/5">
              {[
                { id: 'projector', label: '📽️ Projector' },
                { id: 'live',      label: '📡 Public' },
                { id: 'team',      label: '📱 Teams' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-3 rounded-xl font-mono text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-base text-white">
                  {current.title}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{ background: `${current.badgeColor}22`, color: current.badgeColor, border: `1px solid ${current.badgeColor}44` }}>
                  {current.badge}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {current.desc}
              </p>

              <code className="block bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 break-all select-all">
                {current.url}
              </code>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => copy(current.url)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all flex items-center justify-center gap-1.5">
                  📋 Copy Link
                </button>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20">
                  🚀 {current.buttonText}
                </a>
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-500 font-mono">
              💡 Tip: Open Projector Screen on a laptop connected via HDMI to your stage projector or TV, and press <strong className="text-amber-400">F</strong> for full screen!
            </p>
          </div>
        </div>
      )}
    </>
  );
}