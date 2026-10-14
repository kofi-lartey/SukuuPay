/**
 * What the browser checks about a picture before it is sent anywhere.
 *
 * Pure, so it can be tested — and so the labels the teacher reads are decided
 * in one place rather than re-derived at each call site.
 *
 * ## Why check at all, when the server also checks
 *
 * Because the server's answer costs a round trip and the client's does not.
 * A teacher on the 3G connection that school WiFi often is would otherwise
 * upload 4 MB before being told the ceiling is 2 — and the message that comes
 * back is the server's, worded for a log line, about a file they picked three
 * seconds ago. Every rule here is enforced again server-side; this is the copy
 * that can say "choose a JPG, PNG or WebP under 2 MB" *before* the picker sends
 * anything, which is the only version of that sentence a person can act on.
 *
 * The two rule sets must agree, and the tests assert the numbers against the
 * backend's: `2 MB` is `avatarUpload`'s `limits.fileSize`, and the MIME list is
 * the shared `fileFilter`. If either changes, this file must change with it or
 * the client becomes the strict one — which presents as "invalid image" about a
 * picture the server would have accepted.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** The `accept` attribute for the file input — same list, no `image/*` catch-all. */
export const AVATAR_ACCEPT_ATTRIBUTE = 'image/jpeg,image/png,image/webp';

/**
 * A picture the uploader can act on, or a reason they cannot.
 *
 * @param {{ name?: string, type?: string, size?: number }} file a File from an
 *   `<input type="file">` — or anything shaped like one in a test.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export const validateAvatarFile = (file) => {
  if (!file) {
    return { ok: false, code: 'NO_FILE', message: 'Choose a picture first.' };
  }

  // `type` is the browser's claim about the bytes, and it is absent on some
  // Android browsers for files picked from a gallery. Falling back to the
  // extension keeps those from being refused outright, which would otherwise
  // be the single most common phone answering "invalid image" about a photo
  // that is perfectly fine.
  const type = file.type || guessTypeFromName(file.name);
  if (!AVATAR_ACCEPTED_TYPES.includes(type)) {
    return {
      ok: false,
      code: 'INVALID_TYPE',
      message: 'Choose a JPG, PNG or WebP picture.',
    };
  }

  if (typeof file.size === 'number' && file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: 'That picture is larger than 2 MB. Choose a smaller one.',
    };
  }

  if (file.size === 0) {
    // A zero-byte file is what a permissions-denied or interrupted pick leaves
    // behind. The server would reject it as a corrupt image, which is true but
    // reads as an accusation; "choose the picture again" is what actually helps.
    return { ok: false, code: 'EMPTY_FILE', message: 'That file is empty. Choose the picture again.' };
  }

  return { ok: true };
};

/**
 * The MIME type implied by a filename's extension.
 *
 * A fallback, never the primary check: an extension is part of the name, and a
 * name is attacker-controlled. The server re-derives the type from the bytes,
 * so this only widens which *local* files are worth trying.
 */
const guessTypeFromName = (name = '') => {
  const lower = String(name).toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return '';
};

/**
 * The initials shown when there is no picture.
 *
 * Up to two letters, from the first two words — the convention the rest of the
 * product uses. Re-exported from `parentFormat`'s idea rather than re-implemented
 * so that a one-word name in the parent portal and in a teacher's rail reads the
 * same way.
 */
export const initialsFor = (name = '') =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'T';
