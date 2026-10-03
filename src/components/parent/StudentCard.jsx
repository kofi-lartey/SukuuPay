import { useState } from 'react';
import { Card, Pill } from './primitives';
import { initialsOf } from '../../utils/parentFormat';

/**
 * Who this page is about.
 *
 * The single most important thing on it. A pay link is forwarded into family groups
 * and read aloud across rooms, so the first question on every render is "is this my
 * child?" and the name has to answer it before anything else does.
 *
 * ## On the photo
 *
 * `studentImage` is a Cloudinary URL on a 3G connection, so it is lazy, sized, and
 * `decoding="async"` — an unsized full-resolution school photo is a 400KB download
 * for a 64px circle, which on a metered bundle is real money and a visible delay on
 * the one element that has to appear first.
 *
 * The initials fallback is not an error state. Many students have no photo on file,
 * and a grey silhouette or a broken-image icon above the name reads as a broken page.
 * Two letters on a brand background reads as a deliberate avatar and still answers
 * the identifying question.
 */
const StudentCard = ({ student, suspended = false }) => {
  const [photoFailed, setPhotoFailed] = useState(false);

  if (!student) return null;

  const name = student.studentName || 'Student';

  return (
    <>
      <Card className="flex items-center gap-3.5 p-4">
        <div className="relative h-16 w-16 shrink-0">
          {student.studentImage && !photoFailed ? (
            <img
              src={student.studentImage}
              alt=""
              loading="lazy"
              decoding="async"
              width={64}
              height={64}
              onError={() => setPhotoFailed(true)}
              className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-slate-200"
            />
          ) : (
            <div
              // The name is already the `h1` below, so this is decorative rather
              // than a second thing to announce.
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[20px] font-extrabold text-[#0A5C36] ring-1 ring-emerald-200"
            >
              {initialsOf(name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-extrabold leading-tight tracking-tight text-slate-900">
            {name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
            {student.studentClass ? (
              <span className="font-semibold text-slate-700">{student.studentClass}</span>
            ) : null}
            {student.studentClass && student.studentId ? (
              <span aria-hidden="true" className="text-slate-300">
                &middot;
              </span>
            ) : null}
            {student.studentId ? <span className="tabular-nums">{student.studentId}</span> : null}
          </div>

          {student.primaryParent?.phoneMasked ? (
            <p className="mt-1 truncate text-[12px] text-slate-400">
              Guardian: {student.primaryParent.parentName}
              {student.primaryParent.relationship
                ? ` (${student.primaryParent.relationship})`
                : ''}{' '}
              &middot; {student.primaryParent.phoneMasked}
            </p>
          ) : null}
        </div>

        {suspended ? (
          <Pill tone="amber" className="shrink-0 self-start">
            Suspended
          </Pill>
        ) : null}
      </Card>

      {suspended ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 ring-1 ring-inset ring-amber-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-[14px] font-medium leading-relaxed text-amber-900">
            This account is currently suspended. Please contact the school.
          </p>
        </div>
      ) : null}
    </>
  );
};

export default StudentCard;