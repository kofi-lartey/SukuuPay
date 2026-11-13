/**
 * Minimal flat config, scoped to the community chat surface.
 *
 * The bug this exists to prevent is a component used without being imported:
 * `<Bubble>` at ClubChat.jsx:251 with no `import Bubble`. Nothing caught it —
 * `vite build` does not, because esbuild leaves an unresolved identifier in place
 * and it only fails at runtime, inside an ErrorBoundary, as "Bubble is not
 * defined". Finding the file then means reading a component stack by hand.
 *
 * So this enables the rules that catch that class and nothing else: `no-undef`
 * for the missing binding, `no-dupe-keys` for the twin that produces the same
 * confusing runtime shape. No style rules — that is a separate argument and a
 * much larger diff.
 *
 * ## Why the scope is narrow
 *
 * Running this across `src` reports 35 pre-existing errors, and most of them are
 * not `no-undef` at all: fifteen are `eslint-disable-next-line
 * react-hooks/exhaustive-deps` comments naming a rule whose plugin is not
 * installed, which ESLint treats as "definition for rule not found". A config
 * that fails on the first run gets deleted, so it is pointed at the area it was
 * written for. The genuine findings it surfaced elsewhere are recorded in the
 * final report rather than buried under plugin noise.
 *
 * Browser globals are listed inline rather than imported from the `globals`
 * package, because adding a dependency to make a linter run is a worse trade than
 * a list that occasionally needs a line added. When `no-undef` names a real
 * browser API, add it here.
 */
const browserGlobals = {
  AbortController: 'readonly',
  alert: 'readonly',
  atob: 'readonly',
  Audio: 'readonly',
  Blob: 'readonly',
  btoa: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  confirm: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
  CustomEvent: 'readonly',
  document: 'readonly',
  Event: 'readonly',
  fetch: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  getComputedStyle: 'readonly',
  history: 'readonly',
  HTMLElement: 'readonly',
  Image: 'readonly',
  IntersectionObserver: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  matchMedia: 'readonly',
  MediaRecorder: 'readonly',
  MutationObserver: 'readonly',
  navigator: 'readonly',
  Node: 'readonly',
  Notification: 'readonly',
  performance: 'readonly',
  prompt: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  RTCPeerConnection: 'readonly',
  screen: 'readonly',
  sessionStorage: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  WebSocket: 'readonly',
  window: 'readonly',
};

export default [
  {
    files: ['src/components/community/**/*.{js,jsx}', 'src/components/common/Avatar.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: browserGlobals,
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
    },
  },
];