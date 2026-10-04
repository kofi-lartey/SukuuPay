import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The Recent Transactions mapping, against the payload `GET /payments` really sends.
 *
 * ## The crash
 *
 * `TypeError: name.split is not a function`, thrown from `initials()` in
 * `RecentTransactionsCard` while mapping the Overview's transaction rows, which took
 * the whole dashboard to a blank screen.
 *
 * The cause was a field-name disagreement between the client and the server:
 * `listPayments` populates `studentId`
 * (`.populate("studentId", "studentId studentName studentClass parents")`), so the
 * student's name arrives *nested* at `p.studentId.studentName` and there is no
 * top-level `p.studentName`. The mapping read `p.studentName || p.studentId`, fell
 * through to `p.studentId` — the **populated object** — and passed it to a function
 * expecting a string.
 *
 * ## Why no existing check caught it
 *
 * - `vite build` never executes a component body.
 * - The server-render harness renders a loading skeleton, because the throw happens in
 *   the `.then` *after* the response lands.
 * - The mock returns a **flat** `studentName`, so mock mode was green and production
 *   was not. Same shape of fault as the `/admin/school-ads` route mismatch.
 *
 * So the assertions below feed `toTransactionRow` the **real** populated shape and the
 * **mock's** flat shape, and require that everything the card renders is a string.
 * That is the property that was violated, and it is the property worth holding: a
 * display component should never receive something it has to defend itself against.
 */
import { toTransactionRow } from './transactionRow.js';

/** Exactly what `listPayments` returns when the student exists. */
const REAL_ROW = {
  paymentId: 'PAY-20260918-7KQ2M1',
  amount: 75000,
  reference: 'RCP-20260918-0007',
  momoNetwork: 'MTN',
  paymentMethod: 'momo',
  createdAt: '2026-09-18T09:14:00.000Z',
  studentId: {
    _id: '507f1f77bcf86cd799439011',
    studentId: 'PBS-2026-0001',
    studentName: 'Kwame Mensah',
    studentClass: 'JHS 2A',
    parents: [{ name: 'Akosua Mensah', phone: '0244123456' }],
  },
};

/** The mock's shape: flat, and with no nested student at all. */
const FLAT_ROW = {
  id: 'PAY-1',
  paymentId: 'PAY-1',
  amount: 30000,
  studentName: 'Ama Serwaa',
  studentCode: 'PBS-2026-0002',
  className: 'Basic 7',
  reference: 'RCP-2',
  momoNetwork: 'Telecel',
  createdAt: '2026-09-17T12:00:00.000Z',
};

describe('Recent Transactions: the student fields of a populated payment row', () => {
  const row = toTransactionRow(REAL_ROW);

  it('reads the name from the populated student, not from the row', () => {
    // The exact failure: `studentName` must never be the populated object.
    assert.equal(row.studentName, 'Kwame Mensah');
    assert.equal(typeof row.studentName, 'string');
  });

  it('would have crashed the card before this fix', () => {
    // Asserted rather than assumed, because "the old code was wrong" is the premise of
    // this whole file. If this ever stops throwing, the mapping changed shape and the
    // other assertions here are no longer describing the same bug.
    const oldMapping = REAL_ROW.studentName || REAL_ROW.studentId;
    assert.equal(typeof oldMapping, 'object');
    assert.throws(() => oldMapping.split(/\s+/), TypeError);
  });

  it('reads the human student id, which is not `studentId`', () => {
    // `studentId` is the populated object; the id a bursar quotes is
    // `studentId.studentId`. Reaching for the outer field was the original mistake.
    assert.equal(row.studentCode, 'PBS-2026-0001');
  });

  it('reads the class from the populated student', () => {
    // The Class column rendered empty against the real API for the same reason the
    // name crashed: nothing mapped `studentClass` at all.
    assert.equal(row.className, 'JHS 2A');
  });

  it('leaves the populated object reachable but not flattened', () => {
    // Passed through rather than re-shaped. Flattening it here would hide the real API
    // shape behind a second invented one, which is how the drift started.
    assert.equal(typeof row.studentRef, 'object');
    assert.equal(row.studentRef.studentName, 'Kwame Mensah');
  });

  it('gives every rendered field a string', () => {
    for (const field of ['studentName', 'studentCode', 'className', 'networkLabel', 'reference', 'dateLabel', 'timeLabel']) {
      assert.equal(typeof row[field], 'string', `${field} must be a string`);
    }
  });

  it('keys the row on paymentId, not on a field that does not exist', () => {
    assert.equal(row.id, 'PAY-20260918-7KQ2M1');
  });

  it('splits the network into a tone and a label', () => {
    assert.equal(row.network, 'mtn');
    assert.equal(row.networkLabel, 'MTN');
  });

  it('formats the timestamp', () => {
    assert.notEqual(row.dateLabel, '—');
    assert.notEqual(row.dateLabel, 'Invalid Date');
    assert.ok(row.timeLabel);
  });
});

describe('Recent Transactions: the shapes that are not the populated one', () => {
  it('accepts the flat shape the mock sends', () => {
    // Mock mode was green while production was not. Both shapes are real inputs, and
    // the mapping has to serve the one the server actually sends.
    const row = toTransactionRow(FLAT_ROW);
    assert.equal(row.studentName, 'Ama Serwaa');
    assert.equal(row.className, 'Basic 7');
  });

  it('handles a payment whose student was archived', () => {
    // `populate` yields a bare ObjectId string when the ref no longer resolves, so
    // this is an ordinary row — a payment for a child who has left — not an error.
    const row = toTransactionRow({ ...REAL_ROW, studentId: '507f1f77bcf86cd799439011' });
    assert.equal(typeof row.studentName, 'string');
    assert.equal(row.studentName, '507f1f77bcf86cd799439011');
  });

  it('handles a payment with no student ref at all', () => {
    const row = toTransactionRow({ ...REAL_ROW, studentId: null });
    assert.equal(row.studentName, 'Payment');
    assert.equal(row.studentCode, '');
    assert.equal(row.className, '');
  });

  it('falls back to the human id when the populated object has no name', () => {
    const row = toTransactionRow({
      ...REAL_ROW,
      studentId: { _id: 'x', studentId: 'PBS-2026-0009' },
    });
    assert.equal(row.studentName, 'PBS-2026-0009');
  });

  it('survives an empty row', () => {
    // Defensive: a row with nothing on it must still produce a renderable row, because
    // the alternative is the blank screen this whole file is about.
    const row = toTransactionRow(undefined);
    assert.equal(row.studentName, 'Payment');
    assert.equal(row.reference, '—');
    assert.equal(row.dateLabel, '—');
    assert.equal(row.timeLabel, '');
    assert.equal(typeof row.id, 'string');
  });

  it('survives an unparseable timestamp', () => {
    // `new Date('not a date').toLocaleDateString()` returns the string
    // "Invalid Date", which is worse than an em dash because it looks like data.
    const row = toTransactionRow({ ...REAL_ROW, createdAt: 'not a date' });
    assert.equal(row.dateLabel, '—');
    assert.equal(row.timeLabel, '');
  });

  it('keeps keys unique when paymentId is missing on every row', () => {
    // The fallback key must still differ per row, or React cannot reconcile and the
    // table re-renders wrongly rather than merely warning.
    const a = toTransactionRow({ reference: 'RCP-1' }, 0);
    const b = toTransactionRow({ reference: 'RCP-1' }, 1);
    assert.notEqual(a.id, b.id);
  });

  it('normalises the network tone to Badge-compatible values', () => {
    // `Badge` maps `mtn | telecel | at` to a dot colour and falls back to the current
    // text colour otherwise, so an unmapped value renders — it just renders wrong.
    const row = toTransactionRow({ ...REAL_ROW, momoNetwork: undefined });
    assert.equal(row.network, 'unknown');
    assert.equal(row.networkLabel, 'MOMO');
  });
});