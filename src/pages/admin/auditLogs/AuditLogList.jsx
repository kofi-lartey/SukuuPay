import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, RotateCcw, ScrollText, ServerCrash, ShieldCheck } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import { Field } from '../../../components/common/FormField';
import AuditRow, { ADMIN_AUDIT_ACTIONS, CATEGORY_STYLE, isPlatformAction } from './AuditRow';
import { auditLogDetailPath } from './auditRoutes';
import { listAuditLogs } from '../../../services/admin';
import { AUDIT_ACTIONS } from '../../../services/auditLog';
import { formatCount } from '../../../utils/format';

/**
 * The platform-wide audit trail: every school's entries in one chronological stream.
 *
 * Backed end to end by `GET /admin/audit-logs` (`admin.js:1092`), which filters on
 * `schoolId`, `userId`, `action`, `entity`, `from`, `to` and paginates server-side. No
 * client-side filtering pretends to be server-side here — an auditor's first question is
 * specific ("who changed this student's record last Tuesday") and the answer has to be a
 * link they can paste into a report, which means the filters live in the query string and
 * the request carries them.
 *
 * Four things this screen is careful about, each of them a way to be misleading:
 *
 *   - **A failure is never an empty table.** `listAuditLogs` rejects, and this renders the
 *     server's message with a retry. "No entries match" and "the request failed" looking
 *     the same is the single worst failure mode on a screen whose entire job is evidence.
 *
 *   - **The `entity` filter is free text, exactly as the endpoint treats it.** The server
 *     matches `entity` exactly rather than by prefix, on purpose
 *     (`auditLogs.service.js:70-79`): a prefix match would silently widen `entity=User` into
 *     `UserImpersonation` and `UserSettings`, and the result — a longer list than the
 *     operator filtered for — reads as correct. So this input's hint says "exact model
 *     name", because the client cannot make the server's semantics obvious by itself.
 *
 *   - **A `schoolId` filter narrows the stream; an empty one does not.** The endpoint is
 *     the only read in the product that crosses schools
 *     (`admin.js:1082-1090`), so an unfiltered view *is* the platform-wide view and the
 *     header says so, rather than leaving a reader to wonder whether they are looking at
 *     their own school's log.
 *
 *   - **`admin.*` rows are marked as the owner's acts.** See `AuditRow`. The distinction
 *     between "a school did something to itself" and "someone outside that school did
 *     something to it" is the one an auditor most needs from a cross-tenant trail, and it
 *     is not visible in an `action` string that reads like every other one.
 */
const AuditLogList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const filters = useMemo(
    () => ({
      schoolId: searchParams.get('schoolId') || '',
      userId: searchParams.get('userId') || '',
      action: searchParams.get('action') || '',
      entity: searchParams.get('entity') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAuditLogs(filters)
      .then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  /** Any filter change resets to page 1 — otherwise page 9 of a new filter is empty. */
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== 'page') params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const hasFilters = Boolean(
    filters.schoolId || filters.userId || filters.action || filters.entity || filters.from || filters.to
  );

  const clearFilters = useCallback(
    () => setSearchParams(new URLSearchParams(), { replace: true }),
    [setSearchParams]
  );

  /*
    Counted from the loaded page, and said so. `meta.total` is the one figure here that is
    the whole matched set, and the KPI strip labels each tile with what it counts. A band of
    four numbers with no indication of what they count is how an auditor concludes from a
    partial picture that they have a complete one.
  */
  const onPage = useMemo(() => {
    const counts = { platform: 0, withDiff: 0, impersonated: 0 };
    state.rows.forEach((entry) => {
      if (isPlatformAction(entry.action)) counts.platform += 1;
      if (entry.before !== undefined || entry.after !== undefined) counts.withDiff += 1;
      if (entry.meta?.impersonationSessionId) counts.impersonated += 1;
    });
    return counts;
  }, [state.rows]);

  const tiles = [
    {
      label: 'Entries on record',
      value: formatCount(state.meta?.total ?? 0),
      detail: 'Everything matching these filters',
      tone: 'text-ink',
    },
    {
      label: 'Platform-console acts',
      value: formatCount(onPage.platform),
      detail: `of the ${state.rows.length} on this page`,
      tone: 'text-brand-700',
    },
    {
      label: 'With a before / after',
      value: formatCount(onPage.withDiff),
      detail: `of the ${state.rows.length} on this page`,
      tone: 'text-amber-700',
    },
    {
      label: 'Written while impersonating',
      value: formatCount(onPage.impersonated),
      detail: `of the ${state.rows.length} on this page`,
      tone: 'text-slate-600',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Audit log"
        description="Every school's entries in one stream, across every tenant and every platform administrator. Read-only by construction."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RotateCcw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} padding="p-4">
            <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {tile.label}
            </p>
            <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tile.tone}`}>
              {state.loading && tile.value === '0' ? '—' : tile.value}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{tile.detail}</p>
          </Card>
        ))}
      </div>

      <Card padding="p-4" className="mt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="School ID"
            value={filters.schoolId}
            onChange={(event) => setFilter('schoolId', event.target.value.trim())}
            placeholder="24-character id"
            hint="exact"
          />
          <Field
            label="User ID"
            value={filters.userId}
            onChange={(event) => setFilter('userId', event.target.value.trim())}
            placeholder="24-character id"
            hint="exact"
          />

          <div>
            <label
              htmlFor="audit-action"
              className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
            >
              Action
            </label>
            <select
              id="audit-action"
              value={filters.action}
              onChange={(event) => setFilter('action', event.target.value)}
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            >
              <option value="">All actions</option>
              {/*
                Two groups rather than one flat list. The `admin.*` actions are the ones
                that only ever appear in this console, and burying 26 of them under 29
                school-side actions in one dropdown is a filter nobody uses.
              */}
              <optgroup label="Platform console (outside every school)">
                {ADMIN_AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </optgroup>
              <optgroup label="School and system actions">
                {AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <Field
            label="Entity"
            value={filters.entity}
            onChange={(event) => setFilter('entity', event.target.value)}
            placeholder="User, Payment, PlatformSettings…"
            hint="exact match"
          />

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="audit-from"
                className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
              >
                From
              </label>
              <input
                id="audit-from"
                type="date"
                value={filters.from ? filters.from.slice(0, 10) : ''}
                onChange={(event) => setFilter('from', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="audit-to"
                className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
              >
                To
              </label>
              <input
                id="audit-to"
                type="date"
                value={filters.to ? filters.to.slice(0, 10) : ''}
                onChange={(event) => setFilter('to', event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/*
            The scope statement, on the filter row rather than in a header, because it is
            the scope the filters are operating over. `GET /admin/audit-logs` is the only
            read in the product that crosses schools (`admin.js:1082-1090`), so leaving the
            school filter empty means *every tenant* — which has to be said, because the
            same screen exists inside a school console at `/dashboard/activity-log` where
            an empty filter means one school.
          */}
          <p className="text-[11px]/[16px] font-semibold text-slate-500">
            {filters.schoolId ? (
              <>Filtered to one school. Every action shown is an act on that school, by someone in it or by the platform.</>
            ) : (
              <>
                <strong className="font-extrabold text-slate-700">
                  Scope: every school on the platform.
                </strong>{' '}
                This is the only read in SukuuPay that crosses tenants, so an empty school
                filter means all of them — not only yours.
              </>
            )}
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card padding="p-0" className="mt-4 overflow-hidden">
        {/* The legend. Without it the dots below are decoration. */}
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Stream
          </span>
          {Object.entries(CATEGORY_STYLE).map(([key, style]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
              {style.label}
            </span>
          ))}
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            Newest first · {formatCount(state.meta?.total ?? 0)} matched
          </span>
        </div>

        {state.error ? (
          <div className="p-5">
            <EmptyState
              icon={ServerCrash}
              title="The audit log could not be loaded"
              description={state.error.message || 'The request did not complete.'}
              action={
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  Try again
                </button>
              }
            />
          </div>
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ScrollText}
              title={hasFilters ? 'No entries match these filters' : 'Nothing has been audited yet'}
              description={
                hasFilters
                  ? 'Widen the date range or clear a filter. The screen is showing the truth about the query you asked, not about the platform.'
                  : 'Every payment, settings change, suspension, impersonation and export appears here as it happens.'
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg px-3 py-2 text-[13px] font-bold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.rows.map((entry) => (
              <AuditRow key={entry._id} entry={entry} to={auditLogDetailPath(entry._id)} />
            ))}
          </ul>
        )}

        {/*
          `onPerPageChange` is not optional in practice: `Pagination` wires its
          rows-per-page select unconditionally, so omitting the handler makes changing the
          page size throw on a server that did answer (`Pagination.jsx:49`).
        */}
        {state.meta && state.meta.total > 0 && (
          <Pagination
            meta={state.meta}
            itemLabel="audit entries"
            onPageChange={(page) => setFilter('page', String(page))}
            onPerPageChange={(perPage) => {
              setFilter('perPage', String(perPage));
              setFilter('page', '1');
            }}
          />
        )}
      </Card>

      {/*
        Stated rather than implied, because it is the one thing on this screen a reader
        might otherwise assume and be wrong about. `AuditLog` has no hash chain: it is
        insert-only by convention and by the absence of any write endpoint in
        `services/admin.js`, which is not the same guarantee. An auditor who believes the
        log is tamper-evident and finds it is not will have made every decision in
        between on a false premise.
      */}
      <p className="mt-4 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Read-only by design. This module has no create, update or delete endpoint — a log
          its own product can edit is not evidence of anything. Entries are timestamped on
          write and never edited afterwards, but the system does not compute a tamper-evident
          chain, so there is no integrity certificate to verify against.
        </span>
      </p>
    </>
  );
};

export default AuditLogList;
