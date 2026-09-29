// Node shims for the browser globals the auth pages touch during SSR.
globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
  setItem(k, v) { this._s.set(k, String(v)); },
  removeItem(k) { this._s.delete(k); },
  clear() { this._s.clear(); },
};

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false }),
  location: { href: 'http://localhost:5173/verify-email', pathname: '/verify-email' },
};

globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  body: { style: {}, appendChild() {} },
  createElement: () => ({ style: {}, click() {}, remove() {}, setAttribute: () => {}, textContent: '' }),
  documentElement: { style: {} },
  head: { appendChild() {} },
};

await import('./out-auth/auth-render.js');
