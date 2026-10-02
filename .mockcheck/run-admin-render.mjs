// Node shims for the browser globals the platform console shell touches during
// SSR. Same set as the dashboard harness, and the same reason: `AdminLayout` reads
// `window.matchMedia` for the scroll reset and `document.documentElement` to
// suppress `scroll-behavior: smooth`, and `Popover`/the drawer both need
// `addEventListener` to exist.
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
  location: { href: 'http://localhost:5173/admin', pathname: '/admin' },
};

globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  body: { style: {}, appendChild() {} },
  createElement: () => ({ style: {}, click() {}, remove() {}, setAttribute: () => {}, textContent: '' }),
  documentElement: { style: {} },
  head: { appendChild() {} },
};

await import('./out-admin/admin-render.js');