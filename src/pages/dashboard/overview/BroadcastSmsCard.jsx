import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, Send } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import { previewAudience, sendBulkSms } from '../../../services/sms';
import { PRESET_TEMPLATES } from '../../../hooks/useSmsReminders';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { ROUTES } from '../../../utils/constants';
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
 * **The recipient count is `POST /sms/audience/preview`.** It used to be
 * `GET /reports/outstanding/:schoolId`, on a card that then said "1,420 units"
 * of credit and previewed a template called "Overdue MoMo Prompt #1" with a
 * written-out SMS body. None of that existed: the fixture's own "demo data"
 * caption was gated on the page-level `isDemo` flag, which went false on the
 * first successful request, so a bursar saw a real-looking 87 and a real-looking
 * template on a live deployment. The credit was `school.sms.balance` with no
 * endpoint behind it, and the template is a school's own — it is chosen in the
 * SMS Reminders module, not here.
 *
 * Both gaps are closed. The count is a live sizing of the same `overdue` rule the
 * module's audience picker uses, so 87 here and 87 there are the same 87 from the
 * same query — not two numbers from two different places. The body is the
 * platform's Gentle Prompt preset, named in the dialog so the bursar can see
 * which copy is about to go out, with "Edit in composer" for when it is not the
 * right one.
 *
 * The send is the module's `POST /sms/bulk`, so it is queued, rate-limited,
 * cancellable and refundable exactly as if it had been composed there. A
 * shortcut on the Overview that bypassed all of that would be a second send path
 * with none of the safety — and the Overview is not a place to put one.
 */
const BroadcastSmsCard = ({ broadcast }) => {
  const { user } = useAuth();
  const { warning, error: errorToast, success } = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState(null);

  // The same rule the module's "Overdue only" card builds, sent explicitly rather
  // than left to server defaults: a default that changed on the server would make
  // this card and the composer silently mean different things.
  const AUDIENCE = { type: 'overdue', minBalance: 1, overdueDays: 30, gracePeriodDays: 30 };

  // Sized on mount, not per render. The outstanding report is still the fallback
  // when this fails: a bursar deserves to know someone owes money even if the
  // sizing query is unavailable, and hiding the card would be a worse answer than
  // showing a slightly coarser number.
  useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    previewAudience(AUDIENCE, user.schoolId)
      .then((result) => {
        if (active) setOverdue(result);
      })
      .catch(() => {
        if (active) setOverdue(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.schoolId]);

  const recipientCount = overdue?.matchCount ?? broadcast?.recipientCount ?? 0;
  const totalOwed = overdue?.totalBalance ?? broadcast?.totalOutstanding ?? 0;
  const nothingSent = recipientCount === 0;

  const runSend = async () => {
    setConfirming(false);

    if (!user?.schoolId) {
      warning('This account is not linked to a school yet, so there is nobody to notify.');
      return;
    }

    setSending(true);
    try {
      const result = await sendBulkSms({
        schoolId: user.schoolId,
        audience: AUDIENCE,
        body: PRESET_TEMPLATES[0].body,
        category: 'overdue',
      });
      success(
        `Reminder queued for ${formatCount(result?.job?.recipients || 0)} parents. Track it on the SMS Reminders page.`
      );
    } catch (err) {
      if (err?.code === 'SMS_SEND_NOT_SUPPORTED') {
        warning(err.message);
      } else {
        errorToast(err?.message || 'The reminders could not be queued.');
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

        {nothingSent && !loading ? (
          <p className="mt-4 text-[13px] font-semibold leading-relaxed text-slate-600">
            No student currently owes a fee, so there is nobody to remind. This card
            appears once a balance is outstanding.
          </p>
        ) : (
          <>
            <p className="mt-4 flex items-center gap-2 text-[13px] font-extrabold text-red-600">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Sizing the overdue list&hellip;
                </>
              ) : (
                `${formatCount(recipientCount)} Overdue Parents detected`
              )}
            </p>

            <dl className="mt-3 space-y-1.5 rounded-xl bg-white/70 p-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Outstanding total</dt>
                <dd className="font-extrabold text-ink">{formatCediShort(totalOwed)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Overdue means</dt>
                <dd className="font-extrabold text-ink">Past 30-day grace</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-semibold text-slate-500">Message</dt>
                <dd className="font-extrabold text-ink">Gentle Prompt</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={sending || loading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send Overdue Fee SMS Prompt
            </button>

            <button
              type="button"
              onClick={() => navigate(ROUTES.DASHBOARD_SMS)}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Edit in the SMS Reminders composer
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
            <Button variant="primary" onClick={runSend} disabled={sending}>
              Send to {formatCount(recipientCount)} parents
            </Button>
          </>
        }
      >
        <dl className="space-y-2.5 text-sm">
          {[
            { label: 'Recipients', value: `${formatCount(recipientCount)} parents` },
            { label: 'Audience', value: 'Past the 30-day grace period' },
            { label: 'Message', value: 'Gentle Prompt (platform preset)' },
            { label: 'Outstanding total', value: formatCediShort(totalOwed) },
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
