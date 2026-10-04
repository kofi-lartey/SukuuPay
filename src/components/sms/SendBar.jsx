import React from 'react';
import { CalendarClock, CircleAlert, Loader2, Send, ShieldCheck } from 'lucide-react';
import { formatCediShort, formatCount } from '../../utils/format';

/**
 * The action bar across the foot of the composer.
 *
 * A send bar rather than a button in the page header, for the reason the
 * Overview's broadcast card needed one too: the decision is expensive and
 * irreversible, so it needs the recipient count, the cost and the balance
 * together, at the moment of committing, and it needs a second click. A header
 * button puts those facts somewhere else and the click somewhere the facts are
 * not.
 *
 * **The bar states its own blockers.** "Choose an audience to cost this" is more
 * useful than a disabled button with no explanation, which is the version a
 * bursar clicks three times and then asks a colleague why nothing happens.
 */

const SchedulePicker = ({ value, onChange }) => (
  <div className="flex-1">
    <label className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      Send later (optional)
    </label>
    <input
      type="datetime-local"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
    />
    <p className="mt-1 text-[10px] font-semibold text-slate-400">
      Credit is reserved now and refunded if the run fails.
    </p>
  </div>
);

const SendBar = ({
  matchCount,
  segments,
  estimatedCost,
  ratePes,
  balance,
  canQueue,
  readyToConfirm,
  confirmed,
  setConfirmed,
  sending,
  onSend,
  scheduledAt,
  setScheduledAt,
  onReset,
  blocker,
  canSend,
  gateway,
  audienceType,
}) => {
  const recipientLabel = matchCount
    ? `${formatCount(matchCount)} SMS Prompt${matchCount === 1 ? '' : 's'}`
    : 'SMS Prompts';

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold leading-tight text-ink">
            {recipientLabel} to Send
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            {estimatedCost === null ? (
              'Pick an audience to see the cost.'
            ) : (
              <>
                Total Fee:{' '}
                <span className="font-extrabold text-ink">
                  {formatCediShort(estimatedCost * ratePes)}
                </span>{' '}
                (from {formatCount(balance)} available credits)
              </>
            )}
          </p>

          {/* A gateway with no key produces a 503 at send time. Said here, the
              bursar finds out while composing; said by a toast, they find out
              after reading a 503. */}
          {canSend === false && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              No SMS gateway is configured on this server
              {gateway?.senderIdIssue ? `: ${gateway.senderIdIssue}` : '.'} Sending will
              fail until it is.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Reset
          </button>

          <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
        </div>

        <div className="lg:pb-0">
          <button
            type="button"
            disabled={!canQueue || sending}
            onClick={onSend}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {scheduledAt
              ? `Schedule ${recipientLabel}`
              : `Send ${recipientLabel} (${estimatedCost === null ? '—' : formatCediShort(estimatedCost * ratePes)})`}
          </button>

          {/* The confirmation, inline rather than in a dialog: it is one checkbox
              for the whole-school case and a sentence for everything else, and a
              modal for that would be heavier than the thing it guards.

              Gated on `readyToConfirm`, **not** on `canQueue`. `canQueue` includes
              `confirmed`, so gating here on `canQueue` meant the checkbox could
              only appear once it was already ticked — it never appeared at all,
              and with it the only way to reach `setConfirmed`. The send button was
              then permanently disabled for every school on every audience. */}
          {readyToConfirm && !confirmed && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-700"
              />
              <span>
                {audienceType === 'all'
                  ? `Send to every active student, including the ${formatCount(matchCount)} who have nothing outstanding?`
                  : `Send ${segments} SMS part${segments === 1 ? '' : 's'} to ${formatCount(matchCount)} parent${matchCount === 1 ? '' : 's'} now? This cannot be unsent.`}
              </span>
            </label>
          )}

          {/* Shown only when something must be *fixed*. Once the audience is sized and
              affordable, the remaining reason the button is greyed is that the
              checkbox above is unticked — and printing "Confirm the recipient
              count to send" directly beneath the box that confirms it just says
              the same thing twice. */}
          {blocker && !readyToConfirm && (
            <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{blocker}</p>
          )}
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        End-to-end encrypted &middot; Audit log enabled
      </p>
    </div>
  );
};

export default SendBar;
