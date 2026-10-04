/**
 * One `GET /payments` row → the shape the Overview's transactions table renders.
 *
 * A pure projection with no imports, in its own module, because that is the only way
 * it can be tested against the real payload. It used to live inline in
 * `useDashboardOverview`, where it could not be: `node --test` cannot resolve the
 * extensionless imports a hook carries (`'../data/dashboardEmpty'`), so the one piece
 * of the Overview that had actually crashed went untested while `vite build` and the
 * server-render harness both reported green.
 *
 * ## Why the student fields are read from `p.studentId.studentName`
 *
 * `listPayments` populates:
 * `.populate("studentId", "studentId studentName studentClass parents")`
 * (`Backend/src/services/payment.service.js`). So a real row arrives as:
 *
 * ```js
 * { paymentId: 'PAY-20260918-7KQ2M1', amount: 75000, reference: 'RCP-20260918-0007',
 *   momoNetwork: 'MTN', createdAt: '2026-09-18T09:14:00.000Z',
 *   studentId: { _id: '507f…', studentId: 'PBS-2026-0001',
 *                studentName: 'Kwame Mensah', studentClass: 'JHS 2A',
 *                parents: [...] } }
 * ```
 *
 * There is **no top-level `studentName`**. The original mapping read
 * `p.studentName || p.studentId`, so for every payment whose student populated it
 * took the *object*, `initials()` in `RecentTransactionsCard` called `.split()` on it,
 * and the entire Overview went to a blank screen with
 * `TypeError: name.split is not a function`.
 *
 * It never reproduced in development because `mocks/handlers.js` returns a **flat**
 * `studentName`. Client and server disagreed about a field name — the same shape of
 * fault as the `/admin/school-ads` route mismatch, where mock mode was green and
 * production 404'd.
 *
 * Both shapes are accepted rather than one. A student who is archived or deleted makes
 * the populate yield a bare ObjectId **string** instead of an object, so a payment for
 * a child who has left the school is an ordinary row, not an error. The flat shape is
 * what the mock, and any already-flattened caller, sends.
 *
 * ## The guarantee
 *
 * Every field the card renders is a string. That is the contract: a display component
 * should never receive something it has to defend itself against, and this is the
 * boundary where that promise is kept.
 */

/**
 * @param {object} p one row from `listRecentPayments`
 * @param {number} index position in the page — used only to keep the React key unique
 * @returns {object} a row where every rendered field is a string
 */
export const toTransactionRow = (p = {}, index = 0) => {
  const row = p && typeof p === 'object' ? p : {};

  const student = row.studentId && typeof row.studentId === 'object' ? row.studentId : null;

  // Ordered by how much the reader loses without it: a real name, then the human
  // student id, then the raw id, then an explicit "we do not know".
  const studentName =
    student?.studentName ||
    (typeof row.studentName === 'string' ? row.studentName : null) ||
    (typeof student?.studentId === 'string' ? student.studentId : null) ||
    (typeof row.studentId === 'string' ? row.studentId : null) ||
    'Payment';

  // The id a bursar quotes is `studentId.studentId`. The outer `studentId` is the
  // populated object — reaching for it is what produced the crash.
  const studentCode =
    student?.studentId || (typeof row.studentCode === 'string' ? row.studentCode : null) || '';

  const className =
    student?.studentClass ||
    (typeof row.className === 'string' ? row.className : null) ||
    '';

  const at = row.createdAt ? new Date(row.createdAt) : null;
  const hasDate = Boolean(at) && !Number.isNaN(at.getTime());

  return {
    ...row,
    // A real key. `p.id` does not exist on a Payment — the field is `paymentId` — so
    // the table was keyed on `undefined` for every row, which React warns about and
    // which breaks reconciliation when the list re-sorts.
    id: row.paymentId || row._id || `${row.reference || 'row'}-${row.createdAt || index}`,
    studentName: String(studentName),
    studentCode: String(studentCode),
    className: String(className),
    // The populated object is passed through untouched rather than re-shaped. The card
    // does not read it, and flattening it here would hide the real API shape behind a
    // second invented one — which is how the drift started in the first place.
    studentRef: row.studentId ?? null,
    // `Badge` maps `mtn | telecel | at` onto a dot colour and falls back to the current
    // text colour otherwise — so an unmapped value still renders, just wrong.
    network: String(row.momoNetwork || 'UNKNOWN').toLowerCase().slice(0, 8),
    networkLabel: row.momoNetwork || row.paymentMethod?.toUpperCase() || 'Manual',
    reference: row.reference || row.mtnReferenceId || row.paymentId || '—',
    // `toLocaleDateString(new Date(undefined))` yields the string "Invalid Date", so a
    // missing or unparseable timestamp is checked rather than formatted.
    dateLabel: hasDate
      ? at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : '—',
    timeLabel: hasDate
      ? at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '',
  };
};

export default toTransactionRow;