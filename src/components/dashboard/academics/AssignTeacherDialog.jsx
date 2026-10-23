import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import { SkeletonBlock } from '../../../components/parent/shared/Skeleton';
import { useTeachers } from '../../../hooks/admin/useTeachers';
import { useToast } from '../../../hooks/useToast';
import { assignClassTeacher, assignSubjectTeacher } from '../../../services/admin/academic';

/**
 * Pick a teacher for the class-teacher slot, or for one subject in a class.
 *
 * `subject` is undefined for the class-teacher form (the empty-subject slot) and
 * a string for a subject-teacher form — the two map onto the two write endpoints
 * in `services/admin/academic.js`, distinguished by whether a subject is named.
 * The picker is a single component for both because the only real difference is
 * which service call runs; the "who teaches this" question is the same.
 */
const AssignTeacherDialog = ({ open, onClose, className, subject, onAssigned, title, description }) => {
  const { success, error: toastError } = useToast();
  const { items: teachers, loading } = useTeachers();
  const [teacherId, setTeacherId] = useState('');
  const [canMarkAttendance, setCanMarkAttendance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isSubject = Boolean(subject);
  const heading = title || (isSubject ? `Assign a ${subject} teacher` : 'Assign a class teacher');

  const onSubmit = async () => {
    if (!teacherId) {
      toastError('Pick a teacher first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = isSubject
        ? await assignSubjectTeacher(className, subject, teacherId, canMarkAttendance)
        : await assignClassTeacher(className, { teacherId });
      const name = teachers.find((t) => t.id === teacherId)?.name || 'The teacher';
      success(res?.classTeacher ? `${name} is now the class teacher.` : `${name} is now assigned.`);
      onAssigned?.(teacherId);
      onClose();
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
      title={heading}
      description={description || `Choose a teacher for ${className || 'this class'}.`}
      size="sm"
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
            onClick={onSubmit}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            disabled={submitting || !teacherId}
          >
            {submitting ? 'Saving…' : 'Assign'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          Teacher
        </label>
        {loading ? (
          <SkeletonBlock className="h-10 w-full" />
        ) : (
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>— pick a teacher —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} {t.role === 'school_admin' ? ' (admin)' : ''}</option>
            ))}
          </select>
        )}
        {isSubject && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <input
              id="canMarkAttendance"
              type="checkbox"
              checked={canMarkAttendance}
              onChange={(e) => setCanMarkAttendance(e.target.checked)}
              className="rounded-md text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="canMarkAttendance" className="text-sm text-slate-600 cursor-pointer">
              May mark attendance for {subject}
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5">
              When on, this teacher can accept class periods for this subject.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export const AssignClassTeacherButton = ({ className }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-brand-800 hover:bg-brand-50"
      >
        <UserCheck className="h-3 w-3" /> Assign class teacher
      </button>
      <AssignTeacherDialog
        open={open}
        className={className}
        subject={undefined}
        onClose={() => setOpen(false)}
        title="Assign a class teacher"
        description={`Choose who holds the form. ${className}, this class teacher's slot overrides any previous holder.`}
      />
    </>
  );
};

export default AssignTeacherDialog;
