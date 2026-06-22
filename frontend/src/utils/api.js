import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject token
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('ca_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Auth
export const loginAPI    = (d) => API.post('/auth/login', d);
export const registerAPI = (d) => API.post('/auth/register', d);
export const getMeAPI    = ()  => API.get('/auth/me');

// Rooms
export const createRoom       = (d) => API.post('/rooms', d);
export const getRoomByCode    = (c) => API.get(`/rooms/${c}`);
export const getFullRoom      = (id)=> API.get(`/rooms/${id}/full`);
export const getUserRooms     = ()  => API.get('/rooms/user/all');
export const startRound2      = (id) => API.post(`/rooms/${id}/round2`);
export const updateRoomStatus = (id, status) => API.patch(`/rooms/${id}/status`, { status });
export const completeAuction  = (id) => API.patch(`/rooms/${id}/status`, { status: 'completed' });
export const nextPlayer       = (id, body={})=> API.post(`/rooms/${id}/next-player`, body);
export const placeBidAPI      = (id, d) => API.post(`/rooms/${id}/bid`, d);
export const sellPlayer       = (id, d) => API.post(`/rooms/${id}/sell`, d);
export const markUnsoldAPI    = (id)=> API.post(`/rooms/${id}/unsold`);
export const retainPlayerAPI  = (id, d) => API.post(`/rooms/${id}/retain`, d);
export const releaseRetention = (id, playerId) => API.delete(`/rooms/${id}/retain/${playerId}`);
export const pickUnsoldPlayer = (id, d) => API.post(`/rooms/${id}/pick-unsold`, d);

// Teams
export const createTeam    = (d)  => API.post('/teams', d);
export const getTeamsByRoom= (rid)=> API.get(`/teams/room/${rid}`);
export const updateTeam    = (id,d)=> API.put(`/teams/${id}`, d);
export const deleteTeam    = (id) => API.delete(`/teams/${id}`);

// Players
export const createPlayer    = (d)  => API.post('/players', d);
export const bulkCreate      = (d)  => API.post('/players/bulk', d);
export const getPlayersByRoom= (rid,p)=> API.get(`/players/room/${rid}`, { params: p });
export const updatePlayer    = (id,d)=> API.put(`/players/${id}`, d);
export const deletePlayer    = (id) => API.delete(`/players/${id}`);

export default API;