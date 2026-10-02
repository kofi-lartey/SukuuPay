import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Receipt,
  ShieldCheck,
  UserCog,
  UserX,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import Tile from '../../../components/dashboard/ui/Tile';
import UserRoleDialog from '../../../components/admin/UserRoleDialog';
import UserStatusDialog from '../../../components/admin/UserStatusDialog';
import ResetUserPasswordDialog from '../../../components/admin/ResetUserPasswordDialog';
import ResendVerificationDialog from '../../../components/admin/ResendVerificationDialog';
import { useToast } from '../../../hooks/useToast';
import {
  getUser,
  getUserAuditTrail,
  resendVerification,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
} from '../../../services/admin';
import { ROUTES, roleLabel } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';
import { formatGhanaPhone } from '../../../utils/ghanaPhone';
import { formatDateTime, formatRelative } from '../../../utils/dates';

/**
 * One account on the platform, in full.
 *
 * Backed by `GET /admin/users/:id` — `getAdminUserDetail` in
 * `Backend/src/services/admin/users.service.js:215` — which returns
 * `{ user, school, lastLoginAt, paymentsCreated, recentAudit }` rather than the bare
 * user the school console's `GET /users/me` returns. That extra wrapping is what
 * makes this screen possible without three extra requests: the school summary
 * (name, region, status, code, subscription status) is already in the payload, and
 * the counts are already aggregated server-side.
 *
 * **The audit trail comes from `getUserAuditTrail(userId)`, not from
 * `recentAudit`.** They are different reads and the difference is the point:
 * `recentAudit` is the same document's own ten entries, filtered to
 * `entity: 'User'` because the id space is shared across entities and a colliding
 * Student id would otherwise pull in another record's history. The trail endpoint
 * returns everything this account did, to anything, paginated — which is what an
 * operator opening "what has this account been doing" actually needs, and it is why
 * this screen shows two different things: the trail is the substance, and
 * `recentAudit` is not rendered at all rather than rendered twice.
 *
 * **The role selector is `UserRoleDialog`'s `SelectField`, not a second control
 * on this page.** It is driven by `ASSIGNABLE_ROLES` — the grantable set from
 * `Backend/src/validators/userValidators.js`, which deliberately excludes
 * `super_admin`. That is the server's rule and not a UI preference: there is exactly
 * one platform owner, provisioned from the environment by
 * `Backend/src/boot/ensureSuperAdmin.js`, `users.service.js:282` refuses
 * `super_admin` as an input before it looks at anything else, and
 * `Backend/tests/platformOwner.test.js` enforces it. Putting the picker here as
 * well would be a second list that could offer a fifth option the API rejects — and
 * it would 422 *after* the operator had filled in the rest of the form, which is
 * the specific failure `ASSIGNABLE_ROLES` exists to prevent. So this page shows the
 * role it currently holds and one button, and the one dialog behind that button is
 * the same one `UsersList`'s row action opens.
 *
 * **The brief's "change any user's role" is not available and cannot be made
 * available.** The owner's account cannot be re-roled, suspended or deactivated
 * through *any* endpoint — `refusePlatformOwner` (`users.service.js:110`) is a
 * property of the target, not of the caller, so even the owner is refused. Failing
 * that would leave a deployment with nobody able to administer it, and
 * `ensureSuperAdmin` refuses to start without one. So for a protected account this
 * page renders a caption instead of the four action buttons. Not disabled ones: a
 * disabled button says "you lack permission", and this is not that.
 *
 * **Every mutation returns `{ ok, error }`** so a refusal leaves its dialog open with
 * the operator's input intact.
 */

/** Same rule as `refusePlatformOwner`: the flag first, the role as the backstop. */
const isProtected = (user) => user?.isPlatformOwner === true || user?.role === 'super_admin';

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

/** A label/value row. `mono` is for references, read aloud character by character. */
const Row = ({ label, value, mono = false }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-2 last:border-b-0">
    <dt className="shrink-0 text-[11px] font-semibold text-slate-500">{label}</dt>
    <dd
      className={`min-w-0 break-words text-right text-[13px] font-bold text-ink ${
        mono ? 'font-mono text-[12px]' : ''
      }`}
    >
      {value || '—'}
    </dd>
  </div>
);

/** A labelled action button. Text plus icon — these four are read, not scanned. */
const ActionButton = ({ icon: Icon, children, ...props }) => (
  <button
    type="button"
    {...props}
    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
  >
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    {children}
  </button>
);

const UserDetail = () => {
  const { userId } = useParams();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [trailPage, setTrailPage] = useState(1);
  const [trailPerPage, setTrailPerPage] = useState(20);

  const [roleOpen, setRoleOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);

  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  const [trail, setTrail] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getUser(userId)
      .then((result) => active && setState({ data: result, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    setTrail((current) => ({ ...current, loading: true, error: null }));
    getUserAuditTrail(userId, { page: trailPage, perPage: trailPerPage })
      .then((result) => active && setTrail({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => active && setTrail({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [userId, trailPage, trailPerPage]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /* ── Mutations ── */
  const confirmRoleChange = useCallback(
    async (role) => {
      try {
        await updateUserRole(userId, role);
        toast.success(
          `${state.data?.user?.name || 'This account'} is now ${roleLabel(role).toLowerCase()}.`
        );
        setRoleOpen(false);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That role could not be changed.' };
      }
    },
    [userId, state.data, refresh, toast]
  );

  const confirmStatusChange = useCallback(
    async (status) => {
      try {
        await updateUserStatus(userId, status);
        toast.success(
          status === 'active'
            ? `${state.data?.user?.name || 'This account'} can sign in again.`
            : `${state.data?.user?.name || 'This account'} is now ${
                STATUS_LABELS[status]?.toLowerCase() || status
              }.`
        );
        setStatusOpen(false);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That account status could not be changed.' };
      }
    },
    [userId, state.data, refresh, toast]
  );

  const confirmPasswordReset = useCallback(async () => {
    try {
      const data = await resetUserPassword(userId);
      refresh();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message || 'A password reset could not be sent.' };
    }
  }, [userId, refresh]);

  const confirmResendVerification = useCallback(async () => {
    try {
      const data = await resendVerification(userId);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message || 'The verification email could not be sent.' };
    }
  }, [userId]);

  const user = state.data?.user || null;
  const school = state.data?.school || null;
  const protectedAccount = isProtected(user);

  const lastLoginAt = state.data?.lastLoginAt ?? user?.lastLoginAt ?? null;
  const paymentsCreated = state.data?.paymentsCreated ?? 0;

  const verified = useMemo(() => user?.isEmailVerified === true, [user]);

  if (!userId) {
    return (
      <EmptyState
        icon={UserCog}
        title="No account was named"
        description="This page needs an account id in the URL."
      />
    );
  }

  if (state.error) {
    return (
      <EmptyState
        icon={UserCog}
        title="This account could not be loaded"
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
    );
  }

  return (
    <>
      {/*
        The back link goes to the list with its filters intact rather than to a
        fixed `/admin/users`. An operator who arrived here from a filtered list and
        presses Back expects to land back on that list; stripping the query string
        dumps them on the unfiltered platform and loses their place.
      */}
      <Link
        to={ROUTES.ADMIN_USERS}
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All accounts
      </Link>

      <PageHeader
        eyebrow="Platform console"
        title={user?.name || 'Account'}
        description={
          user
            ? `${roleLabel(user.role)} · ${user.email || 'no email on file'}${
                school?.name ? ` · ${school.name}` : ' · no school (platform staff)'
              }`
            : 'Loading this account…'
        }
      />

      {/*
        The action bar. Hidden entirely for a protected account, with the reason in
        its place — see the header for why "disabled" would be the wrong word.
      */}
      <Card padding="p-4" className="mb-4">
        {protectedAccount ? (
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-[12px] font-semibold leading-relaxed text-slate-600">
              This is the platform owner account. It is provisioned from the server environment and
              cannot be re-roled, suspended, deactivated or have its password reset through any API
              — doing so would leave the deployment with nobody able to administer it. The only thing
              that changes it is a redeploy with different environment variables.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton icon={UserCog} onClick={() => setRoleOpen(true)}>
              Change role
            </ActionButton>
            <ActionButton icon={UserX} onClick={() => setStatusOpen(true)}>
              Change status
            </ActionButton>
            <ActionButton icon={KeyRound} onClick={() => setPasswordOpen(true)}>
              Reset password
            </ActionButton>
            <ActionButton icon={Mail} onClick={() => setVerificationOpen(true)}>
              Resend verification
            </ActionButton>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {state.loading && !user ? (
            <div className="space-y-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <>
              <Card>
                <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Account
                </h2>
                <dl>
                  <Row label="Name" value={user?.name} />
                  <Row label="Email" value={user?.email} />
                  <Row
                    label="Email verified"
                    value={user?.isEmailVerified ? 'Yes' : 'No — a code is still required to sign in'}
                  />
                  <Row label="Verified on" value={user?.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : ''} />
                  <Row label="Phone" value={user?.phone ? formatGhanaPhone(user.phone) : ''} />
                  <Row label="Position" value={user?.position} />
                  <Row label="Role" value={roleLabel(user?.role)} />
                  <Row label="Status" value={STATUS_LABELS[user?.status] || user?.status} />
                  <Row
                    label="Must change password"
                    value={
                      user?.mustChangePassword
                        ? 'Yes — still on the password SukuuPay issued'
                        : 'No'
                    }
                  />
                  <Row label="Account created" value={user?.createdAt ? formatDateTime(user.createdAt) : ''} />
                  <Row label="Account id" value={user?._id} mono />
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={ROLE_TONES[user?.role] || 'slate'}>{roleLabel(user?.role)}</Badge>
                  <Badge tone={STATUS_TONES[user?.status] || 'slate'} dot>
                    {STATUS_LABELS[user?.status] || user?.status || 'unknown'}
                  </Badge>
                  {protectedAccount && (
                    <Badge tone="ink" icon={ShieldCheck}>
                      Platform owner
                    </Badge>
                  )}
                  {user?.mustChangePassword === true && (
                    <Badge tone="amber" icon={KeyRound}>
                      Password never changed
                    </Badge>
                  )}
                  {!verified && !protectedAccount && (
                    <Badge tone="amber" icon={Mail}>
                      Email unverified
                    </Badge>
                  )}
                </div>
              </Card>

              {/*
                The trail, from `getUserAuditTrail` — everything this account did, to
                anything, not only to itself. A role change written by somebody else
                and a payment recorded by this user are both in here, and both are
                what an operator asking "what has this account been doing" means.

                `entity` is rendered because the id space is shared across entities:
                a row whose `entity` is `School` is a *different* record that happens
                to be referenced here, and showing the action without it would read
                as a user edit.
              */}
              <Card padding="p-0" className="overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Activity
                  </h2>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    Everything this account has done, newest first.
                  </p>
                </div>

                {trail.error ? (
                  <div className="px-5 py-5">
                    <p className="text-[13px] font-bold text-red-700">{trail.error.message}</p>
                  </div>
                ) : trail.loading && trail.rows.length === 0 ? (
                  <div className="space-y-2 px-5 py-5">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                  </div>
                ) : trail.rows.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-[13px] font-bold text-slate-600">Nothing recorded yet</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-400">
                      No action has been written to the audit log against this account.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] border-collapse text-left">
                      <caption className="sr-only">Audit trail for this account</caption>
                      <thead>
                        <tr className="bg-slate-50/60">
                          {['When', 'Action', 'Entity', 'Actor'].map((label) => (
                            <th
                              key={label}
                              scope="col"
                              className="px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {trail.rows.map((entry, index) => (
                          <tr
                            key={entry._id || `${entry.action}-${index}`}
                            className="border-t border-slate-50 last:border-0"
                          >
                            <td className="whitespace-nowrap px-5 py-3">
                              <span className="block text-[12px] font-bold text-slate-600">
                                {formatRelative(entry.createdAt)}
                              </span>
                              <span className="block text-[11px] font-semibold text-slate-400">
                                {formatDateTime(entry.createdAt)}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-mono text-[12px] font-bold text-ink">
                              {entry.action}
                            </td>
                            <td className="px-5 py-3 text-[12px] font-semibold text-slate-600">
                              {entry.entity}
                              {entry.entityId ? (
                                <span className="block font-mono text-[11px] text-slate-400">
                                  {String(entry.entityId)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-5 py-3 font-mono text-[11px] font-semibold text-slate-500">
                              {entry.userId ? String(entry.userId) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Pagination
                  meta={trail.meta}
                  itemLabel="entries"
                  onPageChange={(page) => setTrailPage(page)}
                  onPerPageChange={(perPage) => {
                    setTrailPerPage(perPage);
                    setTrailPage(1);
                  }}
                />
              </Card>
            </>
          )}
        </div>

        <div className="space-y-4">
          {/*
            The money-shaped tile, kept because "how much has this login moved" is
            the question that decides whether a role is right. It is
            `Payment.createdBy` — a count of rows this account *recorded* — not a
            total it collected, and it says so: a parent's payment has no creator
            and is counted against a student instead.
          */}
          <Tile
            label="Payments recorded by this account"
            icon={Receipt}
            value={formatCount(paymentsCreated)}
            accent
            footer={
              <p className="text-[11px] font-semibold text-slate-500">
                Rows this login created. A parent&apos;s own payment is counted against a student, not
                against whoever signed them in.
              </p>
            }
          />

          <Card>
            <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Last login
            </h2>
            {lastLoginAt ? (
              <>
                <p className="text-[13px] font-extrabold text-ink">{formatRelative(lastLoginAt)}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                  {formatDateTime(lastLoginAt)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-extrabold text-slate-400">Never signed in</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                  The account exists but nobody has completed a sign-in with it.
                </p>
              </>
            )}
          </Card>

          {/*
            The school, or the absence of one.

            A platform-staff account has `schoolId: null` **by design** — a dozen
            services branch on `req.user.schoolId ? … : platform-wide` — so "no
            school" here is not missing data and not an error. Rendering an empty
            school card would read as a bug; this states the convention instead.
          */}
          <Card>
            <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              School
            </h2>
            {school ? (
              <>
                <p className="text-[13px] font-extrabold text-ink">{school.name}</p>
                <dl className="mt-1">
                  <Row label="Code" value={school.schoolCode} mono />
                  <Row label="Region" value={school.region} />
                  <Row label="School status" value={school.status} />
                  <Row label="Subscription" value={school.subscriptionStatus} />
                </dl>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-slate-500">
                This account belongs to no school. That is how platform staff are represented — a
                null `schoolId` is what makes a dozen services treat their queries as platform-wide
                rather than per-school.
              </p>
            )}
          </Card>

          {/*
            The invitation record. `inviteCount` and `invitedAt` are on the model's
            safe projection (`users.service.js:60`), and they answer "how many times
            has somebody had to re-invite this person" — which is a different
            question from "how many times were they invited" and the only one that
            says anything about a mailbox that is not receiving mail.
          */}
          {(user?.inviteCount || user?.invitedAt) && (
            <Card>
              <h2 className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Invitations
              </h2>
              <dl>
                <Row label="Times invited" value={formatCount(user.inviteCount)} />
                <Row
                  label="First invitation"
                  value={user.invitedAt ? formatDateTime(user.invitedAt) : ''}
                />
                <Row
                  label="Invitation email sent"
                  value={user.inviteEmailSentAt ? formatDateTime(user.inviteEmailSentAt) : ''}
                />
              </dl>
            </Card>
          )}
        </div>
      </div>

      {/* ── The four dialogs, all `onConfirm → { ok, error }` ── */}
      <UserRoleDialog
        open={roleOpen}
        user={user}
        isProtected={protectedAccount}
        onClose={() => setRoleOpen(false)}
        onConfirm={confirmRoleChange}
      />

      <UserStatusDialog
        open={statusOpen}
        user={user}
        isProtected={protectedAccount}
        onClose={() => setStatusOpen(false)}
        onConfirm={confirmStatusChange}
      />

      <ResetUserPasswordDialog
        open={passwordOpen}
        user={user}
        isProtected={protectedAccount}
        onClose={() => setPasswordOpen(false)}
        onConfirm={confirmPasswordReset}
      />

      <ResendVerificationDialog
        open={verificationOpen}
        user={user}
        onClose={() => setVerificationOpen(false)}
        onConfirm={confirmResendVerification}
      />
    </>
  );
};

export { isProtected as isPlatformOwnerAccount };
export default UserDetail;