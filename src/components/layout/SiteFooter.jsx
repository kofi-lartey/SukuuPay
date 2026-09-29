import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import { APP_YEAR, HELPDESK_PHONE, NAV_LINKS, ROUTES } from '../../utils/constants';

const SUMMARY = 'Automated school fee collection for Ghanaian schools.';

/**
 * The application's only footer, rendered on every page.
 *
 * Deliberately one compact band. An earlier version carried a four-column
 * directory, a regional support card and a certification line lifted from the
 * contact page — all of which is useful exactly once, not on every route, so
 * it read as clutter on the other thirteen.
 *
 * The link list reuses `NAV_LINKS` so the footer always mirrors the navbar and
 * the two cannot drift apart.
 */
const SiteFooter = () => (
  <footer className="mt-auto border-t border-slate-200 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <Logo markClassName="text-base" />
          <p className="mt-2 text-sm text-slate-600">{SUMMARY}</p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row">
        <p>&copy; {APP_YEAR} SukuuPay Financial Technologies Ltd.</p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link to={ROUTES.PRIVACY} className="transition-colors hover:text-brand-700">
            Privacy
          </Link>
          <Link to={ROUTES.TERMS} className="transition-colors hover:text-brand-700">
            Terms
          </Link>
          <a
            href={`tel:${HELPDESK_PHONE.replace(/\s/g, '')}`}
            className="transition-colors hover:text-brand-700"
          >
            {HELPDESK_PHONE}
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
