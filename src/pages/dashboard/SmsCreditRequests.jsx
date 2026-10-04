import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, Minus, Plus, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/students/Pagination';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import {
  quoteSmsRequest,
  createSmsRequest,
  listSmsRequests,
  getSmsRequest,
} from '../../services/smsRequests';
import { formatCedis, formatCount } from '../../utils/format';
import { isValidGhanaPhone, normalise } from '../../components/common/PhoneInput';

/**
 * Buying SMS credit, with an administrator's signature on it.
 *
 * ## Why this is a request and not a button
 *
 * The school asks, pays, and then **waits**. That waiting is the product: the platform
 * owns the Arkesel balance, and releasing units out of it is a decision someone has to
 * make. So the page is built around the queue rather than around a purchase, and its
 * job is to make the wait legible — what state is this in, who has it, what happens
 * next — because a bursar who paid and sees a dead end will assume they were charged for
 * nothing.
 *
 * ## The price is quoted before anything is committed
 *
 * `POST /sms-requests/quote` runs as the quantity changes, and the request is only
 * created from a *fresh* quote. The server re-reads the rate regardless and freezes it
 * on the row, so the number shown here is the number charged — the client's copy is
 * never the authority, it is a preview of one.
 *
 * ## The state machine is drawn, not described
 *
 * Awaiting payment → awaiting approval → approved, with a rejection branch. Every
 * state has its own row treatment and its own next sentence. A school in
 * `awaiting_approval` has already paid, and the one thing it must not be left thinking
 * is that the money is gone.
 */

/** Mirrors `SMS_REQUEST_STATUS` in `Backend/src/config/constants.js`. */
const STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const STATUS_PRESENTATION = {
  [STATUS.AWAITING_PAYMENT]: {
    tone: 'amber',
    icon: Clock,
    label: 'Awaiting payment',
    // The school has not paid yet, so this is the only state where the prompt is the
    // next thing that will happen — and the only one where the page should be telling
    // them to look at their phone.
    next: 'Approve the MTN prompt on your phone to pay.',
  },
  [STATUS.AWAITING_APPROVAL]: {
    tone: 'blue',
    icon: CreditCard,
    label: 'Paid — awaiting approval',
    // Paid. Said first, and said plainly, because this is the state a bursar checks
    // most often and the one where "nothing has happened yet" is most alarming.
    next: 'Payment received. An administrator will release your credit shortly.',
  },
  [STATUS.APPROVED]: {
    tone: 'green',
    icon: CheckCircle2,
    label: 'Approved',
    next: 'Your credit has been added and is ready to send.',
  },
  [STATUS.REJECTED]: {
    tone: 'red',
    icon: TriangleAlert,
    label: 'Declined',
    next: 'This purchase was declined. A refund can be issued — see the reason below.',
  },
  [STATUS.CANCELLED]: {
    tone: 'slate',
    icon: Minus,
    label: 'Cancelled',
    next: 'This request was withdrawn before payment.',
  },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: STATUS.AWAITING_PAYMENT, label: 'Awaiting payment' },
  { key: STATUS.AWAITING_APPROVAL, label: 'Awaiting approval' },
  { key: STATUS.APPROVED, label: 'Approved' },
];

const STEP_STEPS = [1, 2, 3];

const SmsCreditRequests = () => {
  const toast = useToast();
  const { user } = useAuth();

  const [units, setUnits] = useState(500);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null);

  const [history, setHistory] = useState({ rows: [], meta: null, loading: true });
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Quoting, debounced.
   *
   * 400ms rather than on-every-keystroke: the quantity is a number input, so arrow keys
   * and backspace each fire a change, and an undebounced request per keystroke would
   * put a burst of identical POSTs on the API for a figure that is already on screen.
   *
   * The `cancelled` flag is what makes this safe — without it, two in-flight quotes can
   * resolve out of order and the price on screen belongs to a quantity the user has
   * already changed away from, which is precisely the figure they would then agree to.
   */
  useEffect(() => {
    const amount = Number(units);

    if (!Number.isFinite(amount) || amount < 1) {
      setQuote(null);
      return undefined;
    }

    let cancelled = false;
    setQuoting(true);

    const timer = setTimeout(async () => {
      try {
        const result = await quoteSmsRequest(amount);
        if (!cancelled) setQuote(result);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [units]);

  const loadHistory = useCallback(() => {
    let active = true;
    setHistory((current) => ({ ...current, loading: true }));

    listSmsRequests({ status, page })
      .then((result) => {
        if (active) setHistory({ rows: result.rows, meta: result.meta, loading: false });
      })
      .catch((caught) => {
        if (active) {
          setHistory({ rows: [], meta: null, loading: false });
          toast?.error?.(caught?.message || 'Your purchases could not be loaded.');
        }
      });

    return () => {
      active = false;
    };
  }, [status, page, toast]);

  useEffect(() => loadHistory(), [loadHistory, reloadKey]);

  /**
   * Polls the open request while it is still moving.
   *
   * Only for a request in `awaiting_payment` or `awaiting_approval`, and only while the
   * tab is visible — the transition is driven by an MTN webhook and by a human at the
   * other end, neither of which cares whether this browser is looking. Six seconds is
   * slow enough not to matter and fast enough that a bursar who approved the prompt on
   * their phone sees it land when they switch back.
   */
  const [watching, setWatching] = useState(null);
  const watchTimer = useRef(null);

  useEffect(() => {
    if (!watching) return undefined;

    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const fresh = await getSmsRequest(watching.requestId);
        if (!fresh) return;
        if (fresh.status !== watching.status) {
          setWatching(fresh);
          setHistory((current) => ({ ...current }));
          setReloadKey((key) => key + 1);

          if (fresh.status === STATUS.AWAITING_APPROVAL) {
            toast?.success?.('Payment received. Waiting for an administrator to approve.');
          } else if (fresh.status === STATUS.APPROVED) {
            toast?.success?.('Your SMS credit has been approved.');
            setWatching(null);
          } else if (fresh.status === STATUS.REJECTED) {
            toast?.error?.('This purchase was declined.');
            setWatching(null);
          }
        }
      } catch {
        // A failed poll is not surfaced. It is a convenience refresh over a list that
        // is already on screen, and toasting "could not load" every six seconds would
        // be worse than a slightly stale row.
      }
    };

    watchTimer.current = setInterval(tick, 6000);
    return () => clearInterval(watchTimer.current);
  }, [watching, toast]);

  const phoneValid = phoneNumber ? isValidGhanaPhone(phoneNumber) : false;
  const canSubmit =
    !submitting && quote?.canRequest && Number(units) >= 1 && phoneValid;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await createSmsRequest({ units: Number(units), phoneNumber: normalise(phoneNumber) });

      setConfirming(result);
      setWatching(result);
      setReloadKey((key) => key + 1);
      // Kept in the form rather than reset, so a second purchase at the same quantity
      // and number is one tap. A bursar buying the same top-up monthly should not have
      // to retype it.
    } catch (caught) {
      setError(caught?.message || 'We could not start this purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const poolShort = quote && !quote.canRequest && quote.reason;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="SMS"
        title="Buy SMS credit"
        description="Pay for the messages your school sends to parents. Your administrator reviews each purchase and releases the credit — you will see it here as soon as they do."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ── The order ── */}
        <Card padding="p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            How many messages?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
            One unit is one SMS. You can buy more whenever you need it — unused credit
            does not expire.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnits((value) => Math.max(1, Number(value) - 100))}
              aria-label="Reduce by 100"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>

            <input
              type="number"
              min="1"
              max="200000"
              step="100"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              aria-label="Number of SMS units"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-center text-[18px] font-extrabold tabular-nums text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />

            <button
              type="button"
              onClick={() => setUnits((value) => Number(value) + 100)}
              aria-label="Increase by 100"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[500, 1000, 5000, 10000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setUnits(preset)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-extrabold transition-colors ${
                  Number(units) === preset
                    ? 'bg-brand-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {formatCount(preset)}
              </button>
            ))}
          </div>

          {/* ── The quote ── */}
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                Price
              </span>
              {quoting ? (
                <span className="text-[12px] font-semibold text-slate-400">updating…</span>
              ) : quote ? (
                <span className="text-[22px] font-extrabold tabular-nums text-ink">
                  {formatCedis(quote.totalPes)}
                </span>
              ) : (
                <span className="text-[13px] font-semibold text-slate-400">—</span>
              )}
            </div>

            {quote ? (
              <p className="mt-1.5 text-[12px] font-semibold text-slate-500">
                {formatCount(quote.units)} SMS at{' '}
                {formatCedis(quote.unitPricePes)} each
              </p>
            ) : null}

            {poolShort ? (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-800"
              >
                {poolShort}
              </p>
            ) : quote ? (
              <p className="mt-3 text-[12px] font-semibold text-slate-500">
                {formatCount(quote.poolAvailable)} units are available on the platform
                right now.
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <label
              htmlFor="sms-purchase-phone"
              className="block text-[13px] font-bold text-slate-700"
            >
              Mobile money number
            </label>
            <input
              id="sms-purchase-phone"
              type="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(normalise(event.target.value))}
              autoComplete="tel-national"
              placeholder="0241234567"
              aria-invalid={phoneNumber && !phoneValid ? 'true' : undefined}
              className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] font-bold tabular-nums text-slate-900 focus:outline-none ${
                phoneNumber && !phoneValid
                  ? 'border-red-300'
                  : 'border-slate-200 focus:border-[#0A5C36]'
              }`}
            />
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              {phoneValid
                ? 'The MTN prompt will be sent to this number.'
                : 'The number that will receive the payment prompt.'}
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-semibold leading-relaxed text-red-800 ring-1 ring-inset ring-red-200"
            >
              {error}
            </div>
          ) : null}

          <Button
            onClick={() => setConfirming({ preview: true, units: Number(units), quote })}
            disabled={!canSubmit}
            className="mt-4 w-full"
            full
          >
            {submitting ? 'Starting…' : `Buy ${formatCount(Number(units) || 0)} SMS`}
          </Button>

          <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
            You are not charged until you approve the prompt on your phone.
          </p>
        </Card>

        {/* ── The state machine ── */}
        <Card padding="p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            What happens next
          </h2>

          <ol className="mt-4 space-y-3">
            {[
              {
                title: 'You approve the MTN prompt',
                body: 'Nothing is charged until you confirm it on your phone.',
              },
              {
                title: 'We confirm the payment',
                body: 'MTN tells us the money arrived. Your request moves to "awaiting approval".',
              },
              {
                title: 'An administrator releases your credit',
                body: 'They draw the messages from the platform’s Arkesel balance and add them to yours. You are notified the moment they do.',
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-slate-800">{step.title}</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
              If it is declined
            </p>
            <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">
              A declined purchase is <strong>refundable in full</strong>. You will be told
              why, and you can contact support to have the money returned to your MoMo
              wallet.
            </p>
          </div>
        </Card>
      </div>

      {/* ── History ── */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            Your purchases
          </h2>

          <div
            role="tablist"
            aria-label="Filter purchases"
            className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
          >
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={status === tab.key}
                onClick={() => {
                  setStatus(tab.key);
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${
                  status === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {history.loading && history.rows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1].map((key) => (
              <Card key={key} padding="p-4">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                <div className="mt-2.5 h-3 w-56 animate-pulse rounded bg-slate-100" />
              </Card>
            ))}
          </div>
        ) : null}

        {!history.loading && history.rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={status === 'all' ? 'No purchases yet' : 'Nothing in this filter'}
            description={
              status === 'all'
                ? 'Your first purchase will appear here, along with where each one got to.'
                : 'Try another tab to see the rest of your history.'
            }
          />
        ) : null}

        <ul className="space-y-2">
          {history.rows.map((row) => {
            const presentation = STATUS_PRESENTATION[row.status] || STATUS_PRESENTATION[STATUS.CANCELLED];
            const Icon = presentation.icon;

            return (
              <li key={row._id}>
                <Card padding="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={presentation.tone} icon={Icon}>
                          {presentation.label}
                        </Badge>
                        <span className="text-[12px] font-bold text-slate-400">
                          {row.requestId}
                        </span>
                      </div>

                      <p className="mt-2 text-[14px] font-extrabold text-ink">
                        {formatCount(row.units)} SMS ·{' '}
                        <span className="tabular-nums">{formatCedis(row.totalPes)}</span>
                      </p>

                      <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                        {presentation.next}
                      </p>

                      {row.status === STATUS.REJECTED && row.rejectionReason ? (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-red-800">
                          Reason: {row.rejectionReason}
                        </p>
                      ) : null}

                      {row.refundedAt ? (
                        <p className="mt-2 text-[12px] font-bold text-emerald-700">
                          Refunded{row.refundReference ? ` · ${row.refundReference}` : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {new Date(row.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {row.payment?.reference?.replace('SMS-PAY-', '') || '—'}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>

        {history.meta && history.meta.totalPages > 1 ? (
          <div className="mt-4">
            <Pagination meta={history.meta} onPageChange={setPage} />
          </div>
        ) : null}
      </div>

      {/* ── Confirm ──
          A second step on purpose. It is the only place the school sees the exact
          figure and the exact number together before a prompt is issued, and the prompt
          itself is an MTN screen they cannot control — so this is the last point at
          which they can change their mind. */}
      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Confirm this purchase"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Sending prompt…' : 'Send me the payment prompt'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold text-slate-600">SMS messages</span>
              <span className="text-[15px] font-extrabold tabular-nums text-ink">
                {formatCount(confirming?.units ?? units)}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold text-slate-600">Total</span>
              <span className="text-[19px] font-extrabold tabular-nums text-ink">
                {formatCedis(confirming?.quote?.totalPes ?? quote?.totalPes ?? 0)}
              </span>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-slate-600">
            We will send an MTN payment prompt to{' '}
            <strong className="font-extrabold text-slate-800">{phoneNumber}</strong>. You
            are not charged until you approve it on your phone.
          </p>

          <p className="text-[12px] leading-relaxed text-slate-500">
            An administrator will then release your credit. If they decline it, the
            payment is refundable in full.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default SmsCreditRequests;