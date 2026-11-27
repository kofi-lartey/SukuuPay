import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSchool } from '../services/school';
import { ROUTES } from '../utils/constants';

/**
 * Guard for the school management dashboard.
 *
 * Proactively checks the signed-in school's subscription status before any
 * dashboard module renders. A school whose paid subscription has passed its
 * seven-day grace period is `locked` and is sent to the subscription
 * management page instead of the module they tried to open.
 *
 * The backend's `subscriptionGraceMiddleware` is the real boundary: it
 * answers `403 { code: "SUBSCRIPTION_LOCKED" }` on every school-scoped
 * request. This guard is the client-side mirror that avoids a flash of a
 * rejected module page by redirecting before the first request is made.
 */
const SubscriptionGuard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return;
    }

    let active = true;

    getSchool(user.schoolId)
      .then((school) => {
        if (active) setStatus(school?.subscription?.status ?? null);
      })
      .catch(() => {
        // A transient failure must not strand the user: treat unknown as
        // "not locked" and let the backend middleware be the final arbiter.
        if (active) setStatus(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  if (loading) return null;

  if (status === 'locked') {
    return (
      <Navigate
        to={ROUTES.DASHBOARD_SUBSCRIPTION_MANAGE}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Outlet />;
};

export default SubscriptionGuard;
