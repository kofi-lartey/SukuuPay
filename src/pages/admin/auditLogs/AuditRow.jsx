import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, User } from 'lucide-react';
import Badge from '../../../components/dashboard/ui/Badge';
import { AUDIT_ACTIONS, auditCategoryOf } from '../../../services/auditLog';
import { impersonationAuditPath } from './auditRoutes';

/**
 * The audit-log row rendering, shared by the platform list, the impersonation screen and
 * the user's own trail.
 *
 * **This is the school console's row, not a new one.** `pages/dashboard/ActivityLog.jsx`
 * renders a coloured category dot, the humanised action beside the raw `action` string,
 * the timestamp, the actor with their role, the entity and its id, and the IP — and that
 * arrangement is what a reader has already learned to scan. Re-implementing it in a
 * different visual language would mean two rows describing the same event that look like
 * two different events.
 *
 * What is *added* here, and it is the whole reason this file exists rather than an import
 * of the school console's markup:
 *
 *   1. **`admin.*` actions are visually distinct, and the row says who acted.** The
 *      platform console's actions are namespaced `admin.*` precisely because they are the
 *      owner's acts *outside* every tenant (`Backend/src/config/constants.js:53-85`). A
 *      school's own bursar changing a student's class and a platform admin changing the
 *      same school's markup are both "a change to a school", and in an undifferentiated
 *      list they are indistinguishable — which is the one distinction an auditor reading a
 *      cross-tenant trail most needs. So the row is tinted, the action is badged
 *      "Platform console", and the actor line reads "outside the school" rather than
 *      implying the person belongs to it. A `super_admin` has `schoolId: null` by design,
 *      so a populated `schoolId` next to an `admin.*` action is *not* a contradiction — it
 *      is the school the act was directed at.
 *
 *   2. **`before`/`after` are surfaced when present.** `AuditLog` carries both as `Mixed`
 *      columns (`models/AuditLog.js:144-149`) and the conventions require recording both
 *      sides of anything with a disputable value. On a list, that renders as a single
 *      "changed" badge — enough to know a value moved and worth following the link for —
 *      and the full diff is on the detail screen, where there is room to read it.
 *
 * The `meta` chips are lifted from `ActivityLog.jsx` verbatim in behaviour: the three keys
 * the codebase is known to write get promoted to their own chip, and anything else is
 * shown as key/value. Showing the raw object is deliberate — a reader who does not
 * recognise a key learns what the system recorded, and hiding it would leave a confident
 * blank where a fact is.
 */

/** `sms.bulk_send` → "Bulk SMS sent". Derived, never a lookup table (see ActivityLog). */
export const humaniseAction = (action = '') => {
  const [, verb] = action.split('.');
  const phrase = (verb || action).replace(/_/g, ' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

/**
 * The four lanes, plus the platform-console lane.
 *
 * The first four are `ActivityLog`'s own `CATEGORY_STYLE`, unchanged: a log with no legend
 * is a list of coloured dots, and a reader who cannot name a category cannot decide
 * whether a red row is a failed payment or a failed sign-in. `admin` is added because the
 * platform console writes actions no school console produces, and `auditCategoryOf` returns
 * `null` for all of them — so without this they would render as unnamed grey dots, which
 * reads as "unimportant" for exactly the rows that matter most here.
 */
export const CATEGORY_STYLE = {
  finance: { dot: 'bg-emerald-500', label: 'Finance' },
  messaging: { dot: 'bg-amber-500', label: 'Messaging' },
  academic: { dot: 'bg-blue-500', label: 'Academic' },
  security: { dot: 'bg-rose-500', label: 'Security' },
  admin: { dot: 'bg-brand-700', label: 'Platform console' },
};

/**
 * Every `admin.*` action the backend can write, for the filter dropdown.
 *
 * Mirrors `AUDIT_ACTIONS.ADMIN_*` at `Backend/src/config/constants.js:60-85` for the same
 * reason `services/auditLog.js` mirrors the model's school-side enum: the backend validates
 * `action` against the same array, so an option this list does not offer is a value the UI
 * cannot filter for, and an option it offers wrongly is a 422 discovered by a user. The
 * two lists must change together. Mirrored rather than imported because the frontend cannot
 * import from `Backend/`.
 */
export const ADMIN_AUDIT_ACTIONS = [
  'admin.impersonate_start',
  'admin.impersonate_end',
  'admin.school_create',
  'admin.school_update',
  'admin.school_archive',
  'admin.markup_update',
  'admin.platform_fee_update',
  'admin.gateway_mode_update',
  'admin.subscription_update',
  'admin.feature_flags_update',
  'admin.tags_update',
  'admin.notes_update',
  'admin.user_status_update',
  'admin.user_password_reset',
  'admin.user_verification_resend',
  'admin.disbursement_create',
  'admin.disbursement_approve',
  'admin.disbursement_retry',
  'admin.payment_refund',
  'admin.announcement_create',
  'admin.announcement_update',
  'admin.announcement_delete',
  'admin.sms_broadcast',
  'admin.sms_credit_topup',
  'admin.maintenance_mode',
  'admin.export',
];

/** Is this action one the platform console performed? */
export const isPlatformAction = (action = '') => action.startsWith('admin.');

/** The category for a row, with the `admin.*` lane handled first. */
export const categoryFor = (action = '') => (isPlatformAction(action) ? 'admin' : auditCategoryOf(action));

/** `Today · 14:05`, lifted unchanged from the school console's row. */
export const formatStamp = (value) => {
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
 * The `meta` payload rendered under an entry.
 *
 * Three keys the codebase is known to write get promoted to their own chip — a
 * description, a failure reason and a recipient count — and the rest is capped at four
 * key/value pairs so a 40-key `meta` does not turn a row into a paragraph. `null` and
 * objects are skipped rather than stringified: an `impersonationSessionId` is a link, not a
 * chip, and it is rendered separately.
 */
export const MetaChips = ({ meta }) => {
  const chips = [];
  if (!meta || typeof meta !== 'object') return null;

  if (meta.description) chips.push({ tone: 'slate', text: String(meta.description) });
  if (meta.emailSent === false) {
    chips.push({ tone: 'red', text: `Email not delivered${meta.failureReason ? ` — ${meta.failureReason}` : ''}` });
  }
  if (meta.isResend) chips.push({ tone: 'amber', text: 'Re-sent' });
  if (meta.recipients) chips.push({ tone: 'slate', text: `${meta.recipients} recipients` });
  if (meta.delivered) chips.push({ tone: 'slate', text: `${meta.delivered} delivered` });
  if (meta.report) chips.push({ tone: 'slate', text: `Report: ${meta.report}` });

  const described = new Set(chips.flatMap((chip) => chip.text.split(/[:—]/).map((s) => s.trim())));
  Object.entries(meta)
    .filter(([key, value]) => {
      if (['description', 'failureReason', 'emailSent', 'isResend'].includes(key)) return false;
      // The impersonation keys are rendered as a link below, never as a chip: a session id
      // in a pill is an id nobody can act on.
      if (key === 'impersonationSessionId' || key === 'impersonatedBy') return false;
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
 * One entry.
 *
 * `to` renders the row as a link to the detail screen; omit it and the row is static,
 * which is what the impersonation screen does — there the whole screen *is* the detail, so
 * a link to it would be a link to the page you are already on.
 *
 * `showImpersonationLink` is on by default because a dead end here is the failure this
 * module most cares about: an entry written inside an impersonation is the one entry whose
 * surrounding context is a different screen, and a row that records the session id without
 * offering a way to see the rest of that session defeats the reason impersonations are
 * recorded at all (`admin.js:1139-1146`).
 */
const AuditRow = ({ entry, to, showImpersonationLink = true, showEntity = true }) => {
  const category = categoryFor(entry.action);
  const style = CATEGORY_STYLE[category];
  const platform = isPlatformAction(entry.action);
  const actor = entry.userId;
  const sessionId = entry.meta?.impersonationSessionId;

  const hasDiff = entry.before !== undefined || entry.after !== undefined;

  const inner = (
    <>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style ? style.dot : 'bg-slate-300'}`}
        aria-label={style ? style.label : 'Uncategorised'}
        title={style ? style.label : 'Uncategorised'}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[13px] font-extrabold text-ink">{humaniseAction(entry.action)}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
            {entry.action}
          </span>
          {platform && (
            <Badge tone="brand" icon={Eye}>
              Platform console
            </Badge>
          )}
          {hasDiff && <Badge tone="amber">Before / after recorded</Badge>}
          <span className="text-[11px] font-medium text-slate-400">{formatStamp(entry.createdAt)}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {actor?.name || 'System'}
            {actor?.role ? <span className="text-slate-400">({actor.role})</span> : null}
            {/*
              The attribution sentence. A `super_admin` has `schoolId: null`, so a populated
              `schoolId` on an `admin.*` row is the school the act was *directed at*, not
              the actor's own school — and without this line the row reads as though the
              platform owner were employed by the school whose data was changed.
            */}
            {platform && (
              <span className="font-semibold text-brand-700">· acted from outside the platform console</span>
            )}
          </span>

          {showEntity && entry.entity && (
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

          {entry.schoolId?.name && (
            <span className="font-semibold text-slate-500">{entry.schoolId.name}</span>
          )}

          {entry.ip && <span className="font-mono text-[11px] text-slate-400">{entry.ip}</span>}
        </div>

        <MetaChips meta={entry.meta} />

        {showImpersonationLink && sessionId && (
          <p className="mt-2 text-[11px]/[16px] font-semibold text-slate-500">
            <Link
              to={impersonationAuditPath(sessionId)}
              className="inline-flex items-center gap-1.5 font-extrabold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Written inside an impersonation session
            </Link>
            <span className="ml-1 font-mono text-[10px] text-slate-400">{sessionId}</span>
            {' — open the session to see everything else that operator did.'}
          </p>
        )}
      </div>
    </>
  );

  const classes = `flex gap-3 px-4 py-3.5 ${
    platform ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-slate-50/50'
  }`;

  if (to) {
    return (
      <li className={classes}>
        <Link
          to={to}
          className="flex min-w-0 flex-1 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          {inner}
        </Link>
      </li>
    );
  }

  return <li className={classes}>{inner}</li>;
};

export default AuditRow;
export { AuditRow, impersonationAuditPath, AUDIT_ACTIONS };
