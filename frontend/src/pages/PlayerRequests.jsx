import React, { useEffect, useState, useCallback } from 'react';
import { useAuction } from '../context/AuctionContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import CricBg from '../components/CricBg';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('ca_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const TABS = ['pending', 'approved', 'rejected'];
const TAB_STYLE = {
  pending:  { active: 'bg-yellow-500 text-white',  inactive: 'text-yellow-600 hover:bg-yellow-50',  dot: 'bg-yellow-400' },
  approved: { active: 'bg-emerald-500 text-white', inactive: 'text-emerald-600 hover:bg-emerald-50',dot: 'bg-emerald-400' },
  rejected: { active: 'bg-red-500 text-white',     inactive: 'text-red-500 hover:bg-red-50',        dot: 'bg-red-400' },
};

export default function PlayerRequests() {
  const { state } = useAuction();
  const { room } = state;
  const navigate = useNavigate();

  const [tab,        setTab]        = useState('pending');
  const [requests,   setRequests]   = useState([]);
  const [counts,     setCounts]     = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading,    setLoading]    = useState(false);
  const [actioning,  setActioning]  = useState(null);
  const [rejectId,   setRejectId]   = useState(null);
  const [rejectMsg,  setRejectMsg]  = useState('');
  const [basePrice,  setBasePrice]  = useState('');
  const [approveId,  setApproveId]  = useState(null);

  // Multi-select
  const [selected,      setSelected]      = useState(new Set());
  const [bulkActioning, setBulkActioning] = useState(false);

  // Reset selection when tab changes
  useEffect(() => { setSelected(new Set()); }, [tab]);

  // Build the webhook URL for display
  const webhookUrl = room
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/player-requests/webhook/${room.code}`
    : '';

  // Public player registration link — share this with players
  const registrationUrl = room
    ? `${window.location.origin}/register/${room.code}`
    : '';

  const fetchRequests = useCallback(async () => {
    if (!room?._id) return;
    setLoading(true);
    try {
      const { data } = await API.get(`/player-requests/room/${room._id}?status=${tab}`);
      setRequests(data.data || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load requests');
    }
    setLoading(false);
  }, [room?._id, tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id) => {
    setActioning(id);
    try {
      await API.post(`/player-requests/${id}/approve`, {
        basePrice: parseFloat(basePrice) || undefined,
      });
      toast.success('✅ Player approved and added to auction!');
      setApproveId(null);
      setBasePrice('');
      fetchRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Approval failed');
    }
    setActioning(null);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setActioning(rejectId);
    try {
      await API.post(`/player-requests/${rejectId}/reject`, { reason: rejectMsg });
      toast.success('Request rejected');
      setRejectId(null);
      setRejectMsg('');
      fetchRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Rejection failed');
    }
    setActioning(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this request permanently?')) return;
    try {
      await API.delete(`/player-requests/${id}`);
      toast.success('Deleted');
      fetchRequests();
    } catch { toast.error('Delete failed'); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requests.map(r => r._id)));
    }
  };

  const handleBulkApprove = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Approve ${selected.size} player${selected.size > 1 ? 's' : ''}?`)) return;
    setBulkActioning(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        await API.post(`/player-requests/${id}/approve`, {});
        ok++;
      } catch { fail++; }
    }
    setBulkActioning(false);
    setSelected(new Set());
    if (ok)   toast.success(`✅ ${ok} player${ok > 1 ? 's' : ''} approved!`);
    if (fail) toast.error(`${fail} failed`);
    fetchRequests();
  };

  const handleBulkReject = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Reject ${selected.size} player${selected.size > 1 ? 's' : ''}?`)) return;
    setBulkActioning(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        await API.post(`/player-requests/${id}/reject`, { reason: 'Bulk rejected' });
        ok++;
      } catch { fail++; }
    }
    setBulkActioning(false);
    setSelected(new Set());
    if (ok)   toast.success(`${ok} rejected`);
    if (fail) toast.error(`${fail} failed`);
    fetchRequests();
  };

  if (!room) return (
    <CricBg>
      <div className="p-6 text-center text-slate-400 min-h-full flex flex-col items-center justify-center gap-4">
        <div className="text-6xl opacity-30">📋</div>
        <p>No active room.</p>
        <button onClick={() => navigate('/tournaments')} className="btn-primary px-5 py-2">
          ← Go to Tournaments
        </button>
      </div>
    </CricBg>
  );

  return (
    <CricBg>
      <div className="p-6 max-w-5xl space-y-6 animate-fade-in">

        {/* Header */}
        <div>
          <h2 className="font-display text-3xl text-slate-900 tracking-wide">📋 Player Registrations</h2>
          <p className="text-slate-500 text-sm mt-1">
            Review players who registered via your Google Form link.
          </p>
        </div>

        {/* Webhook URL box — share this with your Google Form setup */}
        {/* <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔗</span>
            <h3 className="font-orbitron text-xs uppercase tracking-widest text-slate-600">
              Your Webhook URL — paste this into Google Apps Script
            </h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-700 font-mono break-all select-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied!'); }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 hover:border-blue-400 text-slate-600 hover:text-blue-600 transition-all whitespace-nowrap">
              📋 Copy
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Room code: <span className="font-orbitron text-slate-600">{room.code}</span>
            {' · '}Set <code className="bg-slate-100 px-1 rounded">ROOM_CODE = "{room.code}"</code> in your Apps Script.
          </p>
        </div> */}

        {/* Player Registration Link — share this with players */}
        <div className="glass-card rounded-2xl p-5 space-y-3 border-2" style={{borderColor:'rgba(220,38,38,0.25)', background:'rgba(220,38,38,0.03)'}}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🏏</span>
            <h3 className="font-orbitron text-xs uppercase tracking-widest text-red-600">
              Player Registration Link — Share this with players
            </h3>
          </div>
          <p className="text-xs text-slate-500">Players open this link, fill their details, and their registration appears in the Pending tab below.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="flex-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-mono break-all select-all font-semibold">
              {registrationUrl}
            </code>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { navigator.clipboard.writeText(registrationUrl); toast.success('Link copied!'); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-red-300 text-red-600 hover:bg-red-50 transition-all whitespace-nowrap">
                📋 Copy Link
              </button>
              <a
                href={registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all whitespace-nowrap">
                👁 Preview
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-500 text-sm flex-shrink-0">💡</span>
            <p className="text-xs text-amber-700">
              Share via WhatsApp, email, or any messaging app. Players don't need to log in — they just open the link and fill the form.
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const s = TAB_STYLE[t];
            const count = counts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  tab === t ? s.active : `bg-white/60 border border-slate-200 ${s.inactive}`
                }`}>
                <span className={`w-2 h-2 rounded-full ${s.dot}`}/>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${tab === t ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
          <button onClick={fetchRequests}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-400 hover:text-slate-700 transition-all">
            ↻ Refresh
          </button>
        </div>

        {/* Request cards */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-white/40">
            <div className="text-4xl mb-3 opacity-30">
              {tab === 'pending' ? '⏳' : tab === 'approved' ? '✅' : '❌'}
            </div>
            No {tab} registrations yet.
            {tab === 'pending' && (
              <p className="text-xs mt-2 text-slate-400">
                Share your Google Form link with players — submissions will appear here.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">

            {/* Bulk action toolbar — only on pending tab */}
            {tab === 'pending' && requests.length > 0 && (
              <div className="flex items-center gap-3 px-2 py-2 rounded-xl border border-slate-200 bg-white/60">
                <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                  <input type="checkbox"
                    checked={selected.size === requests.length && requests.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"/>
                  <span className="text-xs font-raj text-slate-500">
                    {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
                  </span>
                </label>
                {selected.size > 0 && (
                  <>
                    <div className="w-px h-5 bg-slate-200"/>
                    <button onClick={handleBulkApprove} disabled={bulkActioning}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-40 flex items-center gap-1.5">
                      {bulkActioning ? '⏳' : '✅'} Approve {selected.size}
                    </button>
                    <button onClick={handleBulkReject} disabled={bulkActioning}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 flex items-center gap-1.5">
                      {bulkActioning ? '⏳' : '❌'} Reject {selected.size}
                    </button>
                    <button onClick={() => setSelected(new Set())}
                      className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}

            {requests.map(req => (
              <div key={req._id}
                className={`glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all ${selected.has(req._id) ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}>

                {/* Checkbox + Avatar */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {tab === 'pending' && (
                    <input type="checkbox"
                      checked={selected.has(req._id)}
                      onChange={() => toggleSelect(req._id)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer flex-shrink-0"/>
                  )}
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-200 flex-shrink-0">
                    {req.photo
                      ? <img src={req.photo} alt={req.name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full bg-gradient-to-br from-blue-100 to-red-100 flex items-center justify-center font-display text-2xl text-blue-600">
                          {req.name[0]}
                        </div>}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-lg text-slate-900">{req.name}</span>
                    {req.role && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">
                        {req.role}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                    {req.email && <span>✉ {req.email}</span>}
                    {req.phone && <span>📱 {req.phone}</span>}
                    {req.club  && <span>🏏 {req.club}</span>}
                    {req.battingStyle && <span>🏏 {req.battingStyle}</span>}
                    {req.bowlingStyle && req.bowlingStyle !== 'N/A' && <span>⚾ {req.bowlingStyle}</span>}
                  </div>
                  <div className="text-xs text-slate-300">
                    Submitted {new Date(req.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  {req.status === 'rejected' && req.rejectReason && (
                    <div className="text-xs text-red-500 mt-1">Reason: {req.rejectReason}</div>
                  )}
                  {req.status === 'approved' && (
                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                      ✅ Added to auction as a player
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  {tab === 'pending' && (
                    <>
                      <button
                        onClick={() => { setApproveId(req._id); setBasePrice(''); }}
                        disabled={actioning === req._id}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-40">
                        {actioning === req._id ? '⏳' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => { setRejectId(req._id); setRejectMsg(''); }}
                        disabled={actioning === req._id}
                        className="px-4 py-2 text-xs font-bold rounded-xl border border-red-300 text-red-500 hover:bg-red-50 transition-all disabled:opacity-40">
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {tab === 'rejected' && (
                    <button
                      onClick={() => { setApproveId(req._id); setBasePrice(''); }}
                      disabled={actioning === req._id}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-40">
                      ✅ Approve Anyway
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(req._id)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400 transition-all">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approve dialog */}
        {approveId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="glass-card rounded-3xl p-8 w-full max-w-sm space-y-5 shadow-2xl">
              <h3 className="font-display text-2xl text-slate-900">✅ Approve Player</h3>
              <p className="text-sm text-slate-500">
                This will add the player to your auction list as a bidding candidate.
              </p>
              <div>
                <label className="label">Base Price (pts) — leave blank to use room default</label>
                <input
                  className="input"
                  type="number" step="0.5" min="0"
                  placeholder={`Default: ${room?.rules?.basePrice ?? 0.5} pts`}
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(approveId)}
                  disabled={actioning === approveId}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-40">
                  {actioning === approveId ? '⏳ Adding...' : '✅ Confirm Approve'}
                </button>
                <button
                  onClick={() => setApproveId(null)}
                  className="px-5 py-3 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject dialog */}
        {rejectId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="glass-card rounded-3xl p-8 w-full max-w-sm space-y-5 shadow-2xl">
              <h3 className="font-display text-2xl text-slate-900">❌ Reject Registration</h3>
              <div>
                <label className="label">Reason (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="e.g. Already registered, incomplete info..."
                  value={rejectMsg}
                  onChange={e => setRejectMsg(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={actioning === rejectId}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm bg-red-500 hover:bg-red-600 transition-all disabled:opacity-40">
                  {actioning === rejectId ? '⏳...' : '❌ Confirm Reject'}
                </button>
                <button
                  onClick={() => setRejectId(null)}
                  className="px-5 py-3 rounded-xl font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </CricBg>
  );
}