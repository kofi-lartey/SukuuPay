/**
 * The one status vocabulary.
 *
 * `tone` maps to a background/foreground pair rather than a raw colour, so
 * "paid", "late" and "absent" cannot each invent their own shade of green.
 * Uppercase text is deliberately absent — the pill carries a word, and a word
 * set in small caps at 11px is the thing the design system's section labels
 * already do.
 */
const TONES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-700',
  sky: 'bg-sky-100 text-sky-800',
  gold: 'bg-[#FEF3C7] text-[#854D0E]',
};

const StatusPill = ({ tone = 'slate', children, className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11px] font-extrabold ${TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

export default StatusPill;
