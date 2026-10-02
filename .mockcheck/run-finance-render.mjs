// Node shims for the browser globals the finance section touches during SSR.
//
// Same set and same reason as `run-admin-render.mjs`: `services/api.js` and
// `hooks/useImpersonation.js` both register listeners at module scope, and the
// ledger export path reads `localStorage` for the auth token — so all three have
// to exist before the module graph is imported, or the harness dies on
// `window is not defined` before a single check runs.
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
  location: { href: 'http://localhost:5173/admin/finance', pathname: '/admin/finance' },
};

globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  // `nodeType: 1` is load-bearing. `Modal` portals to `document.body`, and React's
  // `createPortal` rejects anything without a `nodeType` — so without this every
  // dialog assertion dies on "Target container is not a DOM element" instead of on
  // what the dialog says.
  body: { nodeType: 1, style: {}, appendChild() {}, removeChild() {} },
  createElement: () => ({
    nodeType: 1,
    style: {},
    click() {},
    remove() {},
    setAttribute: () => {},
    textContent: '',
    href: '',
    download: '',
    rel: '',
  }),
  documentElement: { style: {} },
  head: { appendChild() {} },
};

globalThis.URL.createObjectURL = () => 'blob:mock';
globalThis.URL.revokeObjectURL = () => {};

/*
 * React's SSR build warns on every `useLayoutEffect` it hits, which comes from
 * `react-router`'s own internals and not from anything in this section. Left in,
 * ~200 lines of stack trace drown the actual results — so it is filtered to
 * exactly that warning and nothing else. Any *other* console.error still prints,
 * which is the part that matters.
 */
const realError = console.error;
console.error = (...args) => {
  const first = String(args[0] || '');
  if (first.includes('useLayoutEffect does nothing on the server')) return;
  realError(...args);
};

await import('./out-finance/finance-render.js');
