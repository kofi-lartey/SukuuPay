import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Card from '../components/dashboard/ui/Card';
import { ROUTES, roleLabel, visibleDashboardNav } from '../utils/constants';

/**
 * "You are signed in, and this is not yours."
 *
 * The nav already hides modules a role cannot open, and the server's
 * `authorize(...)` is the real boundary. What was missing is the third case: the
 * rail is hidden but the **URL is not**, so a teacher who bookmarked
 * `/dashboard/settings` — or followed a link from a colleague — arrived at the
 * school console wrapped around a page whose every query is either refused or
 * silently empty. That looks like a broken feature rather than a permission
 * decision, and people report it as a bug.
 *
 * It says what happened, what is required and where to go instead, and it
 * deliberately does *not* say whether the resource behind the URL exists. A 403
 * that distinguishes "forbidden" from "not here" is a probe for enumerating
 * schools and accounts.
 *
 * `variant="bare"` drops the page chrome for use inside a shell that has already
 * mounted; the default renders standalone, which is what a guard needs — at that
 * point no shell has been authorised to exist.
 */
const Forbidden = ({
  requiredRole,
  title,
  description,
  backTo,
  backLabel = 'Back to dashboard',
  variant = 'standalone',
  role,
}) => {
  const isBare = variant === 'bare';
  const modules = role ? visibleDashboardNav(role).flatMap((group) => group.items).slice(0, 4) : [];

  const panel = (
    <>
      <span
        className={`mx-auto mb-6 flex items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ${
          isBare ? 'h-14 w-14' : 'h-16 w-16'
        }`}
      >
        <ShieldAlert size={isBare ? 26 : 32} aria-hidden="true" />
      </span>

      <p
        aria-hidden="true"
        className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-700"
      >
        403
      </p>

      <h1
        className={`mt-2 font-display font-extrabold tracking-tight text-ink ${
          isBare ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
        }`}
      >
        {title || 'This area is not open to your role'}
      </h1>

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        {description ||
          (requiredRole
            ? `This page is limited to ${roleLabel(requiredRole)} accounts. You are signed in as ${roleLabel(
                role
              )}.`
            : 'Your account does not have access to this page.')}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={backTo || ROUTES.DASHBOARD}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>

        {modules.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </>
  );

  if (isBare) return <div className="py-6 text-center">{panel}</div>;

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
        <Card padding="p-8 sm:p-10" className="text-center">
          {panel}
        </Card>
      </div>
    </div>
  );
};

export default Forbidden;