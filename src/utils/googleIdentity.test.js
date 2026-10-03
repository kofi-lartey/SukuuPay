import { describe, it, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The Google Identity Services loader.
 *
 * Run with `npm test`.
 *
 * This tests the loader's **caching and failure** behaviour, which is the part that
 * breaks in ways nothing else catches:
 *
 *   - a second `<script>` injection is a second request per mount, and Google refuses
 *     the second `accounts.id.initialize()` on a page — so a user pressing the button
 *     twice signs in twice;
 *   - a rejected loader cached for the life of the tab is a dead button with nothing on
 *     screen saying why, and the only recovery is a reload.
 *
 * Both are pure browser logic with no JSX, so `node --test` can drive them directly
 * against stubbed globals. `import.meta.env?.VITE_GOOGLE_CLIENT_ID` is optional-chained
 * in the module precisely so this is possible outside Vite.
 */

/**
 * A minimal script element that records listeners so a test can fire them.
 *
 * `dataset` is a real object and `remove()` really removes, because the loader now
 * relies on both: it marks a failed tag and removes it so a retry does not adopt a
 * dead element. A stub without those would let the module look correct while the bug
 * it fixes is still present.
 */
const makeScript = (id) => {
  const listeners = {};
  const node = {
    id,
    listeners,
    dataset: {},
    removed: false,
    set src(value) {
      this._src = value;
    },
    get src() {
      return this._src;
    },
    set async(value) {
      this._async = value;
    },
    set defer(value) {
      this._defer = value;
    },
    addEventListener(type, handler) {
      (listeners[type] ||= []).push(handler);
    },
    fire(type) {
      (listeners[type] || []).forEach((handler) => handler({ type }));
    },
    remove() {
      this.removed = true;
    },
  };
  return node;
};

/**
 * Install browser globals, and hand back a way to inspect what the loader did.
 *
 * `head.appendChild` is where the injection is observed, `document.createElement` is
 * where the script element comes from, and `window.google` is where a successful load
 * is simulated — so a test can assert "exactly one script tag" and "the namespace was
 * resolved" independently.
 *
 * Every piece the loader touches has to be here. An earlier version of this stub
 * omitted `createElement`, which made the loader throw *inside* the promise executor
 * before it ever reached `appendChild` — so every test failed on an empty array with
 * an error that pointed nowhere near the missing method.
 */
const installBrowser = () => {
  const injected = [];

  globalThis.window = {
    google: undefined,
    location: { origin: 'http://localhost', pathname: '/login' },
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag !== 'script') throw new Error(`unexpected element: ${tag}`);
      return makeScript(SCRIPT_ID);
    },
    head: {
      appendChild: (node) => {
        injected.push(node);
        globalThis.__lastInjected = node;
      },
    },
    // Mirrors the real DOM: a removed element is no longer findable by id. That is
    // what lets a retry inject a *fresh* tag rather than adopting the dead one.
    getElementById: (id) =>
      injected.find((node) => node.id === id && !node.removed) || null,
  };

  globalThis.__lastInjected = undefined;

  return { injected };
};

let moduleCounter = 0;

/** Mirrors `SCRIPT_ID` in the module under test. */
const SCRIPT_ID = 'sukuupay-google-identity';

/**
 * Import the module with a given client ID.
 *
 * A cache-busting comment is appended to the generated specifier so **every call
 * yields a distinct module instance**. That is not tidiness: the loader keeps a
 * module-level `loader` promise, so two tests sharing an instance share that promise —
 * the second test would be handed the first test's resolved promise, never inject a
 * script, and fail on an assertion about an array that is legitimately empty.
 *
 * This is exactly the property under test (a failure must not be cached), which is
 * why it has to be worked around rather than reasoned about: the caching is correct
 * behaviour and unusable across tests.
 *
 * When `clientId` is `undefined` the real file is imported, which is how the
 * "no bundler, `import.meta.env` absent" path is exercised.
 */
const loadModule = async (clientId) => {
  // `./googleIdentity.js` — this file sits beside its subject.
  const specifier = new URL('./googleIdentity.js', import.meta.url);

  if (clientId === undefined) {
    return import(specifier.href);
  }

  const { readFileSync } = await import('node:fs');
  const source = readFileSync(specifier, 'utf8');

  const patched = source.replace(
    'import.meta.env?.VITE_GOOGLE_CLIENT_ID',
    JSON.stringify(clientId)
  );

  moduleCounter += 1;

  const url =
    `data:text/javascript;base64,${Buffer.from(`${patched}\n// instance ${moduleCounter}`).toString('base64')}`;

  return import(url);
};

describe('the Google Identity loader', () => {
  beforeEach(() => {
    installBrowser();
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  it('resolves to null when no client ID is configured', async () => {
    const mod = await loadModule('');

    assert.equal(mod.isGoogleSignInConfigured(), false);
    // `null`, not a rejection: a deployment without Google sign-in is a normal state,
    // and a rejected promise here would surface as an error on every page load.
    assert.equal(await mod.loadGoogleIdentity(), null);
  });

  it('injects the script exactly once, however many times it is asked', async () => {
    const { injected } = installBrowser();
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');

    const first = mod.loadGoogleIdentity();
    const second = mod.loadGoogleIdentity();
    const third = mod.loadGoogleIdentity();

    // Three concurrent calls, one injection. This is the property that matters: two
    // script tags means two `accounts.id.initialize()` calls, and Google allows one.
    assert.equal(injected.length, 1, 'the in-flight load must be shared, not duplicated');

    // Resolve it so the promises settle rather than leaving a pending assertion.
    globalThis.window.google = { accounts: { id: {} } };
    globalThis.__lastInjected.fire('load');

    assert.ok(await first);
    assert.strictEqual(await second, await third);
  });

  it('resolves the existing namespace without injecting again on a later call', async () => {
    const { injected } = installBrowser();
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');

    const first = mod.loadGoogleIdentity();
    globalThis.window.google = { accounts: { id: { marker: true } } };
    globalThis.__lastInjected.fire('load');
    await first;

    // Second call after the namespace exists — the "already present" branch.
    assert.equal(await mod.loadGoogleIdentity(), globalThis.window.google.accounts.id);
    assert.equal(injected.length, 1, 'no second injection once the namespace is available');
  });

  it('rejects when the script loads but Google is blocked, and says so differently', async () => {
    installBrowser();
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');

    const pending = mod.loadGoogleIdentity();
    // Content-blocker outcome: the script "loads" but the namespace never appears.
    globalThis.window.google = undefined;
    globalThis.__lastInjected.fire('load');

    await assert.rejects(
      pending,
      (error) => {
        // Distinct from a network failure: the fix is in the browser, not the network.
        assert.equal(error.code, 'GOOGLE_BLOCKED');
        assert.match(error.message, /blocked/i);
        return true;
      }
    );
  });

  it('rejects with a retryable code when the script itself fails', async () => {
    installBrowser();
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');

    const pending = mod.loadGoogleIdentity();
    globalThis.__lastInjected.fire('error');

    await assert.rejects(
      pending,
      (error) => {
        assert.equal(error.code, 'GOOGLE_SCRIPT_FAILED');
        return true;
      }
    );
  });

  it('does not cache a failure — a later attempt can retry', async () => {
    const { injected } = installBrowser();
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');

    const failed = mod.loadGoogleIdentity();
    globalThis.__lastInjected.fire('error');
    await assert.rejects(failed);

    // The retry must inject again. A rejection cached for the life of the tab is a
    // dead button whose only recovery is a reload, and nothing on screen says why.
    const retry = mod.loadGoogleIdentity();
    assert.equal(injected.length, 2, 'a failed load must not be cached');

    globalThis.window.google = { accounts: { id: {} } };
    globalThis.__lastInjected.fire('load');
    assert.ok(await retry);
  });
});

describe('a button Google refuses to draw is reported, not left as a hole', () => {
  /**
   * A container that behaves like the real one for the purposes of `renderButton`.
   *
   * `innerHTML` is an accessor that clears `childNodes` on assignment, because that is
   * what a real element does. A plain property would make `element.innerHTML = ''` a
   * no-op, and the "clears a previous button" test would then be asserting that the
   * *module* failed to clear it — when the module is correct and the fixture is not.
   * A stub has to behave like the thing it stands in for or it tests the stub.
   */
  const makeContainer = () => {
    const container = {
      childNodes: [],
      offsetWidth: 320,
      get innerHTML() {
        return container._html || '';
      },
      set innerHTML(value) {
        container._html = value;
        container.childNodes = [];
      },
    };
    return container;
  };

  /** A namespace whose `renderButton` draws nothing — the 403 case. */
  const refusingNamespace = { renderButton: () => {} };

  /** A namespace that draws an iframe, as the real one does. */
  const drawingNamespace = {
    renderButton: (element) => {
      element.childNodes.push({ tagName: 'IFRAME' });
    },
  };

  beforeEach(() => installBrowser());
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
  });

  /**
   * The failure this covers: `accounts.google.com/gsi/button` answers **403** and the
   * console logs `The given client ID is not found` — for a client ID Google does not
   * recognise (wrong project, consent screen not configured, client deleted) *or* for an
   * origin missing from the client's authorized JavaScript origins. `renderButton`
   * returns void, reports nothing, and draws nothing, so the page is left with an empty
   * 320px box. No button, no error, nothing in our own code to explain it.
   */
  test('resolves false when Google draws nothing', async () => {
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');
    globalThis.window.google = { accounts: { id: refusingNamespace } };

    // Namespace present, so no script is injected at all.
    await assert.rejects(
      () => mod.renderGoogleButton(makeContainer()),
      (error) => {
        assert.equal(error.code, 'GOOGLE_RENDER_FAILED');
        // The message has to name the likely cause, because the reader of it is a
        // developer staring at an empty box wondering whether to retry.
        assert.match(error.message, /client ID|consent screen/i);
        // And the origin has to be attached, because that 403 cannot be told apart
        // from an unauthorised origin without it — see googleIdentity.js.
        assert.equal(error.origin, 'http://localhost');
        return true;
      }
    );
  });

  test('resolves true once Google has drawn into the container', async () => {
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');
    globalThis.window.google = { accounts: { id: drawingNamespace } };

    assert.equal(await mod.renderGoogleButton(makeContainer()), true);
  });

  test('clears a previous button so two never stack', async () => {
    const mod = await loadModule('test-client-id.apps.googleusercontent.com');
    globalThis.window.google = { accounts: { id: drawingNamespace } };

    const container = makeContainer();
    container.childNodes.push({ tagName: 'STALE' });

    await mod.renderGoogleButton(container);
    assert.equal(
      container.childNodes.filter((node) => node.tagName === 'STALE').length,
      0,
      'the previous contents must be cleared before drawing'
    );
  });
});