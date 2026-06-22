import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// BUG FIX #10: Previous socket was never reconnected after disconnect.
// Now we check connected state and reconnect if needed.
export const getSocket = () => {
  if (!socket || !socket.connected) {
    if (socket) socket.disconnect();
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

export default getSocket;
