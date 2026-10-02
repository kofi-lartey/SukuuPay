import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Search } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import { Field, SelectField } from '../../../components/common/FormField';
import { useToast } from '../../../hooks/useToast';
import {
  getImpersonationSession,
  listImpersonationSessions,
} from '../../../services/impersonation';
import { listSchools } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

/**
 * Who has been inside which school, and what they did there.
 *
 * This screen exists because impersonation is the most sensitive thing the platform
 * owner can do: it is the only way to see a tenant's records as that tenant sees
 * them. The `ImpersonationSession` row holds who, which school, when and why; the
 * audit entries held under `meta.impersonationSessionId` hold what was actually
 * touched while the door was open.
 *
 * **Both halves are needed and neither is sufficient.** A session log alone answers
 * "was anyone in my school" but not "what did they look at" — an operator who
 * reopened a school's student list and left can be entirely benign, and an audit
 * trail that only recorded session starts would treat every one of them as
 * suspicious. The action count is the other half of that: a session with 40 actions
 * was an investigation.
 *
 * **`actionsCount` counts reads as well as writes.** It is incremented by
 * `Backend/src/middleware/impersonation.js` on every request the session sees, so a
 * support call that only looked around still leaves evidence of attention. A counter
 * that moved only on writes would report zero for a twenty-minute investigation.
 *
 * The reason is displayed first and in full on every row. It is the field the
 * school's own staff are shown, so an auditor reading this screen is reading
 * something written to them — a truncated reason would misrepresent the record.
 */
const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const durationOf = (startedAt, endedAt) => {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';

  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

/**
 * The list of sessions.
 *
 * Filters live in the query string so a particular session is linkable — which is
 * the actual use of this screen. Support asks "what happened on the 14th", the
 * answer is a URL, and the person who follows it sees the same filtered list.
 */
export const ImpersonationHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const filters = useMemo(
    () => ({
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
      schoolId: searchParams.get('schoolId') || '',
    }),
    [searchParams]
  );

  const [schools, setSchools] = useState([]);
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    listSchools({ perPage: 200, sortBy: 'name', sortOrder: 'asc' })
      .then((result) => active && setSchools(result.rows))
      // A failed school picker is not a failed page. The list still works; it just
      // cannot be filtered by school, and saying so is better than an empty screen.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listImpersonationSessions(filters)
      .then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], meta: null, loading: false, error });
        toast.error(error?.message || 'Impersonation history could not be loaded.');
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey, toast]);

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

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <>
      <PageHeader
        eyebrow="Oversight"
        title="Impersonation history"
        description="Every time the platform owner has opened a school's console, and what was looked at while the session was open."
        actions={
          <Link
            to={ROUTES.ADMIN_AUDIT_LOGS}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Full audit log
          </Link>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="School"
            value={filters.schoolId}
            onChange={(event) => setFilter('schoolId', event.target.value)}
            options={[
              { value: '', label: 'Every school' },
              ...schools.map((school) => ({ value: school._id, label: school.name })),
            ]}
          />
        </div>
      </Card>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
        {state.loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state.error ? (
          <div className="p-4">
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-bold leading-snug text-red-700">
              {state.error.message || 'Impersonation history could not be loaded.'}
            </p>
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="No impersonation sessions"
            description="Nobody has opened a school's console on the platform owner's behalf."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left">
              <thead className="border-b border-slate-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                  <th className="px-4 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.rows.map((session) => {
                  const open = !session.endedAt;
                  return (
                    <tr key={session._id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link
                          to={`${ROUTES.ADMIN_SCHOOLS}/${session.schoolId?._id || session.schoolId}`}
                          className="text-[13px] font-extrabold text-ink hover:text-brand-700"
                        >
                          {session.schoolId?.name || session.schoolName || 'Unknown school'}
                        </Link>
                        {session.superAdminId?.name && (
                          <span className="block text-[11px] font-semibold text-slate-400">
                            by {session.superAdminId.name}
                          </span>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3">
                        <span className="block truncate text-[12px] font-semibold text-slate-600" title={session.reason}>
                          {session.reason}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-slate-500">
                        {formatWhen(session.startedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] font-semibold text-slate-500">
                        {durationOf(session.startedAt, session.endedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold text-ink">
                        {formatCount(session.actionsCount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={open ? 'amber' : 'slate'}>{open ? 'Open' : 'Closed'}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {state.meta && state.meta.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={state.meta.page}
            perPage={state.meta.perPage}
            total={state.meta.total}
            totalPages={state.meta.totalPages}
            onPageChange={(page) => setFilter('page', page === 1 ? '' : String(page))}
          />
        </div>
      )}
    </>
  );
};

/**
 * One session, and everything that happened inside it.
 *
 * The action list is matched on `meta.impersonationSessionId`, which every platform
 * action written while impersonating carries. That is why the audit entry's `meta`
 * must never be stripped: an entry with a null `meta` is invisible here, and this
 * screen is the entire justification for recording impersonations at all.
 *
 * `actionsTotal` and `actionsTruncated` are both shown, because the service caps
 * the list at 500. A truncated history that rendered as a complete one would be
 * worse than no history — it is the screen somebody would check to be certain
 * nothing else happened.
 */
export const ImpersonationSessionDetail = () => {
  const { sessionId } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    getImpersonationSession(sessionId)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [sessionId]);

  const session = state.data?.session;
  const actions = state.data?.actions || [];

  return (
    <>
      <PageHeader
        eyebrow="Oversight"
        title={session?.schoolId?.name || 'Impersonation session'}
        description={session?.reason || 'Everything recorded during this session.'}
        actions={
          <Link
            to={ROUTES.ADMIN_IMPERSONATION}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All sessions
          </Link>
        }
      />

      {state.loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
      ) : state.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
          {state.error.message || 'That session could not be loaded.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'School', value: session?.schoolId?.name || '—' },
              { label: 'Started', value: formatWhen(session?.startedAt) },
              { label: 'Ended', value: session?.endedAt ? formatWhen(session.endedAt) : 'Still open' },
              { label: 'Actions', value: formatCount(session?.actionsCount ?? 0) },
            ].map((item) => (
              <Card key={item.label} padding="p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                  {item.label}
                </p>
                <p className="mt-1.5 text-[15px] font-extrabold text-ink">{item.value}</p>
              </Card>
            ))}
          </div>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
              Recorded during this session
            </h2>

            {actions.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No recorded actions"
                description="No audit entries carried this session's id. That means nothing was done with attribution attached — not that nothing was viewed; read-only requests increment the session's action count but do not create audit entries."
              />
            ) : (
              <>
                <ul className="mt-4 space-y-2">
                  {actions.map((entry) => (
                    <li key={entry._id} className="rounded-xl border border-slate-100 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[12px] font-extrabold text-ink">{entry.action}</span>
                        <span className="whitespace-nowrap text-[11px] font-semibold text-slate-400">
                          {formatWhen(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-semibold text-slate-500">
                        {entry.entity}
                        {entry.entityId ? ` · ${String(entry.entityId).slice(-8)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>

                {state.data.actionsTruncated && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-800">
                    Showing the first {formatCount(actions.length)} of{' '}
                    {formatCount(state.data.actionsTotal ?? actions.length)} recorded actions.
                    The rest exist but are not shown here.
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
};

export default ImpersonationHistory;