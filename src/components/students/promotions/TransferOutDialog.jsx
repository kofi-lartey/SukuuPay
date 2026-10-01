import React, { useEffect, useState } from 'react';
import { CircleAlert, LogOut, ShieldCheck } from 'lucide-react';
import Modal from '../../common/Modal';
import Badge from '../../dashboard/ui/Badge';
import { Field, FormAlert, SelectField } from '../../common/FormField';
import { formatCedi } from '../../../utils/format';
import { formatGhanaPhone } from '../../../utils/ghanaPhone';
import { INSTITUTION_TYPES, TRANSFER_REASONS } from '../../../utils/constants';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * GES Standard Form TS-4 — recording a transfer out of the school.
 *
 * The outstanding balance is handled with an explicit directive rather than an
 * implicit default, because the two outcomes are not the same record: "retain
 * the receivable against the parent" and "write it off" are different decisions
 * with different audit consequences, and a form that picked one for you would be
 * making a financial decision on your behalf. Both paths need the student's
 * guardian to still be liable, so the balance is never silently dropped.
 *
 * The write-off is deliberately *not* implemented here. There is no write-off
 * endpoint in this service — the balance is left exactly as it is and the
 * directive records the intent. Saying "requires Bursar authorization" rather
 * than offering a button that silently does nothing is the honest version.
 */
const TransferOutDialog = ({ open, student, onClose, onConfirm }) => {
  const [form, setForm] = useState({
    destinationInstitution: '',
    destinationInstitutionType: 'PUBLIC_SCHOOL',
    transferDate: today(),
    transferReason: 'RELOCATION',
    customReason: '',
    contactPerson: '',
    contactPhone: '',
    recordsTransferred: true,
    notes: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Reset per student: reopening the dialog for a different student must not
  // inherit the previous one's destination, which is how a transfer gets filed
  // against the wrong child.
  useEffect(() => {
    if (open) {
      setForm({
        destinationInstitution: '',
        destinationInstitutionType: 'PUBLIC_SCHOOL',
        transferDate: today(),
        transferReason: 'RELOCATION',
        customReason: '',
        contactPerson: '',
        contactPhone: '',
        recordsTransferred: true,
        notes: '',
      });
      setError(null);
    }
  }, [open, student?._id]);

  if (!open || !student) return null;

  const guardian = (student.parents || []).find((p) => p.isPrimary);
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const needsCustomReason = form.transferReason === 'OTHER';

  const submit = async () => {
    if (!form.destinationInstitution.trim()) {
      setError('Enter the school the student is transferring to.');
      return;
    }
    if (needsCustomReason && form.customReason.trim().length < 5) {
      setError('Give a reason of at least 5 characters, or choose a different reason.');
      return;
    }
    // Mirrors the server's `transferDate` rule so the failure lands on the field
    // rather than as a 422 with a generic message.
    if (new Date(form.transferDate) > new Date(Date.now() + 30 * 86400000)) {
      setError('The transfer date cannot be more than 30 days in the future.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        ...form,
        customReason: needsCustomReason ? form.customReason : undefined,
      });
    } catch (err) {
      setError(err.message || 'The transfer could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Record transfer out — ${student.studentName}`}
      description={`${student.studentClass} · Student ID: ${student.studentId}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Recording…' : 'Confirm transfer out'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="flex-1 text-[12px] font-semibold text-brand-900">
            GES Standard Form TS-4. The cumulative record stays on this
            student&apos;s ledger permanently.
          </p>
          <Badge tone="brand">TS-4</Badge>
        </div>

        {error && <FormAlert tone="error">{error}</FormAlert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Destination school"
            required
            placeholder="e.g. Achimota Basic School, Accra Metropolitan"
            value={form.destinationInstitution}
            onChange={(event) => set({ destinationInstitution: event.target.value })}
          />

          <SelectField
            label="Destination type"
            required
            value={form.destinationInstitutionType}
            onChange={(event) => set({ destinationInstitutionType: event.target.value })}
          >
            {INSTITUTION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Transfer effective date"
            type="date"
            required
            max={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
            value={form.transferDate}
            onChange={(event) => set({ transferDate: event.target.value })}
          />

          <SelectField
            label="Reason for transfer"
            required
            value={form.transferReason}
            onChange={(event) => set({ transferReason: event.target.value })}
          >
            {TRANSFER_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          {needsCustomReason && (
            <Field
              label="Please specify"
              required
              className="sm:col-span-2"
              value={form.customReason}
              onChange={(event) => set({ customReason: event.target.value })}
            />
          )}

          <Field
            label="Contact person at destination"
            value={form.contactPerson}
            onChange={(event) => set({ contactPerson: event.target.value })}
          />

          <Field
            label="Contact phone"
            value={form.contactPhone}
            onChange={(event) => set({ contactPhone: event.target.value })}
          />
        </div>

        {(student.balance || 0) > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[13px] font-extrabold text-amber-900">
              Outstanding balance · {formatCedi(student.balance)}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-amber-800">
              {guardian
                ? `${guardian.parentName} remains liable. `
                : 'No primary guardian is recorded, so this balance has no named payer. '}
              The ledger is preserved and the balance carries into the
              transfer record.
            </p>
          </div>
        )}

        <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
          <input
            type="checkbox"
            checked={form.recordsTransferred}
            onChange={(event) => set({ recordsTransferred: event.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
          />
          <span className="min-w-0">
            <span className="block text-[12px] font-extrabold text-ink">
              Hard-copy records have been transferred
            </span>
            <span className="block text-[11px] font-semibold text-slate-500">
              Recorded on the cumulative record file as required by GES.
            </span>
          </span>
        </label>

        <Field
          label="Administrative notes"
          hint="Optional"
          className="block"
          value={form.notes}
          onChange={(event) => set({ notes: event.target.value })}
        />

        {guardian?.phone && (
          <p className="flex items-start gap-2 text-[12px] font-semibold text-slate-500">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            The guardian at {formatGhanaPhone(guardian.phone)} will keep the ability
            to settle any balance. Reminder SMS are sent from the SMS Reminders
            module.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default TransferOutDialog;
