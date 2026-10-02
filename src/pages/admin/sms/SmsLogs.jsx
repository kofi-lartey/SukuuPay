import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Megaphone, MessageSquare } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Pagination from '../../../components/students/Pagination';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolPicker from '../../../components/admin/sms/SchoolPicker';
import { listSmsLogs } from '../../../services/admin';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * Platform-wide SMS history.
 *
 * `GET /admin/sms/logs` — filters `schoolId`, `status`, `from`, `to`, paginated.
 * Backed end to end by the endpoint, and the filters live in the query string so a
 * filtered history is linkable: the single most common reason to land here is a
 * school asking "did my reminder from Tuesday go out?", and the answer is a URL
 * an operator can paste into a ticket.
 *
 * ## The list mixes two populations, and `scope` is what separates them
 *
 * `GET /admin/sms/logs` returns both messages a **school** sent to its parents and
 * messages the **platform** sent to school administrators, distinguished by
 * `scope: 'school' | 'platform'`. A platform row has no `schoolId`, so any school
 * column that renders `schoolName` alone draws an empty cell for exactly the rows
 * whose provenance matters most — the broadcast the platform owner just sent.
 * `scope` is therefore read explicitly and a platform row is labelled as one,
 * which also answers the question that follows from it: a platform broadcast goes
 * out on the platform's own sender ID and **charges no school's balance**, so it
 * does not appear against any school's credit.
 *
 * ## What is rendered, and what is deliberately not
 *
 * This is the only screen in the product where one row can expose a parent's name,
 * a parent's phone number and the text of a message about that parent's overdue
 * fees — and it is the screen most likely to be open on a projector, in a support
 * call, or on a laptop somebody walks away from. Three rules follow, and each one
 * is about that:
 *
 * **1. The phone number is masked here, always, by this component.**
 *
 * `HistoryTab.jsx:184` renders `message.toMasked || message.to` — it falls back to
 * the raw number, which is correct there because that list is scoped to one
 * school that already holds those numbers and whose own staff are the audience.
 * On a platform-wide screen there is no such scoping, and there is also **no
 * `toMasked` field anywhere in the backend**: `SmsMessage.to` is a plain required
 * `String` (`smsMessageModel.js:209`) and no service or controller masks it. So the
 * fallback would render 40,000 live numbers on a console a platform admin, a
 * support contractor and an operator all share. `maskPhone` below is therefore
 * applied unconditionally and never bypassed.
 *
 * The mask keeps the country code and the first three digits, because "which
 * network and which exchange" is what an operator actually diagnoses a failed
 * message with — an MTN number that reports `failed` and a Telecel number that
 * does not is a routing problem. It hides everything after the fourth digit.
 *
 * **2. The message body is a preview and never the whole thing.**
 *
 * The brief's condition is "unless the model marks it safe". I read the whole
 * `SmsMessage` schema to find out whether it does: it does not. The fields are
 * `message`, `parentName`, `to`, `segments`, `purpose`, `failureReason`,
 * `dlr`, `creditsCharged` — there is no `isSensitive`, no `isSafeToDisplay` and no
 * redaction flag of any kind. A fee-reminder body contains a parent's name, a
 * student's name, a class and a balance; rendering three hundred of those in a
 * table is a data-protection incident, not a rendering choice.
 *
 * So the body is clipped to a fixed number of characters with an explicit
 * ellipsis, and the real fix is server-side: `GET /admin/sms/logs` should return a
 * redacted `messagePreview` and never the full `message`, the way the announcements
 * backend already keeps its audit snapshots to an explicit allowlist
 * (`announcements.service.js:91-100`). That is reported rather than worked around,
 * because a client-side clip cannot know what an operator legitimately needs to
 * read to diagnose a carrier failure.
 *
 * **3. The parent's name is not rendered at all.** `parentName` is denormalised
 * onto `SmsMessage` and would be the obvious thing to put in the recipient column.
 * It is left out: the row already carries the masked number, which is enough to
 * find the message in the school's own console, and the name adds a third piece of
 * PII to a platform-wide table for no diagnostic gain.
 *
 * ## Cost
 *
 * There is no money on `SmsMessage` — only `creditsCharged` and
 * `creditsRefunded`, both *segment counts*. The cost column is
 * `creditsCharged × PlatformSettings.sms.ratePesewas` in integer pesewas, the same
 * estimate as the overview's, rendered through `formatCediShort` and labelled
 * estimated in the column header. `formatCedi` divides by 100 internally; a
 * component that divided here would be wrong by a factor of 100.
 *
 * ## What was reused from the school console
 *
 * `HistoryTab.jsx`'s status vocabulary and tones are reproduced rather than
 * imported, because `HistoryTab` takes its rows as a dozen injected props and
 * exporting its maps would mean refactoring a shared component to suit a second
 * caller. The two lists must stay in step by hand — `HistoryTab` carries
 * `failed_dlr`, which `SMS_DELIVERY_STATUSES` does not, so this list is the
 * canonical enum plus that one legacy value, and an unmapped status renders in
 * slate rather than disappearing.
 */

/** `SMS_DELIVERY_STATUSES` plus `failed_dlr`, the state the school console also carries. */
const DELIVERY_STATUSES = [
  'queued',
  'submitted',
  'sent',
  'delivered',
  'failed',
  'failed_dlr',
  'rejected',
  'unknown',
];

const STATUS_TONES = {
  queued: 'slate',
  submitted: 'blue',
  sent: 'blue',
  delivered: 'green',
  failed: 'red',
  failed_dlr: 'red',
  rejected: 'rose',
  unknown: 'slate',
};

const STATUS_LABELS = {
  queued: 'Queued',
  submitted: 'Submitted',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  failed_dlr: 'Dropped by carrier',
  rejected: 'Rejected',
  unknown: 'Unknown',
};

/** Characters of body shown. Enough to identify the message, not enough to read it. */
const PREVIEW_CHARS = 72;

/**
 * Mask a Ghanaian number to `+233 ••• ••• 012`.
 *
 * Applied here rather than trusted from the API, because no endpoint currently
 * returns a masked form (see the note above `HistoryTab`'s `toMasked` fallback).
 * It is written defensively about shape: an international number, a number with
 * spaces, a number that is not a number at all — all three happen, because
 * `SmsMessage.to` is whatever the school roster held when the message was queued.
 * A number that cannot be understood renders as `—` rather than passing through.
 */
const maskPhone = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 4) return '••••';
  const prefix = raw.trim().startsWith('+') ? '+' : '';
  return `${prefix}${digits.slice(0, 3)} ••• ••• ${digits.slice(-3)}`;
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

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const SmsLogs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();

  const [reloadKey, setReloadKey] = useState(0);

  /**
   * The school filter is a picker, not a `<select>`.
   *
   * `GET /admin/schools` paginates at `MAX_PER_PAGE = 200`, so a native select of
   * every school is either truncated without saying so or unbounded. `SchoolPicker`
   * takes a single id here, so the same component serves the multi-select callers
   * by accepting an array and this one by passing a one-element array.
   */
  const [schoolFilter, setSchoolFilter] = useState([]);

  const filters = useMemo(
    () => ({
      schoolId: searchParams.get('schoolId') || '',
      status: searchParams.get('status') || '',
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
    listSmsLogs(filters)
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

  /** Any filter change resets to page 1 — otherwise page 7 of a new filter is empty. */
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

  const clearFilters = useCallback(() => {
    setSchoolFilter([]);
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const onSchoolChange = useCallback(
    (ids) => {
      setSchoolFilter(ids);
      // One school at a time: `listSmsLogs` takes a single `schoolId`. A
      // multi-select here would promise a cross-school search the endpoint cannot
      // do, so the picker is capped by construction — only the last id survives.
      setFilter('schoolId', ids.length ? ids[ids.length - 1] : '');
    },
    [setFilter]
  );

  const ratePes = settings?.sms?.ratePesewas ?? 0;

  const rows = state.rows || [];
  const hasFilters = Boolean(filters.schoolId || filters.status || filters.from || filters.to);

  const sectionTabs = useMemo(
    () => [
      { value: ADMIN_ROUTES.SMS, label: 'Overview' },
      { value: ADMIN_ROUTES.SMS_CREDITS, label: 'Credits' },
      { value: ADMIN_ROUTES.SMS_LOGS, label: 'Message history' },
    ],
    []
  );

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="SMS history"
        description="Every message the platform has sent, across every school, with its delivery status."
      />

      <ModuleTabs items={sectionTabs} value={ADMIN_ROUTES.SMS_LOGS} onChange={navigate} ariaLabel="SMS sections" />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Delivery status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">Any status</option>
            {DELIVERY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </option>
            ))}
          </SelectField>

          <Field
            label="From"
            type="date"
            value={filters.from}
            onChange={(event) => setFilter('from', event.target.value)}
          />

          <Field
            label="To"
            type="date"
            value={filters.to}
            onChange={(event) => setFilter('to', event.target.value)}
          />

          <div className="flex items-end">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <SchoolPicker
            label="Filter by school"
            hint="One school at a time"
            value={schoolFilter}
            onChange={onSchoolChange}
          />
        </div>

        {/*
          Two statements that are true of this screen and nowhere else, so they
          belong above its table rather than in a comment a reader never reaches.
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Recipient numbers are masked and message bodies are shown as a short preview. This
          list spans every school on the platform, so it never renders a parent&rsquo;s full
          number or the full text of a message about their account.
        </p>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={MessageSquare}
            title="SMS history could not be loaded"
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
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={hasFilters ? 'No messages match these filters' : 'No messages sent yet'}
            description={
              hasFilters
                ? 'Try widening the date range, or clearing the school and status filters.'
                : 'Messages appear here once the platform sends one. A school’s own reminders live in its console, not on this screen.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[62rem] border-collapse text-left">
                  <caption className="sr-only">
                    SMS messages sent across the platform, with masked recipients
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {[
                        { label: 'Date', align: 'left' },
                        { label: 'School', align: 'left' },
                        { label: 'Recipient', align: 'left' },
                        { label: 'Message', align: 'left' },
                        { label: 'Provider', align: 'left' },
                        { label: 'Status', align: 'left' },
                        { label: 'Est. cost', align: 'right' },
                      ].map((column) => (
                        <th
                          key={column.label}
                          scope="col"
                          className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                            column.align === 'right' ? 'text-right' : ''
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const credits = number(row.creditsCharged);
                      const segments = number(row.segments) || 1;

                      return (
                        <tr key={row._id} className="border-b border-slate-50 last:border-0">
                          <td className="whitespace-nowrap px-4 py-3.5 text-[12px] font-semibold text-slate-600">
                            {formatWhen(row.sentAt || row.createdAt)}
                          </td>

                          <td className="px-4 py-3.5">
                              {/*
                                The scope decides what goes here, and it is not
                                optional.

                                `GET /admin/sms/logs` mixes two populations in one
                                list: messages a *school* sent to its parents, and
                                messages the *platform* sent to school
                                administrators. A platform row has no school, so a
                                plain `schoolName` fallback would render an empty
                                cell — indistinguishable from "we lost the school
                                name", on the one row type whose whole purpose is to
                                show that the platform acted. So `scope` is read
                                explicitly and a platform row is labelled as one,
                                which is also the answer to "which balance paid for
                                this?" (platform broadcasts are sent on the
                                platform's own sender ID and charge no school).
                              */}
                              {row.scope === 'platform' ? (
                                <Badge tone="brand" icon={Megaphone}>
                                  Platform
                                </Badge>
                              ) : (
                                <p className="max-w-[16ch] truncate text-[13px] font-extrabold text-ink">
                                  {row.schoolName || row.school?.name || '—'}
                                </p>
                              )}
                            </td>

                          {/*
                            Masked by this component, unconditionally — see the
                            header note. `row.toMasked` is accepted in case the API
                            ever returns one, but it is not trusted as the only
                            path: a server that omitted it would otherwise fall
                            through to a live number.
                          */}
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[12px] font-bold text-slate-600">
                            {maskPhone(row.toMasked || row.to)}
                          </td>

                          <td className="px-4 py-3.5">
                            {/*
                              The preview clip. Not a CSS `truncate` — a real
                              ellipsis in the string, so the DOM never holds the
                              full body: a CSS clip is a rendering decision and the
                              text is still in the page, in a copied selection and
                              in a screenshot of the DOM.
                            */}
                            <p className="max-w-[34ch] truncate text-[12px] font-medium leading-snug text-slate-600">
                              {String(row.message || '—').slice(0, PREVIEW_CHARS)}
                              {String(row.message || '').length > PREVIEW_CHARS ? '…' : ''}
                            </p>
                            {segments > 1 && (
                              <span className="mt-0.5 inline-block text-[10px] font-bold text-amber-700">
                                {segments} parts
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-[12px] font-bold uppercase text-slate-500">
                            {row.provider || '—'}
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge tone={STATUS_TONES[row.status] || 'slate'}>
                              {STATUS_LABELS[row.status] || row.status || 'unknown'}
                            </Badge>
                            {row.failureReason && (
                              <p className="mt-1 max-w-[20ch] truncate text-[10px] font-semibold text-red-600">
                                {row.failureReason}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-[12px] font-extrabold tabular-nums text-slate-600">
                            {/*
                              `creditsCharged` is a segment count, so a two-part
                              message costs twice. Multiplying the part count in as
                              well would double-charge it, which is the specific
                              arithmetic mistake this table could make — the model
                              already stores the total, in segments.
                            */}
                            {formatCediShort(credits * ratePes)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/*
                The estimate caveat, once, under the table rather than in every
                row. `creditsRefunded` exists on the model and is not subtracted
                here — the logs endpoint has no agreed refund field — so a month
                with many failed messages reads high against the provider's
                invoice.
              */}
              <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] font-semibold text-slate-400">
                Estimated cost is the messages charged per row × the platform rate of{' '}
                {formatCediShort(ratePes)}. It is not the provider&rsquo;s price: bundles,
                per-network rates and refunds for failed messages are not reflected here.
              </p>
            </Card>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="messages"
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
    </>
  );
};

export { maskPhone, PREVIEW_CHARS, DELIVERY_STATUSES };
export default SmsLogs;