import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit, Save } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Modal from '../../../components/common/Modal';
import { Field, SelectField } from '../../../components/common/FormField';
import { SkeletonRow } from '../../../components/parent/shared/Skeleton';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useClassAssignments } from '../../../hooks/admin/useClasses';
import AssignTeacherDialog, { AssignClassTeacherButton } from '../../../components/dashboard/academics/AssignTeacherDialog';
import { publishTimetable, setHeadRemark } from '../../../services/admin/academic';
import { useToast } from '../../../hooks/useToast';
import { ACADEMIC_TERMS, ACADEMICS_ROUTES } from '../../../utils/constants';

const PublishTimetableDialog = ({ open, onClose, className, onDone }) => {
  const { success, error: toastError } = useToast();
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSave = async () => {
    if (!term || !year) {
      toastError('The term and academic year are both required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await publishTimetable({ className, term, academicYear: year });
      const published = res?.published ?? 0;
      success(`${published} timetable${published === 1 ? '' : 's'} published for ${className}.`);
      onDone();
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
      title="Publish timetable"
      description={`Makes ${className}'s timetable readable through the parent portal for this term.`}
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
            onClick={onSave}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            disabled={submitting || !term || !year}
          >
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Term" value={term} onChange={(e) => setTerm(e.target.value)} required>
          <option value="">— pick a term —</option>
          {ACADEMIC_TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectField>
        <Field
          label="Academic year"
          placeholder="2025/2026"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
          maxLength={9}
        />
      </div>
    </Modal>
  );
};

const HeadRemarkDialog = ({ open, onClose, className, onDone }) => {
  const { success, error: toastError } = useToast();
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSave = async () => {
    if (!term || !year || text.trim().length < 3) {
      toastError('Term, year and a remark of at least 3 characters are all required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await setHeadRemark({ className, term, academicYear: year, text });
      success(`${res?.updated ?? 0} report card${res?.updated === 1 ? '' : 's'} updated.`);
      onDone();
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
      title="Head remark"
      description={`The remark a parent reads on ${className}'s report card, scoped to one term.`}
      size="md"
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
            onClick={onSave}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            disabled={submitting || !term || !year || text.trim().length < 3}
          >
            {submitting ? 'Saving…' : 'Save remark'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Term" value={term} onChange={(e) => setTerm(e.target.value)} required>
          <option value="">— pick a term —</option>
          {ACADEMIC_TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectField>
        <Field
          label="Academic year"
          placeholder="2025/2026"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
          maxLength={9}
        />
        <Field
          label="Remark"
          placeholder="e.g. Demonstrates steady improvement across the term…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={500}
        />
      </div>
    </Modal>
  );
};

const AssignmentsTable = ({ assignments, onAssignSubject, onAssignClassTeacher }) => {
  if (!assignments.length) {
    return (
      <EmptyState
        icon={Edit}
        title="No teachers assigned yet"
        description="Assign a class teacher and subject teachers to begin linking marks to staff."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Subject</th>
            <th className="px-4 py-2.5">Teacher</th>
            <th className="px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.map((a, i) => (
            <tr key={`${a.teacherId}:${a.subject}:${i}`}>
              <td className="px-4 py-2.5">
                {a.isClassTeacher ? (
                  <Badge tone="ink">Class teacher</Badge>
                ) : (
                  <span className="text-slate-600">Subject teacher</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{a.subject || '—'}</td>
              <td className="px-4 py-2.5 font-extrabold text-ink">{a.name}</td>
              <td className="px-4 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onAssignSubject(a.subject)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-brand-800 hover:bg-brand-50"
                >
                  Reassign
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ClassDetail = () => {
  const { className } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [subjectReassign, setSubjectReassign] = useState(null);

  const { assignments, loading, error } = useClassAssignments(className, reloadKey);
  const refetch = () => setReloadKey((n) => n + 1);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Academics" title={className || 'Class'} description="Managing this class’s teachers and timetable." />
        <SkeletonRow />
      </>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Edit}
        title="Could not load the class"
        description={error.message || 'This class could not be found for your school.'}
        action={
          <button
            type="button"
            onClick={() => navigate(ACADEMICS_ROUTES.classes)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
          >
            Back to classes
          </button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title={className || 'Class'}
        description="Assign teachers, review the timetable and release reports for this class."
        actions={
          <div className="flex items-center gap-2">
            <AssignClassTeacherButton className={className} />
            <button
              type="button"
              onClick={() => setRemarkOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              <Edit className="h-4 w-4" /> Head remark
            </button>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800"
            >
              <Save className="h-4 w-4" /> Publish timetable
            </button>
          </div>
        }
      />

      <Card padding="p-5" className="shadow-none">
        <AssignmentsTable
          assignments={assignments}
          onAssignSubject={(subject) => setSubjectReassign(subject || null)}
        />
      </Card>

      <AssignTeacherDialog
        open={!!subjectReassign}
        className={className}
        subject={subjectReassign || undefined}
        onClose={() => setSubjectReassign(null)}
        onAssigned={refetch}
        title="Reassign subject teacher"
        description="Replaces whoever currently holds this subject for this class."
      />
      <HeadRemarkDialog
        open={remarkOpen}
        className={className}
        onClose={() => setRemarkOpen(false)}
        onDone={refetch}
      />
      <PublishTimetableDialog
        open={publishOpen}
        className={className}
        onClose={() => setPublishOpen(false)}
        onDone={refetch}
      />
    </>
  );
};

export default ClassDetail;
