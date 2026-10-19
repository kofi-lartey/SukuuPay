import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Button from '../../../components/common/Button';
import { Field, SelectField } from '../../../components/common/FormField';
import EmptyState from '../../../components/parent/shared/EmptyState';
import Modal from '../../../components/common/Modal';
import { Calendar, Clock, Trash2 } from 'lucide-react';
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
  deactivateTimetable,
  republishTimetable,
  removeTimetable,
  listRemovalRequests,
  confirmRemoval,
  rejectRemovalRequest,
} from '../../../services/admin/academic';
import { ACADEMIC_TERMS } from '../../../utils/constants';
import { listUsers } from '../../../services/user';
import TimetableGridEditor from '../../../components/dashboard/TimetableGridEditor';
import TeacherAttendanceReport from './TeacherAttendanceReport';

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
  deactivated: 'Deactivated',
};

const STATUS_COLOR = {
  draft: 'text-slate-600',
  submitted: 'text-amber-700',
  approved: 'text-emerald-700',
  rejected: 'text-rose-700',
  published: 'text-emerald-700',
  deactivated: 'text-slate-500',
};

const Timetables = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('create');
  useEffect(() => {
    listUsers({ role: 'teacher', limit: 100 })
      .then((res) => setReportTeachers(res?.users || []))
      .catch(() => setReportTeachers([]));
  }, []);
  const [reportTeachers, setReportTeachers] = useState([]);
  const [reportTeacher, setReportTeacher] = useState('');
  const [reportPeriod, setReportPeriod] = useState('week');
  const tabs = [
    { key: 'create', label: 'Create Timetable' },
    { key: 'view', label: 'View Approved Timetable' },
    { key: 'attendance', label: "Teachers' Attendance" },
    { key: 'report', label: 'Generate Report' },
  ];
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState([]);
  useEffect(() => {
    if (activeTab !== 'attendance' || !className) return;
    import('../../../services/admin/academic').then(({ listTeacherAttendance }) => {
      listTeacherAttendance({ className })
        .then((res) => setTeacherAttendanceRecords(res?.records || []))
        .catch(() => setTeacherAttendanceRecords([]));
    });
  }, [activeTab, className]);
  const [term, setTerm] = useState(ACADEMIC_TERMS[0]);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [days, setDays] = useState(emptyDays());
  const [status, setStatus] = useState('draft');
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [removalRequests, setRemovalRequests] = useState([]);
  const [removalRequestsLoading, setRemovalRequestsLoading] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [deactivatedAt, setDeactivatedAt] = useState(null);

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
        setDeactivatedAt(result.deactivatedAt || null);
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
      const result = await listSubmissions();
      setSubmissions(result?.submissions || []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const loadRemovalRequests = async () => {
    setRemovalRequestsLoading(true);
    try {
      const result = await listRemovalRequests();
      setRemovalRequests(result?.requests || []);
    } catch {
      setRemovalRequests([]);
    } finally {
      setRemovalRequestsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
    loadRemovalRequests();
    const onFocus = () => {
      loadSubmissions();
      loadRemovalRequests();
    };
    const interval = setInterval(() => {
      loadSubmissions();
      loadRemovalRequests();
    }, 30000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, []);

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
      setSubmissionStatus('approved');
      toast.success('Timetable published.');
      loadSubmissions();
      loadTimetable();
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
      if (
        className === item.className &&
        term === item.term &&
        academicYear === item.academicYear
      ) {
        setSubmissionStatus('approved');
      }
      loadSubmissions();
      loadTimetable();
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
      loadTimetable();
    } catch (error) {
      toast.error(error?.message || 'Could not reject the timetable.');
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await deactivateTimetable({ className, term, academicYear });
      setStatus('draft');
      setDeactivatedAt(new Date().toISOString());
      toast.success('Timetable deactivated — no longer visible to parents or teachers.');
      loadSubmissions();
      loadTimetable();
    } catch (error) {
      toast.error(error?.message || 'Could not deactivate the timetable.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleRepublish = async () => {
    setRepublishing(true);
    try {
      await republishTimetable({ className, term, academicYear });
      setStatus('published');
      setDeactivatedAt(null);
      setSubmissionStatus('approved');
      toast.success('Timetable republished — visible to parents and teachers.');
      loadSubmissions();
      loadRemovalRequests();
      loadTimetable();
    } catch (error) {
      toast.error(error?.message || 'Could not republish the timetable.');
    } finally {
      setRepublishing(false);
    }
  };

  const handleRemove = async () => {
    if (removeConfirm !== 'REMOVE') return;
    setRemoving(true);
    try {
      await removeTimetable(className, { term, academicYear });
      toast.success('Timetable permanently removed.');
      setRemoveConfirm(null);
      setRemoveDialogOpen(false);
      loadSubmissions();
      loadRemovalRequests();
    } catch (error) {
      toast.error(error?.message || 'Could not remove the timetable.');
    } finally {
      setRemoving(false);
    }
  };

  const handleConfirmRemoval = async (item) => {
    try {
      await confirmRemoval(item.className, { term: item.term, academicYear: item.academicYear });
      toast.success('Removal confirmed — timetable deleted.');
      loadRemovalRequests();
      loadSubmissions();
    } catch (error) {
      toast.error(error?.message || 'Could not confirm the removal.');
    }
  };

  const handleRejectRemoval = async (item) => {
    try {
      await rejectRemovalRequest(item.className, { term: item.term, academicYear: item.academicYear });
      toast.success('Removal request rejected.');
      loadRemovalRequests();
    } catch (error) {
      toast.error(error?.message || 'Could not reject the removal request.');
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

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold ${
              activeTab === t.key
                ? 'bg-brand-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'view' && (
        <Card className="p-4">
          <h3 className="text-[14px] font-extrabold text-ink mb-3">Approved Timetable</h3>
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
          {status === 'published' || submissionStatus === 'approved' ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[13px] font-extrabold text-ink">{className}</p>
                <p className="text-[11.5px] text-slate-500">{term} · {academicYear}</p>
                <p className="text-[11px] font-extrabold text-emerald-700 mt-1">{status} / {submissionStatus}</p>
              </div>
               <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                {['Monday','Tuesday','Wednesday','Thursday','Friday'].map((day) => {
                  const periods = (days[day] || []).slice().sort((a, b) => (a.period || 0) - (b.period || 0));
                  return (
                    <div key={day} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                      <h3 className="mb-2 text-[13px] font-extrabold text-ink">{day}</h3>
                      {periods.length === 0 ? (
                        <p className="text-[11.5px] italic text-slate-400">No periods</p>
                      ) : (
                        <div className="space-y-2">
                          {periods.map((p, i) => (
                            <div key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-brand-700">
                                  {(() => { const [h,m]=String(p.startTime||'').split(':'); const hr=Number(h); return `${hr%12||12}:${m||'00'} ${hr>=12?'pm':'am'}`; })()} – {(() => { const [h,m]=String(p.endTime||'').split(':'); const hr=Number(h); return `${hr%12||12}:${m||'00'} ${hr>=12?'pm':'am'}`; })()}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">#{p.period}</span>
                              </div>
                              <p className="mt-1 text-[12.5px] font-bold text-ink leading-tight">{p.subject || '—'}</p>
                              {(p.teacher || p.room) && (
                                <p className="mt-0.5 text-[10.5px] text-slate-500">{[p.teacher, p.room].filter(Boolean).join(' · ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-3">No approved timetable for the selected class.</p>
          )}
        </Card>
      )}
      {activeTab === 'attendance' && (
        <Card className="p-4">
          <h3 className="text-[14px] font-extrabold text-ink mb-3">Teachers' Attendance</h3>
          {teacherAttendanceRecords.length === 0 ? (
            <p className="text-sm text-slate-400">No attendance records yet.</p>
          ) : (
            <ul className="space-y-2">
              {teacherAttendanceRecords.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-[13px] font-extrabold text-ink">{r.teacherId?.name || 'Teacher'}</p>
                    <p className="text-[11.5px] text-slate-500">{r.className} · {new Date(r.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[11px] font-extrabold ${r.status === 'attended' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {activeTab === 'report' && <TeacherAttendanceReport className={className} />}

      <div className={activeTab === 'create' ? '' : 'hidden'}>
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
            {STATUS_LABEL[submissionStatus] || submissionStatus}
          </span>
          {deactivatedAt ? (
            <span className="text-slate-500">
              {' '}
              &middot; <span className="font-semibold">Deactivated</span>
            </span>
          ) : null}
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
            key={`${className}|${term}|${academicYear}`}
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
                status === 'published' ||
                submissionStatus === 'submitted' ||
                submissionStatus === 'draft' ||
                submissionStatus === 'rejected' ||
                !!deactivatedAt
              }
              onClick={handlePublish}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>

            {deactivatedAt ? (
              <button
                type="button"
                disabled={republishing || submissionStatus !== 'approved'}
                onClick={handleRepublish}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {republishing ? 'Republishing…' : 'Republish'}
              </button>
            ) : status === 'published' ? (
              <button
                type="button"
                disabled={deactivating || submissionStatus !== 'approved'}
                onClick={handleDeactivate}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            ) : null}

            <button
              type="button"
              disabled={deactivating || publishing || republishing || removalRequestsLoading}
              onClick={() => { setRemoveConfirm(''); setRemoveDialogOpen(true); }}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 inline mr-1" />
              Remove
            </button>
          </div>

          {deactivatedAt ? (
            <p className="text-[12.5px] text-slate-500 font-semibold">
              Deactivated — no longer visible to parents or teachers. Republish to restore.
            </p>
          ) : submissionStatus === 'published' && status === 'published' ? (
            <p className="text-[12.5px] text-emerald-700 font-semibold">
              Published &mdash; teachers and parents can see this timetable.
            </p>
          ) : null}

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-[14px] font-extrabold text-ink mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden="true" />
              Submissions for review
              <Button
                variant="ghost"
                size="sm"
                onClick={loadSubmissions}
                disabled={submissionsLoading}
              >
                {submissionsLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
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
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setClassName(item.className);
                          setTerm(item.term);
                          setAcademicYear(item.academicYear);
                        }}
                      >
                        View
                      </Button>
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

          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-[14px] font-extrabold text-ink mb-3 flex items-center gap-2">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              Removal Requests
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRemovalRequests}
              disabled={removalRequestsLoading}
            >
              {removalRequestsLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </h3>
          {removalRequestsLoading ? (
            <p className="text-sm text-slate-500">Loading removal requests…</p>
          ) : removalRequests.length === 0 ? (
            <p className="text-sm text-slate-400">
              No removal requests pending.
            </p>
          ) : (
            <div className="space-y-2">
              {removalRequests.map((item) => (
                <Card key={`${item.className}|${item.term}|${item.academicYear}`} className="p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[12.5px] font-semibold text-ink">
                      {item.className}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.term}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.academicYear}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-700">
                      Removal requested
                    </span>
                    {item.removalRequestedByName && (
                      <span className="text-[11px] text-slate-400">
                        &middot; {item.removalRequestedByName}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-600 mb-2">
                    {item.removalReason}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`Confirm removal of ${item.className} timetable?`)) {
                          handleConfirmRemoval(item);
                        }
                      }}
                    >
                      Confirm Removal
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRejectRemoval(item)}
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

    <Modal
      open={removeDialogOpen}
      onClose={() => { setRemoveDialogOpen(false); setRemoveConfirm(null); }}
      title="Confirm Permanent Removal"
    >
      <div className="space-4">
        <p className="text-sm text-slate-600">
          Type <strong>REMOVE</strong> in the box below to permanently delete the
          timetable for <strong>{className}</strong> ({term}, {academicYear}).
        </p>
        <input
          type="text"
          value={removeConfirm || ''}
          onChange={(e) => setRemoveConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Type REMOVE to confirm"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setRemoveDialogOpen(false); setRemoveConfirm(null); }}
            className="px-4 py-2 text-sm text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={removing || removeConfirm !== 'REMOVE'}
            onClick={handleRemove}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </Modal>
  </div>
);
};

export default Timetables;
