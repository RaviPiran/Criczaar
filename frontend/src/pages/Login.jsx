import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import icon from '../../src/logo.png';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab]         = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState({ name:'', email:'', password:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (tab==='login') { await login(form.email, form.password); toast.success('Welcome back! 🏏'); }
      else { if(!form.name.trim()){toast.error('Enter your name');setLoading(false);return;} await register(form.name,form.email,form.password); toast.success('Account created! 🎉'); }
      navigate('/dashboard');
    } catch(err) { toast.error(err.response?.data?.message||'Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#1e3a8a 100%)'}}>

      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Red glow top-right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{background:'radial-gradient(circle,#dc2626 0%,transparent 70%)'}}/>
        {/* Blue glow bottom-left */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{background:'radial-gradient(circle,#1d4ed8 0%,transparent 70%)'}}/>
        {/* Cricket pitch lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 1000 600">
          <ellipse cx="500" cy="300" rx="420" ry="260" fill="none" stroke="#ffffff" strokeWidth="1.5"/>
          <ellipse cx="500" cy="300" rx="80"  ry="52"  fill="none" stroke="#ffffff" strokeWidth="1.5"/>
          <line x1="500" y1="40" x2="500" y2="560" stroke="#ffffff" strokeWidth="1"/>
          <line x1="80"  y1="300" x2="920" y2="300" stroke="#ffffff" strokeWidth="1"/>
        </svg>
        {/* Diagonal accent lines */}
        <div className="absolute top-0 left-0 w-full h-1"
          style={{background:'linear-gradient(90deg,#dc2626,#1d4ed8)'}}/>
      </div>

      <div className="w-full max-w-md animate-slide-up relative z-10">

        {/* Logo block */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl mb-4 overflow-hidden border border-white/20"
            style={{background:'rgba(255,255,255,0.08)',backdropFilter:'blur(12px)'}}>
            <img src={icon} alt="icon" className="w-20 h-20 object-contain"/>
          </div>
          <h1 className="font-display text-6xl leading-none text-white">CRIC</h1>
          <h1 className="font-display text-6xl leading-none text-red-500">ZAAR</h1>
          <p className="text-white/40 text-sm tracking-[4px] uppercase mt-2 font-raj">Live • Bidding • Championship</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl shadow-2xl p-6 border border-white/10"
          style={{background:'rgba(255,255,255,0.07)',backdropFilter:'blur(20px)'}}>

          {/* Tabs */}
          <div className="flex rounded-2xl p-1 mb-7 gap-1 border border-white/10"
            style={{background:'rgba(0,0,0,0.25)'}}>
            {['login','register'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`flex-1 py-2.5 rounded-xl font-raj font-bold text-sm tracking-widest uppercase transition-all duration-200
                  ${tab===t
                    ? 'text-white shadow-lg'
                    : 'text-white/40 hover:text-white/70'}`}
                style={tab===t ? {background:'linear-gradient(135deg,#dc2626 0%,#1d4ed8 100%)'} : {}}>
                {t==='login' ? '🔑 Sign In' : '📝 Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {tab==='register' && (
              <div className="animate-fade-in">
                <label className="label text-white/60">Full Name</label>
                <input className="input bg-white/10 border-white/20 text-white placeholder-white/30 focus:border-red-500 focus:bg-white/15"
                  type="text" placeholder="Your full name" value={form.name} onChange={e=>set('name',e.target.value)} required/>
              </div>
            )}
            <div>
              <label className="label text-white/60">Email Address</label>
              <input className="input bg-white/10 border-white/20 text-white placeholder-white/30 focus:border-red-500 focus:bg-white/15"
                type="email" placeholder="you@example.com" value={form.email} onChange={e=>set('email',e.target.value)} required/>
            </div>
            <div>
              <label className="label text-white/60">Password</label>
              <input className="input bg-white/10 border-white/20 text-white placeholder-white/30 focus:border-red-500 focus:bg-white/15"
                type="password" placeholder={tab==='register'?'Min 6 characters':'••••••••'} value={form.password} onChange={e=>set('password',e.target.value)} required minLength={6}/>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 text-base font-display tracking-widest text-lg mt-2 rounded-xl text-white font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{background:'linear-gradient(135deg,#dc2626 0%,#1d4ed8 100%)'}}>
              {loading ? '⏳ Please wait...' : tab==='login' ? '🚀 SIGN IN' : '🎉 CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-6 p-3 rounded-xl text-center border border-white/10"
            style={{background:'rgba(220,38,38,0.1)'}}>
            <p className="text-xs text-white/50 font-raj">First time? Register to host your own live auction room.</p>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6 tracking-widest">CRICKET AUCTION v3 • NODE.JS + MONGODB</p>
      </div>
    </div>
  );
}
