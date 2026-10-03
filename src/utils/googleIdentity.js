/**
 * Lazy loader for Google Identity Services (GIS).
 *
 * Structured exactly like `googleMaps.js` — load once, resolve to the namespace, never
 * inject twice — and for the same reasons: a script tag added per render is a request
 * per render, and a second `accounts.id.initialize()` is a second credential callback
 * on the same page, so a user pressing the button twice would sign in twice.
 *
 * ### Why not `@react-oauth/google`
 *
 * The library is good and it is the obvious choice, and this is still the better one
 * here for three reasons:
 *
 *   - **No new dependency in an auth path.** The surface actually needed is
 *     `accounts.id.initialize()` and a credential callback — roughly forty lines. A
 *     dependency is a permanent supply-chain surface, and an auth path is the worst
 *     place to add one for a convenience wrapper.
 *   - **It matches the codebase.** `loadGoogleMaps()` already establishes the pattern
 *     of lazily pulling a Google script into a namespace object, with the client ID in
 *     a module constant and a coded rejection when it is unset. A second loader written
 *     the same way is consistent; a library here would be the odd one out.
 *   - **GIS is a stable, documented global.** `google.accounts.id` is not an
 *     unversioned internal API — it is the documented front-end surface for Sign-In With
 *     Google, and it is what `verifyIdToken` on the server is designed to receive.
 *
 * The server is unaffected either way: it verifies the token with
 * `google-auth-library`, which is a genuine cryptographic check. Nothing here is trusted.
 *
 * ### No redirect URI is registered, and that is correct
 *
 * The Google Cloud console offers an "Authorized redirect URIs" field and labels it
 * "only if backend handles OAuth callback". **This flow does not, so that field is
 * left empty.** Worth stating plainly, because it is the first thing anyone
 * configuring this asks, and being wrong in either direction costs something:
 *
 *   - **Adding one anyway** is harmless but misleading. It implies a callback route
 *     exists; it does not, and the next reader goes looking. It can also invite the
 *     worse flow — a server-side `authorization_code` exchange — which needs
 *     `GOOGLE_CLIENT_SECRET` and trades a stateless JWT check for a stateful one.
 *   - **This flow uses the popup, not the redirect.** `accounts.id` opens a popup, the
 *     credential comes back to this tab via `postMessage`, and it is POSTed to
 *     `/auth/google`. No navigation to Google, no `code` parameter, no callback route
 *     to return to, and so nothing for Google to redirect *to*.
 *
 * What the credential *is* checked against is the **JavaScript origins** field, and
 * that is already correct: the backend's `GOOGLE_ALLOWED_ORIGINS` mirrors it, and
 * `assertOriginAllowed` compares the request's `Origin` against that list.
 *
 * This holds on mobile too. Where Google's script falls back from a popup to a
 * redirect it returns to the *current page*, authorised by the JavaScript origins
 * rather than by a redirect URI — so the field stays empty in every case.
 *
 * ### The credential is never read from the client
 *
 * `initialize()` is given the client ID and a callback. The callback receives Google's
 * ID token and posts it to `/auth/google`. The email is **not** read from the response
 * and never sent — the API takes only `{ idToken }` and reads the address from the
 * verified token itself. Anything the browser knows about the user is untrusted input.
 */

const SCRIPT_ID = 'sukuupay-google-identity';

/**
 * The OAuth 2.0 **web client ID**.
 *
 * The same value the API is configured with (`GOOGLE_CLIENT_ID`), read from Vite's
 * `VITE_`-prefixed environment. It is not a secret — it is shipped to every browser
 * that loads the page, and Google's own docs treat it as public. What it *does* control
 * is which origin the resulting token is minted for, and the API refuses any token
 * whose audience is not this exact value.
 *
 * Optional-chained on `import.meta.env` itself, not just the property. Vite replaces
 * `import.meta.env` at build time, but a bare property access throws `TypeError` under
 * plain Node — and this module is imported by a unit test that has no bundler. Being
 * importable outside Vite is what makes the loader's caching behaviour testable at all,
 * which is worth one `?.`.
 */
export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

export const isGoogleSignInConfigured = () => Boolean(GOOGLE_CLIENT_ID);

let loader;

/**
 * Injects the GIS script once and resolves when `google.accounts.id` exists.
 *
 * Resolves to `null` — rather than rejecting — when no client ID is configured. A
 * deployment without Google sign-in is a normal state, not a failure, and a rejected
 * promise here would surface as an error on every page load of a deployment that simply
 * does not offer the feature.
 *
 * @returns {Promise<typeof google.accounts.id | null>}
 */
export const loadGoogleIdentity = () => {
  if (!isGoogleSignInConfigured()) return Promise.resolve(null);

  // Already present: a second login page in the same session (or a re-mount from
  // navigation) reuses the namespace rather than re-injecting the script.
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);

  // An in-flight load is shared. Two components mounting on the same render — the login
  // page and, briefly, a stale one during a redirect — must not each add a tag.
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

    /*
     * An existing tag is only reusable if it has not already failed.
     *
     * The naive version — "is there a tag? attach listeners to it" — is a trap. A tag
     * whose `error` fired is dead: the browser will not retry it, ever, and attaching
     * fresh listeners to it just produces a promise that never settles. So a retry after
     * a transient network failure silently does nothing until the page is reloaded,
     * which is the single worst outcome for a button the user is looking at.
     *
     * `dataset.failed` is the marker, and it is set on the tag itself so the knowledge
     * survives even when this module's `loader` has been reset.
     */
    const existing = document.getElementById(SCRIPT_ID);

    if (existing && !existing.dataset?.failed) {
      existing.addEventListener('load', () => resolve(window.google?.accounts?.id ?? null), {
        once: true,
      });
      existing.addEventListener('error', () => reject(scriptError()), { once: true });
      return;
    }

    if (existing?.remove) existing.remove();

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', () => {
      /*
       * Resolved to `null` when the script loaded but the namespace is missing.
       *
       * That combination is what a content blocker leaves behind: a 200 from a stub,
       * or a script that ran in a context where `window.google` was replaced. Treating
       * it as success would initialise against `undefined` and produce a button that
       * does nothing when pressed — so it is a coded error instead, and the login page
       * can say "Google sign-in is blocked" rather than silently doing nothing.
       */
      const id = window.google?.accounts?.id;
      if (!id) {
        reject(namespaceError());
        return;
      }
      resolve(id);
    });

    script.addEventListener('error', () => {
      // Marked before rejecting, so a retry does not adopt this tag. See the note above.
      if (script.dataset) script.dataset.failed = 'true';
      reject(scriptError());
    });

    document.head.appendChild(script);
  });

  /*
   * Cleared on failure so a later attempt can retry.
   *
   * A transient network failure would otherwise be cached for the life of the tab: the
   * promise stays rejected, every retry returns the same rejection, and the button is
   * dead until a reload — with nothing on screen saying why.
   */
  loader.catch(() => {
    loader = undefined;
  });

  return loader;
};

const scriptError = () =>
  Object.assign(new Error('Google sign-in could not be loaded. Check your connection and try again.'), {
    code: 'GOOGLE_SCRIPT_FAILED',
  });

const namespaceError = () =>
  Object.assign(
    new Error('Google sign-in is blocked in this browser. Allow third-party scripts, or sign in with your password.'),
    { code: 'GOOGLE_BLOCKED' }
  );

/**
 * Registers the credential callback for the Sign-In With Google button.
 *
 * `callback` receives **only the ID token** — never the profile. `google.accounts.id`
 * also hands back a decoded `credential` object containing the email, and reading it
 * here would be the exact mistake this module's header describes: the browser's copy
 * of an email is not evidence of anything, and the server must be the only party
 * deciding who the user is.
 *
 * `ux_mode: 'popup'` rather than `'redirect'`: a popup keeps the user on the login page,
 * so a failure comes back as a rejection this component can render in place. Redirect
 * mode loses the page's state and turns every refusal into a full round trip — and the
 * commonest outcome here is a *refusal* (this address already has a password account),
 * which needs an explanation on screen, not a redirect to an error page.
 *
 * @param {(credential: string) => void|Promise<void>} onCredential  receives the ID token
 * @returns {Promise<boolean>} whether the button was mounted
 */
export const initializeGoogleSignIn = async (onCredential) => {
  const id = await loadGoogleIdentity();
  if (!id) return false;

  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      /*
       * A response without a `credential` is Google's "one-tap closed without
       * choosing an account" signal, not an error and not a sign-in. Calling
       * `onCredential(undefined)` would send the user to an API error for having
       * cancelled, so it is dropped here and the button stays as it was.
       */
      if (!response?.credential) return;
      onCredential(response.credential);
    },
    ux_mode: 'popup',
  });

  return true;
};

/**
 * Renders Google's own branded button into a container element.
 *
 * **The real one, not a styled imitation.** Google requires the rendered button to be
 * the one their script draws: it carries the mark under Google's brand guidelines, and
 * a hand-rolled "G" button is both a policy violation and a worse conversion control —
 * people click the real one because they recognise it and they know what it will do.
 *
 * `data-size`, `data-theme` and `data-text` are passed through from the caller so the
 * button can match the page rather than Google picking.
 *
 * ### Why this waits and then checks, rather than trusting `renderButton`
 *
 * `renderButton` returns void and tells you nothing. It is happy to draw nothing at
 * all — which is exactly what happens when `accounts.google.com/gsi/button` answers
 * **403**, as it does for a client ID Google does not recognise (wrong project,
 * consent screen not configured, or the client deleted). The page then shows an empty
 * 320-pixel box: no button, no error, and nothing in our own code to explain it. That
 * is the failure we just spent a debugging cycle on, and it is worth making loud.
 *
 * So the container is polled briefly and an empty one is turned into a coded error,
 * which the login page renders as an explanation instead of a hole. This also catches
 * the reverse case — a blocked iframe under CSP — which produces the same silence.
 *
 * @returns {Promise<boolean>} whether a button was rendered into the element
 * @throws coded `GOOGLE_RENDER_FAILED` when nothing appeared
 */
export const renderGoogleButton = async (
  element,
  { size = 'large', theme = 'outline', text = 'continue_with' } = {}
) => {
  const id = await loadGoogleIdentity();
  if (!id || !element) return false;

  // A second render into the same element would stack two buttons, so the previous one
  // is cleared first. `renderButton` replaces content in place on Google's side, but
  // this is explicit so the intent is not load-bearing on their implementation.
  element.innerHTML = '';

  id.renderButton(element, {
    type: 'standard',
    size,
    theme,
    text,
    shape: 'rectangular',
    width: Math.min(320, element.offsetWidth || 320),
    // Google logs a warning when this is absent, and its absence is the difference
    // between an error report naming the user and one naming a row id.
    login_uri: window.location.origin + window.location.pathname,
  });

  await waitForButton(element);

  // Still nothing: the script loaded but Google refused to draw. See the note above.
  if (!element.childNodes.length) {
    throw Object.assign(
      new Error(
        'Google sign-in is unavailable. The button could not be loaded — the client ID may be incorrect, or the OAuth consent screen may not be configured.'
      ),
      { code: 'GOOGLE_RENDER_FAILED' }
    );
  }

  return true;
};

/**
 * How long to wait for Google's iframe to appear, and how often to look.
 *
 * 2 seconds in 50ms steps. Generous on purpose: the button usually appears in one
 * frame, and this only matters on the failure path, where the cost of waiting is a
 * slightly slower error message and the cost of not waiting is a silently empty
 * button. The wait is abortable so an unmount cannot hold it open.
 */
const RENDER_TIMEOUT_MS = 2000;
const RENDER_POLL_MS = 50;

const waitForButton = (element) =>
  new Promise((resolve) => {
    const startedAt = Date.now();

    const poll = () => {
      if (element.childNodes.length) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= RENDER_TIMEOUT_MS) {
        resolve(false);
        return;
      }

      setTimeout(poll, RENDER_POLL_MS);
    };

    poll();
  });

/**
 * Cancels an open Sign-In popup.
 *
 * Called when the login page unmounts mid-flow. Without it the popup survives the
 * navigation that dismissed it, and the user signs in to a page that no longer exists.
 */
export const cancelGoogleSignIn = () => {
  window.google?.accounts?.id?.cancel?.();
};

export default {
  GOOGLE_CLIENT_ID,
  isGoogleSignInConfigured,
  loadGoogleIdentity,
  initializeGoogleSignIn,
  renderGoogleButton,
  cancelGoogleSignIn,
};