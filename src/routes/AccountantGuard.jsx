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

const AccountantGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!['accountant', 'bursar', 'school_admin', 'super_admin'].includes(user.role)) {
    return (
      <Forbidden
        requiredRole="accountant"
        role={user.role}
        title="This area is for bursars and accountants"
        description={`These records are limited to accountant/bursar accounts, and you are signed in as ${user.role}.`}
        backTo={ROUTES.DASHBOARD}
        backLabel="Go to your dashboard"
      />
    );
  }

  return <Outlet />;
};

export default AccountantGuard;
export { AccountantGuard };
