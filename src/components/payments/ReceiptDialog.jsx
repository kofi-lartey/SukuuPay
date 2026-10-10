import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { getReceipt } from '../../services/payments';
import { formatCedi } from '../../utils/format';
import { formatDateTime } from '../../utils/dates';
import { PaymentDetailRow as Row } from './PaymentDetailDrawer';

/**
 * A payment's receipt.
 *
 * `GET /payments/:paymentId/receipt` returns JSON, not a PDF. This dialog
 * renders the receipt document from the returned data and `window.print()` is
 * how a bursar gets a paper copy. Calling the endpoint is also what mints the
 * receipt number on first view, so a payment taken before receipts existed gets
 * one the moment a bursar opens it.
 *
 * The layout mirrors `Backend/src/utils/receiptService.js` section for section —
 * brand band, school header with logo, title, amount box, RECEIVED FROM,
 * RECEIPT, fee breakdown, footer — so the modal a bursar screenshots and the
 * PDF a parent downloads are the same document.
 */

// One date, one format. `formatDate` alone produces "09 Oct 2026"; the previous
// version concatenated `formatDate` and `formatDateTime` on the same timestamp,
// producing "09 Oct 2026 · 09 Oct 2026, 11:14 am" — two dates joined with a dot
// separator, on a receipt that recorded one moment in time.
const receiptDate = (value) => (value ? formatDateTime(value) : undefined);

const SchoolLogo = ({ logo, name, brandColor = '#0A5C36' }) => {
  const [errored, setErrored] = useState(false);
  const initial = (String(name || 'S').trim().charAt(0) || 'S').toUpperCase();

  if (logo && !errored) {
    return (
      <img
        src={logo}
        alt=""
        onError={() => setErrored(true)}
        className="h-12 w-12 shrink-0 rounded-md object-contain ring-1 ring-slate-200"
      />
    );
  }

  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-xl font-extrabold text-white"
      style={{ backgroundColor: brandColor }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
};

const ReceiptDialog = ({ open, paymentId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !paymentId) return undefined;

    let active = true;
    setLoading(true);
    setError(null);
    setReceipt(null);

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

  if (!open) return null;

  const student = receipt?.student || {};
  const school = receipt?.school || {};
  const breakdown = Array.isArray(receipt?.feesBreakdown) ? receipt.feesBreakdown : [];
  const brandColor = school.brandColor || '#0A5C36';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment receipt"
      description={
        receipt?.receiptNumber ? `Receipt ${receipt.receiptNumber}` : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()} disabled={!receipt}>
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            Print
          </Button>
        </>
      }
    >
      {loading && (
        <div className="space-y-4">
          <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-red-700">{error.message}</p>
        </div>
      )}

      {!loading && !error && receipt && (
        <div className="space-y-5">
          {/* ── School header with logo ── */}
          <div className="flex items-start gap-3">
            <SchoolLogo
              logo={school.logo}
              name={school.name}
              brandColor={brandColor}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-extrabold text-ink">
                {school.name || 'School'}
              </p>
              {school.address && (
                <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-500">
                  {school.address}
                </p>
              )}
              {(school.city || school.region) && (
                <p className="truncate text-[12px] font-semibold text-slate-500">
                  {[school.city, school.region].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-slate-100" aria-hidden="true" />

          {/* ── Amount box ── */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Amount received
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums text-ink">
              {formatCedi(receipt.amount)}
            </p>
          </div>

          {/* ── RECEIVED FROM ── */}
          <section>
            <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Received from
            </h3>
            <dl>
              <Row label="Student" value={student.studentName} />
              <Row label="Student ID" value={student.studentId} mono />
              <Row label="Class" value={student.studentClass} />
            </dl>
          </section>

          {/* ── RECEIPT ── */}
          <section>
            <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Receipt
            </h3>
            <dl>
              <Row label="Receipt number" value={receipt.receiptNumber} mono />
              <Row label="Payment ref" value={receipt.paymentId} mono />
              <Row label="Date" value={receiptDate(receipt.date)} />
              <Row
                label="Method"
                value={
                  receipt.paymentMethod === 'momo'
                    ? 'Mobile Money'
                    : receipt.paymentMethod
                }
              />
              <Row label="Description" value={receipt.description || receipt.notes} />
            </dl>
          </section>

          {/* ── Fee breakdown (only when it has more than one line) ── */}
          {breakdown.length > 1 && (
            <section>
              <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Fee breakdown
              </h3>
              <ul className="divide-y divide-slate-100">
                {breakdown.map((line, index) => (
                  <li
                    // Fee items have no id, and a duplicate label is entirely
                    // possible on a split bill, so the index is the only stable
                    // key available here.
                    key={`${line.description || line.label || 'item'}-${index}`}
                    className="flex items-center justify-between gap-3 py-2 text-[13px]"
                  >
                    <span className="font-semibold text-slate-700">
                      {line.description || line.label || 'Fee item'}
                    </span>
                    <span className="font-extrabold tabular-nums text-ink">
                      {formatCedi(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Reconciliation note — matches the PDF. */}
              {(() => {
                const total = breakdown.reduce(
                  (sum, line) => sum + (Number(line.amount) || 0),
                  0
                );
                if (total === (Number(receipt.amount) || 0)) return null;
                return (
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    Note: the fee lines above total {formatCedi(total)}, which
                    differs from the amount charged.
                  </p>
                );
              })()}
            </section>
          )}

          {/* ── Footer ── */}
          <p className="border-t border-slate-100 pt-3 text-center text-[11px] font-semibold text-slate-400">
            Thank you. Please keep this receipt for your records.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default ReceiptDialog;