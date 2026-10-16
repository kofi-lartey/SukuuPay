import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Button from '../../../components/common/Button';
import { Field, SelectField } from '../../../components/common/FormField';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { Calendar, Clock } from 'lucide-react';
import { useToast } from '../../../hooks/useToast';
import {
  listClasses,
  getTimetable,
  saveTimetable,
  publishTimetable,
  importTimetable,
  approveTimetable,
  rejectTimetable,
  listSubmissions,
} from '../../../services/admin/academic';
import { ACADEMIC_TERMS } from '../../../utils/constants';
import TimetableGridEditor from '../../../components/dashboard/TimetableGridEditor';

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
};

const STATUS_COLOR = {
  draft: 'text-slate-600',
  submitted: 'text-amber-700',
  approved: 'text-emerald-700',
  rejected: 'text-rose-700',
};

const Timetables = () => {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [term, setTerm] = useState(ACADEMIC_TERMS[0]);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [days, setDays] = useState(emptyDays());
  const [status, setStatus] = useState('draft');
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    listClasses()
      .then((result) => {
        if (!active) return;
        const list = result?.classes || [];
        setClasses(list);
        if (list.length && !className) setClassName(list[0]?.className || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadTimetable = async () => {
    if (!className || !term || !academicYear) return;
    setLoading(true);
    try {
      const result = await getTimetable(className, { term, academicYear });
      if (result) {
        setDays({ ...emptyDays(), ...(result.days || {}) });
        setStatus(result.status || 'draft');
        setSubmissionStatus(result.submissionStatus || 'draft');
      } else {
        setDays(emptyDays());
        setStatus('draft');
        setSubmissionStatus('draft');
      }
    } catch {
      setDays(emptyDays());
      setStatus('draft');
      setSubmissionStatus('draft');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (className && term && academicYear) loadTimetable();
  }, [className, term, academicYear]);

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const result = await listSubmissions({ term, academicYear });
      setSubmissions(result?.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [term, academicYear]);

  const handleSaveDraft = async (nextDays) => {
    setSaving(true);
    try {
      await saveTimetable({
        className,
        term,
        academicYear,
        days: nextDays,
        status: 'draft',
      });
      setDays(nextDays);
      toast.success('Timetable saved as draft.');
    } catch (error) {
      toast.error(error?.message || 'Could not save the timetable.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishTimetable({ className, term, academicYear });
      setStatus('published');
      toast.success('Timetable published.');
      loadSubmissions();
    } catch (error) {
      toast.error(error?.message || 'Could not publish the timetable.');
    } finally {
      setPublishing(false);
    }
  };

  const handleApprove = async (item) => {
    try {
      await approveTimetable(item.className, {
        term: item.term,
        academicYear: item.academicYear,
      });
      toast.success('Timetable approved.');
      setSubmissions((current) =>
        current.map((s) =>
          s.className === item.className && s.term === item.term
            ? { ...s, submissionStatus: 'approved' }
            : s
        )
      );
      loadSubmissions();
    } catch (error) {
      toast.error(error?.message || 'Could not approve the timetable.');
    }
  };

  const handleReject = async (item) => {
    const reason = window.prompt('Reason for rejection (shown to the teacher):');
    if (!reason) return;
    try {
      await rejectTimetable(item.className, {
        term: item.term,
        academicYear: item.academicYear,
        reason,
      });
      toast.success('Timetable returned to the teacher.');
      setSubmissions((current) =>
        current.map((s) =>
          s.className === item.className && s.term === item.term
            ? { ...s, submissionStatus: 'rejected' }
            : s
        )
      );
      loadSubmissions();
    } catch (error) {
      toast.error(error?.message || 'Could not reject the timetable.');
    }
  };

  const editable = useMemo(
    () => !['submitted', 'approved', 'published'].includes(submissionStatus),
    [submissionStatus]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academics"
        title="Timetable Management"
        description="Build and publish a class timetable. Teachers submit theirs for your approval before publication."
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            label="Class"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          >
            <option value="">Select a class</option>
            {classes.map((c) => {
              const label = c.className || c.name || c._id;
              return <option key={label} value={label}>{label}</option>;
            })}
          </SelectField>
          <SelectField
            label="Term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          >
            {ACADEMIC_TERMS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </SelectField>
          <Field
            label="Academic year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026/2027"
          />
        </div>
        <p className="mt-2 text-[12px] text-slate-500">
          Status: <span className={`font-semibold ${STATUS_COLOR[status] || ''}`}>{status}</span>{' '}
          &middot; Approval:
          <span className={`font-semibold ${STATUS_COLOR[submissionStatus] || ''}`}>
            {STATUS_LABEL[submissionStatus]}
          </span>
        </p>
      </Card>

      {!className ? (
        <EmptyState
          icon={Calendar}
          title="No class selected"
          description="Choose a class to start building its timetable."
        />
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading timetable…</p>
      ) : (
        <div className="space-y-4">
          <TimetableGridEditor
            initialDays={days}
            className={className}
            term={term}
            academicYear={academicYear}
            status={submissionStatus}
            editable={editable}
            saving={saving}
            onSaveDraft={handleSaveDraft}
            showImport
            onImportFile={(file) =>
              importTimetable(file, {
                className,
                term,
                academicYear,
                status: 'draft',
              }).then(() => {
                toast.success('Timetable imported from file.');
                loadTimetable();
              })
            }
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                publishing ||
                !editable ||
                submissionStatus === 'published' ||
                submissionStatus === 'submitted'
              }
              onClick={handlePublish}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>

          {submissionStatus === 'published' && (
            <p className="text-[12.5px] text-emerald-700 font-semibold">
              Published &mdash; teachers and parents can see this timetable.
            </p>
          )}

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-[14px] font-extrabold text-ink mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden="true" />
              Submissions for review
            </h3>
            {submissionsLoading ? (
              <p className="text-sm text-slate-500">Loading submissions&hellip;</p>
            ) : submissions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No timetables awaiting your review.
              </p>
            ) : (
              <div className="space-y-2">
                {submissions.map((item) => (
                  <Card key={`${item.className}|${item.term}`} className="p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[12.5px] font-semibold text-ink">
                        {item.className}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.term}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          STATUS_COLOR[item.submissionStatus] || ''
                        }`}
                      >
                        {STATUS_LABEL[item.submissionStatus]}
                      </span>
                      {item.teacher && (
                        <span className="text-[11px] text-slate-400">
                          &middot; {item.teacher}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        onClick={() => handleApprove(item)}
                        disabled={item.submissionStatus !== 'submitted'}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleReject(item)}
                        disabled={item.submissionStatus !== 'submitted'}
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetables;
