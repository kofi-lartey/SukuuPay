import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const StudentSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <span className="text-[13px] font-semibold text-slate-400">Loading…</span>
  </div>
);

const StudentGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <StudentSpinner />;

  if (!user) {
    return <Navigate to="/student/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'student') {
    return <Navigate to="/student/login" replace />;
  }

  return <Outlet />;
};

export default StudentGuard;
