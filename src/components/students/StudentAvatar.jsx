import React, { useState } from 'react';

/**
 * The one place a student's photo is rendered.
 *
 * `Student.studentImage` has existed on the model since the beginning, been
 * accepted by the create and update schemas, and been rendered by the ID card
 * PDF — but until now nothing in the app ever *collected* it or *displayed* it.
 * Every surface that wanted an identity signal invented its own, which is how a
 * roster that shows coloured initials, a drawer with no photo at all, and a
 * printed card with a face all end up disagreeing about the same student.
 *
 * So this component owns both halves of the fallback: the photo when there is
 * one, and a deterministic monogram when there is not. Centralising it means a
 * student without a photo looks the same everywhere, and adding a photo
 * upgrades every surface at once with no second edit.
 *
 * **The tone is hashed from the student, not from the row index.** The roster
 * previously picked a colour by array position, which meant the same child
 * changed colour when the list was sorted or filtered — two rows in the same
 * view showing the same name in different colours. Hashing the id means the
 * colour is a property of the student.
 */

/** Tailwind-safe tones. Static strings so the JIT can see them — never built
 *  by interpolation, which would not survive a production build. */
const TONES = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

const SIZES = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-[11px]',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

/** First letters of the first two words: "Kwame Mensah" → "KM". */
export const initialsOf = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/** Stable per-student tone. Falls back to the name when there is no id. */
const toneFor = (student) => {
  const key = String(student?._id || student?.id || student?.studentName || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length];
};

const StudentAvatar = ({ student, size = 'md', className = '', decorative = true }) => {
  const [failed, setFailed] = useState(false);
  const image = student?.studentImage;
  const showImage = Boolean(image) && !failed;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold ${
        SIZES[size] || SIZES.md
      } ${showImage ? 'bg-slate-100' : toneFor(student)} ${className}`}
      // An avatar beside the student's name is decoration — a screen reader
      // already has the name. A standalone avatar (the print studio's card
      // picker) is meaningful, so `decorative` turns this off deliberately
      // rather than by omission.
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : student?.studentName || 'Student'}
    >
      {showImage ? (
        <img
          src={image}
          alt=""
          // `onError` rather than a server-side check: a Cloudinary URL that
          // has been deleted or renamed is the common case, and without this
          // the browser renders a broken-image icon in the middle of a roster
          // row. Falling back to the monogram is always better.
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        initialsOf(student?.studentName) || '?'
      )}
    </span>
  );
};

export default StudentAvatar;
