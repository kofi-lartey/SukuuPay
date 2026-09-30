import { useCallback, useState } from 'react';
import {
  ONBOARDING_PROGRESS_KEY,
  ONBOARDING_STEP_KEY_PREFIX,
  ONBOARDING_STEPS,
} from '../utils/constants';
import { useAuth } from '../context/AuthContext';

const stepKey = (stepId) => `${ONBOARDING_STEP_KEY_PREFIX}_${stepId}`;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // A corrupt draft must not brick the wizard; drop it and start clean.
    localStorage.removeItem(key);
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private-mode / quota failures are non-fatal: the wizard still works, it
    // just will not survive a refresh.
  }
};

/**
 * Wizard state: how far the admin has unlocked, plus the per-step drafts.
 *
 * Two independent concerns live here:
 *   1. `highestStep` — drives the stepper and the guard. Two sources, and the
 *      higher wins: `User.onboardingHighestStep` on the server (so the wizard
 *      follows a bursar to a second device) and the localStorage key (which
 *      covers the instant before the PATCH lands). Previously the localStorage
 *      key was the *only* source, which is why an admin who onboarded on a
 *      laptop started again at step 1 on their phone.
 *   2. per-step drafts — the raw form values, so a refresh mid-wizard does not
 *      discard a half-typed bank account number.
 *
 * Drafts are still browser-local by design. They are unsaved input, not
 * progress: syncing a half-typed card number across devices is not worth the
 * surface area, and Step 1's field values are recoverable from the server now
 * that the school actually exists.
 */
export const useOnboardingProgress = () => {
  const { onboarding, saveOnboardingStep } = useAuth();

  // `highestStep` mirrors the resolved value so the stepper re-renders when a
  // step is unlocked; drafts are deliberately not mirrored (see below).
  const [highestStep, setHighestStep] = useState(() => {
    const stored = Number(localStorage.getItem(ONBOARDING_PROGRESS_KEY));
    const lastIndex = ONBOARDING_STEPS.length - 1;
    const local = Number.isFinite(stored) && stored >= 0 ? stored : 0;
    const remote = Number(onboarding?.highestStep) || 0;
    return Math.min(Math.max(local, remote), lastIndex);
  });

  // Drafts are read straight from localStorage rather than mirrored into state.
  // A state mirror would have to be exposed through a `useCallback` that closes
  // over it, and that callback's identity would change on every keystroke —
  // re-running any effect that depends on it, including the steps' one-time
  // hydrate-on-mount. Reading on demand keeps the identity stable forever.
  const getStepDraft = useCallback((stepId) => readJson(stepKey(stepId), null), []);

  const setStepDraft = useCallback((stepId, draft) => {
    writeJson(stepKey(stepId), draft);
  }, []);

  const clearStepDraft = useCallback((stepId) => {
    localStorage.removeItem(stepKey(stepId));
  }, []);

  /**
   * Unlock `index` and everything below it, never re-locking a cleared wizard.
   *
   * Also persisted server-side, but not awaited: losing that write costs a
   * second device a walk back through step 1, which is not worth blocking
   * navigation on.
   */
  const unlockStep = useCallback(
    (index) => {
      const target = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1));
      setHighestStep((current) => {
        if (target <= current) return current;
        localStorage.setItem(ONBOARDING_PROGRESS_KEY, String(target));
        return target;
      });
      saveOnboardingStep(target);
    },
    [saveOnboardingStep]
  );

  /**
   * Wipe every draft. Called only once onboarding is genuinely finished — the
   * wizard depends on these keys to survive a refresh, so clearing early would
   * silently drop a bursar's payout details.
   */
  const clearAll = useCallback(() => {
    ONBOARDING_STEPS.forEach((step) => localStorage.removeItem(stepKey(step.id)));
    localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
    setHighestStep(0);
  }, []);

  return { highestStep, getStepDraft, setStepDraft, clearStepDraft, unlockStep, clearAll };
};

export default useOnboardingProgress;
