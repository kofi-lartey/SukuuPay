import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import TimeField from '../common/TimeField';
import TimetablePreview from './TimetablePreview';
import { Field, SelectField } from '../common/FormField';
import Modal from '../common/Modal';
import { useToast } from '../../hooks/useToast';
import { listUsers } from '../../services/user';
import {
  ACADEMIC_TERMS,
  SUBJECTS,
  OTHER_SUBJECT,
  CUSTOM_SUBJECTS_KEY,
} from '../../utils/constants';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const emptyDays = () =>
  DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

const initialPeriod = (number) => ({
  period: number,
  startTime: '',
  endTime: '',
  subject: '',
  teacher: '',
  room: '',
});

/**
 * A shared grid editor for a class timetable.
 *
 * Manages its own `days` state and exposes `onSaveDraft` so the surrounding
 * page owns the API call. Buttons are gated by `status` and `editable`: a
 * submitted/approved/published timetable cannot be edited, only viewed.
 */
export default function TimetableGridEditor({
  initialDays = emptyDays(),
  className = '',
  term = '',
  academicYear = '',
  teacherName = '',
  status = 'draft',
  editable = true,
  saving = false,
  onSaveDraft,
  showImport = false,
  allowedSubjects = null,
  onImportFile,
  importing = false,
}) {
  const toast = useToast();
  const [days, setDays] = useState(initialDays);

  const loadCustomSubjects = () => {
    try {
      const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [customSubjects, setCustomSubjects] = useState(loadCustomSubjects);
  const [schoolTeachers, setSchoolTeachers] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listUsers({ role: 'teacher', limit: 100 })
      .then((result) => {
        if (!active) return;
        const users = Array.isArray(result?.users) ? result.users : [];
        setSchoolTeachers(
          users.map((u) => ({
            value: u.name || u.email || '',
            label: u.name || u.email || '',
          }))
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [subjectManagerOpen, setSubjectManagerOpen] = useState(false);
  const [editingCustomSubject, setEditingCustomSubject] = useState(null);
  const [customSubjectName, setCustomSubjectName] = useState('');

  const saveCustomSubjects = (next) => {
    setCustomSubjects(next);
    try {
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(next));
    } catch {}
  };

  const allSubjectOptions = useMemo(() => {
    if (allowedSubjects && allowedSubjects.length) {
      return allowedSubjects.map((name) => ({ value: name, label: name }));
    }
    return SUBJECTS.filter((s) => s.value !== OTHER_SUBJECT).concat(
      customSubjects.map((name) => ({ value: name, label: name }))
    );
  }, [allowedSubjects, customSubjects]);


  const handleAddCustomSubject = () => {
    const trimmed = customSubjectName.trim();
    if (!trimmed) return;
    if (customSubjects.includes(trimmed)) {
      setCustomSubjectName('');
      return;
    }
    const next = [...customSubjects, trimmed];
    saveCustomSubjects(next);
    setCustomSubjectName('');
    setEditingCustomSubject(null);
  };

  const handleEditCustomSubject = (original, nextName) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === original) return;
    const next = customSubjects.map((name) =>
      name === original ? trimmed : name
    );
    saveCustomSubjects(next);
    // Re-point any periods using the old name at the new one.
    setDays((current) => {
      const updated = { ...current };
      for (const day of DAYS) {
        updated[day] = (updated[day] || []).map((period) =>
          period.subject === original
            ? { ...period, subject: trimmed }
            : period
        );
      }
      return updated;
    });
    setEditingCustomSubject(null);
    setCustomSubjectName('');
  };

  const handleDeleteCustomSubject = (name) => {
    if (!window.confirm(`Remove “${name}” from the subject list?`)) return;
    const next = customSubjects.filter((n) => n !== name);
    saveCustomSubjects(next);
    setDays((current) => {
      const updated = { ...current };
      for (const day of DAYS) {
        updated[day] = (updated[day] || []).map((period) =>
          period.subject === name ? { ...period, subject: '' } : period
        );
      }
      return updated;
    });
    if (editingCustomSubject === name) setEditingCustomSubject(null);
  };

  const updatePeriod = (day, index, field, value) => {
    setDays((current) => {
      const next = { ...current };
      next[day] = next[day].map((period, i) =>
        i === index ? { ...period, [field]: value } : period
      );
      return next;
    });
  };

  const addPeriod = (day) => {
    setDays((current) => {
      const next = { ...current };
      const number = (next[day].length || 0) + 1;
      next[day] = [...(next[day] || []), { ...initialPeriod(number), teacher: teacherName }];
      return next;
    });
  };

  const removePeriod = (day, index) => {
    setDays((current) => {
      const next = { ...current };
      next[day] = next[day].filter((_, i) => i !== index);
      return next;
    });
  };

  const hasPeriods = useMemo(
    () => DAYS.some((day) => (days[day] || []).length > 0),
    [days]
  );

  const canEdit = editable && status === 'draft' && !saving;

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    try {
      await onSaveDraft(days);
      toast.success('Timetable saved as draft.');
    } catch (error) {
      toast.error(error?.message || 'Could not save the timetable.');
    }
  };

  return (
    <div className="space-y-4">
      {DAYS.map((day) => (
        <Card key={day} className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-extrabold text-ink">{day}</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() => addPeriod(day)}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-[12px] font-bold text-white"
                aria-label={`Add a ${day} period`}
              >
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Add period
              </button>
            )}
          </div>
          {(days[day] || []).length === 0 ? (
            <p className="text-[12.5px] italic text-slate-400">No periods</p>
          ) : (
            <div className="space-y-2">
              {(days[day] || []).map((period, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-6"
                >
                  <Field
                    label="Period"
                    type="number"
                    value={period.period}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updatePeriod(day, index, 'period', Number(e.target.value))
                    }
                  />
                  <TimeField
                    label="Start"
                    value={period.startTime}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updatePeriod(day, index, 'startTime', e.target.value)
                    }
                  />
                  <TimeField
                    label="End"
                    value={period.endTime}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updatePeriod(day, index, 'endTime', e.target.value)
                    }
                  />
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <SelectField
                      label="Subject"
                      value={period.subject}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updatePeriod(day, index, 'subject', e.target.value)
                      }
                    >
                      <option value="">Select a subject</option>
                      {allSubjectOptions.map((subject) => (
                        <option
                          key={subject.value}
                          value={subject.value}
                        >
                          {subject.label}
                        </option>
                      ))}
                    </SelectField>
                    {canEdit && !allowedSubjects?.length && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSubjectManagerOpen(true);
                          setEditingCustomSubject(null);
                          setCustomSubjectName('');
                        }}
                      >
                        Manage subjects
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <SelectField
                      label="Teacher"
                      value={
                        schoolTeachers.some((t) => t.value === (period.teacher || teacherName)) ||
                        (teacherName && (period.teacher || '') === teacherName)
                          ? (period.teacher || teacherName || '')
                          : (period.teacher || '') !== ''
                          ? 'Other…'
                          : ''
                      }
                      disabled={!canEdit}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Other…') {
                          updatePeriod(day, index, 'teacher', '');
                        } else {
                          updatePeriod(day, index, 'teacher', val);
                        }
                      }}
                    >
                      <option value="">Select a teacher</option>
                      {schoolTeachers.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                      {teacherName &&
                        !schoolTeachers.some((t) => t.value === teacherName) && (
                          <option value={teacherName}>{teacherName}</option>
                        )}
                      <option value="Other…">Other…</option>
                    </SelectField>
                    {canEdit &&
                      (period.teacher || teacherName || '') !== '' &&
                      !schoolTeachers.some(
                        (t) => t.value === (period.teacher || teacherName)
                      ) &&
                      period.teacher !== teacherName && (
                        <Field
                          label="Teacher name"
                          value={period.teacher || ''}
                          disabled={!canEdit}
                          placeholder="Enter teacher name"
                          onChange={(e) =>
                            updatePeriod(day, index, 'teacher', e.target.value)
                          }
                        />
                      )}
                  </div>
                  <div className="flex items-end gap-2">
                    <Field
                      label="Room"
                      value={period.room}
                      disabled={!canEdit}
                      onChange={(e) => updatePeriod(day, index, 'room', e.target.value)}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removePeriod(day, index)}
                        className="mb-0.5 rounded-lg border border-red-200 px-2 py-2 text-[12px] font-bold text-red-600"
                        aria-label="Remove period"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      <div className="flex flex-wrap gap-3 items-end">
        {showImport && (
          <label
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              disabled={importing || !className || !term || !academicYear}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile?.(file);
                e.target.value = '';
              }}
            />
            {importing ? 'Importing…' : 'Import CSV/Excel'}
          </label>
        )}
        {hasPeriods && (
          <Button variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
        )}
        {canEdit && onSaveDraft && (
          <Button disabled={!hasPeriods || saving} onClick={handleSaveDraft}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        )}
      </div>

      <TimetablePreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        days={days}
        className={className}
        term={term}
        academicYear={academicYear}
      />

      <Modal
        open={subjectManagerOpen}
        onClose={() => setSubjectManagerOpen(false)}
        title="Manage subjects"
        description="Add, rename or remove custom subjects. Pre-populated subjects cannot be removed."
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Field
              label="New subject"
              value={customSubjectName}
              onChange={(e) => setCustomSubjectName(e.target.value)}
              placeholder="e.g. Mandarin"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={!customSubjectName.trim()}
              onClick={handleAddCustomSubject}
            >
              Add
            </Button>
          </div>
          {customSubjects.length === 0 ? (
            <p className="text-[12.5px] italic text-slate-400">
              No custom subjects yet.
            </p>
          ) : (
            <div className="space-y-2">
              {customSubjects.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-2"
                >
                  {editingCustomSubject === name ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Field
                        label=""
                        value={customSubjectName}
                        onChange={(e) => setCustomSubjectName(e.target.value)}
                        placeholder="Subject name"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!customSubjectName.trim()}
                        onClick={() =>
                          handleEditCustomSubject(name, customSubjectName)
                        }
                      >
                        Save
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingCustomSubject(null);
                          setCustomSubjectName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-[13px] text-ink">{name}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingCustomSubject(name);
                          setCustomSubjectName(name);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteCustomSubject(name)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
