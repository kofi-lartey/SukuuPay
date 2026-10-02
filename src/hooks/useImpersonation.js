import { useCallback, useEffect, useState } from 'react';
import {
  getActiveImpersonation,
  endImpersonation as apiEndImpersonation,
} from '../services/impersonation';
import { useToast } from './useToast';
import { ROUTES } from '../utils/constants';

/**
 * The current impersonation, and how to end it.
 *
 * **State lives in localStorage, not in this hook.** The banner has to be correct
 * on the very first paint after a reload, and a `useState` initialised to `null`
 * renders "you are not impersonating" for one frame before any effect runs — which
 * on a page full of one school's student names is a frame where the operator's
 * screen says they are looking at a school they are not. Reading the stored session
 * synchronously during the initial `useState` means the banner is right on the
 * first frame or it is never right.
 *
 * `localStorage` is the right home for it rather than a context because the state
 * has to survive a reload, is only ever written by `services/impersonation.js`, and
 * is authoritative nowhere: the server re-checks the session on every request and
 * will refuse the call regardless of what the client believes. The client copy is
 * for the operator's benefit — knowing which school they are in — not for
 * enforcement.
 *
 * **`ending` exists so the banner cannot double-fire.** Two clicks in quick
 * succession would send two `POST /admin/impersonate/end` calls; the server is
 * idempotent here, but the second would arrive with the *restored* platform token
 * and find no session, and the resulting double toast would read as a fault.
 */
export const useImpersonation = () => {
  const [session, setSession] = useState(() => getActiveImpersonation());
  const [ending, setEnding] = useState(false);
  const toast = useToast();

  // A full reload is the interesting case: the token in storage is an impersonation
  // token and `AuthContext` will have fetched `/auth/me` with it, so the banner has
  // to agree with whatever that produced. Re-reading on mount rather than trusting
  // the initialiser covers the tab that was closed mid-session.
  useEffect(() => {
    setSession(getActiveImpersonation());
  }, []);

  /**
   * Cross-tab termination.
   *
   * Opening the console in two tabs and impersonating in one is normal — it is how
   * you keep the platform view open while you look at a school. Without a
   * `storage` listener the second tab keeps its banner up and its reads fail with a
   * 403 nobody can act on, so the operator is left staring at a control that looks
   * like the problem. Ending it in one tab should visibly end it in the other.
   *
   * The event only fires in *other* tabs, which is why the tab that ended it does
   * not need to handle it — and why this cannot cause a loop.
   */
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'auth_token' && event.newValue && event.oldValue) {
        setSession(getActiveImpersonation());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const end = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      await apiEndImpersonation();
      setSession(null);
      toast.success('Impersonation ended. You are back in the platform console.');
    } catch (error) {
      /*
       * Cleared locally anyway.
       *
       * `endImpersonation` in the service clears the stored session before it
       * rethrows, so there is nothing left to reconcile — the operator is signed
       * out and lands on `/login`. Saying so is the difference between "something
       * went wrong" and "sign in again", and the second one is actionable.
       */
      setSession(null);
      toast.error(error?.message || 'Impersonation could not be ended. Sign in again.');
    } finally {
      setEnding(false);
    }
  }, [ending, toast]);

  return {
    isImpersonating: Boolean(session),
    session,
    schoolName: session?.schoolName || '',
    reason: session?.reason || '',
    startedAt: session?.startedAt || null,
    ending,
    end,
    /**
     * Where "exit" should land.
     *
     * The platform overview rather than the current page: the operator was just
     * looking at someone else's school, and dropping them on the screen they were
     * mid-way through reading — with its data now out of scope — is the most
     * confusing place to put them.
     */
    exitTo: ROUTES.ADMIN,
  };
};

export default useImpersonation;