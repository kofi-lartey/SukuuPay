import React, { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { sendBulk } from '../../../services/sms';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { formatCount } from '../../../utils/format';

/**
 * The overdue-reminder prompt.
 *
 * The one card on the Overview whose primary action is irreversible and
 * expensive — 87 SMS, billed per message, to real parents — so the button opens
 * a confirmation rather than sending. The dialog states the recipient count and
 * the remaining credit before anything leaves the school, because a bursar who
 * fires this at the wrong moment cannot unsend it.
 *
 * The send then goes through `services/sms.js`, which throws
 * `SMS_SEND_NOT_SUPPORTED` on a 404/405 because the API has no school-facing
 * send route. That error is surfaced as a warning toast rather than swallowed:
 * the button is live and the wiring is real, so if the route lands tomorrow this
 * card works with no change, and until then it says so instead of reporting a
 * success for messages that were never sent.
 */
const BroadcastSmsCard = ({ broadcast, isDemo }) => {
  const { user } = useAuth();
  const { warning, error: errorToast, success } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const runSend = async () => {
    setConfirming(false);

    if (!user?.schoolId) {
      warning('This account is not linked to a school yet, so there is nobody to notify.');
      return;
    }

    setSending(true);
    try {
      await sendBulk(user.schoolId, { overdueOnly: true }, broadcast.preview);
      success(`Reminder queued for ${formatCount(broadcast.recipientCount)} parents.`);
    } catch (err) {
      if (err?.code === 'SMS_SEND_NOT_SUPPORTED') {
        warning(err.message);
      } else {
        errorToast(err?.message || 'The reminders could not be sent.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card padding="p-5" className="border-red-100 bg-red-50/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <h3 className="text-base font-extrabold leading-tight tracking-tight text-ink">
              Broadcast SMS Prompt
            </h3>
          </div>
          <Badge tone="amber">{formatCount(broadcast.creditUnits)} units</Badge>
        </div>

        <p className="mt-4 text-[13px] font-extrabold text-red-600">
          {formatCount(broadcast.recipientCount)} Overdue Students detected
        </p>

        <div className="mt-3 rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            Template Preview: {broadcast.templateName}
          </p>
          <p className="mt-1.5 text-[12px] italic leading-relaxed text-slate-600">
            “{broadcast.preview}”
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={sending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send Overdue Fee SMS Prompt
        </button>

        {isDemo && (
          <p className="mt-2 text-[11px] font-semibold text-slate-500">
            Recipient count is demo data. Sending is not available on the API yet.
          </p>
        )}
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send the overdue reminder?"
        description="This messages real parents and cannot be unsent."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runSend}>
              Send to {formatCount(broadcast.recipientCount)} parents
            </Button>
          </>
        }
      >
        <dl className="space-y-2.5 text-sm">
          {[
            { label: 'Recipients', value: `${formatCount(broadcast.recipientCount)} parents` },
            { label: 'Messages used', value: formatCount(broadcast.recipientCount) },
            { label: 'Credit remaining after', value: formatCount(broadcast.creditUnits - broadcast.recipientCount) },
          ].map((row) => (
            <div key={row.label} className="flex justify-between gap-4">
              <dt className="font-medium text-slate-500">{row.label}</dt>
              <dd className="font-extrabold text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
};

export default BroadcastSmsCard;
