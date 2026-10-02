/**
 * Runner for `console-render.jsx`.
 *
 * The bundle is loaded *after* a minimal browser shim, because `src/services/auth.js`
 * registers a module-level `window.addEventListener('storage', …)` for cross-tab token
 * sync. That is correct in a browser and fatal here, and it is worth naming: it is
 * also why no harness in `.mockcheck/` could import anything that reaches `auth.js`,
 * which is how a page-level runtime crash can survive a green build for weeks.
 *
 * The shim is deliberately minimal. It exists to satisfy module-level side effects at
 * import time; nothing in the harness is allowed to depend on it, because a test that
 * passes because of a fake DOM is worse than no test.
 */
const store = new Map();

const localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
};

globalThis.localStorage = localStorage;
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { pathname: '/admin', href: 'http://localhost/admin', search: '', origin: 'http://localhost' },
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
};
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {}, click: () => {} }),
  body: { appendChild: () => {}, removeChild: () => {} },
  querySelector: () => null,
  documentElement: { style: {} },
};
// Node 22 defines `navigator` as a getter-only global, so it cannot be assigned.
// It is defined rather than replaced, and only the clipboard is added.
if (!globalThis.navigator.clipboard) {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: async () => {} },
    configurable: true,
  });
}

await import('./out-console/console-render.js');