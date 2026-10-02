import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Sends one role to a different landing page, and leaves everyone else alone.
 *
 * A platform admin opening `/dashboard` gets the platform console instead. The
 * alternative was a school console full of empty panels wrapped around a rail that
 * says "Your school", because every module under `/dashboard` is school-scoped and
 * a `super_admin` has no school.
 *
 * The redirect is `replace`, so the console does not become a second Back target
 * — pressing Back from `/admin` should leave the console, not bounce to
 * `/dashboard` and forward again.
 *
 * It returns `children` rather than taking an `else` prop: an element passed as a
 * child is *created* when the parent renders but not *run* until React renders it,
 * so the Overview's component body — and its requests — do not execute for a
 * platform admin who is about to be redirected. That matters, because
 * `useDashboardOverview` fires six requests and this would have fired all six at a
 * person who can see none of the results.
 */
const RoleLanding = ({ role, to, children }) => {
  const { user, loading } = useAuth();

  // The parent guard already renders a full-page spinner while loading, so this
  // is only reached with an identity in hand. Returning null rather than
  // `children` keeps the shell from flashing the wrong module if that changes.
  if (loading) return null;

  if (user?.role === role) {
    return <Navigate to={to} replace />;
  }

  return children;
};

export default RoleLanding;