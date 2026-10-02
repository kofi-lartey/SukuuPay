/**
 * The paths the audit module owns.
 *
 * **`ROUTES` has no `AUDIT_LOG_DETAIL` key**, and it cannot get one from this module:
 * `utils/constants.js` is not mine to edit, and the conventions file says explicitly that
 * a path with no `ROUTES` key should be defined once and reported. So the two nested paths
 * live here, written longhand off `ROUTES.ADMIN_AUDIT_LOGS` — the same reason
 * `ADMIN_ROUTES` writes every nested path out instead of concatenating at each call site
 * (a derived path cannot be checked against the router, and a link to a route that was
 * never registered renders perfectly).
 *
 * **Reported to the coordinator as a gap:** `ADMIN_ROUTES` should gain
 * `AUDIT_LOG_DETAIL` and `IMPERSONATION_AUDIT` so the impersonation link below resolves
 * against the same source as every other path in the console. Until it does, this file is
 * the single place those two segments exist, and both are built from `ROUTES` so a change
 * to the console's mount point moves them with it.
 */
import { ROUTES } from '../../../utils/constants';

/** `/admin/audit-logs/:id` — one entry in full. */
export const AUDIT_LOG_DETAIL = `${ROUTES.ADMIN_AUDIT_LOGS}/:id`;

/** `/admin/audit-logs/impersonation/:sessionId` — everything done inside one session. */
export const IMPERSONATION_AUDIT = `${ROUTES.ADMIN_AUDIT_LOGS}/impersonation/:sessionId`;

/** The concrete URL for one audit entry. */
export const auditLogDetailPath = (id) => `${ROUTES.ADMIN_AUDIT_LOGS}/${id}`;

/** The concrete URL for one impersonation session. */
export const impersonationAuditPath = (sessionId) =>
  `${ROUTES.ADMIN_AUDIT_LOGS}/impersonation/${sessionId}`;
