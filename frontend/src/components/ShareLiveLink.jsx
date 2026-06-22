import React, { useState } from 'react';
import toast from 'react-hot-toast';

// Drop this component anywhere in Auction.jsx / Dashboard.jsx header.
// Usage:  import ShareLiveLink from '../components/ShareLiveLink';
//         <ShareLiveLink roomCode={room.code} />
export default function ShareLiveLink({ roomCode }) {
  const [open, setOpen] = useState(false);
  if (!roomCode) return null;

  const link = `${window.location.origin}/live/${roomCode}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success('Live link copied!');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 transition-all whitespace-nowrap">
        📡 Share Live
      </button>

      {/* FIX: Rendered as a fixed full-screen modal instead of an absolute dropdown.
          The old `absolute` dropdown was clipped by the parent banner's
          rounded/overflow-hidden card, cutting the popup off at the top.
          A fixed-position centered modal always renders fully on screen
          regardless of where the button sits in the layout. */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📡</span>
                <h4 className="font-orbitron text-xs uppercase tracking-widest text-slate-600">
                  Public Live Auction Link
                </h4>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-slate-400">
              Anyone with this link can watch live — no login needed.
            </p>
            <code className="block bg-slate-100 rounded-xl px-3 py-2 text-xs text-slate-700 break-all select-all">
              {link}
            </code>
            <div className="flex gap-2">
              <button onClick={copy}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all">
                📋 Copy Link
              </button>
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all">
                👁 Preview
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}