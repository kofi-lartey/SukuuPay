import { createContext, useContext } from 'react';

/**
 * Lets a step describe itself to the layout's action bar.
 *
 * The rail lives in `OnboardingLayout` but the knowledge of whether a step is
 * valid, busy, or what "Continue" should do belongs to the step. Without this
 * the Continue button would be either always-enabled (and could advance past an
 * invalid form) or duplicated in every step file.
 */
const OnboardingStepContext = createContext(null);

export const useStepChrome = () => {
  const context = useContext(OnboardingStepContext);
  if (!context) {
    throw new Error('useStepChrome must be used within an OnboardingLayout');
  }
  return context;
};

/** Provided by the layout. Steps only ever consume it. */
export const StepChromeProvider = OnboardingStepContext.Provider;
export default OnboardingStepContext;
