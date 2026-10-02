import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GraduationCap, Search } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../../students/Pagination';
import Badge from '../../dashboard/ui/Badge';
import { Field, SelectField } from '../../common/FormField';
import { getStudentStats, listStudents } from '../../../services/students';
import { formatCedis, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

/** The sort keys `listStudentsQuerySchema` allow-lists. Anything else is a 422. */
const SORT_KEYS = ['studentName', 'balance', 'totalOwed', 'createdAt'];

/**
 * One school's roster, read from the platform console.
 *
 * ── Why a plain table and not `components/students/StudentTable.jsx` ──
 *
 * That component is not school-agnostic. It is the school console's roster, and it
 * is wired to that console's permissions in four places:
 *
 *   - the row's primary button calls `onOpenProfile`, which opens
 *     `StudentProfileDrawer` — a surface built from the *school's* endpoints;
 *   - the action column fires `onMessage` (a fee reminder to the guardian) and
 *     `onRegeneratePayLink`, both of which send a real SMS from the school's own
 *     credit to a real parent;
 *   - `onTransferOut` records a GES TS-4 against the school's academic records;
 *   - `onEdit` opens a form that writes to `PUT /students/:id`.
 *
 * Adapting it would mean passing eight callbacks, of which five would have to be
 * no-ops, and a row whose whole right-hand side is five buttons that silently do
 * nothing is worse than no buttons at all — an operator presses one, nothing happens,
 * and concludes the console is broken. Worse, `StudentTable` renders the guardian
 * phone **masked** but is `min-w-[60rem]` wide with no read-only mode, so the
 * platform view would either inherit the school console's column set or need a
 * second set of props for it. A plain table is ~80 lines and has no permissions to
 * get wrong. That is the trade, and it is the right one for a screen whose job is to
 * be looked at rather than acted on.
 *
 * ── Where the data comes from, and why it is not `recentStudents` ──
 *
 * `GET /admin/schools/:id` returns a `recentStudents` array **capped at ten**
 * (`Backend/src/services/admin/schools.service.js:226-230`). Using its `.length` as
 * enrolment is the trap the backend's own comment at line 200 calls out: it would
 * report a 1,200-student school as having ten.
 *
 * Instead this tab calls `GET /students?schoolId=…`, which genuinely accepts an
 * explicit `schoolId` from a `super_admin` — `resolveSchoolId`
 * (`Backend/src/services/student.service.js:52-57`) returns the explicit value for
 * that role and `listStudents` answers `400 NO_SCHOOL_SCOPE` without one. So the
 * roster is the real roster, server-paginated, with the real total in `meta.total`.
 *
 * Filters live in the query string and any change clears `page`, same rule as the
 * schools list: a bursar's question ("who in Jomoro is behind on fees") is specific
 * enough to be a link somebody pastes into a ticket.
 */
const SchoolStudentsTab = ({ school }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const search = searchParams.get('q') || '';
  const status = searchParams.get('status') || '';
  const sortBy = searchParams.get('sortBy') || 'studentName';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [stats, setStats] = useState({ data: null, error: null });

  /**
   * `filters` is a primitive-keyed memo rather than `useMemo(…, [searchParams])`.
   *
   * That looks like a micro-optimisation and is not: `searchParams` is a new object
   * on every navigation, so keying on it re-runs the fetch even when the *only*
   * thing that changed is a tab or an unrelated query parameter elsewhere on the
   * detail page. Keying on the individual values means the effect below runs when
   * the request would actually be different.
   */
  const filters = useMemo(
    () => ({ search, status, sortBy, sortOrder, page, perPage }),
    [search, status, sortBy, sortOrder, page, perPage]
  );

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listStudents({
      schoolId: school._id,
      page,
      perPage,
      search: search || undefined,
      // The server defaults `status` to `active`, which is right for the school
      // console and wrong here: an archived or graduated student is exactly who a
      // platform owner is looking for, so the console sends `all` unless narrowed.
      status: status || 'all',
      sortBy,
      sortOrder,
    })
      .then((result) =>
        active &&
        setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [school?._id, filters, reloadKey]);

  /**
   * The roster aggregates.
   *
   * A separate request, and separately allowed to fail: it is one `$group` over the
   * whole roster that the client cannot compute from a page of twenty, so it is worth
   * asking the server for — but a database hiccup there must not blank the list
   * underneath it, which is the same independence rule `AdminOverview` is built on.
   */
  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setStats({ data: null, error: null });

    getStudentStats({ schoolId: school._id })
      .then((data) => active && setStats({ data, error: null }))
      .catch((error) => active && setStats({ data: null, error }));

    return () => {
      active = false;
    };
  }, [school?._id, reloadKey]);

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

  const toggleSort = (key) => {
    if (sortBy === key) setFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setFilter('sortBy', key);
      setFilter('sortOrder', 'asc');
    }
  };

  if (!school) return null;

  const totals = stats.data || {};
  const hasFilters = Boolean(search || status);

  return (
    <div className="space-y-4">
      {/*
        Four figures the client cannot derive: `balance` is a computed field and
        "fully cleared" is a comparison against it across the whole roster, which is
        what `getStudentStats` exists for. When it fails the band says so rather than
        rendering zeros — zeros here would read as "nobody owes anything", which is
        the one statement about a school that must never be inferred from a failure.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          // The exact keys `getStudentStats` returns
          // (`Backend/src/services/student.service.js:774-789`): `overdueStudents`
          // and `outstanding`, not `overdue` / `totalOutstanding`.
          { label: 'On the roster', value: formatCount(totals.totalRoster) },
          { label: 'Fully cleared', value: formatCount(totals.fullyCleared) },
          { label: 'Overdue', value: formatCount(totals.overdueStudents) },
          { label: 'Outstanding', value: formatCedi(totals.outstanding) },
        ].map((tile) => (
          <Card key={tile.label} padding="p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              {tile.label}
            </p>
            {stats.error ? (
              <p className="mt-1.5 text-[13px] font-semibold text-amber-700">Unavailable</p>
            ) : (
              <p className="mt-1.5 text-xl font-extrabold tabular-nums text-ink">{tile.value}</p>
            )}
          </Card>
        ))}
      </div>

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Search the roster"
            icon={Search}
            value={search}
            onChange={(event) => setFilter('q', event.target.value)}
            placeholder="Student name, number, parent or phone"
          />

          <SelectField
            label="Status"
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All students</option>
            {['active', 'inactive', 'graduated', 'transferred', 'archived'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Sort by"
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [nextSortBy, nextOrder] = event.target.value.split(':');
              setFilter('sortBy', nextSortBy);
              setFilter('sortOrder', nextOrder);
            }}
          >
            {SORT_KEYS.flatMap((key) => [
              <option key={`${key}:asc`} value={`${key}:asc`}>
                {key} · ascending
              </option>,
              <option key={`${key}:desc`} value={`${key}:desc`}>
                {key} · descending
              </option>,
            ])}
          </SelectField>
        </div>
      </Card>

      {state.error ? (
        <EmptyState
          icon={GraduationCap}
          title="This school’s roster could not be loaded"
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
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse text-left">
              <caption className="sr-only">
                Students on this school&rsquo;s roster.{' '}
                {state.meta?.total ? formatCount(state.meta.total) : 0} students.
              </caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {[
                    { key: 'studentName', label: 'Student', sortable: true },
                    { key: 'class', label: 'Class', sortable: false },
                    { key: 'status', label: 'Status', sortable: false },
                    { key: 'totalOwed', label: 'Billed', sortable: true },
                    { key: 'totalPaid', label: 'Paid', sortable: false },
                    { key: 'balance', label: 'Balance', sortable: true },
                    { key: 'createdAt', label: 'Added', sortable: true },
                  ].map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={
                        sortableState(column, sortBy, sortOrder)
                      }
                      className={`whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 ${
                        ['totalOwed', 'totalPaid', 'balance'].includes(column.key)
                          ? 'text-right'
                          : ''
                      }`}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1 transition-colors hover:text-ink"
                        >
                          {column.label}
                          {sortBy === column.key && (
                            <span aria-hidden="true" className="text-[10px]">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {state.loading && state.rows.length === 0
                  ? [0, 1, 2, 3, 4].map((row) => (
                      <tr key={row} className="border-b border-slate-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((student) => (
                      <tr
                        key={student._id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <span className="block text-[13px] font-extrabold text-ink">
                            {student.studentName}
                          </span>
                          <span className="block font-mono text-[11px] font-bold text-slate-400">
                            {student.studentId || '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-[12px] font-extrabold text-slate-700">
                            {student.studentClass || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={student.status === 'active' ? 'green' : 'slate'}>
                            {student.status || 'unknown'}
                          </Badge>
                        </td>
                        {/* Every money figure is pesewas on the wire; `formatCedi` is
                            the only place that divides by 100. */}
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCedis(student.totalOwed)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCedis(student.totalPaid)}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums ${
                            Number(student.balance) > 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatCedis(student.balance)}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                          {formatDate(student.createdAt)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!state.loading && state.rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={GraduationCap}
                title={hasFilters ? 'No students match these filters' : 'No students on this roster yet'}
                description={
                  hasFilters
                    ? 'Try clearing the search box or the status filter. A roster that filters to nothing usually means the school has archived or graduated those students, not that the data is missing.'
                    : 'Students appear here as the school adds them or imports a roster.'
                }
              />
            </div>
          )}

          {state.meta?.total > 0 && (
            <Pagination
              meta={state.meta}
              itemLabel="students"
              onPageChange={(next) => setFilter('page', String(next))}
              onPerPageChange={(next) => {
                setFilter('perPage', String(next));
                setFilter('page', '1');
              }}
            />
          )}
        </Card>
      )}
    </div>
  );
};

/** `aria-sort` for a column header, per the WAI-ARIA table pattern. */
const sortableState = (column, sortBy, sortOrder) => {
  if (!column.sortable) return undefined;
  if (sortBy !== column.key) return 'none';
  return sortOrder === 'asc' ? 'ascending' : 'descending';
};

export default SchoolStudentsTab;