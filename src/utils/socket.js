import { io } from 'socket.io-client';

let socket = null;
let connected = false;

const getSocket = () => {
  if (!socket) {
    const VITE_API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
    socket = io(VITE_API_BASE_URL.replace('/api', ''), {
      path: '/socket.io',
      autoConnect: true,
      auth: { token: localStorage.getItem('auth_token') },
    });
  }
  return socket;
};

export const initializeSocket = async (authToken) => {
  socket = getSocket();

  socket.on('community:post_created', (data) => {
    window.dispatchEvent(new CustomEvent('community:post_created', { detail: data }));
  });

  socket.on('community:post_deleted', (data) => {
    window.dispatchEvent(new CustomEvent('community:post_deleted', { detail: data }));
  });

  socket.on('community:comment_created', (data) => {
    window.dispatchEvent(new CustomEvent('community:comment_created', { detail: data }));
  });

  socket.on('community:reaction', (data) => {
    window.dispatchEvent(new CustomEvent('community:reaction', { detail: data }));
  });

  socket.on('community:club_updated', (data) => {
    window.dispatchEvent(new CustomEvent('community:club_updated', { detail: data }));
  });

  socket.connect();
  return socket;
};

export const joinSchoolCommunity = async (schoolId) => {
  const socket = getSocket();
  socket.emit('community:join', { room: `school:${schoolId}` });
};