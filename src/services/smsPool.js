import api from './api';
import { toApiError } from './toApiError';

/**
 * The console side of regulated SMS credit purchase.
 *
 * Kept out of `services/admin.js` because that module is one flat list of platform
 * endpoints and these three are a *pair* that have to be read together: the pool says
 * how many units exist, the queue says how many are promised. An operator approving a
 * 10,000-unit request against a pool of 500 needs both figures on one screen, and
 * splitting them across a 900-line service file makes that harder to see, not easier.
 */

/**
 * The Arkesel pool.
 *
 * `availableUnits` is the figure the console was missing entirely before this feature:
 * how many units the platform has bought and not yet given away. It replaces the
 * `platformPool: null` placeholder `admin/sms.service.js` used to return, which meant
 * the dashboard had a pool card reading "not configured" forever.
 */
export const getSmsPool = async () => {
  try {
    const { data } = await api.get('/admin/sms/pool');
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The SMS pool could not be loaded.');
  }
};

/** Records units bought from Arkesel. `amountPes` is the platform's cost, not revenue. */
export const recordSmsPoolTopUp = async (payload) => {
  try {
    const { data } = await api.post('/admin/sms/pool/topup', payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That top-up could not be recorded.');
  }
};

/** The approval queue, across every school. */
export const listSmsRequests = async ({ page = 1, perPage = 20, status = 'all' } = {}) => {
  try {
    const { data } = await api.get('/admin/sms/requests', {
      params: { page, perPage, status: status || undefined },
    });

    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      // Built inline rather than via `toPageMeta` from `services/admin.js`: that helper
      // takes the *client's* argument order (`totalPages` in the fourth position) and
      // importing it across modules for six lines of arithmetic would couple this
      // service to the platform console's conventions. Same shape, computed here.
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
      },
    };
  } catch (error) {
    throw toApiError(error, 'SMS purchase requests could not be loaded.');
  }
};

/**
 * Approves: releases the units and credits the school.
 *
 * The button behind this is disabled while `awaiting_approval` rather than optimistically
 * updated, because the operation is not idempotent in its *effects* — the server refuses
 * a second approval, but the operator should never be the one discovering that.
 */
export const approveSmsRequest = async (requestId) => {
  try {
    const { data } = await api.post(`/admin/sms/requests/${requestId}/approve`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That request could not be approved.');
  }
};

/** Declines. `reason` is shown to the school verbatim and cannot be empty. */
export const rejectSmsRequest = async (requestId, reason) => {
  try {
    const { data } = await api.post(`/admin/sms/requests/${requestId}/reject`, { reason });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'That request could not be declined.');
  }
};

/**
 * Records that a refund was issued.
 *
 * Recording, not performing — see `POST /admin/sms/requests/:requestId/refund`. The
 * service comment explains why, and the reason matters here too: a console button
 * labelled "Refund" would read as "this performs a refund", and an operator would click
 * it expecting money to move.
 */
export const markSmsRequestRefunded = async (requestId, refundReference) => {
  try {
    const { data } = await api.post(`/admin/sms/requests/${requestId}/refund`, {
      refundReference: refundReference || undefined,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'The refund could not be recorded.');
  }
};

export default {
  getSmsPool,
  recordSmsPoolTopUp,
  listSmsRequests,
  approveSmsRequest,
  rejectSmsRequest,
  markSmsRequestRefunded,
};