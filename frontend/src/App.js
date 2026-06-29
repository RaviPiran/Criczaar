import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuctionProvider, useAuction } from './context/AuctionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Tournaments from './pages/Tournaments';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import Auction from './pages/Auction';
import Teams from './pages/Teams';
import Players from './pages/Players';
import Retentions from './pages/Retentions';
import BidRules from './pages/BidRules';
import Results from './pages/Results';
import { getFullRoom } from './utils/api';
import PlayerRegister  from './pages/PlayerRegister';
import LiveSpectator   from './pages/LiveSpectator';
import PlayerRequests  from './pages/PlayerRequests';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

const RehydrateContext = createContext(false);
export const useRehydrated = () => useContext(RehydrateContext);

function RoomRehydrator({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { state, dispatch }            = useAuction();
  const [rehydrated, setRehydrated]    = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRehydrated(true); return; }
    const roomId = state.room?._id;
    if (!roomId) { setRehydrated(true); return; }
    getFullRoom(roomId)
      .then(({ data }) => { dispatch({ type: 'SET_FULL_DATA', payload: data.data }); })
      .catch(() => { dispatch({ type: 'RESET' }); })
      .finally(() => setRehydrated(true));
  }, [user, authLoading]);

  return (
    <RehydrateContext.Provider value={rehydrated}>
      {children}
    </RehydrateContext.Provider>
  );
}

function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const rehydrated = useRehydrated();
  if (authLoading || !rehydrated) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/tournaments" replace />;
  return children;
}

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="text-5xl animate-swing inline-block" style={{ transformOrigin: 'bottom center' }}>🏏</div>
      <p className="font-orbitron text-amber-500 text-sm tracking-widest animate-pulse-slow">LOADING...</p>
    </div>
  </div>
);

function ProtectedRoute({ children, noLayout = false }) {
  const { user, loading: authLoading } = useAuth();
  const rehydrated = useRehydrated();
  if (authLoading || !rehydrated) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (noLayout) return children;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login"       element={user ? <Navigate to="/tournaments" replace /> : <Login />} />
      {/* Tournament home — full screen, no sidebar layout */}
      <Route path="/tournaments" element={<ProtectedRoute noLayout><Tournaments /></ProtectedRoute>} />
      {/* All auction pages — with sidebar layout */}
      <Route path="/dashboard"   element={<ProtectedRoute><Dashboard  /></ProtectedRoute>} />
      <Route path="/setup"       element={<ProtectedRoute><Setup      /></ProtectedRoute>} />
      <Route path="/auction"     element={<ProtectedRoute><Auction    /></ProtectedRoute>} />
      <Route path="/teams"       element={<ProtectedRoute><Teams      /></ProtectedRoute>} />
      <Route path="/players"     element={<ProtectedRoute><Players    /></ProtectedRoute>} />
      <Route path="/retentions"  element={<ProtectedRoute><Retentions /></ProtectedRoute>} />
      <Route path="/player-requests" element={<ProtectedRoute><PlayerRequests /></ProtectedRoute>} />
      <Route path="/bid-rules"   element={<ProtectedRoute><BidRules   /></ProtectedRoute>} />
      <Route path="/results"     element={<ProtectedRoute><Results    /></ProtectedRoute>} />
      <Route path="/register/:roomCode" element={<PlayerRegister />} />
      <Route path="/live/:roomCode"     element={<LiveSpectator />} />
      <Route path="*"            element={<Navigate to={user ? '/tournaments' : '/login'} replace />} />
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuctionProvider>
        <BrowserRouter>
          <RoomRehydrator>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background:  '#ffffff', color: '#1a202c',
                  border:      '1px solid #fbbf24',
                  boxShadow:   '0 4px 20px rgba(0,0,0,0.08)',
                  fontFamily:  "'Rajdhani', sans-serif",
                  fontSize:    '1rem', fontWeight: 600,
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </RoomRehydrator>
        </BrowserRouter>
      </AuctionProvider>
    </AuthProvider>
  );
}