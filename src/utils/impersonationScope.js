import { ROUTES } from './constants.js';

/**
 * Where the operator is standing, relative to the school they are impersonating.
 *
 * **This classification is the whole safety mechanism, and it is here — in a plain
 * module with no React in it — rather than inside the banner, because it is logic
 * and it is testable logic.** It was previously a function inside
 * `components/admin/ImpersonationBanner.jsx`, where the only way to test it was to
 * render the component, and the only way to run a test at all would have been to add
 * a test runner the frontend does not have. `impersonationScope.test.js` runs on
 * `node --test`, the same runner the backend uses.
 *
 * ### Why three states and not two
 *
 * The console used to **refuse** platform-wide navigation during a support session,
 * and `AdminSidebar` hid the matching rail entries. Both were wrong for one reason:
 * the server deliberately *serves* those reads and records each one against
 * `ImpersonationSession.actionsCount` (`middleware/impersonation.js`). A
 * client-side restriction was therefore never a security boundary — it contradicted
 * the layer that decides, and the boundary existed in only one of the two places it
 * had to.
 *
 * It also cost real friction: ending and restarting a session burns one of ten hourly
 * impersonation starts, so somebody checking a number mid-support-call paid for it.
 *
 * So navigation is allowed, and the banner says what is true. That needs three
 * states, not two, because removing the block made two genuinely different
 * non-"this school" pages reachable:
 *
 *   - `school`   — the impersonated school's own pages. The reason for the session
 *                  is the useful thing to repeat.
 *   - `other`    — a **different** school's pages. Legitimate — a super admin may
 *                  view any school — but the risk is attributing one tenant's records
 *                  to another, so this must never read as "Platform data", and a page
 *                  showing a school's students always has to say *whose*.
 *   - `platform` — genuinely platform-wide screens. The platform label is only used
 *                  where it is true.
 */

/** A 24-character hex string: the shape every ObjectId in this app has. */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Is this path the impersonated school's own pages?
 *
 * A prefix match on the school's id, so every tab of the school detail counts
 * without enumerating them — and so a tab added later is classified correctly rather
 * than being mislabelled as somebody else's data.
 *
 * @param {string|null} schoolId  the impersonated school
 * @param {string} pathname       the current route
 * @returns {boolean}
 */
export const isSchoolPage = (schoolId, pathname) => {
  if (!schoolId) return false;

  const scope = `${ROUTES.ADMIN_SCHOOLS}/${schoolId}`;

  return pathname === scope || pathname.startsWith(`${scope}/`);
};

/**
 * Which of the three places the operator is standing.
 *
 * @param {string|null} schoolId  the impersonated school
 * @param {string} pathname       the current route
 * @returns {'school'|'other'|'platform'}
 */
export const impersonationScope = (schoolId, pathname) => {
  if (isSchoolPage(schoolId, pathname)) return 'school';

  /*
   * `other` requires the path to be `<ADMIN_SCHOOLS>/<24-hex-id>`. Two conditions,
   * and both are load-bearing — each was a real misclassification, found by running
   * the cases in `impersonationScope.test.js` rather than by reading this code:
   *
   *   1. **The segment must have the id shape.** A bare `startsWith('/admin/schools/')`
   *      also matches `/admin/schools/new` — a literal route segment sitting exactly
   *      where an id sits — and a stray `/admin/schools/<id>extra` typo. Both would
   *      have been labelled "Another school", naming a tenant that does not exist on
   *      a screen that is creating a new one.
   *
   *   2. **The prefix must actually be the schools path.** Splitting the path and
   *      reading a fixed index also matches `/admin/impersonation/<24-hex session id>`,
   *      because that route has the same shape and its ids are ObjectIds too — so the
   *      impersonation history rendered as "Another school".
   *
   * The prefix is derived from `ROUTES.ADMIN_SCHOOLS` rather than typed out, so moving
   * the route does not silently break the classifier, and matching on segment counts
   * rather than one string means a literal route needs no denylist entry.
   */
  const prefix = ROUTES.ADMIN_SCHOOLS.split('/').filter(Boolean);
  const segments = String(pathname || '').split('/').filter(Boolean);

  const isSchoolsPath =
    segments.length > prefix.length &&
    prefix.every((part, index) => segments[index] === part);

  if (isSchoolsPath && OBJECT_ID.test(segments[prefix.length] || '')) {
    return 'other';
  }

  return 'platform';
};

export default impersonationScope;