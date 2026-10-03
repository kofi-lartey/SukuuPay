import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import {
  cancelGoogleSignIn,
  initializeGoogleSignIn,
  renderGoogleButton,
} from '../../utils/googleIdentity';
import { GoogleMark, OrDivider } from './OnboardingAside';

/**
 * "Continue with Google" on the login or signup form.
 *
 * ### It renders nothing when the deployment has not enabled it
 *
 * `GET /auth/google/config` decides, and the button is absent rather than disabled.
 * A greyed-out button on every login page of a deployment that does not offer Google
 * is a question every user has to answer and nobody can, so the control simply does not
 * exist. The divider above it goes with it — an "or" between one option and nothing
 * is worse than no divider.
 *
 * ### The rendered button is Google's, not ours
 *
 * `google.accounts.id.renderButton` draws a real branded button. A styled `<button>`
 * with our own "G" would be a brand-guidelines violation and, more practically, a
 * worse one: users recognise and trust the genuine control. The `GoogleMark` below is
 * the **fallback** — what shows when the script is blocked — and saying so is the point,
 * because a dead-looking button that does nothing on press is the worst outcome.
 *
 * ### `variant` is the difference between the two pages
 *
 * On **login** the promise is "sign in" — the account exists. On **signup** it is
 * "create an account", and it creates a much smaller one: Google supplies a name and
 * a verified email, and nothing else. No phone, no role, no school. So the note below
 * says what happens next, because a user who picked Google over a nine-field form is
 * expecting a short path and will otherwise meet the onboarding wizard unsure why.
 *
 * ### Errors render on the form, not in a dialog
 *
 * The parent owns the error state. Google sign-in's most common outcome is a *refusal*
 * — this address already has a password account — and that needs the email and password
 * form beside it so the user can sign in the other way without navigating away.
 *
 * @param {(idToken: string) => Promise<void>} onCredential  receives Google's ID token
 * @param {(error: Error) => void} onError                   parent shows the message
 * @param {boolean} disabled                                  while the parent is busy
 * @param {'login'|'signup'} variant                          which promise the copy makes
 */
const GoogleSignInButton = ({ onCredential, onError, disabled = false, variant = 'login' }) => {
  const containerRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  /*
   * Availability, then the button.
   *
   * Availability is a network call and the button is a script load, so they are
   * separate states rather than one `loading` flag. A deployment that is merely slow to
   * answer `/auth/google/config` must not be described as one that has Google switched
   * off — conflating them means hiding the button on a network blip and showing it only
   * on a slow one, which is backwards.
   */
  useEffect(() => {
    let active = true;

    import('../../services/auth')
      .then(({ getGoogleAuthConfig }) => getGoogleAuthConfig())
      .then((config) => {
        if (active) setEnabled(Boolean(config?.enabled));
      })
      .catch(() => {
        // `getGoogleAuthConfig` already resolves to `{enabled:false}` on failure, so
        // this is belt-and-braces. A login page that cannot reach the API still has to
        // render a working password form.
        if (active) setEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || disabled) return undefined;

    let active = true;

    /*
     * The callback is registered **before** the button is drawn.
     *
     * The reverse order is a race a user can win: press the button in the moment
     * between `renderButton` and `initialize`, and Google returns a credential to
     * nothing. It looks like a sign-in that silently does nothing.
     */
    (async () => {
      try {
        const ready = await initializeGoogleSignIn((credential) => {
          onCredential(credential);
        });
        if (!active) return;
        if (!ready) {
          setBlocked(true);
          return;
        }

        const drawn = await renderGoogleButton(containerRef.current);
        if (active) setReady(Boolean(drawn));
      } catch (error) {
        if (!active) return;
        /*
         * Distinguishes "blocked" from "did not load", because they need different
         * advice: a blocked script is fixed in the browser, a failed one by retrying.
         */
        setBlocked(error?.code === 'GOOGLE_BLOCKED');
        if (error?.code !== 'GOOGLE_BLOCKED') {
          onError?.(error);
        }
      }
    })();

    return () => {
      active = false;
      // An open popup outliving the navigation that dismissed it is the reason this
      // exists: without it the user can sign in to a page that is no longer mounted.
      cancelGoogleSignIn();
    };
    // `disabled` is deliberately not a dependency that re-initialises. Toggling it
    // would tear down and rebuild Google's widget mid-interaction, which loses the
    // user's place in the account chooser; the overlay below handles the busy state
    // without touching the widget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, disabled]);

  const handleFallback = useCallback(async () => {
    if (blocked) return;

    try {
      const credential = await new Promise((resolve) => {
        let settled = false;

        initializeGoogleSignIn((token) => {
          if (settled) return;
          settled = true;
          resolve(token);
        }).then((ok) => {
          if (!ok || settled) return;
          // Cancelled without choosing an account. Resolving to null keeps the promise
          // from hanging forever and leaving the button spinning.
          settled = true;
          resolve(null);
        });
      });

      if (credential) await onCredential(credential);
    } catch (error) {
      onError?.(error);
    }
  }, [blocked, onCredential, onError]);

  if (!enabled) return null;

  /*
    * Two different promises, and the copy has to match the one being made.

    * `login` — the account exists, Google proves who you are, you are in. The only
    * surprising part is that no code is needed, so that is the whole note.

    * `signup` — a *new, small* account. Google gives a name and a verified email;
    * everything else on this form (phone, role, school name) is not collected,
    * because the credential cannot carry it and asking for it would mean asking before
    * the user has an account. So the note names what is about to happen rather than
    * leaving them to meet the onboarding wizard unsure.
    */
  const note =
    variant === 'signup'
      ? 'Google confirms your email, so there is no verification code. You will add your phone and school details next.'
      : 'Google confirms your email address, so there is no verification code to enter.';

  return (
    <div className="space-y-3.5">
      <OrDivider />

      {blocked ? (
        /*
          The script could not be reached — almost always a content blocker.
          Shown as a real, working-looking control that explains itself on click rather
          than as a dead button, because "nothing happens" is indistinguishable from a
          broken app.
        */
        <button
          type="button"
          onClick={handleFallback}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50 shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <GoogleMark />
          Continue with Google
        </button>
      ) : (
        <div className="relative flex min-h-[44px] items-center justify-center">
          <div ref={containerRef} className="w-full max-w-[320px]" />

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Loading Google…
            </div>
          )}

          {/*
            A busy overlay rather than removing the button.

            Google's widget is a cross-origin iframe with its own click handling;
            replacing it with a disabled `<button>` mid-sign-in would destroy and
            rebuild the widget and lose the user's place in the account chooser. The
            overlay intercepts clicks without unmounting anything.
          */}
          {disabled && ready && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80"
              aria-hidden="true"
            >
              <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )}

      {/*
        The one thing worth saying on the page, because it is the part of this flow
        users cannot otherwise predict: **there is no verification code.** Wording
        depends on which promise the button above it is making.
      */}
      <p className="flex items-start gap-1.5 text-[11px] font-medium leading-snug text-slate-500">
        <AlertCircle className="mt-px h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{note}</span>
      </p>
    </div>
  );
};

export default GoogleSignInButton;