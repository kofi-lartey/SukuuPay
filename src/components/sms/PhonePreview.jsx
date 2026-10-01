import React from 'react';
import {
  ArrowLeft,
  BatteryMedium,
  Check,
  ChevronRight,
  MoreVertical,
  Signal,
  Wifi,
} from 'lucide-react';
import Badge from '../dashboard/ui/Badge';

/**
 * Step 3: the reminder as the parent will see it.
 *
 * A phone frame, not a plain text box, and that is the whole argument for the
 * component. A fee reminder is not a message — it is a message *and* a payment
 * link card, inside a 160-character budget, on the smallest screen the school
 * has. Every defect this preview exists to catch is invisible in a textarea:
 *
 *   - copy that runs to four segments and costs four times what the bursar
 *     expected;
 *   - a `{dueDate}` that survived rendering because that student has no
 *     deadline, reaching a parent as literal braces;
 *   - a pay link that does not fit after "pay via MTN MoMo, Telecel Cash or
 *     AirtelTigo:" and so gets truncated by the handset.
 *
 * The bubbles wrap at a width a real handset uses, so a line that overflows here
 * overflows there. `break-all` on the pay link is not a styling choice — payment
 * links have no spaces, and without it the link is one unbroken run that pushes
 * the bubble wide and gets cut.
 */

/** The green "SukuuPay Instan..." pay card the link expands into. */
const PayLinkCard = ({ payLink, amount, schoolName }) => {
  if (!payLink) return null;

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/80">
      <div className="flex items-center gap-2 border-b border-emerald-100 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-700 text-white">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-extrabold text-ink">SukuuPay Instant Pay</p>
          <p className="truncate text-[10px] font-semibold text-slate-500">
            {schoolName} &middot; secure link
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Amount Due
          </p>
          <p className="text-[15px] font-extrabold leading-tight text-ink">{amount}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-700 px-2.5 py-1.5 text-[11px] font-extrabold text-white">
          Pay Now
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      {/* `break-all` is load-bearing: a pay link is one unbroken token, and
          without this the bubble grows past the handset's width instead of
          wrapping. */}
      <p className="break-all border-t border-emerald-100 px-3 py-1.5 text-[9px] font-semibold text-slate-400">
        {payLink}
      </p>
    </div>
  );
};

const PhonePreview = ({ rendered, payLink, amount, schoolName, senderName, sending }) => (
  <div className="lg:sticky lg:top-6">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white">
          3
        </span>
        Live Phone Preview
      </h2>
      <Badge tone="green" dot="mtn">
        Parent View
      </Badge>
    </div>

    {/* The frame. `max-w-[300px]` is a small Android in a hand, not a marketing
        render — the narrowest device the parents this reminder is for are
        likely to be holding. */}
    <div className="mx-auto max-w-[300px] rounded-[2.25rem] border-8 border-ink bg-white shadow-lift">
      <div className="flex items-center justify-between px-4 pb-1 pt-2 text-[10px] font-bold text-ink">
        <span>9:41</span>
        <span className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="h-3 w-3" aria-hidden="true" />
          <Wifi className="h-3 w-3" aria-hidden="true" />
          <BatteryMedium className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <div className="border-b border-slate-100 px-3 pb-2 pt-3 text-center">
        <p className="text-[11px] font-extrabold text-ink">SukuuPay</p>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          Official SMS
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <ArrowLeft className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-extrabold text-slate-600">
          SK
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-extrabold text-ink">
            {senderName || 'SukuuPay'}
          </p>
          <p className="text-[9px] font-semibold text-slate-400">NOTICE</p>
        </div>
        <MoreVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </div>

      <div className="min-h-[320px] space-y-2 bg-slate-50 px-3 py-3">
        <p className="text-center text-[9px] font-semibold text-slate-400">
          Today &middot; {sending ? 'Sending…' : '09:41 AM'}
        </p>

        <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 shadow-sm">
          {/* `whitespace-pre-wrap` so the composer's line breaks survive into the
              bubble the way they will on a handset. */}
          <p className="whitespace-pre-wrap break-words text-[11px] font-medium leading-relaxed text-ink">
            {rendered || (
              <span className="italic text-slate-400">
                Your message will appear here as you type.
              </span>
            )}
          </p>

          <PayLinkCard payLink={payLink} amount={amount} schoolName={schoolName} />
        </div>

        <p className="px-1 text-[9px] font-semibold leading-relaxed text-slate-400">
          Sent via SukuuPay Gateway &middot; Just now
        </p>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
        <span className="flex-1 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-400">
          Text message
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white">
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </div>

    <p className="mx-auto mt-3 max-w-[300px] text-center text-[11px] font-semibold leading-relaxed text-slate-500">
      This is how the reminder will appear on a parent&rsquo;s handset. The bubble
      wraps at the width a real phone uses, so copy that overflows here overflows
      there.
    </p>
  </div>
);

export default PhonePreview;
