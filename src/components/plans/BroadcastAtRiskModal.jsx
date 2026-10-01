import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, Megaphone } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../dashboard/ui/Badge';
import { previewAudience, sendBulkSms } from '../../services/sms';
import { formatCediShort, formatCount } from '../../utils/format';

/**
 * Chase the at-risk families in one message.
 *
 * The compliance dashboard's footer action, and the reason it exists as a
 * *broadcast* rather than eleven row-level buttons: chasing overdue families one
 * at a time is eleven minutes of clicking that a bursar will not do, so the ones
 * with the least money owed get chased last or never. One action, one
 * confirmation, the same cost and the same audit trail as any other send.
 *
 * **The audience is `at_risk`, not `overdue`.** A family whose tranche is due in
 * two days and one whose tranche slipped a fortnight ago both need chasing, at
 * different tones; a chaser that only reaches the second group has arrived a week
 * late by definition. The service defines `at_risk` as "slipped a tranche, or has
 * one coming due inside the window", and the live count below is that rule's own
 * answer — so the number in the confirmation is the number that will be messaged.
 *
 * The count is a live preview rather than a sum of the visible page, for the same
 * reason the KPI tiles do not sum the page: the table shows twenty of 176.
 */
const BroadcastAtRiskModal = ({ open, onClose, onSent }) => {
  const [horizon, setHorizon] = useState(5);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  // The copy a chaser sends. Final Warning is the platform preset for exactly
  // this case, and its own category is `final_warning`, so the send lands in the
  // SMS history under a reason a bursar can filter by later.
  const BODY =
    "Dear {parentName}, a payment plan installment for {studentName} at {schoolName} is now due. GHC {balance} is outstanding. Please pay securely via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}";

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSent(null);
      setError(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    previewAudience({ type: 'at_risk', minBalance: 1, dueSoonDays: horizon })
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, horizon]);

  const run = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendBulkSms({
        audience: { type: 'at_risk', minBalance: 1, dueSoonDays: horizon },
        body: BODY,
        category: 'final_warning',
      });
      setSent(result);
      onSent?.(result);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };

  const count = preview?.matchCount ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={sent ? 'Chaser queued' : 'Chase the at-risk families'}
      description={
        sent
          ? undefined
          : 'One SMS to every family with a slipped or imminent installment. This cannot be unsent.'
      }
      footer={
        sent ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={run}
              disabled={sending || loading || count === 0}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  Queueing…
                </>
              ) : (
                `Send to ${formatCount(count)} parents`
              )}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="space-y-3">
          <p className="text-[13px] font-medium leading-relaxed text-slate-600">
            {formatCount(sent.job?.recipients ?? 0)} reminders queued for{' '}
            {formatCediShort(sent.job?.creditsCharged ?? 0)} of SMS credit.{' '}
            {formatCount(sent.job?.balanceAfter ?? 0)} SMS left.
          </p>
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-600">
            Track delivery on the SMS Reminders module — the History tab shows each
            message&rsquo;s status and refunds any credit the carrier could not deliver.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700">
              {error.message}
            </p>
          )}

          <dl className="space-y-2.5 text-[13px]">
            {[
              {
                label: 'Audience',
                value: 'Slipped a tranche, or one is due inside the window',
              },
              { label: 'Recipients', value: loading ? 'Sizing…' : `${formatCount(count)} parents` },
              { label: 'Message', value: 'Final Warning (platform preset)' },
              { label: 'Arrears in scope', value: formatCediShort(preview?.totalBalance ?? 0) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="font-medium text-slate-500">{row.label}</dt>
                <dd className="text-right font-extrabold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>

          {/* The window is exposed because "at risk" is a judgement, and a bursar
              who wants next week rather than this week needs to say so. Widening it
              reaches more families and costs more; the count above updates. */}
          <div className="mt-4">
            <label
              className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
              htmlFor="at-risk-horizon"
            >
              Treat a tranche as imminent when due within
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[3, 5, 7, 14].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setHorizon(days)}
                  aria-pressed={horizon === days}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition-colors ${
                    horizon === days
                      ? 'border-brand-700 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-600">
            <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            Parents who paid in the last 48 hours are excluded automatically, so a
            family that settled this morning is not told it is behind.
          </p>

          {preview?.skipped?.invalid_number > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              {formatCount(preview.skipped.invalid_number)} matched famil
              {preview.skipped.invalid_number === 1 ? 'y has' : 'ies have'} a number that will
              not normalise and will not be reached.
            </p>
          )}

          {!loading && count === 0 && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-800">
              Nothing is at risk right now — no family has a slipped or imminent
              installment. That is the good outcome.
            </p>
          )}
        </>
      )}
    </Modal>
  );
};

export default BroadcastAtRiskModal;
