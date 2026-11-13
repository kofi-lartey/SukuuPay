import { io } from 'socket.io-client';

let socket = null;
let socketToken = null;

const resolveSocketUrl = () => {
  const VITE_API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
  return VITE_API_BASE_URL.replace(/\/api\/?$/, '');
};

const emitToWindow = (name, detail) => {
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const bindCommunityEvents = (instance) => {
  instance.on('community:post_created', (data) => emitToWindow('community:post_created', data));
  instance.on('community:post_deleted', (data) => emitToWindow('community:post_deleted', data));
  instance.on('community:comment_created', (data) => emitToWindow('community:comment_created', data));
  instance.on('community:reaction', (data) => emitToWindow('community:reaction', data));
  instance.on('community:club_updated', (data) => emitToWindow('community:club_updated', data));
};

/**
 * The token a socket should authenticate with.
 *
 * Reads the same key `services/api.js` sends on HTTP requests, with the same
 * `sessionStorage` fallback, so a socket can never disagree with the REST client
 * about who the user is. `authToken` is preferred when the caller already has it.
 */
const readToken = () => {
  try {
    return (
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token') ||
      null
    );
  } catch {
    // Storage throws in a blocked-cookie or sandboxed iframe context.
    return null;
  }
};

/**
 * Returns the shared socket, rebuilding it when the credential changed.
 *
 * A socket authenticates once, at handshake, and the gateway disconnects any
 * connection whose token does not resolve. The previous implementation cached
 * the first socket forever, so a socket created before login — or one that
 * predates a token refresh or an impersonation swap — kept the old credential
 * and was silently dropped from every community room. Reusing it left the feed
 * quietly stale with nothing in the console to explain why.
 */
const getSocket = (authToken) => {
  const token = authToken || readToken();

  if (socket && socketToken === token) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
  }

  socketToken = token;
  socket = io(resolveSocketUrl(), {
    path: '/socket.io',
    autoConnect: true,
    auth: { token },
  });
  bindCommunityEvents(socket);

  return socket;
};

export const initializeSocket = async (authToken) => {
  const instance = getSocket(authToken);

  instance.connect();
  return instance;
};

export const joinSchoolCommunity = async (schoolId) => {
  const instance = getSocket();
  // The gateway derives the room from the authenticated principal and ignores a
  // client-named room for everyone but a super_admin. The emit stays because it
  // is what asks the server to place this socket in its own school's room.
  instance.emit('community:join', { room: `school:${schoolId}` });
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  socketToken = null;
};