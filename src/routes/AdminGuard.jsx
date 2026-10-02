import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';
import { ROUTES } from '../utils/constants';

const FullPageSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <LoaderCircle className="h-10 w-10 animate-spin text-brand-700" aria-label="Loading" />
  </div>
);

/**
 * Gate for the platform console.
 *
 * The only role check in the app. `canAccessNavItem` decides what the rail
 * *shows*, and `constants.js` is explicit that this is presentation only — the
 * server's `authorize("super_admin")` on `admin.routes.js:37` is the boundary.
 * Both halves are needed and they are not interchangeable:
 *
 *   - without the guard, a `school_admin` who types `/admin` gets the shell, six
 *     cards of zeros and a console full of refused queries, because the server
 *     correctly answers 403 to every one of them;
 *   - without hiding rail entries, a `school_admin` sees a link that leads to a
 *     page telling them they may not be there.
 *
 * `Forbidden` rather than a redirect: a silent bounce to `/dashboard` leaves the
 * person certain the page is theirs and merely still loading.
 *
 * There is deliberately **no onboarding check here**, unlike `OnboardingGuard`.
 * A `super_admin` belongs to no school by design, so `linkState.linked` is false
 * for them and an onboarding redirect would lock every platform admin out of the
 * only console they have. That asymmetry is the whole reason this is a separate
 * component rather than a flag on the existing guard — one rule for a school
 * console that requires a school, another for a platform console that must not.
 *
 * The role test happens after `loading` resolves for the same reason the school
 * guard waits: before `/auth/me` returns there is no role to test, and redirecting
 * on an unknown role logs out every signed-in user on a cold load.
 */
const AdminGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (user.role !== 'super_admin') {
    return (
      <Forbidden
        requiredRole="super_admin"
        role={user.role}
        title="The platform console is for platform admins"
        description={`This console runs every school on SukuuPay. It is limited to platform admin accounts, and you are signed in as ${user.role === 'school_admin' ? 'a school administrator' : user.role}. Your school’s records are in your own dashboard.`}
        backTo={ROUTES.DASHBOARD}
        backLabel="Go to your dashboard"
      />
    );
  }

  return <Outlet />;
};

export default AdminGuard;