import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

const AuctionContext = createContext();
const STORAGE_KEY = 'ca_auction_state';

const initialState = {
  room:          null,
  teams:         [],
  players:       [],
  currentPlayer: null,
  currentBid:    0,
  currentBidder: null,
  loading:       false,
  error:         null,
};

function persist(state) {
  // FIX: Only persist if there is actually a room loaded — never persist empty state.
  // This prevents an empty object {} from being saved which was causing stale data
  // to appear to be "truthy" on next boot.
  if (!state.room) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      room:          state.room,
      teams:         state.teams,
      players:       state.players,
      currentPlayer: state.currentPlayer,
      currentBid:    state.currentBid,
      currentBidder: state.currentBidder,
    }));
  } catch (_) {}
}

function loadFromStorage() {
  // FIX: Only restore from storage if BOTH a token AND saved room exist.
  // If the user logged out, the token is gone — don't restore stale room data.
  const hasToken = !!localStorage.getItem('ca_token');
  if (!hasToken) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only return if it has an actual room — not an empty/null object
    if (!parsed || !parsed.room) return null;
    return parsed;
  } catch { return null; }
}

function reducer(state, action) {
  let next = state;
  switch (action.type) {
    case 'SET_LOADING': next = { ...state, loading: action.payload }; break;
    case 'SET_ERROR':   next = { ...state, error: action.payload, loading: false }; break;

    case 'SET_ROOM':
      next = {
        ...state,
        room:          action.payload,
        currentPlayer: action.payload?.currentPlayer ?? state.currentPlayer,
        currentBid:    action.payload?.currentBid    ?? state.currentBid,
        currentBidder: action.payload?.currentBidder ?? state.currentBidder,
        loading: false,
      };
      break;

    case 'SET_FULL_DATA':
      next = {
        ...state,
        room:          action.payload.room,
        teams:         action.payload.teams   || [],
        players:       action.payload.players || [],
        currentPlayer: action.payload.room?.currentPlayer || null,
        currentBid:    action.payload.room?.currentBid    || 0,
        currentBidder: action.payload.room?.currentBidder || null,
        loading: false,
      };
      break;

    case 'SET_CURRENT_PLAYER':
      next = { ...state, currentPlayer: action.payload, currentBid: action.payload?.basePrice || 0, currentBidder: null };
      break;

    case 'UPDATE_BID':
      next = { ...state, currentBid: action.payload.amount, currentBidder: action.payload.bidder };
      break;

    case 'UPDATE_TEAMS':   next = { ...state, teams: action.payload };   break;
    case 'UPDATE_PLAYERS': next = { ...state, players: action.payload }; break;

    case 'PLAYER_SOLD': {
      const { playerId, teamId, price } = action.payload;
      const soldPlayer = state.players.find(p => p._id === playerId);
      const updatedPlayers = state.players.map(p =>
        p._id === playerId ? { ...p, status: 'sold', soldTo: teamId, soldPrice: price } : p
      );
      const updatedTeams = state.teams.map(t => {
        if (t._id !== teamId) return t;
        return {
          ...t,
          budgetLeft: Math.round((t.budgetLeft - price) * 10) / 10,
          players: [...(t.players || []), { player: soldPlayer, soldPrice: price, isRetained: false }],
        };
      });
      next = { ...state, players: updatedPlayers, teams: updatedTeams, currentPlayer: null, currentBid: 0, currentBidder: null };
      break;
    }

    case 'PLAYER_UNSOLD': {
      next = {
        ...state,
        players: state.players.map(p => p._id === action.payload ? { ...p, status: 'unsold' } : p),
        currentPlayer: null, currentBid: 0, currentBidder: null,
      };
      break;
    }

    case 'PICK_UNSOLD': {
      const { playerId, teamId, price } = action.payload;
      const pickedPlayer = state.players.find(p => p._id === playerId);
      const updatedPlayers = state.players.map(p =>
        p._id === playerId ? { ...p, status: 'sold', soldTo: teamId, soldPrice: price } : p
      );
      const updatedTeams = state.teams.map(t => {
        if (t._id !== teamId) return t;
        return {
          ...t,
          budgetLeft: Math.round((t.budgetLeft - price) * 10) / 10,
          players: [...(t.players || []), { player: pickedPlayer, soldPrice: price, isRetained: false }],
        };
      });
      next = { ...state, players: updatedPlayers, teams: updatedTeams };
      break;
    }

    // FIX: Separate action for retention — sets status:'retained' and isRetained:true
    // so the player immediately appears in the retainedPlayers list in Retentions.jsx
    case 'RETAIN_PLAYER': {
      const { playerId, teamId, price } = action.payload;
      const retainedPlayer = state.players.find(p => p._id === playerId);
      const updatedPlayers = state.players.map(p =>
        p._id === playerId
          ? { ...p, status: 'retained', isRetained: true, retainedBy: teamId, retainPrice: price, soldTo: teamId, soldPrice: price }
          : p
      );
      const updatedTeams = state.teams.map(t => {
        if (t._id !== teamId) return t;
        return {
          ...t,
          budgetLeft: Math.round((t.budgetLeft - price) * 10) / 10,
          players: [...(t.players || []), { player: retainedPlayer, soldPrice: price, isRetained: true }],
        };
      });
      next = { ...state, players: updatedPlayers, teams: updatedTeams };
      break;
    }

    case 'RESET':
      localStorage.removeItem(STORAGE_KEY);
      return initialState; // early return — skip persist() below

    default: return state;
  }
  persist(next);
  return next;
}

export const AuctionProvider = ({ children }) => {
  // FIX: loadFromStorage() now checks for token — returns null if no token exists.
  // This means on a fresh login the state always starts clean.
  const saved = loadFromStorage();
  const boot  = saved
    ? { ...initialState, ...saved, teams: saved.teams || [], players: saved.players || [] }
    : initialState;

  const [state, dispatch] = useReducer(reducer, boot);

  // Listen for logout event and wipe all state + storage
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: 'RESET' });
    };
    window.addEventListener('criczaar-logout', handler);
    return () => window.removeEventListener('criczaar-logout', handler);
  }, []);

  const setLoading = useCallback(val => dispatch({ type: 'SET_LOADING', payload: val }), []);
  const setError   = useCallback(msg => dispatch({ type: 'SET_ERROR',   payload: msg }), []);

  return (
    <AuctionContext.Provider value={{ state, dispatch, setLoading, setError }}>
      {children}
    </AuctionContext.Provider>
  );
};

export const useAuction = () => {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error('useAuction must be used within AuctionProvider');
  return ctx;
};