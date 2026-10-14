import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../utils/constants';

const FullPageSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <LoaderCircle className="h-10 w-10 animate-spin text-brand-700" aria-label="Loading" />
  </div>
);

/**
 * Gate for the onboarding wizard and the dashboard.
 *
 * Three rules, and they are deliberately symmetric:
 *   - a signed-out visitor goes to /login
 *   - a signed-in admin lands on whichever of /onboarding and /dashboard their
 *     completion flag does *not* match, so neither screen can be reached out
 *     of order and neither becomes a dead end
 *   - an account with no school can reach the onboarding wizard but *not* the
 *     dashboard, because there is nothing on the dashboard to act on
 *
 * `linkState` comes from the server (`onboardingBlock` in the auth controller),
 * not from inspecting `user.schoolId` here. The client used to infer the answer
 * and could only respond with an error, because an inferred boolean has exactly
 * one branch. The server additionally knows that `super_admin` legitimately has
 * no school and that a `schoolId` can point at an archived school, so the rule
 * lives in exactly one place.
 *
 * ## Two onboarding flows
 *
 * `/onboarding` is a tree with two roots, and the server names the one this
 * account is on (`flow`, plus `nextRoute`). `school_admin` walks the five-step
 * wizard from `school-profile`. `accountant`, `teacher` and `viewer` get
 * `/onboarding/join-school` and nothing else — one school-code field and a
 * waiting room, because there is nothing else in the wizard they could legally
 * finish. Crossing the two over would send a teacher into steps that 403, and
 * would let a headteacher sit in a join screen that will never resolve, so the
 * guard keeps each side on its own side.
 */
const OnboardingGuard = () => {
  const { user, loading, onboardingCompleted, linkState } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  const isOnboardingPath = location.pathname.startsWith(ROUTES.ONBOARDING);
  // Segment-aware, because the dashboard is now a subtree rather than one page.
  // An exact match on `/dashboard` alone would leave every module beneath it
  // unguarded: an account that has not finished onboarding could walk straight
  // to /dashboard/students, and the shell would mount around a page whose every
  // query returns nothing. One check has to cover the whole subtree, or the next
  // module added is the one that leaks.
  const isDashboardPath =
    location.pathname === ROUTES.DASHBOARD ||
    location.pathname.startsWith(`${ROUTES.DASHBOARD}/`);

  // Platform staff belong to no school by design. `needsSchoolProvisioning`
  // already excludes them; this second condition covers the window before the
  // server's first `/auth/me` resolves, when `linkState` is still unknown.
  const isPlatformStaff = user.role === 'super_admin';
  const isLinked = linkState?.linked === true || isPlatformStaff;

  // 'wizard' (provision and configure a school) or 'join' (enter a code and
  // wait). Null in the window before the first `/auth/me` resolves, which is why
  // every rule below reads it as a hint rather than as an access decision.
  const flow = linkState?.flow ?? null;

  // Finishing the wizard is only "done" once there is a school to have finished
  // configuring. Gating on both closes the flag/school mismatch — an account
  // that somehow recorded completion without a school would otherwise be waved
  // into a dashboard whose every query returns nothing.
  const isOnboarded = onboardingCompleted && isLinked;

  if (!isOnboarded && isDashboardPath) {
    // `nextRoute` rather than a bare `/onboarding`: the server has already
    // decided which flow this account is on, and its index route redirects into
    // the wizard's step 1 — the wrong destination for a teacher waiting on an
    // approval. The bare path is the fallback for the pre-`/auth/me` paint,
    // when `nextRoute` is still null.
    return <Navigate to={linkState?.nextRoute || ROUTES.ONBOARDING} replace />;
  }

  if (isOnboarded && isOnboardingPath) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Still onboarding, and somewhere under /onboarding. Keep each flow to its own
  // screen. The `flow === 'join'` rule is the one that matters day to day — a
  // teacher who bookmarked or was linked a wizard step lands on the only screen
  // they can use. The reverse rule is what stops a headteacher from waiting in a
  // join screen that will never resolve, since no school admin can approve them
  // into a school they are the one creating.
  if (!isOnboarded && isOnboardingPath) {
    if (flow === 'join' && location.pathname !== ROUTES.ONBOARDING_JOIN_SCHOOL) {
      return <Navigate to={ROUTES.ONBOARDING_JOIN_SCHOOL} replace />;
    }
    if (flow === 'wizard' && location.pathname === ROUTES.ONBOARDING_JOIN_SCHOOL) {
      return <Navigate to={ROUTES.ONBOARDING} replace />;
    }
  }

  return <Outlet />;
};

export default OnboardingGuard;
