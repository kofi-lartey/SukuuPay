import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Clock, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { useToast } from '../../../hooks/useToast';
import {
  listClasses,
  getTimetable,
  listTeacherAttendance,
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

const STATUS_LABEL = {
  upcoming: 'Upcoming',
  accepted: 'Accepted',
  late: 'Late',
  missed: 'Missed',
};

const STATUS_TONE = {
  upcoming: 'bg-slate-100 text-slate-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  late: 'bg-amber-100 text-amber-700',
  missed: 'bg-rose-100 text-rose-700',
};

const parsePeriodTime = (text) => {
  if (!text) return null;
  const match = String(text)
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = match[3];
  if (suffix === 'pm' && hours < 12) hours += 12;
  if (suffix === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const accraNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return { weekday, minuteOfDay: hour * 60 + minute };
};

const TeacherAttendance = () => {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timetable, setTimetable] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState(ACADEMIC_TERMS[0]);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear());

  const { weekday, minuteOfDay } = accraNow();
  const todayIndex = DAYS.indexOf(weekday);

  const loadClasses = async () => {
    try {
      const result = await listClasses();
        setClasses(result?.classes || []);
    } catch {
      setClasses([]);
    }
  };

  const loadData = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const [ttResult, attResult] = await Promise.all([
        getTimetable(selectedClass, { term, academicYear }),
        listTeacherAttendance({ className: selectedClass }),
      ]);
      setTimetable(ttResult || null);
      setAttendance(Array.isArray(attResult?.records) ? attResult.records : []);
    } catch (error) {
      toast.error(error?.message || 'Could not load attendance data.');
      setTimetable(null);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedClass, term, academicYear]);

  // Build attendance lookup keyed by teacherId|periodNumber
  const attendanceByPeriod = useMemo(() => {
    const map = new Map();
    for (const row of attendance) {
      map.set(`${String(row.teacherId)}|${row.periodNumber}`, row);
    }
    return map;
  }, [attendance]);

  // Determine status for a period
  const periodStatus = (period) => {
    const start = parsePeriodTime(period.startTime);
    const end = parsePeriodTime(period.endTime);
    if (start == null || end == null) return 'upcoming';

    const record = attendanceByPeriod.get(
      `${String(period.teacherId)}|${period.period}`
    );

    if (record) {
      if (record.status === 'missed') return 'missed';
      if (record.status === 'late') return 'late';
      return 'accepted';
    }

    if (minuteOfDay < start) return 'upcoming';
    if (minuteOfDay >= start && minuteOfDay <= end) return 'upcoming';
    return 'missed';
  };

  // Get today's periods across all timetables for the selected class
  const todayPeriods = useMemo(() => {
    if (!timetable || todayIndex < 0) return [];
    const dayKey = DAYS[todayIndex];
    return (timetable.days?.[dayKey] || []).map((period) => ({
      ...period,
      status: periodStatus(period),
    }));
  }, [timetable, todayIndex, attendanceByPeriod, minuteOfDay]);

  // KPI counts
  const kpis = useMemo(() => {
    const counts = { upcoming: 0, accepted: 0, late: 0, missed: 0 };
    for (const p of todayPeriods) {
      counts[p.status] += 1;
    }
    return counts;
  }, [todayPeriods]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Academics"
          title="Teacher Attendance"
          description="Monitor teacher presence during scheduled periods."
        />
        <div className="flex min-h-[400px] items-center justify-center">
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Academics"
        title="Teacher Attendance"
        description="Monitor teacher presence during scheduled periods. Status updates in real time as teachers accept classes."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Scheduled Today
              </p>
              <p className="text-[20px] font-extrabold text-ink">
                {todayPeriods.length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                Accepted
              </p>
              <p className="text-[20px] font-extrabold text-ink">
                {kpis.accepted}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
                Late
              </p>
              <p className="text-[20px] font-extrabold text-ink">
                {kpis.late}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-rose-100 text-rose-700">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
                Missed
              </p>
              <p className="text-[20px] font-extrabold text-ink">
                {kpis.missed}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-700">Class</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
        >
          <option value="">— select a class —</option>
          {classes.map((c) => (
            <option key={c.className} value={c.className}>
              {c.className}
            </option>
          ))}
        </select>
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          disabled={!selectedClass}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
        >
          {ACADEMIC_TERMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          disabled={!selectedClass}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink"
          placeholder="2026/2027"
        >
          <option value={defaultAcademicYear()}>{defaultAcademicYear()}</option>
        </select>
      </div>

      {!selectedClass ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Select a class to view today's teacher attendance.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">Period</th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">Time</th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">Subject</th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500">Teacher</th>
                <th className="pb-3 text-[12.5px] font-semibold text-slate-500 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayPeriods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No scheduled periods for {DAYS[todayIndex] || 'today'}.
                  </td>
                </tr>
              ) : (
                todayPeriods.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 text-[13px] font-semibold text-ink">
                      {p.period}
                    </td>
                    <td className="py-3 text-[12.5px] text-slate-600">
                      {p.startTime} – {p.endTime}
                    </td>
                    <td className="py-3 text-[13px] text-slate-700">
                      {p.subject}
                    </td>
                    <td className="py-3 text-[13px] font-medium text-ink">
                      {p.teacher || 'Not assigned'}
                    </td>
                    <td className="py-3 text-right">
                      <Badge tone={STATUS_TONE[p.status] || ''} className="bg-[inherit]">
                        {STATUS_LABEL[p.status] || p.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default TeacherAttendance;
