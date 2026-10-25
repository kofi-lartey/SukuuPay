import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Button from '../../components/common/Button';
import { Field, SelectField } from '../../components/common/FormField';
import EmptyState from '../../components/parent/shared/EmptyState';
import Modal from '../../components/common/Modal';
import { Calendar, Clock, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import {
  fetchMyTimetables,
  fetchMyTimetable,
  saveTimetableDraft,
  submitTimetable,
  withdrawTimetable,
  requestTimetableRemoval,
  withdrawRemovalRequest,
} from '../../services/teacher/timetable';
import { fetchMyClasses } from '../../services/teacher/classes';
import { importTimetable } from '../../services/admin/academic';
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
  const [importing, setImporting] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [removalTarget, setRemovalTarget] = useState(null);
  const [removalReason, setRemovalReason] = useState('');
  const [editorRemovalStatus, setEditorRemovalStatus] = useState(null);

  const loadTimetables = async () => {
    setLoading(true);
    try {
      const result = await fetchMyTimetables({
        term: ACADEMIC_TERMS[0],
        academicYear: defaultAcademicYear(),
      });
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
    setEditorRemovalStatus(found ? found.removalStatus || null : null);
  };

  const closeEditor = () => {
    setEditingClass('');
    setCreating(false);
    setEditorTerm(ACADEMIC_TERMS[0]);
    setEditorAcademicYear(defaultAcademicYear());
    setEditorDays(emptyDays());
    setEditorStatus('draft');
    setEditorRemovalStatus(null);
  };

  const startCreate = () => {
    setCreating(true);
    setEditingClass('');
    setEditorTerm(ACADEMIC_TERMS[0]);
    setEditorAcademicYear(defaultAcademicYear());
    setEditorDays(emptyDays());
    setEditorStatus('draft');
    setEditorRemovalStatus(null);
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
      loadTimetables();
    } catch (error) {
      // Let the editor's handleSaveDraft surface the error toast.
      throw error;
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
    }
  };

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

  const handleRequestRemoval = async () => {
    if (removalTarget && removalReason.trim().length >= 10) {
      try {
        await requestTimetableRemoval(removalTarget.className, {
          term: removalTarget.term,
          academicYear: removalTarget.academicYear,
          reason: removalReason,
        });
        toast.success('Removal request submitted — awaiting admin review.');
        setRemovalTarget(null);
        setRemovalReason('');
        loadTimetables();
      } catch (error) {
        toast.error(error?.message || 'Could not submit the removal request.');
      }
    } else {
      toast.error('Please provide a removal reason of at least 10 characters.');
    }
  };

  const handleWithdrawRemoval = async (target) => {
    try {
      await withdrawRemovalRequest(target.className, {
        term: target.term,
        academicYear: target.academicYear,
      });
      toast.success('Removal request withdrawn.');
      loadTimetables();
    } catch (error) {
      toast.error(error?.message || 'Could not withdraw the removal request.');
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
                    {t.removalStatus === 'requested' && (
                      <span className="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-100">
                        Removal pending
                      </span>
                    )}
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
                      {(t.submissionStatus === 'submitted' ||
                        t.submissionStatus === 'approved' ||
                        t.submissionStatus === 'published') &&
                        !t.removalStatus && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRemovalTarget(t);
                              setRemovalReason('');
                            }}
                          >
                            Request Removal
                          </Button>
                        )}
                      {t.removalStatus === 'requested' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleWithdrawRemoval(t)}
                        >
                          Withdraw Request
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
            key={`${editingClass}|${editorVersion}`}
            initialDays={editorDays}
            className={editingClass}
            term={editorTerm}
            academicYear={editorAcademicYear}
            status={editorStatus}
            editable={canEditEditor}
            saving={editorLoading || saving}
            onSaveDraft={handleSaveDraft}
            showImport
            onImportFile={(file) => {
              setImporting(true);
              return importTimetable(file, {
                className: editingClass,
                term: editorTerm,
                academicYear: editorAcademicYear,
                status: 'draft',
              })
                .then(async () => {
                  toast.success('Timetable imported from file.');
                  try {
                    const result = await fetchMyTimetable(editingClass, {
                      term: editorTerm,
                      academicYear: editorAcademicYear,
                    });
                    const found = result?.data;
                    if (found) {
                      setEditorDays({ ...emptyDays(), ...(found.days || {}) });
                      setEditorStatus(found.submissionStatus || 'draft');
                      setEditorVersion((v) => v + 1);
                    }
                  } catch {
                    // Fall back to reloading from the list.
                  }
                  loadTimetables();
                })
                .catch((error) => {
                  toast.error(error?.message || 'Could not import the timetable.');
                })
                .finally(() => setImporting(false));
             }}
             allowedSubjects={classes.find((c) => c.className === editingClass)?.subjects || []}
             importing={importing}
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
            {editorRemovalStatus === 'requested' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleWithdrawRemoval({
                  className: editingClass,
                  term: editorTerm,
                  academicYear: editorAcademicYear,
                })}
              >
                Withdraw Removal Request
              </Button>
            )}
            {(editorStatus === 'submitted' || editorStatus === 'approved' || editorStatus === 'published') &&
              editorRemovalStatus !== 'requested' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const found = timetables.find((t) => t.className === editingClass);
                    setRemovalTarget(found || {
                      className: editingClass,
                      term: editorTerm,
                      academicYear: editorAcademicYear,
                    });
                    setRemovalReason('');
                  }}
                >
                  Request Removal
                </Button>
              )}
          </div>
         </Card>
       )}

      <Modal
        open={!!removalTarget}
        onClose={() => setRemovalTarget(null)}
        title="Request Timetable Removal"
      >
        <div className="space-4">
          <p className="text-sm text-slate-600">
            Request removal of the timetable for <strong>{removalTarget?.className}</strong> ({removalTarget?.term}, {removalTarget?.academicYear}).
          </p>
          <p className="text-[12px] text-slate-500">
            Provide a reason (minimum 10 characters):
          </p>
          <textarea
            value={removalReason}
            onChange={(e) => setRemovalReason(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="e.g. The timetable is outdated and no longer reflects the current schedule."
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRemovalTarget(null);
                setRemovalReason('');
              }}
              className="px-4 py-2 text-sm text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRequestRemoval}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white"
            >
              Submit Request
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Timetables;
