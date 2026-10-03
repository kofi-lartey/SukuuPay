import { useEffect, useState } from 'react';

/**
 * A phone frame showing what is about to arrive on the parent's handset.
 *
 * **Why a mock is the right thing here and not a screenshot.** A parent's single
 * biggest reason for not completing a Mobile Money payment is not knowing whether the
 * prompt is real or someone calling from "the school". A screenshot of a past prompt
 * would be a photograph of a different number, a different amount and an older
 * interface, and a school using fake screenshots is how parents get trained to
 * approve anything. This renders *the actual numbers for this student*, so the thing
 * on screen is something the parent can compare against their real handset — which
 * is the comparison that actually protects them.
 *
 * ## Why it types itself out
 *
 * In slow, with the cursor advancing, so it reads as *arriving* rather than as
 * *existing*. A static mock does the opposite — it looks like a screenshot, which is
 * the thing being distinguished from. It is `prefers-reduced-motion` aware, because
 * a typing animation is exactly the kind of thing that causes trouble for someone
 * with a vestibular disorder, and honouring that costs three lines.
 */
const PhonePreviewFrame = ({
  networkLabel: network,
  amountLabel,
  phoneLabel,
  running = true,
}) => {
  const [typed, setTyped] = useState(running ? '' : phoneLabel);

  useEffect(() => {
    if (!running || !phoneLabel) return undefined;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(phoneLabel);
      return undefined;
    }

    // The full number would take about nine seconds at a comfortable rate, which is
    // long enough to be read as a hang. Halfway through, the rest appears at once —
    // the same beat a real notification takes to assemble.
    const head = phoneLabel.slice(0, 7);
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTyped(head.slice(0, index));
      if (index >= head.length) {
        clearInterval(timer);
        setTimeout(() => setTyped(phoneLabel), 320);
      }
    }, 90);

    return () => clearInterval(timer);
  }, [running, phoneLabel]);

  return (
    <div
      // Decorative: the same information is in the prose beside it, so this is not
      // announced twice on a screen that is already explaining the step.
      aria-hidden="true"
      className="mx-auto w-[190px] rounded-[1.75rem] border-[6px] border-slate-800 bg-slate-900 p-1.5 shadow-lg"
    >
      <div className="rounded-[1.4rem] bg-white p-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />

        <div className="rounded-xl bg-slate-50 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-800 text-[7px] font-extrabold text-white">
              MoMo
            </span>
            <span className="text-[9px] font-bold text-slate-700">{network}</span>
          </div>

          <p className="mt-2 text-[9px] leading-relaxed text-slate-500">Payment request</p>
          <p className="mt-0.5 text-[15px] font-extrabold tabular-nums text-slate-900">
            {amountLabel}
          </p>
          <p className="mt-1 text-[8px] leading-tight text-slate-400">School fees payment</p>

          <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-200 pt-2">
            <span className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
              From
            </span>
            <span className="text-[10px] font-bold tabular-nums text-slate-800">
              {typed}
              {typed.length < (phoneLabel?.length || 0) ? (
                <span className="ml-px inline-block h-2.5 w-px animate-pulse bg-slate-700 align-middle" />
              ) : null}
            </span>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <span className="rounded-md bg-emerald-600 py-1.5 text-center text-[8px] font-extrabold text-white">
            Approve
          </span>
          <span className="rounded-md border border-slate-200 py-1.5 text-center text-[8px] font-extrabold text-slate-500">
            Cancel
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * "What will happen" — the copy above the primary button.
 *
 * Separate from the mock because this is the part that has to be *read*: three
 * numbered lines saying the prompt goes to a number, that the PIN is entered on the
 * handset and never here, and that a receipt is issued. Each line answers an
 * objection a parent actually raises, in the order they raise them.
 */
export const PaymentSteps = () => (
  <ol className="space-y-2.5">
    {[
      'We send a payment request to your phone.',
      'You enter your Mobile Money PIN on the phone — not on this page.',
      'You get a receipt by SMS, and the school is credited straight away.',
    ].map((line, index) => (
      <li key={line} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-[#0A5C36]">
          {index + 1}
        </span>
        <span>{line}</span>
      </li>
    ))}
  </ol>
);

export default PhonePreviewFrame;