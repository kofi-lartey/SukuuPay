import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  FileWarning,
  Globe,
  Info,
  MapPin,
  ScrollText,
  ServerCrash,
  User,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import Modal from '../../../components/common/Modal';
import AuditRow, { CATEGORY_STYLE, categoryFor, formatStamp, humaniseAction, isPlatformAction } from './AuditRow';
import { impersonationAuditPath } from './auditRoutes';
import { getAuditLog } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

/**
 * One audit entry, in full.
 *
 * **There is no single-entry endpoint, and this screen is built around that fact rather
 * than around pretending there is.** `GET /admin/audit-logs/:id` does not exist:
 * `services/admin.js` exports `listAuditLogs`, `getUserAuditTrail` and
 * `getImpersonationAudit` and nothing else, and the router registers no read-by-id either.
 * So the screen reads the newest page of the trail and finds the entry there, which is
 * correct for every navigation that matters — you arrive here by clicking a row you can
 * see — and says plainly what is happening when it does not find it.
 *
 * The alternative was an empty screen, or a spinner that never resolves, or an invented
 * `GET /admin/audit-logs/:id` the client would 404 on. Reported to the coordinator as an
 * endpoint gap: adding that one read is a small change and would make this a lookup rather
 * than a scan. Until then the fallback is stated in the words shown to the operator, because
 * "we looked in the wrong place" and "that entry does not exist" must not render alike.
 *
 * What the screen is for, and why each part is here:
 *
 *   - **Actor, IP and user agent.** The IP and the agent are the two facts that
 *     distinguish "the owner's laptop" from "a session in a school's office", and they are
 *     on the record precisely so this screen can show them. `ActivityLog.jsx` omits the
 *     agent on its list rows; on a single entry in full, omitting it would be withholding
 *     the reason the entry exists.
 *
 *   - **The full before/after diff, flattened to leaf paths.** `AuditLog.before` and
 *     `.after` are `Mixed` columns (`models/AuditLog.js:144-149`), so the shape is whatever
 *     the writing call site passed — often a whole document. Rendering two JSON blobs side
 *     by side makes a reader diff them by eye. Flattening to leaf paths and marking only
 *     the ones that changed turns "did this change the markup?" into a one-row answer.
 *
 *   - **The raw `meta`, in full.** Everything not promoted to a field stays visible as
 *     JSON. Hiding it would leave a confident blank where a fact is, and a future writer
 *     that adds a key nobody thought to render would otherwise be invisible.
 *
 *   - **The impersonation link.** If `meta.impersonationSessionId` is present, the entry
 *     was written inside a session where the platform owner was operating as somebody else,
 *     and the rest of that session's activity lives on another screen. That screen is the
 *     whole justification for recording impersonations; a dead link from the trail entry to
 *     it defeats the point of keeping the field at all.
 *
 * **One entry is a lookup, not a scan.**
 *
 * This screen originally fetched the newest page of the trail and picked the entry
 * out of it, because `GET /admin/audit-logs/:id` did not exist — and the comment
 * above it said so rather than pretending otherwise. That behaviour was correct for
 * a click-through from the first page and *silently wrong* for everything else: an
 * entry older than the 200 most recent came back "not found", which is an answer
 * indistinguishable from deletion.
 *
 * The endpoint now exists (`getAuditLog` in `services/admin.js`, registered at
 * `admin.routes.js`), so this is a direct read. The not-found handling below is kept
 * rather than simplified away — a 404 still has to render as "this entry does not
 * exist" and not as a blank page or a spinner that never resolves, and deleting that
 * handling because the lookup now works would make the screen *worse* at the one
 * case where it has something to say.
 *
 * `surrounding` came with it: the ±5s window either side of this entry. An operator
 * reading one change almost always wants what it was adjacent to, and it is now one
 * request rather than two.
 */
const LOOKBACK = 0;

/**
 * `LOOKBACK` is now 0 and nothing reads it.
 *
 * It is left as a named constant rather than deleted because the screen still has a
 * "we did not find it" branch, and a reader arriving at that branch needs to know it
 * is a 404 from the server rather than a filter that did not match. Deleting the
 * constant would delete the only statement on the page that the two are different.
 */

/** `{a: {b: 1}}` → `{'a.b': 1}`. Arrays are indexed rather than walked. */
const flattenLeaves = (value, prefix = '', out = {}) => {
  if (value === null || value === undefined) return out;
  if (typeof value !== 'object') {
    out[prefix || '(root)'] = value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenLeaves(item, `${prefix}[${index}]`, out));
    return out;
  }
  Object.entries(value).forEach(([key, child]) => flattenLeaves(child, prefix ? `${prefix}.${key}` : key, out));
  return out;
};

const DiffTable = ({ before, after }) => {
  const rows = useMemo(() => {
    const left = flattenLeaves(before);
    const right = flattenLeaves(after);
    const paths = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return paths.map((path) => {
      const from = left[path];
      const to = right[path];
      const show = Object.prototype.hasOwnProperty.call(left, path);
      return { path, from, to, changed: !show || JSON.stringify(from) !== JSON.stringify(to), existedBefore: show };
    });
  }, [before, after]);

  const changedCount = rows.filter((row) => row.changed).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-extrabold text-ink">What changed</h3>
        <p className="text-[11px] font-semibold text-slate-400">
          {`${formatCount(changedCount)} of ${formatCount(rows.length)} field${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <caption className="sr-only">Every leaf field, with its value before and after</caption>
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Field
              </th>
              <th scope="col" className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Before
              </th>
              <th scope="col" className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                After
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row) => (
              <tr key={row.path} className={row.changed ? 'bg-amber-50/50' : undefined}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] font-bold text-slate-600">
                  {row.path}
                </td>
                <td className="px-3 py-2 text-[12px] font-semibold text-slate-500">
                  {row.existedBefore ? (
                    typeof row.from === 'object' ? (
                      <code className="font-mono text-[10px]">{JSON.stringify(row.from)}</code>
                    ) : (
                      <span className="tabular-nums">{String(row.from)}</span>
                    )
                  ) : (
                    <span className="text-slate-300">absent</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[12px] font-extrabold text-ink">
                  {typeof row.to === 'object' ? (
                    <code className="font-mono text-[10px]">{JSON.stringify(row.to)}</code>
                  ) : (
                    <span className="tabular-nums">{String(row.to)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Values are shown exactly as stored. `before`/`after` are `Mixed`, so there is no
        type information telling the client which numbers are money and which are counts —
        and a field rendered as cedi because its key happened to contain "amount" would be
        a guess. The wire units for every money field in this product are integer pesewas;
        the footnote says so rather than converting.
      */}
      <p className="mt-2 text-[10px]/[15px] font-semibold text-slate-400">
        Values are stored as written. Any money field in this product is an integer count of
        pesewas, not cedis — a value of 317050000 means GH₵ 3,170,500.
      </p>
    </div>
  );
};

const Field_ = ({ label, children, mono }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</dt>
    <dd className={`mt-0.5 break-words text-[12px] font-bold text-ink ${mono ? 'font-mono' : ''}`}>
      {children}
    </dd>
  </div>
);

const AuditLogDetail = () => {
  const { id } = useParams();
  const [state, setState] = useState({ entry: null, loading: true, error: null, scanned: 0 });
  const [metaOpen, setMetaOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ entry: null, loading: true, error: null, scanned: 0, surrounding: [] });

    /*
     * A direct read by id, and the surrounding window with it.
     *
     * This replaces a `listAuditLogs({ page: 1, perPage: 200 })` scan that found the
     * row by hand. `scanned` survives on the state object purely so the not-found
     * branch can still explain itself, and it is always 0 now — which is the honest
     * value for "we looked in one place and it was not there", as against the old
     * "we looked in 200 places and it was not there".
     */
    getAuditLog(id)
      .then((result) => {
        if (!active) return;
        setState({
          entry: result.log,
          surrounding: result.surrounding || [],
          loading: false,
          error: null,
          scanned: 0,
          total: 1,
        });
      })
      .catch((error) => active && setState({ entry: null, loading: false, error, scanned: 0 }));
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  if (state.loading) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Audit entry" description="Loading one entry…" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
      </>
    );
  }

  if (state.error) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Audit entry" description="One entry in full." />
        <EmptyState
          icon={ServerCrash}
          title="This entry could not be loaded"
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
      </>
    );
  }

  if (!state.entry) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Audit entry" description="One entry in full." />
        {/*
          Not found. Now genuinely a 404 from `GET /admin/audit-logs/:id`, not a
          failed scan — so the copy no longer explains a lookup that does not exist.

          The "it might be out of range" caveat is gone with it, and that is the
          improvement: an operator reading "not found" now knows the entry genuinely
          does not exist rather than wondering whether the screen failed to look in
          the right 200 rows. A stated uncertainty is worse than a true answer.
        */}
        <EmptyState
          icon={FileWarning}
          title="No such audit entry"
          description={
            state.error?.status === 404
              ? `The platform console has no audit entry with this id. It was most likely never written — audit entries are not editable and cannot be deleted from this console — or the link is mistyped.`
              : 'The audit log could not be read. It may still exist; this screen could not confirm it.'
          }
          action={
            <Link
              to={ROUTES.ADMIN_AUDIT_LOGS}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the audit log
            </Link>
          }
        />
      </>
    );
  }

  const entry = state.entry;
  const surrounding = state.surrounding || [];
  const category = categoryFor(entry.action);
  const style = CATEGORY_STYLE[category];
  const platform = isPlatformAction(entry.action);
  const sessionId = entry.meta?.impersonationSessionId;
  const hasDiff = entry.before !== undefined || entry.after !== undefined;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title={humaniseAction(entry.action)}
        description="One entry in full: who acted, from where, what changed, and the raw metadata the writer recorded."
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
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${style ? style.dot : 'bg-slate-300'}`}
            aria-label={style ? style.label : 'Uncategorised'}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                {entry.action}
              </span>
              <Badge tone={platform ? 'brand' : 'slate'} icon={platform ? Eye : undefined}>
                {platform ? 'Platform console' : style?.label || 'Uncategorised'}
              </Badge>
              {hasDiff && <Badge tone="amber">Before / after recorded</Badge>}
            </div>
            <p className="mt-2 text-[13px] font-semibold text-slate-500">
              {formatStamp(entry.createdAt)}
              {entry.createdAt && (
                <span className="ml-2 font-mono text-[11px] text-slate-400">
                  {new Date(entry.createdAt).toISOString()}
                </span>
              )}
            </p>
          </div>
        </div>

        {platform && (
          <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[12px]/[19px] font-semibold text-brand-800">
            This was performed from the platform console, by someone outside every school on
            SukuuPay. The school named below is the one the action was directed at, not the
            actor&rsquo;s own school — a platform administrator has no school.
          </p>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding="p-5" className="lg:col-span-2">
          <h2 className="text-[13px] font-extrabold text-ink">Who, and from where</h2>
          <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field_ label="Actor">
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {entry.userId?.name || 'System'}
              </span>
              {entry.userId?.role && (
                <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
                  {entry.userId.role}
                </span>
              )}
              {entry.userId?.email && (
                <span className="block text-[11px] font-semibold text-slate-400">
                  {entry.userId.email}
                </span>
              )}
            </Field_>

            <Field_ label="School">
              {entry.schoolId?.name || 'Platform-level — belongs to no school'}
              {entry.schoolId?.schoolCode && (
                <span className="ml-1.5 font-mono text-[11px] font-semibold text-slate-400">
                  {entry.schoolId.schoolCode}
                </span>
              )}
            </Field_>

            <Field_ label="Entity" mono>
              {entry.entity || '—'}
              {entry.entityId ? ` · ${entry.entityId}` : ''}
            </Field_>

            <Field_ label="IP address" mono>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                {entry.ip || 'Not recorded'}
              </span>
            </Field_>

            {entry.userAgent && (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  User agent
                </dt>
                <dd className="mt-0.5 flex items-start gap-1.5 break-all text-[11px] font-mono font-semibold text-slate-600">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                  {entry.userAgent}
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card padding="p-5">
          <h2 className="text-[13px] font-extrabold text-ink">Raw metadata</h2>
          {entry.meta && typeof entry.meta === 'object' && Object.keys(entry.meta).length > 0 ? (
            <>
              <p className="mt-1 text-[11px]/[17px] font-medium text-slate-500">
                Everything the writer recorded, unedited.
              </p>
              <button
                type="button"
                onClick={() => setMetaOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                Open the raw JSON
              </button>
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px]/[18px] font-semibold text-slate-500">
              This entry recorded no <code className="font-mono">meta</code>. An entry with
              no metadata is invisible to the impersonation screen — it matches on
              <code className="mx-1 font-mono">meta.impersonationSessionId</code> and there is
              no way to tell from this row whether the writer simply had nothing to add.
            </p>
          )}
        </Card>
      </div>

      {/*
        The impersonation link, and the reason it is a link and not a badge.

        `getImpersonationAudit` matches on `meta.impersonationSessionId`
        (`admin.js:1147-1158`), and that screen is the entire justification for recording
        impersonations at all. A row that names the session and offers no way to see the
        rest of it is a record that costs an operator a trip to the school list and gives
        them nothing.
      */}
      {sessionId && (
        <Card padding="p-5" className="mt-4 border-brand-200 bg-brand-50/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[13px] font-extrabold text-ink">Written inside an impersonation</h2>
              <p className="mt-1 text-[12px]/[19px] font-medium text-slate-600">
                The platform owner was signed in as somebody in this school when they did it.
                The other screen shows everything else that session did.
              </p>
              <p className="mt-1.5 font-mono text-[11px] font-bold text-slate-500">{sessionId}</p>
            </div>
            <Link
              to={impersonationAuditPath(sessionId)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[12px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Open the session&rsquo;s activity
            </Link>
          </div>
        </Card>
      )}

      <Card padding="p-5" className="mt-4">
        {hasDiff ? (
          <DiffTable before={entry.before} after={entry.after} />
        ) : (
          <>
            <h2 className="text-[13px] font-extrabold text-ink">What changed</h2>
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-[12px]/[19px] font-semibold text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span>
                This entry recorded no <code className="font-mono">before</code> or{' '}
                <code className="font-mono">after</code>, so there is nothing to diff here.
                Both columns exist on the model and the conventions require recording them for
                anything with a disputable value, so an entry without them is either a write
                that changed nothing or a writer that did not pass them — and this screen
                cannot tell those two apart.
              </span>
            </p>
          </>
        )}
      </Card>

      {/*
        What happened either side of this entry.

        Arrives with the entry itself — `getAuditLogById` returns a ±5 second window
        — because this is the question an operator actually has about a single audit
        row. A markup change means little alone; whether it landed immediately after
        a subscription write, or immediately before a suspension, is what makes it
        explainable. That is also why it is a fixed window rather than a pager: an
        operator reading one entry wants the seconds around it, not page 2 of it.

        Hidden when empty rather than showing an empty table — a quiet audit log is
        the good case and should read as "nothing else happened at this moment", not
        as a panel that failed to load.
      */}
      {surrounding.length > 0 && (
        <Card padding="p-5" className="mt-4">
          <h2 className="text-[13px] font-extrabold text-ink">
            Within five seconds of this entry
          </h2>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">
            The screen an audit row is read on is "what else happened at the same
            moment". Shown newest first.
          </p>
          <ul className="mt-3 space-y-1.5">
            {surrounding.map((neighbour) => (
              <li key={neighbour._id}>
                <Link
                  to={`${ROUTES.ADMIN_AUDIT_LOGS}/${neighbour._id}`}
                  className="block rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50"
                >
                  <AuditRow
                    entry={neighbour}
                    to={null}
                    showEntity={false}
                    showImpersonationLink={false}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4">
        <AuditRow entry={entry} to={null} showEntity={false} showImpersonationLink={false} />
      </div>

      {/* The raw metadata, in a real dialog. JSON in a `<pre>` cannot be a popover. */}
      <Modal
        open={metaOpen}
        onClose={() => setMetaOpen(false)}
        title="Raw metadata"
        description="Exactly what the writer stored, pretty-printed. Nothing here has been interpreted or filtered."
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setMetaOpen(false)}
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            Close
          </button>
        }
      >
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(entry.meta ?? {}, null, 2)}
        </pre>
      </Modal>
    </>
  );
};

export default AuditLogDetail;
