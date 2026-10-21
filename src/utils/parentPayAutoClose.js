// When the payment sheet closes itself.
//
//   frontend/src/utils/parentPayAutoClose.js
//
// Kept in its own module, free of imports, for the same reason the reference
// reader is: it is the rule the sheet's closing behaviour depends on, and it
// is pure enough to be worth testing directly rather than asserting on source
// text.
//
// ## The rule
//
// A sheet that has succeeded closes itself. A sheet that has **failed** does
// not — it holds the screen with "Try again" and "Contact the school", because
// those are the parent's choices to make, and a sheet that vanishes on a timer
// makes them for her: a payment that did not go through disappears and leaves
// her looking at the fee page as if nothing had happened.
//
// The same goes for the sheet that is still waiting for approval. A prompt is
// out on the parent's phone; closing the sheet would hide the fact that
// something is still in flight.

/**
 * How long the success screen stays up before it closes itself.
 *
 * Long enough to read the receipt number and the balance off it, and short
 * enough that a parent is not left staring at a sheet that has already said
 * everything it needs to say.
 */
export const SUCCESS_LINGER_MS = 4500;

/**
 * Whether the sheet closes itself in this phase.
 *
 * @param {string} phase one of `form`, `otp`, `pending`, `success`, `failed`
 * @returns {boolean}
 */
export const shouldAutoClose = (phase) => phase === 'success';

export default { SUCCESS_LINGER_MS, shouldAutoClose };
