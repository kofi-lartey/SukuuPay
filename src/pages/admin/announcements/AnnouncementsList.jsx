import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Pagination from '../../../components/students/Pagination';
import Modal from '../../../components/common/Modal';
import { SelectField } from '../../../components/common/FormField';
import { useToast } from '../../../hooks/useToast';
import { useImpersonation } from '../../../hooks/useImpersonation';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_SEVERITIES,
  deleteAnnouncement,
  listAnnouncements,
} from '../../../services/admin';
import { ADMIN_ROUTES, ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

/**
 * Platform announcements: the notices SukuuPay publishes *to* schools.
 *
 * Backed by `GET /admin/announcements`, whose service, controller and validation
 * schemas all exist (`Backend/src/services/admin/announcements.service.js`,
 * `controllers/admin/announcements.controller.js`,
 * `validations/admin.announcements.validation.js`) — although the routes are not
 * yet registered in `admin.routes.js`, so nothing on this page can be exercised
 * end to end until that is wired.
 *
 * ## Why `live` is computed here and not read from the server
 *
 * `listAnnouncements({ active: true })` filters to what is live *right now*
 * server-side, and `getAnnouncement` returns a computed `isLive` for the single
 * read. The list endpoint does **not** return `isLive` per row, and this page
 * mostly runs *without* the `active` filter — because the interesting view is "what
 * is live now, and what did we publish, and what did we take down", which one
 * `active=true` cannot answer.
 *
 * So the state is derived on the client from the two inputs the server does send:
 * `isActive`, and the `startsAt`/`endsAt` window against **now**. Both tests are
 * needed and they are not interchangeable:
 *
 *   - `isActive` alone is the *operator's switch*. A notice withdrawn ten minutes
 *     ago still has a window that says it is running, and treating it as live is
 *     the single most misleading thing this table could do during an outage — an
 *     operator checking whether a maintenance banner is up would see "Live" for a
 *     banner that was already taken down.
 *   - the window alone is equally wrong, and the other way. A notice scheduled for
 *     Monday has `isActive: true` and a future `startsAt`, so it is not live; and a
 *     notice whose window closed yesterday has `isActive: true` and a past
 *     `endsAt`, so it is not live either. Reporting either as live would mean the
 *     console claims a banner is on screen when nothing is.
 *
 * The `endsAt` test is **exclusive** — `endsAt <= now` is not live — because that
 * is what `isAnnouncementLive` does (`PlatformAnnouncement.js:183-186`), and the
 * reason there is that two adjacent windows must not both claim the instant they
 * meet. A client that used `>=` would disagree with the per-school banner query on
 * that exact boundary, which is precisely the class of bug the server's own doc
 * comment refuses to risk.
 *
 * The window is also evaluated **on a timer**, because it is a function of `now`.
 * Without one, a list fetched at 08:59 keeps reading "Live" for a notice starting
 * at 09:01 and the operator has no way to know the screen is stale. The tick
 * re-derives only the derived state — no request — every thirty seconds.
 */

const SEVERITY_TONES = { info: 'blue', warning: 'amber', critical: 'red' };

const SEVERITY_LABELS = { info: 'Information', warning: 'Warning', critical: 'Critical' };

const AUDIENCE_LABELS = {
  all_schools: 'Every school',
  selected_schools: 'Selected schools',
  all_admins: 'Every school administrator',
};

/**
 * A value that has no presentation entry yet still renders — as its raw name.
 *
 * Built from the enum in `services/admin.js` rather than hand-listed, because a
 * severity the backend accepts and this table cannot name would render as `null`
 * in the badge and read as "no severity" for a critical notice. The two lists must
 * stay in step with `PlatformAnnouncement.severity` (`PlatformAnnouncement.js:66`),
 * and deriving the fallback from the exported enum is what makes that automatic
 * instead of a thing somebody remembers.
 */
const severityLabel = (value) =>
  SEVERITY_LABELS[value] ||
  (ANNOUNCEMENT_SEVERITIES.includes(value) ? value : 'Unknown');

const audienceLabel = (value) =>
  AUDIENCE_LABELS[value] ||
  (ANNOUNCEMENT_AUDIENCES.includes(value) ? value : 'Unknown audience');

const STATE_TONES = {
  live: 'green',
  scheduled: 'blue',
  ended: 'slate',
  inactive: 'slate',
};

/**
 * `isAnnouncementLive`, in the client, for the reasons in the header comment.
 *
 * Written out rather than imported because the helper is a backend module and the
 * frontend cannot import it — and because this one is three lines, which is the
 * only size at which a hand-written duplicate is safer than a build-time
 * dependency on the backend.
 */
const announcementState = (announcement, now) => {
  if (!announcement?.isActive) return 'inactive';
  const starts = new Date(announcement.startsAt).getTime();
  if (Number.isFinite(starts) && starts > now) return 'scheduled';
  const ends = announcement.endsAt ? new Date(announcement.endsAt).getTime() : null;
  // Exclusive, matching `isAnnouncementLive`.
  if (Number.isFinite(ends) && ends <= now) return 'ended';
  return 'live';
};

const STATE_LABELS = {
  live: 'Live now',
  scheduled: 'Scheduled',
  ended: 'Ended',
  inactive: 'Withdrawn',
};

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** `createdBy` is populated to `{ name, role }`; `meta.evaluatedAt` echoes the server's instant. */
const authorName = (row) => row?.createdBy?.name || row?.createdBy?.role || '—';

const AnnouncementsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { isImpersonating } = useImpersonation();

  const [reloadKey, setReloadKey] = useState(0);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);

  /**
   * The clock the derived state is computed against.
   *
   * A `Date` in state rather than `new Date()` inline, so the whole table
   * re-evaluates against one instant — and so it re-evaluates *at all* when time
   * passes. Reads `now` for `new Date()` inside render would produce a correct
   * value and no update.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const filters = useMemo(
    () => ({
      active: searchParams.get('active') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAnnouncements(filters)
      .then((result) => {
        if (!active) return;
        setState({ rows: result.rows, meta: result.meta, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], meta: null, loading: false, error });
      });
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

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

  /**
   * Withdraw, returning `{ ok, error }` and never throwing.
   *
   * `deleteAnnouncement` is a 409 when the notice is already withdrawn, and a
   * refusal here is *information* — it means two operators acted on the same
   * banner. So the error is shown in the dialog rather than swallowed into a
   * toast that disappears before the operator reads it.
   */
  const confirmWithdraw = useCallback(async () => {
    if (!withdrawTarget) return { ok: false, error: 'Nothing to withdraw.' };

    setBusy(true);
    setWithdrawError(null);
    try {
      const result = await deleteAnnouncement(withdrawTarget._id);
      setWithdrawTarget(null);
      toast.success(
        result?.wasLiveAtWithdrawal
          ? `“${withdrawTarget.title}” was live when you withdrew it. It is now switched off in every school console.`
          : `“${withdrawTarget.title}” is withdrawn. It was not live, so no school was showing it.`
      );
      refresh();
      return { ok: true };
    } catch (error) {
      setWithdrawError(error.message || 'This announcement could not be withdrawn.');
      return { ok: false, error: error.message };
    } finally {
      setBusy(false);
    }
  }, [withdrawTarget, refresh, toast]);

  const openWithdraw = (row) => {
    setWithdrawTarget(row);
    setWithdrawError(null);
  };

  const rows = state.rows || [];
  const hasFilters = Boolean(filters.active);

  // The counts for the *current* page, not the whole filtered set: the endpoint's
  // `meta` carries `evaluatedAt` and nothing else (`announcements.service.js:239`),
  // so a platform-wide "12 live, 3 scheduled" would be a figure this page invents.
  const tally = useMemo(() => {
    const counts = { live: 0, scheduled: 0, ended: 0, inactive: 0 };
    rows.forEach((row) => {
      counts[announcementState(row, now)] += 1;
    });
    return counts;
  }, [rows, now]);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Announcements"
        description="Notices shown to school administrators across the platform. Withdrawing one switches it off everywhere; it does not erase it."
        actions={
          <button
            type="button"
            onClick={() => navigate(`${ROUTES.ADMIN_ANNOUNCEMENTS}/new`)}
            disabled={isImpersonating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New announcement
          </button>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Showing"
            value={filters.active}
            onChange={(event) => setFilter('active', event.target.value)}
          >
            {/*
              `active=true` is the server's own definition of *live right now*:
              `isActive: true` AND `startsAt <= now` AND `endsAt > now`
              (`announcements.service.js:213-217`). It is stricter than "not
              switched off", which is why this filter and the "State" column below
              can disagree for a scheduled notice — and why both exist.
            */}
            <option value="">All announcements</option>
            <option value="true">Live now only</option>
            <option value="false">Not currently live</option>
          </SelectField>
        </div>

        {/*
          The state tally, scoped to the loaded page. Stated as such because a
          platform-wide total would be a number this client cannot compute — the
          list endpoint returns `meta.evaluatedAt` and no grouped counts
          (`announcements.service.js:236-241`).
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          On this page: {formatCount(tally.live)} live, {formatCount(tally.scheduled)} scheduled,{' '}
          {formatCount(tally.ended)} ended, {formatCount(tally.inactive)} withdrawn. State is
          computed from each notice&rsquo;s window and the time of day, so a scheduled notice reads
          as &ldquo;scheduled&rdquo; and not as &ldquo;live&rdquo;.
        </p>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={Megaphone}
            title="Announcements could not be loaded"
            description={state.error.message}
            action={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
              >
                Try again
              </button>
            }
          />
        ) : state.loading && rows.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={hasFilters ? 'No announcements match this filter' : 'No announcements published'}
            description={
              hasFilters
                ? 'Only notices live at this instant match “Live now”. Try “All announcements”.'
                : 'Publish a notice to show it in the school consoles of every school on the platform.'
            }
            action={
              !hasFilters ? (
                <button
                  type="button"
                  onClick={() => navigate(`${ROUTES.ADMIN_ANNOUNCEMENTS}/new`)}
                  className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
                >
                  Write the first one
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] border-collapse text-left">
                  <caption className="sr-only">Announcements published to school consoles</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Announcement
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Severity
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Audience
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Window
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        State
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        By
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const liveState = announcementState(row, now);
                      const canWithdraw = row.isActive && !isImpersonating;

                      return (
                        <tr key={row._id} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3.5">
                            <p className="text-[13px] font-extrabold leading-tight text-ink">
                              {row.title}
                            </p>
                            {/*
                              The body, as plain text. See `AnnouncementForm.jsx`
                              for why `dangerouslySetInnerHTML` appears nowhere in
                              this console — this is the same string, rendered
                              again in the same safe way.
                            */}
                            <p className="mt-0.5 max-w-[46ch] truncate text-[11px] font-semibold text-slate-500">
                              {row.body}
                            </p>
                          </td>

                          <td className="px-5 py-3.5">
                            <Badge tone={SEVERITY_TONES[row.severity] || 'slate'}>
                              {severityLabel(row.severity)}
                            </Badge>
                          </td>

                          <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                            <span className="block">{audienceLabel(row.targetAudience)}</span>
                            {/*
                              The selected-school count, which is the only honest
                              rendering of scope without a second request per row to
                              resolve ids into names. "3 schools" is not "3 named
                              schools" and the difference matters when an operator is
                              checking they picked the right three.
                            */}
                            {row.targetAudience === 'selected_schools' && (
                              <span className="text-[10px] font-bold text-slate-400">
                                {formatCount(row.targetSchoolIds?.length || 0)} chosen
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-3.5 text-[11px] font-semibold text-slate-600">
                            <span className="block">{formatWhen(row.startsAt)}</span>
                            <span className="block text-slate-400">
                              {row.endsAt ? `until ${formatWhen(row.endsAt)}` : 'no end date'}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            <Badge tone={STATE_TONES[liveState]} dot={liveState === 'live'}>
                              {STATE_LABELS[liveState]}
                            </Badge>
                          </td>

                          <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                            {authorName(row)}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {/*
                                A real `<Link>`, not a button calling navigate.
                                These are routes, so they get middle-click and
                                ctrl-click like every other link in the console —
                                an operator editing a notice usually wants the list
                                open in the other tab.
                              */}
                              <Link
                                to={`${ROUTES.ADMIN_ANNOUNCEMENTS}/${row._id}`}
                                aria-label={`Edit ${row.title}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                Edit
                              </Link>

                              {/*
                                Withdraw is gated on `isActive`, not shown-then-
                                disabled — and the server answers a second attempt
                                with a 409 anyway (`announcements.service.js:479`),
                                because withdrawing twice is a script that ran twice
                                and should be visible as such. A disabled button on
                                an already-withdrawn row would imply a permission
                                problem where there is a lifecycle one.
                              */}
                              {row.isActive ? (
                                <button
                                  type="button"
                                  onClick={() => openWithdraw(row)}
                                  disabled={!canWithdraw}
                                  aria-label={`Withdraw ${row.title}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Withdraw
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                  Withdrawn
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="announcements"
                onPageChange={(page) => setFilter('page', String(page))}
                onPerPageChange={(perPage) => {
                  setFilter('perPage', String(perPage));
                  setFilter('page', '1');
                }}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(withdrawTarget)}
        onClose={() => setWithdrawTarget(null)}
        title="Withdraw this announcement?"
        description={
          withdrawTarget
            ? `“${withdrawTarget.title}” stops appearing in school consoles immediately.`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setWithdrawTarget(null)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Keep it published
            </button>
            <button
              type="button"
              onClick={confirmWithdraw}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Withdrawing…' : 'Withdraw it'}
            </button>
          </>
        }
      >
        {withdrawError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700">
            {withdrawError}
          </div>
        )}

        {/*
          The deactivation, not a deletion. The endpoint is `DELETE`, the brief said
          "DELETE", and an operator who expects a permanent removal deserves to know
          the row survives — so it is stated here, in the words of the thing, before
          the button rather than discovered afterwards.
        */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="text-[13px] font-extrabold text-amber-900">
            This switches the notice off. It does not delete it.
          </p>
          <ul className="mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed text-amber-900">
            <li>
              <strong>Every school console stops showing it</strong> the next time it loads.
              Administrators who already read it cannot be un-told, and a school that acted on
              a maintenance notice has no way to know it was retracted.
            </li>
            <li>
              <strong>The row survives</strong>, switched off, with its dates, its audience and
              its text intact — so &ldquo;was this notice ever published, to whom, and who took
              it down?&rdquo; stays answerable during the next incident.
            </li>
            <li>
              You can switch it back on with <strong>Edit</strong>, so an accidental withdrawal is
              recoverable. Nothing here is permanent.
            </li>
            <li>
              Recorded in the audit trail as{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                admin.announcement_delete
              </code>{' '}
              — the action enum keeps that name even though nothing is deleted, and the entry also
              records whether the notice was live at the moment you withdrew it.
            </li>
          </ul>
        </div>

        {withdrawTarget && (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-slate-500">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            {announcementState(withdrawTarget, now) === 'live'
              ? 'This notice is live right now, so schools are reading it as you make this change.'
              : `This notice is ${STATE_LABELS[announcementState(withdrawTarget, now)].toLowerCase()}, so no school is currently showing it.`}
          </p>
        )}
      </Modal>
    </>
  );
};

export { announcementState, STATE_LABELS };
export default AnnouncementsList;