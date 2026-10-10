import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import {
  getReceipt,
  downloadReceiptPdf,
  emailReceipt,
  whatsappReceipt,
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
  return `${digits.slice(0, 3)} ••• ${digits.slice(-3)}`;
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

  const student = receipt?.student || {};
  const school = receipt?.school || {};
  const breakdown = useMemo(
    () => (Array.isArray(receipt?.feesBreakdown) ? receipt.feesBreakdown : []),
    [receipt]
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
      success: () => '',
      sent: (to) => `Receipt sent to ${to}`,
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
      success: () => '',
      sent: (to) => `Receipt sent to ${to}`,
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

  const handleWhatsApp = async () => {
    const outcome = await run('whatsapp', () => whatsappReceipt(paymentId), {
      success: () => '',
      sent: (to) => `Receipt sent on WhatsApp to ${maskPhone(to)}`,
      failure: 'Could not send the receipt on WhatsApp.',
    });
    if (outcome.ok) setSentVia((s) => ({ ...s, whatsapp: true }));
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideTitle
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
            >
              {busy === 'download' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Download
            </Button>

            <Button
              variant="secondary"
              onClick={handleEmail}
              disabled={!receipt || anyBusy}
              aria-label="Send receipt by email"
            >
              {busy === 'email' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : sentVia.email ? (
                <CheckCircle2
                  className="mr-2 h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {busy === 'email' ? 'Sending…' : sentVia.email ? 'Sent' : 'Email'}
            </Button>

            <Button
              variant="whatsapp"
              onClick={handleWhatsApp}
              disabled={!receipt || anyBusy}
              aria-label="Send receipt on WhatsApp"
            >
              {busy === 'whatsapp' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : sentVia.whatsapp ? (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {busy === 'whatsapp'
                ? 'Sending…'
                : sentVia.whatsapp
                  ? 'Sent'
                  : 'WhatsApp'}
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
        <div className="relative font-sans text-slate-800">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 top-0 z-30 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* VIEWPORT SCROLL WRAPPER */}
          <div className="max-h-[calc(82vh-90px)] overflow-y-auto p-1">
            
            {/* RECEIPT PAPER CONTAINER */}
            <div className="relative mx-auto my-2 max-w-[600px] overflow-hidden bg-white shadow-md border border-slate-200 rounded-sm text-[12px]">
              
              {/* ACCENT SHAPES (SYSTEM COLOURS) */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500 [clip-path:polygon(100%_0,0_0,100%_100%)] z-0" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-brand-500 [clip-path:polygon(0_100%,0_0,100%_100%)] z-0" />
              <div className="absolute top-0 left-0 w-3 h-full bg-slate-900 z-10" />

              {/* DOCUMENT CONTENT */}
              <div className="relative z-20 pl-8 pr-6 py-8 flex flex-col justify-between min-h-[640px]">
                
                <div>
                  {/* 1. TOP HEADER */}
                  <div className="flex justify-between items-start mb-8">
                    {/* School Brand/Logo */}
                    <div className="flex items-center gap-3">
                      {school.logo ? (
                        <img src={school.logo} alt="" className="h-12 w-12 object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                          {(school.name || 'S').charAt(0)}
                        </div>
                      )}
                      <div>
                        <h1 className="font-extrabold text-[16px] leading-tight text-slate-900 tracking-tight">
                          {school.name || 'School Name'}
                        </h1>
                        <p className="text-[10px] text-slate-500">
                          {[school.address, school.city].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Receipt Title & Date */}
                    <div className="text-right pr-6">
                      <h2 className="text-[26px] font-black uppercase tracking-wider text-brand-600 leading-none">
                        RECEIPT
                      </h2>
                      <p className="text-[11px] font-medium text-slate-600 mt-1">
                        {receiptDate(receipt.date)?.split(',')[0] || '—'}
                      </p>
                    </div>
                  </div>

                  {/* 2. RECIPIENT & RECEIPT METADATA BLOCK */}
                  <div className="flex justify-between items-end mb-8 text-[11px]">
                    <div>
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        NO / RECEIPT REF.
                      </p>
                      <p className="font-mono font-extrabold text-slate-900 text-[12px]">
                        {receipt.receiptNumber || receipt.reference || '—'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        PAID TO
                      </p>
                      <p className="font-extrabold text-[13px] text-slate-900 leading-snug">
                        {student.studentName || '—'}
                      </p>
                      <p className="text-slate-500 text-[10.5px]">
                        ID: <span className="font-mono font-semibold">{student.studentId || '—'}</span>
                        {student.studentClass ? ` • ${student.studentClass}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* 3. ITEM / BREAKDOWN TABLE */}
                  <div className="mb-8">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-y-2 border-slate-900 text-[10px] uppercase font-black tracking-wider text-slate-900">
                          <th className="py-2 px-1">DESCRIPTION</th>
                          <th className="py-2 px-1 text-center w-16">QTY</th>
                          <th className="py-2 px-1 text-right w-24">PRICE</th>
                          <th className="py-2 px-1 text-right w-28">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11.5px]">
                        {breakdown.length > 0 ? (
                          breakdown.map((line, index) => (
                            <tr key={index}>
                              <td className="py-3 px-1 font-semibold text-slate-800">
                                {line.description || line.label || 'Fee Item'}
                              </td>
                              <td className="py-3 px-1 text-center font-medium text-slate-600">1</td>
                              <td className="py-3 px-1 text-right font-mono text-slate-600">
                                {formatCedi(line.amount)}
                              </td>
                              <td className="py-3 px-1 text-right font-mono font-bold text-slate-900">
                                {formatCedi(line.amount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-3 px-1 font-semibold text-slate-800">
                              {receipt.description || receipt.notes || 'School Fee Payment'}
                            </td>
                            <td className="py-3 px-1 text-center font-medium text-slate-600">1</td>
                            <td className="py-3 px-1 text-right font-mono text-slate-600">
                              {formatCedi(receipt.amount)}
                            </td>
                            <td className="py-3 px-1 text-right font-mono font-bold text-slate-900">
                              {formatCedi(receipt.amount)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="border-b border-slate-900 w-full mt-1" />
                  </div>

                  {/* 4. TOTALS & PAYMENT DETAILS */}
                  <div className="flex justify-between items-start gap-4 mb-6">
                    {/* Payment Method & Notes */}
                    <div className="max-w-[240px] space-y-3">
                      <div>
                        <h4 className="font-bold text-[11px] text-slate-900 uppercase">Payment Method</h4>
                        <p className="text-[10.5px] text-slate-600 mt-0.5 uppercase font-medium">
                          {receipt.paymentMethod === 'momo'
                            ? 'Mobile Money'
                            : receipt.paymentMethod || 'Standard'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-bold text-[11px] text-slate-900 uppercase">Notes</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          Thank you for your payment. This receipt confirms full settlement for the fees listed above.
                        </p>
                      </div>
                    </div>

                    {/* Calculation Summary */}
                    <div className="w-56 space-y-2 text-right">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-slate-600">Sub Total</span>
                        <span className="font-mono font-bold text-slate-800">{formatCedi(receipt.amount)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-slate-600">Tax / Discount</span>
                        <span className="font-mono text-slate-500">{formatCedi(0)}</span>
                      </div>

                      {/* GRAND TOTAL BADGE */}
                      <div className="mt-3 bg-brand-600 text-white rounded-md px-3 py-2 flex justify-between items-center shadow-sm">
                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider">
                          GRAND TOTAL
                        </span>
                        <span className="text-[15px] font-black font-mono tracking-tight">
                          {formatCedi(receipt.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. BRAND FOOTER */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <LogoMark className="h-3.5 w-3.5" />
                    <span className="font-bold tracking-tight text-slate-700">SukuuPay</span>
                  </div>
                  <span className="italic">Sukuu Sika Mu Nti</span>
                </div>

              </div>
            </div>

          </div>

          {/* INLINE EMAIL PROMPT */}
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
              <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                The address is saved to the parent&rsquo;s record so the next
                receipt does not ask again.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <label htmlFor="receipt-parent-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="receipt-parent-email"
                  ref={emailInputRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={emailDraft}
                  onChange={(event) => {
                    setEmailDraft(event.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  disabled={anyBusy}
                  placeholder="parent@example.com"
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'receipt-email-error' : undefined}
                  className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
                />
                <Button type="submit" size="sm" disabled={anyBusy}>
                  {busy === 'email' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
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
              {emailError && (
                <p id="receipt-email-error" className="mt-1 text-[10.5px] font-semibold text-red-600">
                  {emailError}
                </p>
              )}
            </form>
          )}

        </div>
      )}
    </Modal>
  );
};

export default ReceiptDialog;