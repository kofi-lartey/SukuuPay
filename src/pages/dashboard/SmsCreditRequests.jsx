import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Copy, CreditCard, Minus, Plus, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/students/Pagination';
import { useToast } from '../../hooks/useToast';
import {
  quoteSmsRequest,
  createSmsRequest,
  submitSmsPaymentProof,
  listSmsRequests,
  getSmsRequest,
} from '../../services/smsRequests';
import { formatCedis, formatCount } from '../../utils/format';
import { isValidGhanaPhone, normalise } from '../../components/common/PhoneInput';

const STATUS = {
  AWAITING_PAYMENT: 'awaiting_payment',
  AWAITING_VERIFICATION: 'awaiting_verification',
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
    next: 'Complete payment using the reference shown, then submit your transaction reference for verification.',
  },
  [STATUS.AWAITING_VERIFICATION]: {
    tone: 'purple',
    icon: Clock,
    label: 'Awaiting verification',
    next: 'Payment reference submitted. An administrator will verify it and release your credit.',
  },
  [STATUS.AWAITING_APPROVAL]: {
    tone: 'blue',
    icon: CreditCard,
    label: 'Paid — awaiting approval',
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
  { key: STATUS.AWAITING_VERIFICATION, label: 'Awaiting verification' },
  { key: STATUS.AWAITING_APPROVAL, label: 'Awaiting approval' },
  { key: STATUS.APPROVED, label: 'Approved' },
];

const SmsCreditRequests = () => {
  const toast = useToast();
  const [paymentMethod, setPaymentMethod] = useState('mtn'); // 'mtn' | 'manual'
  const [units, setUnits] = useState(500);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [manualRef, setManualRef] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [created, setCreated] = useState(null);

  const [proofFor, setProofFor] = useState(null);
  const [submittedReference, setSubmittedReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState(null);

  const [history, setHistory] = useState({ rows: [], meta: null, loading: true });
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [watching, setWatching] = useState(null);
  const watchTimer = useRef(null);

  useEffect(() => {
    const amount = Number(units);
    if (!Number.isFinite(amount) || amount < 1) { setQuote(null); return undefined; }
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
    return () => { cancelled = true; clearTimeout(timer); };
  }, [units]);

  const loadHistory = useCallback(() => {
    let active = true;
    setHistory((current) => ({ ...current, loading: true }));
    listSmsRequests({ status, page })
      .then((result) => { if (active) setHistory({ rows: result.rows, meta: result.meta, loading: false }); })
      .catch((caught) => {
        if (active) {
          setHistory({ rows: [], meta: null, loading: false });
          toast?.error?.(caught?.message || 'Your purchases could not be loaded.');
        }
      });
    return () => { active = false; };
  }, [status, page, toast]);

  useEffect(() => loadHistory(), [loadHistory, reloadKey]);

  useEffect(() => {
    if (!watching) return undefined;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const fresh = await getSmsRequest(watching.requestId);
        if (!fresh) return;
        if (fresh.status !== watching.status) {
          setWatching(fresh);
          setReloadKey((key) => key + 1);
          if (fresh.status === STATUS.AWAITING_VERIFICATION) toast?.success?.('Payment reference submitted. Awaiting admin verification.');
          else if (fresh.status === STATUS.AWAITING_APPROVAL) toast?.success?.('Payment received. Waiting for administrator approval.');
          else if (fresh.status === STATUS.APPROVED) { toast?.success?.('Your SMS credit has been approved.'); setWatching(null); }
          else if (fresh.status === STATUS.REJECTED) { toast?.error?.('This purchase was declined.'); setWatching(null); }
        }
      } catch {}
    };
    watchTimer.current = setInterval(tick, 6000);
    return () => clearInterval(watchTimer.current);
  }, [watching, toast]);

  const phoneValid = phoneNumber ? isValidGhanaPhone(phoneNumber) : false;
  const canSubmit = !submitting && quote?.canRequest && Number(units) >= 1 && (paymentMethod === 'manual' || phoneValid);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSmsRequest({
        units: Number(units),
        paymentMethod,
        phoneNumber: paymentMethod === 'manual' ? undefined : normalise(phoneNumber),
        paymentReference: paymentMethod === 'manual' ? manualRef : undefined,
      });
      setConfirming(false);
      setCreated(result);
      setWatching(result);
      setReloadKey((key) => key + 1);
      if (result?.manual || result?.paymentMethod === 'manual') {
        setManualRef('');
        toast?.success?.('Request created. Use the payment reference shown, then submit your transaction reference.');
      }
    } catch (caught) {
      setError(caught?.message || 'We could not start this purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const makeShortRef = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    const chars = [pick(letters), pick(digits), pick(letters + digits), pick(letters + digits)];
    for (let i = chars.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return chars.join('');
  };

  const openConfirm = () => {
    if (paymentMethod === 'manual' && !manualRef) setManualRef(makeShortRef());
    setConfirming(true);
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); toast?.success?.('Copied.'); } catch { toast?.error?.('Copy failed.'); }
  };

  const openProof = (row) => {
    setProofFor(row);
    setSubmittedReference(row?.payment?.submittedReference || '');
    setPayerName(row?.payment?.payerName || '');
    setProofNote(row?.payment?.proofNote || '');
    setProofError(null);
  };

  const submitProof = async () => {
    if (!submittedReference || submittedReference.trim().length < 3) {
      setProofError('Enter the transaction/reference ID from your payment.');
      return;
    }
    setProofBusy(true);
    setProofError(null);
    try {
      const updated = await submitSmsPaymentProof(proofFor.requestId, {
        submittedReference: submittedReference.trim(),
        payerName: payerName.trim(),
        proofNote: proofNote.trim(),
      });
      toast?.success?.('Payment reference submitted for verification.');
      setProofFor(null);
      setWatching(updated || proofFor);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setProofError(caught?.message || 'Could not submit payment reference.');
    } finally {
      setProofBusy(false);
    }
  };

  const poolShort = quote && !quote.canRequest && quote.reason;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="SMS"
        title="Buy SMS credit"
        description="Pay for the messages your school sends to parents. Choose MoMo prompt or manual payment with a reference code for admin verification."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card padding="p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">How many messages?</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500">One unit is one SMS. Unused credit does not expire.</p>

          <div className="mt-4">
            <p className="text-[13px] font-bold text-slate-700">Payment method</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPaymentMethod('mtn')} className={`rounded-xl border px-3 py-2.5 text-left ${paymentMethod === 'mtn' ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                <p className="text-[13px] font-extrabold text-ink">MoMo prompt</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Approve on your phone</p>
              </button>
              <button type="button" onClick={() => setPaymentMethod('manual')} className={`rounded-xl border px-3 py-2.5 text-left ${paymentMethod === 'manual' ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white'}`}>
                <p className="text-[13px] font-extrabold text-ink">Manual payment</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Pay with reference code</p>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={() => setUnits((value) => Math.max(1, Number(value) - 100))} aria-label="Reduce by 100" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"><Minus className="h-4 w-4" aria-hidden="true" /></button>
            <input type="number" min="1" max="200000" step="100" value={units} onChange={(event) => setUnits(event.target.value)} aria-label="Number of SMS units" className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-center text-[18px] font-extrabold tabular-nums text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
            <button type="button" onClick={() => setUnits((value) => Number(value) + 100)} aria-label="Increase by 100" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"><Plus className="h-4 w-4" aria-hidden="true" /></button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[500, 1000, 5000, 10000].map((preset) => (
              <button key={preset} type="button" onClick={() => setUnits(preset)} className={`rounded-lg px-2.5 py-1 text-[12px] font-extrabold transition-colors ${Number(units) === preset ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{formatCount(preset)}</button>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Price</span>
              {quoting ? <span className="text-[12px] font-semibold text-slate-400">updating…</span> : quote ? <span className="text-[22px] font-extrabold tabular-nums text-ink">{formatCedis(quote.totalPes)}</span> : <span className="text-[13px] font-semibold text-slate-400">—</span>}
            </div>
            {quote ? <p className="mt-1.5 text-[12px] font-semibold text-slate-500">{formatCount(quote.units)} SMS at {formatCedis(quote.unitPricePes)} each</p> : null}
            {poolShort ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-800">{poolShort}</p> : quote ? <p className="mt-3 text-[12px] font-semibold text-slate-500">{formatCount(quote.poolAvailable)} units are available on the platform right now.</p> : null}
          </div>

          {paymentMethod === 'mtn' ? (
            <div className="mt-4">
              <label htmlFor="sms-purchase-phone" className="block text-[13px] font-bold text-slate-700">Mobile money number</label>
              <input id="sms-purchase-phone" type="tel" inputMode="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(normalise(event.target.value))} autoComplete="tel-national" placeholder="0241234567" aria-invalid={phoneNumber && !phoneValid ? 'true' : undefined} className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] font-bold tabular-nums text-slate-900 focus:outline-none ${phoneNumber && !phoneValid ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'}`} />
              <p className="mt-1 text-[12px] font-semibold text-slate-500">{phoneValid ? 'The MTN prompt will be sent to this number.' : 'The number that will receive the payment prompt.'}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[13px] font-extrabold text-slate-800">Manual payment (with verification)</p>
              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-600">After you request, you will get a unique payment reference code. Make your payment externally using that code as reference/narration, then submit the transaction reference here for admin verification before credits are released.</p>
            </div>
          )}

          {error ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-semibold leading-relaxed text-red-800 ring-1 ring-inset ring-red-200">{error}</div> : null}

          <Button onClick={openConfirm} disabled={!canSubmit} className="mt-4 w-full" full>
            {submitting ? 'Starting…' : paymentMethod === 'manual' ? `Request ${formatCount(Number(units) || 0)} SMS (manual)` : `Buy ${formatCount(Number(units) || 0)} SMS`}
          </Button>

          <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
            {paymentMethod === 'manual' ? 'Credits are released only after admin verifies your submitted payment reference.' : 'You are not charged until you approve the prompt on your phone.'}
          </p>
        </Card>

        <Card padding="p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">What happens next</h2>
          {paymentMethod === 'manual' ? (
            <ol className="mt-4 space-y-3">
              {[{ title: 'Get your payment reference', body: 'Create the request to receive a unique reference code and amount.' }, { title: 'Pay externally', body: 'Make payment via the approved channel and include the generated reference in the payment narration/reference.' }, { title: 'Submit transaction reference', body: 'Enter the transaction/reference ID you received as proof.' }, { title: 'Admin verifies and releases credit', body: 'Admin confirms payment externally and approves to credit your school.' }].map((step, index) => (
                <li key={step.title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700">{index + 1}</span><div><p className="text-[13px] font-extrabold text-slate-800">{step.title}</p><p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">{step.body}</p></div></li>
              ))}
            </ol>
          ) : (
            <ol className="mt-4 space-y-3">
              {[{ title: 'You approve the MTN prompt', body: 'Nothing is charged until you confirm it on your phone.' }, { title: 'We confirm the payment', body: 'MTN tells us the money arrived. Your request moves to "awaiting approval".' }, { title: 'An administrator releases your credit', body: 'They add the messages to your balance. You are notified the moment they do.' }].map((step, index) => (
                <li key={step.title} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-700">{index + 1}</span><div><p className="text-[13px] font-extrabold text-slate-800">{step.title}</p><p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">{step.body}</p></div></li>
              ))}
            </ol>
          )}
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">If it is declined</p>
            <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">A declined purchase is <strong>refundable in full</strong>. You will be told why and can follow up for the refund.</p>
          </div>
        </Card>
      </div>

      {created?.manual || created?.paymentMethod === 'manual' ? (
        <Card padding="p-5" className="mt-4 border-brand-200 bg-brand-50/30">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Manual payment details</h2>
          <p className="mt-1 text-[13px] font-semibold text-slate-600">Use this generated reference when making payment, then submit your transaction reference for admin verification.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Generated payment reference</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-mono text-[14px] font-extrabold text-ink">{created.paymentReference || created.payment?.reference || '—'}</p>
                {created.paymentReference || created.payment?.reference ? <button type="button" onClick={() => copyText(created.paymentReference || created.payment.reference)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" aria-label="Copy reference"><Copy className="h-3.5 w-3.5" /></button> : null}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Amount to pay</p>
              <p className="mt-1 text-[16px] font-extrabold tabular-nums text-ink">{formatCedis(created.totalPes ?? quote?.totalPes ?? 0)}</p>
              <p className="text-[12px] font-semibold text-slate-500">{formatCount(created.units ?? units)} SMS</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-white p-3 text-[12px] font-semibold leading-relaxed text-slate-600 ring-1 ring-slate-200">
            Pay the exact amount through your approved payment channel and include the generated reference above. After paying, submit the transaction/reference ID you receive so an admin can verify and release the credits.
          </div>
          <div className="mt-3">
            <Button onClick={() => openProof({ ...created, requestId: created.requestId, payment: { ...(created.payment || {}), reference: created.paymentReference || created.payment?.reference } })}>Submit transaction reference</Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Your purchases</h2>
          <div role="tablist" aria-label="Filter purchases" className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} onClick={() => { setStatus(tab.key); setPage(1); }} className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${status === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab.label}</button>
            ))}
          </div>
        </div>

        {history.loading && history.rows.length === 0 ? (
          <div className="space-y-2">{[0, 1].map((key) => (<Card key={key} padding="p-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-100" /><div className="mt-2.5 h-3 w-56 animate-pulse rounded bg-slate-100" /></Card>))}</div>
        ) : null}

        {!history.loading && history.rows.length === 0 ? (
          <EmptyState icon={CreditCard} title={status === 'all' ? 'No purchases yet' : 'Nothing in this filter'} description={status === 'all' ? 'Your purchases will appear here, along with their status.' : 'Try another tab to see the rest of your history.'} />
        ) : null}

        <ul className="space-y-2">
          {history.rows.map((row) => {
            const presentation = STATUS_PRESENTATION[row.status] || STATUS_PRESENTATION[STATUS.CANCELLED];
            const Icon = presentation.icon;
            const isManual = row.payment?.method === 'manual';
            return (
              <li key={row._id}>
                <Card padding="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={presentation.tone} icon={Icon}>{presentation.label}</Badge>
                        <Badge tone="slate">{isManual ? 'Manual' : 'MoMo'}</Badge>
                        <span className="text-[12px] font-bold text-slate-400">{row.requestId}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-extrabold text-ink">{formatCount(row.units)} SMS · <span className="tabular-nums">{formatCedis(row.totalPes)}</span></p>
                      <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">{presentation.next}</p>
                      {row.payment?.reference ? <p className="mt-2 text-[12px] font-semibold text-slate-600">Payment reference: <span className="font-mono font-extrabold text-slate-800">{row.payment.reference}</span></p> : null}
                      {row.payment?.submittedReference ? <p className="mt-1 text-[12px] font-semibold text-slate-600">Submitted transaction ref: <span className="font-mono font-extrabold text-slate-800">{row.payment.submittedReference}</span></p> : null}
                      {isManual && row.status === STATUS.AWAITING_PAYMENT ? (
                        <div className="mt-3">
                          <Button variant="secondary" onClick={() => openProof(row)}>Submit transaction reference</Button>
                        </div>
                      ) : null}
                      {row.status === STATUS.REJECTED && row.rejectionReason ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-red-800">Reason: {row.rejectionReason}</p> : null}
                      {row.refundedAt ? <p className="mt-2 text-[12px] font-bold text-emerald-700">Refunded{row.refundReference ? ` · ${row.refundReference}` : ''}</p> : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>

        {history.meta && history.meta.totalPages > 1 ? <div className="mt-4"><Pagination meta={history.meta} onPageChange={setPage} /></div> : null}
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Confirm this purchase" footer={<><Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button><Button onClick={submit} disabled={submitting}>{submitting ? (paymentMethod === 'manual' ? 'Creating…' : 'Sending prompt…') : (paymentMethod === 'manual' ? 'Create request' : 'Send me the payment prompt')}</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3"><span className="text-[13px] font-bold text-slate-600">SMS messages</span><span className="text-[15px] font-extrabold tabular-nums text-ink">{formatCount(Number(units) || 0)}</span></div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3"><span className="text-[13px] font-bold text-slate-600">Total</span><span className="text-[19px] font-extrabold tabular-nums text-ink">{formatCedis(quote?.totalPes ?? 0)}</span></div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3"><span className="text-[13px] font-bold text-slate-600">Method</span><span className="text-[13px] font-extrabold text-ink">{paymentMethod === 'manual' ? 'Manual payment (reference verification)' : 'MTN MoMo prompt'}</span></div>
            {paymentMethod === 'manual' ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-white px-3 py-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment reference code</p>
                  <p className="mt-0.5 font-mono text-[18px] font-extrabold tracking-widest text-brand-700">{manualRef || '----'}</p>
                </div>
                <button type="button" onClick={() => copyText(manualRef)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" />Copy</button>
              </div>
            ) : null}
          </div>
          {paymentMethod === 'manual' ? (
            <p className="text-[13px] leading-relaxed text-slate-600">Use <strong className="font-mono font-extrabold text-slate-800">{manualRef || 'this code'}</strong> as your payment reference when paying. After payment, submit the transaction/reference ID you receive for admin verification before credits are released.</p>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-slate-600">We will send an MTN payment prompt to <strong className="font-extrabold text-slate-800">{phoneNumber}</strong>. You are not charged until you approve it on your phone.</p>
              <p className="text-[12px] leading-relaxed text-slate-500">An administrator will then release your credit after payment is confirmed.</p>
            </>
          )}
        </div>
      </Modal>

      <Modal open={Boolean(proofFor)} onClose={() => setProofFor(null)} title="Submit payment reference" footer={<><Button variant="ghost" onClick={() => setProofFor(null)}>Cancel</Button><Button onClick={submitProof} disabled={proofBusy}>{proofBusy ? 'Submitting…' : 'Submit for verification'}</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-[12px] font-semibold leading-relaxed text-slate-600">
            Request: <span className="font-mono font-extrabold text-slate-800">{proofFor?.requestId}</span><br />
            Generated payment reference: <span className="font-mono font-extrabold text-slate-800">{proofFor?.payment?.reference || proofFor?.paymentReference || '—'}</span><br />
            Amount: <span className="font-extrabold text-slate-800">{formatCedis(proofFor?.totalPes ?? 0)}</span>
          </div>
          <div>
            <label htmlFor="submitted-ref" className="block text-[13px] font-bold text-slate-700">Transaction/reference ID (from your payment)</label>
            <input id="submitted-ref" type="text" value={submittedReference} onChange={(e) => setSubmittedReference(e.target.value)} placeholder="e.g. bank/MoMo transaction ID" className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
          </div>
          <div>
            <label htmlFor="payer-name" className="block text-[13px] font-bold text-slate-700">Payer name (optional)</label>
            <input id="payer-name" type="text" value={payerName} onChange={(e) => setPayerName(e.target.value)} className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
          </div>
          <div>
            <label htmlFor="proof-note" className="block text-[13px] font-bold text-slate-700">Note (optional)</label>
            <textarea id="proof-note" rows={2} value={proofNote} onChange={(e) => setProofNote(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" />
          </div>
          {proofError ? <p role="alert" className="text-[12px] font-semibold text-red-600">{proofError}</p> : null}
          <p className="text-[12px] font-semibold leading-relaxed text-slate-500">An admin will verify this reference externally before releasing credits. Credits are not added automatically.</p>
        </div>
      </Modal>
    </div>
  );
};

export default SmsCreditRequests;
