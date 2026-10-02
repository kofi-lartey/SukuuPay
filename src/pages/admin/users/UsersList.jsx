import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  KeyRound,
  Mail,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolFilterPicker from '../../../components/admin/SchoolFilterPicker';
import UserRoleDialog from '../../../components/admin/UserRoleDialog';
import UserStatusDialog from '../../../components/admin/UserStatusDialog';
import ResetUserPasswordDialog from '../../../components/admin/ResetUserPasswordDialog';
import ResendVerificationDialog from '../../../components/admin/ResendVerificationDialog';
import { useToast } from '../../../hooks/useToast';
import {
  USER_STATUSES,
  listAllUsers,
  resendVerification,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
} from '../../../services/admin';
import { ROUTES, USER_ROLES, roleLabel } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';
import { formatGhanaPhone } from '../../../utils/ghanaPhone';
import { formatDateTime, formatRelative } from '../../../utils/dates';

/**
 * Every account on the platform, across every school.
 *
 * **This page is not an edit of `AdminUsers.jsx`, and that is a decision rather
 * than an accident.** The extraction was considered and rejected for three
 * concrete reasons, all of which come from the two files reading *different
 * endpoints*:
 *
 *   - `AdminUsers.jsx` calls `listPlatformUsers` (`GET /users`), which is
 *     platform-wide only as a side effect of a `super_admin` having a null
 *     `schoolId`. It returns **no school name** — the table there is a column of
 *     ids if you try to show the school, and the brief's column list has one.
 *     `listAllUsers` (`GET /admin/users`) is the console's own endpoint, populates
 *     the school's name, and accepts the `schoolId` filter this screen needs.
 *   - `AdminUsers.jsx`'s second action is `removeUser` from `services/user` —
 *     the *school's* delete path, `DELETE /users/:id`. It is not part of the
 *     console's `/admin/users/*` surface and not part of this brief. Carrying it
 *     across would have made this page depend on an endpoint the platform console
 *     has no contract with.
 *   - Its filters are `role`/`status` only and its search is client-side over the
 *     loaded page. On a list that can hold every account on SukuuPay that is the
 *     wrong trade: "find the bursar whose number is on this SMS" is a question
 *     about the whole platform, and a search box that only knows about 50 rows
 *     answers it wrongly with total confidence.
 *
 * `AdminUsers.jsx` is left on disk rather than deleted — the router owns that
 * decision, and `App.jsx` still points `/admin/users` at it until the coordinator
 * rewires the route to this file.
 *
 * **Search goes to the server, debounced at 250ms.** `GET /admin/users` accepts
 * `search` and matches it against name, email and phone — which is what an operator
 * actually has: a name off a support call, or a number off an SMS that did not
 * arrive. The debounce is because the alternative is a request per keystroke and a
 * race the operator can lose (the response for "sun" landing after the one for
 * "sukuu" and winning).
 *
 * **The role *filter* offers all five roles while the role *picker* offers four.**
 * That is not an inconsistency. `super_admin` cannot be granted — `ASSIGNABLE_ROLES`
 * in `Backend/src/validators/userValidators.js` excludes it, `users.service.js:282`
 * refuses it, and `Backend/tests/platformOwner.test.js` enforces the invariant — but
 * the platform owner's account is a real row on this list, and a filter that cannot
 * find it would be hiding a fact about the deployment. `UserRoleDialog` renders the
 * grantable list.
 *
 * **Every mutation returns `{ ok, error }` and never throws**, so a refusal leaves
 * the dialog open on the operator's input instead of closing over what they typed
 * (`AdminSchools.jsx`, `hooks/useUsers.js`).
 *
 * **The row actions are icon buttons with `aria-label`s, not bare icons** — this
 * table has up to five per row and an operator is comparing columns across a
 * hundred of them, so the glyphs are quiet and the accessible names are full
 * sentences naming the person.
 *
 * "Resend verification" appears only on an unverified account. The endpoint is
 * idempotent and answers "already verified" as a *success*
 * (`users.service.js:489`), so offering the button on a verified account would be
 * a control whose only possible outcome is a message telling you it was not
 * needed. `UserDetail` does offer it unconditionally, because there the operator
 * arrives with a question about this one account and the "already verified" answer
 * is the point.
 */
const DEBOUNCE_MS = 250;

const ROLE_TONES = {
  super_admin: 'ink',
  school_admin: 'brand',
  accountant: 'blue',
  teacher: 'slate',
  viewer: 'slate',
};

const STATUS_TONES = { active: 'green', suspended: 'red', invited: 'amber', deactivated: 'slate' };

const STATUS_LABELS = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
};

/**
 * The owner is identified by `isPlatformOwner`, not by role and not by email.
 *
 * `Backend/src/services/admin/users.service.js:110` (`refusePlatformOwner`) guards
 * on exactly this flag, and its own comment gives the reason: role alone would also
 * match a demoted former owner, and an email would hard-code a value the frontend
 * has no business knowing. The frontend is told which account it is by the server,
 * which is the only party that can know.
 */
const isPlatformOwner = (user) => user?.isPlatformOwner === true || user?.role === 'super_admin';

/**
 * The initials in the avatar.
 *
 * There is no shared `Avatar` in this codebase — `TransactionTable` carries its own
 * `initials` helper and a five-colour tone table for exactly one table. Copying that
 * table here would be a second colour vocabulary for the same picture; one brand
 * circle is enough until somebody needs avatars in four places at once.
 */
const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const UsersList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [term, setTerm] = useState(searchParams.get('search') || '');

  const [roleTarget, setRoleTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [verificationTarget, setVerificationTarget] = useState(null);

  const filters = useMemo(
    () => ({
      role: searchParams.get('role') || '',
      status: searchParams.get('status') || '',
      schoolId: searchParams.get('schoolId') || '',
      search: searchParams.get('search') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAllUsers(filters)
      .then((result) =>
        active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  /** Any filter change resets to page 1 — page 7 of a new filter set is empty. */
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

  // The typed term and the applied term are separate state, so the box does not
  // fight the URL: a shared link renders its term immediately, and typing does not
  // re-request until it settles.
  useEffect(() => {
    setTerm(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    const applied = searchParams.get('search') || '';
    if (term === applied) return undefined;
    const timer = setTimeout(() => setFilter('search', term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, searchParams, setFilter]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const openDetail = useCallback(
    // Built from `ROUTES.ADMIN_USERS`, the single source for the path. The detail
    // pattern lives in `ADMIN_ROUTES.USER_DETAIL`, which is a *route* (`/admin/users/:userId`),
    // not a URL — concatenating it would produce a link to a literal `:userId`.
    (user) => navigate(`${ROUTES.ADMIN_USERS}/${user._id}`),
    [navigate]
  );

  /* ── Mutations: `{ ok, error }`, never a throw ── */
  const confirmRoleChange = useCallback(
    async (role) => {
      try {
        await updateUserRole(roleTarget._id, role);
        toast.success(
          `${roleTarget.name} is now ${roleLabel(role).toLowerCase()} (was ${roleLabel(
            roleTarget.role
          ).toLowerCase()}).`
        );
        setRoleTarget(null);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That role could not be changed.' };
      }
    },
    [roleTarget, refresh, toast]
  );

  const confirmStatusChange = useCallback(
    async (status) => {
      try {
        await updateUserStatus(statusTarget._id, status);
        toast.success(
          status === 'active'
            ? `${statusTarget.name} can sign in again.`
            : `${statusTarget.name} is now ${STATUS_LABELS[status]?.toLowerCase() || status}. ${
                status === 'active' ? '' : 'Their live sessions stop on their next request.'
              }`
        );
        setStatusTarget(null);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That account status could not be changed.' };
      }
    },
    [statusTarget, refresh, toast]
  );

  const confirmPasswordReset = useCallback(async () => {
    try {
      const data = await resetUserPassword(passwordTarget._id);
      refresh();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message || 'A password reset could not be sent.' };
    }
  }, [passwordTarget, refresh]);

  const confirmResendVerification = useCallback(async () => {
    try {
      const data = await resendVerification(verificationTarget._id);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message || 'The verification email could not be sent.' };
    }
  }, [verificationTarget]);

  const hasFilters = Boolean(filters.role || filters.status || filters.schoolId || filters.search);
  const onAdminPassword = state.rows.filter((user) => user.mustChangePassword === true).length;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Users"
        description="Every account registered on SukuuPay — school staff, parents and platform staff — across every school."
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Search every account"
            icon={Search}
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Name, email or phone"
            hint="Searches the platform"
          />

          <SchoolFilterPicker
            label="School"
            value={filters.schoolId}
            onChange={(schoolId) => setFilter('schoolId', schoolId)}
          />

          {/*
            `SelectField` is a **named** export: `FormField.jsx` has
            `export default Field`, so a default import of `SelectField` silently
            binds the text input and this row renders four identical boxes. Same trap
            `PaymentFilterBar` and `RosterFilterBar` document.
          */}
          <SelectField
            label="Role"
            value={filters.role}
            onChange={(event) => setFilter('role', event.target.value)}
          >
            <option value="">All roles</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status] || status}
              </option>
            ))}
          </SelectField>
        </div>

        {/*
          The scope statement, and the only thing in this bar that is not a control.
          The default is *every school on the platform* — a wider blast radius than
          any other list in the product — and a filter row that silently means "all
          30,000 accounts" is how that scope gets lost.
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Scope: all schools on the platform
          {state.meta?.total ? ` — ${formatCount(state.meta.total)} accounts match` : ''}. Search,
          school, role and status all filter the whole platform.
        </p>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={Users}
            title="The user list could not be loaded"
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
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No accounts match these filters' : 'No accounts yet'}
            description={
              hasFilters
                ? 'Try clearing the search box, the school, or a filter.'
                : 'Accounts appear here as soon as somebody registers.'
            }
          />
        ) : (
          <>
            {/*
              The `mustChangePassword` finding, surfaced above the table rather than
              only as a per-row badge.

              It is a real finding and not a curiosity: `resetUserPassword` does not
              set a password (it mails a link), so the only path that leaves somebody
              on an admin-minted credential is the *invitation* flow, which calls
              `generateDefaultPassword` and sets `mustChangePassword` until the holder
              chooses their own. A staff account still on that password is one any
              support call could walk into, and a count is what turns it into
              something an operator acts on. It counts the loaded page, so it says so.
            */}
            {onAdminPassword > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p className="text-[12px] font-semibold leading-relaxed text-amber-800">
                  {formatCount(onAdminPassword)} account{onAdminPassword === 1 ? '' : 's'} on this
                  page {onAdminPassword === 1 ? 'is' : 'are'} still on the password SukuuPay issued
                  at invitation and have never chosen their own — send a reset link from the row.
                </p>
              </div>
            )}

            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] border-collapse text-left">
                  <caption className="sr-only">
                    Every account registered on the platform
                    {state.meta?.total ? `, ${formatCount(state.meta.total)} matching` : ''}
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      {[
                        'Name',
                        'Email',
                        'Phone',
                        'Role',
                        'School',
                        'Status',
                        'Last login',
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400"
                        >
                          {label}
                        </th>
                      ))}
                      {/*
                        The actions column carries no visible header. Five icon-only
                        controls per row need their accessible names on the buttons
                        themselves, and a heading that repeated all five would be a
                        wall of text above a table whose rows are five pixels tall.
                      */}
                      <th scope="col" className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((user) => {
                      const owner = isPlatformOwner(user);
                      return (
                        <tr
                          key={user._id}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-3">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700"
                                aria-hidden="true"
                              >
                                {initials(user.name)}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-extrabold text-ink">
                                  {user.name}
                                </span>
                                {/*
                                  The credential flag, on the name rather than in its
                                  own column. It is a property of the account rather
                                  than of a column a reader scans across, and a
                                  dedicated "Password" column would be an eighth
                                  column of mostly-blank cells.
                                */}
                                {user.mustChangePassword === true && (
                                  <Badge tone="amber" icon={KeyRound}>
                                    Password never changed
                                  </Badge>
                                )}
                              </span>
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[13px] font-semibold text-slate-600">
                            {user.email || '—'}
                            {user.isEmailVerified === false && user.email && (
                              <span className="mt-0.5 block text-[11px] font-semibold text-amber-600">
                                Not verified
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 font-mono text-[12px] font-bold text-slate-600">
                            {user.phone ? formatGhanaPhone(user.phone) : '—'}
                          </td>

                          <td className="px-4 py-3">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Badge tone={ROLE_TONES[user.role] || 'slate'}>{roleLabel(user.role)}</Badge>
                              {owner && (
                                <Badge tone="ink" icon={ShieldCheck}>
                                  Platform owner
                                </Badge>
                              )}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-[13px] font-semibold text-slate-600">
                            {user.schoolId?.name || '—'}
                          </td>

                          <td className="px-4 py-3">
                            <Badge tone={STATUS_TONES[user.status] || 'slate'} dot>
                              {STATUS_LABELS[user.status] || user.status || 'unknown'}
                            </Badge>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {user.lastLoginAt ? (
                              <>
                                <span className="block text-[12px] font-bold text-slate-600">
                                  {formatRelative(user.lastLoginAt)}
                                </span>
                                <span className="block text-[11px] font-semibold text-slate-400">
                                  {formatDateTime(user.lastLoginAt)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[12px] font-semibold text-slate-400">Never</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {/*
                                The owner's five controls are replaced by a caption,
                                not disabled. A disabled button reports a permission
                                problem; the truth is that these writes are refused
                                for *every* caller because the target is the account
                                that defines the deployment
                                (`users.service.js:110`). Saying so on the row is the
                                only version of this an operator can act on.
                              */}
                              {owner ? (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Managed by the server environment
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openDetail(user)}
                                    aria-label={`View ${user.name}’s account`}
                                    title="View account"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                  >
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRoleTarget(user)}
                                    aria-label={`Change the role of ${user.name}`}
                                    title="Change role"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                  >
                                    <UserCog className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setStatusTarget(user)}
                                    aria-label={`Change the status of ${user.name}`}
                                    title="Change status"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                  >
                                    <UserX className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPasswordTarget(user)}
                                    aria-label={`Send a password reset link to ${user.name}`}
                                    title="Reset password"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                  >
                                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  {user.isEmailVerified === false && (
                                    <button
                                      type="button"
                                      onClick={() => setVerificationTarget(user)}
                                      aria-label={`Re-send the verification code to ${user.name}`}
                                      title="Resend verification"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                    >
                                      <Mail className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                  )}
                                </>
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
              {/*
                `onPerPageChange` is not optional in practice: `Pagination` wires its
                rows-per-page select unconditionally, so omitting the handler makes
                changing the page size throw on a server that did answer.
                `AdminSchools.jsx` says the same thing.
              */}
              <Pagination
                meta={state.meta}
                itemLabel="accounts"
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

      {/* ── The five row actions, as dialogs ── */}
      <UserRoleDialog
        open={Boolean(roleTarget)}
        user={roleTarget}
        onClose={() => setRoleTarget(null)}
        onConfirm={confirmRoleChange}
      />

      <UserStatusDialog
        open={Boolean(statusTarget)}
        user={statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
      />

      <ResetUserPasswordDialog
        open={Boolean(passwordTarget)}
        user={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onConfirm={confirmPasswordReset}
      />

      <ResendVerificationDialog
        open={Boolean(verificationTarget)}
        user={verificationTarget}
        onClose={() => setVerificationTarget(null)}
        onConfirm={confirmResendVerification}
      />
    </>
  );
};

export { DEBOUNCE_MS as USERS_SEARCH_DEBOUNCE_MS };
export default UsersList;