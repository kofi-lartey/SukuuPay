import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2 } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import { ROUTES } from '../../../utils/constants';

/**
 * Status → tone, for both the badge and the row's left edge.
 *
 * One map for both, because a badge that says "suspended" in amber while the row
 * is outlined in red is two signals for one fact, and one of them will be wrong
 * the first time somebody adds a status.
 */
const STATUS_TONES = {
  active: 'green',
  suspended: 'red',
  archived: 'slate',
  trial: 'amber',
};

/** The five most recently created schools, straight from the KPIs payload. */
const RecentSchoolsCard = ({ schools = [], loading, error }) => {
  const rows = Array.isArray(schools) ? schools : [];

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Newest schools</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            The five most recently created accounts
          </p>
        </div>
        <Link
          to={ROUTES.ADMIN_SCHOOLS}
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          All schools
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {error ? (
        <p className="mt-6 text-[13px] font-semibold text-red-600">
          {error.message || 'The newest schools could not be loaded.'}
        </p>
      ) : loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-200/70" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Building2}
            title="No schools yet"
            description="Schools appear here as soon as an administrator finishes signing up."
          />
        </div>
      ) : (
        <>
          {/*
            A real `<table>` with a caption, not a card list. Five rows of
            name/code/plan/date is tabular data, and a screen reader needs the
            column relationships that a flex list destroys. `overflow-x-auto` on
            the wrapper keeps a long school name scrolling inside the card instead
            of widening the page.
          */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <caption className="sr-only">The five most recently created schools</caption>
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    School
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Code
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Plan
                  </th>
                  <th scope="col" className="pb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((school) => (
                  <tr key={school._id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3 text-[13px] font-extrabold text-ink">
                      <span className="block max-w-[16rem] truncate">{school.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] font-bold text-slate-500">
                      {school.schoolCode || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-[11px] font-bold capitalize text-slate-600">
                      {school.subscription?.plan || '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={STATUS_TONES[school.status] || 'slate'} dot>
                        {school.status || 'unknown'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            The API returns a `createdAt` per row and the table does not show it.
            Not an oversight: "newest" is the point of the card and five identical
            dates would say less than the ordering does. The full list, sortable
            by `createdAt`, is one click away in the All schools link above.
          */}
        </>
      )}
    </Card>
  );
};

export default RecentSchoolsCard;