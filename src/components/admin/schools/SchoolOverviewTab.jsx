import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  CreditCard,
  Percent,
  RefreshCw,
  Users,
} from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import StackedBar from '../../dashboard/charts/StackedBar';
import EmptyState from '../../dashboard/EmptyState';
import { getSchoolUsage } from '../../../services/admin';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

const STATUS_TONES = { active: 'green', suspended: 'red', archived: 'slate' };

/** A label/value row, so the definition list cannot drift between the two columns. */
const Fact = ({ label, value, tone = 'text-ink' }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5">
    <dt className="shrink-0 text-[12px] font-semibold text-slate-500">{label}</dt>
    <dd className={`min-w-0 truncate text-right text-[12px] font-extrabold ${tone}`}>{value}</dd>
  </div>
);

/**
 * Everything the platform knows about one school at a glance.
 *
 * **Two sources, deliberately not merged.** The profile, subscription and commercial
 * terms come from `getSchool`, which the page header already fetched and hands down —
 * `GET /admin/schools/:id` resolves profile, stats, tags, flags and notes in one
 * request precisely so the header and the Overview can never disagree about which
 * moment in time they describe. The counts and the payment split come from
 * `getSchoolUsage`, fetched *here*, lazily, because that is a different question with
 * a different failure mode: usage is the aggregate that answers "is this school
 * actually being used", and it is worth a panel that can fail on its own.
 *
 * Assembling both up front in the page would mean an operator landing on this screen
 * waits for the second request before seeing anything, and a failure in either one
 * blanks the page — which is the `useAdminDashboard` failure mode the Overview page's
 * own comment rails against.
 *
 * `StackedBar` is the shared hand-rolled SVG bar, not a charting library: `recharts`
 * and `chart.js` are not dependencies (`package.json`) and the conventions forbid
 * installing one. It is paired with the rows underneath because a school with a large
 * completed total and a large pending one looks calm as a bar and alarming as a
 * number — the outstanding figure is the one an operator acts on, and a stacked bar
 * is the wrong place to read it.
 */
const SchoolOverviewTab = ({ school, record, onEditMarkup }) => {
  const [usage, setUsage] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setUsage({ data: null, loading: true, error: null });

    getSchoolUsage(school._id)
      .then((data) => active && setUsage({ data, loading: false, error: null }))
      .catch((error) => active && setUsage({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [school?._id, record?.updatedAt]);

  if (!school) return null;

  const counts = usage.data?.counts || {};
  const payments = usage.data?.payments || {};
  const breakdown = payments.statusBreakdown || {};
  const subscription = record?.subscription || school.subscription || {};
  const markup = Number(record?.paymentConfig?.platformMarkupPercent ?? school.payment?.platformMarkupPercent) || 0;
  const platformFee = Number(record?.platformFeePercent) || 0;
  const gatewayMode = record?.paymentConfig?.gatewayMode || school.payment?.gatewayMode;

  return (
    <div className="space-y-4">
      {/*
        The commercial terms, first and alone in a row. They are the three numbers the
        platform owner is the only person who can see, and burying them under the
        school's own profile is how a markup change gets made from memory.
      */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Platform markup
            </p>
            <Percent className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-ink">{markup}%</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            of every payment, new ones only
          </p>
          {onEditMarkup && (
            <button
              type="button"
              onClick={onEditMarkup}
              className="mt-3 text-[12px] font-extrabold text-brand-700 transition-colors hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              Change markup
            </button>
          )}
        </Card>

        <Card padding="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Platform fee
            </p>
            <CreditCard className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-ink">{platformFee}%</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            monthly, charged on collected volume
          </p>
          <Link
            to={`${ADMIN_ROUTES.SCHOOL_DETAIL.replace(':schoolId', school._id)}?tab=settings`}
            className="mt-3 inline-block text-[12px] font-extrabold text-brand-700 transition-colors hover:text-brand-800 hover:underline"
          >
            Change in Settings
          </Link>
        </Card>

        <Card padding="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Gateway mode
            </p>
            <Building2 className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-2xl font-extrabold capitalize text-ink">{gatewayMode || '—'}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {gatewayMode === 'manual'
              ? 'collecting outside SukuuPay — platform fee applies'
              : 'the rail this school’s money moves on'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Usage. Its own error state, because this is the panel that can fail. */}
        <Card padding="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-extrabold leading-tight text-ink">Usage</h2>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                Whether this school is actually being used
              </p>
            </div>
          </div>

          {usage.error ? (
            <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
              {usage.error.message || 'This school’s usage could not be loaded.'}
            </p>
          ) : usage.loading ? (
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <>
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

              <div className="mt-5">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  Payments collected
                </h3>
                <p className="mt-1 text-[20px] font-extrabold leading-none tabular-nums text-ink">
                  {formatCedi(payments.totalRevenue)}
                </p>

                <StackedBar
                  className="mt-3"
                  segments={[
                    { key: 'completed', label: 'Completed', value: breakdown.completed?.amount, className: 'bg-brand-600' },
                    { key: 'pending', label: 'Pending', value: breakdown.pending?.amount, className: 'bg-amber-400' },
                    { key: 'failed', label: 'Failed', value: breakdown.failed?.amount, className: 'bg-red-500' },
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
            </>
          )}
        </Card>

        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Profile</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Contact, location and identity
          </p>

          <dl className="mt-3 divide-y divide-slate-100">
            {[
              { label: 'Type', value: school.type || '—' },
              { label: 'Region', value: school.region || '—' },
              { label: 'City', value: school.city || '—' },
               { label: 'Address', value: school.address || '—' },
               { label: 'GPS Address', value: school.gpsAddress ? (
                 <a
                   href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(school.gpsAddress)}`}
                   target="_blank"
                   rel="noreferrer noopener"
                   className="text-brand-700 hover:underline"
                 >
                   {school.gpsAddress}
                 </a>
               ) : '—' },
               { label: 'Coordinates', value: school.location?.latitude ? (
                 <a
                   href={`https://www.google.com/maps/search/?api=1&query=${school.location.latitude},${school.location.longitude}`}
                   target="_blank"
                   rel="noreferrer noopener"
                   className="text-brand-700 hover:underline"
                 >
                   {school.location.latitude}, {school.location.longitude}
                 </a>
               ) : '—' },
              { label: 'Phone', value: school.phone || '—' },
              { label: 'Email', value: school.email || '—' },
              { label: 'Website', value: school.website || '—' },
              { label: 'Founded', value: school.yearFounded || '—' },
              { label: 'Motto', value: school.motto || '—' },
              { label: 'Slug', value: school.slug || '—' },
            ].map((row) => (
              <Fact key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </Card>

        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Subscription</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Plan, billing period and onboarding state
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONES[school.status] || 'slate'} dot>
              {school.status || 'unknown'}
            </Badge>
            <Badge tone="brand">{subscription.plan || 'no plan'}</Badge>
            {subscription.status && <Badge tone="slate">{subscription.status}</Badge>}
          </div>

          <dl className="mt-3 divide-y divide-slate-100">
            <Fact label="Monthly fee" value={formatCedi(subscription.monthlyFee)} />
            <Fact
              label="Trial ends"
              value={subscription.trialEndsAt ? formatDate(subscription.trialEndsAt) : '—'}
            />
            <Fact
              label="Period"
              value={
                subscription.currentPeriodStart || subscription.currentPeriodEnd
                  ? `${subscription.currentPeriodStart ? formatDate(subscription.currentPeriodStart) : '—'} → ${
                      subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '—'
                    }`
                  : '—'
              }
            />
            <Fact label="Payment method" value={subscription.paymentMethod || '—'} />
            <Fact
              label="Onboarded"
              value={
                record?.onboardingCompletedAt
                  ? formatDate(record.onboardingCompletedAt)
                  : school?.name && school?.region
                    ? formatDate(school.createdAt)
                    : 'Not completed'
              }
              tone={
                record?.onboardingCompletedAt || (school?.name && school?.region)
                  ? 'text-ink'
                  : 'text-amber-600'
              }
            />
          </dl>
        </Card>

        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold leading-tight text-ink">Labels &amp; flags</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            What the platform has set, not the school
          </p>

          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Tags
          </p>
          {(record?.tags || []).length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {record.tags.map((tag) => (
                <Badge key={tag} tone="brand">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-[12px] font-semibold text-slate-400">None.</p>
          )}

          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Feature flags
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.keys(record?.featureFlags || {}).length === 0 ? (
              <span className="text-[12px] font-semibold text-slate-400">
                The server reported no flags for this school.
              </span>
            ) : (
              Object.entries(record?.featureFlags || {}).map(([flag, on]) => (
                <Badge key={flag} tone={on ? 'green' : 'slate'}>
                  {flag}
                </Badge>
              ))
            )}
          </div>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-slate-400">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Edit these in the Settings tab — each is a separate, separately audited write.</span>
          </p>
        </Card>
      </div>

      {/*
        Recent activity, from the detail payload rather than a second request. Ten
        rows is what `getAdminSchoolDetail` fetches and ten is enough to recognise a
        pattern; the Payments tab is where the full, paginated history lives, and
        putting a truncated list here next to a tab that has all of it would be two
        sources for one fact.

        An empty payload renders `EmptyState` rather than a blank card, because a
        school that has taken no payment yet and a request that returned nothing are
        different facts and must not look the same.
      */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-extrabold leading-tight text-ink">Recent payments</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              The last ten taken by this school
            </p>
          </div>
          <Link
            to={`${ADMIN_ROUTES.SCHOOL_DETAIL.replace(':schoolId', school._id)}?tab=payments`}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-700 hover:underline"
          >
            All payments
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {(record?.recentPayments || []).length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={CalendarClock}
              title="No payments recorded"
              description="This school has not taken a payment yet, or none of its payments are readable by the platform console."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <caption className="sr-only">The ten most recent payments for this school</caption>
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Reference
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Student
                  </th>
                  <th scope="col" className="pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    When
                  </th>
                  <th scope="col" className="pb-2 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {record.recentPayments.map((payment) => (
                  <tr key={payment._id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-[11px] font-bold text-slate-600">
                      {payment.paymentId || '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] font-extrabold text-ink">
                      {payment.studentId?.studentName || 'Unknown student'}
                    </td>
                    <td className="py-2.5 pr-3 text-[12px] font-semibold text-slate-500">
                      {formatDate(payment.createdAt)}
                    </td>
                    {/* Money is pesewas on the wire and cedis on screen. */}
                    <td className="py-2.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                      {formatCedi(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SchoolOverviewTab;