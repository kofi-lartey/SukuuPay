import React, { useState } from 'react';

/**
 * A profile picture with an initials fallback.
 *
 * ## Why the fallback is inside the component
 *
 * "Show the photo if there is one, otherwise initials" is a decision every avatar
 * in the product has to make, and it was being made in a different way in each
 * place: the feed card rendered initials only, the comment thread rendered initials
 * only, and nothing handled a URL that 404s. Centralising it means the broken-image
 * case is handled once — `onError` flips to initials, so a deleted Cloudinary asset
 * degrades to initials instead of a broken-image icon.
 *
 * ## Why initials come from the name
 *
 * `Student` stores `studentName`, `firstName` and `lastName`; `User` stores `name`.
 * Callers pass whichever display name they already have, so this does not need to
 * know which collection it is looking at.
 *
 * ## Why `alt` is the name, not empty
 *
 * A profile picture is the only visual identification of the author in the card
 * header. Marking it decorative would leave a screen-reader user with an avatar and
 * no name attached to it, unless the name happens to be adjacent in the reading
 * order — which it is not in every layout.
 */

const SIZES = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-[11px]',
  lg: 'h-11 w-11 text-[13px]',
};

/** Two letters from a display name, ignoring titles and punctuation. */
export const initialsFor = (name) => {
  const parts = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Avatar = ({ name, src, size = 'sm', className = '' }) => {
  // Reset when the source changes: a new author on a recycled component should
  // get a fresh attempt at their photo, not inherit a previous failure.
  const [failedSrc, setFailedSrc] = useState(null);

  const showImage = Boolean(src) && failedSrc !== src;
  const sizeClass = SIZES[size] || SIZES.sm;

  if (showImage) {
    return (
      <img
        src={src}
        alt={name || 'Profile picture'}
        loading="lazy"
        onError={() => setFailedSrc(src)}
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 font-extrabold uppercase text-white ${sizeClass} ${className}`}
    >
      {initialsFor(name)}
    </span>
  );
};

export default Avatar;