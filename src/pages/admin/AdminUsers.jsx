import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import Pagination from '../../components/students/Pagination';
import Badge from '../../components/dashboard/ui/Badge';
import Card from '../../components/dashboard/ui/Card';
import Modal from '../../components/common/Modal';
import { Field, SelectField, FormAlert } from '../../components/common/FormField';
import { useToast } from '../../hooks/useToast';
import { listPlatformUsers } from '../../services/admin';
import { removeUser, updateUserRole } from '../../services/user';
import { USER_ROLES, roleLabel } from '../../utils/constants';
import { formatCount } from '../../utils/format';

/**
 * The roles a request may assign — the client mirror of `ASSIGNABLE_ROLES` in
 * `Backend/src/validators/userValidators.js`.
 *
 * `super_admin` is absent, and its absence is the point: there is exactly one
 * platform owner, provisioned from the server environment, and it cannot be
 * granted through any API. Mirroring the list here means the console never offers
 * a choice the server will refuse — the alternative is a role picker whose fifth
 * option 422s on submit, after the operator has typed the rest of the form.
 *
 * `USER_ROLES` (all five) is still used for the read filter, because the owner's
 * own row has to be findable on the list.
 */
const ASSIGNABLE_ROLES = USER_ROLES.filter((role) => role !== 'super_admin');

const ROLE_TONES = {
  super_admin: 'ink',
  school_admin: 'brand',
  accountant: 'blue',
  teacher: 'slate',
  viewer: 'slate',
};

const STATUS_TONES = { active: 'green', suspended: 'red', invited: 'amber', deactivated: 'slate' };

/**
 * Every account on the platform, across every school.
 *
 * **There is no new endpoint for this, and that is worth stating** because it is
 * surprising. `listUsers` in `userController.js` computes
 * `targetSchoolId = query.schoolId || req.user.schoolId`, and a platform admin's
 * `schoolId` is `null` — so the `query.schoolId` filter is never applied and the
 * query returns every user on SukuuPay. The list this page needs is the existing
 * one, correctly scoped by who is asking.
 *
 * The consequence is that "all schools" is the *default scope* here, which is the
 * opposite of the school console, where the scope is fixed and cannot be widened.
 * So the scope is stated on the page rather than assumed: an operator looking at
 * "342 accounts" needs to know that is the whole platform and not their school.
 *
 * All five roles are offered, including `super_admin`. `SIGNUP_ROLES` omits it
 * deliberately — nobody self-registers as a platform admin — and that exclusion
 * belongs to the signup form, not to an operator filtering a list that already
 * contains them.
 *
 * Role changes and removals live here, as dialogs over a row rather than buttons
 * in a table header, because both act on one named person: a role change is the
 * difference between a bursar who can read a school's fee ledger and one who
 * cannot, and a removal revokes every session that person holds. Both name the
 * person and the role transition before they commit, and both record what they did
 * — `user.role_change` and `user.remove` in the audit log — which is the school's
 * only record of who could see its data.
 *
 * **The platform owner's row has no actions at all.** Not disabled ones: there is
 * one `super_admin`, it is provisioned from the server environment, and it cannot
 * be changed or removed through any API. The row says so instead, because a
 * greyed-out button implies a permission problem and this is a structural one.
 */
const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');

  const [roleTarget, setRoleTarget] = useState(null);
  const [nextRole, setNextRole] = useState('teacher');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const filters = useMemo(
    () => ({
      role: searchParams.get('role') || '',
      status: searchParams.get('status') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 50,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listPlatformUsers(filters)
      .then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
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

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.rows;
    return state.rows.filter((user) =>
      [user.name, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [state.rows, search]);

  const hasFilters = Boolean(filters.role || filters.status);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * The owner is identified by `isPlatformOwner`, not by role or by email.
   *
   * Role alone would also match a demoted former owner, and email would hard-code
   * a value the frontend has no business knowing — the frontend is told which
   * account it is by the server, which is the only party that can know.
   */
  const isOwner = (account) => account?.isPlatformOwner === true;

  const openRoleChange = (account) => {
    setRoleTarget(account);
    // Preselect the role they already hold, so the dialog opens on a no-op and a
    // careless Enter cannot demote somebody by accident.
    setNextRole(ASSIGNABLE_ROLES.includes(account.role) ? account.role : 'teacher');
    setFormError(null);
  };

  const submitRoleChange = async () => {
    if (!roleTarget || nextRole === roleTarget.role) {
      setRoleTarget(null);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await updateUserRole(roleTarget._id, nextRole);
      setRoleTarget(null);
      refresh();
      // Both sides of the transition, because that is what the audit records and
      // what the next person to look at this row will want to know.
      toast.success(
        `${roleTarget.name} is now ${roleLabel(nextRole).toLowerCase()} (was ${roleLabel(
          roleTarget.role
        ).toLowerCase()}).`
      );
    } catch (error) {
      // `PLATFORM_ROLE_NOT_GRANTABLE` cannot arrive from this picker — the option
      // is not offered — but the server's message is shown verbatim rather than
      // replaced with a generic one, so a rule change shows up as itself.
      setFormError(error.message || 'That role could not be assigned.');
    } finally {
      setBusy(false);
    }
  };

  const submitRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    setFormError(null);
    try {
      await removeUser(removeTarget._id);
      setRemoveTarget(null);
      refresh();
      toast.warning(
        `${removeTarget.name}’s access was removed and their sessions were signed out. This cannot be undone from here.`
      );
    } catch (error) {
      setFormError(error.message || 'That account could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Users"
        description="Every account registered on SukuuPay — school staff, parents and platform staff."
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="Search this page"
            icon={Search}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or phone"
          />

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
            {['active', 'invited', 'suspended', 'deactivated'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>
        </div>

        {/*
          The scope statement, and the only thing on this page that is not a
          control. The default here is *every school on the platform*, which is a
          wider blast radius than any other list in the product, and a filter bar
          that silently means "all 34,000 accounts" is how that scope gets lost.
        */}
        <p className="mt-3 text-[11px] font-semibold text-slate-400">
          Scope: all schools on the platform. Role and status filter every school; the search box
          filters the {state.meta?.total ? formatCount(state.meta.total) : ''} accounts on this page.
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
            icon={Users}
            title={hasFilters || search ? 'No accounts match these filters' : 'No accounts yet'}
            description={
              hasFilters || search
                ? 'Try clearing the search box or a filter.'
                : 'Accounts appear here as soon as somebody registers.'
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] border-collapse text-left">
                  <caption className="sr-only">Every account registered on the platform</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Person
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Phone
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Role
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((account) => (
                      <tr key={account._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <span className="block text-[13px] font-extrabold text-ink">{account.name}</span>
                          <span className="block text-[11px] font-semibold text-slate-400">
                            {account.email || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[12px] font-bold text-slate-600">
                          {account.phone || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={ROLE_TONES[account.role] || 'slate'}>
                              {roleLabel(account.role)}
                            </Badge>
                            {isOwner(account) && (
                              <Badge tone="ink" icon={ShieldCheck}>
                                Platform owner
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone={STATUS_TONES[account.status] || 'slate'} dot>
                            {account.status || 'unknown'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {/*
                              No buttons, and the reason in the cell rather than in a
                              tooltip. A disabled button says "you lack permission";
                              this says "this account is defined by the server
                              environment", which is a different fact and the one an
                              operator needs in order to know a redeploy is how it
                              would ever change.

                              The comment sits *outside* the ternary on purpose — a
                              `{/* … */}` immediately inside the opening parenthesis
                              opens an expression container, so the element after it
                              lands outside any JSX container and the file will not
                              parse.
                            */}
                            {isOwner(account) ? (
                              <span className="text-[11px] font-semibold text-slate-400">
                                Managed by the server environment
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openRoleChange(account)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                >
                                  <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                                  Role
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoveTarget(account);
                                    setFormError(null);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Remove
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4">
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

      {/* ── Change role ── */}
      <Modal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        title="Change this person’s role"
        description={
          roleTarget
            ? `${roleTarget.name} · ${roleTarget.email || 'no email on file'}. Currently ${roleLabel(
                roleTarget.role
              ).toLowerCase()}.`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setRoleTarget(null)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRoleChange}
              disabled={busy || nextRole === roleTarget?.role}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Change role'}
            </button>
          </>
        }
      >
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <div className={formError ? 'mt-3' : ''}>
          <SelectField
            label="Role"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value)}
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </SelectField>
        </div>

        {/*
          The consequence, in words, next to the picker.

          A role is not a label — it is the boundary around a school's fee data,
          and the operator choosing between "school administrator" and "viewer" has
          no way to tell from the option text what they are handing over. Saying it
          here costs one sentence and is the difference between an informed choice
          and a guess.
        */}
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
          {nextRole === 'school_admin'
            ? 'A school administrator has full governance of their school’s records and settings.'
            : nextRole === 'accountant'
              ? 'A bursar can take payments and read fee records, but cannot change school settings.'
              : nextRole === 'teacher'
                ? 'A teacher can record marks and see their own classes’ payments. No school settings, no exports.'
                : nextRole === 'viewer'
                  ? 'A viewer can read the dashboard and nothing else. Use this for anyone who only needs to see.'
                  : ''}
        </p>

        {/*
          Why the platform admin role is missing from the picker. Stated rather
          than left as a gap, because an operator who knows the role exists will
          otherwise assume it is a permissions problem on their own session.
        */}
        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
          Platform admin is not offered: SukuuPay has one, and it is defined by the server’s
          environment rather than granted here.
        </p>
      </Modal>

      {/* ── Remove ── */}
      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove this person’s access"
        description={
          removeTarget
            ? `${removeTarget.name} · ${removeTarget.email || 'no email on file'}`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setRemoveTarget(null)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRemove}
              disabled={busy}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? 'Removing…' : 'Remove access'}
            </button>
          </>
        }
      >
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        <div className={formError ? 'mt-3' : ''}>
          <p className="text-[13px] leading-relaxed text-slate-600">
            This signs them out of every device immediately and takes away their access to this
            school&rsquo;s records. It is recorded in the activity log, and it cannot be undone from
            this console — reinstating somebody means creating a new account.
          </p>
        </div>
      </Modal>
    </>
  );
};

export default AdminUsers;