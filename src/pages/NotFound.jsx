import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { NAV_LINKS, ROUTES } from '../utils/constants';

/**
 * Catch-all for unmatched routes. Previously a bad path rendered the bare
 * chrome around an empty <main>, which looked like a rendering bug rather than
 * a missing page.
 */
const NotFound = () => (
  <div className="bg-slate-50">
    <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <span className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
        <Compass size={32} />
      </span>

      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        The link may be out of date. The pages below cover everything SukuuPay does.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Link
        to={ROUTES.HOME}
        className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
    </div>
  </div>
);

export default NotFound;
