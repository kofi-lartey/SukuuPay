import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Inbox, Mic, Phone, Search, X } from 'lucide-react';
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

const URGENT_HOURS = 24;
const AGE_TICK_MS = 60_000;

const maskPhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 3)} ••• ${digits.slice(-3)}`;
};

const isUrgent = (row) => {
  if (row.readAt) return false;
  if (!row.createdAt) return false;
  return Date.now() - new Date(row.createdAt).getTime() > URGENT_HOURS * 3_600_000;
};

const tierClasses = (row) => {
  if (row.readAt) return '';
  if (isUrgent(row)) return 'border-red-200 bg-red-50/30';
  return 'border-amber-200 bg-amber-50/40';
};

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------
const IconButton = ({ icon: Icon, label, onClick, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900',
    brand: 'border-brand-200 text-brand-700 hover:bg-brand-50',
    green: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
};

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------
const MessageRow = ({
  row,
  focused,
  selected,
  onSelect,
  onRead,
  onResolve,
  onCall,
}) => {
  const urgent = isUrgent(row);

  return (
    <li>
      <Card
        padding="p-3"
        className={`relative transition-shadow ${tierClasses(row)} ${
          focused ? 'ring-2 ring-brand-700/40' : ''
        }`}
      >
        {focused ? (
          <div
            className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-brand-700"
            aria-hidden="true"
          />
        ) : null}

        <div className="flex items-start gap-2.5">
          <label className="mt-1.5 flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(row._id)}
              aria-label={`Select message from ${row.parentName}`}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/30"
            />
          </label>

          {urgent ? (
            <span
              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500"
              aria-label="Urgent"
            />
          ) : !row.readAt ? (
            <span
              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400"
              aria-label="Unread"
            />
          ) : (
            <span className="mt-2 h-2 w-2 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[13.5px] font-extrabold text-ink">{row.parentName}</p>
              <Badge tone={STATUS_TONE[row.status] || 'slate'}>{row.status}</Badge>
              {row.hasAudio ? (
                <Badge tone="blue" icon={Mic}>
                  Voice
                </Badge>
              ) : null}
              <span className="ml-auto text-[11px] font-semibold text-slate-400">
                {messageAge(row.createdAt)}
              </span>
            </div>

            <p className="mt-0.5 text-[11.5px] font-semibold text-slate-500">
              About{' '}
              <span className="font-extrabold text-slate-700">
                {row.studentName || 'a student'}
              </span>
              {row.studentClass ? ` · ${row.studentClass}` : ''}
              {row.studentRef ? ` · ${row.studentRef}` : ''}
            </p>

            {row.message ? (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200">
                {row.message}
              </p>
            ) : null}

            {row.audio?.url ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-inset ring-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <audio
                  controls
                  preload="none"
                  src={row.audio.url}
                  className="h-8 w-full min-w-0"
                >
                  <a href={row.audio.url} download>
                    Download voice note
                  </a>
                </audio>
              </div>
            ) : null}

            {row.resolutionNote ? (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800">
                <span className="font-extrabold">Resolved:</span> {row.resolutionNote}
              </p>
            ) : null}

            {!row.smsAlerted && row.smsAlertFailure ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800">
                No SMS sent: {row.smsAlertFailure}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5">
            {!row.readAt ? (
              <IconButton
                icon={Check}
                label="Mark as read"
                tone="slate"
                onClick={() => onRead(row)}
              />
            ) : null}
            {row.status !== 'resolved' ? (
              <IconButton
                icon={Check}
                label="Mark resolved"
                tone="green"
                onClick={() => onResolve(row)}
              />
            ) : null}
            {row.parentPhone ? (
              <IconButton
                icon={Phone}
                label={`Call ${maskPhone(row.parentPhone)}`}
                tone="brand"
                onClick={() => onCall(row)}
              />
            ) : null}
          </div>
        </div>
      </Card>
    </li>
  );
};

// ---------------------------------------------------------------------------
// Single resolve modal — top-level so React never remounts it
// ---------------------------------------------------------------------------
const ResolveModal = ({
  open,
  onClose,
  resolving,
  note,
  setNote,
  noteError,
  busy,
  onSubmit,
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark resolved"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={busy}>
            {busy ? 'Saving…' : 'Mark resolved'}
          </Button>
        </>
      }
    >
      {resolving ? (
        <div className="space-y-3">
          <div className="max-h-36 overflow-y-auto rounded-lg bg-slate-50 p-2.5">
            <p className="text-[11.5px] font-bold text-slate-500">
              {resolving.parentName} · {resolving.studentName}
            </p>
            {resolving.message ? (
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
                {resolving.message}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label
                htmlFor="resolution-note"
                className="text-[11px] font-semibold text-slate-700"
              >
                What was done
              </label>
              <span className="shrink-0 text-[10px] font-medium text-slate-500">
                {note.length}/500
              </span>
            </div>

            <textarea
              ref={textareaRef}
              id="resolution-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              placeholder="e.g. Called Mrs. Mensah; confirmed GH₵ 300 cash on 12 June; receipt issued."
              aria-invalid={noteError ? 'true' : undefined}
              className={`w-full rounded-lg border bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-900 focus:outline-none ${
                noteError ? 'border-red-300' : 'border-slate-200 focus:border-brand-700'
              }`}
            />

            {noteError ? (
              <p className="mt-1 text-[10.5px] font-semibold text-red-600">
                {noteError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Bulk resolve modal — same treatment
// ---------------------------------------------------------------------------
const BulkResolveModal = ({
  open,
  onClose,
  selectedRows,
  selectedCount,
  bulkNote,
  setBulkNote,
  busy,
  onSubmit,
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Resolve ${selectedCount}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={busy}>
            {busy ? 'Saving…' : `Resolve ${selectedCount}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-2.5">
          <ul className="space-y-1">
            {selectedRows.slice(0, 6).map((row) => (
              <li key={row._id} className="text-[11.5px] text-slate-700">
                <span className="font-extrabold">{row.parentName}</span>
                {' · '}
                <span className="text-slate-500">{row.studentName}</span>
              </li>
            ))}
            {selectedRows.length > 6 ? (
              <li className="text-[10.5px] italic text-slate-500">
                and {selectedRows.length - 6} more…
              </li>
            ) : null}
          </ul>
        </div>

        <div>
          <label
            htmlFor="bulk-note"
            className="mb-1 block text-[11px] font-semibold text-slate-700"
          >
            Shared note
          </label>
          <textarea
            ref={textareaRef}
            id="bulk-note"
            rows={3}
            value={bulkNote}
            onChange={(event) => setBulkNote(event.target.value)}
            maxLength={500}
            placeholder="e.g. Called all parents about June reconciliation."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-900 focus:border-brand-700 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ParentMessages = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({
    rows: [],
    meta: null,
    counts: null,
    loading: true,
    error: null,
  });

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
  const [selected, setSelected] = useState(() => new Set());
  const [bulkResolving, setBulkResolving] = useState(false);
  const [bulkNote, setBulkNote] = useState('');
  const failedReadsRef = useRef(new Set());
  const hasAutoFocusedRef = useRef(false);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const timer = setInterval(() => setState((c) => ({ ...c })), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setState((c) => ({ ...c, loading: true, error: null }));

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
        setSelected(new Set());
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

  const onRead = useCallback((row) => {
    if (row.readAt) return;
    const stamp = new Date().toISOString();
    setState((current) => ({
      ...current,
      rows: current.rows.map((item) =>
        String(item._id) === String(row._id)
          ? {
              ...item,
              readAt: item.readAt || stamp,
              status: item.status === 'new' ? 'read' : item.status,
            }
          : item
      ),
    }));
    markParentMessageRead(row._id).catch(() => {
      failedReadsRef.current.add(String(row._id));
    });
  }, []);

  useEffect(() => {
    if (state.loading || state.error) return;
    if (failedReadsRef.current.size === 0) return;
    const pending = [...failedReadsRef.current];
    failedReadsRef.current.clear();
    pending.forEach((id) => markParentMessageRead(id).catch(() => {}));
  }, [state.loading, state.error, reloadKey]);

  useEffect(() => {
    if (hasAutoFocusedRef.current) return;
    if (state.loading || state.rows.length === 0) return;
    const firstUnread = state.rows.find((r) => !r.readAt);
    if (firstUnread) onRead(firstUnread);
    hasAutoFocusedRef.current = true;
  }, [state.loading, state.rows, onRead]);

  const onCall = useCallback(
    (row) => {
      if (!row.parentPhone) {
        toast.error('No phone number on record for this parent.');
        return;
      }
      window.location.href = `tel:${row.parentPhone}`;
    },
    [toast]
  );

  const openResolve = useCallback((row) => {
    setResolving(row);
    setNote(row.resolutionNote || '');
    setNoteError(null);
  }, []);

  const closeResolve = useCallback(() => {
    setResolving(null);
    setNote('');
    setNoteError(null);
  }, []);

  const submitResolve = useCallback(async () => {
    if (!resolving || note.trim().length < 3) {
      setNoteError('Say what was done about it, so there is a record');
      return;
    }
    setBusy(true);
    setNoteError(null);

    try {
      await resolveParentMessage(resolving._id, note.trim());
      toast.success('Marked as resolved.');

      const wasLastRow = state.rows.length <= 1 && Number(filters.page) > 1;

      closeResolve();

      if (wasLastRow) setFilter('page', String(Number(filters.page) - 1));
      else refresh();
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setBusy(false);
    }
  }, [note, filters.page, refresh, resolving, setFilter, state.rows.length, toast, closeResolve]);

  const onSelect = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectAllVisible = useCallback(() => {
    setSelected(new Set(state.rows.map((r) => String(r._id))));
  }, [state.rows]);

  const selectedRows = useMemo(
    () => state.rows.filter((r) => selected.has(String(r._id))),
    [state.rows, selected]
  );

  const submitBulkResolve = useCallback(async () => {
    if (bulkNote.trim().length < 3) {
      toast.error('Say what was done, so there is a record');
      return;
    }
    const ids = [...selected];
    setBulkResolving(false);
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => resolveParentMessage(id, bulkNote.trim())));
      toast.success(`${ids.length} resolved.`);
      setBulkNote('');
      clearSelection();
      refresh();
    } catch (err) {
      toast.error(err.message || 'Bulk resolve failed.');
    } finally {
      setBusy(false);
    }
  }, [bulkNote, selected, toast, clearSelection, refresh]);

  const counts = state.counts || {};
  const unread = Number(counts.new) || 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Parent messages"
        title="Messages from parents"
        description="Anything a parent sends from their fee link lands here — a question, a payment that has not appeared, or a voice note."
        meta={
          unread > 0 ? (
            <Badge tone="amber">{unread} waiting</Badge>
          ) : (
            <Badge tone="green">All answered</Badge>
          )
        }
      />

      <Card padding="p-3" className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
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
                  className={`rounded-md px-2.5 py-1 text-[12px] font-extrabold transition-colors ${
                    isActive
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {count > 0 ? (
                    <span className="ml-1 text-[10px] font-bold text-slate-400">
                      {count}
                    </span>
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
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={queryDraft}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="Search…"
              aria-label="Search messages"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-[12px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
            {queryDraft ? (
              <button
                type="button"
                onClick={() => {
                  setQueryDraft('');
                  setFilter('q', '');
                }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </form>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold text-slate-400">
            Click a message's icon to act on it.
          </p>

          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1">
              <span className="text-[11.5px] font-extrabold text-brand-900">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={() => setBulkResolving(true)}
                className="rounded-md bg-brand-700 px-2 py-0.5 text-[10.5px] font-extrabold text-white transition-colors hover:bg-brand-800"
              >
                Resolve all
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[10.5px] font-extrabold text-brand-700 hover:underline"
              >
                Clear
              </button>
            </div>
          ) : state.rows.length > 1 ? (
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-[10.5px] font-extrabold text-slate-500 hover:text-brand-700 hover:underline"
            >
              Select all on page
            </button>
          ) : null}
        </div>
      </Card>

      {state.error ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold text-red-800">
              Could not load messages
            </p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-red-700">
              {state.error.message}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[10.5px] font-extrabold text-red-700 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!state.error && state.loading && state.rows.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((key) => (
            <Card key={key} padding="p-3">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
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
        <ul className="space-y-2">
          {state.rows.map((row) => (
            <MessageRow
              key={row._id}
              row={row}
              selected={selected.has(String(row._id))}
              onSelect={onSelect}
              onRead={onRead}
              onResolve={openResolve}
              onCall={onCall}
            />
          ))}
        </ul>
      ) : null}

      {state.meta && state.meta.totalPages > 1 ? (
        <div className="mt-4">
          <Pagination
            meta={state.meta}
            itemLabel="messages"
            onPageChange={(page) =>
              setFilter('page', page === 1 ? '' : String(page))
            }
            onPerPageChange={(perPage) => setFilter('perPage', String(perPage))}
          />
        </div>
      ) : null}

      <ResolveModal
        open={Boolean(resolving)}
        onClose={closeResolve}
        resolving={resolving}
        note={note}
        setNote={setNote}
        noteError={noteError}
        busy={busy}
        onSubmit={submitResolve}
      />

      <BulkResolveModal
        open={bulkResolving}
        onClose={() => setBulkResolving(false)}
        selectedRows={selectedRows}
        selectedCount={selected.size}
        bulkNote={bulkNote}
        setBulkNote={setBulkNote}
        busy={busy}
        onSubmit={submitBulkResolve}
      />
    </div>
  );
};

export default ParentMessages;