import api from './api';

/**
 * Shared error shape. Every onboarding page catches `{ status, message, code }`
 * and shows `message` through a toast, so services normalise here rather than
 * in each call site.
 */
export const toApiError = (error, fallback) => {
  const message =
    error?.response?.data?.message ||
    (error?.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : error?.message) ||
    fallback;
  const wrapped = new Error(message);
  wrapped.status = error?.response?.status;
  wrapped.code = error?.response?.data?.code;
  return wrapped;
};

export default toApiError;
