import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Info, ScrollText, ServerCrash } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import AuditRow from './AuditRow';
import { getImpersonationAudit } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

/**
 * Everything that was done inside one impersonation session.
 *
 * This is the screen that justifies recording impersonations at all. `ImpersonationSession`
 * is the durable record that a session *happened*; this is the record of what the operator
 * did while it was open, and without it "the owner logged into a school" is a fact with no
 * consequence attached. It is reached from every audit entry written inside a session
 * (`AuditRow` links to it, `AuditLogDetail` gives it a panel), which is why a link to it
 * must never be dead.
 *
 * **The empty state says "nothing was audited", not "nothing happened" — and that is the
 * single most important sentence on the page.**
 *
 * The query matches on `meta.impersonationSessionId` inside an untyped `Mixed` field
 * (`Backend/src/services/admin/auditLogs.service.js:408-412`). A read that writes nothing
 * writes nothing: an operator who spent twenty minutes looking at a school's payments and
 * changed nothing leaves no audit row at all. So an empty list is the expected result of a
 * read-only investigation and would look identical to a session that never happened. The
 * server says exactly this in its `meta.note`, and it is stated here in the console's own
 * words because that is where the operator is looking.
 *
 * **A gap that is worked around, not hidden:** `admin.js`'s `getImpersonationAudit` returns
 * only `{ rows, meta }`, while the endpoint returns `{ session, data, meta }`
 * (`auditLogs.service.js:442-475`). The `session` block — which school, which
 * administrator, the reason, the start and end times, and `actionsCount` — is therefore
 * discarded before this page can read it. That is why there is no session header above the
 * list, and why `meta.total` cannot be trusted as a page count: `toPageMeta` is handed
 * `{returned, limit, note}` and every one of the four keys it reads is absent, so the
 * pager would render "1 of 1" over a page that is silently capped at 200. This screen
 * therefore uses `rows.length` and says what the number is. Reported to the coordinator:
 * `getImpersonationAudit` should pass `session` and `meta` through unchanged.
 */
const ImpersonationAudit = () => {
  const { sessionId } = useParams();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getImpersonationAudit(sessionId)
      .then((result) =>
        active && setState({ rows: result.rows || [], loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], loading: false, error }));
    return () => {
      active = false;
    };
  }, [sessionId, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Impersonation session"
        description="Everything the platform owner did while signed in as somebody in this school."
        actions={
          <Link
            to={ROUTES.ADMIN_AUDIT_LOGS}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the audit log
          </Link>
        }
      />

      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Session</h2>
            <p className="mt-1 font-mono text-[12px] font-bold text-slate-500 break-all">
              {sessionId}
            </p>
          </div>
          <Badge tone="slate">{`${formatCount(state.rows.length)} audited entries`}</Badge>
        </div>

        {/*
          Stated on the screen rather than discovered later. The session's own record —
          which school, which administrator, the reason they gave, how many requests it
          served — is on `ImpersonationSession` and would be the header here, but
          `services/admin.js`'s `getImpersonationAudit` does not return it (see the module
          comment). Saying so is better than showing an empty header that looks like the
          session has no school attached to it.
        */}
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-[12px]/[19px] font-medium text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            This screen lists audit entries only. The session&rsquo;s own header — the school,
            the administrator, the reason recorded for it and the number of requests it served
            — is not available through this service function; open{' '}
            <code className="font-mono">/admin/impersonate/sessions/{sessionId}</code> for
            that. Both records belong to the same session and neither is complete without the
            other.
          </span>
        </p>
      </Card>

      <Card padding="p-0" className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Written while impersonating
          </span>
          <span className="ml-auto text-[11px] font-medium text-slate-500">
            Newest first · {formatCount(state.rows.length)} shown
          </span>
        </div>

        {state.error ? (
          <div className="p-5">
            <EmptyState
              icon={ServerCrash}
              title="This session's activity could not be loaded"
              description={state.error.message || 'The request did not complete.'}
              action={
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  Try again
                </button>
              }
            />
          </div>
        ) : state.loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ScrollText}
              title="Nothing in this session was audited"
              description="That does not mean the operator did nothing. A read writes nothing, so an investigation that changed nothing leaves no row here — and the session's own request count is the cross-check, which the service function above does not return."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.rows.map((entry) => (
              <AuditRow key={entry._id} entry={entry} to={null} showImpersonationLink={false} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default ImpersonationAudit;
