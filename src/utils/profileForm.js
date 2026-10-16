/**
 * The rules a teacher's own details are checked against before saving.
 *
 * Transcribed from `updateUserSchema` in `Backend/src/validators/userValidators.js`
 * — the same numbers, because two copies of one rule that drift is worse than
 * one copy that has to be looked up: the client would either reject a name the
 * server would have accepted, or accept one and show a server error next to a
 * field the teacher just filled in.
 *
 * The server remains the authority. This is the copy that can say "what is your
 * name?" *beside the field*, while the teacher is still typing in it, rather
 * than in a toast after a round trip.
 */

/** `name: min(2) max(100)`, trimmed. */
export const validateNameField = (value) => {
  const name = String(value ?? '').trim();
  if (!name) return 'Your name is required.';
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > 100) return 'Use at most 100 characters.';
  return null;
};

/** `position: max(80)`, optional, and blank means "no position". */
export const validatePositionField = (value) => {
  const position = String(value ?? '').trim();
  if (position.length > 80) return 'Use at most 80 characters.';
  return null;
};

/**
 * `phone: min(7) max(20)`, optional — and the server accepts `+` and spaces,
 * because Ghanaian numbers are written `0244 123 4567` by everyone who knows
 * them, and a form that refuses to type a phone the way it is written teaches
 * the user that the form is wrong.
 */
export const validatePhoneField = (value) => {
  const phone = String(value ?? '').trim();
  if (!phone) return null;
  if (phone.length < 7) return 'That number is too short.';
  if (phone.length > 20) return 'That number is too long.';
  if (!/^[+\d\s()-]+$/.test(phone)) return 'Use digits, spaces and + ( ) - only.';
  return null;
};

/**
 * The whole patch, as a field-keyed error map.
 *
 * An empty object means saveable. Building the map rather than a single message
 * is what lets the form show which of the three lines is wrong, which is the
 * difference between "something is invalid" and a fix.
 *
 * @param {{ name?: string, position?: string, phone?: string }} patch
 * @returns {Record<string, string>} an empty object when the patch is saveable
 */
export const validateProfilePatch = (patch = {}) => {
  const errors = {};

  const name = validateNameField(patch.name);
  if (name) errors.name = name;

  const position = validatePositionField(patch.position);
  if (position) errors.position = position;

  const phone = validatePhoneField(patch.phone);
  if (phone) errors.phone = phone;

  return errors;
};
