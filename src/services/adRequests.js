import api from './api';
import { toApiError } from './toApiError';

/**
 * A school's advertisement requests.
 *
 * Four calls, and none of them accepts a school id — the session supplies it. That is
 * not a simplification of the client's convenience: `POST /schools/me/ad-requests` takes
 * no `schoolId` because a school-admin-reachable field for it would be a way to publish
 * an ad as another school, and these render on the public login and signup pages.
 *
 * `createAdRequest` is `FormData` when there is an image. The endpoint is multer-aware
 * and accepts either, but a file needs multipart framing, and axios only sets the
 * boundary itself when the body is a `FormData`. `Content-Type` is deliberately not set
 * by hand — a boundary is part of that header, and the one axios generates is the only
 * one that knows where the file ends.
 */

/** The school's own requests, newest first. */
export const listAdRequests = async ({ page = 1, perPage = 20, status = 'all' } = {}) => {
  try {
    const { data } = await api.get('/schools/me/ad-requests', {
      params: { page, perPage, status: status || undefined },
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
      },
    };
  } catch (error) {
    throw toApiError(error, 'Your advertisement requests could not be loaded.');
  }
};

/**
 * Submits a request for review.
 *
 * Always `pending`, always server-side — a school has no route that reaches an approved
 * ad. `imageUrl` is only sent when there is no file, which is the console's paste-an-
 * already-hosted-asset path and is not offered on this form.
 */
export const createAdRequest = async ({ file, headline, writeup, imageAlt, linkUrl, placement, endsAt }) => {
  try {
    if (file) {
      const form = new FormData();
      form.append('headline', headline);
      if (writeup) form.append('writeup', writeup);
      form.append('imageAlt', imageAlt);
      form.append('linkUrl', linkUrl);
      form.append('placement', placement);
      form.append('endsAt', endsAt);
      form.append('image', file, file.name);

      return (await api.post('/schools/me/ad-requests', form)).data?.data || null;
    }

    const { data } = await api.post('/schools/me/ad-requests', {
      headline,
      writeup: writeup || undefined,
      imageAlt,
      linkUrl,
      placement,
      endsAt,
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Your advertisement request could not be sent.');
  }
};

/**
 * Withdraws a request that has not been reviewed.
 *
 * Server-side this refuses anything already decided on, so the UI does not need to
 * guess which rows are withdrawable — it hides the action and the server is the
 * authority.
 */
export const withdrawAdRequest = async (adId) => {
  try {
    await api.delete(`/schools/me/ad-requests/${adId}`);
    return true;
  } catch (error) {
    throw toApiError(error, 'That request could not be withdrawn.');
  }
};

/** The placements a school can ask for. Mirrors `AD_PLACEMENTS` on the server. */
export const AD_PLACEMENTS = [
  {
    value: 'auth_aside',
    label: 'Sign-in pages',
    help: 'The green panel beside the login and signup forms. The most seen placement.',
  },
  {
    value: 'home_hero',
    label: 'Home page banner',
    help: 'A wide banner on the public home page.',
  },
  {
    value: 'dashboard_sidebar',
    label: 'School dashboard',
    help: 'A small panel inside the school dashboard. Shown only to your own staff.',
  },
];

export default {
  listAdRequests,
  createAdRequest,
  withdrawAdRequest,
  AD_PLACEMENTS,
};