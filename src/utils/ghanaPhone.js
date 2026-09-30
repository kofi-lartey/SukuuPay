/**
 * Ghana phone numbers, one place.
 *
 * The backend validates with `validateGhanaPhone` in `utils/generateCode.js` and
 * normalises to the `0xx` form; `PhoneInput` mirrors that so the user gets
 * feedback before a round trip. The pattern is written to accept all three
 * spellings — `0241234567`, `233241234567`, `+233 24 123 4567` — because they
 * are the same person, and rejecting a parent's number on a formatting technicality
 * is how a guardian ends up unable to receive a fee reminder.
 *
 * `0[2-5]` covers the four networks: MTN (024/054), Vodafone (020/050),
 * Telecel (023/053) and AirtelTigo (027/057).
 */
export const GHANA_PHONE_REGEX = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;

/** `0241234567` → `024 123 4567`. For display only; never for storage. */
export const formatGhanaPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits;
  if (local.length !== 10) return raw || '';
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
};

/**
 * `0241234567` → `024 ••• •67`.
 *
 * Used in the roster, where a bursar is browsing rather than calling. The
 * profile drawer and the export both show the real number: one is a named
 * student being looked at, the other is taken off-system and reconciled against
 * a bank statement, and a masked phone makes both useless.
 */
export const maskGhanaPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  const local = digits.startsWith('233') ? `0${digits.slice(3)}` : digits;
  if (local.length !== 10) return raw || '';
  return `${local.slice(0, 3)} ••• •${local.slice(-2)}`;
};
