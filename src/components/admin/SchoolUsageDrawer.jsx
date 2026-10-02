import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import StackedBar from '../dashboard/charts/StackedBar';
import { getSchoolUsage } from '../../services/admin';
import { formatCedi, formatCount } from '../../utils/format';

/**
 * One school's standing, from `GET /admin/schools/:id/usage`.
 *
 * A **drawer**, not a page, and not a row that expands: this is the drill-down
 * somebody opened to answer "is this school actually using this?", and it has to
 * leave the list underneath intact — an operator comparing three schools is
 * working across rows, and navigating away for each one loses the comparison. The
 * precedent is `StudentProfileDrawer` in the school console.
 *
 * It is also the only sensible home for the suspend action, for the reason in
 * `SuspendSchoolDialog`: suspending a school cascades `status` to **every user in
 * it** (`MODULES_13_TO_17.md:1585`). An action whose blast radius is a whole
 * school's staff does not belong on a row button in a list a platform admin
 * scrolls through — it belongs next to the evidence for why you would do it.
 *
 * Money is pesewas on the wire and cedis on screen; every figure below crosses
 * that boundary through `format*`.
 */
const SchoolUsageDrawer = ({ school, onClose, onSuspend, onUnsuspend }) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  // Re-fetch per school rather than caching the last one: two consecutive opens
  // of different schools would otherwise show the first school's numbers for the
  // frame before the fetch lands, which on a page about money is the one bug not
  // to ship.
  useEffect(() => {
    if (!school) return undefined;
    let active = true;
    setState({ data: null, loading: true, error: null });

    getSchoolUsage(school._id)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [school]);

  // Escape closes the drawer, so it is not reachable only by mouse.
  useEffect(() => {
    if (!school) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [school, onClose]);

  if (!school) return null;

  const usage = state.data || {};
  const counts = usage.counts || {};
  const payments = usage.payments || {};
  const breakdown = payments.statusBreakdown || {};

  const statusTone = { active: 'green', suspended: 'red', archived: 'slate' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close school details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${school.name} details`}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-extrabold text-ink">{school.name}</h2>
            <p className="font-mono text-[11px] font-bold text-slate-400">
              {school.schoolCode || '—'}
              {school.city ? ` · ${school.city}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 px-5 py-4">
          {state.error ? (
            <p className="text-[13px] font-semibold text-red-600">{state.error.message}</p>
          ) : state.loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={statusTone[school.status] || 'slate'} dot>
                  {school.status || 'unknown'}
                </Badge>
                <Badge tone="slate">{school.subscription?.plan || 'no plan'}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'Students', value: formatCount(counts.students) },
                  { label: 'Staff', value: formatCount(counts.staff) },
                  { label: 'Parents', value: formatCount(counts.parents) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </dt>
                    <dd className="mt-0.5 text-[15px] font-extrabold text-ink">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              {/*
                The payment split as a bar *and* as rows.

                The bar is for the shape; the rows are because a school with 20,000
                cedis completed and 45,000 pending looks calm in a green bar and
                alarming in the second column. The number an operator acts on is the
                outstanding one, and a stacked bar is the wrong place to read it.
              */}
              <div className="mt-5">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Payments collected
                </h3>
                <p className="mt-1 text-[20px] font-extrabold leading-none text-ink">
                  {formatCedi(payments.totalRevenue)}
                </p>

                <StackedBar
                  className="mt-3"
                  segments={[
                    {
                      key: 'completed',
                      label: 'Completed',
                      value: breakdown.completed?.amount,
                      className: 'bg-brand-600',
                    },
                    {
                      key: 'pending',
                      label: 'Pending',
                      value: breakdown.pending?.amount,
                      className: 'bg-amber-400',
                    },
                    {
                      key: 'failed',
                      label: 'Failed',
                      value: breakdown.failed?.amount,
                      className: 'bg-red-500',
                    },
                  ]}
                />

                <dl className="mt-3 space-y-1.5">
                  {[
                    ['Completed', breakdown.completed, 'text-brand-700'],
                    ['Pending', breakdown.pending, 'text-amber-600'],
                    ['Failed', breakdown.failed, 'text-red-600'],
                  ].map(([label, entry, tone]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
                      <dd className="text-[12px] font-extrabold">
                        <span className={`tabular-nums ${tone}`}>{formatCedi(entry?.amount)}</span>
                        <span className="ml-2 text-[11px] font-semibold text-slate-400">
                          {formatCount(entry?.count)} payments
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  School
                </h3>
                <dl className="mt-2 space-y-2">
                  {[
                    { icon: Phone, label: 'Phone', value: school.phone },
                    { icon: Users, label: 'Region', value: school.region },
                    {
                      icon: MessageSquare,
                      label: 'SMS balance',
                      value: formatCount(usage.school?.sms?.balance),
                    },
                    {
                      icon: CalendarClock,
                      label: 'Plan renews',
                      value: usage.school?.subscription?.currentPeriodEnd
                        ? new Date(usage.school.subscription.currentPeriodEnd).toLocaleDateString('en-GB')
                        : '—',
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2 text-[12px]">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="min-w-0 truncate font-bold text-ink">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </div>

        {/*
          The lifecycle action, at the foot of the drawer where the evidence above
          it is what justifies it.
        */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-4">
          {school.status === 'suspended' ? (
            <button
              type="button"
              onClick={() => onUnsuspend(school)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-ink transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Restore this school
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSuspend(school)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Suspend this school
            </button>
          )}

          <Link
            to={`/admin/schools`}
            onClick={onClose}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:text-brand-700"
          >
            All schools
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </div>
  );
};

export default SchoolUsageDrawer;