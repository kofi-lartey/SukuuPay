import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Forbidden from '../pages/Forbidden';

const FullPageSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <span className="text-[13px] font-semibold text-slate-400">Loading…</span>
  </div>
);

const CommunityGuard = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!user) {
    return <Navigate to="/student/login" state={{ from: location }} replace />;
  }

  if (user.role === 'parent') {
    return (
      <Forbidden
        requiredRole="community member"
        role={user.role}
        title="This area is for students and staff"
        description="The community hub is a student and staff space; the parent portal is a separate token-based surface for fees and records."
        backTo="/dashboard"
        backLabel="Go to your dashboard"
      />
    );
  }

  if (!['student', 'teacher', 'school_admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/student/login" replace />;
  }

  return children || <Outlet />;
};

export default CommunityGuard;