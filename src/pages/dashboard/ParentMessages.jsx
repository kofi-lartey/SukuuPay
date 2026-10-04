import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Inbox, Mic, Phone, RotateCcw, Search } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import Pagination from '../../components/students/Pagination';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import {
  listParentMessages,
  markParentMessageRead,
  resolveParentMessage,
  messageAge,
  formatDuration,
} from '../../services/parentMessages';

/**
 * The school inbox for messages parents sent from their pay link.
 *
 * ## Why this page exists
 *
 * `POST /pay/:token/notify-school` used to write a `Notification` per admin and return
 * 200, and nothing in the product ever displayed one — the bell was a hard-disabled
 * button whose own comment said no notifications surface existed. So a parent could
 * write about a payment that had not appeared, be told the school had been notified,
 * and the bursar would see nothing at all. Recording is not receipt.
 *
 * The notification now points here, and this is the thing with state. The two are
 * deliberately different: notifications expire after 90 days by TTL and carry no
 * idea whether anything was done, while a fee dispute has to outlive the alert and
 * answer "has this been dealt with" — which is what `status` and `resolutionNote` are.
 *
 * ## Read is automatic on open
 *
 * A bursar reading a message has read it. Waiting for a "Mark read" tap before the
 * item stops being bold trains people that bold means nothing, and the badge stops
 * meaning "you are owed an answer". The tap is still offered, because sometimes you
 * open a list to triage and only read one — but it is not the only way.
 */

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'Unread' },
  { key: 'read', label: 'Read' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_TONE = {
  new: 'amber',
  read: 'blue',
  resolved: 'green',
  archived: 'slate',
};

const ParentMessages = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ rows: [], meta: null, counts: null, loading: true, error: null });

  // Filters live in the query string, matching every other module in the shell, so a
  // bursar can send "the messages about Mensah" to a colleague and have it open the
  // same view. Drafts (the resolve note) stay in component state — a note is never a
  // filter and putting one in a URL leaks it into browser history and the address bar.
  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || 'all',
      q: searchParams.get('q') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [queryDraft, setQueryDraft] = useState(filters.q);
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listParentMessages(filters)
      .then((result) => {
        if (!active) return;
        setState({
          rows: result.rows,
          meta: result.meta,
          counts: result.counts,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], meta: null, counts: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

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
   * Marking read on open.
   *
   * Optimistic and deliberately un-awaited: the list is already on screen and the row
   * should settle as the bursar is reading it, not after a round trip. A failure is
   * not surfaced — the badge comes back from the server on its next poll, so a stale
   * bold row corrects itself within a minute and a toast about it would be noise
   * during triage.
   */
  const onRead = useCallback(
    (row) => {
      if (row.read) return;
      setState((current) => ({
        ...current,
        rows: current.rows.map((item) =>
          String(item._id) === String(row._id) ? { ...item, read: true, status: 'read' } : item
        ),
      }));
      markParentMessageRead(row._id).catch(() => {});
    },
    []
  );

  const openResolve = useCallback((row) => {
    setResolving(row);
    setNote(row.resolutionNote || '');
    setNoteError(null);
  }, []);

  const submitResolve = useCallback(
    async (event) => {
      event.preventDefault();
      if (!resolving || note.trim().length < 3) {
        setNoteError('Say what was done about it, so there is a record');
        return;
      }

      setBusy(true);
      setNoteError(null);

      try {
        await resolveParentMessage(resolving._id, note.trim());
        toast.success('Marked as resolved.');
        setResolving(null);
        setNote('');
        refresh();
      } catch (error) {
        setNoteError(error.message);
      } finally {
        setBusy(false);
      }
    },
    [note, refresh, resolving, toast]
  );

  const counts = state.counts || {};
  const unread = Number(counts.new) || 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Parent messages"
        title="Messages from parents"
        description="Anything a parent sends from their fee link lands here — a question, a payment that has not appeared, or a voice note. Recording one is not the same as reading it, so each one stays at the top until it is dealt with."
        meta={
          unread > 0 ? (
            <Badge tone="amber">
              {unread} waiting for an answer
            </Badge>
          ) : (
            <Badge tone="green">Nothing unanswered</Badge>
          )
        }
      />

      {/* Filters. `q` is submitted rather than typed into, because the endpoint
          free-texts over message bodies with a regex and a per-keystroke request would
          scan the school's whole history on every character. */}
      <Card padding="p-4" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
          >
            {STATUS_TABS.map((tab) => {
              const isActive = filters.status === tab.key;
              const count = Number(counts[tab.key]) || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter('status', tab.key === 'all' ? '' : tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-extrabold transition-colors ${
                    isActive ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {count > 0 ? (
                    <span className="ml-1.5 text-[11px] font-bold text-slate-400">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter('q', queryDraft.trim());
            }}
            className="relative ml-auto min-w-0 flex-1 sm:max-w-xs"
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Search a parent, student or message…"
              aria-label="Search messages"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </form>
        </div>
      </Card>

      {state.error ? (
        <EmptyState
          icon={RotateCcw}
          title="Messages could not be loaded"
          description={state.error.message}
          action={
            <Button variant="secondary" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : null}

      {!state.error && state.loading && state.rows.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <Card key={key} padding="p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : null}

      {!state.error && !state.loading && state.rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            filters.q
              ? 'Nothing matched that search'
              : filters.status === 'all'
                ? 'No parent messages yet'
                : 'Nothing in this filter'
          }
          description={
            filters.q
              ? 'Try the parent’s name, the student’s name, or a word from the message.'
              : 'When a parent writes from their fee link — or records a voice note — it arrives here and on your notifications bell.'
          }
        />
      ) : null}

      {state.rows.length > 0 ? (
        <ul className="space-y-3">
          {state.rows.map((row) => (
            <li key={row._id}>
              <Card
                padding="p-4"
                className={row.read ? '' : 'border-amber-200 bg-amber-50/40'}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-extrabold text-ink">{row.parentName}</p>
                      <Badge tone={STATUS_TONE[row.status] || 'slate'}>{row.status}</Badge>
                      {row.hasAudio ? (
                        <Badge tone="blue" icon={Mic}>
                          Voice note
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] font-semibold text-slate-500">
                      About{' '}
                      <span className="font-extrabold text-slate-700">
                        {row.studentName || 'a student'}
                      </span>
                      {row.studentClass ? ` · ${row.studentClass}` : ''}
                      {row.studentRef ? ` · ${row.studentRef}` : ''} ·{' '}
                      {messageAge(row.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`tel:${row.parentPhone}`}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      Call back
                    </a>
                    {row.status !== 'resolved' ? (
                      <Button variant="secondary" onClick={() => openResolve(row)}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Mark resolved
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/*
                  The parent's words, in full. `ParentMessage.message` is capped at
                  1000 characters and is never a summary — a bursar arguing a balance
                  needs what was actually written, not a truncation of it.
                */}
                {row.message ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white px-3.5 py-3 text-[14px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
                    {row.message}
                  </p>
                ) : null}

                {row.audio?.url ? (
                  <div className="mt-3">
                    <audio
                      controls
                      preload="none"
                      src={row.audio.url}
                      className="h-10 w-full max-w-md"
                    >
                      <a href={row.audio.url} download>
                        Download the voice note
                      </a>
                    </audio>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      {row.audio.durationSeconds
                        ? formatDuration(row.audio.durationSeconds)
                        : 'Voice note'}
                      {row.audio.bytes ? ` · ${Math.max(1, Math.round(row.audio.bytes / 1024))} KB` : ''}
                    </p>
                  </div>
                ) : null}

                {row.resolutionNote ? (
                  <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-800">
                    <span className="font-extrabold">Resolved:</span> {row.resolutionNote}
                  </p>
                ) : null}

                {/*
                  Why no alert went out is recorded on the row, and shown here because a
                  school with several unanswered messages and no callback phone is a
                  support problem, not a parent problem — and the bursar reading this is
                  the only person who can see it.
                */}
                {!row.smsAlerted && row.smsAlertFailure ? (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-amber-800">
                    No SMS alert was sent: {row.smsAlertFailure}. This message is in the
                    inbox, so nothing is lost — add a phone number to your profile or the
                    school settings to get alerted next time.
                  </p>
                ) : null}

                {/* Marked on open, so the affordance is only needed when triage has
                    skipped past something. */}
                {!row.read ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => onRead(row)}
                      className="text-[12px] font-extrabold text-brand-700 hover:underline"
                    >
                      Mark as read
                    </button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {state.meta && state.meta.totalPages > 1 ? (
        <div className="mt-5">
          <Pagination
            meta={state.meta}
            onPageChange={(page) => setFilter('page', page === 1 ? '' : String(page))}
          />
        </div>
      ) : null}

      <Modal
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title="Mark this message resolved"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button onClick={submitResolve} disabled={busy}>
              {busy ? 'Saving…' : 'Mark resolved'}
            </Button>
          </>
        }
      >
        {resolving ? (
          <form onSubmit={submitResolve} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[12px] font-bold text-slate-500">
                {resolving.parentName} · about {resolving.studentName}
              </p>
              {resolving.message ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">
                  {resolving.message}
                </p>
              ) : null}
            </div>

            {/*
              An explicit label + textarea rather than `Field`, which renders its own
              `<input>` and takes no children — wrapping a textarea in it would put a
              second control inside the first one's markup.
            */}
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label
                  htmlFor="resolution-note"
                  className="text-[11px]/[15px] font-semibold text-slate-700"
                >
                  What was done about it
                </label>
                <span className="shrink-0 text-[10px]/[14px] font-medium text-slate-500">
                  {note.length}/500
                </span>
              </div>

              <textarea
                id="resolution-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="e.g. Called Mrs. Mensah and confirmed the GH₵ 300 cash payment on 12 June; receipt RCP-20260612-0007 issued."
                aria-invalid={noteError ? 'true' : undefined}
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-900 focus:outline-none ${
                  noteError ? 'border-red-300' : 'border-slate-200 focus:border-brand-700'
                }`}
              />

              {noteError ? (
                <p className="mt-1 text-[11px] font-semibold text-red-600">{noteError}</p>
              ) : (
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  This is the only durable record that the parent was answered.
                </p>
              )}
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default ParentMessages;