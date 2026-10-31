import { ROUTES, TEACHER_ROUTES, STUDENT_ROUTES } from './constants.js';

/**
 * Where a freshly authenticated account goes.
 *
 * The bug this fixes: a teacher signing in landed on `/dashboard`, the school's
 * finance console. `Login.jsx` navigated to `?next`, or to `/dashboard` when
 * there was nothing to honour, and nobody asked the role — so the one role the
 * product ships a whole separate portal for (`/teacher`: register, marks,
 * timetable, sky-blue rail) was dropped into a school console whose rail is
 * mostly other people's jobs and whose first tap is often a 403.
 *
 * One rule, resolved in one place, so the two login paths cannot disagree. The
 * password handler and the Google handler previously picked their destination
 * differently (`redirectTo` vs `onboarding.nextRoute`), which is how a teacher
 * could end up in two different places depending on which button they pressed.
 *
 * ## The order, and why it is this order
 *
 *   1. **Unfinished onboarding wins over everything.** An account that still has
 *      to be approved into a school has no portal to land in: `/teacher` for a
 *      pending teacher would fire five requests against a school they have not
 *      been admitted to. The server has already named the screen, in
 *      `nextRoute`, so the answer is handed to us rather than recomputed.
 *   2. **An explicit deep link beats the role landing.** A teacher who followed
 *      a link to `/dashboard/students` — the one `/dashboard` module their role
 *      is not barred from — asked for that page. Redirecting them to `/teacher`
 *      instead would make a link somebody shared unusable.
 *      It does *not* beat rule 1: an expired onboarding link must not reactivate
 *      a wizard for somebody already approved.
 *   3. **Then the role landing**, `/teacher` for a teacher. This is the safety
 *      net: the server's `nextRoute` already says this (see `landingRouteFor` in
 *      the auth controller), so this exists mainly for the window before
 *      `/auth/me` has resolved and for a server that has not shipped yet.
 *   4. **Then `/dashboard`**, which is right for `school_admin`, `accountant`
 *      and `viewer`, and for everyone the role landing has no opinion about.
 *
 * This is a *routing* decision. It does not decide access: `OnboardingGuard`
 * still gates onboarding vs. the dashboard, `TeacherGuard` still admits `teacher`
 * and nothing else, and the server's `authorize` remains the boundary in both
 * cases.
 *
 * @param {object}  session
 * @param {object}  [session.onboarding]    the `onboarding` block from
 *                                          `/auth/login`, `/auth/me` or
 *                                          `/auth/google`
 * @param {string}  [session.role]           the signed-in account's role
 * @param {string}  [session.requested]     `?next=` or the `from` location state,
 *                                          i.e. where the browser was headed
 * @returns {string} a path usable by `navigate()`
 */
export const resolveLandingRoute = ({ onboarding, role, requested } = {}) => {
  const stillOnboarding =
    onboarding?.nextRoute?.startsWith(ROUTES.ONBOARDING) || onboarding?.completed === false;

  if (stillOnboarding) {
    return onboarding?.nextRoute || ROUTES.ONBOARDING;
  }

  const requestedPath = safeSameAppPath(requested);

  // A teacher following a link to the bare school-console root is not asking for
  // that console in any meaningful sense — there is nothing on `/dashboard`'s
  // index a teacher should see, only the RoleLanding redirect. Honouring it
  // therefore just bounces a teacher through (or, on a stale client, lands them
  // in) the management shell instead of their own portal. Treat the bare root
  // the same as "no deep link" for this role; deeper module links are still
  // honoured below.
  if (requestedPath && !(role === 'teacher' && requestedPath === ROUTES.DASHBOARD)) {
    return requestedPath;
  }

  if (role === 'teacher') return TEACHER_ROUTES.dashboard;
  if (role === 'student') return STUDENT_ROUTES.dashboard;

  return onboarding?.nextRoute || ROUTES.DASHBOARD;
};

/**
 * A `?next=` value is only usable if it points somewhere in this app.
 *
 * It arrives from a query string, which means it is attacker-controlled: without
 * this check, `/login?next=https://example.test` would turn our login form into
 * a credible-looking redirect off-site, and `//example.test` — a protocol-relative
 * URL that a browser reads as absolute — would do it without the scheme. Both are
 * rejected, and so is a path back into `/onboarding`, which would replay a wizard
 * step at somebody who is already finished with it.
 *
 * Returns the path unchanged, or null when it must be ignored — the caller then
 * falls through to the role landing rather than to a wrong-but-harmless default.
 */
const safeSameAppPath = (value) => {
  const path = String(value || '').trim();
  if (!path.startsWith('/')) return null;
  // Protocol-relative (`//host`) or a full URL (`https://…`): not ours.
  if (path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  if (path === ROUTES.LOGIN) return null;
  if (path.startsWith(ROUTES.ONBOARDING)) return null;
  return path;
};

export default { resolveLandingRoute };
