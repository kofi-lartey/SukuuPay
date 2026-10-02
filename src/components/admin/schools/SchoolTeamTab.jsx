import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../../students/Pagination';
import { SelectField } from '../../common/FormField';
import { listAllUsers } from '../../../services/admin';
import { roleLabel } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';
import { maskGhanaPhone } from '../../../utils/ghanaPhone';

const ROLE_TONES = {
  school_admin: 'brand',
  accountant: 'blue',
  teacher: 'slate',
  viewer: 'slate',
  super_admin: 'ink',
};

const STATUS_TONES = {
  active: 'green',
  invited: 'amber',
  suspended: 'red',
  deactivated: 'slate',
};

/**
 * Everybody with an account at one school.
 *
 * ── `GET /admin/users?schoolId=…`, not `getSchool`'s `teamMembers` ──
 *
 * The detail payload already carries `teamMembers` (`schools.service.js:232-235`), so
 * rendering it would have cost zero requests. Two reasons it is not used:
 *
 *   - it is **uncapped by page**. A 90-staff school returns 90 rows inline in the
 *     detail payload, which is the wrong place for a list that wants pagination and
 *     a count, and it makes the size of the school part of the cost of opening the
 *     page at all;
 *   - it is a *different projection* of the same accounts from the one the Users
 *     module reads, and this platform shows a person's role in two places. Two
 *     projections means two things to drift.
 *
 * `listAllUsers` is the endpoint the console's own Users screen reads, it is already
 * paginated, and its `schoolId` filter is exactly this query — so a role shown here
 * is the same role shown there, from the same document.
 *
 * ── The phone number is masked ──
 *
 * `maskGhanaPhone`, not the full number, and the reason is the same one the roster
 * table gives: this is a browsing surface, not the screen somebody is about to call.
 * A team list is read by a platform owner comparing staff across schools, and a
 * column of forty unmasked personal numbers is a privacy exposure created by
 * scrolling rather than by any decision.
 *
 * Role changes live in the Users module, not here. Changing somebody's role is the
 * difference between a bursar who can read a school's fee ledger and one who cannot,
 * and it is separately audited as `user.role_change` — which is the school's only
 * record of who could see its data. One place to do it, next to the account list that
 * an operator is already reading when they decide to.
 */
const SchoolTeamTab = ({ school }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);

  const role = searchParams.get('role') || '';
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 20;

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  const filters = useMemo(() => ({ role, status, page, perPage }), [role, status, page, perPage]);

  useEffect(() => {
    if (!school?._id) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listAllUsers({ schoolId: school._id, page, perPage, role: role || undefined, status: status || undefined })
      .then((result) =>
        active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [school?._id, filters, reloadKey]);

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

  if (!school) return null;

  const hasFilters = Boolean(role || status);

  return (
    <div className="space-y-4">
      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Role"
            value={role}
            onChange={(event) => setFilter('role', event.target.value)}
          >
            <option value="">Every role</option>
            {['school_admin', 'accountant', 'teacher', 'viewer', 'super_admin'].map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">Every status</option>
            {['active', 'invited', 'suspended', 'deactivated'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>
        </div>

        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
          Suspending this school sets <em>every</em> account below to suspended — that is the server
          doing it, not this screen. Role and status are changed from the Users module, where the
          change is separately audited against the person it affects.
        </p>
      </Card>

      {state.error ? (
        <EmptyState
          icon={Users}
          title="This school’s team could not be loaded"
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
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                Accounts at this school.{' '}
                {state.meta?.total ? formatCount(state.meta.total) : 0} accounts.
              </caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {['Person', 'Phone', 'Position', 'Role', 'Last signed in', 'Status'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.loading && state.rows.length === 0
                  ? [0, 1, 2, 3].map((row) => (
                      <tr key={row} className="border-b border-slate-50">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="h-5 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((account) => (
                      <tr
                        key={account._id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-3.5">
                          <span className="block text-[13px] font-extrabold text-ink">
                            {account.name || '—'}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {account.email || 'no email on file'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[12px] font-bold tabular-nums text-slate-600">
                          {account.phone ? maskGhanaPhone(account.phone) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                          {account.position || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={ROLE_TONES[account.role] || 'slate'}>
                            {roleLabel(account.role)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-500">
                          {account.lastLoginAt ? formatDate(account.lastLoginAt) : 'Never'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={STATUS_TONES[account.status] || 'slate'} dot>
                            {account.status || 'unknown'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {!state.loading && state.rows.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={Search}
                title={hasFilters ? 'No accounts match these filters' : 'Nobody has signed up at this school yet'}
                description={
                  hasFilters
                    ? 'Clear the role or status filter.'
                    : 'Staff accounts appear here as they are invited, and students’ accounts as parents register.'
                }
              />
            </div>
          )}

          {state.meta?.total > 0 && (
            <Pagination
              meta={state.meta}
              itemLabel="accounts"
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

export default SchoolTeamTab;