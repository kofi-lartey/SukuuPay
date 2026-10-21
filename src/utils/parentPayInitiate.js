// The body of a parent payment initiation.
//
// Kept in its own module, free of imports, for the same reason the reference
// reader is: it is the part of the flow that decides whether the parent's
// mobile money code is ever heard, and it is pure enough to be worth testing
// directly rather than asserting on source text.
//
// ## Why the code has to be on the wire
//
// Moolre verifies the payer's phone number before it sends the approval
// prompt. It answers the first request with "an OTP was sent to you" and the
// parent types that code in. The code is answered by **repeating the same
// request with it** — so the code has to travel with the request, or the
// second request is simply another first request: Moolre answers "another code
// required" and the parent is told their code was not accepted, however
// carefully they typed it.
//
// ## Why the reference travels with it
//
// Moolre verifies a number against a *transaction*, and the transaction is
// named by the reference. The reference of the payment already in flight
// pins the code to the transaction Moolre actually issued it for, so the
// backend answers against that payment rather than inferring which one it is
// from the amount and the number.

/**
 * The request body for a payment initiation.
 *
 * `otpCode` and `reference` are only included when they carry a value: an
 * empty string would be sent as a submitted code, and the backend treats a
 * present `otpCode` as "this is a verification, reuse the in-flight
 * payment" — which is not what a first attempt is.
 *
 * @param {object} params
 * @param {number} params.amount pesewas
 * @param {string} params.phone the payer's number
 * @param {string} params.network the payer's network, in the parent's words
 * @param {string} [params.description]
 * @param {string} [params.otpCode] the code Moolre sent by SMS
 * @param {string} [params.reference] the payment already in flight
 * @returns {object} the request body
 */
export const buildInitiatePayload = ({
  amount,
  phone,
  network,
  description,
  otpCode,
  reference,
} = {}) => ({
  amount,
  phone,
  network,
  description,
  ...(otpCode ? { otpCode } : {}),
  ...(reference ? { reference } : {}),
});

export default { buildInitiatePayload };
