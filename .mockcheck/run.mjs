// Node shims for the browser globals the mock adapter and handlers touch.
// Everything else (FormData, File, Blob, fetch) is native in Node 18+.
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
  location: { href: 'http://localhost:5173/', pathname: '/onboarding' },
};

globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  body: { style: {}, appendChild() {} },
  createElement: () => ({ style: {}, click() {}, remove() {}, setAttribute() {} }),
};

// uploadSchoolLogo reads the picked file with FileReader to build a data URL.
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
      this.onload?.();
    });
  }
};

const banner = { setAttribute() {}, style: {}, textContent: '' };
globalThis.document.createElement = () => ({
  style: {},
  click() {},
  remove() {},
  setAttribute() {},
  get textContent() { return ''; },
  set textContent(v) { /* banner is inert under Node */ },
});
globalThis.document.body.appendChild = () => {};

await import('./out/entry.js');
