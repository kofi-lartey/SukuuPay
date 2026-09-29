import api from './api';

const TOKEN_KEYS = ['auth_token', 'refresh_token'];

const storeTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) localStorage.setItem('auth_token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
};

const clearTokens = () => TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));

/** Axios rejects with a plain `message`; the API also returns a structured body. */
const toError = (error, fallback) => {
  const message = error?.response?.data?.message || error?.message;
  const wrapped = new Error(message || fallback);
  wrapped.status = error?.response?.status;
  wrapped.code = error?.response?.data?.code;
  return wrapped;
};

export const login = async (email, password) => {
  try {
    const { data } = await api.post('/auth/login', { email, password });
    storeTokens(data.tokens || {});
    return { user: data.user, message: data.message };
  } catch (error) {
    throw toError(error, 'Invalid email or password');
  }
};

/**
 * The API issues no session on signup — the account must verify its email first.
 * Returns the created user plus the verification metadata for the next screen.
 *
 * Throws on a genuine failure (validation, duplicate email, a dead network).
 * One case is not a failure: the account is created but the verification email
 * could not be sent, which the API reports as 502 / `EMAIL_SEND_FAILED`. That
 * returns normally with `partial: true` so the caller can route the user to the
 * resend screen instead of showing them a form for an account they already own.
 * Rethrowing it as a plain error is what strands users on a dead-end form.
 */
export const signup = async (payload) => {
  try {
    const { data } = await api.post('/auth/signup', payload);
    return { user: data.user, verification: data.verification, message: data.message };
  } catch (error) {
    if (error?.response?.data?.code === 'EMAIL_SEND_FAILED') {
      return {
        user: null,
        verification: null,
        message: error.response.data.message,
        partial: true,
        emailSent: false,
      };
    }
    throw toError(error, 'Failed to create account. Please try again.');
  }
};

export const signOutUser = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // A failed logout must never trap the user in a signed-in shell.
  } finally {
    clearTokens();
  }
};

export const verifyEmail = async (token) => {
  try {
    const { data } = await api.post(`/auth/verify-email/${token}`);
    storeTokens(data.tokens || {});
    return data;
  } catch (error) {
    throw toError(error, 'This verification code is invalid');
  }
};

export const resendVerificationEmail = async (email) => {
  try {
    const { data } = await api.post('/auth/resend-verification', { email });
    return data;
  } catch (error) {
    throw toError(error, 'Failed to send verification email.');
  }
};

export const requestPasswordReset = async (email) => {
  try {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  } catch (error) {
    throw toError(error, 'Failed to request a password reset.');
  }
};

export const resetPassword = async (token, password) => {
  try {
    const { data } = await api.post(`/auth/reset-password/${token}`, { password });
    return data;
  } catch (error) {
    throw toError(error, 'Failed to reset your password.');
  }
};

export const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me');
  return data.user;
};

// ── Auth state listener using localStorage ──────────────────────────────
let authListeners = [];

const notifyListeners = (user) => {
  authListeners.forEach((listener) => listener(user));
};

export const onAuthChange = (callback) => {
  authListeners.push(callback);

  const token = localStorage.getItem('auth_token');
  if (token) {
    getCurrentUser()
      .then((user) => notifyListeners(user))
      .catch(() => {
        clearTokens();
        notifyListeners(null);
      });
  } else {
    notifyListeners(null);
  }

  return () => {
    authListeners = authListeners.filter((listener) => listener !== callback);
  };
};

// Manual auth state update for cross-tab sync
window.addEventListener('storage', (event) => {
  if (!TOKEN_KEYS.includes(event.key)) return;

  const token = localStorage.getItem('auth_token');
  if (token) {
    getCurrentUser()
      .then((user) => notifyListeners(user))
      .catch(() => notifyListeners(null));
  } else {
    notifyListeners(null);
  }
});
