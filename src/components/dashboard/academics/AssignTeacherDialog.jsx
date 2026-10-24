import React, { useEffect, useMemo, useState } from 'react';
import { UserCheck, BookOpen, Check, Plus, ShieldCheck, Search } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import { SkeletonBlock } from '../../../components/parent/shared/Skeleton';
import { useTeachers } from '../../../hooks/admin/useTeachers';
import { useToast } from '../../../hooks/useToast';
import { assignClassTeacher, assignSubjectTeacher } from '../../../services/admin/academic';
import { SUBJECTS, OTHER_SUBJECT, CUSTOM_SUBJECTS_KEY } from '../../../utils/constants';

const AssignTeacherDialog = ({ open, onClose, className, subject, onAssigned, title, description }) => {
  const { success, error: toastError } = useToast();
  const { items: teachers, loading } = useTeachers();
  
  // State
  const [role, setRole] = useState(subject ? 'subject' : 'class');
  const [teacherId, setTeacherId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState(subject ? [subject] : []);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [canMarkAttendance, setCanMarkAttendance] = useState(false);
  const [customSubjects, setCustomSubjects] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  
  const [submitting, setSubmitting] = useState(false);

  const allSubjects = useMemo(() => {
    const base = SUBJECTS.filter((s) => s.value !== OTHER_SUBJECT);
    return base.concat(customSubjects.map((name) => ({ value: name, label: name })));
  }, [customSubjects]);

  const toggleSubject = (value) => {
    setSelectedSubjects((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const toggleAllSubjects = () => {
    if (selectedSubjects.length === allSubjects.length) {
      setSelectedSubjects([]); // Deselect all
    } else {
      setSelectedSubjects(allSubjects.map(s => s.value)); // Select all
    }
  };

  const addCustomSubject = () => {
    const trimmed = customSubjectName.trim();
    if (!trimmed) return;
    if (customSubjects.includes(trimmed)) {
      if (!selectedSubjects.includes(trimmed)) setSelectedSubjects((prev) => [...prev, trimmed]);
      setCustomSubjectName('');
      return;
    }
    const next = [...customSubjects, trimmed];
    setCustomSubjects(next);
    try {
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(next));
    } catch {}
    setSelectedSubjects((prev) => [...prev, trimmed]);
    setCustomSubjectName('');
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setRole(subject ? 'subject' : 'class');
      setTeacherId('');
      setSelectedSubjects(subject ? [subject] : []);
      setCanMarkAttendance(false);
      setCustomSubjectName('');
    }
  }, [open, subject]);

  const isSubject = role === 'subject';
  const heading = title || (isSubject ? 'Assign a subject teacher' : 'Assign a class teacher');

  const onSubmit = async () => {
    if (!teacherId) {
      toastError('Pick a teacher first.');
      return;
    }
    setSubmitting(true);
    try {
      if (role === 'class') {
        const res = await assignClassTeacher(className, { teacherId });
        const name = teachers.find((t) => t.id === teacherId)?.name || 'The teacher';
        success(res?.classTeacher ? `${name} is now the class teacher.` : `${name} is now assigned.`);
      } else {
        if (!selectedSubjects.length) {
          toastError('Select at least one subject.');
          setSubmitting(false);
          return;
        }
        const name = teachers.find((t) => t.id === teacherId)?.name || 'The teacher';
        for (const subj of selectedSubjects) {
          await assignSubjectTeacher(className, subj, teacherId, canMarkAttendance);
        }
        success(`${name} is now assigned to ${selectedSubjects.length} subjects.`);
      }
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
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-xl bg-brand-700 px-6 py-2.5 text-[13px] font-extrabold text-white hover:bg-brand-800 disabled:opacity-50 transition-colors shadow-sm"
            disabled={submitting || !teacherId}
          >
            {submitting ? 'Saving…' : 'Confirm Assignment'}
          </button>
        </div>
      }
    >
      {/* Changed to lg:grid-cols-2 to prevent squishing on smaller screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── LEFT COLUMN: Roles & Teacher ── */}
        <div className="space-y-5 min-w-0">
          {/* Role Selector */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('class')}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg text-center transition-all ${
                  role === 'class' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-slate-200/50'
                }`}
              >
                <UserCheck className={`h-5 w-5 mb-1 ${role === 'class' ? 'text-brand-700' : 'text-slate-500'}`} />
                <span className={`text-[12px] font-extrabold ${role === 'class' ? 'text-brand-900' : 'text-slate-600'}`}>Class Teacher</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('subject')}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg text-center transition-all ${
                  role === 'subject' ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-slate-200/50'
                }`}
              >
                <BookOpen className={`h-5 w-5 mb-1 ${role === 'subject' ? 'text-brand-700' : 'text-slate-500'}`} />
                <span className={`text-[12px] font-extrabold ${role === 'subject' ? 'text-brand-900' : 'text-slate-600'}`}>Subject Teacher</span>
              </button>
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-500 text-center">
              {isSubject 
                ? 'Restricted access to selected subjects only.' 
                : 'Full administrative control over the class.'}
            </p>
          </div>

          {/* Teacher Dropdown */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Teacher
            </label>
            {loading ? (
              <SkeletonBlock className="h-11 w-full rounded-xl" />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="block w-full h-11 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700 appearance-none"
                >
                  <option value="" disabled>— Search for a teacher —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} {t.role === 'school_admin' ? ' (Admin)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Attendance Toggle (Only if Subject) */}
          {isSubject && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="pr-4">
                <p className="text-[13px] font-extrabold text-ink flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-brand-600" /> Attendance Duty
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Allow this teacher to mark daily attendance for this class.</p>
              </div>
              <button
                type="button"
                onClick={() => setCanMarkAttendance(!canMarkAttendance)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  canMarkAttendance ? 'bg-brand-700' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    canMarkAttendance ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Subjects ── */}
        {/* Added min-w-0 to prevent grid blowout */}
        <div className={`transition-opacity duration-300 min-w-0 ${isSubject ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Assign Subjects
            </label>
            {isSubject && (
              <button
                type="button"
                onClick={toggleAllSubjects}
                className="text-[11px] font-extrabold text-brand-700 hover:underline"
              >
                {selectedSubjects.length === allSubjects.length ? 'Clear All' : 'Select All'}
              </button>
            )}
          </div>
          
          {/* Changed to sm:grid-cols-2 to prevent tight squishing on small screens */}
          <div className="max-h-[260px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3">
            {allSubjects.map((s) => {
              const isChecked = selectedSubjects.includes(s.value);
              return (
                <label 
                  key={s.value} 
                  className={`flex items-center gap-2 p-2 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-colors min-w-0 ${
                    isChecked ? 'bg-brand-50 text-brand-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isChecked ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300'
                  }`}>
                    {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggleSubject(s.value)}
                  />
                  <span className="truncate">{s.label}</span>
                </label>
              );
            })}
          </div>

          {/* Custom Subject Input */}
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={customSubjectName}
              onChange={(e) => setCustomSubjectName(e.target.value)}
              placeholder="Add custom subject…"
              // Added min-w-0 so the input can shrink properly and not push the button off-screen
              className="flex-1 min-w-0 h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
            />
            <button
              type="button"
              onClick={addCustomSubject}
              // Added shrink-0 so the button never gets squished
              className="inline-flex shrink-0 h-9 items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 text-[12px] font-extrabold text-white hover:bg-slate-900"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>

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
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-brand-700 shadow-sm hover:bg-brand-50 transition-colors"
      >
        <UserCheck className="h-3.5 w-3.5" /> Assign teacher
      </button>
      <AssignTeacherDialog
        open={open}
        className={className}
        subject={undefined}
        onClose={() => setOpen(false)}
        title="Assign a teacher"
        description={`Choose a teacher and role for ${className}.`}
      />
    </>
  );
};

export default AssignTeacherDialog;