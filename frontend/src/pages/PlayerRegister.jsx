import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ROLES    = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'];
const BAT_STYLE = ['Right-hand Bat', 'Left-hand Bat'];
const BOWL_STYLE = ['Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin', 'Left-arm Fast', 'Left-arm Medium', 'Left-arm Spin', 'N/A'];

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function PlayerRegister() {
  const { roomCode } = useParams();

  const [room,      setRoom]      = useState(null);
  const [roomErr,   setRoomErr]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [checking,  setChecking]  = useState(true);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', club: '',
    role: '', battingStyle: '', bowlingStyle: '', photo: '',
  });
  const [photoPreview, setPhotoPreview] = useState('');
  const [errors, setErrors] = useState({});

  // Verify room code on load
  useEffect(() => {
    if (!roomCode) { setRoomErr('No room code in URL.'); setChecking(false); return; }
    axios.get(`${API_URL}/rooms/${roomCode.toUpperCase()}`)
      .then(({ data }) => {
        if (data.success) setRoom(data.data);
        else setRoomErr('Auction room not found.');
      })
      .catch(() => setRoomErr('Auction room not found. Check your link.'))
      .finally(() => setChecking(false));
  }, [roomCode]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    const b64 = await toBase64(file);
    setPhotoPreview(b64);
    setForm(f => ({ ...f, photo: b64 }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Full name is required';
    if (!form.role)         e.role  = 'Playing role is required';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // Uses /register (public) not /webhook (Apps Script only)
      const { data } = await axios.post(
        `${API_URL}/player-requests/register/${roomCode.toUpperCase()}`,
        { ...form }
      );
      if (data.success) {
        setSubmitted(true);
      } else {
        toast.error(data.message || 'Registration failed');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Try again.');
    }
    setLoading(false);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (checking) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div className="text-center">
        <div className="text-5xl animate-bounce mb-4">🏏</div>
        <p className="text-white/50 font-raj tracking-widest text-sm">Loading auction...</p>
      </div>
    </div>
  );

  // ── Room not found ─────────────────────────────────────────────────────────
  if (roomErr) return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div className="text-center space-y-4">
        <div className="text-6xl">❌</div>
        <h2 className="text-white font-display text-2xl">Invalid Link</h2>
        <p className="text-white/50 text-sm">{roomErr}</p>
        <p className="text-white/30 text-xs">Contact your auction organiser for the correct link.</p>
      </div>
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)' }}>
      <div className="text-center space-y-5 max-w-sm">
        <div className="text-7xl animate-bounce">🎉</div>
        <h2 className="text-white font-display text-3xl tracking-wide">Registered!</h2>
        <p className="text-white/60 font-raj">
          Your registration for <span className="text-yellow-400 font-bold">{room?.name || roomCode}</span> has been received.
        </p>
        <div className="rounded-2xl p-5 text-left space-y-2 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="text-white/40 text-xs font-orbitron uppercase tracking-widest mb-3">Your Details</div>
          {[
            ['Name',  form.name],
            ['Role',  form.role],
            ['Club',  form.club],
            ['Email', form.email],
          ].filter(([,v]) => v).map(([l, v]) => (
            <div key={l} className="flex justify-between text-sm">
              <span className="text-white/40 font-raj">{l}</span>
              <span className="text-white font-semibold font-raj">{v}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs font-raj">
          The auction organiser will review your registration and add you to the player pool.
        </p>
      </div>
    </div>
  );

  // ── Registration Form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-8 px-4"
      style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)' }}>
      <Toaster position="top-center"/>

      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#dc2626,#1d4ed8)' }}>
              <span className="text-white font-display text-xl">C</span>
            </div>
            <div className="text-left">
              <div className="font-display text-2xl text-white leading-none">
                CRIC<span className="text-red-500">ZAAR</span>
              </div>
              <div className="text-xs text-white/30 font-raj tracking-widest">AUCTION PLATFORM</div>
            </div>
          </div>
          <h1 className="font-display text-3xl text-white tracking-wide">
            Player <span className="text-red-500">Registration</span>
          </h1>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            <span className="text-yellow-400 text-sm">🏆</span>
            <span className="text-white/70 font-raj text-sm">{room?.name}</span>
            <span className="text-white/20 text-xs font-orbitron">{roomCode?.toUpperCase()}</span>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-3xl p-6 sm:p-8 space-y-5 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)' }}>

          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => document.getElementById('photo-input').click()}
              className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-red-400/60 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {photoPreview
                ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover"/>
                : <div className="text-center">
                    <div className="text-3xl">📷</div>
                    <div className="text-[10px] text-white/30 mt-1 font-raj">Photo</div>
                  </div>}
            </div>
            <input id="photo-input" type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files[0] && handlePhoto(e.target.files[0])}/>
            <p className="text-xs text-white/30 font-raj">Optional · Max 2MB</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Your full name"
              className={`w-full rounded-xl px-4 py-3 text-white font-raj text-base placeholder:text-white/20 focus:outline-none transition-all border ${
                errors.name ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5 focus:border-red-400/60'
              }`}/>
            {errors.name && <p className="text-red-400 text-xs mt-1 font-raj">{errors.name}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">
              Playing Role <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r} type="button"
                  onClick={() => set('role', r)}
                  className={`py-2.5 rounded-xl text-sm font-raj font-semibold transition-all border ${
                    form.role === r
                      ? 'border-red-500 text-white'
                      : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                  }`}
                  style={form.role === r ? { background: 'linear-gradient(135deg,#dc2626,#1d4ed8)' } : { background: 'rgba(255,255,255,0.03)' }}>
                  {r === 'Batsman' ? '🏏' : r === 'Bowler' ? '⚾' : r === 'All-rounder' ? '⭐' : '🧤'} {r}
                </button>
              ))}
            </div>
            {errors.role && <p className="text-red-400 text-xs mt-1 font-raj">{errors.role}</p>}
          </div>

          {/* Batting style */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">Batting Style</label>
            <div className="grid grid-cols-2 gap-2">
              {BAT_STYLE.map(s => (
                <button key={s} type="button" onClick={() => set('battingStyle', s)}
                  className={`py-2.5 rounded-xl text-sm font-raj font-semibold transition-all border ${
                    form.battingStyle === s
                      ? 'border-blue-500 text-white'
                      : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                  }`}
                  style={form.battingStyle === s ? { background: 'rgba(29,78,216,0.3)' } : { background: 'rgba(255,255,255,0.03)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Bowling style */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">Bowling Style</label>
            <select
              value={form.bowlingStyle} onChange={e => set('bowlingStyle', e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-white font-raj text-sm border border-white/10 bg-white/5 focus:outline-none focus:border-blue-400/60 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <option value="" style={{ background: '#1e1b4b' }}>-- Select --</option>
              {BOWL_STYLE.map(s => <option key={s} value={s} style={{ background: '#1e1b4b' }}>{s}</option>)}
            </select>
          </div>

          {/* Club */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">Club / Team</label>
            <input
              value={form.club} onChange={e => set('club', e.target.value)}
              placeholder="Your club or local team name"
              className="w-full rounded-xl px-4 py-3 text-white font-raj text-base placeholder:text-white/20 border border-white/10 bg-white/5 focus:outline-none focus:border-blue-400/60 transition-all"/>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">Email</label>
            <input
              value={form.email} onChange={e => set('email', e.target.value)}
              type="email" placeholder="your@email.com"
              className={`w-full rounded-xl px-4 py-3 text-white font-raj text-base placeholder:text-white/20 focus:outline-none transition-all border ${
                errors.email ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5 focus:border-blue-400/60'
              }`}/>
            {errors.email && <p className="text-red-400 text-xs mt-1 font-raj">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-white/40 font-orbitron uppercase tracking-widest mb-1.5">Phone Number</label>
            <input
              value={form.phone} onChange={e => set('phone', e.target.value)}
              type="tel" placeholder="e.g. 9876543210"
              className="w-full rounded-xl px-4 py-3 text-white font-raj text-base placeholder:text-white/20 border border-white/10 bg-white/5 focus:outline-none focus:border-blue-400/60 transition-all"/>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-display tracking-widest text-white text-lg font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-2"
            style={{ background: loading ? '#374151' : 'linear-gradient(135deg,#dc2626,#1d4ed8)' }}>
            {loading ? '⏳ Submitting...' : '🏏 Register for Auction'}
          </button>

          <p className="text-center text-white/20 text-xs font-raj">
            Your details will be reviewed by the auction organiser before being added to the player pool.
          </p>
        </div>

        <p className="text-center text-white/20 text-xs font-raj pb-6">
          Powered by CricZaar Auction Platform
        </p>
      </div>
    </div>
  );
}
