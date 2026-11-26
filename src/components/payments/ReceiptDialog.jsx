import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  Loader2,
  Mail,
  MessageCircle,
  Send,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import {
  getReceipt,
  downloadReceiptPdf,
  emailReceipt,
} from '../../services/payments';
import { formatCedi } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';
import useToast from '../../hooks/useToast';
import { LogoMark } from '../common/Logo';

/**
 * A payment's receipt styled in a modern, clean document aesthetic.
 */

const SUCCESS_TICK_MS = 3500;

const receiptDate = (value) => (value ? formatDateTime(value) : undefined);

const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const maskPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 6) return value || '';
  return `${digits.slice(0, 4)} •••• ${digits.slice(-2)}`;
};

/**
 * Normalises a Ghanaian phone number to the `wa.me` MSISDN format.
 *
 * `wa.me` needs digits only, no `+`, no spaces, no leading zeros — and it
 * needs the country code. Ghanaian local numbers start with `0` followed by
 * 9 digits (`024…`, `054…`, `020…`); the international form drops the `0`
 * and prefixes `233`. Numbers already in international form (`233…`) pass
 * through untouched.
 */
const toWhatsAppMsisdn = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return `233${digits.slice(1)}`;
  return digits;
};

// ─────────────────────────────────────────────────────────────────────────────
// Recipient chip
// ─────────────────────────────────────────────────────────────────────────────

const RecipientChip = ({ kind, value, onEdit, disabled, missing }) => {
  const Icon = kind === 'email' ? Mail : MessageCircle;
  const masked = kind === 'phone' ? maskPhone(value) : value;

  return (
    <div className="flex min-w-0 max-w-[200px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
      <Icon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
      <span
        className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${
          missing ? 'italic text-slate-400' : 'text-slate-700'
        }`}
        title={missing ? undefined : masked}
      >
        {missing ? `No ${kind}` : masked}
      </span>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="shrink-0 text-[10px] font-extrabold text-brand-700 hover:underline disabled:opacity-50"
        >
          {missing ? 'Add' : 'Edit'}
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────────────

const money = (value) =>
  `GH₵ ${((Number(value) || 0) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildReceiptHtml = (receipt, student, school) => {
  const receiptRef = receipt?.receiptNumber || receipt?.reference || '—';
  const date = receipt?.date || receipt?.createdAt || new Date();
  const d = new Date(date);
  const dateStr = Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const studentName = student?.studentName || '—';
  const studentId = student?.studentId || '—';
  const className = student?.studentClass || '';
  const schoolName = school?.name || 'School';
  const schoolAddress = [school?.address, school?.city].filter(Boolean).join(', ');
  const method = receipt?.paymentMethod === 'momo' ? 'Mobile Money' : receipt?.paymentMethod || 'Standard';
  const amount = Number(receipt?.amount || 0);
  const totalFees = Number(receipt?.totalFees ?? student?.totalOwed ?? amount);
  const amountAlreadyPaid = Number(student?.totalPaid ?? receipt?.paidToDate ?? 0);
  const amountLeftToPay = Math.max(0, totalFees - amountAlreadyPaid);
  const amountPaidToday = amount;
  const balance = Math.max(0, amountLeftToPay - amountPaidToday);
  const description = receipt?.description || receipt?.notes || 'School Fee Payment';
  const lines = Array.isArray(receipt?.feesBreakdown) && receipt.feesBreakdown.length
    ? receipt.feesBreakdown.map((l) => `<tr><td class="c-no">1</td><td>${l.description || l.label || 'Fee Item'}</td><td class="c-num">1</td><td class="c-num">${money(l.amount)}</td><td class="c-num">${money(l.amount)}</td></tr>`).join('')
    : `<tr><td class="c-no">1</td><td>${description}</td><td class="c-num">1</td><td class="c-num">${money(amount)}</td><td class="c-num">${money(amount)}</td></tr>`;
  const emptyRows = '<tr class="empty"><td colspan="5">&nbsp;</td></tr>'.repeat(3);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${receiptRef}</title><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Century Gothic", "Futura", "Segoe UI", Arial, sans-serif; color: #4a5a52; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; position: relative; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { font-size: 52px; font-weight: 300; letter-spacing: 8px; margin: 0; }
  .logo { width: 80px; height: 80px; border-radius: 50%; background: #c9dcc4; display: flex; align-items: center; justify-content: center; font-size: 11px; overflow: hidden; }
  .logo img { width: 100%; height: 100%; object-fit: cover; }
  .bar { background: #c9dcc4; display: flex; justify-content: space-between; padding: 5px 8px; margin: 22px 0 18px; font-size: 11px; letter-spacing: 1px; }
  .bar b { font-weight: 700; }
  .cols { display: flex; gap: 24px; font-size: 12px; line-height: 1.7; }
  .cols > div { flex: 1; }
  .cols h4 { margin: 0 0 4px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }
  .muted { opacity: .8; }
  .pm span { display: block; padding-left: 16px; position: relative; }
  .pm span.on::before { content: "X"; position: absolute; left: 0; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 12px; }
  thead th { text-align: left; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 6px; border-top: 3px solid #c9dcc4; border-bottom: 3px solid #c9dcc4; }
  td { padding: 10px 6px; border-bottom: 1px solid #c9dcc4; }
  .c-no { width: 8%; }
  .c-num, th.c-num { text-align: right; }
  .totals { margin: 18px 0 0 auto; width: 60%; font-size: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 8px; }
  .totals .grand { background: #c9dcc4; font-weight: 700; letter-spacing: 1px; }
  .totals .balance { background: #4a5a52; color: #fff; font-weight: 700; letter-spacing: 1px; margin-top: 6px; }
  .notes { margin-top: 26px; font-size: 11.5px; line-height: 1.6; }
  .thanks { text-align: center; letter-spacing: 5px; font-size: 20px; margin-top: 50px; }
  @media print { .page { box-shadow: none; } }
  </style></head><body><div class="page">
  <div class="head"><h1>RECEIPT</h1>${school?.logo ? `<div class="logo"><img src="${school.logo}" alt="logo" /></div>` : '<div class="logo">LOGO</div>'}</div>
  <div class="bar"><span><b>RECEIPT REF.</b> ${receiptRef}</span><span><b>DATE:</b> ${dateStr}</span></div>
  <div class="cols">
    <div><h4>${schoolName}</h4><div class="muted">${schoolAddress}</div></div>
    <div><h4>Paid To</h4><div>${studentName}</div><div class="muted">ID: ${studentId} • ${className}</div></div>
    <div class="pm"><h4>Payment Method</h4><span class="on">${method}</span><span>Cash</span><span>Bank Transfer</span><span>Other</span></div>
  </div>
  <table><thead><tr><th>No.</th><th>Description</th><th class="c-num">Qty</th><th class="c-num">Price</th><th class="c-num">Total</th></tr></thead><tbody>${lines}${emptyRows}</tbody></table>
  <div class="totals">
    <div><span>TOTAL FEES</span><span>${money(totalFees)}</span></div>
    <div><span>AMOUNT ALREADY PAID</span><span>${money(amountAlreadyPaid)}</span></div>
    <div><span>AMOUNT LEFT TO PAY</span><span>${money(amountLeftToPay)}</span></div>
    <div><span>AMOUNT PAID TODAY</span><span>${money(amountPaidToday)}</span></div>
    <div class="balance"><span>REMAINING BALANCE</span><span>${money(balance)}</span></div>
  </div>
  <div class="notes"><b>Notes</b><br>Thank you for your payment. This receipt confirms ${balance > 0 ? 'part payment' : 'full settlement'}. The remaining balance is shown above.</div>
  <div class="thanks">THANK YOU</div>
</div></body></html>`;
};

const ReceiptDialog = ({ open, paymentId, onClose }) => {
  const toast = useToast();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [sentVia, setSentVia] = useState({ email: false, whatsapp: false });

  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState(null);
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (!open || !paymentId) return undefined;

    let active = true;
    setLoading(true);
    setError(null);
    setReceipt(null);
    setBusy(null);
    setSentVia({ email: false, whatsapp: false });
    setEmailPromptOpen(false);
    setEmailDraft('');
    setEmailError(null);

    getReceipt(paymentId)
      .then((result) => {
        if (active) setReceipt(result);
      })
      .catch((apiError) => {
        if (active) setError(apiError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, paymentId]);

  useEffect(() => {
    if (emailPromptOpen) emailInputRef.current?.focus();
  }, [emailPromptOpen]);

  useEffect(() => {
    if (!sentVia.email && !sentVia.whatsapp) return undefined;
    const t = setTimeout(
      () => setSentVia({ email: false, whatsapp: false }),
      SUCCESS_TICK_MS
    );
    return () => clearTimeout(t);
  }, [sentVia]);

  const receiptData = receipt?.receipt || receipt || {};
  const student = receiptData?.student || receipt?.student || {};
  const school = receiptData?.school || receipt?.school || {};
  const studentName = student?.studentName || '—';
  const studentId = student?.studentId || '—';
  const className = student?.studentClass || '';
  const breakdown = useMemo(
    () => (Array.isArray(receiptData?.feesBreakdown) ? receiptData.feesBreakdown : []),
    [receiptData]
  );
  const hasParentEmail = Boolean(student.parentEmail);
  const hasParentPhone = Boolean(student.parentPhone);
  const anyBusy = busy !== null;

  const run = async (kind, action, messages) => {
    if (!paymentId || anyBusy) return { ok: false, skipped: true };
    setBusy(kind);
    try {
      const result = await action();
      const to = result?.to;
      const filename = result?.filename;
      toast.success(filename ? messages.success(filename) : messages.sent(to));
      return { ok: true, result };
    } catch (err) {
      toast.error(err.message || messages.failure);
      return { ok: false, error: err };
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = () =>
    run('download', () => downloadReceiptPdf(paymentId, receipt?.receiptNumber), {
      success: (filename) => `Downloaded ${filename}`,
      sent: () => '',
      failure: 'Could not download the receipt.',
    });

  const handleEmail = async () => {
    if (!hasParentEmail) {
      setEmailPromptOpen(true);
      setEmailError(null);
      return;
    }
    const outcome = await run('email', () => emailReceipt(paymentId), {
      success: () => 'Opening your email client',
      sent: (to) => `Opening email to ${to}`,
      failure: 'Could not email the receipt.',
    });
    if (outcome.ok) setSentVia((s) => ({ ...s, email: true }));
    else if (outcome.error?.code === 'PARENT_EMAIL_REQUIRED')
      setEmailPromptOpen(true);
  };

  const submitEmailPrompt = async (event) => {
    event.preventDefault();
    const candidate = emailDraft.trim();
    if (!looksLikeEmail(candidate)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailError(null);
    const outcome = await run('email', () => emailReceipt(paymentId, candidate), {
      success: () => 'Opening your email client',
      sent: (to) => `Opening email to ${to}`,
      failure: 'Could not email the receipt.',
    });
    if (outcome.ok) {
      setReceipt((current) =>
        current
          ? { ...current, student: { ...current.student, parentEmail: candidate } }
          : current
      );
      setSentVia((s) => ({ ...s, email: true }));
      setEmailPromptOpen(false);
      setEmailDraft('');
      setEmailError(null);
    } else if (outcome.error?.code === 'PARENT_EMAIL_REQUIRED') {
      setEmailError('That address was not accepted. Check it and try again.');
    }
  };

  const handleWhatsApp = () => {
    if (anyBusy) return;

    const msisdn = toWhatsAppMsisdn(student.parentPhone);
    if (!msisdn) {
      toast.error('No parent phone number on record for WhatsApp.');
      return;
    }

    // Pre-filled message the parent will see. wa.me only supports a plain
    // `text` query param, so keep the message concise but informative.
    const receiptRef = receiptData?.receiptNumber || receiptData?.reference || paymentId;
    const amountPaidToday = Number(receiptData?.amount || 0) / 100;
    const totalFees = Number(student?.totalOwed || 0) / 100;
    const alreadyPaid = Number(student?.totalPaid || 0) / 100;
    const leftToPay = Math.max(0, totalFees - alreadyPaid);
    const balance = Math.max(0, leftToPay - amountPaidToday);
    const message = `Hello ${studentName}, your payment receipt ${receiptRef} from ${school?.name || 'school'} is ready.\nTotal Fees: GHc ${totalFees.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nAmount Paid Today: GHc ${amountPaidToday.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nAlready Paid: GHc ${alreadyPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nRemaining Balance: GHc ${balance.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const url = `https://wa.me/${msisdn}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSentVia((s) => ({ ...s, whatsapp: true }));
    toast.success(`Opening WhatsApp for ${maskPhone(student.parentPhone)}`);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideTitle
      hideClose
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <RecipientChip
              kind="email"
              value={student.parentEmail}
              missing={!hasParentEmail}
              disabled={anyBusy}
              onEdit={() => {
                setEmailPromptOpen(true);
                setEmailDraft(student.parentEmail || '');
                setEmailError(null);
              }}
            />
            {hasParentPhone && (
              <RecipientChip
                kind="phone"
                value={student.parentPhone}
                disabled={anyBusy}
              />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownload}
              disabled={!receipt || anyBusy}
              aria-label="Download receipt as PDF"
              title="Download receipt as PDF"
              className="!px-3"
            >
              {busy === 'download' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">Download</span>
            </Button>

            <Button
              variant="secondary"
              onClick={handleEmail}
              disabled={!receipt || anyBusy}
              aria-label="Send receipt by email"
              title="Send receipt by email"
              className="!px-3"
            >
              {busy === 'email' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : sentVia.email ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {busy === 'email' ? 'Sending…' : sentVia.email ? 'Sent' : 'Email'}
              </span>
            </Button>

            <Button
              variant="whatsapp"
              onClick={handleWhatsApp}
              disabled={!receipt || anyBusy || !hasParentPhone}
              aria-label="Send receipt on WhatsApp"
              title="Send receipt on WhatsApp"
              className="!px-3"
            >
              {sentVia.whatsapp ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {sentVia.whatsapp ? 'Sent' : 'WhatsApp'}
              </span>
            </Button>
          </div>
        </div>
      }
    >
      {loading && (
        <div className="space-y-4 p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-32 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] font-semibold text-red-700">{error.message}</p>
        </div>
      )}

      {!loading && !error && receipt && (
        <>
          <iframe
            title="Receipt preview"
            srcDoc={buildReceiptHtml(receiptData, student, school)}
            className="h-[720px] w-full border-0"
          />
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[13px] font-semibold text-slate-900">
                {studentName}
              </span>
              <span className="text-[12px] text-slate-500">
                {studentId} &middot; {maskPhone(student.parentPhone || '')}
              </span>
            </div>
            <div className="text-[12px] text-slate-500 mb-3">
              {className || '—'}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div>
                <span className="block text-slate-500">Total Fees</span>
                <span className="block font-semibold text-slate-900">
                  {money(Number(student?.totalOwed || 0))}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">Amount Already Paid</span>
                <span className="block font-semibold text-slate-900">
                  {money(Number(student?.totalPaid || 0))}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">Remaining Fees to Pay</span>
                <span className="block font-semibold text-slate-900">
                  {money(Number(student?.balance || 0))}
                </span>
              </div>
            </div>
          </div>
          {emailPromptOpen && (
            <form
              onSubmit={submitEmailPrompt}
              className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3"
            >
              <p className="text-[12px] font-extrabold text-amber-900">
                {hasParentEmail
                  ? 'Send to a different email'
                  : 'This parent has no email address on record'}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  id="receipt-parent-email"
                  ref={emailInputRef}
                  type="email"
                  value={emailDraft}
                  onChange={(event) => {
                    setEmailDraft(event.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  disabled={anyBusy}
                  placeholder="parent@example.com"
                  className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-800"
                />
                <Button type="submit" size="sm" disabled={anyBusy}>
                  Send
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailPromptOpen(false);
                    setEmailDraft('');
                    setEmailError(null);
                  }}
                  disabled={anyBusy}
                  className="text-[11px] font-extrabold text-amber-800 hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {emailError && <p className="mt-1 text-[10.5px] font-semibold text-red-600">{emailError}</p>}
            </form>
          )}
        </>
      )}

    </Modal>
  );
};

export default ReceiptDialog;