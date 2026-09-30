import React, { useState } from 'react';
import { Bell, Send } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { sendBulk } from '../../../services/sms';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * The overdue-reminder prompt.
 *
 * The one card on the Overview whose primary action is irreversible and
 * expensive — SMS to real parents, billed per message — so the button opens a
 * confirmation rather than sending, and the dialog states the recipient count
 * before anything leaves the school. A bursar who fires this at the wrong moment
 * cannot unsend it.
 *
 * **The recipient count is `GET /reports/outstanding/:schoolId`.** It used to be
 * 87 from `data/dashboardDemo.js`, on a card that then said "1,420 units" of
 * credit and previewed a template called "Overdue MoMo Prompt #1" with a written
 * out SMS body. None of that existed: the fixture's own "demo data" caption was
 * gated on the page-level `isDemo` flag, which went false on the first successful
 * request, so a bursar saw a real-looking 87 and a real-looking template on a
 * live deployment. The credit in particular was `school.sms.balance` with no
 * endpoint behind it, and the template is a school's own — it is chosen in the
 * SMS Reminders module, not here.
 *
 * So the card shows the real breakdown — how many students owe, how much in
 * total, and how many have paid nothing at all versus paid something — and sends
 * with no invented credit arithmetic. The dialog confirms the real number.
 *
 * The send then goes through `services/sms.js`, which throws
 * `SMS_SEND_NOT_SUPPORTED` on a 404/405 because the API has no school-facing send
 * route. That error is surfaced as a warning toast rather than swallowed: the
 * button is live and the wiring is real, so if the route lands tomorrow this card
 * works with no change, and until then it says so instead of reporting a success
 * for messages that were never sent.
 */
const BroadcastSmsCard = ({ broadcast }) => {
  const { user } = useAuth();
  const { warning, error: errorToast, success } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const recipientCount = broadcast?.recipientCount ?? 0;
  const nothingSent = recipientCount === 0;

  const runSend = async () => {
    setConfirming(false);

    if (!user?.schoolId) {
      warning('This account is not linked to a school yet, so there is nobody to notify.');
      return;
    }

    setSending(true);
    try {
      await sendBulk(user.schoolId, { overdueOnly: true });
      success(`Reminder queued for ${formatCount(recipientCount)} parents.`);
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
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <h3 className="text-base font-extrabold leading-tight tracking-tight text-ink">
            Broadcast SMS Prompt
          </h3>
        </div>

        {nothingSent ? (
          <p className="mt-4 text-[13px] font-semibold leading-relaxed text-slate-600">
            No student currently owes a fee, so there is nobody to remind. This card
            appears once a balance is outstanding.
          </p>
        ) : (
          <>
            <p className="mt-4 text-[13px] font-extrabold text-red-600">
              {formatCount(recipientCount)} Overdue Students detected
            </p>

            <dl className="mt-3 space-y-1.5 rounded-xl bg-white/70 p-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Outstanding total</dt>
                <dd className="font-extrabold text-ink">
                  {formatCediShort(broadcast.totalOutstanding)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Paid nothing yet</dt>
                <dd className="font-extrabold text-ink">
                  {formatCount(broadcast.fullyUnpaidCount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Paid something</dt>
                <dd className="font-extrabold text-ink">
                  {formatCount(broadcast.partiallyPaidCount)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={sending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send Overdue Fee SMS Prompt
            </button>
          </>
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
              Send to {formatCount(recipientCount)} parents
            </Button>
          </>
        }
      >
        <dl className="space-y-2.5 text-sm">
          {[
            { label: 'Recipients', value: `${formatCount(recipientCount)} parents` },
            { label: 'Messages used', value: formatCount(recipientCount) },
            { label: 'Outstanding total', value: formatCediShort(broadcast.totalOutstanding) },
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
