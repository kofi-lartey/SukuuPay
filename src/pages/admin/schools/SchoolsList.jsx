import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Download,
  Eye,
  Percent,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolUsageDrawer from '../../../components/admin/SchoolUsageDrawer';
import SuspendSchoolDialog from '../../../components/admin/SuspendSchoolDialog';
import RowActionMenu from '../../../components/admin/schools/RowActionMenu';
import MarkupEditorModal from '../../../components/admin/schools/MarkupEditorModal';
import ImpersonateModal from '../../../components/admin/schools/ImpersonateModal';
import AddTagModal from '../../../components/admin/schools/AddTagModal';
import { useToast } from '../../../hooks/useToast';
import {
  SCHOOL_STATUSES,
  SUBSCRIPTION_PLANS,
  listSchools,
  suspendSchool,
  unsuspendSchool,
} from '../../../services/admin';
import { GHANA_REGIONS, ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount, formatPercent } from '../../../utils/format';
import { formatDate, formatRelative } from '../../../utils/dates';

const STATUS_TONES = { active: 'green', suspended: 'red', archived: 'slate' };
const STATUS_LABELS = { active: 'Active', suspended: 'Suspended', archived: 'Archived' };

/**
 * The `sortBy` keys `listAllSchoolsQuerySchema` allow-lists
 * (`Backend/src/validations/admin.validation.js:28-31`).
 *
 * **Closed list, and it is exactly these five — `paymentVolume` and `students` are
 * deliberately absent.** The brief asked for them "if the server supports it"; it does
 * not. The schema is `.valid("name","createdAt","schoolCode","region","status")`, so a
 * request for `sortBy=paymentVolume` is a 422 from Joi before the query is ever built.
 * Both figures *exist* on every row, but as aggregates computed in the same
 * aggregation that fills the list (`admin.service.js:143-152`) — they are not fields on
 * `School`, so there is nothing to sort on and Mongo would have to sort in memory
 * after the fact, which a paginated endpoint cannot do honestly.
 *
 * Offering either key anyway would produce a sort control that 422s on click — the
 * same failure `TransactionTable` documents for its `status` column ("a sort control
 * that fails its own request is worse than no control"). If those two sorts are ever
 * wanted, the fix is a server change, not a dropdown option.
 */
const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'schoolCode', label: 'School code' },
  { value: 'region', label: 'Region' },
  { value: 'status', label: 'Status' },
];

/** The cedi, gateway and tag vocabularies, worded for a person rather than a schema. */
const GATEWAY_LABELS = {
  moolre: 'Moolre',
  arke: 'Arkesel',
  mnotify: 'Mnotify',
  manual: 'Manual',
};

/**
 * Every school on the platform.
 *
 * ── Why this file exists rather than `AdminSchools.jsx` ──
 *
 * It was extracted from `pages/admin/AdminSchools.jsx` rather than the old file being
 * grown in place, and the extraction is clean: the whole screen is one page component
 * with no imports from anywhere but shared components and services, so moving it is a
 * rename plus a set of path corrections and nothing behavioural. `AdminSchools.jsx` is
 * deleted.
 *
 * The reason is that the console now has more than five modules with sub-pages, and
 * `pages/admin/` had stopped describing what it held: one flat page per console module
 * alongside a `schools/` directory holding the detail page, its eight tabs and four
 * dialogs. A file named for the list, sitting next to a directory named for the same
 * subject, is the shape of a codebase nobody can navigate — the next person adds
 * `SchoolSuspend.jsx` to `pages/admin/` and asks which of the two school files to open.
 * One subject, one directory. `ADMIN_NAV` and `ROUTES` are untouched, so the route
 * this file serves (`ROUTES.ADMIN_SCHOOLS`) is exactly the route it served before.
 *
 * ── Filters ──
 *
 * Status, region, plan, sort and page live in the query string, so a filtered view is
 * linkable and survives a reload. **Any filter change deletes `page`** — otherwise
 * narrowing a filter while on page 7 of the old result set lands you on an empty page,
 * which reads as "this filter matched nothing" rather than "you are past the end".
 *
 * Search and **tag** are the two exceptions, and both filter the loaded page rather
 * than re-querying, for the same reason the original search box did: typing per
 * keystroke is a request per character and a race the user can lose — the response for
 * "sun" can land after the one for "sukuu" and win.
 *
 * `tag` is the newer of the two and deserves its own note, because it is a real
 * limitation rather than a choice. **The server does support `?tag=`** —
 * `listAllSchoolsQuerySchema.tag` is in the validation schema and `listAllSchools`
 * filters `subscription.tags` (`admin.service.js:29,51`) — but `listSchools` in
 * `src/services/admin.js` does not put `tag` in its `params` object, and services are
 * not editable from this screen. So the tag control filters the loaded page and the
 * scope hint below the filter bar says so, in the same words as the search box. The
 * fix is one line in the service; when it lands, this control becomes server-side
 * without a change here.
 *
 * Because `tag` must not trigger a fetch, `filters` is memoised on its primitive
 * values rather than on `searchParams`. `searchParams` is a new object on every
 * navigation, so keying on it would re-run the request when the only thing that
 * changed was a tag chip — a request per keystroke, which is the race above.
 *
 * ── Row actions live in a `⋯` menu, and suspension is still behind a dialog ──
 *
 * The original page deliberately had no row buttons at all: suspending cascades
 * `status` to every user in the school (`MODULES_13_TO_17.md:1585`), so it belonged
 * in `SchoolUsageDrawer`, beside the evidence for why you would do it. That reasoning
 * has not been abandoned — it has been met where the console has actually grown. Five
 * actions cannot sit in one row of a table that is already nine columns wide, and five
 * inline icon buttons put "signs out a whole school's staff" two mis-clicks from
 * "open a page". One `⋯` costs a single narrow cell and puts the whole set behind an
 * explicit choice. Suspension is still inside it, still behind a confirmed dialog with
 * the blast radius in the words, and the row itself still opens the usage drawer.
 *
 * ── Bulk suspend takes one reason, not N ──
 *
 * The reason is not an internal justification. It is the string each school's own
 * staff are shown when they are signed out. N schools selected together share one
 * cause — a billing migration, an integration rollout, a fraud wave across a group —
 * and one thing to tell their staff. N reasons would produce N differently-worded
 * explanations of a single decision, which is worse for the schools and *less*
 * auditable, because the audit log records what was actually written and an operator
 * who typed three variants cannot afterwards say which one they meant. It is also a
 * form nobody would fill in: the answer they gave the first time is still on screen.
 * If the causes genuinely differ, they are not one bulk action — they are N single
 * suspensions, and the row menu has one.
 *
 * ── Bulk export is a client-side CSV, and why ──
 *
 * There is no server export for the schools list. The alternatives are both worse: a
 * `getSchoolUsage` call per selected school is N round trips that can each fail
 * independently and produce a file that is silently missing rows, and building a new
 * export route is a server change for a screen whose purpose is to answer "what did I
 * just select". The rows already carry every commercial term the table shows, so the
 * file is a projection of what is on screen — which is also what makes it
 * unsurprising. Money is written twice: integer pesewas, as the wire has it, and
 * formatted cedis, because a spreadsheet column somebody adds up should not need a
 * divide by 100 in a formula.
 */
const SchoolsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [drilldown, setDrilldown] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [bulkSuspend, setBulkSuspend] = useState(false);
  const [markupTarget, setMarkupTarget] = useState(null);
  const [impersonateTarget, setImpersonateTarget] = useState(null);
  const [tagTarget, setTagTarget] = useState(null);

  // Read the query string into primitives first, so the fetch effect below can key on
  // them. See the note on `filters` about why this is not `useMemo(…, [searchParams])`.
  const status = searchParams.get('status') || '';
  const region = searchParams.get('region') || '';
  const plan = searchParams.get('plan') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;
  // Page-scoped, like `search`. Present in the URL so the view is linkable, applied
  // to the loaded rows below rather than sent to the server.
  const tag = searchParams.get('tag') || '';

  const filters = useMemo(
    () => ({ status, region, plan, sortBy, sortOrder, page, perPage }),
    [status, region, plan, sortBy, sortOrder, page, perPage]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listSchools(filters)
      .then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

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

  const hasFilters = Boolean(filters.status || filters.region || filters.plan);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * Suspend one school. Returns `{ ok, error }` rather than throwing.
   *
   * Same shape as the mutation hooks in `hooks/useUsers.js`: the caller branches on
   * the result and never on a caught exception, so a failed suspend leaves the dialog
   * open with its reason intact instead of closing and losing what the operator typed.
   */
  const confirmSuspend = useCallback(
    async (school, reason) => {
      try {
        await suspendSchool(school._id, reason);
        toast.success(
          `${school.name} is suspended. Every account in the school has been signed out.`
        );
        // The row the drawer is showing is no longer accurate — its status changed
        // server-side — so the drawer closes rather than sitting there contradicting
        // the list behind it.
        setSuspendTarget(null);
        setDrilldown(null);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This school could not be suspended.' };
      }
    },
    [refresh, toast]
  );

  const confirmUnsuspend = useCallback(
    async (school) => {
      try {
        await unsuspendSchool(school._id);
        toast.success(`${school.name} and its staff can sign in again.`);
        setDrilldown(null);
        refresh();
        return { ok: true };
      } catch (error) {
        toast.error(error.message || 'This school could not be restored.');
        return { ok: false, error: error.message };
      }
    },
    [refresh, toast]
  );

  /**
   * Close the dialogs once a bulk pass has finished, however it finished.
   *
   * The dialog clears the selection itself on a partial failure so the operator can
   * see and retry what is left; this is the success path.
   */
  const afterBulkSuspend = useCallback(() => {
    setSelected(new Set());
    setBulkSuspend(false);
    refresh();
  }, [refresh]);

  /**
   * The tag vocabulary on this page, for the suggestions.
   *
   * Collected from the loaded rows rather than a fixed list. Tags are free text by
   * design — the backend caps them at 20 per school and 50 characters and lowercases
   * them, and says outright that a fixed vocabulary would need a deploy per new
   * label — so a hard-coded suggestion list would be a second list to keep in step
   * with the first, and would miss every label somebody invented last week.
   */
  const knownTags = useMemo(() => {
    const seen = new Set();
    state.rows.forEach((school) => {
      (school.tags || []).forEach((value) => seen.add(value));
    });
    return [...seen].sort();
  }, [state.rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const wanted = tag.trim().toLowerCase();

    return state.rows.filter((school) => {
      if (
        wanted &&
        !(school.tags || []).some((value) => String(value).toLowerCase() === wanted)
      ) {
        return false;
      }
      if (!term) return true;
      return [school.name, school.schoolCode, school.city, school.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [state.rows, search, tag]);

  /* ── Selection ── */

  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row._id));
  const someVisibleSelected = visible.some((row) => selected.has(row._id));

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visible.forEach((row) => next.delete(row._id));
      else visible.forEach((row) => next.add(row._id));
      return next;
    });
  };

  const toggleRow = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Selection is pruned to rows that still exist.
   *
   * A filter or a refresh can remove a row that was ticked, and a selection that
   * keeps referring to a school no longer on screen is a bulk action whose count
   * lies — "suspend 3 schools" naming one that is not there. Pruning on the change
   * rather than on click means the toolbar's count is always the number of schools
   * the operator can actually see selected.
   */
  useEffect(() => {
    setSelected((current) => {
      if (!current.size) return current;
      const present = new Set(state.rows.map((row) => row._id));
      const next = new Set([...current].filter((id) => present.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [state.rows]);

  const selectedSchools = useMemo(
    () => state.rows.filter((row) => selected.has(row._id)),
    [state.rows, selected]
  );

  /* ── Bulk export ── */

  const exportSelected = () => {
    if (!selectedSchools.length) return;

    const headers = [
      'Name',
      'School code',
      'Region',
      'City',
      'Status',
      'Plan',
      'Gateway',
      'Students',
      'Staff',
      'Markup %',
      'Tags',
      'Collected (pesewas)',
      'Collected (GH₵)',
      'Last payment',
    ];

    // Both money columns on purpose. The pesewa column is what the API has, so a file
    // fed into another system reconciles; the cedi column is what a person reads, so
    // it does not need a divide by 100 in a formula. `formatCedi` output is stripped
    // of the symbol for the same reason.
    const rows = selectedSchools.map((school) => [
      school.name || '',
      school.schoolCode || '',
      school.region || '',
      school.city || '',
      school.status || '',
      school.subscription?.plan || '',
      school.payment?.gatewayMode || '',
      String(school.studentCount ?? 0),
      String(school.staffCount ?? 0),
      String(school.payment?.platformMarkupPercent ?? 0),
      (school.tags || []).join('; '),
      String(school.paymentVolume ?? 0),
      String((Number(school.paymentVolume) || 0) / 100),
      school.lastPaymentAt ? new Date(school.lastPaymentAt).toISOString() : '',
    ]);

    const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');

    // Quoted for RFC 4180 so Excel opens it correctly on a double-click, and revoked
    // immediately after the click so a long session exporting repeatedly does not
    // leak a blob URL per export.
    //
    // The BOM is built with `fromCharCode`, never written as a literal character and not
    // even as a `U+FEFF` escape sequence. A BOM is invisible *by design* — that is the
    // entire point of it — which makes it the easiest character in a codebase for a
    // formatter, a copy-paste, or a "strip invisible characters" pass to delete
    // silently. When it vanishes the export still succeeds; it is only Excel's UTF-8
    // detection that quietly stops working, in a file opened by a bursar rather
    // than by us. `fromCharCode` survives every tool that does not know what it is
    // looking at, and reads unambiguously in a diff.
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sukuupay-schools-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${formatCount(selectedSchools.length)} schools.`);
  };

  /* ── Row menu items ── */

  const menuItemsFor = (school) => [
    {
      key: 'view',
      label: 'View school',
      icon: Eye,
      onSelect: () => navigate(`${ROUTES.ADMIN_SCHOOLS}/${school._id}`),
    },
    {
      key: 'impersonate',
      label: 'Impersonate',
      icon: ShieldCheck,
      onSelect: () => setImpersonateTarget(school),
    },
    school.status === 'suspended'
      ? {
          key: 'unsuspend',
          label: 'Unsuspend',
          icon: ShieldCheck,
          onSelect: () => confirmUnsuspend(school),
        }
      : {
          key: 'suspend',
          label: 'Suspend',
          icon: ShieldAlert,
          danger: true,
          onSelect: () => setSuspendTarget(school),
        },
    {
      key: 'markup',
      label: 'Change markup',
      icon: Percent,
      onSelect: () => setMarkupTarget(school),
    },
    {
      key: 'tag',
      label: school.tags?.length ? 'Edit tags' : 'Add tag',
      icon: Tag,
      onSelect: () => setTagTarget(school),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Schools"
        description="Every school registered on SukuuPay, with its size, its commercial terms and the volume it has moved."
        actions={
          <button
            type="button"
            onClick={() => navigate(`${ROUTES.ADMIN_SCHOOLS}/new`)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New school
          </button>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field
            label="Search this page"
            icon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, code, city or email"
          />

          {/*
            `SelectField` takes its options as children, not an `options` prop — it is
            a styled native `<select>`. That trap has its own regression check in
            `.mockcheck`.
          */}
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {SCHOOL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value] || value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Region"
            value={filters.region}
            onChange={(event) => setFilter('region', event.target.value)}
          >
            <option value="">All regions</option>
            {GHANA_REGIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Plan"
            value={filters.plan}
            onChange={(event) => setFilter('plan', event.target.value)}
          >
            <option value="">All plans</option>
            {SUBSCRIPTION_PLANS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Sort"
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextOrder] = event.target.value.split(':');
              setFilter('sortBy', nextSortBy);
              setFilter('sortOrder', nextOrder);
            }}
          >
            {SORT_OPTIONS.flatMap((option) => [
              <option key={`${option.value}:desc`} value={`${option.value}:desc`}>
                {option.label}
              </option>,
              <option key={`${option.value}:asc`} value={`${option.value}:asc`}>
                {option.label} · ascending
              </option>,
            ])}
          </SelectField>
        </div>

        {/* Tag. A committed chip with a remove button, plus what is in use on this page. */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px]/[15px] font-semibold text-slate-700">Tag</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {tag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1 text-[11px] font-extrabold text-brand-800">
                {tag}
                <button
                  type="button"
                  onClick={() => setFilter('tag', '')}
                  aria-label={`Clear the ${tag} tag filter`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-brand-800/60 transition-colors hover:bg-brand-100 hover:text-brand-800"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            )}

            <input
              type="text"
              value={tag}
              maxLength={50}
              onChange={(event) => setFilter('tag', event.target.value)}
              onKeyDown={(event) => {
                // Enter commits rather than re-querying per keystroke; the chip appears
                // and the filter is already applied, so there is nothing to submit.
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              placeholder="Filter by tag — type or pick one below"
              aria-label="Filter by tag"
              className="min-w-[14rem] flex-1 rounded-lg border border-slate-200 bg-white py-2 px-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            />
          </div>

          {knownTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {knownTags
                .filter((value) => value !== tag)
                .slice(0, 12)
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter('tag', value)}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-200 hover:text-ink"
                  >
                    {value}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/*
          The scope reminder, stated once and only when it is true. A search box that
          filters the *loaded page* next to server-side filters is ambiguous by
          construction, so the hint says which is which — and it names the tag filter
          explicitly rather than letting the reader assume `?tag=` in the URL means the
          server did the filtering. It does not, yet; see the note above.
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Status, region, plan and sort filter the whole platform. The search box and the tag filter
          narrow the {state.meta?.total ? formatCount(state.meta.total) : ''} schools on this page
          only.
        </p>
      </Card>

      {/* ── Bulk toolbar. Only while something is selected. ── */}
      {selectedSchools.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3"
        >
          <p className="text-[13px] font-extrabold text-brand-800">
            {formatCount(selectedSchools.length)} selected
          </p>

          <button
            type="button"
            onClick={() => setBulkSuspend(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-[13px] font-extrabold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Suspend selected
          </button>

          <button
            type="button"
            onClick={exportSelected}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-brand-800 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export selected
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-xl px-3 py-2 text-[13px] font-extrabold text-brand-800/70 transition-colors hover:bg-brand-100 hover:text-brand-800"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={Building2}
            title="The schools list could not be loaded"
            description={state.error.message}
            action={
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
              >
                Try again
              </button>
            }
          />
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={
              hasFilters || search || tag ? 'No schools match these filters' : 'No schools on the platform yet'
            }
            description={
              hasFilters || search || tag
                ? 'Try clearing the search box, the tag, or a filter.'
                : 'A school appears here once an administrator completes registration.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[78rem] border-collapse text-left">
                  <caption className="sr-only">Schools registered on the platform</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={(node) => {
                            // The indeterminate state is how "some of this page is
                            // ticked" is communicated; `checked` alone cannot express
                            // it, and an operator who cannot tell which rows are
                            // selected will tick the header again and unselect them all.
                            if (node) node.indeterminate = !allVisibleSelected && someVisibleSelected;
                          }}
                          onChange={toggleAllVisible}
                          aria-label="Select all schools on this page"
                          disabled={!visible.length}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                        />
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Region
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Tags
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Gateway
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Students
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Staff
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Volume
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Markup
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Last payment
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th scope="col" className="w-12 px-3 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((school) => {
                      const gatewayMode = school.payment?.gatewayMode;
                      const markup = Number(school.payment?.platformMarkupPercent);

                      return (
                        <tr
                          key={school._id}
                          onClick={() => setDrilldown(school)}
                          className={`cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                            selected.has(school._id) ? 'bg-brand-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={selected.has(school._id)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleRow(school._id)}
                              aria-label={`Select ${school.name}`}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                            />
                          </td>

                          {/*
                            The whole row is the target, because the row *is* the
                            summary and an operator comparing schools reads across those
                            columns. A `<tr>` with a click handler is not keyboard
                            reachable, so the name is also a real button — duplicating
                            the handler rather than wrapping the row, which would put
                            interactive content inside a clickable row and make Enter
                            fire twice.
                          */}
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDrilldown(school);
                              }}
                              className="block text-left text-[13px] font-extrabold text-ink underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                            >
                              {school.name}
                            </button>
                            <span className="block font-mono text-[11px] font-bold text-slate-400">
                              {school.schoolCode || '—'}
                              {school.city ? ` · ${school.city}` : ''}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-600">
                            {school.region || '—'}
                          </td>

                          {/* Tags as pills. A dash rather than an empty cell, because a
                              blank in the middle of a populated row reads as a missing
                              field rather than as "no tags". */}
                          <td className="px-5 py-3.5">
                            {(school.tags || []).length ? (
                              <span className="flex flex-wrap gap-1">
                                {school.tags.slice(0, 3).map((value) => (
                                  <Badge key={value} tone="brand">
                                    {value}
                                  </Badge>
                                ))}
                                {school.tags.length > 3 && (
                                  <Badge tone="slate">+{school.tags.length - 3}</Badge>
                                )}
                              </span>
                            ) : (
                              <span className="text-[12px] font-semibold text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-[12px] font-bold text-slate-600">
                            {GATEWAY_LABELS[gatewayMode] || gatewayMode || '—'}
                            {gatewayMode === 'manual' && (
                              <span className="mt-0.5 block text-[10px] font-semibold text-amber-600">
                                collects outside SukuuPay
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                            {formatCount(school.studentCount)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                            {formatCount(school.staffCount)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                            {formatCediShort(school.paymentVolume)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-slate-600">
                            {formatPercent(Number.isFinite(markup) ? markup : 0)}
                          </td>

                          {/*
                            `completed` payments only, server-side
                            (`admin.service.js:119-128`). A `pending` payment is an
                            attempt, not revenue, and a last-activity column built from
                            attempts reports an abandoned mid-transaction school as the
                            busiest tenant on the page. Relative time in the cell and
                            the full date as the accessible text, because "3 days ago"
                            is the useful reading and "02 Oct 2026" is the one that can
                            be reconciled.
                          */}
                          <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                            {school.lastPaymentAt ? (
                              <span title={formatDate(school.lastPaymentAt)}>
                                {formatRelative(school.lastPaymentAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">never</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <Badge tone={STATUS_TONES[school.status] || 'slate'} dot>
                              {STATUS_LABELS[school.status] || school.status || 'unknown'}
                            </Badge>
                          </td>

                          <td className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                            <RowActionMenu
                              label={`Actions for ${school.name}`}
                              items={menuItemsFor(school)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
              {/*
                `onPerPageChange` is not optional in practice: `Pagination` wires its
                rows-per-page select unconditionally, so omitting the handler makes
                changing the page size throw on a server that did answer.
              */}
              <Pagination
                meta={state.meta}
                itemLabel="schools"
                onPageChange={(next) => setFilter('page', String(next))}
                onPerPageChange={(next) => {
                  setFilter('perPage', String(next));
                  setFilter('page', '1');
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── The drill-down, and the lifecycle action reachable from it ── */}
      <SchoolUsageDrawer
        school={drilldown}
        onClose={() => setDrilldown(null)}
        onSuspend={(school) => setSuspendTarget(school)}
        onUnsuspend={confirmUnsuspend}
      />

      <SuspendSchoolDialog
        open={Boolean(suspendTarget) || bulkSuspend}
        school={suspendTarget}
        schools={bulkSuspend ? selectedSchools : undefined}
        // The row's own counts, so the dialog can say "31 staff accounts" instead of
        // "every user in this school". The row already carries them, so this is no
        // extra request — and the number is what turns an abstraction into a decision.
        counts={
          suspendTarget
            ? {
                staff: state.rows.find((row) => row._id === suspendTarget._id)?.staffCount,
                students: state.rows.find((row) => row._id === suspendTarget._id)?.studentCount,
              }
            : null
        }
        onClose={() => {
          setSuspendTarget(null);
          setBulkSuspend(false);
        }}
        onConfirm={confirmSuspend}
        // Only the single-school dialog closes itself on success: the bulk one runs a
        // pass over N schools and the operator needs to see the outcome, including a
        // partial one, rather than have the dialog vanish mid-sequence.
        onFinished={bulkSuspend ? afterBulkSuspend : undefined}
      />

      <MarkupEditorModal
        open={Boolean(markupTarget)}
        school={markupTarget}
        currentPercent={markupTarget?.payment?.platformMarkupPercent}
        onClose={() => setMarkupTarget(null)}
        onConfirmed={refresh}
      />

      <ImpersonateModal
        open={Boolean(impersonateTarget)}
        school={impersonateTarget}
        onClose={() => setImpersonateTarget(null)}
      />

      <AddTagModal
        open={Boolean(tagTarget)}
        school={tagTarget}
        suggestions={knownTags}
        onClose={() => setTagTarget(null)}
        onSaved={refresh}
      />
    </>
  );
};

export default SchoolsList;