import React, { useCallback, useMemo, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import { Field, SelectField } from '../common/FormField';
import { useToast } from '../../hooks/useToast';
import { ACADEMIC_TERMS } from '../../utils/constants';

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
  onImportFile,
  importing = false,
}) {
  const toast = useToast();
  const [days, setDays] = useState(initialDays);

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
      next[day] = [...(next[day] || []), initialPeriod(number)];
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
                  <Field
                    label="Start"
                    value={period.startTime}
                    disabled={!canEdit}
                    onChange={(e) => updatePeriod(day, index, 'startTime', e.target.value)}
                  />
                  <Field
                    label="End"
                    value={period.endTime}
                    disabled={!canEdit}
                    onChange={(e) => updatePeriod(day, index, 'endTime', e.target.value)}
                  />
                  <Field
                    label="Subject"
                    value={period.subject}
                    disabled={!canEdit}
                    onChange={(e) => updatePeriod(day, index, 'subject', e.target.value)}
                  />
                  <Field
                    label="Teacher"
                    value={period.teacher || teacherName}
                    disabled={!canEdit}
                    onChange={(e) => updatePeriod(day, index, 'teacher', e.target.value)}
                  />
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
              onChange={onImportFile}
            />
            {importing ? 'Importing…' : 'Import CSV/Excel'}
          </label>
        )}
        {canEdit && onSaveDraft && (
          <Button disabled={!hasPeriods || saving} onClick={handleSaveDraft}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        )}
      </div>
    </div>
  );
}
