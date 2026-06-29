require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const { Server } = require('socket.io');
const connectDB  = require('./config/db');

const app    = express();
const server = http.createServer(app);
const protect = require('./middleware/auth');
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET','POST','PUT','PATCH','DELETE'] },
});

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));   // 10mb for base64 photos
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// if (process.env.NODE_ENV === 'development') {
//   app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });
// }

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/rooms',   require('./routes/rooms'));
app.use('/api/teams',   require('./routes/teams'));
app.use('/api/players', require('./routes/players'));
app.use('/api/player-requests', require('./routes/playerRequests'));
app.use('/api/admin', protect, require('./middleware/adminOnly'), require('./routes/admin'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

// ── Socket.IO ──────────────────────────────────────────────
const roomTimers = {};
const roomStates = {};

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    if (roomStates[roomId]) socket.emit('room-state', roomStates[roomId]);
  });
  socket.on('place-bid', ({ roomId, teamId, teamName, amount }) => {
    const s = roomStates[roomId] || {};
    s.currentBid = amount; s.currentBidder = { id: teamId, name: teamName };
    roomStates[roomId] = s;
    io.to(roomId).emit('bid-update', { currentBid: amount, currentBidder: s.currentBidder });
    restartTimer(roomId, s.timerSeconds || 30, io);
  });
  socket.on('start-timer',  ({ roomId, seconds }) => { (roomStates[roomId] = roomStates[roomId] || {}).timerSeconds = seconds; restartTimer(roomId, seconds, io); });
  socket.on('stop-timer',   ({ roomId }) => { clearRoomTimer(roomId); io.to(roomId).emit('timer-stopped'); });
  socket.on('update-room-state', ({ roomId, data }) => { roomStates[roomId] = { ...roomStates[roomId], ...data }; socket.to(roomId).emit('room-state', roomStates[roomId]); });
  socket.on('player-result',  ({ roomId, result }) => { clearRoomTimer(roomId); io.to(roomId).emit('player-result', result); });
  socket.on('next-player',    ({ roomId, player }) => io.to(roomId).emit('next-player', player));
  socket.on('auction-paused', ({ roomId }) => { clearRoomTimer(roomId); io.to(roomId).emit('auction-paused'); });
  socket.on('auction-resumed',({ roomId }) => io.to(roomId).emit('auction-resumed'));
   // Admin dashboard made a live correction (price fix / sent player back to pool)
   socket.on('admin-update',   ({ roomId }) => io.to(roomId).emit('admin-update'));
   socket.on('disconnect', () => {});
});

function clearRoomTimer(roomId) {
  if (roomTimers[roomId]) { clearInterval(roomTimers[roomId].interval); delete roomTimers[roomId]; }
}
function restartTimer(roomId, seconds, io) {
  clearRoomTimer(roomId);
  let rem = seconds;
  io.to(roomId).emit('timer-tick', { remaining: rem });
  const interval = setInterval(() => {
    rem--;
    io.to(roomId).emit('timer-tick', { remaining: rem });
    if (rem <= 0) { clearRoomTimer(roomId); io.to(roomId).emit('timer-expired'); }
  }, 1000);
  roomTimers[roomId] = { interval, remaining: rem };
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 Server: http://localhost:${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌍 Env: ${process.env.NODE_ENV}\n`);
});
