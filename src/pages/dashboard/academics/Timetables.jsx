import React, { useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import { Field, SelectField } from '../../../components/common/FormField';
import EmptyState from '../../../components/parent/shared/EmptyState';
import { useToast } from '../../../hooks/useToast';
import { listClasses } from '../../../services/admin/academic';
import {
  getTimetable,
  saveTimetable,
  publishTimetable,
} from '../../../services/admin/academic';
import { ACADEMIC_TERMS } from '../../../utils/constants';

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

const Timetables = () => {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState('');
  const [term, setTerm] = useState(ACADEMIC_TERMS[0]);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());
  const [days, setDays] = useState(emptyDays());
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
      } else {
        setDays(emptyDays());
        setStatus('draft');
      }
    } catch {
      setDays(emptyDays());
      setStatus('draft');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (className && term && academicYear) {
      loadTimetable();
    }
  }, [className, term, academicYear]);

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
      next[day] = [...next[day], { period: number, startTime: '', endTime: '', subject: '', teacher: '', room: '' }];
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

  const buildPayload = (nextStatus) => ({
    className,
    term,
    academicYear,
    status: nextStatus,
    days,
  });

  const onSaveDraft = async () => {
    setSaving(true);
    try {
      const result = await saveTimetable(buildPayload('draft'));
      if (result) {
        setDays({ ...emptyDays(), ...(result.days || {}) });
        setStatus(result.status || 'draft');
      }
      toast.success('Timetable saved as draft.');
    } catch (error) {
      toast.error(error?.message || 'Could not save the timetable.');
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      // Save first so the published grid matches what is on screen.
      await saveTimetable(buildPayload('draft'));
      const result = await publishTimetable({ className, term, academicYear });
      if (result) {
        setDays({ ...emptyDays(), ...(result.days || {}) });
        setStatus(result.status || 'published');
      }
      toast.success('Timetable published.');
    } catch (error) {
      toast.error(error?.message || 'Could not publish the timetable.');
    } finally {
      setPublishing(false);
    }
  };

  const hasPeriods = useMemo(
    () => DAYS.some((day) => (days[day] || []).length > 0),
    [days]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academics"
        title="Timetable Management"
        description="Build and publish a class timetable. Teachers and parents read the published version."
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
              <option key={value} value={value}>
                {value}
              </option>
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
          Status: {status}
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
          {DAYS.map((day) => (
            <Card key={day} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-extrabold text-ink">{day}</h3>
                <button
                  type="button"
                  onClick={() => addPeriod(day)}
                  className="rounded-lg bg-brand-700 px-3 py-1.5 text-[12px] font-bold text-white"
                >
                  Add period
                </button>
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
                        onChange={(e) => updatePeriod(day, index, 'period', Number(e.target.value))}
                      />
                      <Field
                        label="Start"
                        value={period.startTime}
                        onChange={(e) => updatePeriod(day, index, 'startTime', e.target.value)}
                      />
                      <Field
                        label="End"
                        value={period.endTime}
                        onChange={(e) => updatePeriod(day, index, 'endTime', e.target.value)}
                      />
                      <Field
                        label="Subject"
                        value={period.subject}
                        onChange={(e) => updatePeriod(day, index, 'subject', e.target.value)}
                      />
                      <Field
                        label="Teacher"
                        value={period.teacher}
                        onChange={(e) => updatePeriod(day, index, 'teacher', e.target.value)}
                      />
                      <div className="flex items-end gap-2">
                        <Field
                          label="Room"
                          value={period.room}
                          onChange={(e) => updatePeriod(day, index, 'room', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removePeriod(day, index)}
                          className="mb-0.5 rounded-lg border border-red-200 px-2 py-2 text-[12px] font-bold text-red-600"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !hasPeriods}
              onClick={onSaveDraft}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              disabled={publishing || !hasPeriods}
              onClick={onPublish}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetables;