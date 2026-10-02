import api from './api';

/**
 * Shared error shape. Every onboarding page catches `{ status, message, code }`
 * and shows `message` through a toast, so services normalise here rather than
 * in each call site.
 *
 * **`meta` is carried through, and that is not a nicety.** Several refusals in this
 * API put structured detail *in addition to* the message — `TOO_MANY_RECIPIENTS`
 * returns the resolved recipient count, `EXCEEDS_REFUNDABLE` returns the remaining
 * balance. Dropping `meta` leaves the operator reading "this broadcast resolves to
 * more than 500 recipients" and having to guess by how much. The message is written
 * for a human to act on; `meta` is what lets the dialog act on it too.
 *
 * `details` is the axios spelling and `meta` the platform's; both are accepted
 * because a validation failure arrives from Joi with one and a domain refusal from
 * the other, and a caller should not have to know which produced the error it is
 * holding.
 */
export const toApiError = (error, fallback) => {
  const body = error?.response?.data;
  const message =
    body?.message ||
    (error?.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : error?.message) ||
    fallback;

  const wrapped = new Error(message);
  wrapped.status = error?.response?.status;
  wrapped.code = body?.code;
  wrapped.meta = body?.meta ?? error?.meta ?? null;
  wrapped.details = body?.errors ?? body?.details ?? null;

  return wrapped;
};

export default toApiError;
