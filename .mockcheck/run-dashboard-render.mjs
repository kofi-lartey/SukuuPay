// Node shims for the browser globals the dashboard shell touches during SSR.
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
  location: { href: 'http://localhost:5173/dashboard', pathname: '/dashboard' },
};

globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  body: { style: {}, appendChild() {} },
  createElement: () => ({ style: {}, click() {}, remove() {}, setAttribute: () => {}, textContent: '' }),
  documentElement: { style: {} },
  head: { appendChild() {} },
};

await import('./out-dashboard/dashboard-render.js');
