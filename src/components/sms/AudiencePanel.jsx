import React from 'react';
import { ChevronDown, CircleAlert, Loader2 } from 'lucide-react';
import Badge, { NETWORK_DOTS } from '../dashboard/ui/Badge';
import StudentMultiSelect from './StudentMultiSelect';
import { formatCediShort, formatCount } from '../../utils/format';

/**
 * Step 1: who gets this.
 *
 * Each rule is a radio card, not a dropdown, because the rules are not equally
 * consequential and a list hides that. "All owing" and "Overdue only" are
 * everyday; "Whole school" messages 2,000 parents including the ones who have
 * paid, and it costs real money each time. A dropdown that presents those four
 * options as peers is how a bursar accidentally emails a settled parent a
 * demand for money they do not owe.
 *
 * Every card shows a live count and a live value from the audience preview, and
 * the counts come from the server rather than from the roster page. The
 * difference is the whole reason the feature exists: a bursar who picked
 * "Overdue only" and saw 87 must be able to trust that 87, and only a query
 * against the ledger can say.
 */

/** MTN / Telecel / AirtelTigo, in the order the design stacks them. */
const NETWORKS = [
  { key: 'mtn', label: 'MTN', dot: 'mtn' },
  { key: 'telecel', label: 'Telecel', dot: 'telecel' },
  { key: 'airteltigo', label: 'AT Money', dot: 'at' },
];

/** The recipient bar: who a broadcast reaches, by operator. */
const NetworkSplit = ({ split, total, loading }) => {
  if (loading) {
    return (
      <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" aria-hidden="true" />
    );
  }
  if (!total) return null;

  return (
    <>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={NETWORKS.map((n) => `${n.label} ${Math.round(((split?.[n.key] || 0) / total) * 100)}%`).join(', ')}
      >
        {NETWORKS.map((network) => {
          const count = split?.[network.key] || 0;
          if (!count) return null;
          return (
            <span
              key={network.key}
              className={NETWORK_DOTS[network.dot]}
              style={{ width: `${(count / total) * 100}%` }}
            />
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {NETWORKS.map((network) => {
          const count = split?.[network.key] || 0;
          return (
            <span key={network.key} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className={`h-2 w-2 rounded-full ${NETWORK_DOTS[network.dot]}`} aria-hidden="true" />
              {network.label} ({Math.round((count / total) * 100)}%)
            </span>
          );
        })}
      </div>
    </>
  );
};

/**
 * One radio card. Selected state is the whole visual.
 *
 * The `<input>` is controlled and its `onChange` calls `onSelect`, rather than
 * being `readOnly` inside a wrapping `<label>`. A read-only radio inside a label
 * looks clickable and is not: clicking anywhere on the card moves nothing, which
 * is the exact failure where a bursar clicks "Overdue only", sees no change,
 * and concludes the filter is broken.
 */
const AudienceCard = ({ rule, selected, count, value, valueLabel, badge, onSelect, children }) => (
  <label
    className={`block cursor-pointer rounded-2xl border-2 bg-white p-4 transition-colors ${
      selected ? 'border-brand-700' : 'border-slate-200 hover:border-slate-300'
    }`}
  >
    <div className="flex items-start gap-3">
      <input
        type="radio"
        name="sms-audience"
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
        checked={selected}
        onChange={onSelect}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-extrabold text-ink">{rule.title}</p>
          {badge && <Badge tone="red">{badge}</Badge>}
        </div>

        <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">
          {rule.description}
        </p>

        {children}

        <div className="mt-2.5 flex items-end justify-between gap-3">
          {selected && count !== null ? (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {valueLabel}
                </p>
                <p className="text-[12px] font-extrabold text-ink">{value}</p>
              </div>
              <Badge tone={count > 0 ? 'brand' : 'slate'}>
                {formatCount(count)} parent{count === 1 ? '' : 's'}
              </Badge>
            </>
          ) : count !== null && count > 0 ? (
            <Badge tone="slate">{formatCount(count)} parents</Badge>
          ) : null}
        </div>
      </div>
    </div>
  </label>
);

const AudiencePanel = ({
  audienceType,
  setAudienceType,
  audienceRules,
  classFilter,
  setClassFilter,
  classes,
  studentIds,
  setStudentIds,
  preview,
  loading,
  error,
  excludeRecentPayers,
  setExcludeRecentPayers,
  recentPaymentWindowHours,
  setRecentPaymentWindowHours,
  dueSoonDays,
  setDueSoonDays,
  gracePeriodDays,
  setGracePeriodDays,
  minBalance,
  setMinBalance,
}) => {
  const countFor = (type) => (audienceType === type && preview ? preview.matchCount : null);
  const valueFor = (type) => {
    // `students` answers before the preview does, because the count is known the
    // moment a name is ticked. Falling through to the shared "Total school debt"
    // told a bursar their four hand-picked families owed the whole school's debt.
    if (audienceType === type && type === 'students') {
      return studentIds?.length
        ? `${formatCount(studentIds.length)} student${studentIds.length === 1 ? '' : 's'} chosen`
        : 'None chosen yet';
    }
    if (audienceType !== type || !preview) return '—';
    if (type === 'class') return 'In the selected class';
    if (type === 'all') return 'Every active student';
    if (type === 'installment_due_soon') return `Due within ${dueSoonDays} day${dueSoonDays === 1 ? '' : 's'}`;
    if (type === 'overdue') return 'Immediate arrears';
    return 'Total school debt';
  };

  return (
    <section aria-label="Select audience" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white">
            1
          </span>
          Select Audience
        </h2>
        <Badge tone="slate">Term 1 (2025/26)</Badge>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-red-700">{error.message}</p>
        </div>
      )}

      {audienceRules.map((rule) => (
        <AudienceCard
          key={rule.value}
          rule={rule}
          badge={rule.badge}
          selected={audienceType === rule.value}
          count={countFor(rule.value)}
          value={valueFor(rule.value)}
          valueLabel={
            rule.value === 'all'
              ? 'Includes settled'
              : rule.value === 'class' || rule.value === 'students'
                ? 'Scope'
                : 'Outstanding'
          }
          onSelect={() => setAudienceType(rule.value)}
        >
          {audienceType === rule.value && rule.value === 'class' && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-semibold text-slate-700" htmlFor="sms-class">
                Class
              </label>
              <div className="relative">
                <select
                  id="sms-class"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                >
                  <option value="">Select a class…</option>
                  {classes.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
              </div>
              {!classFilter && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                  Pick a class to size this audience.
                </p>
              )}
            </div>
          )}

          {/*
            The one rule with no server-side audience of its own.

            Every other card resolves to a population from a query, so choosing it
            is enough — this one names its recipients outright, and the server turns
            `audience.studentIds` into `_id: { $in: … }`. So it renders a picker,
            and with nothing picked the preview is suppressed rather than requested:
            asking the server to resolve an empty recipient list is what surfaced
            `audience.type "students" requires studentIds` as a red banner the
            instant this card was selected.
          */}
          {audienceType === rule.value && rule.value === 'students' && (
            <StudentMultiSelect selectedIds={studentIds} onChange={setStudentIds} />
          )}

          {audienceType === rule.value && rule.value === 'overdue' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-slate-700">
                Grace period (days)
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={gracePeriodDays}
                  onChange={(event) => setGracePeriodDays(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </label>
              <label className="text-[11px] font-semibold text-slate-700">
                Minimum balance (GH₵)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={(minBalance / 100).toFixed(2)}
                  onChange={(event) =>
                    setMinBalance(Math.round((Number(event.target.value) || 0) * 100))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </label>
            </div>
          )}

          {audienceType === rule.value && rule.value === 'installment_due_soon' && (
            <div className="mt-3">
              <label className="text-[11px] font-semibold text-slate-700" htmlFor="sms-due-soon">
                Tranche due within (days)
                <input
                  id="sms-due-soon"
                  type="number"
                  min="1"
                  max="90"
                  value={dueSoonDays}
                  onChange={(event) => setDueSoonDays(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </label>
            </div>
          )}

          {audienceType === rule.value && preview && (
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              {rule.value === 'all' ? 'Includes settled students' : 'Outstanding'}:{' '}
              <span className="font-extrabold text-ink">
                {formatCediShort(preview.totalBalance)}
              </span>
            </p>
          )}
        </AudienceCard>
      ))}

      {/* Opt-outs. Grouped under the rules rather than given a rule of their own,
          because "who owes" and "who has just paid" are different questions and
          the answer to the second is a subtraction from the first. */}
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={excludeRecentPayers}
            onChange={(event) => setExcludeRecentPayers(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-ink">Exclude recent payers</p>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">
              Skips parents who completed any partial or full MoMo payment in the
              last{' '}
              {excludeRecentPayers ? (
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={recentPaymentWindowHours}
                  onChange={(event) => setRecentPaymentWindowHours(event.target.value)}
                  className="mx-1 w-16 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-extrabold text-ink focus:border-brand-700 focus:outline-none"
                  aria-label="Recent payment window in hours"
                />
              ) : (
                48
              )}{' '}
              hours to avoid duplicate complaints.
            </p>
          </div>
        </label>
      </div>

      {/* The recipient summary, once it is real. */}
      {preview && preview.matchCount > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[13px] font-extrabold text-ink">
            {formatCount(preview.matchCount)} recipient{preview.matchCount === 1 ? '' : 's'} selected
          </p>

          <div className="mt-3">
            <NetworkSplit split={preview.networkSplit} total={preview.matchCount} loading={loading} />
          </div>

          {/* Skips are reported, not hidden. A school that selects "overdue" and
              gets 87 of an expected 120 has been told nothing by 87 alone — but
              "31 had a number that will not normalise" is something they can fix
              in the roster, and it is the difference between a bursar chasing a
              bug and a bursar fixing their data. */}
          {preview.skipped?.invalid_number > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formatCount(preview.skipped.invalid_number)} parent
              {preview.skipped.invalid_number === 1 ? '' : 's'} matched but{' '}
              {preview.skipped.invalid_number === 1 ? 'has' : 'have'} a number that will
              not normalise. Fix those in the roster to reach them.
            </p>
          )}

          {loading && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Sizing audience…
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AudiencePanel;
