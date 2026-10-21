import React, { useState } from 'react';
import { Clock, UserCheck } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Modal from '../../../components/common/Modal';
import { SkeletonRow } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useToast } from '../../../hooks/useToast';
import { useGradeApprovalQueue } from '../../../hooks/admin/useGradeApprovalQueue';
// `approveGrades` and `rejectGrades` are the two calls the dialogs make, and
// they were missing from this import — so the headmaster's Approve and Reject
// buttons threw a ReferenceError the moment they were pressed. The screen the
// breakdown is reviewed on has to actually be able to approve.
import {
  approveGrades,
  rejectGrades,
  getAdminClassGrades,
} from '../../../services/admin/academic';
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

const QueueTable = ({ items, onApprove, onReject, expandedKey, gradeMap, onView }) => {
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
            <th className="px-4 py-2.5">Students</th>
            <th className="px-4 py-2.5">At</th>
            <th className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((row, i) => {
            const key = `${row.className}:${row.subject ?? 'class'}:${i}`;
            const expanded = expandedKey === key;
            const grades = gradeMap[key] || [];
            // The class assessment's parts are the same for every row in the
            // block, so the first row supplies the column heads.
            const g0 = grades[0];
            return (
              <React.Fragment key={key}>
                <tr>
                  <td className="px-4 py-2.5 font-extrabold text-ink">{row.className}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.subject || <span className="italic">Whole class</span>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{row.submittedByName || <UserCheck className="inline h-4 w-4" />}</td>
                  <td className="px-4 py-2.5">{formatCount(row.studentCount ?? row.count)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onView(row, key)}
                      className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-sky-700 hover:bg-sky-50"
                    >
                      {expanded ? 'Hide' : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(row)}
                      disabled={row.approvalStatus === 'approved'}
                      className="ml-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(row)}
                      className="ml-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-700"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50 px-4 py-3">
                      {grades.length === 0 ? (
                        <p className="text-sm text-slate-400">No grades found.</p>
                      ) : (
                        /*
                          The breakdown, exactly as the terminal report prints
                          it: each part of the class assessment, the class
                          score they add up to, the exam's points out of 70,
                          the total, the letter and the position.

                          The headmaster signs this block, so the numbers being
                          signed must be the numbers the report card will
                          carry — and a total computed from a class score alone
                          is not a result, so it is shown as a dash rather than
                          as a figure.
                        */
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Student</th>
                              <th className="px-3 py-2">Subject</th>
                              {(g0?.classParts || []).map((part) => (
                                <th key={part.key} className="px-3 py-2 text-right">
                                  {part.label}
                                </th>
                              ))}
                               <th className="px-3 py-2 text-right">Class ({g0?.classMaxScore ?? 30})</th>
                               <th className="px-3 py-2 text-right">Exam ({g0?.examMaxScore ?? 100})</th>
                              <th className="px-3 py-2 text-right">Total</th>
                              <th className="px-3 py-2 text-right">Grade</th>
                              <th className="px-3 py-2 text-right">Pos</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {grades.map((g, j) => (
                              <tr key={`${g.studentId}-${g.subject}-${j}`}>
                                <td className="px-3 py-2">{g.studentName || g.studentId}</td>
                                <td className="px-3 py-2">{g.subject}</td>
                                {(g.classParts || []).map((part) => (
                                  <td
                                    key={part.key}
                                    className="px-3 py-2 text-right tabular-nums"
                                  >
                                    {part.score === null || part.score === undefined
                                      ? '—'
                                      : `${part.score}/${part.maxScore}`}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {g.classScore ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {g.examScore ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-extrabold tabular-nums">
                                  {g.totalScore ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {g.grade ? (
                                    <span className="font-extrabold">{g.grade}</span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                {/* The position the report card will carry. A
                                    partly marked subject has no total to rank
                                    on, so it has no position. */}
                                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                                  {g.subjectPosition || '—'}
                                </td>
                                <td className="px-3 py-2 capitalize">{g.approvalStatus}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const GradeApproval = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingRow, setPendingRow] = useState(null);
  const [rejectRow, setRejectRow] = useState(null);
  const [expandedKey, setExpandedKey] = useState(null);
  const [gradeMap, setGradeMap] = useState({});
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
          <QueueTable
            items={items}
            onApprove={onApprove}
            onReject={onReject}
            expandedKey={expandedKey}
            gradeMap={gradeMap}
            onView={async (row, key) => {
              if (expandedKey === key) {
                setExpandedKey(null);
                return;
              }
              try {
                const res = await getAdminClassGrades({
                  className: row.className,
                  subject: row.subject || undefined,
                  term: row.term,
                  academicYear: row.academicYear,
                });
                setGradeMap((prev) => ({ ...prev, [key]: res?.grades || [] }));
                setExpandedKey(key);
              } catch {
                setGradeMap((prev) => ({ ...prev, [key]: [] }));
                setExpandedKey(key);
              }
            }}
          />
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
