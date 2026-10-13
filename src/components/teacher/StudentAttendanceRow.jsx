import { MapPin } from 'lucide-react';
import AttendanceToggle from './AttendanceToggle';

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    // A malformed timestamp is a data problem, not a crash. The mark still shows.
    return '';
  }
};

/**
 * One student in the attendance register.
 *
 * The third line — "Marked at 08:12" / "Auto-marked at 07:45" — is the
 * difference between a teacher trusting the register and re-checking it. It is
 * also what settles the argument a late arrival causes: whether the teacher
 * marked the student late by hand or the system marked them present before
 * anyone saw them.
 *
 * The avatar is the `initials` the roster already carries. The `?.slice`
 * fallback covers a roster field that has not been populated — an initial-less
 * row still reads as a row, not as a broken one.
 */
const StudentAttendanceRow = ({ student, mark, onChange, disabled }) => (
  <li className="flex items-center gap-2 border-b border-slate-100 py-3 last:border-b-0">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-extrabold text-slate-600">
      {student.initials || student.studentName?.slice(0, 2).toUpperCase() || '?'}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13.5px] font-extrabold text-ink">{student.studentName}</p>
      <p className="truncate text-[11.5px] text-slate-500">{student.studentId}</p>
      {mark?.status && mark?.arrivalTime ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-400">
          <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
          {mark.autoMarked ? 'Auto-marked' : 'Marked'} at {formatTime(mark.arrivalTime)}
        </p>
      ) : null}
    </div>
    <AttendanceToggle value={mark?.status} onChange={onChange} disabled={disabled} />
  </li>
);

export default StudentAttendanceRow;
