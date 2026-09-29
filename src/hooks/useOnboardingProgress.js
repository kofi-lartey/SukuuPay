import { useCallback, useState } from 'react';
import {
  ONBOARDING_PROGRESS_KEY,
  ONBOARDING_STEP_KEY_PREFIX,
  ONBOARDING_STEPS,
} from '../utils/constants';

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
 * localStorage-backed wizard state.
 *
 * Two independent concerns live here:
 *   1. `highestStep` — how far the admin has unlocked. Drives the stepper and
 *      the guard; clicking a future step is not allowed.
 *   2. per-step drafts — the raw form values, so a refresh mid-wizard does not
 *      discard a half-typed bank account number.
 *
 * `localStorage` is per-browser, so an admin who resumes on a different device
 * starts at step 1. Server-side resume needs a `PUT /users/me/onboarding`
 * endpoint, which does not exist yet.
 */
export const useOnboardingProgress = () => {
  // `highestStep` mirrors the localStorage value so the stepper re-renders when
  // a step is unlocked; drafts are deliberately not mirrored (see below).
  const [highestStep, setHighestStep] = useState(() => {
    const stored = Number(localStorage.getItem(ONBOARDING_PROGRESS_KEY));
    const lastIndex = ONBOARDING_STEPS.length - 1;
    if (!Number.isFinite(stored) || stored < 0) return 0;
    return Math.min(stored, lastIndex);
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

  /** Unlock `index` and everything below it, never re-locking a cleared wizard. */
  const unlockStep = useCallback((index) => {
    const target = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1));
    setHighestStep((current) => {
      if (target <= current) return current;
      localStorage.setItem(ONBOARDING_PROGRESS_KEY, String(target));
      return target;
    });
  }, []);

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
