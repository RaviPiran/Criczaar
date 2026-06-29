import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getAdminStats, getAdminUsers, updateUserRole, deleteUserAPI,
  getAdminRooms, adminDeleteRoom, adminSetRoomStatus, adminSetRoomSchedule,
  getAdminRoomPlayers, getAdminRoomSnapshot, adminCorrectPrice, adminRevertPlayer, getAdminLogs,
  createRoom,
} from '../utils/api';
import { getSocket } from '../utils/socket';
import CricBg from '../components/CricBg';

const statusColors = {
  active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  paused:    'bg-yellow-500/15  text-yellow-400  border-yellow-500/30',
  completed: 'bg-slate-500/15   text-slate-400   border-slate-500/30',
  setup:     'bg-blue-500/15    text-blue-400    border-blue-500/30',
};

const roleColors = {
  admin:      'bg-red-500/15  text-red-400  border-red-500/30',
  auctioneer: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  viewer:     'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const playerStatusColors = {
  sold:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  retained:  'bg-purple-500/15  text-purple-400  border-purple-500/30',
  unsold:    'bg-red-500/15     text-red-400     border-red-500/30',
  remaining: 'bg-slate-500/15   text-slate-400   border-slate-500/30',
};

const actionMeta = {
  role_change:       { icon: '👤', color: 'text-blue-400' },
  user_delete:       { icon: '🗑️', color: 'text-red-400' },
  room_status:       { icon: '🔄', color: 'text-yellow-400' },
  room_delete:       { icon: '🗑️', color: 'text-red-400' },
  price_correction:  { icon: '💰', color: 'text-emerald-400' },
  player_revert:     { icon: '↩️', color: 'text-orange-400' },
};

function formatCountdown(targetMs, nowMs) {
  const diff = targetMs - nowMs;
  if (diff <= 0) return { text: 'Starting now', overdue: diff < -60000 };
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (d || h) parts.push(`${h}h`);
  if (d || h || m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return { text: parts.join(' '), overdue: false };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Fixed, locale-proof "1 Aug 2026, 10:21 AM" format — toLocaleString('en-IN') silently
// falls back to the browser's own locale on some systems, producing "8/1/2026..." instead.
function formatDateTime(dateLike) {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${mm} ${ampm}`;
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="text-xs text-white/40 font-raj uppercase tracking-widest">{label}</div>
      <div className={`font-display text-3xl mt-1 ${accent || 'text-white'}`}>{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab]       = useState('overview'); // overview | users | rooms
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [rooms, setRooms]   = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [roomQuery, setRoomQuery] = useState('');

  // Live Control tab
  const [liveRoomId, setLiveRoomId]   = useState('');
  const [livePlayers, setLivePlayers] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [editPrice, setEditPrice]     = useState('');
  const [snapshot, setSnapshot]       = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Activity Log tab
  const [logs, setLogs]               = useState([]);
  const [logsLoaded, setLogsLoaded]   = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Upcoming Auctions tab
  const [now, setNow] = useState(Date.now());
  const [scheduleEditId, setScheduleEditId] = useState(null);
  const [scheduleEditValue, setScheduleEditValue] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', tournament: '', scheduledAt: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (tab !== 'upcoming') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [tab]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, u, r] = await Promise.all([getAdminStats(), getAdminUsers(), getAdminRooms()]);
      setStats(s.data.data);
      setUsers(u.data.data);
      setRooms(r.data.data);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Failed to load admin data';
      setLoadError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRoleChange = async (id, role) => {
    try {
      await updateUserRole(id, role);
      setUsers(prev => prev.map(u => u._id === id ? { ...u, role } : u));
      toast.success('Role updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await deleteUserAPI(id);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success('User deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleRoomStatus = async (id, status) => {
    try {
      await adminSetRoomStatus(id, status);
      setRooms(prev => prev.map(r => r._id === id ? { ...r, status } : r));
      toast.success('Status updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteRoom = async (id, name) => {
    if (!window.confirm(`Delete room "${name}" and ALL its teams/players? This cannot be undone.`)) return;
    try {
      await adminDeleteRoom(id);
      setRooms(prev => prev.filter(r => r._id !== id));
      toast.success('Room deleted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete room');
    }
  };

  const handleSetSchedule = async (id, isoValue) => {
    try {
      const scheduledAt = isoValue ? new Date(isoValue).toISOString() : null;
      const { data } = await adminSetRoomSchedule(id, scheduledAt);
      setRooms(prev => prev.map(r => r._id === id ? { ...r, scheduledAt: data.data.scheduledAt } : r));
      setScheduleEditId(null);
      toast.success(scheduledAt ? 'Schedule set' : 'Schedule cleared');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to set schedule');
    }
  };

  const handleCreateScheduledRoom = async () => {
    if (!newRoom.name.trim()) { toast.error('Enter a room name'); return; }
    setCreating(true);
    try {
      const { data } = await createRoom({
        name: newRoom.name.trim(),
        tournament: { name: newRoom.tournament.trim() },
        scheduledAt: newRoom.scheduledAt ? new Date(newRoom.scheduledAt).toISOString() : null,
      });
      const room = data.data;
      setRooms(prev => [{
        _id: room._id, name: room.name, code: room.code, status: room.status,
        tournament: room.tournament, createdAt: room.createdAt, scheduledAt: room.scheduledAt,
        owner: { name: user?.name, email: user?.email }, teamCount: 0, playerCount: 0,
      }, ...prev]);
      setNewRoom({ name: '', tournament: '', scheduledAt: '' });
      setShowCreateForm(false);
      toast.success(`"${room.name}" created${room.scheduledAt ? ' and scheduled' : ''}. Code: ${room.code}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create room');
    }
    setCreating(false);
  };

  // ── Live Control ──────────────────────────────────────────────────────────
  const loadLivePlayers = async (roomId) => {
    setLiveRoomId(roomId);
    setEditingId(null);
    if (!roomId) { setLivePlayers([]); setSnapshot(null); return; }
    setLiveLoading(true);
    try {
      const { data } = await getAdminRoomPlayers(roomId);
      setLivePlayers(data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load players');
    }
    setLiveLoading(false);
  };

  // Live snapshot — current player / bid / bidder, kept fresh via socket while a room is selected
  useEffect(() => {
    if (!liveRoomId) return;
    let cancelled = false;
    setSnapshotLoading(true);
    getAdminRoomSnapshot(liveRoomId)
      .then(({ data }) => { if (!cancelled) setSnapshot(data.data); })
      .catch(err => toast.error(err?.response?.data?.message || 'Failed to load snapshot'))
      .finally(() => { if (!cancelled) setSnapshotLoading(false); });

    const s = getSocket();
    s.emit('join-room', liveRoomId);

    const onBidUpdate    = ({ currentBid, currentBidder }) =>
      setSnapshot(prev => prev ? { ...prev, currentBid, currentBidder } : prev);
    const onNextPlayer   = (player) =>
      setSnapshot(prev => prev ? { ...prev, currentPlayer: player, currentBid: player?.basePrice || 0, currentBidder: null } : prev);
    const onPlayerResult = () => getAdminRoomSnapshot(liveRoomId).then(({ data }) => setSnapshot(data.data)).catch(() => {});
    const onPauseResume  = () => getAdminRoomSnapshot(liveRoomId).then(({ data }) => setSnapshot(data.data)).catch(() => {});
    const onAdminUpdate  = () => getAdminRoomSnapshot(liveRoomId).then(({ data }) => setSnapshot(data.data)).catch(() => {});

    s.on('bid-update', onBidUpdate);
    s.on('next-player', onNextPlayer);
    s.on('player-result', onPlayerResult);
    s.on('auction-paused', onPauseResume);
    s.on('auction-resumed', onPauseResume);
    s.on('admin-update', onAdminUpdate);

    return () => {
      cancelled = true;
      s.off('bid-update', onBidUpdate);
      s.off('next-player', onNextPlayer);
      s.off('player-result', onPlayerResult);
      s.off('auction-paused', onPauseResume);
      s.off('auction-resumed', onPauseResume);
      s.off('admin-update', onAdminUpdate);
    };
  }, [liveRoomId]);

  const notifyRoom = () => {
    // Tell the live Auction page + spectator link to refetch fresh data
    getSocket().emit('admin-update', { roomId: liveRoomId });
  };

  const startEditPrice = (player) => {
    setEditingId(player._id);
    setEditPrice(String(player.soldPrice ?? ''));
  };

  const saveEditPrice = async (player) => {
    const price = Number(editPrice);
    if (Number.isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    try {
      await adminCorrectPrice(player._id, price);
      setLivePlayers(prev => prev.map(p => p._id === player._id ? { ...p, soldPrice: price } : p));
      setEditingId(null);
      notifyRoom();
      toast.success(`${player.name}'s price corrected to ${price} pts`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to correct price');
    }
  };

  const handleRevert = async (player) => {
    if (!window.confirm(`Send "${player.name}" back to the pool for re-auction? Any sale will be refunded to the team.`)) return;
    try {
      await adminRevertPlayer(player._id);
      setLivePlayers(prev => prev.map(p =>
        p._id === player._id
          ? { ...p, status: 'remaining', soldTo: null, soldPrice: null, retainedBy: null, retainPrice: null, isRetained: false }
          : p
      ));
      notifyRoom();
      toast.success(`${player.name} sent back to the pool`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to revert player');
    }
  };

  // ── Activity Log ──────────────────────────────────────────────────────────
  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const { data } = await getAdminLogs();
      setLogs(data.data);
      setLogsLoaded(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load activity log');
    }
    setLogsLoading(false);
  };

  useEffect(() => {
    if (tab === 'logs' && !logsLoaded) loadLogs();
  }, [tab, logsLoaded]);

  const filteredUsers = users.filter(u =>
    !userQuery.trim() ||
    u.name?.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userQuery.toLowerCase())
  );
  const filteredRooms = rooms.filter(r =>
    !roomQuery.trim() ||
    r.name?.toLowerCase().includes(roomQuery.toLowerCase()) ||
    r.code?.toLowerCase().includes(roomQuery.toLowerCase()) ||
    r.owner?.email?.toLowerCase().includes(roomQuery.toLowerCase())
  );

  const upcomingRooms = rooms
    .filter(r => r.status === 'setup' && r.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const unscheduledRooms = rooms.filter(r => r.status === 'setup' && !r.scheduledAt);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users',    label: `👤 Users (${users.length})` },
    { id: 'rooms',    label: `🏏 Rooms (${rooms.length})` },
    { id: 'live',     label: '🛠 Live Control' },
    { id: 'upcoming', label: `📅 Upcoming (${upcomingRooms.length})` },
    { id: 'logs',     label: '📜 Activity Log' },
  ];

  return (
    <CricBg>
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-blue-700 flex items-center justify-center">
              <span className="text-white font-display text-lg">A</span>
            </div>
            <div>
              <div className="font-display text-2xl text-white leading-none">ADMIN <span className="text-red-500">PANEL</span></div>
              <div className="text-xs text-white/40 font-raj tracking-widest">PLATFORM CONTROL</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-white/60 font-raj hidden sm:block">👋 {user?.name}</div>
            <button onClick={() => navigate('/tournaments')}
              className="text-xs font-raj font-semibold text-white/40 hover:text-white transition-colors border border-white/10 px-3 py-1.5 rounded-lg hover:border-white/30">
              ← Back to App
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-5 py-2.5 rounded-xl font-raj font-bold text-sm transition-all"
                style={tab === t.id
                  ? { background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-white/40 font-raj py-16">Loading admin data...</div>
          ) : loadError ? (
            <div className="text-center py-16 space-y-3">
              <div className="text-red-400 font-raj">{loadError}</div>
              <div className="text-white/30 text-xs font-raj">
                Check that <code>/api/admin</code> routes are mounted in <code>server.js</code> and that you're logged in as an admin.
              </div>
              <button onClick={loadAll} className="text-xs font-bold text-white/60 hover:text-white border border-white/10 px-4 py-2 rounded-lg hover:border-white/30">
                Retry
              </button>
            </div>
          ) : tab === 'overview' ? (
            !stats ? null :
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard label="Total Users"       value={stats.totalUsers} />
                <StatCard label="Total Tournaments" value={stats.totalTournaments} />
                <StatCard label="Total Rooms"       value={stats.totalRooms} />
                <StatCard label="Total Teams"       value={stats.totalTeams} />
                <StatCard label="Total Players"     value={stats.totalPlayers} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Active"    value={stats.roomsByStatus.active}    accent="text-emerald-400" />
                <StatCard label="Paused"    value={stats.roomsByStatus.paused}    accent="text-yellow-400" />
                <StatCard label="Setup"     value={stats.roomsByStatus.setup}     accent="text-blue-400" />
                <StatCard label="Completed" value={stats.roomsByStatus.completed} accent="text-slate-400" />
              </div>
              <StatCard label="Total Points Transacted (all rooms)" value={stats.totalMoneyTransacted.toLocaleString()} accent="text-red-400" />
            </div>
          ) : tab === 'users' ? (
            <div className="space-y-4">
              <input
                value={userQuery} onChange={e => setUserQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-raj focus:outline-none focus:border-red-400/60 placeholder:text-white/20"
              />
              <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <table className="w-full text-sm font-raj">
                  <thead>
                    <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Rooms</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u._id} className="border-b border-white/5 text-white/80">
                        <td className="px-4 py-3">{u.name}</td>
                        <td className="px-4 py-3 text-white/50">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u._id, e.target.value)}
                            disabled={u._id === user?._id}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border bg-transparent ${roleColors[u.role] || roleColors.viewer} disabled:opacity-50`}>
                            <option value="admin" className="bg-slate-800">admin</option>
                            <option value="auctioneer" className="bg-slate-800">auctioneer</option>
                            <option value="viewer" className="bg-slate-800">viewer</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">{u.roomCount}</td>
                        <td className="px-4 py-3 text-white/40 text-xs">
                          {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteUser(u._id, u.name)}
                            disabled={u._id === user?._id}
                            className="text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30">No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'rooms' ? (
            <div className="space-y-4">
              <input
                value={roomQuery} onChange={e => setRoomQuery(e.target.value)}
                placeholder="Search by room name, code, or owner email..."
                className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-raj focus:outline-none focus:border-red-400/60 placeholder:text-white/20"
              />
              <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <table className="w-full text-sm font-raj">
                  <thead>
                    <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Tournament</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Teams</th>
                      <th className="px-4 py-3">Players</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map(r => (
                      <tr key={r._id} className="border-b border-white/5 text-white/80">
                        <td className="px-4 py-3">{r.name}</td>
                        <td className="px-4 py-3 font-orbitron text-white/50 text-xs">{r.code}</td>
                        <td className="px-4 py-3 text-white/50 text-xs">{r.owner?.email || '— none —'}</td>
                        <td className="px-4 py-3 text-white/50">{r.tournament?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <select
                            value={r.status}
                            onChange={e => handleRoomStatus(r._id, e.target.value)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border bg-transparent ${statusColors[r.status] || statusColors.setup}`}>
                            <option value="setup" className="bg-slate-800">setup</option>
                            <option value="active" className="bg-slate-800">active</option>
                            <option value="paused" className="bg-slate-800">paused</option>
                            <option value="completed" className="bg-slate-800">completed</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">{r.teamCount}</td>
                        <td className="px-4 py-3">{r.playerCount}</td>
                        <td className="px-4 py-3 text-right space-x-3">
                          <button
                            onClick={() => { setTab('live'); loadLivePlayers(r._id); }}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300">
                            Live Control
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(r._id, r.name)}
                            className="text-xs font-bold text-red-400 hover:text-red-300">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredRooms.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30">No rooms found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'live' ? (
            // tab === 'live'
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={liveRoomId}
                  onChange={e => loadLivePlayers(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-raj focus:outline-none focus:border-red-400/60">
                  <option value="" className="bg-slate-800">Select a room...</option>
                  {rooms.map(r => (
                    <option key={r._id} value={r._id} className="bg-slate-800">
                      {r.name} ({r.code}) — {r.status}
                    </option>
                  ))}
                </select>
                {liveRoomId && (
                  <span className="text-xs text-white/30 font-raj">
                    Corrections push instantly to the live auction screen + spectator link.
                  </span>
                )}
              </div>

              {!liveRoomId ? (
                <div className="text-center text-white/30 font-raj py-16">Pick a room above to manage its players live.</div>
              ) : (
                <>
                  {/* Live snapshot: current player / bid / bidder */}
                  {snapshotLoading ? (
                    <div className="text-center text-white/40 font-raj py-6">Loading snapshot...</div>
                  ) : snapshot && (
                    <div className="rounded-2xl border border-white/10 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div>
                        <div className="text-xs text-white/40 font-raj uppercase tracking-widest">Current Player</div>
                        <div className="font-display text-xl text-white mt-1">
                          {snapshot.currentPlayer?.name || '— none —'}
                        </div>
                        {snapshot.currentPlayer?.role && (
                          <div className="text-xs text-white/40 font-raj mt-0.5">{snapshot.currentPlayer.role}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-white/40 font-raj uppercase tracking-widest">Current Bid</div>
                        <div className="font-display text-xl text-emerald-400 mt-1">
                          {snapshot.currentPlayer ? `${snapshot.currentBid} pts` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white/40 font-raj uppercase tracking-widest">Current Bidder</div>
                        <div className="font-display text-xl text-white mt-1 flex items-center gap-2">
                          {snapshot.currentBidder?.name || '— no bid yet —'}
                          {snapshot.status === 'paused' && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">PAUSED</span>
                          )}
                          {snapshot.status === 'active' && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">LIVE</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!liveRoomId ? null : liveLoading ? (
                <div className="text-center text-white/40 font-raj py-16">Loading players...</div>
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <table className="w-full text-sm font-raj">
                    <thead>
                      <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Team</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {livePlayers.map(p => (
                        <tr key={p._id} className="border-b border-white/5 text-white/80">
                          <td className="px-4 py-3">{p.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${playerStatusColors[p.status] || playerStatusColors.remaining}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/50">{p.soldTo?.name || p.retainedBy?.name || '—'}</td>
                          <td className="px-4 py-3">
                            {editingId === p._id ? (
                              <input
                                autoFocus type="number" value={editPrice}
                                onChange={e => setEditPrice(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && saveEditPrice(p)}
                                className="w-24 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-red-400/60"
                              />
                            ) : (
                              <span>{['sold', 'retained'].includes(p.status) ? `${p.soldPrice} pts` : '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                            {['sold', 'retained'].includes(p.status) && (
                              editingId === p._id ? (
                                <>
                                  <button onClick={() => saveEditPrice(p)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Save</button>
                                  <button onClick={() => setEditingId(null)} className="text-xs font-bold text-white/40 hover:text-white">Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => startEditPrice(p)} className="text-xs font-bold text-blue-400 hover:text-blue-300">Fix Price</button>
                              )
                            )}
                            {p.status !== 'remaining' && (
                              <button onClick={() => handleRevert(p)} className="text-xs font-bold text-yellow-400 hover:text-yellow-300">
                                Send to Pool
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {livePlayers.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No players in this room</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : tab === 'upcoming' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30 font-raj">Auctions waiting to start, soonest first.</span>
                <button onClick={() => setShowCreateForm(v => !v)}
                  className="text-xs font-bold text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg transition-colors">
                  {showCreateForm ? 'Cancel' : '+ New Scheduled Auction'}
                </button>
              </div>

              {showCreateForm && (
                <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-white/40 font-raj uppercase tracking-widest">Room Name *</label>
                      <input value={newRoom.name} onChange={e => setNewRoom(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. IPL Mega Auction"
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-raj focus:outline-none focus:border-red-400/60 placeholder:text-white/20" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 font-raj uppercase tracking-widest">Tournament (optional)</label>
                      <input value={newRoom.tournament} onChange={e => setNewRoom(f => ({ ...f, tournament: e.target.value }))}
                        placeholder="e.g. IPL 2026"
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-raj focus:outline-none focus:border-red-400/60 placeholder:text-white/20" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 font-raj uppercase tracking-widest">Scheduled Start</label>
                      <input type="datetime-local" value={newRoom.scheduledAt} onChange={e => setNewRoom(f => ({ ...f, scheduledAt: e.target.value }))}
                        className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-raj focus:outline-none focus:border-red-400/60" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleCreateScheduledRoom} disabled={creating}
                      className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2 rounded-lg transition-colors">
                      {creating ? 'Creating...' : 'Create Room'}
                    </button>
                  </div>
                  <p className="text-xs text-white/30 font-raj">
                    Creates an empty room you (the admin) own — add teams/players for it later from Setup, using the room code shown after creation.
                  </p>
                </div>
              )}

              {upcomingRooms.length === 0 ? (
                <div className="text-center text-white/30 font-raj py-12">No scheduled auctions yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingRooms.map(r => {
                    const cd = formatCountdown(new Date(r.scheduledAt).getTime(), now);
                    return (
                      <div key={r._id} className="rounded-2xl border border-white/10 p-5 space-y-3"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div>
                          <div className="font-display text-lg text-white">{r.name}</div>
                          <div className="text-xs text-white/40 font-raj">{r.tournament?.name || 'No tournament'} · {r.owner?.email || '— none —'}</div>
                        </div>
                        <div className="text-xs text-white/40 font-raj">
                          {formatDateTime(r.scheduledAt)}
                        </div>
                        <div className={`font-display text-2xl ${cd.overdue ? 'text-red-400' : 'text-emerald-400'}`}>
                          {cd.overdue ? '⚠ Overdue' : cd.text}
                        </div>
                        {scheduleEditId === r._id ? (
                          <div className="flex items-center gap-2">
                            <input type="datetime-local" value={scheduleEditValue}
                              onChange={e => setScheduleEditValue(e.target.value)}
                              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-red-400/60" />
                            <button onClick={() => handleSetSchedule(r._id, scheduleEditValue)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Save</button>
                            <button onClick={() => setScheduleEditId(null)} className="text-xs font-bold text-white/40 hover:text-white">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setScheduleEditId(r._id); setScheduleEditValue(r.scheduledAt?.slice(0, 16) || ''); }}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300">
                              Reschedule
                            </button>
                            <button onClick={() => handleSetSchedule(r._id, null)} className="text-xs font-bold text-white/30 hover:text-white/60">
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {unscheduledRooms.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs text-white/40 font-raj uppercase tracking-widest">Not yet scheduled ({unscheduledRooms.length})</div>
                  <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="divide-y divide-white/5">
                      {unscheduledRooms.map(r => (
                        <div key={r._id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <div className="font-raj text-white/80">{r.name}</div>
                            <div className="text-xs text-white/40 font-raj">{r.owner?.email || '— none —'}</div>
                          </div>
                          {scheduleEditId === r._id ? (
                            <div className="flex items-center gap-2">
                              <input type="datetime-local" value={scheduleEditValue}
                                onChange={e => setScheduleEditValue(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-red-400/60" />
                              <button onClick={() => handleSetSchedule(r._id, scheduleEditValue)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">Save</button>
                              <button onClick={() => setScheduleEditId(null)} className="text-xs font-bold text-white/40 hover:text-white">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setScheduleEditId(r._id); setScheduleEditValue(''); }}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300">
                              Set Schedule
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // tab === 'logs'
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/30 font-raj">Most recent admin actions across the platform.</span>
                <button onClick={loadLogs} className="text-xs font-bold text-white/50 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg hover:border-white/30">
                  Refresh
                </button>
              </div>
              {logsLoading ? (
                <div className="text-center text-white/40 font-raj py-16">Loading activity log...</div>
              ) : (
                <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="divide-y divide-white/5">
                    {logs.map(l => {
                      const meta = actionMeta[l.action] || { icon: '📝', color: 'text-white/60' };
                      return (
                        <div key={l._id} className="flex items-start gap-3 px-4 py-3">
                          <span className="text-lg leading-none">{meta.icon}</span>
                          <div className="flex-1">
                            <div className={`text-sm font-raj ${meta.color}`}>{l.message}</div>
                            <div className="text-xs text-white/30 font-raj mt-0.5">
                              {l.admin?.name || 'Unknown admin'} · {new Date(l.createdAt).toLocaleString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {logs.length === 0 && (
                      <div className="px-4 py-8 text-center text-white/30">No admin activity yet</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CricBg>
  );
}