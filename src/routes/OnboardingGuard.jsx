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

  // Finishing the wizard is only "done" once there is a school to have finished
  // configuring. Gating on both closes the flag/school mismatch — an account
  // that somehow recorded completion without a school would otherwise be waved
  // into a dashboard whose every query returns nothing.
  const isOnboarded = onboardingCompleted && isLinked;

  if (!isOnboarded && isDashboardPath) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  if (isOnboarded && isOnboardingPath) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default OnboardingGuard;
