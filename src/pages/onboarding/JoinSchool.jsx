import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  School,
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import LegalLinks from '../../components/common/LegalLinks';
import { Field } from '../../components/common/FormField';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { joinSchoolByCode } from '../../services/school';
import { ROUTES } from '../../utils/constants';
import { resolveLandingRoute } from '../../utils/landing';

/**
 * How often the waiting room re-asks the server whether it has been approved.
 *
 * Fifteen seconds, not five, because every poll is a full `/auth/me` with a
 * school-existence check on it, and because the alternative is the applicant
 * reloading the page by hand. The email the applicant is also sent is the real
 * notification; this is what lets somebody who left the tab open walk in
 * without thinking about it.
 */
const POLL_INTERVAL_MS = 15000;

/**
 * How each joining role describes itself in a sentence.
 *
 * Not `roleLabel`: that returns "Accountant / bursar", which does not survive
 * "You signed up as a {label}" — "a accountant", and a slash in the middle of
 * prose. These are the words for the sentence, spelled without the article so
 * one map reads for all three roles.
 */
const JOINED_AS = {
  accountant: 'an accountant',
  teacher: 'a teacher',
  viewer: 'a viewer',
};

/**
 * The join flow: one school code, then a waiting room.
 *
 * An `accountant`, a `teacher` or a `viewer` signing up has nothing to
 * configure — the school already exists, they are joining somebody else's. The
 * five-step wizard would ask them to name that school, set up its payout
 * account, import its students, pick a plan and send its first reminder, and
 * every one of those ends in a 403 on a school they do not own. So this screen
 * is the whole of their onboarding: enter the code the headteacher gave you,
 * and wait for that headteacher to approve it.
 *
 * The server is the authority on which state this screen is in.
 * `onboarding.joinRequest` (from `onboardingBlock`) says whether a request is
 * waiting, has been declined, or has never been made — so a reload shows the
 * same waiting room, with the school's name, instead of an empty form. The
 * poll exists because the decision is made by somebody else, in another tab,
 * and "reload the page" is not a plan.
 */
const JoinSchool = () => {
  const { user, onboarding, linkState, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The result of a submit made in this tab, before the next poll confirms it.
  // Without it the applicant would stare at an unchanged form for up to a
  // second after pressing "Send request", which reads as a failure.
  const [justRequested, setJustRequested] = useState(null);

  const joinRequest = onboarding?.joinRequest ?? null;
  const pending = onboarding?.joinRequested === true || Boolean(justRequested);
  const linked = linkState?.linked === true;

  useEffect(() => {
    if (linked) {
      navigate(
        resolveLandingRoute({
          onboarding: linkState,
          role: user?.role,
          requested: null,
        }),
        { replace: true }
      );
    }
  }, [linked, navigate, linkState, user?.role]);

  /**
   * Re-ask `/auth/me` while there is a request outstanding.
   *
   * Chained with `setTimeout` inside the callback rather than a fixed
   * `setInterval`, for two reasons. An interval that fires while a previous
   * request is still in flight stacks them, and the answers can land out of
   * order — a stale "still unlinked" overwriting a fresh "approved". And a
   * chain stops itself the moment the state changes, which is what ends the
   * polling at all: `linked` flips, `pending` goes false, the cleanup clears the
   * pending timer and no further request is made.
   */
  const pollingRef = useRef(false);
  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      await refreshUser();
    } catch {
      // A failed poll changes nothing: the state we have still says "waiting",
      // which is still true. Retry on the next tick rather than alarming
      // somebody whose request is perfectly fine.
    } finally {
      pollingRef.current = false;
    }
  }, [refreshUser]);

  useEffect(() => {
    if (!pending) return undefined;

    let cancelled = false;
    let timer;

    const tick = async () => {
      await poll();
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pending, poll]);

  const signOut = async () => {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Enter the code your headteacher gave you.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await joinSchoolByCode({
        schoolCode: trimmed,
        applicantName: user?.name,
        applicantPosition: user?.position,
      });
      setJustRequested({ schoolName: result?.schoolName || null, requestId: result?.requestId });
      toast.info('Request sent. We will let you know the moment it is approved.');
    } catch (submitError) {
      if (submitError.code === 'ALREADY_LINKED') {
        // The account was linked elsewhere — most likely an invitation accepted
        // after this tab was opened. Nothing to wait for; refresh and let the
        // guard take over.
        await poll();
        return;
      }
      setError(submitError.message || 'We could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const schoolName = justRequested?.schoolName || joinRequest?.schoolName || null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-7">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
            Getting started
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Join your school
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
            You signed up as {JOINED_AS[user?.role] || 'staff'}, so you join a school that is
            already on SukuuPay instead of creating one.
          </p>
        </header>

        {pending ? (
          <section
            aria-labelledby="pending-heading"
            className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-soft sm:p-8"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Clock className="h-7 w-7" aria-hidden="true" />
            </span>

            <h2
              id="pending-heading"
              className="mt-4 text-lg font-extrabold tracking-tight text-ink"
            >
              Waiting for approval
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-slate-600">
              {schoolName ? (
                <>
                  Your request to join{' '}
                  <span className="font-bold text-ink">{schoolName}</span> has been sent. An
                  administrator of that school has to approve it before you get access.
                </>
              ) : (
                <>
                  Your request has been sent. An administrator of your school has to approve it
                  before you get access.
                </>
              )}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={poll}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Check again
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
              >
                Sign out
              </button>
            </div>

            <p className="mt-5 inline-flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-left text-[12px] font-medium text-slate-500">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              This page checks automatically — you can leave it open and you will be sent to your
              dashboard the moment you are approved.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            {joinRequest?.status === 'rejected' && (
              <div
                role="status"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-[13px] leading-relaxed text-amber-800">
                  Your request to join{' '}
                  <span className="font-bold">{schoolName || 'your school'}</span> was not
                  approved
                  {joinRequest.decidedNote ? `: ${joinRequest.decidedNote}` : '.'}{' '}
                  Check the code with your headteacher and try again.
                </p>
              </div>
            )}

            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <School className="h-7 w-7" aria-hidden="true" />
            </span>

            <h2 className="mt-4 text-center text-lg font-extrabold tracking-tight text-ink">
              Enter your school ID
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-center text-[13px] leading-relaxed text-slate-600">
              Ask your headteacher for your school code — it looks like{' '}
              <span className="font-bold text-ink">ABC123</span> and appears on their SukuuPay
              dashboard.
            </p>

            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <Field
                label="School ID"
                required
                icon={KeyRound}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError('');
                }}
                placeholder="ABC123"
                value={code}
                maxLength={12}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                hint="Not case sensitive"
                error={error || undefined}
              />

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] font-medium leading-snug text-slate-400">
              A school code alone never grants access — it identifies your school, and one of its
              administrators decides. That is what stops a guessed code from handing out your
              bursary.
            </p>
          </section>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl justify-center px-4 pt-2.5 sm:px-6">
          <LegalLinks className="justify-center" />
        </div>
      </div>
    </div>
  );
};

export default JoinSchool;
