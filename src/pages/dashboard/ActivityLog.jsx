import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Download,
  Filter,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useAuditLogs, useAuditStats, useAuditExport } from '../../hooks/useAuditLogs';
import { AUDIT_ACTIONS, AUDIT_CATEGORY, auditCategoryOf } from '../../services/auditLog';

/**
 * Reads an action into English.
 *
 * `sms.bulk_send` → "Bulk SMS sent". Derived rather than hand-written, because a
 * lookup table is a second list of the same 27 actions the backend validates
 * against, and the third one to drift.
 */
const humaniseAction = (action = '') => {
  const [, verb] = action.split('.');
  const phrase = (verb || action).replace(/_/g, ' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

/**
 * The domain a coloured dot stands for.
 *
 * A log with no legend is a list of coloured dots, and a reader who cannot name
 * a category cannot decide whether a red row is a failed payment or a failed
 * sign-in — which are not the same event and not the same urgency.
 */
const CATEGORY_STYLE = {
  finance: { dot: 'bg-emerald-500', label: AUDIT_CATEGORY.finance },
  messaging: { dot: 'bg-amber-500', label: AUDIT_CATEGORY.messaging },
  academic: { dot: 'bg-blue-500', label: AUDIT_CATEGORY.academic },
  security: { dot: 'bg-rose-500', label: AUDIT_CATEGORY.security },
};

const formatStamp = (value) => {
  if (!value) return '—';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '—';
  const today = new Date();
  const sameDay =
    when.getFullYear() === today.getFullYear() &&
    when.getMonth() === today.getMonth() &&
    when.getDate() === today.getDate();
  const time = when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return sameDay
    ? `Today · ${time}`
    : `${when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${time}`;
};

/**
 * The meta payload rendered under an entry.
 *
 * `meta` is `Mixed` on the model, so its shape is whatever the writing call site
 * passed. These three are the keys the codebase actually writes — a description
 * (audit log export), a failure reason (the invite flow), and a recipient (SMS
 * sends) — so they are promoted to their own row rather than dumped as raw JSON.
 *
 * Anything else is shown as key/value pairs. Showing the raw object is
 * deliberate: a school admin reading an unfamiliar key learns what the system
 * recorded, and hiding it would leave a confident blank where a fact is.
 */
const MetaChips = ({ meta }) => {
  const chips = [];
  if (!meta || typeof meta !== 'object') return null;

  if (meta.description) chips.push({ tone: 'slate', text: String(meta.description) });
  if (meta.emailSent === false) {
    chips.push({ tone: 'red', text: `Email not delivered${meta.failureReason ? ` — ${meta.failureReason}` : ''}` });
  }
  if (meta.isResend) chips.push({ tone: 'amber', text: 'Re-sent' });
  if (meta.recipients) chips.push({ tone: 'slate', text: `${meta.recipients} recipients` });
  if (meta.delivered) chips.push({ tone: 'slate', text: `${meta.delivered} delivered` });

  const described = new Set(chips.flatMap((chip) => chip.text.split(/[:—]/).map((s) => s.trim())));
  Object.entries(meta)
    .filter(([key, value]) => {
      if (['description', 'failureReason', 'emailSent', 'isResend'].includes(key)) return false;
      if (value === null || value === undefined || typeof value === 'object') return false;
      return !described.has(String(value));
    })
    .slice(0, 4)
    .forEach(([key, value]) => chips.push({ tone: 'slate', text: `${key}: ${value}` }));

  if (!chips.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.text} tone={chip.tone}>
          {chip.text}
        </Badge>
      ))}
    </div>
  );
};

/**
 * The Activity Log.
 *
 * Read-only by construction, and this module adds no way to write. There is no
 * create, update or delete in its surface and there should never be one: a log
 * its own product can edit is not evidence of anything.
 *
 * Two honesty decisions, both about what the page is allowed to claim.
 *
 * The KPI strip counts the loaded page and says so in each tile's detail line,
 * while `meta.total` — the one figure that is genuinely the whole log — is
 * labelled as the school's total on record. A band of four numbers reading
 * "1,482 / 48,550 / 428 / 0" with no indication of what they count is how a
 * school concludes it has a complete picture from a partial one.
 *
 * And there is no cryptographic-verification band. `AuditLog` is a plain
 * insert-only collection with no hash chain, so there is nothing to verify and no
 * certificate to download. Rendering a SHA-256 digest of the current page would
 * be decoration dressed as assurance — it would attest to nothing and a
 * regulator would read it as a claim of tamper-evidence the system does not have.
 */
const ActivityLog = () => {
  const { user } = useAuth();
  const toast = useToast();

  const schoolId = user?.schoolId;
  const [reloadKey, setReloadKey] = useState(0);

  const { entries, meta, loading, error, filters, setFilter, clearFilters, hasFilters } = useAuditLogs({
    schoolId,
    reloadKey,
  });

  const stats = useAuditStats(entries, meta);
  const { runExport, exporting } = useAuditExport({ schoolId, filters });

  const reload = () => setReloadKey((key) => key + 1);

  const handleExport = async () => {
    const result = await runExport();
    if (result) toast.success(`Exported ${result.filename}`);
    else toast.error('Could not export the audit trail. Check the filters and try again.');
  };

  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? 1;

  const tiles = useMemo(
    () => [
      {
        label: 'Audited events on record',
        value: stats.totalOnRecord,
        detail: 'Whole log, unpaginated',
        icon: ScrollText,
        tone: 'text-ink',
      },
      {
        label: 'Security & permissions',
        value: stats.byCategory.security || 0,
        detail: `of the ${stats.onThisPage} on this page`,
        icon: ShieldCheck,
        tone: 'text-rose-600',
      },
      {
        label: 'Messaging events',
        value: stats.byCategory.messaging || 0,
        detail: `of the ${stats.onThisPage} on this page`,
        icon: Clock,
        tone: 'text-amber-600',
      },
      {
        label: 'Flagged',
        value: null,
        detail: 'No tamper-evidence model',
        icon: AlertTriangle,
        tone: 'text-slate-400',
      },
    ],
    [stats]
  );

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Activity Log & Audit Trail"
        description="Immutable, timestamped record of every financial transaction, student modification and administrative action."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !schoolId}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} padding="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {tile.label}
                </p>
                <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tile.tone}`}>
                  {loading ? '—' : tile.value === null ? '—' : tile.value}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{tile.detail}</p>
              </div>
              <tile.icon className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
            </div>
          </Card>
        ))}
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              type="text"
              value={filters.entity}
              onChange={(event) => setFilter({ entity: event.target.value })}
              placeholder="Filter by record type (Student, Payment, User…)"
              aria-label="Filter by record type"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            />
          </div>

          <select
            value={filters.action}
            onChange={(event) => setFilter({ action: event.target.value })}
            aria-label="Filter by action"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <label htmlFor="audit-from" className="text-[11px] font-bold text-slate-500">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={filters.from ? filters.from.slice(0, 10) : ''}
              onChange={(event) => setFilter({ from: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink focus:border-brand-700 focus:outline-none"
            />
            <label htmlFor="audit-to" className="text-[11px] font-bold text-slate-500">
              to
            </label>
            <input
              id="audit-to"
              type="date"
              value={filters.to ? filters.to.slice(0, 10) : ''}
              onChange={(event) => setFilter({ to: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink focus:border-brand-700 focus:outline-none"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {/* The legend. Without it the dots below are decoration. */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Ledger stream
          </span>
          {Object.entries(CATEGORY_STYLE).map(([key, style]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
              {style.label}
            </span>
          ))}
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            Newest first · {meta?.total ?? 0} entries
          </span>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
            {error.message}
          </div>
        )}

        {loading && (
          <div className="px-4 py-16 text-center text-sm font-semibold text-slate-500">
            Loading the ledger…
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={ScrollText}
              title={hasFilters ? 'No entries match these filters' : 'No activity recorded yet'}
              description={
                hasFilters
                  ? 'Widen the date range or clear the filters. The export button applies the same filters, so it would return the same empty set.'
                  : 'Every payment, student record change and administrative action will appear here as it happens.'
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg px-3 py-2 text-[13px] font-bold text-brand-700 transition-colors hover:bg-brand-50"
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const category = auditCategoryOf(entry.action);
              const style = CATEGORY_STYLE[category];
              const actor = entry.userId;

              return (
                <li key={entry._id} className="flex gap-3 px-4 py-3.5 hover:bg-slate-50/50">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style ? style.dot : 'bg-slate-300'}`}
                    aria-label={style ? style.label : 'Uncategorised'}
                    title={style ? style.label : 'Uncategorised'}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[13px] font-extrabold text-ink">
                        {humaniseAction(entry.action)}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                        {entry.action}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {formatStamp(entry.createdAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {actor?.name || 'System'}
                        {actor?.role ? (
                          <span className="text-slate-400">({actor.role})</span>
                        ) : null}
                      </span>

                      {entry.entity && (
                        <span className="inline-flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
                          {entry.entity}
                          {entry.entityId ? (
                            <span className="font-mono text-[10px] text-slate-400">
                              {String(entry.entityId).slice(-8)}
                            </span>
                          ) : null}
                        </span>
                      )}

                      {entry.ip && <span className="font-mono text-[11px] text-slate-400">{entry.ip}</span>}
                    </div>

                    <MetaChips meta={entry.meta} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] font-medium text-slate-500">
              Showing {(meta.page - 1) * meta.perPage + 1}–
              {Math.min(meta.page * meta.perPage, meta.total)} of {meta.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter({ page: currentPage - 1 }, { resetPage: false })}
                disabled={currentPage <= 1 || loading}
                className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[12px] font-bold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setFilter({ page: currentPage + 1 }, { resetPage: false })}
                disabled={currentPage >= totalPages || loading}
                className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/*
        Stated rather than implied, because it is the one thing on this page a
        reader might otherwise assume and be wrong about. `AuditLog` has no hash
        chain: it is insert-only by convention and by the absence of any write
        endpoint in this module, which is not the same guarantee.
      */}
      <p className="mt-4 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Read-only by design. This module has no create, update or delete endpoint — a log its
          own product can edit is not evidence of anything. Entries are timestamped on write and are
          never edited afterwards, but the system does not yet compute a tamper-evident chain, so
          there is no integrity certificate to verify against.
        </span>
      </p>
    </>
  );
};

export default ActivityLog;