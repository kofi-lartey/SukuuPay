import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import InviteTeamMemberDialog from '../../components/user-management/InviteTeamMemberDialog';
import PendingApprovals from '../../components/user-management/PendingApprovals';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useUsers, useFilteredUsers, useUserActions } from '../../hooks/useUsers';
import { USER_ROLES, SIGNUP_ROLES } from '../../utils/constants';

/**
 * The status pill.
 *
 * Four states, not two, because they mean different things to whoever has to act
 * on them. "Active" and "Suspended" are settled. `invited` is the interesting
 * one: the account exists, the password was minted, and the only question is
 * whether the person has used it — so it is neither a warning nor a success, and
 * rendering it as either would train an admin to stop reading it.
 */
const STATUS_BADGE = {
  active: { tone: 'green', label: 'Active', icon: CheckCircle2 },
  invited: { tone: 'amber', label: 'Awaiting sign-in', icon: Clock },
  suspended: { tone: 'red', label: 'Suspended', icon: AlertTriangle },
  deactivated: { tone: 'slate', label: 'Deactivated', icon: AlertTriangle },
};

/** Roles shown as a dropdown, mirroring the invite dialog's options. */
const ROLE_LABEL = Object.fromEntries(SIGNUP_ROLES.map((r) => [r.value, r.label]));

const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || '?';

const relativeTime = (value) => {
  if (!value) return '—';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '—';
  const seconds = Math.round((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * The User Management module.
 *
 * The team roster, and the four things an administrator does with it: invite
 * somebody, approve somebody who asked to join, change what they can do, and
 * take that away.
 *
 * Two decisions worth stating, because both are about who can see this page at
 * all rather than what is on it:
 *
 * The nav entry is hidden from teachers, bursars and viewers. So is the route's
 * data, by the server, which is the actual boundary — the rail's `roles` filter
 * is presentation and is treated as such. A bursar who types the URL directly
 * gets an empty shell and a `403`, which is the correct answer and not something
 * this component needs to defend against on its own.
 *
 * Resending is offered only for accounts that have never signed in. That is not
 * merely a UI nicety: the server refuses it, because re-minting a password for
 * somebody who is actively using the account would change their password out
 * from under them. Hiding a button the server rejects would just teach people
 * that the page is lying.
 */
const UserManagement = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);

  const { rows, loading, error, filters, setFilter, hasFilters } = useUsers(reloadKey);
  const visibleUsers = useFilteredUsers(rows, search);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const actions = useUserActions({ onDone: refresh });

  /**
   * Counts for the KPI strip.
   *
   * Derived from the loaded page, not a separate stats request — and that is
   * only safe because a school's staff list is small enough to arrive in one
   * page. `useStudents` needs `/stats` for the same numbers because a roster can
   * be a thousand students; copying that pattern here would be a wasted request,
   * and *not* copying it into the roster would be a lie on the screen.
   */
  const counts = useMemo(
    () => ({
      total: rows.length,
      invited: rows.filter((row) => row.status === 'invited').length,
      active: rows.filter((row) => row.status === 'active').length,
      // An account still running on a password its administrator knows. Worth
      // surfacing because it is the one access risk this module can see.
      mustChange: rows.filter((row) => row.mustChangePassword).length,
    }),
    [rows]
  );

  const handleInvite = async (payload) => {
    const result = await actions.invite(payload);

    if (!result.ok) return result;

    if (result.emailSent) {
      toast.success(`Invitation sent to ${payload.email}`);
    } else {
      // Not an error state — the account exists. But it is also not a success,
      // and reporting it as either is how a teacher ends up invited, not told.
      toast.warning(
        `${payload.name} was added, but the invitation email could not be sent. Re-send it from the list.`
      );
    }

    return result;
  };

  const handleResend = async (row) => {
    const result = await actions.resend(row._id);

    if (!result.ok) {
      toast.error(result.error?.message || 'Could not re-send that invitation.');
      return;
    }

    if (result.emailSent) {
      toast.success(`Invitation re-sent to ${row.email}. The previous password no longer works.`);
    } else {
      toast.warning('The invitation still could not be sent. Check the address and try again.');
    }
  };

  const handleRoleChange = async (row, role) => {
    if (role === row.role) return;
    const result = await actions.changeRole(row._id, role);
    if (result.ok) toast.success(`${row.name} is now a ${ROLE_LABEL[role] || role}.`);
    else toast.error(result.error?.message || 'Could not change that role.');
  };

  const handleRemove = async () => {
    const row = pendingRemoval;
    if (!row) return;

    const result = await actions.remove(row._id);
    setPendingRemoval(null);

    if (result.ok) toast.success(`${row.name} was removed from the team.`);
    else toast.error(result.error?.message || 'Could not remove that user.');
  };

  const isSelf = (row) => String(row._id) === String(user?._id);

  const tiles = [
    { label: 'Team members', value: counts.total, icon: Users, tone: 'text-ink' },
    { label: 'Active', value: counts.active, icon: CheckCircle2, tone: 'text-emerald-600' },
    { label: 'Awaiting sign-in', value: counts.invited, icon: Clock, tone: 'text-amber-600' },
    {
      label: 'Still on default password',
      value: counts.mustChange,
      icon: ShieldCheck,
      tone: 'text-brand-700',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        description="Approve people who asked to join, invite colleagues, manage what each person can do, and see who has actually signed in."
        actions={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Invite team member
          </button>
        }
      />

      {/*
        The approval queue, above the roster.

        It is the one thing on this page that is somebody else's *whole* problem:
        a teacher who typed a school code cannot do anything at all until an
        admin here presses Approve, so the request is placed where the admin
        already is rather than behind a second nav entry they would have to
        discover. `onChanged` re-reads the team list, which is what puts the
        freshly approved member into the table below without a page reload.
      */}
      <PendingApprovals onChanged={refresh} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} padding="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {tile.label}
                </p>
                <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${tile.tone}`}>
                  {loading ? '—' : tile.value}
                </p>
              </div>
              <tile.icon className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
            </div>
          </Card>
        ))}
      </div>

      <Card padding="p-0" className="overflow-hidden">
        {/* The filter bar. Search is client-side; role and status are the server's. */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or position…"
              aria-label="Search team members"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            />
          </div>

          <select
            value={filters.role}
            onChange={(event) => setFilter({ role: event.target.value })}
            aria-label="Filter by role"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          >
            <option value="">All roles</option>
            {USER_ROLES.filter((role) => role !== 'super_admin').map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role] || role}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) => setFilter({ status: event.target.value })}
            aria-label="Filter by status"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Awaiting sign-in</option>
            <option value="suspended">Suspended</option>
          </select>

          {(hasFilters || search) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter({ role: '', status: '' });
              }}
              className="rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
            {error.message}
          </div>
        )}

        {loading && (
          <div className="px-4 py-16 text-center text-sm font-semibold text-slate-500">
            Loading your team…
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="p-6">
            <EmptyState
              icon={UserCog}
              title="No team members yet"
              description="You are the only account on this school. Invite a bursar, a teacher or a headteacher to give them access."
              action={
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  Invite team member
                </button>
              }
            />
          </div>
        )}

        {!loading && !error && rows.length > 0 && visibleUsers.length === 0 && (
          <div className="px-4 py-16 text-center text-sm font-semibold text-slate-500">
            No team members match “{search}”.
          </div>
        )}

        {!loading && !error && visibleUsers.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Member
                  </th>
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Last active
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleUsers.map((row) => {
                  const status = STATUS_BADGE[row.status] || STATUS_BADGE.deactivated;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={row._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-extrabold text-white">
                            {initialsOf(row.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-[13px] font-extrabold text-ink">
                              {row.name}
                              {isSelf(row) && (
                                <span className="shrink-0 text-[10px] font-bold text-slate-400">You</span>
                              )}
                            </p>
                            <p className="truncate text-[12px] font-medium text-slate-500">
                              {row.email}
                              {row.position ? ` · ${row.position}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={row.role}
                          onChange={(event) => handleRoleChange(row, event.target.value)}
                          disabled={actions.isBusy(`role:${row._id}`) || isSelf(row)}
                          aria-label={`Role for ${row.name}`}
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-bold text-ink focus:border-brand-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {USER_ROLES.filter((role) => role !== 'super_admin').map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role] || role}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={status.tone} icon={StatusIcon}>
                            {status.label}
                          </Badge>
                          {/*
                            Two separate facts, both worth showing. The first is a
                            stale credential — the account works, but on a password
                            its administrator knows. The second is a mail that may
                            never have arrived, which is a *different* problem with
                            a different fix, so it gets its own line rather than
                            being folded into the status badge.
                          */}
                          {row.mustChangePassword && row.status === 'active' && (
                            <span className="text-[10px] font-bold text-brand-700">
                              Default password
                            </span>
                          )}
                          {row.status === 'invited' && !row.inviteEmailSentAt && (
                            <span className="text-[10px] font-bold text-red-600">
                              Email not delivered
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[12px] font-medium text-slate-500">
                        {relativeTime(row.lastLoginAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'invited' && (
                            <button
                              type="button"
                              onClick={() => handleResend(row)}
                              disabled={actions.isBusy(`resend:${row._id}`)}
                              title="Re-send the invitation and replace the password"
                              aria-label={`Re-send invitation to ${row.name}`}
                              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${actions.isBusy(`resend:${row._id}`) ? 'animate-spin' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          )}

                          {/*
                            Removal is hidden on your own row rather than shown
                            disabled: the server already refuses it, and a
                            permanently dead control in a live table is just
                            clutter.
                          */}
                          {!isSelf(row) && (
                            <button
                              type="button"
                              onClick={() => setPendingRemoval(row)}
                              aria-label={`Remove ${row.name}`}
                              title="Remove from team"
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <InviteTeamMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
        busy={actions.isBusy('invite')}
      />

      {/* Removal confirmation. Names the person, because "remove this user?" with
          an anonymous OK button is how the wrong row gets removed. */}
      {pendingRemoval && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
            onClick={() => setPendingRemoval(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm removal"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-ink">
                  Remove {pendingRemoval.name}?
                </h2>
                <p className="mt-1.5 text-[13px]/[19px] font-medium text-slate-600">
                  They will lose access immediately and cannot sign in again. Their history is
                  kept for the audit trail, but the email address stays reserved — so
                  re-inviting them needs a restore rather than a new invitation.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={actions.isBusy(`remove:${pendingRemoval._id}`)}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={actions.isBusy(`remove:${pendingRemoval._id}`)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {actions.isBusy(`remove:${pendingRemoval._id}`) ? 'Removing…' : 'Remove member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagement;