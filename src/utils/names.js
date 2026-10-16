/**
 * Names, as this product writes them.
 *
 * One helper, and it exists for one reason: a Ghanaian teacher's name on a
 * register is routinely written **"Sir Ciblah"** or **"Madam Ama"** — an
 * honorific and a name, in one field. Every other part of the app renders the
 * whole string, but the dashboard greeting wants *a* name, and splitting on
 * whitespace and taking the first token produces "Good afternoon, **Sir**",
 * which is wrong in the one place the product is speaking to a person rather
 * than listing them.
 */

/**
 * Honorifics that prefix a name rather than being part of it.
 *
 * Matched case-insensitively and with or without the trailing dot, because both
 * "Dr." and "Dr" reach the database — `userModel.js` validates the name as a
 * free string, so the form does not normalise either.
 */
const HONORIFICS = new Set([
  'sir',
  'madam',
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'prof',
  'professor',
  'rev',
  'pastor',
  'hajia',
  'hajj',
  'alhaji',
  'chief',
  'nana',
]);

/**
 * The name a greeting should address somebody by.
 *
 * The first token that is *not* an honorific, and the whole string when every
 * token is one — a teacher recorded as "Sir" should be greeted as "Sir" rather
 * than as an empty line.
 *
 * @param {string} fullName the stored name, e.g. "Sir Ciblah" or "Ama Mensah"
 * @returns {string}
 */
export const firstNameOf = (fullName) => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return '';

  for (const part of parts) {
    if (!HONORIFICS.has(part.toLowerCase().replace(/\.$/, ''))) return part;
  }

  return parts[0];
};

/**
 * The initials for an avatar, when no picture is set.
 *
 * Skips a leading honorific too, so "Sir Ciblah" reads "SC" (the person) rather
 * than "SS" (the honorific and the name's first letter) — which is how this
 * avatar ended up "SC." beside "Sir" in the greeting before both were fixed.
 *
 * @param {string} fullName
 * @returns {string} up to two uppercase letters
 */
export const initialsOf = (fullName) => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter((part) => !HONORIFICS.has(part.toLowerCase().replace(/\.$/, '')));

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

export default { firstNameOf, initialsOf };
