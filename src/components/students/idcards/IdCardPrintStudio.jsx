import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
} from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import { SelectField } from '../../common/FormField';
import StudentAvatar from '../StudentAvatar';
import IdCardPreview from './IdCardPreview';
import Pagination from '../Pagination';
import useToast from '../../../hooks/useToast';
import usePrintRoster from '../../../hooks/usePrintRoster';
import { cardReadiness } from '../../../utils/idCardFields';
import { formatCedi, formatCount } from '../../../utils/format';
import {
  createIdCardBatch,
  downloadIdCardBatchPdf,
  downloadStudentIdCard,
  exportQrLinks,
} from '../../../services/idCards';

const PER_PAGE = 24;
/**
 * Print-readiness filters.
 *
 * The two photo filters are deliberately paired. A missing photo does not block
 * printing — the renderer draws a labelled placeholder tile — so "Missing photo"
 * was never enough on its own: a school chasing up photographs needs the cards
 * that *already have* one, and picking those out of an unfiltered grid is a
 * scroll through every student.
 */
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ready', label: 'Printable' },
  { value: 'blocked', label: 'Needs attention' },
  { value: 'has-photo', label: 'With photo' },
  { value: 'no-photo', label: 'Missing photo' },
];

const CARDS_PER_SHEET = 6;
const QUOTE_PER_CARD = 3.5;

const IdCardPrintStudio = ({ schoolId, school, classes }) => {
  const { success, warning, error: errorToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState(() => new Set());
  const [focused, setFocused] = useState(null);
  const [showBleed, setShowBleed] = useState(false);
  const [batch, setBatch] = useState({ status: 'idle', batchId: null });
  const pollRef = useRef(null);

  // Photograph presence goes to the server: it is a real column, so the filter
  // covers the whole roster rather than the 24 rows already on screen. The
  // readiness filters stay client-side because they are derived from the field
  // manifest, not stored anywhere.
  const photoParam = filter === 'has-photo' ? 'has' : filter === 'no-photo' ? 'missing' : '';

  const { rows: students, loading, error, meta, refresh } = usePrintRoster({
    page,
    perPage: PER_PAGE,
    className: classFilter,
    search,
    photo: photoParam,
  });
  const rows = useMemo(
    () =>
      students.map((student) => ({
        student,
        readiness: cardReadiness(student, school, {
          qrCode: student.payLink ? 'generated' : null,
          barcode: student.studentId || null,
          termsText: school?.name || null,
        }),
      })),
    [students, school]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ student, readiness }) => {
      if (term && !String(student.studentName || '').toLowerCase().includes(term)) return false;
      // Readiness filters only. Photograph presence is already resolved on the
      // server, so filtering again here would be right twice and wrong once the
      // two ever disagree.
      if (filter === 'ready') return readiness.canPrint;
      if (filter === 'blocked') return !readiness.canPrint;
      return true;
    });
  }, [rows, filter, search]);

  const totals = useMemo(
    () => ({
      shown: visible.length,
      printable: visible.filter((r) => r.readiness.canPrint).length,
      blocked: visible.filter((r) => !r.readiness.canPrint).length,
      withPhoto: visible.filter((r) => Boolean(r.student.studentImage)).length,
      noPhoto: visible.filter((r) => !r.student.studentImage).length,
      withQr: visible.filter((r) => Boolean(r.student.payLink)).length,
    }),
    [visible]
  );

  const selectedPrintable = useMemo(
    () =>
      visible.filter(
        ({ student, readiness }) =>
          readiness.canPrint && selection.has(String(student._id || student.id))
      ),
    [visible, selection]
  );

  const sheets = Math.ceil(selectedPrintable.length / CARDS_PER_SHEET);
  const estimate = selectedPrintable.length * QUOTE_PER_CARD;

  const toggle = (id) =>
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    const printableIds = visible
      .filter(({ readiness }) => readiness.canPrint)
      .map(({ student }) => String(student._id || student.id));
    setSelection((current) => {
      const allSelected = printableIds.every((id) => current.has(id));
      const next = new Set(current);
      printableIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const blockedSelected = useMemo(() => {
    const blocked = new Set(
      rows
        .filter(({ readiness }) => !readiness.canPrint)
        .map(({ student }) => String(student._id || student.id))
    );
    return [...selection].filter((id) => blocked.has(id));
  }, [rows, selection]);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  const downloadWhenReady = useCallback(
    async (batchId, attempt = 0) => {
      if (attempt > 40) {
        setBatch({ status: 'failed', batchId, error: 'Timed out waiting for the print file.' });
        return;
      }
      try {
        const result = await downloadIdCardBatchPdf(batchId);
        if (result?.status === 'pending') {
          pollRef.current = setTimeout(() => downloadWhenReady(batchId, attempt + 1), 4000);
          return;
        }
        success(`Downloaded ${result}`);
        setBatch({ status: 'idle', batchId: null });
      } catch (err) {
        setBatch({ status: 'failed', batchId, error: err.message });
        errorToast(err.message);
      }
    },
    [errorToast, success]
  );

  const startBatch = async () => {
    if (blockedSelected.length) {
      warning(
        `${formatCount(blockedSelected.length)} selected ${
          blockedSelected.length === 1 ? 'student is' : 'students are'
        } missing a required card field. Clear the selection and pick only printable students.`
      );
      return;
    }
    if (!selectedPrintable.length) return;

    setBatch({ status: 'starting', batchId: null });
    try {
      const result = await createIdCardBatch(
        selectedPrintable.map(({ student }) => student._id || student.id)
      );
      setBatch({ status: 'pending', batchId: result.batchId });
      pollRef.current = setTimeout(() => downloadWhenReady(result.batchId), 3000);
    } catch (err) {
      setBatch({ status: 'failed', batchId: null, error: err.message });
      errorToast(err.message);
    }
  };

  const busy = batch.status === 'starting' || batch.status === 'pending';

  if (error) {
    return (
      <Card padding="p-5">
        <p className="text-sm font-bold text-red-700">{error.message}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card padding="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[13rem] flex-1">
              <label htmlFor="idcard-search" className="sr-only">
                Search students
              </label>
              <Search
                className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="idcard-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search student name…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>

            <div className="w-full sm:w-44">
              <SelectField
                label="Class"
                value={classFilter}
                onChange={(event) => {
                  setClassFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All classes</option>
                {classes.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter students by print readiness"
            className="mt-3 flex flex-wrap items-center gap-1.5"
          >
            {FILTERS.map((option) => {
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFilter(option.value);
                    setPage(1);
                  }}
                  aria-pressed={active}
                  className={`rounded-xl px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
                    active
                      ? 'bg-brand-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Card>

        {loading && !students.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : !visible.length ? (
          <EmptyState
            icon={Printer}
            title="No students match"
            description="Adjust the class or filter to find students to print."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[12px] font-extrabold text-slate-600">
                <input
                  type="checkbox"
                  checked={
                    visible.some(({ readiness }) => readiness.canPrint) &&
                    visible
                      .filter(({ readiness }) => readiness.canPrint)
                      .every(({ student }) => selection.has(String(student._id || student.id)))
                  }
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                />
                Select all printable on this page
              </label>
              <p className="text-[12px] font-semibold text-slate-500">
                {formatCount(totals.shown)} shown · {formatCount(totals.printable)} printable ·{' '}
                {formatCount(totals.blocked)} blocked
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visible.map(({ student, readiness }) => {
                const id = String(student._id || student.id);
                const chosen = selection.has(id);
                return (
                  <div
                    key={id}
                    className={`group relative overflow-hidden rounded-xl border-2 bg-white p-3 text-left transition-all ${
                      chosen
                        ? 'border-brand-700 shadow-lift'
                        : readiness.canPrint
                          ? 'border-slate-200 hover:border-slate-300'
                          : 'border-amber-300 hover:border-amber-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      aria-pressed={chosen}
                      className="w-full text-left"
                    >
                      <span className="absolute right-2 top-2">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold ${
                            chosen ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                          aria-hidden="true"
                        >
                          {chosen ? '✓' : ''}
                        </span>
                      </span>

                      <span className="flex items-center gap-2.5 pr-6">
                        <StudentAvatar student={student} size="lg" decorative={false} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-extrabold text-ink">
                            {student.studentName}
                          </span>
                          <span className="block truncate font-mono text-[11px] font-bold text-slate-500">
                            {student.studentId}
                          </span>
                          <span className="block truncate text-[11px] font-semibold text-slate-500">
                            {student.studentClass}
                          </span>
                        </span>
                      </span>

                      <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {readiness.canPrint ? (
                          <Badge tone="green" icon={BadgeCheck}>
                            Ready
                          </Badge>
                        ) : (
                          <Badge tone="amber" icon={CircleAlert}>
                            {formatCount(readiness.blocking.length)} required
                          </Badge>
                        )}
                        {!student.studentImage && <Badge tone="slate">No photo</Badge>}
                        {student.payLink && (
                          <Badge tone="brand" icon={QrCode}>
                            QR
                          </Badge>
                        )}
                      </span>

                      {!readiness.canPrint && (
                        <span className="mt-1.5 block truncate text-[11px] font-semibold text-amber-800">
                          Missing {readiness.blocking.map((f) => f.label).join(', ')}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setFocused({ student, readiness })}
                      aria-label={`Preview the card for ${student.studentName}`}
                      title="Preview & single PDF"
                      className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-brand-700"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            {meta && meta.totalPages > 1 && (
              <Pagination meta={meta} onPageChange={setPage} itemLabel="students" />
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        <Card padding="p-5">
          <h3 className="text-sm font-extrabold text-ink">Print batch</h3>

          <dl className="mt-3 space-y-2.5 text-[13px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-semibold text-slate-500">Cards selected</dt>
              <dd className="font-extrabold tabular-nums text-ink">
                {formatCount(selectedPrintable.length)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-semibold text-slate-500">A4 sheets needed</dt>
              <dd className="font-extrabold tabular-nums text-ink">{formatCount(sheets)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-semibold text-slate-500">Verified photos</dt>
              <dd className="font-extrabold tabular-nums text-ink">
                {formatCount(totals.withPhoto)}
                <span className="ml-1 text-[11px] text-slate-400">
                  / {formatCount(totals.shown)}
                </span>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-semibold text-slate-500">Pay QR linked</dt>
              <dd className="font-extrabold tabular-nums text-ink">{formatCount(totals.withQr)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="flex items-baseline gap-2 text-[13px]">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Estimated
              </span>
              <span className="font-extrabold tabular-nums text-ink">
                {formatCedi(estimate * 100)}
              </span>
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              {formatCedi(QUOTE_PER_CARD * 100)} per card. An estimate from the print partner —
              nothing is charged here.
            </p>
          </div>

          {batch.status === 'failed' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
              <p className="text-[12px] font-semibold text-red-900">{batch.error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={startBatch}
            disabled={busy || !selectedPrintable.length}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="h-4 w-4" aria-hidden="true" />
            )}
            {batch.status === 'starting'
              ? 'Starting…'
              : batch.status === 'pending'
                ? 'Generating print file…'
                : `Batch print ${formatCount(selectedPrintable.length)} ${
                    selectedPrintable.length === 1 ? 'card' : 'cards'
                  }`}
          </button>

          {batch.status === 'pending' && (
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              The cards render in the background. The download starts on its own when the file is
              ready.
            </p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                if (!schoolId) return;
                exportQrLinks(schoolId)
                  .then((name) => success(`Downloaded ${name}`))
                  .catch((err) => errorToast(err.message));
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              Export pay links CSV
            </button>
          </div>
        </Card>

        <Card padding="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-ink">Card preview</h3>
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600">
              <input
                type="checkbox"
                checked={showBleed}
                onChange={(event) => setShowBleed(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
              />
              Show bleed
            </label>
          </div>

          {focused ? (
            <>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <StudentAvatar student={focused.student} size="sm" decorative={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold text-ink">
                    {focused.student.studentName}
                  </p>
                  <p className="font-mono text-[11px] font-bold text-slate-500">
                    {focused.student.studentId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadStudentIdCard(focused.student._id || focused.student.id)
                      .then((name) => success(`Downloaded ${name}`))
                      .catch((err) => errorToast(err.message))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  PDF
                </button>
              </div>

              <div className="mt-3">
                <IdCardPreview student={focused.student} school={school} showBleed={showBleed} />
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              title="No student selected"
              description="Choose a card from the grid to preview it and download a single PDF."
            />
          )}
        </Card>

        <Card padding="p-4">
          <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600"
              aria-hidden="true"
            />
            Cards are generated on the server from your school&rsquo;s own record. Printability is
            checked per student against the card field list, so a card without a name or guardian is
            held back rather than printed.
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-brand-700 hover:underline"
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            Refresh readiness
          </button>
        </Card>
      </div>
    </div>
  );
};

export default IdCardPrintStudio;