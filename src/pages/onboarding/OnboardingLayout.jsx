import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Stepper from '../../components/onboarding/Stepper';
import LegalLinks from '../../components/common/LegalLinks';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import { ONBOARDING_STEPS, ROUTES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { StepChromeProvider } from './OnboardingStepContext';

/**
 * Wizard shell for the onboarding steps.
 *
 * Navigation is a URL concern, not local state: each step is its own route, so
 * a refresh resumes where the admin was and the browser back button behaves.
 * The layout only decides whether a step is reachable and renders the action
 * bar; the step owns its form and reports `valid` / `onSubmit` through
 * `StepChromeProvider`.
 *
 * No `SiteFooter` — the wizard is full-screen, per the brief. The one exception
 * is the legal links in the bottom cluster, which a school has to be able to read
 * while it is deciding to sign up rather than after.
 */
const EMPTY_CHROME = { valid: false, busy: false, label: null, onSubmit: null };

const OnboardingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { highestStep, unlockStep } = useOnboardingProgress();

  const [chrome, setChrome] = useState(EMPTY_CHROME);

  const stepId = location.pathname.split('/').filter(Boolean).pop() || ONBOARDING_STEPS[0].id;
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.id === stepId);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === ONBOARDING_STEPS.length - 1;

  // A step can be reached three ways: its own URL, the stepper, or the previous
  // step's Continue. Direct URL entry to a step already unlocked is fine; entry
  // to a locked one sends the admin back to where they actually were.
  useEffect(() => {
    if (currentIndex === -1) {
      navigate(`${ROUTES.ONBOARDING}/${ONBOARDING_STEPS[0].id}`, { replace: true });
      return;
    }
    if (currentIndex > highestStep) {
      navigate(`${ROUTES.ONBOARDING}/${ONBOARDING_STEPS[highestStep].id}`, { replace: true });
    }
  }, [currentIndex, highestStep, navigate]);

  // Drop the outgoing step's validity when the step changes, so Continue is
  // never left enabled over a fresh, empty form.
  //
  // This has to happen during render, not in an effect: React runs child effects
  // before parent effects, so an effect here would fire *after* the incoming
  // step registers itself and wipe it — leaving Continue disabled forever on a
  // step whose `register` only ever runs on mount. Setting state during render
  // re-renders this component immediately, before the children mount, so the
  // step's own registration is the last write.
  const [lastStepId, setLastStepId] = useState(stepId);
  if (lastStepId !== stepId) {
    setLastStepId(stepId);
    setChrome(EMPTY_CHROME);
  }

  // A long Step 1 leaves the admin scrolled mid-page; without this they land on
  // the middle of Step 2.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stepId]);

  const goBack = useCallback(() => {
    navigate(`${ROUTES.ONBOARDING}/${ONBOARDING_STEPS[Math.max(0, currentIndex - 1)].id}`);
  }, [currentIndex, navigate]);

  const goNext = useCallback(async () => {
    // Validated here, not in the step: a step that reports `valid: true` while
    // its own save is still in flight must not advance and unmount mid-request.
    if (!chrome.valid || chrome.busy) return;

    const saved = await chrome.onSubmit?.();
    // `false` means the step's own save failed and already surfaced a toast;
    // advancing anyway would strand the data.
    if (saved === false) return;

    unlockStep(currentIndex + 1);
    navigate(`${ROUTES.ONBOARDING}/${ONBOARDING_STEPS[Math.min(ONBOARDING_STEPS.length - 1, currentIndex + 1)].id}`);
  }, [chrome, currentIndex, navigate, unlockStep]);

  const chromeValue = useMemo(
    () => ({
      register: (next) => setChrome(next),
    }),
    []
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <Stepper currentStep={ONBOARDING_STEPS[currentIndex]?.id} highestStep={highestStep} />

      <StepChromeProvider value={chromeValue}>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <Outlet />
        </main>
      </StepChromeProvider>

      {/*
        The bottom cluster is sticky and always present, while the *button row*
        inside it is not. Two reasons for splitting them:

          - The bar used to be wrapped in `{!isLast && ...}`, so anything inside
            it disappeared on the final step. The legal links have to be there on
            the last step too — that is the step where an admin is told setup is
            complete, and it is the last chance to read what they agreed to.
          - A footer rendered after <main> would sit *underneath* this
            `sticky bottom-0` bar and be invisible, and one rendered before it
            would be pushed off-screen by the form.

        The wizard is deliberately chrome-free, so this is the only marketing
        furniture in it — and it earns its place, because the terms are agreed to
        during signup rather than read afterwards.
      */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl border-b border-slate-100 px-4 pt-2.5 sm:px-6 lg:px-8">
          <LegalLinks className="justify-center" />
        </div>

        {!isLast && (
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirst}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>

            <p className="hidden text-[12px] font-semibold text-slate-400 sm:block">
              {user?.email}
            </p>

            <button
              type="button"
              onClick={goNext}
              disabled={!chrome.valid || chrome.busy}
              className="flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chrome.busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {chrome.busy ? 'Saving…' : chrome.label || 'Continue'}
              {!chrome.busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>

      {/* Screen-reader announcement of the current step, for step changes that
          are not driven by a focus-moving navigation. */}
      <p className="sr-only" aria-live="polite">
        Step {currentIndex + 1} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[currentIndex]?.label}
      </p>
    </div>
  );
};

export default OnboardingLayout;
