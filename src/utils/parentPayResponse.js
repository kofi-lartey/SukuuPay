// The parent pay sheet's reading of an initiate response.
//
// Kept in its own module, free of imports, for two reasons: it is the part of
// the payment flow that decides whether a parent sees a spinner or a
// confirmation, and it is pure enough to be worth testing directly rather than
// asserting on source text.
//
// ## The reference
//
// The API answers with `{ payment, provider, <gateway block>, payLink }`. The
// value the portal polls on is `Payment.reference` — the reference minted
// *before* the document was written, because the parent has the response long
// before a retry could look up the id generated in the pre-save hook.
//
// It is **not** at the top level. Reading `response.reference` returns
// `undefined` for every MoMo gateway, and the sheet then sits on a spinner it
// can never resolve: the parent sees "Waiting for you to approve" forever,
// while their money may already have moved.
//
// ## The hosted checkout
//
// A USSD push that never arrives is a dead end for a parent whose phone is
// off or out of credit. The hosted checkout is the way out — and for a card
// payment it is the only way in, since there is no prompt to send. It is
// **created on demand** for a push that is already in flight, through its own
// endpoint, rather than handed over with the initiate response: Moolre
// requires the payment reference to be unique, and the USSD prompt has
// already claimed it.

/**
 * The reference to poll on, out of an initiate response.
 *
 * @param {object|null} response the initiate response
 * @returns {string|null} the reference, or null when there is none
 */
export const resolvePaymentReference = (response) => {
  if (!response) return null;
  return (
    response.reference ||
    response.payment?.reference ||
    response.moolre?.reference ||
    response.mtn?.referenceId ||
    null
  );
};

export default { resolvePaymentReference };
