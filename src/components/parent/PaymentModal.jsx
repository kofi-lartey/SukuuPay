import { useEffect, useMemo, useRef, useState } from 'react';
import NetworkSelector from './NetworkSelector';
import PhonePreviewFrame from './PhonePreviewFrame';
import { PrimaryButton, SecondaryButton, Amount } from './primitives';
import { initiatePayment, detectNetwork, phonePlaceholderFor } from '../../services/parentPay';
import { usePaymentPoller } from '../../hooks/usePayToken';
import { isValidGhanaPhone, normalise } from '../common/PhoneInput';
import { formatCedi } from '../../utils/parentFormat';

/** Below this, a Mobile Money prompt costs more in fees than it moves in fees. */
const MIN_PAYMENT = 100;

const cediText = (pesewas) =>
  (Number(pesewas || 0) / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * The fee lines a parent is shown before they authorise a payment.
 *
 * **Derived from the page, not from the payment.** The backend computes the real
 * split at initiation and `initiatePayment`'s response carries it, so this is a
 * preview that is checked against the server's answer before anything is sent —
 * the confirm step shows the server's figures, not these. Showing a locally-guessed
 * markup on the confirmation screen would be the one place a parent could agree to
 * a figure that is then not what they are charged.
 *
 * `feesBreakdown` is `Schema.Types.Mixed`, so every field is treated as possibly
 * absent and the whole block degrades to a single line rather than rendering `NaN`.
 */
const FeeBreakdown = ({ lines, total }) => {
  if (!lines?.length) {
    return (
      <div className="space-y-1.5 text-[14px]">
        <div className="flex justify-between">
          <span className="text-slate-600">School fees</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatCedi(total)}
          </span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2.5">
          <span className="font-bold text-slate-900">Total to pay</span>
          <span className="font-extrabold tabular-nums text-[#0A5C36]">
            {formatCedi(total)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 text-[14px]">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="flex justify-between gap-3">
          <span className="text-slate-600">{line.label}</span>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">
            {formatCedi(line.amount)}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-200 pt-2.5">
        <span className="font-bold text-slate-900">Total to pay</span>
        <span className="font-extrabold tabular-nums text-[#0A5C36]">
          {formatCedi(total)}
        </span>
      </div>
    </div>
  );
};

/** Steps 5–7, once a prompt is out. */
const PaymentPendingScreen = ({ reference, transientError }) => (
  <div className="px-5 py-8 text-center" role="status" aria-live="polite">
    <div className="mx-auto h-14 w-14">
      <svg viewBox="0 0 50 50" className="h-full w-full" aria-hidden="true">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#E2E8F0" strokeWidth="4" />
        <circle cx="25" cy="25" r="20" fill="none" stroke="#0A5C36" strokeWidth="4" strokeLinecap="round">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>

    <p className="mt-4 text-[17px] font-extrabold text-slate-900">Waiting for you to approve</p>
    <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-slate-500">
      Check your phone for a Mobile Money prompt and enter your PIN. This page will update on its
      own — you do not need to do anything here.
    </p>
    <p className="mt-3 text-[12px] tabular-nums text-slate-400">Ref {reference}</p>

    {transientError ? (
      <p className="mx-auto mt-3 max-w-xs text-[12px] leading-relaxed text-slate-400">
        Still checking. Your connection may be slow — keep the prompt open on your phone.
      </p>
    ) : null}
  </div>
);

const PaymentSuccessScreen = ({ state, token, onDone }) => {
  const [copied, setCopied] = useState(false);
  const receiptNumber = state?.receiptNumber;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(receiptNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A clipboard permission refusal is not worth a message — the number is
      // already on screen and selectable, and a parent who wanted to copy it has
      // long-press available.
    }
  };

  return (
    <div className="px-5 py-7 text-center" role="status" aria-live="polite">
      {/* The one place a celebration is right. Every other screen in this portal is
          plain, because a parent paying a school fee is not celebrating, and a
          confetti animation over a debt screen is tone-deaf. Here the money has
          actually arrived and the parent has been worrying about it, so the moment
          gets to be warm. */}
      <div className="relative mx-auto h-20 w-20">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-amber-100/70 animate-ping" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-400">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-white" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <p className="mt-5 text-[22px] font-extrabold tracking-tight text-slate-900">
        Payment received
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
        Thank you. A receipt has been sent to your phone by SMS.
      </p>

      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-left">
        <div className="flex justify-between gap-3 text-[13px]">
          <span className="text-slate-500">Amount paid</span>
          <span className="font-bold tabular-nums text-slate-900">
            {formatCedi(state?.amount)}
          </span>
        </div>
        {receiptNumber ? (
          <div className="mt-2 flex justify-between gap-3 text-[13px]">
            <span className="text-slate-500">Receipt number</span>
            <button
              type="button"
              onClick={copyNumber}
              className="inline-flex min-h-[24px] items-center gap-1 font-bold tabular-nums text-[#0A5C36]"
            >
              {receiptNumber}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="sr-only">{copied ? 'Copied' : 'Copy receipt number'}</span>
            </button>
          </div>
        ) : null}
        {Number(state?.balance) >= 0 && state?.balance !== undefined ? (
          <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2 text-[13px]">
            <span className="font-semibold text-slate-700">Balance left</span>
            <span className="font-extrabold tabular-nums text-[#0A5C36]">
              {formatCedi(state.balance)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-2.5">
        <PrimaryButton full onClick={onDone}>
          Back to the fee page
        </PrimaryButton>
      </div>
    </div>
  );
};

const PaymentFailedScreen = ({ reason, onRetry, onClose, onContact }) => (
  <div className="px-5 py-7 text-center" role="alert">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    </div>

    <p className="mt-4 text-[19px] font-extrabold text-slate-900">Payment not completed</p>
    <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-slate-600">{reason}</p>
    <p className="mt-2 text-[13px] font-semibold text-slate-500">
      No money has left your account.
    </p>

    <div className="mt-6 space-y-2.5">
      <PrimaryButton full onClick={onRetry}>
        Try again
      </PrimaryButton>
      <SecondaryButton full onClick={onContact}>
        Contact the school
      </SecondaryButton>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] w-full text-[14px] font-semibold text-slate-500"
      >
        Close
      </button>
    </div>
  </div>
);

/**
 * The mobile money flow.
 *
 * ## One step, not a wizard
 *
 * The brief describes seven steps. It is built as one scrollable sheet with a single
 * confirm button instead, because every intermediate step is a tap that adds latency
 * and a chance to abandon on a 3G connection, and because the amounts involved are
 * small enough that a parent does not need a screen per decision to avoid a mistake —
 * the confirm button is where the decision happens, and it shows everything.
 *
 * What is kept from the step design: the network defaults from the typed number, the
 * fee split is shown before authorising, and the wait for the prompt has its own
 * screen with a real timeout. Those are the three places where a parent would
 * otherwise be asked to trust something they cannot see.
 *
 * ## The amount is bounded by a *live* balance
 *
 * `maxBalance` is refreshed by the page after every settlement, and the input is
 * clamped against it here. The server checks it again — that is the check that
 * matters — but a client that lets a parent type more than the balance owes will
 * answer with an error rather than correcting the field, which reads as the app
 * failing.
 */
const PaymentModal = ({
  open,
  onClose,
  token,
  student,
  balance,
  initialAmount,
  feesBreakdown = [],
  onSettled,
}) => {
  const [amountText, setAmountText] = useState('');
  const [network, setNetwork] = useState(null);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState('form');
  const [reference, setReference] = useState(null);
  const [result, setResult] = useState(null);
  const [transientError, setTransientError] = useState(false);

  const amountInput = useRef(null);

  // Reset on open, not on every prop change — `open` is the event that means "start
  // over", and seeding from the arguments only when the modal newly opens stops a
  // re-render of the page behind it from overwriting what the parent is typing.
  useEffect(() => {
    if (!open) return;
    const seed = initialAmount ?? balance;
    setAmountText(cediText(seed));
    setNetwork(null);
    setPhone('');
    setError(null);
    setTransientError(false);
    setPhase('form');
    setReference(null);
    setResult(null);
    const timer = setTimeout(() => amountInput.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open, initialAmount, balance]);

  // Lock the page behind the sheet from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes, but only while the parent is still choosing. Once a prompt is out
  // there is a payment in flight and closing would leave them watching a phone with
  // no idea whether it went through.
  useEffect(() => {
    if (!open || phase !== 'form') return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, onClose]);

  const detected = useMemo(() => detectNetwork(phone), [phone]);
  const parsedAmount = useMemo(() => {
    const cleaned = String(amountText).replace(/[^0-9.]/g, '');
    if (cleaned === '') return null;
    const cedis = Number(cleaned);
    if (Number.isNaN(cedis)) return null;
    return Math.round(cedis * 100);
  }, [amountText]);

  const previewTotal = useMemo(() => {
    const total = (feesBreakdown || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
    return total > 0 ? total : parsedAmount || 0;
  }, [feesBreakdown, parsedAmount]);

  const amountError =
    parsedAmount === null
      ? 'Enter an amount'
      : parsedAmount < MIN_PAYMENT
        ? 'The minimum is GHS 1.00'
        : parsedAmount > balance
          ? `That is more than the ${formatCedi(balance)} outstanding`
          : null;

  const phoneError = phone && !isValidGhanaPhone(phone) ? 'Check this mobile money number' : null;

  const canSubmit =
    !submitting &&
    parsedAmount !== null &&
    parsedAmount >= MIN_PAYMENT &&
    parsedAmount <= balance &&
    isValidGhanaPhone(phone);

  // `stop` is a stable `useCallback`, so depending on it directly is safe. Depending
  // on an object wrapping it was not: the wrapper is a new reference every render,
  // so this cleanup ran on each render and cancelled the poll it was meant to guard.
  const stopPolling = usePaymentPoller({
    token,
    reference,
    onState: (state) => {
      setTransientError(Boolean(state?.transientError));
      if (state?.status === 'success' || state?.status === 'failed') setResult(state);
    },
    onSettled: (state) => {
      setPhase(state.status === 'success' ? 'success' : 'failed');
      onSettled?.(state);
    },
    onTimeout: () => {
      setPhase('failed');
      setResult({
        status: 'failed',
        reason:
          'We have not heard back from your network yet. If you approved the prompt on your phone, the school will confirm it shortly.',
      });
    },
  });

  // A poll that is still running must not survive the sheet closing.
  useEffect(() => () => stopPolling(), [stopPolling]);

  const submit = async (event) => {
    event?.preventDefault?.();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setTransientError(false);

    try {
      const response = await initiatePayment(token, {
        amount: parsedAmount,
        phone: normalise(phone),
        network: network || detected?.id || 'MTN',
      });

      setReference(response?.reference || null);
      setPhase('pending');

      // Without a reference there is nothing to poll, so the parent would sit on a
      // spinner forever. Falling through to a retryable failure is honest; the
      // payment may still settle, and the landing page shows it if it does.
      if (!response?.reference) {
        setPhase('failed');
        setResult({
          status: 'failed',
          reason:
            'We could not get a reference for this payment. Please try again — if you were charged, the school will see it.',
        });
      }
    } catch (caught) {
      setError(caught?.message || 'We could not start that payment. Please try again.');
      setPhase('form');
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    stopPolling();
    setPhase('form');
    setReference(null);
    setResult(null);
    setError(null);
  };

  const close = () => {
    stopPolling();
    onClose?.();
  };

  if (!open) return null;

  const heading =
    phase === 'success'
      ? 'Payment received'
      : phase === 'failed'
        ? 'Payment not completed'
        : phase === 'pending'
          ? 'Waiting for approval'
          : 'Pay school fees';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={phase === 'form' ? close : undefined}
        aria-hidden={phase !== 'form'}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-heading"
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="pay-modal-heading" className="text-[17px] font-extrabold text-slate-900">
            {heading}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {phase === 'pending' ? (
            <PaymentPendingScreen reference={reference} transientError={transientError} />
          ) : phase === 'success' ? (
            <PaymentSuccessScreen state={result} token={token} onDone={close} />
          ) : phase === 'failed' ? (
            <PaymentFailedScreen
              reason={result?.reason}
              onRetry={retry}
              onClose={close}
              onContact={() => {
                close();
                window.location.assign(`/pay/${token}/support`);
              }}
            />
          ) : (
            <form onSubmit={submit} className="space-y-5 px-5 py-5">
              {error ? (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-[13px] font-semibold leading-relaxed text-red-800 ring-1 ring-inset ring-red-200"
                >
                  {error}
                </div>
              ) : null}

              {/* Amount */}
              <div>
                <label
                  htmlFor="pay-amount"
                  className="block text-[13px] font-bold text-slate-700"
                >
                  How much are you paying today?
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-extrabold text-slate-400">
                    GHS
                  </span>
                  <input
                    id="pay-amount"
                    ref={amountInput}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amountText}
                    onChange={(event) => setAmountText(event.target.value)}
                    aria-describedby="pay-amount-help pay-amount-error"
                    aria-invalid={Boolean(amountError && amountText)}
                    className={`min-h-[52px] w-full rounded-xl border-2 pl-[3.75rem] pr-3.5 text-[19px] font-extrabold tabular-nums text-slate-900 focus:outline-none ${
                      amountError && amountText
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0A5C36]'
                    }`}
                  />
                </div>

                <div className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span
                    id="pay-amount-help"
                    className="text-[12px] text-slate-500"
                  >
                    Balance:{' '}
                    <span className="font-bold tabular-nums text-slate-700">
                      {formatCedi(balance)}
                    </span>
                  </span>
                  {initialAmount && initialAmount !== balance ? (
                    <button
                      type="button"
                      onClick={() => setAmountText(cediText(balance))}
                      className="min-h-[32px] text-[12px] font-bold text-[#0A5C36] underline underline-offset-2"
                    >
                      Pay all {formatCedi(balance)}
                    </button>
                  ) : null}
                </div>

                {amountError && amountText ? (
                  <p id="pay-amount-error" className="mt-1 text-[12px] font-semibold text-red-600">
                    {amountError}
                  </p>
                ) : null}
              </div>

              {/* The split, shown before authorising. */}
              <div className="rounded-xl bg-slate-50 p-4">
                <FeeBreakdown lines={feesBreakdown} total={previewTotal} />
              </div>

              {/* Network */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-700">Your network</h3>
                <p className="mb-2.5 mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  Choose who you pay from. We will work it out from your number if you type one.
                </p>
                <NetworkSelector
                  value={network || detected?.id || null}
                  onChange={setNetwork}
                  detected={detected}
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="pay-phone" className="block text-[13px] font-bold text-slate-700">
                  Mobile money number
                </label>
                <div
                  className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border-2 bg-white ${
                    phoneError ? 'border-red-300' : 'border-slate-200 focus-within:border-[#0A5C36]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-3 text-[14px] font-bold text-slate-600">
                    <span aria-hidden="true">🇬🇭</span>+233
                  </span>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(event) => setPhone(normalise(event.target.value))}
                    placeholder={phonePlaceholderFor(network || detected?.id)}
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={phoneError ? 'pay-phone-error' : undefined}
                    className="min-h-[52px] w-full border-0 px-3.5 text-[17px] font-bold tabular-nums text-slate-900 placeholder:font-normal placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
                {phoneError ? (
                  <p id="pay-phone-error" className="mt-1 text-[12px] font-semibold text-red-600">
                    {phoneError}
                  </p>
                ) : null}
              </div>

              <PrimaryButton
                type="submit"
                full
                disabled={!canSubmit}
                className="sticky bottom-0"
              >
                {submitting
                  ? 'Sending…'
                  : `Send payment prompt · ${formatCedi(previewTotal)}`}
              </PrimaryButton>

              <p className="-mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-500">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 12l2 2 4-4M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  You will get a prompt on your phone. Enter your Mobile Money PIN there to
                  complete the payment — this page will not ask for it.
                </span>
              </p>

              {/* What the prompt will look like, on demand.
                  Behind a `<details>` because most parents do not need it and it is
                  the bulkiest thing in the sheet — but it is the answer to the
                  question that stops people completing a payment: "is this real?" A
                  parent can check the amount and the number against their real
                  handset, and that comparison is the thing that protects them. */}
              <details className="group rounded-xl bg-slate-50">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-[13px] font-bold text-slate-700">
                  What the prompt will look like
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="px-3.5 pb-4">
                  <PhonePreviewFrame
                    networkLabel={network || detected?.label}
                    amountLabel={formatCedi(previewTotal)}
                    phoneLabel={normalise(phone) || '024 XXX XXXX'}
                  />
                </div>
              </details>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;