import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Search } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import Pagination from '../../components/students/Pagination';
import Badge from '../../components/dashboard/ui/Badge';
import Card from '../../components/dashboard/ui/Card';
import { Field, SelectField } from '../../components/common/FormField';
import SchoolUsageDrawer from '../../components/admin/SchoolUsageDrawer';
import SuspendSchoolDialog from '../../components/admin/SuspendSchoolDialog';
import { useToast } from '../../hooks/useToast';
import {
  SCHOOL_STATUSES,
  SUBSCRIPTION_PLANS,
  listSchools,
  suspendSchool,
  unsuspendSchool,
} from '../../services/admin';
import { GHANA_REGIONS } from '../../utils/constants';
import { formatCediShort, formatCount } from '../../utils/format';

/**
 * Every school on the platform.
 *
 * Backed end to end by `GET /admin/schools` — filters, five sort keys, both sort
 * directions and pagination all come from `listAllSchoolsQuerySchema`, so there
 * is no client-side filtering pretending to be server-side here.
 *
 * Three conventions are worth naming because each is a decision:
 *
 *   - **Filters live in the query string.** The URL *is* the filter, so a filtered
 *     view is linkable and survives a reload. Same rule as `useUsers`.
 *   - **Search is client-side over the loaded page, not a re-query.** The endpoint
 *     does accept `search`, but typing it per keystroke is a request per character
 *     and a race the user can lose — the response for "sun" can land after the one
 *     for "sukuu" and win. `useFilteredUsers` states the same trade-off for the
 *     school console; this table follows it and searches the page it has.
 *   - **`Pagination` gets `meta` in its own shape.** `listSchools` normalises
 *     `{ page, perPage, total, pages }` into `{ page, perPage, total, totalPages }`,
 *     so this page never learns the API called the page size `perPage`.
 *
 * Suspending and unsuspending are **not row buttons** on this table. Suspending
 * cascades `status` to every user in the school (`MODULES_13_TO_17.md:1585`), so
 * the action lives in `SchoolUsageDrawer` — beside the usage figures that justify
 * it, behind a confirmed reason, with the blast radius spelled out. A one-click
 * lifecycle action in a list a platform admin scrolls through is a button that
 * eventually gets pressed by accident, and the blast radius here is a whole
 * school's staff.
 *
 * The row itself opens that drawer: the row *is* the summary — code, region, size,
 * volume, status — and an operator comparing schools reads across those columns, so
 * the whole row is the target rather than just the name.
 */
const STATUS_TONES = { active: 'green', suspended: 'red', archived: 'slate' };
const STATUS_LABELS = { active: 'Active', suspended: 'Suspended', archived: 'Archived' };

const AdminSchools = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      region: searchParams.get('region') || '',
      plan: searchParams.get('plan') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
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
   * The two lifecycle actions, returning `{ ok, error }` rather than throwing.
   *
   * Same shape as the mutation hooks in `hooks/useUsers.js`: the caller branches on
   * the result and never on a caught exception, so a failed suspend leaves the
   * dialog open with its reason intact instead of closing and losing what the
   * operator typed.
   */
  const confirmSuspend = useCallback(async (school, reason) => {
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
  }, [refresh, toast]);

  const confirmUnsuspend = useCallback(
    async (school) => {
      try {
        await unsuspendSchool(school._id);
        toast.success(`${school.name} and its staff can sign in again.`);
        setDrilldown(null);
        refresh();
      } catch (error) {
        toast.error(error.message || 'This school could not be restored.');
      }
    },
    [refresh, toast]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.rows;
    return state.rows.filter((school) =>
      [school.name, school.schoolCode, school.city, school.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [state.rows, search]);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Schools"
        description="Every school registered on SukuuPay, with its size and the volume it has moved."
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Search this page"
            icon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, code, city or email"
          />

          {/*
            `SelectField` takes its options as children, not an `options` prop —
            it is a styled native `<select>`. It is also a *named* export only:
            `export default Field`, so `import SelectField from '.../FormField'`
            silently binds the text input and this row would render four identical
            boxes. That trap has its own regression check in `.mockcheck`.
          */}
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {SCHOOL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Region"
            value={filters.region}
            onChange={(event) => setFilter('region', event.target.value)}
          >
            <option value="">All regions</option>
            {GHANA_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Plan"
            value={filters.plan}
            onChange={(event) => setFilter('plan', event.target.value)}
          >
            <option value="">All plans</option>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </SelectField>
        </div>

        {/*
          The scope reminder, stated once and only when it is true. A search box
          that filters the *loaded page* next to a server-side filter row is
          ambiguous by construction, so the hint says which is which instead of
          leaving the operator to assume the whole platform is searched.
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Status, region and plan filter the whole platform. The search box filters the{' '}
          {state.meta?.total ? formatCount(state.meta.total) : ''} schools on this page only.
        </p>
      </Card>

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
            title={hasFilters || search ? 'No schools match these filters' : 'No schools on the platform yet'}
            description={
              hasFilters || search
                ? 'Try clearing the search box or a filter.'
                : 'A school appears here once an administrator completes registration.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-left">
                  <caption className="sr-only">Schools registered on the platform</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Region
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
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((school) => (
                      <tr
                        key={school._id}
                        onClick={() => setDrilldown(school)}
                        className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        {/*
                          The whole row is the target, because the row *is* the
                          summary — code, region, size, volume, status — and an
                          operator comparing schools reads across those columns. The
                          affordance has to match: a name-only link invites clicking
                          the name and nothing else ever opens.

                          A `<tr>` with a click handler is not keyboard reachable, so
                          the school name is also a real link-shaped control. It
                          duplicates the handler rather than wrapping the row, which
                          would put interactive content inside a clickable row and
                          make Enter fire twice.
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
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCount(school.studentCount)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCount(school.staffCount)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                          {formatCediShort(school.paymentVolume)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={STATUS_TONES[school.status] || 'slate'} dot>
                            {STATUS_LABELS[school.status] || school.status || 'unknown'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
              {/*
                `onPerPageChange` is not optional in practice: `Pagination` wires
                its rows-per-page select unconditionally, so omitting the handler
                makes changing the page size throw on a server that did answer.
              */}
              <Pagination
                meta={state.meta}
                itemLabel="schools"
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

      {/* ── The drill-down, and the lifecycle action that lives inside it ── */}
      <SchoolUsageDrawer
        school={drilldown}
        onClose={() => setDrilldown(null)}
        onSuspend={(school) => setSuspendTarget(school)}
        onUnsuspend={confirmUnsuspend}
      />

      <SuspendSchoolDialog
        open={Boolean(suspendTarget)}
        school={suspendTarget}
        // The row's own counts, so the dialog can say "31 staff accounts" instead
        // of "every user in this school". The row already carries them, so this is
        // no extra request — and the number is what turns an abstraction into a
        // decision.
        counts={
          suspendTarget
            ? {
                staff: state.rows.find((row) => row._id === suspendTarget._id)?.staffCount,
                students: state.rows.find((row) => row._id === suspendTarget._id)?.studentCount,
              }
            : null
        }
        onClose={() => setSuspendTarget(null)}
        onConfirm={confirmSuspend}
      />
    </>
  );
};

export default AdminSchools;