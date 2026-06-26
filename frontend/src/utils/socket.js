import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// FIX: old code destroyed + recreated the socket any time `.connected` was
// false — but a BRAND NEW socket is also `connected: false` while it's still
// mid-handshake. So calling getSocket() twice in quick succession (e.g. the
// join-room effect re-running + the manual 'auction-resumed' emit, which both
// fire together right when you hit Resume) could disconnect an in-flight
// socket and replace it with a new one — dropping the queued emit AND
// orphaning every listener (bid-update, next-player, player-result, etc.)
// that was registered on the old instance. That's why actions stopped
// reaching the live link specifically after a pause → resume.
//
// Fix: keep ONE socket instance for the app's life. Just reconnect it
// (socket.io's own `reconnection` option already retries on drops) instead
// of tearing it down and rebuilding — so listeners and queued emits survive.
export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });
  } else if (socket.disconnected) {
    socket.connect();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

export default getSocket;