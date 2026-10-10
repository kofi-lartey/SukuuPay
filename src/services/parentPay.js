import api from './api';
import { toApiError } from './toApiError';

/**
 * The parent pay portal's API client.
 *
 * **Not the same module as `publicPay.js`.** That one is the pre-existing pay page
 * and is kept working; this one is the portal the prompt describes, and the two
 * differ in a way that matters: every call here takes the token explicitly and
 * returns the `data` envelope already unwrapped.
 *
 * The reason is ownership. A pay link is routinely forwarded into a family WhatsApp
 * group and read on someone else's phone. A client that remembered the token in
 * `localStorage`, or inferred it from a global, would show one parent the fees of
 * another child the moment both used the same handset — the shared-phone case is
 * normal in Ghana, not exotic. So this module holds no state, reads nothing from
 * storage, and every function takes the token as its first argument. Nothing here
 * can answer a question without being told whose question it is.
 */

/**
 * Strips the `/api` prefix the shared client adds.
 *
 * `api.js` has `baseURL` ending in `/api`, so the path is relative to that. Kept as
 * a helper because getting it wrong produces a 404 that looks exactly like an
 * invalid token, and diagnosing that from the browser costs more than the helper.
 */
const pay = (token, path = '') => `/pay/${encodeURIComponent(token)}${path}`;

/** Reads the `data` envelope every pay route replies with, or throws its message. */
const unwrap = (response) => {
  if (response?.data?.success === false) {
    throw toApiError({ response }, response?.data?.message || 'Something went wrong.');
  }
  return response?.data?.data ?? response?.data ?? null;
};

// ──────────────────── Reads ────────────────────

/**
 * The landing page's whole read model: student, school, active plan, last three
 * payments. One request, because four round trips on a 3G connection is the
 * difference between a page and an assembly line of cards.
 */
export const fetchPortalView = async (token) => {
  try {
    return unwrap(await api.get(pay(token)));
  } catch (error) {
    throw toApiError(error, 'We could not load this payment page.');
  }
};

/** Full settled-payment history for this student, newest first. */
export const fetchPaymentHistory = async (token, { page = 1, perPage = 20 } = {}) => {
  try {
    return unwrap(
      await api.get(pay(token, '/history'), { params: { page, perPage } })
    );
  } catch (error) {
    throw toApiError(error, 'We could not load your payment history.');
  }
};

// ──────────────────── Payments ────────────────────

/**
 * Sends a Mobile Money prompt.
 *
 * `network` is the parent's own word for their operator — `"MTN"`, `"Telecel"`,
 * `"AirtelTigo"` — and is sent as-is. The backend's `PORTAL_NETWORK_ALIASES` maps
 * it to the stored enum, so this side never has to know that Telecel Cash is
 * stored as `VODAFONE`. The one place that mapping existed before was a
 * `.toUpperCase()` at each call site, which is how the two spellings drifted.
 *
 * `amount` is pesewas, as the API takes it everywhere else. `MoneyInput` is the
 * boundary that speaks cedis to the user, so nothing here converts.
 */
export const initiatePayment = async (token, { amount, phone, network, description } = {}) => {
  try {
    return unwrap(
      await api.post(pay(token, '/initiate'), {
        amount,
        phone,
        network,
        description,
      })
    );
  } catch (error) {
    throw toApiError(error, 'We could not start that payment. Please try again.');
  }
};

/**
 * Polls one payment's status while the parent approves on their handset.
 *
 * `retryAfter` comes from the server and is honoured rather than replaced with a
 * local constant: the endpoint is rate limited per token, so a client that polls
 * harder than it was told to is the one that eventually gets a 429 — and a parent
 * watching "Something went wrong" while their phone is still prompting is the worst
 * possible outcome for this screen.
 */
export const verifyPayment = async (token, reference) => {
  try {
    return unwrap(await api.get(pay(token, `/verify/${encodeURIComponent(reference)}`)));
  } catch (error) {
    throw toApiError(error, 'We could not check that payment yet.');
  }
};

// ──────────────────── Requests ────────────────────

/** Asks the school to split the balance. Not auto-approved; see the backend. */
export const requestPaymentPlan = async (token, payload) => {
  try {
    return unwrap(await api.post(pay(token, '/request-plan'), payload));
  } catch (error) {
    throw toApiError(error, 'We could not send your request. Please try again.');
  }
};

/**
 * Sends one message to the bursar — text, a voice note, or both. Three a day, per the
 * rate limiter.
 *
 * **`FormData` when there is audio, JSON otherwise.** The endpoint is multer-aware, so
 * it accepts both, but the request must be built to match:
 *
 *  - `FormData` is required for a file, and axios only sets the multipart boundary
 *    itself when the body is a `FormData`. Handing it `{ audio: File }` as a plain
 *    object serialises the file to the string `"[object File]"`.
 *  - `Content-Type` is **not** set explicitly. Setting it to `multipart/form-data`
 *    without the boundary makes the server fail to parse the body at all — a boundary
 *    is part of the header, and the one axios generates is the only one that knows
 *    where the file actually ends.
 *  - JSON is kept for the text-only case so the common path is unchanged and does not
 *    pay for multipart framing on a 3G connection.
 */
export const notifySchool = async (token, payload = {}) => {
  const { audio, ...fields } = payload;

  try {
    if (audio?.file) {
      const form = new FormData();
      form.append('parentName', fields.parentName ?? '');
      form.append('parentPhone', fields.parentPhone ?? '');
      if (fields.message) form.append('message', fields.message);
      form.append('audio', audio.file, audio.file.name);

      return unwrap(await api.post(pay(token, '/notify-school'), form));
    }

    return unwrap(await api.post(pay(token, '/notify-school'), fields));
  } catch (error) {
    throw toApiError(error, 'We could not send your message. Please try again.');
  }
};

// ──────────────────── Formatting helpers ────────────────────

/**
 * The three Ghanaian mobile money operators, as a parent names them.
 *
 * `prefixes` is what makes "we know your network from your number" possible on the
 * client, so the recommended card can be highlighted the moment a parent types
 * their number — on a slow connection that is one less thing for them to choose,
 * and fewer parents picking the wrong one. The prefixes are the same blocks
 * `phoneNumbers.networkForGhanaNumber` matches server-side; if they ever disagree,
 * that function is the authority and this is the thing to fix.
 */
export const MOMO_NETWORKS = [
  {
    id: 'MTN',
    label: 'MTN Mobile Money',
    short: 'MTN',
    // MTN's yellow, darkened to hold contrast against white for the label text.
    brandColor: '#FFCC00',
    accent: '#7A5200',
    tagline: 'Fast push USSD',
    prefixes: ['24', '54', '55', '59'],
  },
  {
    id: 'Telecel',
    label: 'Telecel Cash',
    short: 'Telecel',
    brandColor: '#E4002B',
    accent: '#B00020',
    tagline: 'Instant prompt or voucher',
    prefixes: ['22', '72'],
  },
  {
    id: 'AirtelTigo',
    label: 'AirtelTigo Money',
    short: 'AirtelTigo',
    brandColor: '#006F3B',
    accent: '#00522B',
    tagline: 'AirtelTigo wallet transfer',
    prefixes: ['20', '26', '27', '57', '58'],
  },
];

/**
 * The network a Ghanaian number belongs to, from its prefix.
 *
 * Returns null for an unrecognised one rather than guessing. A wrong
 * recommendation sends the parent's prompt to the wrong operator and they find out
 * by waiting; no recommendation just leaves the choice to them, which they can
 * already make.
 */
export const detectNetwork = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const national = digits.startsWith('233')
    ? digits.slice(3)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  if (national.length < 2) return null;

  const prefix = national.slice(0, 2);
  return MOMO_NETWORKS.find((network) => network.prefixes.includes(prefix)) || null;
};

/** The placeholder shown in the phone box for the selected network. */
export const phonePlaceholderFor = (networkId) => {
  const network = MOMO_NETWORKS.find((n) => n.id === networkId);
  if (!network) return '024 XXX XXXX';
  const sample = network.prefixes[0];
  return `0${sample} XXX XXXX`;
};