import { Link } from 'react-router-dom';
import { CalendarCheck, ClipboardList, FileText, Users, ArrowRight, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTeacherDashboard, useMySchedule } from '../../hooks/teacher/useDashboard';
import { useMyClasses } from '../../hooks/teacher/useMyClasses';
import { TEACHER_ROUTES } from '../../utils/constants';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';

const QUICK_ACTIONS = [
  { key: 'attendance', label: 'Take Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
  { key: 'grades', label: 'Enter Grades', to: TEACHER_ROUTES.grades, icon: ClipboardList },
  { key: 'records', label: 'Reports', to: TEACHER_ROUTES.records, icon: FileText },
  { key: 'classes', label: 'My Classes', to: TEACHER_ROUTES.classes, icon: Users },
];

const periodStatusTone = (status) => {
  if (status === 'marked') return 'bg-emerald-100 text-emerald-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

/**
 * The teacher's landing screen.
 *
 * Ordered by what a teacher opens the app to do, in frequency: what is left
 * undone today, then today's timetable, then their classes. The greeting is
 * the only thing personalised, and it is deliberately time-aware rather than a
 * static "Welcome back" — a teacher opening this at 07:00 and one opening it
 * at 19:00 are in different states of the working day.
 *
 * Three queries, all sharing the cache with the pages they lead to, so tapping
 * "Take Attendance" does not refetch anything the dashboard already holds.
 */
const TeacherDashboard = () => {
  const { user } = useAuth();
  const { data, isLoading } = useTeacherDashboard();
  const { data: schedule, isLoading: scheduleLoading } = useMySchedule();
  const { data: classes, isLoading: classesLoading } = useMyClasses();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const classCount = data?.classCount || classes?.length || 0;
  const pendingAttendance = data?.pendingAttendance || 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="rounded-2xl border border-sky-200/60 bg-sky-50 p-4">
        <p className="text-[17px] font-extrabold tracking-tight text-sky-900">
          {greeting}, {user?.name?.split(' ')[0] || 'Teacher'}
        </p>
        <p className="mt-1 text-[13px] font-semibold text-sky-800/80">
          {classCount} classes today · {pendingAttendance} attendance pending
        </p>
      </div>

      {/* Quick actions */}
      <section>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.key}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-center transition-colors hover:border-sky-200 hover:bg-sky-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <action.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-extrabold leading-tight text-slate-700">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* My classes — the same cached query the attendance and grades pickers use,
          so a teacher opening the portal sees their classes before they need them. */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-extrabold text-ink">My classes</h2>
          <Link to={TEACHER_ROUTES.classes} className="py-2 text-[11.5px] font-extrabold text-sky-700 hover:underline">
            View all
          </Link>
        </div>

        {classesLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard className="mt-2" />
          </>
        ) : !classes?.length ? (
          <EmptyState
            icon={Users}
            title="No classes assigned yet"
            description="Your school administrator will assign your classes. Check back soon."
          />
        ) : (
          <ul className="space-y-2">
            {classes.slice(0, 4).map((c) => (
              <li key={c.className}>
                <Link
                  to={TEACHER_ROUTES.classDetail(c.className)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition-colors hover:border-sky-200 hover:bg-sky-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-extrabold text-ink">{c.className}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
                      {c.subject || 'Class teacher'} · {c.studentCount} students
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's schedule */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-extrabold text-ink">Today&rsquo;s schedule</h2>
          <Link to={TEACHER_ROUTES.schedule} className="py-2 text-[11.5px] font-extrabold text-sky-700 hover:underline">
            View all
          </Link>
        </div>

        {scheduleLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard className="mt-2" />
          </>
        ) : !schedule?.length ? (
          <EmptyState
            icon={Clock}
            title="No classes today"
            description="Enjoy the day off. Your schedule for the week is available under Schedule."
          />
        ) : (
          <ul className="space-y-2">
            {schedule.slice(0, 4).map((period) => (
              <li
                key={`${period.className}-${period.subject}-${period.startTime}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-extrabold text-ink">
                    {period.className} · {period.subject}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-slate-500">
                    {period.startTime} – {period.endTime}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase ${periodStatusTone(period.status)}`}>
                  {period.status}
                </span>
                {period.status === 'pending' ? (
                  <Link
                    to={TEACHER_ROUTES.attendanceFor(period.className)}
                    className="flex min-h-[44px] shrink-0 items-center px-2 text-[11.5px] font-extrabold text-sky-700 hover:underline"
                  >
                    Mark
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending work */}
      {data?.pending?.length ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-amber-800">
            Pending work
          </p>
          <ul className="mt-2 space-y-2">
            {data.pending.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-[13px] text-amber-900">
                <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <Link to={item.to} className="hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

export default TeacherDashboard;
