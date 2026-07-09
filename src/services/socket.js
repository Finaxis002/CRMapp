import { io } from 'socket.io-client';
import { BASE_URL } from '../config';
let socket = null;

export const initSocket = (userId) => {
  if (socket?.connected) return socket;

  socket = io(BASE_URL, {
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log('Mobile socket connected:', socket.id);
    socket.emit('join-user-room', userId);
  });

  socket.on('disconnect', () => {
    console.log('Mobile socket disconnected');
  });

  return socket;
};

export const getSocket = () => socket;