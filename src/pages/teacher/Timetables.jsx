import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Button from '../../components/common/Button';
import { Field, SelectField } from '../../components/common/FormField';
import EmptyState from '../../components/parent/shared/EmptyState';
import { Calendar, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
  fetchMyTimetables,
  saveTimetableDraft,
  submitTimetable,
  withdrawTimetable,
} from '../../services/teacher/timetable';
import { fetchMyClasses } from '../../services/teacher/classes';
import { ACADEMIC_TERMS } from '../../utils/constants';
import TimetableGridEditor from '../../components/dashboard/TimetableGridEditor';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const emptyDays = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

const defaultAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

const STATUS_COLOR = {
  draft: 'text-slate-600',
  submitted: 'text-amber-700',
  approved: 'text-emerald-700',
  rejected: 'text-rose-700',
  published: 'text-emerald-700',
};

const Timetables = () => {
  const toast = useToast();
  const [timetables, setTimetables] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingClass, setEditingClass] = useState('');
  const [editorTerm, setEditorTerm] = useState(ACADEMIC_TERMS[0]);
  const [editorAcademicYear, setEditorAcademicYear] = useState(defaultAcademicYear());
  const [editorDays, setEditorDays] = useState(emptyDays());
  const [editorStatus, setEditorStatus] = useState('draft');
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTimetables = async () => {
    setLoading(true);
    try {
      const result = await fetchMyTimetables();
      setTimetables(result?.data?.timetables || []);
    } catch {
      setTimetables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetables();
    let active = true;
    fetchMyClasses()
      .then((result) => {
        if (!active) return;
        setClasses(result?.data?.classes || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadEditor = (className, { term, academicYear } = {}) => {
    setCreating(false);
    const found = timetables.find((t) => t.className === className);
    setEditingClass(className);
    setEditorTerm(found ? found.term : (term || ACADEMIC_TERMS[0]));
    setEditorAcademicYear(found ? found.academicYear : (academicYear || defaultAcademicYear()));
    setEditorDays(
      found ? { ...emptyDays(), ...(found.days || {}) } : emptyDays()
    );
    setEditorStatus(found ? found.submissionStatus || 'draft' : 'draft');
  };

  const closeEditor = () => {
    setEditingClass('');
    setCreating(false);
    setEditorTerm(ACADEMIC_TERMS[0]);
    setEditorAcademicYear(defaultAcademicYear());
    setEditorDays(emptyDays());
    setEditorStatus('draft');
  };

  const startCreate = () => {
    setCreating(true);
    setEditingClass('');
    setEditorTerm(ACADEMIC_TERMS[0]);
    setEditorAcademicYear(defaultAcademicYear());
    setEditorDays(emptyDays());
    setEditorStatus('draft');
  };

  const isEditable = (status) =>
    !['submitted', 'approved', 'published'].includes(status);

  const handleSaveDraft = async (nextDays) => {
    setEditorLoading(true);
    try {
      await saveTimetableDraft({
        className: editingClass,
        term: editorTerm,
        academicYear: editorAcademicYear,
        days: nextDays,
        status: 'draft',
      });
      setEditorDays(nextDays);
      toast.success('Timetable saved as draft.');
      loadTimetables();
    } catch (error) {
      toast.error(error?.message || 'Could not save the timetable.');
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitTimetable(editingClass, {
        term: editorTerm,
        academicYear: editorAcademicYear,
      });
      setEditorStatus('submitted');
      toast.success('Timetable submitted for approval.');
      closeEditor();
      loadTimetables();
    } catch (error) {
      toast.error(error?.message || 'Could not submit the timetable.');
    } finally {
      setSubmitting(false);
  } };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await withdrawTimetable(editingClass, {
        term: editorTerm,
        academicYear: editorAcademicYear,
      });
      setEditorStatus('draft');
      toast.success('Timetable withdrawn — back to draft.');
      loadTimetables();
    } catch (error) {
      toast.error(error?.message || 'Could not withdraw the timetable.');
    } finally {
      setWithdrawing(false);
    }
  };

  const hasEditorPeriods = useMemo(
    () => DAYS.some((day) => (editorDays[day] || []).length > 0),
    [editorDays]
  );

  const canEditEditor = isEditable(editorStatus);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Timetables"
        title="My Timetables"
        description="Draft timetables for your classes and submit them to the administrator for approval."
      />

      <div className="flex flex-wrap items-center gap-3">
        {creating ? (
          <div className="flex items-center gap-2">
            <SelectField
              label="Class"
              value={editingClass}
              onChange={(e) => setEditingClass(e.target.value)}
            >
              <option value="">Select a class</option>
              {classes.map((c) => {
                const label = c.className || c.name || c._id;
                return <option key={label} value={label}>{label}</option>;
              })}
            </SelectField>
            <SelectField
              label="Term"
              value={editorTerm}
              onChange={(e) => setEditorTerm(e.target.value)}
            >
              {ACADEMIC_TERMS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectField>
            <Field
              label="Academic year"
              value={editorAcademicYear}
              onChange={(e) => setEditorAcademicYear(e.target.value)}
              placeholder="2026/2027"
            />
            <Button
              variant="primary"
              disabled={!editingClass || !editorAcademicYear || loading}
              onClick={() =>
                loadEditor(editingClass, {
                  term: editorTerm,
                  academicYear: editorAcademicYear,
                })
              }
            >
              Create
            </Button>
            <Button variant="secondary" onClick={closeEditor}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={startCreate}
            disabled={loading}
          >
            Create timetable
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading timetables…</p>
      ) : timetables.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No timetables yet"
          description="Create a timetable for one of your classes to get started."
        />
      ) : (
        <Card className="p-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">
                  Class
                </th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">
                  Term / year
                </th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">
                  Status
                </th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">
                  Updated
                </th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {timetables.map((t) => (
                <tr
                  key={`${t.className}|${t.term}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-3 text-[13px] font-semibold text-ink">
                    {t.className}
                  </td>
                  <td className="py-3 text-[12.5px] text-slate-600">
                    {t.term} / {t.academicYear}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        STATUS_COLOR[t.submissionStatus] || ''
                      } bg-[${STATUS_COLOR[t.submissionStatus] || 'text-slate-600'}]/10`}
                    >
                      {STATUS_LABEL[t.submissionStatus] || t.submissionStatus}
                    </span>
                  </td>
                  <td className="py-3 text-[12.5px] text-slate-500">
                    {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {t.submissionStatus === 'draft' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => loadEditor(t.className)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={submitting}
                            onClick={() => {
                              loadEditor(t.className);
                              setSubmitting(true);
                              submitTimetable(t.className, {
                                term: t.term,
                                academicYear: t.academicYear,
                              }).then(() => {
                                setEditorStatus('submitted');
                                toast.success('Submitted for approval.');
                                closeEditor();
                                loadTimetables();
                                setSubmitting(false);
                              });
                            }}
                          >
                            Submit
                          </Button>
                        </>
                      )}
                      {t.submissionStatus === 'submitted' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={withdrawing}
                          onClick={() => {
                              loadEditor(t.className);
                              withdrawTimetable(t.className, {
                                term: t.term,
                                academicYear: t.academicYear,
                              }).then(() => {
                              setEditorStatus('draft');
                              toast.success('Withdrawn — back to draft.');
                              loadTimetables();
                            });
                          }}
                        >
                          Withdraw
                        </Button>
                      )}
                      {(t.submissionStatus === 'approved' ||
                        t.submissionStatus === 'rejected' ||
                        t.submissionStatus === 'published') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => loadEditor(t.className)}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editingClass && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-extrabold text-ink">
              {editingClass} — timetable
            </h3>
            <Button variant="secondary" size="sm" onClick={closeEditor}>
              Done
            </Button>
          </div>
          <TimetableGridEditor
            initialDays={editorDays}
            className={editingClass}
            term=""
            academicYear=""
            status={editorStatus}
            editable={canEditEditor}
            saving={editorLoading || saving}
            onSaveDraft={handleSaveDraft}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {editorStatus === 'draft' && canEditEditor && hasEditorPeriods && (
              <Button
                variant="primary"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </Button>
            )}
            {editorStatus === 'submitted' && (
              <Button
                variant="secondary"
                disabled={withdrawing}
                onClick={handleWithdraw}
              >
                {withdrawing ? 'Withdrawing…' : 'Withdraw'}
              </Button>
            )}
            {editorStatus === 'rejected' && canEditEditor && (
              <p className="text-[12.5px] text-rose-700 font-semibold">
                Returned by the administrator — edit and resubmit.
              </p>
            )}
            {editorStatus === 'approved' && (
              <p className="text-[12.5px] text-emerald-700 font-semibold">
                Approved by the administrator — awaiting publication.
              </p>
            )}
            {editorStatus === 'published' && (
              <p className="text-[12.5px] text-emerald-700 font-semibold">
                Published — teachers and parents can see this timetable.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Timetables;
