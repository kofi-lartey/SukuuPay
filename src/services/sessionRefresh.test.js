// Run with `npm test` from `frontend/`, on `node --test`.
//
// ## The bug
//
// Saving a class's grades in the teacher portal failed with
// `{"success":false,"message":"Access token expired"}`.
//
// The access token is short-lived — `JWT_EXPIRE` defaults to fifteen minutes
// (`Backend/src/config/env.js`) — and the teacher portal's axios instance
// (`services/teacher/apiClient.js`) attached the token but had no answer to an
// expired one beyond re-throwing the server's message. The platform console's
// client refreshed and replayed; the teacher client, written as a copy of the
// console's *unwrapping* and not of its *auth* behaviour, did not.
//
// So a teacher who took a class's marks down, came back to the grid and
// pressed "Save all grades" found the save impossible, and every mark in the
// column lost to the age of a token.
//
// ## What is held here
//
// The behaviour, not the source text:
//
//   - a 401 refreshes the session and replays the request, so the save lands;
//   - concurrent 401s share **one** refresh, because the refresh token rotates
//     and a race would spend it twice and get the session revoked;
//   - a refresh the server refuses ends the session;
//   - a refresh that never reached the server does **not** end the session,
//     because a dead network is not a revoked session and the marks are still
//     on the screen.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';

/** An in-memory `Storage`, which is all the token layer needs. */
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
};

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
globalThis.window = { location: { pathname: '/teacher/grades/JHS-2A', href: '' } };

// Imported after the globals exist: the clients read `localStorage` on every
// request, and `import.meta.env` is optional-chained precisely so this file
// can import them at all.
const { default: teacherApi } = await import('./teacher/apiClient.js');
const { default: consoleApi } = await import('./api.js');
const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } = await import('./tokenRefresh.js');

/** A resolved axios response, as an adapter returns it. */
const ok = (config, data) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
});

/** A rejected axios response, as an adapter returns it. */
const fail = (config, status, body) => {
  const response = { data: body, status, statusText: 'Error', headers: {}, config };
  return Promise.reject(
    new axios.AxiosError(
      `Request failed with status code ${status}`,
      axios.AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response
    )
  );
};

/**
 * The server's answer to `POST /auth/refresh`.
 *
 * The shape is the real one: `sendAuthResponse` in the backend returns
 * `{ success, message, user, tokens: { accessToken, refreshToken } }`, and the
 * refresh token is **rotated** — the new one replaces the old one on the user
 * document, which is why two refreshes at the same moment cannot both win.
 */
const refreshAnswer = (accessToken = 'fresh-access', refreshToken = 'fresh-refresh') => ({
  success: true,
  message: 'Token refreshed successfully',
  tokens: { accessToken, refreshToken },
});

beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  globalThis.window.location.pathname = '/teacher/grades/JHS-2A';
  globalThis.window.location.href = '';
});

describe('the teacher client refreshes an expired session and replays the save', () => {
  it('lands the grades the teacher asked to save', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'good-refresh');

    const seen = [];
    teacherApi.defaults.adapter = (config) => {
      seen.push(config);
      if (seen.length === 1) {
        return fail(config, 401, { success: false, message: 'Access token expired' });
      }
      return Promise.resolve(ok(config, { success: true, data: { saved: 3 } }));
    };

    let refreshCalls = 0;
    axios.defaults.adapter = (config) => {
      refreshCalls += 1;
      return Promise.resolve(ok(config, refreshAnswer()));
    };

    const response = await teacherApi.post('/teacher/grades/bulk', {
      className: 'JHS 2A',
      term: 'Term 2',
      grades: [{ studentId: 's1', assessmentType: 'exam_score', score: 70 }],
    });

    assert.equal(response.data.saved, 3, 'the save must resolve with the server\'s answer');
    assert.equal(seen.length, 2, 'the request is sent, fails, and is replayed once');
    assert.equal(refreshCalls, 1, 'exactly one refresh');
    assert.equal(
      seen[1].headers.Authorization,
      'Bearer fresh-access',
      'the replay must carry the new access token'
    );
    assert.equal(
      seen[1].data,
      JSON.stringify({
        className: 'JHS 2A',
        term: 'Term 2',
        grades: [{ studentId: 's1', assessmentType: 'exam_score', score: 70 }],
      }),
      'the replay must carry the same marks the teacher entered'
    );
    assert.equal(localStorage.getItem(ACCESS_TOKEN_KEY), 'fresh-access');
    assert.equal(localStorage.getItem(REFRESH_TOKEN_KEY), 'fresh-refresh');
  });

  it('does not loop when the replay is unauthorized too', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'good-refresh');

    let calls = 0;
    teacherApi.defaults.adapter = (config) => {
      calls += 1;
      return fail(config, 401, { success: false, message: 'Access token expired' });
    };

    axios.defaults.adapter = (config) => Promise.resolve(ok(config, refreshAnswer()));

    await assert.rejects(
      teacherApi.post('/teacher/grades/bulk', { className: 'JHS 2A' }),
      /Access token expired/
    );
    assert.equal(calls, 2, 'one attempt, one replay, and no more');
  });
});

describe('the refresh token rotates, so concurrent 401s share one refresh', () => {
  it('refreshes once for two simultaneous failures', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'good-refresh');

    let refreshCalls = 0;
    axios.defaults.adapter = (config) => {
      refreshCalls += 1;
      return Promise.resolve(ok(config, refreshAnswer()));
    };

    let attempts = 0;
    teacherApi.defaults.adapter = (config) => {
      attempts += 1;
      if (attempts <= 2) {
        return fail(config, 401, { success: false, message: 'Access token expired' });
      }
      return Promise.resolve(ok(config, { success: true, data: { ok: true } }));
    };

    const [first, second] = await Promise.all([
      teacherApi.get('/teacher/grades'),
      teacherApi.post('/teacher/grades/bulk', { className: 'JHS 2A' }),
    ]);

    assert.equal(refreshCalls, 1, 'the rotating refresh token must only be spent once');
    assert.equal(first.data.ok, true);
    assert.equal(second.data.ok, true);
  });
});

describe('what ends a session, and what does not', () => {
  it('ends the session when the server refuses the refresh token', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'revoked-refresh');

    teacherApi.defaults.adapter = (config) =>
      fail(config, 401, { success: false, message: 'Access token expired' });

    axios.defaults.adapter = (config) =>
      fail(config, 401, { success: false, message: 'Session has been revoked' });

    await assert.rejects(
      teacherApi.post('/teacher/grades/bulk', { className: 'JHS 2A' }),
      /Session has been revoked/
    );

    assert.equal(localStorage.getItem(ACCESS_TOKEN_KEY), null);
    assert.equal(localStorage.getItem(REFRESH_TOKEN_KEY), null);
    assert.equal(window.location.href, '/login', 'the browser goes back to the login page');
  });

  it('keeps the session when the refresh never reached the server', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'good-refresh');

    teacherApi.defaults.adapter = (config) =>
      fail(config, 401, { success: false, message: 'Access token expired' });

    axios.defaults.adapter = () =>
      Promise.reject(new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK));

    await assert.rejects(teacherApi.post('/teacher/grades/bulk', { className: 'JHS 2A' }));

    assert.equal(
      localStorage.getItem(ACCESS_TOKEN_KEY),
      'expired-access',
      'a dead network is not a revoked session — the marks are still on the screen'
    );
    assert.equal(localStorage.getItem(REFRESH_TOKEN_KEY), 'good-refresh');
    assert.notEqual(window.location.href, '/login');
  });
});

describe('the platform console client refreshes the same way', () => {
  it('replays the original request with the new token', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'good-refresh');

    const seen = [];
    consoleApi.defaults.adapter = (config) => {
      seen.push(config);
      if (seen.length === 1) {
        return fail(config, 401, { success: false, message: 'Access token expired' });
      }
      return Promise.resolve(ok(config, { success: true, data: { ok: true } }));
    };

    axios.defaults.adapter = (config) => Promise.resolve(ok(config, refreshAnswer()));

    const response = await consoleApi.get('/schools/me');

    assert.equal(response.data.data.ok, true);
    assert.equal(seen.length, 2);
    assert.equal(seen[1].headers.Authorization, 'Bearer fresh-access');
  });
});
