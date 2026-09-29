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
 * Two rules, and they are deliberately symmetric:
 *   - a signed-out visitor goes to /login
 *   - a signed-in admin lands on whichever of /onboarding and /dashboard their
 *     completion flag does *not* match, so neither screen can be reached out
 *     of order and neither becomes a dead end.
 *
 * `onboardingCompleted` is read from AuthContext, which keeps it in local
 * storage. The API has no `onboardingCompleted` field on the User model yet, so
 * the flag does not survive a device change; until a `PUT /users/me/onboarding`
 * route exists, an admin who onboards on their laptop and then opens the site
 * on their phone will be asked to walk the wizard again.
 */
const OnboardingGuard = () => {
  const { user, loading, onboardingCompleted } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  const isOnboardingPath = location.pathname.startsWith(ROUTES.ONBOARDING);
  const isDashboardPath = location.pathname === ROUTES.DASHBOARD;

  if (onboardingCompleted && isOnboardingPath) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (!onboardingCompleted && isDashboardPath) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }

  return <Outlet />;
};

export default OnboardingGuard;
