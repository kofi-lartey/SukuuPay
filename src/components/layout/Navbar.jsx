import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_LINKS, ROUTES } from '../../utils/constants';
import Logo from '../common/Logo';

/**
 * The application's only navigation bar.
 *
 * It is mounted once, above the router (see `AppChrome`), so it is never torn
 * down and rebuilt during a route change — scroll position, focus and the open
 * mobile drawer all survive navigation.
 *
 * It is deliberately identical on marketing pages, auth screens and the
 * dashboard. The previous design hid the links on `/login` and `/signup`, which
 * meant a visitor who landed on a sign-up link had no way back to pricing
 * without using the browser's back button.
 */
const Navbar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Any navigation closes the drawer; otherwise it hangs open over the new page.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The home page is the root, so it must match exactly or every link highlights.
  const isCurrent = (to) => (to === ROUTES.HOME ? pathname === to : pathname.startsWith(to));

  const linkClass = (link) => {
    const base =
      'rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40';
    if (isCurrent(link.to)) return `${base} bg-brand-50 text-brand-700`;
    if (link.accent) return `${base} bg-brand-700 text-white shadow-sm hover:bg-brand-800`;
    return `${base} text-slate-600 hover:bg-brand-50 hover:text-brand-700`;
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/85 backdrop-blur-md transition-all duration-300 ${
        scrolled ? 'border-slate-200/80 shadow-soft' : 'border-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-6 lg:h-20">
          <Logo markClassName="text-xl" />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isCurrent(link.to) ? 'page' : undefined}
                className={linkClass(link)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-5 md:flex">
            {user ? (
              <>
                <Link
                  to={ROUTES.DASHBOARD}
                  className="group flex items-center gap-3 rounded-full border border-slate-200 py-1 pl-1 pr-4 transition-colors hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="max-w-[9rem] truncate text-xs font-bold text-ink">
                      {user.name || 'My Account'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Dashboard</span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to={ROUTES.LOGIN}
                  className="text-sm font-bold text-slate-700 transition-colors hover:text-brand-700"
                >
                  Login
                </Link>
                <Link
                  to={ROUTES.SIGNUP}
                  className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white shadow-lift transition-all hover:-translate-y-0.5 hover:bg-brand-800"
                >
                  Get Started Free
                </Link>
                <Link
                  to={ROUTES.LOGIN}
                  aria-label="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  <User className="h-5 w-5" />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="border-t border-slate-100 bg-white px-4 pb-6 pt-3 md:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isCurrent(link.to) ? 'page' : undefined}
                className={`rounded-xl px-3 py-3 text-base font-semibold transition-colors ${
                  isCurrent(link.to)
                    ? 'bg-brand-50 text-brand-700'
                    : link.accent
                      ? 'bg-brand-700 text-white'
                      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-3 border-t border-slate-100 pt-4">
            {user ? (
              <>
                <Link
                  to={ROUTES.DASHBOARD}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to={ROUTES.LOGIN}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-700"
                >
                  Login
                </Link>
                <Link
                  to={ROUTES.SIGNUP}
                  className="rounded-xl bg-brand-700 px-5 py-3 text-center text-sm font-bold text-white shadow-lift"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
