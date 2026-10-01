import React, { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Search } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Field, FormAlert, SelectField } from '../common/FormField';
import MoneyInput from '../common/MoneyInput';
import useToast from '../../hooks/useToast';
import { recordManualPayment } from '../../services/payments';
import { listStudents } from '../../services/students';
import { formatCedi } from '../../utils/format';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

const DEBOUNCE_MS = 300;

/**
 * Record a payment taken at the bursar's desk.
 *
 * **The student is looked up, not typed.** A bursar has a paper register and a
 * student number, and a free-text field would invite a typo that records GH₵ 850
 * against the wrong child — which is worse than no feature, because the money is
 * real and the record is now wrong. The search is debounced and matches on name
 * or number, and the chosen student is shown with their outstanding balance
 * *before* the amount is entered, so the two can be checked against each other.
 *
 * **The amount is capped by the balance**, and the cap is shown before the save
 * rather than enforced by a server error afterwards. Overpayment needs the
 * explicit "record as a credit" tick, because a negative balance silently
 * changes the meaning of every "owes money" figure in the product.
 *
 * The server settles the student in the same transaction as the payment row and
 * returns the new `totalPaid` and `balance`, so the dialog reports the real
 * result instead of a guess.
 */
const RecordManualPaymentDialog = ({ open, onClose, onRecorded }) => {
  const { success, error: errorToast } = useToast();

  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState(null);

  const [amount, setAmount] = useState(null);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [allowOverpayment, setAllowOverpayment] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const reset = () => {
    setTerm('');
    setResults([]);
    setStudent(null);
    setAmount(null);
    setMethod('cash');
    setReference('');
    setNotes('');
    setAllowOverpayment(false);
    setFormError(null);
  };

  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced lookup, and only when there is something to look up.
  useEffect(() => {
    if (!open || !student) return undefined;
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      listStudents({ status: 'all', search: q, perPage: 8 })
        .then((r) => setResults(r.rows))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term, open, student]);

  const balance = student?.balance || 0;
  const overpaying = amount !== null && amount > balance;

  const blockingReason = useMemo(() => {
    if (!student) return 'Choose a student first';
    if (amount === null) return 'Enter the amount received';
    if (overpaying && !allowOverpayment) return 'That is more than the outstanding balance';
    return null;
  }, [student, amount, overpaying, allowOverpayment]);

  const submit = async () => {
    if (blockingReason) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await recordManualPayment({
        studentRef: student.studentId,
        amount,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
        allowOverpayment: allowOverpayment || undefined,
      });
      success(
        `Recorded ${formatCedi(amount)} from ${student.studentName}. Balance is now ${formatCedi(
          result?.student?.balance ?? Math.max(0, balance - amount)
        )}.`
      );
      onRecorded?.();
      onClose();
    } catch (error) {
      setFormError(error.message);
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a manual payment"
      description="Cash, a cheque, or a transfer into the school's account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={Boolean(blockingReason) || saving}>
            {saving ? 'Recording…' : 'Record payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <FormAlert>{formError}</FormAlert>}

        {student ? (
          <>
            <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">{student.studentName}</p>
                {/* `truncate` is load-bearing, and the line above already had it.
                    A real student code is `SCH-<SLUG>-<CLASS>-<YEAR>-<N>`, which
                    is 20+ characters, and it sits beside a `shrink-0` balance
                    column in a `min-w-0` box. Without the truncation this line
                    wraps to two or three rows on a 320px screen and drags the
                    balance down with it, so the two figures stop being
                    comparable at a glance — which is the one thing this card
                    exists to do. */}
                <p className="truncate text-[12px] font-semibold text-slate-500">
                  {student.studentId} · {student.studentClass}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  Outstanding
                </p>
                <p
                  className={`text-base font-extrabold tabular-nums ${
                    balance > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCedi(balance)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setStudent(null);
                setResults([]);
              }}
              className="text-[12px] font-extrabold text-brand-700 hover:underline"
            >
              Choose a different student
            </button>
          </>
        ) : (
          <Field
            label="Find the student"
            hint="by name or student number"
            placeholder="e.g. Ama Mensah, or SCH-DEMO-01-2026-8054"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            autoFocus
          />
        )}

        {!student && term.trim().length >= 2 && (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            {searching && <p className="px-4 py-3 text-[13px] font-semibold text-slate-400">Searching…</p>}
            {!searching && !results.length && (
              <p className="px-4 py-3 text-[13px] font-semibold text-slate-400">
                No student matches “{term.trim()}”.
              </p>
            )}
            <ul>
              {results.map((s) => (
                <li key={s._id || s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setStudent(s);
                      setResults([]);
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-extrabold text-ink">
                        {s.studentName}
                      </span>
                      {/* Same truncation contract as the summary card above.
                          This one matters more: there are up to eight results
                          stacked, so one wrapping code makes the whole list
                          ragged and the balances stop lining up. */}
                      <span className="block truncate text-[11px] font-semibold text-slate-500">
                        {s.studentId} · {s.studentClass}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-[12px] font-extrabold tabular-nums ${
                        s.balance > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatCedi(s.balance || 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {student && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MoneyInput
                label="Amount received"
                hint="cedis"
                required
                value={amount}
                error={overpaying && !allowOverpayment ? 'More than the outstanding balance' : undefined}
                onChange={setAmount}
                disabled={balance === 0}
              />
              <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectField>
            </div>

            {balance === 0 && (
              <FormAlert tone="info">
                This student has nothing outstanding. Tick the credit box below to record a
                payment anyway — it will be recorded as a credit against the balance.
              </FormAlert>
            )}

            <Field
              label={method === 'bank_transfer' ? 'Bank reference' : 'Reference'}
              hint="optional — cheque or transfer number"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. CHQ-000123"
            />

            <Field
              label="Note"
              hint="optional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Lodged at the bursary by the father"
            />

            {overpaying && (
              <label className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={allowOverpayment}
                  onChange={(event) => setAllowOverpayment(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Record {formatCedi(amount - balance)} more than the outstanding balance as a
                  credit. A negative balance changes what every "owes money" figure in the
                  product means, so it is an explicit choice.
                </span>
              </label>
            )}

            {amount !== null && !overpaying && (
              <p className="text-[13px] font-semibold text-slate-600">
                {student.studentName}'s balance goes from {formatCedi(balance)} to{' '}
                <span className="font-extrabold text-brand-700">
                  {formatCedi(balance - amount)}
                </span>
                .
              </p>
            )}
          </>
        )}

        {blockingReason && !student && (
          <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {blockingReason}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default RecordManualPaymentDialog;
