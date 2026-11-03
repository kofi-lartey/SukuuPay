import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_ROUTES } from '../../utils/constants';

const UNREAD_NOTIFICATIONS = 4;

const TITLE_BY_ROUTE = (pathname) => {
  const exact = [
    [STUDENT_ROUTES.dashboard, 'Dashboard'],
    [STUDENT_ROUTES.grades, 'Grades'],
    [STUDENT_ROUTES.attendance, 'Attendance'],
    [STUDENT_ROUTES.timetable, 'Timetable'],
    [STUDENT_ROUTES.fees, 'Fees'],
    [STUDENT_ROUTES.messages, 'Messages'],
    [STUDENT_ROUTES.community, 'Community'],
    [STUDENT_ROUTES.lms, 'Learning'],
    [STUDENT_ROUTES.profile, 'Profile'],
    [STUDENT_ROUTES.settings, 'Settings'],
    [STUDENT_ROUTES.notifications, 'Notifications'],
  ];
  for (const [route, label] of exact) {
    if (pathname === route) return label;
  }
  return 'Student portal';
};

const StudentTopBar = ({ onOpenNav, navOpen = false }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const title = TITLE_BY_ROUTE(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-tight text-ink">{title}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to={STUDENT_ROUTES.notifications}
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {UNREAD_NOTIFICATIONS > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-extrabold text-white">
                {UNREAD_NOTIFICATIONS}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-[12px] font-extrabold text-white"
            aria-label="Account menu"
          >
            {String(user?.name || 'S').trim().charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="absolute right-3 top-14 z-40 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <Link to={STUDENT_ROUTES.profile} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <User className="h-4 w-4" /> Profile
              </Link>
              <button type="button" onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default StudentTopBar;
