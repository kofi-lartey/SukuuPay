import React, { useState } from 'react';
import { Clock, UserCheck } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Modal from '../../../components/common/Modal';
import { SkeletonRow } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useToast } from '../../../hooks/useToast';
import { useGradeApprovalQueue } from '../../../hooks/admin/useGradeApprovalQueue';
import { approveGrades, rejectGrades } from '../../../services/admin/academic';
import { ACADEMIC_TERMS } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

const TERM_OPTIONS = [{ value: '', label: 'All terms' }, ...ACADEMIC_TERMS.map((t) => ({ value: t, label: t }))];

const formatDate = (value) =>
  value ? new Date(value).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const ApproveDialog = ({ open, onClose, row, onDone }) => {
  const { success, error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const scope = {
    className: row?.className,
    subject: row?.subject || undefined,
    term: row?.term,
    academicYear: row?.academicYear,
  };

  const onApprove = async () => {
    setSubmitting(true);
    try {
      const res = await approveGrades(scope);
      success(`${formatCount(res?.approved ?? 0)} grade block${res?.approved === 1 ? '' : 's'} approved.`);
      onDone();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Approve submitted grades?"
      description="The marks are fixed and uneditable from here. Approving stamps the block for this class and term."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            disabled={submitting}
          >
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </>
      }
      size="sm"
    >
      <div className="space-y-2 text-sm">
        <p><span className="font-extrabold text-slate-500">Class:</span> {row?.className}</p>
        <p><span className="font-extrabold text-slate-500">Subject:</span> {row?.subject || 'Whole class'}</p>
        <p><span className="font-extrabold text-slate-500">Term:</span> {row?.term}</p>
        <p className="text-slate-500">Submitting teacher: {row?.submittedByName || <UserCheck className="inline h-4 w-4" />}</p>
      </div>
    </Modal>
  );
};

const RejectDialog = ({ open, onClose, row, onDone }) => {
  const { success, error: toastError } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onReject = async () => {
    if (reason.trim().length < 5) {
      toastError('A rejection reason of at least 5 characters is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await rejectGrades({
        className: row?.className,
        subject: row?.subject || undefined,
        term: row?.term,
        academicYear: row?.academicYear,
        reason,
      });
      success(`${formatCount(res?.rejected ?? 0)} grade block${res?.rejected === 1 ? '' : 's'} rejected.`);
      onDone();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject submitted grades?"
      description="The block returns to the teacher as editable drafts, with this reason attached."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onReject}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-800"
            disabled={submitting || reason.trim().length < 5}
          >
            {submitting ? 'Rejecting…' : 'Reject'}
          </button>
        </>
      }
      size="sm"
    >
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What needs correcting…"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
          />
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Minimum 5 characters. The teacher will see this on the rejected block.
          </p>
        </div>
      </div>
    </Modal>
  );
};

const QueueTable = ({ items, onApprove, onReject }) => {
  if (!items.length) {
    return (
      <EmptyState
        icon={Clock}
        title="No submitted grade blocks"
        description="When a teacher submits a class's marks, it appears here for your review."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5">Class</th>
            <th className="px-4 py-2.5">Subject</th>
            <th className="px-4 py-2.5">Submitted by</th>
            <th className="px-4 py-2.5">Entries</th>
            <th className="px-4 py-2.5">At</th>
            <th className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((row, i) => (
            <tr key={`${row.className}:${row.subject ?? 'class'}:${i}`}>
              <td className="px-4 py-2.5 font-extrabold text-ink">{row.className}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.subject || <span className="italic">Whole class</span>}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.submittedByName || <UserCheck className="inline h-4 w-4" />}</td>
              <td className="px-4 py-2.5">{formatCount(row.count)}</td>
              <td className="px-4 py-2.5 text-slate-500">{formatDate(row.submittedAt)}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onApprove(row)}
                  className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-green-700 hover:bg-green-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReject(row)}
                  className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-red-700 hover:bg-red-50"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const GradeApproval = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingRow, setPendingRow] = useState(null);
  const [rejectRow, setRejectRow] = useState(null);
  const { items, loading, error, filters, setFilter } = useGradeApprovalQueue(reloadKey);

  const refetch = () => setReloadKey((n) => n + 1);
  const onApprove = (row) => setPendingRow(row);
  const onReject = (row) => setRejectRow(row);

  const termValue = filters.term || '';

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Grade approval"
        description="Review marks a teacher has submitted and approve or reject them."
        actions={
          <label className="flex items-end gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Term
            <select
              value={termValue}
              onChange={(e) => setFilter({ term: e.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink"
            >
              {TERM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        }
      />

      <Card padding="p-4" className="shadow-none">
        {loading ? (
          <SkeletonRow />
        ) : error ? (
          <p className="text-sm text-red-600">
            {error.message || 'The approval queue could not be loaded.'}
          </p>
        ) : (
          <QueueTable items={items} onApprove={onApprove} onReject={onReject} />
        )}
      </Card>

      <ApproveDialog
        open={!!pendingRow}
        row={pendingRow}
        onClose={() => setPendingRow(null)}
        onDone={() => {
          setPendingRow(null);
          refetch();
        }}
      />
      <RejectDialog
        open={!!rejectRow}
        row={rejectRow}
        onClose={() => setRejectRow(null)}
        onDone={() => {
          setRejectRow(null);
          refetch();
        }}
      />
    </>
  );
};

export default GradeApproval;
