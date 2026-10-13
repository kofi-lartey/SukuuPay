import { Link } from 'react-router-dom';
import { initialsOf } from '../../../utils/parentFormat';

/**
 * The student context row every portal page opens with.
 *
 * One component because the row is the answer to "whose child am I looking at"
 * and a parent must never have to work that out from a heading — especially on
 * a shared handset, where the last tab open was somebody else's ward. The name
 * is the largest text in it, the class sits beside it in a pill, and the school
 * is quiet underneath.
 *
 * `trailing` is a slot rather than a fixed action because the pages want
 * different things there — the swap icon on Home, the term filter on the
 * academic pages — and a per-page variant prop would have grown into six.
 */
const StudentRow = ({ student, school, backHref, trailing, className = '' }) => {
  const name = student?.studentName || 'Student';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {backHref ? (
        <Link
          to={backHref}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : null}

      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[14px] font-extrabold text-[#0A5C36] ring-1 ring-inset ring-emerald-200"
      >
        {initialsOf(name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-slate-900">
            {name}
          </p>
          {student?.studentClass ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-[3px] text-[10.5px] font-extrabold uppercase tracking-wide text-[#0A5C36]">
              {student.studentClass}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[11.5px] font-medium text-slate-500">
          {student?.academicYear
            ? `${school?.name || 'School'} · ${student.academicYear}`
            : school?.name || ''}
        </p>
      </div>

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
};

export default StudentRow;
