import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  LogOut,
  ServerCrash,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import { useToast } from '../../../hooks/useToast';
import {
  REPORT_TYPES,
  downloadReport,
  getPlatformRevenueReport,
  getSchoolPerformanceReport,
  getGrowthReport,
  getChurnReport,
} from '../../../services/admin';

/**
 * `REPORT_TYPES` → the service function that fetches each one.
 *
 * Declared at module scope and written out longhand rather than derived from a name
 * convention. `REPORT_TYPES` is the same array the export endpoint validates `type`
 * against (`admin.analytics.validation.js:140-150`), so a card offering a name with no
 * loader would fail at expand time rather than at build time — and a computed
 * `import()` lookup turns that into an `undefined is not a function` in the browser. A
 * derived map cannot be checked against the router, which is the same reason
 * `ADMIN_ROUTES` in `utils/constants.js` is longhand.
 */
const REPORT_SERVICE = {
  'platform-revenue': getPlatformRevenueReport,
  'school-performance': getSchoolPerformanceReport,
  growth: getGrowthReport,
  churn: getChurnReport,
};

/**
 * The four platform reports, as four cards that each expand to show exactly what the file
 * would contain.
 *
 * **The payload is rendered from its own `sections`, not from a hand-written table per
 * report.** Each report builder returns `{ report, generatedAt, filters, summary, sections }`
 * where every section is self-describing: `{ name, title, columns: [{key, header}], rows }`
 * (`Backend/src/services/admin/reports.service.js:287-325, 494-532`). The same structure is
 * what `csvFor`/`workbookFor` iterate to build the download
 * (`Backend/src/utils/reportExport.js:27-56`), and the controller says so on purpose:
 * "a client that renders the file's tables on screen is showing exactly what the operator
 * would download, rather than a parallel set of numbers computed for display."
 *
 * That is the reason for the generic renderer rather than four bespoke ones. Four
 * hand-written tables would be four second opinions about what a report contains, and
 * each would be wrong the moment a column is added. Rendering `sections` means the screen
 * and the file cannot disagree, and it means this file does not have to be edited when a
 * report gains a column.
 *
 * Two rendering rules the payload forces:
 *
 *   - **Values are rendered as the server sends them.** Money columns arrive as integer
 *     pesewas under a header that says `(pesewas)`, with a parallel `*Display` column
 *     beside them carrying the cedi-formatted string the server produced
 *     (`reports.service.js:516-530`). Re-formatting here would be a second formatter, and
 *     one that gets it wrong by 100× on the columns that have no twin. The rule that makes
 *     that safe is `utils/format.js` being the only place cedi is rendered — this screen
 *     renders none, so it cannot be the place the arithmetic goes wrong.
 *
 *   - **Nothing is filtered or sorted client-side.** A row count is printed next to the
 *     heading, and a section with zero rows says so in words, because a report the server
 *     truncated and a report that genuinely found nothing must not look alike.
 *
 * **PDF is fully supported.**
 *
 * It was not for most of this console's life: `sendReportFile` threw
 * `501 PDF_EXPORT_UNAVAILABLE` behind a comment claiming no PDF library was a
 * dependency while `pdfkit` sat in `package.json`. The genuine obstacle was that
 * `utils/pdfGenerator.js` renders ID cards from a fixed template, not tables of
 * arbitrary columns — `utils/reportPdf.js` is the second path that solves that, and
 * it derives column widths from the content.
 *
 * So the selector entry is live and the button is not disabled. It is **kept rather
 * than hidden** for the reason it was kept while it did not work: the server's own
 * vocabulary includes `pdf`, and a console that silently omits a format reads as a
 * console that does not support it. A hidden option is indistinguishable from an
 * unimplemented one — the label is what distinguishes them.
 *
 * One thing is worth knowing when reading the resulting file: `reportPdf.js` caps
 * rows at 5,000 and prints the truncation **on the page**. A PDF that silently
 * stopped early would be a financial document that looks complete.
 *
 * **The date range applies to all four** and lives in the query string, so "the platform
 * revenue report for Q1" is a link. Four separate ranges on one screen would be four
 * comparisons the reader has to hold at once, which is the opposite of what a report
 * screen is for.
 *
 * An expansion is the *only* thing the card does before it fetches — nothing is fetched on
 * mount. `GET /admin/reports/*` writes a `report.viewed` audit entry
 * (`reports.controller.js:80-116`), so a page that read all four reports every time it
 * opened would bury the rest of the trail under four entries per visit and make the log
 * harder to read, not easier.
 */
const REPORT_CARDS = {
  'platform-revenue': {
    icon: TrendingUp,
    title: 'Platform revenue',
    blurb: 'What SukuuPay earned, by kind, by month and by school. Read from the platform ledger only.',
  },
  'school-performance': {
    icon: Users,
    title: 'School performance',
    blurb: 'Every live school with what it collected, what it owes its parents, its size and its rail.',
  },
  growth: {
    icon: FileText,
    title: 'Growth',
    blurb: 'New schools and new students per month, with the revenue that followed them.',
  },
  churn: {
    icon: TrendingDown,
    title: 'Churn',
    blurb: 'Schools that went inactive in the window, and what they were paying before it happened.',
  },
};

const FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText },
  // `xlsx` is the public wire value; `sendReportFile` branches on `excel` and
  // `exportReport` renames it at the boundary (`reports.service.js:1149`).
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileText },
];

/**
 * Renders a value exactly as the report carries it.
 *
 * Objects and arrays become their JSON rather than `[object Object]`, and `null` becomes an
 * em dash rather than the string "null" — the report's own summary section uses `null` to
 * mean "no denominator to divide by" (`summarySection`, `reports.service.js:130`), and
 * printing the word `null` for that is a worse answer than a dash.
 */
const Cell = ({ value }) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-300">—</span>;
  }
  if (typeof value === 'object') {
    return (
      <code className="block max-w-md truncate font-mono text-[10px] text-slate-500" title={JSON.stringify(value)}>
        {JSON.stringify(value)}
      </code>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  return <span className="tabular-nums">{String(value)}</span>;
};

const Section = ({ section }) => {
  const columns = Array.isArray(section.columns) ? section.columns : [];
  const rows = Array.isArray(section.rows) ? section.rows : [];

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-extrabold text-ink">{section.title || section.name}</h4>
        <p className="text-[11px] font-semibold text-slate-400">
          {`${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-500">
          This section returned no rows. The server reports what it found; an empty section
          here is not something the console has hidden.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"
                  >
                    {column.header || column.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, index) => (
                <tr key={row._id || `${section.name}-${index}`} className="hover:bg-slate-50/60">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="whitespace-nowrap px-3 py-2 text-[12px] font-semibold text-slate-600"
                    >
                      <Cell value={row[column.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ReportCard = ({ type, card, expanded, onToggle, payload, loading, error, format, onFormatChange, onDownload, downloading }) => {
  const Icon = card.icon;
  const buttonId = `report-toggle-${type}`;

  return (
    <Card padding="p-0" className="flex flex-col">
      <h3 className="p-5 pb-0">
        {/*
          A real `<button>` with `aria-expanded`/`aria-controls` rather than a clickable
          card. The whole card is not the target on purpose: the footer holds a download
          button, and making the card a button would nest one control inside another — which
          is both invalid HTML and a keyboard trap, since Enter on the download button would
          also expand the card.
        */}
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`report-panel-${type}`}
          className="flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-extrabold leading-snug text-ink">{card.title}</span>
            <span className="mt-1 block text-[12px]/[18px] font-medium text-slate-500">{card.blurb}</span>
          </span>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div id={`report-panel-${type}`} role="region" aria-labelledby={buttonId} hidden={!expanded}>
        {expanded && (
          <div className="px-5 pb-5 pt-4">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-[12px] font-extrabold text-red-700">
                  {card.title} could not be generated.
                </p>
                <p className="mt-1 text-[12px]/[17px] font-semibold text-red-700/90">
                  {error.message || 'The request did not complete.'}
                </p>
              </div>
            ) : payload ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {payload.filters?.from && (
                    <p className="text-[11px] font-semibold text-slate-500">
                      {`${new Date(payload.filters.from).toLocaleDateString('en-GB')} – ${new Date(
                        payload.filters.to
                      ).toLocaleDateString('en-GB')}`}
                    </p>
                  )}
                  {payload.generatedAt && (
                    <p className="text-[11px] font-semibold text-slate-400">
                      {`Generated ${new Date(payload.generatedAt).toLocaleString('en-GB')}`}
                    </p>
                  )}
                  <Badge tone="slate">{payload.report || type}</Badge>
                </div>

                {(payload.sections || []).length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-500">
                    This report returned no sections.
                  </p>
                ) : (
                  payload.sections.map((section) => (
                    <Section key={section.name || section.title} section={section} />
                  ))
                )}

                {payload.note && (
                  <p className="flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{payload.note}</span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/*
        One footer per card, and the format selector sits in each of them rather than once
        at the top of the page. The selector answers "what file do I want", and a file is
        per report: choosing Excel above and CSV below would leave the operator's intent
        ambiguous, and the audit entry records the format actually sent.
      */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
        <label
          htmlFor={`report-format-${type}`}
          className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400"
        >
          Format
        </label>
        <select
          id={`report-format-${type}`}
          value={format}
          onChange={(event) => onFormatChange(type, event.target.value)}
          className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-[12px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
        >
          {FORMATS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDownload(type, format)}
          // Only the in-flight guard now. The old `|| format === 'pdf'` disabled the
          // button outright, which is the bug: it made the option in the selector
          // look broken and left the reason in a `title` nobody on a touch screen
          // will ever see. Every format now downloads.
          disabled={downloading === type}
          title={`Download the ${card.title} report as ${format.toUpperCase()}`}
          aria-label={`Download the ${card.title} report as ${format}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[12px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
        >
          {downloading === type ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {downloading === type ? 'Downloading…' : 'Download'}
        </button>
      </div>
    </Card>
  );
};

const ReportsCenter = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const open = searchParams.get('report') || '';
  // One format per card is tracked on the URL too, so a link to "the churn report as
  // Excel" reopens as that. `format_<type>` rather than a single shared value because the
  // four files are downloaded separately and an operator preparing two of them should not
  // have to re-pick between each.
  const formats = Object.fromEntries(
    REPORT_TYPES.map((type) => [type, searchParams.get(`format_${type}`) || 'csv'])
  );

  const [state, setState] = useState({});
  const [downloading, setDownloading] = useState(null);

  const setParam = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const toggle = useCallback(
    (type) => {
      setParam('report', open === type ? '' : type);
      // Nothing is fetched until this runs, which is also when the `report.viewed` audit
      // entry is written — see the module comment.
      setState((current) => {
        if (current[type] || open === type) return current;
        fetchReport(type);
        return current;
      });
    },
    [open, setParam]
  );

  const fetchReport = useCallback(
    async (type) => {
      const load = REPORT_SERVICE[type];
      if (!load) return;
      setState((current) => ({ ...current, [type]: { loading: true, data: null, error: null } }));
      try {
        const data = await load({ from, to });
        setState((current) => ({ ...current, [type]: { loading: false, data, error: null } }));
      } catch (error) {
        setState((current) => ({
          ...current,
          [type]: { loading: false, data: null, error },
        }));
      }
    },
    [from, to]
  );

  /**
   * The download, returning `{ ok, error }` rather than throwing.
   *
   * The convention is that a confirm handler never throws so the caller can branch on the
   * result, and this one matters more than usual: an export that fails is the one failure
   * in this module with a security dimension. The server records `admin.export` for every
   * file that leaves, so a client that silently swallowed the failure would leave the
   * operator believing they have a copy of a school's financial history when they have
   * nothing. The error is surfaced as a toast either way.
   */
  const runDownload = useCallback(
    async (type, format) => {
      setDownloading(type);
      try {
        await downloadReport({ type, from, to, format });
        toast.success(`${REPORT_CARDS[type].title} downloaded as ${format.toUpperCase()}.`);
        return { ok: true };
      } catch (error) {
        toast.error(error.message || 'That report could not be exported.');
        return { ok: false, error: error.message };
      } finally {
        setDownloading(null);
      }
    },
    [from, to, toast]
  );

  useEffect(() => {
    // A window change invalidates every open report: the figures on screen would otherwise
    // describe a period the operator has just moved away from, which is worse than an
    // empty panel.
    if (open && state[open]) fetchReport(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Reports"
        description="The owner's four reports, generated from live platform data. Each card shows exactly the rows its download would contain."
        actions={
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-600">
            <LogOut className="h-4 w-4 text-brand-700" aria-hidden="true" />
            Exports are audited
          </span>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="reports-from"
              className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
            >
              From
            </label>
            <input
              id="reports-from"
              type="date"
              value={from}
              onChange={(event) => setParam('from', event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            />
          </div>
          <div>
            <label
              htmlFor="reports-to"
              className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700"
            >
              To
            </label>
            <input
              id="reports-to"
              type="date"
              value={to}
              onChange={(event) => setParam('to', event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-3 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            />
          </div>
        </div>
        <p className="mt-2 text-[11px]/[16px] font-semibold text-slate-500">
          One window for all four reports, so the cards beside each other are comparable.
          Leave both empty for the server&rsquo;s default. Opening a report records a
          <code className="mx-1 font-mono">report.viewed</code>
          entry, and downloading one records an
          <code className="mx-1 font-mono">admin.export</code> entry — the export is the one
          read a school cannot audit itself, because the file is afterwards on somebody&rsquo;s
          laptop.
        </p>
      </Card>

      {REPORT_TYPES.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="No report types are configured"
            description="The service exports REPORT_TYPES as an empty list, so there is nothing this screen can generate."
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {REPORT_TYPES.map((type) => {
            const card = REPORT_CARDS[type];
            if (!card) return null;
            const slot = state[type] || {};
            return (
              <ReportCard
                key={type}
                type={type}
                card={card}
                expanded={open === type}
                onToggle={() => toggle(type)}
                payload={slot.data}
                loading={Boolean(slot.loading)}
                error={slot.error}
                format={formats[type]}
                onFormatChange={(key, value) => setParam(`format_${key}`, value === 'csv' ? '' : value)}
                onDownload={runDownload}
                downloading={downloading === type ? type : null}
              />
            );
          })}
        </div>
      )}
    </>
  );
};

export default ReportsCenter;
