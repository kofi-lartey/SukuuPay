import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { getReceipt } from '../../services/payments';
import { formatCedi } from '../../utils/format';
import { formatDate, formatDateTime } from '../../utils/dates';
import { PaymentDetailRow as Row } from './PaymentDetailDrawer';

/**
 * A payment's receipt.
 *
 * **`GET /payments/:paymentId/receipt` returns JSON, not a PDF.** This dialog
 * was previously asking for `responseType: 'blob'` and handing the JSON body to
 * `URL.createObjectURL`, so a bursar downloaded a corrupt file named
 * `receipt-….pdf` — and nothing looked broken, because the request genuinely
 * succeeded. The receipt document is rendered here from the returned data
 * instead, and `window.print()` is the PDF.
 *
 * Calling the endpoint is also what *mints* the receipt number: a payment taken
 * before receipts existed gets its number on first view, so a bursar never has to
 * know whether a number exists before they can print one.
 */
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment receipt"
      description={receipt?.receiptNumber ? `Receipt ${receipt.receiptNumber}` : undefined}
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
      {loading && <div className="h-40 animate-pulse rounded-lg bg-slate-100" />}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-[13px] font-semibold text-red-700">{error.message}</p>
        </div>
      )}

      {!loading && !error && receipt && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {school.name || 'School'}
            </p>
            {school.address && (
              <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{school.address}</p>
            )}
            {school.city && (
              <p className="text-[12px] font-semibold text-slate-500">
                {[school.city, school.region].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Amount received
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight tabular-nums text-ink">
              {formatCedi(receipt.amount)}
            </p>
          </div>

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

          <section>
            <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Receipt
            </h3>
            <dl>
              <Row label="Receipt number" value={receipt.receiptNumber} mono />
              <Row label="Payment ref" value={receipt.paymentId} mono />
              <Row
                label="Date"
                value={
                  receipt.date
                    ? `${formatDate(receipt.date)} · ${formatDateTime(receipt.date)}`
                    : undefined
                }
              />
              <Row label="Method" value={receipt.paymentMethod} />
              <Row label="Description" value={receipt.description} />
            </dl>
          </section>

          {breakdown.length > 0 && (
            <section>
              <h3 className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                What it paid for
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
            </section>
          )}

          <p className="border-t border-slate-100 pt-3 text-center text-[11px] font-semibold text-slate-400">
            Thank you. Please keep this receipt for your records.
          </p>
        </div>
      )}
    </Modal>
  );
};

export default ReceiptDialog;