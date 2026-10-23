import React from 'react';
import { Clock, MapPin, CheckCircle2 } from 'lucide-react';

/**
 * The teacher's "accept this period" prompt.
 *
 * Renders only while a period is ongoing and the teacher has not yet accepted
 * it. Whether the teacher has already accepted is read from the schedule's
 * `period.status` (`present` or `late`), which the server derives from the
 * `TeacherAttendance` row written when the teacher tapped "Accept Class" —
 * so a reload does not resurrect the prompt.
 */
export const CurrentPeriodWidget = ({ period, onAccept }) => {
  if (!period) return null;

  if (period.status === 'present' || period.status === 'late') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        <div>
          <p className="font-bold text-emerald-900">You are marked {period.status}</p>
          <p className="text-sm text-emerald-700">{period.subject} · {period.className}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-extrabold text-amber-900 uppercase">Class starting now</p>
          <p className="font-bold text-ink">{period.className} · {period.subject}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {period.room || 'No room set'} · {period.startTime}
          </p>
        </div>
      </div>
      <button
        onClick={onAccept}
        className="w-full sm:w-auto rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-800"
      >
        Accept Class
      </button>
    </div>
  );
};

export default CurrentPeriodWidget;