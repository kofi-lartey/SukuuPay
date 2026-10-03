/**
 * The primitives the parent portal's cards are built from.
 *
 * **Kept separate from `components/common/`.** Those components are styled for the
 * admin app: they assume a wide viewport, a sidebar to sit against, and a reader
 * who knows what an arrears balance is. The portal is a single column on a 360px
 * screen for a parent with one task, and the differences are concrete rather than
 * cosmetic — a 44px minimum tap target, a `min-h-dvh` page (mobile browsers report a
 * `100vh` that includes the retracting URL bar, so a footer sized on `vh` sits under
 * the browser's own chrome), and money set in tabular figures so the digit columns
 * line up and a parent can see the balance change by comparing two rows.
 */

/** A white card. The portal's only container. */
export const Card = ({ children, className = '', as: Tag = 'section', ...rest }) => (
  <Tag
    className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

/**
 * The primary action.
 *
 * `sticky` on mobile because the paying tap should never require scrolling to find.
 * `pb-[env(safe-area-inset-bottom)]` because a fixed bar on a notched phone sits
 * under the home indicator without it, which is where a parent taps.
 */
export const PrimaryButton = ({
  children,
  className = '',
  full = false,
  disabled = false,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled}
    className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#0A5C36] px-5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[#084A2C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A5C36] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${
      full ? 'w-full' : ''
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/**
 * The secondary action.
 *
 * Outlined rather than a lighter green. The two buttons on this page mean different
 * things — pay now, or ask for time — and a tonal difference between two shades of
 * the same green is not enough to say so at a glance for someone reading quickly.
 */
export const SecondaryButton = ({
  children,
  className = '',
  full = false,
  disabled = false,
  ...rest
}) => (
  <button
    type="button"
    disabled={disabled}
    className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-[#0A5C36] bg-white px-5 text-[15px] font-bold text-[#0A5C36] transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A5C36] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 ${
      full ? 'w-full' : ''
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/**
 * A small status pill.
 *
 * `tone` maps to a background/foreground pair rather than a raw colour so the whole
 * page has one vocabulary of states. Chosen so every pair clears 4.5:1 on its own
 * background — the amber in particular is darkened from the usual `#F59E0B` to
 * `#92400E`, because the standard amber on amber-100 is roughly 2.6:1 and this pill
 * carries text a parent is meant to read.
 */
const TONES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-emerald-100 text-[#0A5C36]',
};

export const Pill = ({ children, tone = 'slate', className = '', icon }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold leading-none ${TONES[tone] || TONES.slate} ${className}`}
  >
    {icon}
    {children}
  </span>
);

/**
 * Money, set in tabular figures.
 *
 * `font-variant-numeric: tabular-nums` is the whole point: a parent comparing the
 * balance on this page with the figure on the SMS that sent them here is aligning
 * digits by eye, and proportional figures put `1` in less width than `8` so the
 * columns drift. The cedis symbol is kept inline because a parent checking the
 * amount should never have to work out what the unit is.
 */
export const Amount = ({ pesewas, className = '', size = 'md' }) => {
  const value = (Number(pesewas) || 0) / 100;
  const sizes = {
    sm: 'text-[15px]',
    md: 'text-[17px]',
    lg: 'text-[22px]',
    hero: 'text-[36px] leading-none sm:text-[40px]',
  };

  return (
    <span
      className={`font-extrabold tracking-tight tabular-nums ${sizes[size] || sizes.md} ${className}`}
    >
      <span className="text-[0.7em] font-bold">GHS&nbsp;</span>
      {value.toLocaleString('en-GH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
};

/**
 * A labelled figure for the stats row.
 *
 * `tone` exists so "Balance" can be red when overdue without the label going red
 * with it — the label is a fact, the tone is a judgement.
 */
export const Stat = ({ label, children, tone = 'default', className = '' }) => {
  const tones = {
    default: 'text-slate-900',
    green: 'text-emerald-700',
    red: 'text-red-600',
    brand: 'text-[#0A5C36]',
  };

  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-[15px] font-bold tabular-nums ${tones[tone] || tones.default}`}>
        {children}
      </dd>
    </div>
  );
};

/**
 * The paid/owed bar.
 *
 * `role="progressbar"` with the real values, so it is announced as a proportion
 * rather than as decoration. `aria-valuetext` spells the two amounts out, because
 * "35%" alone does not tell a screen-reader user what fraction of *what* has been
 * paid — and this is the one graphic on the page that carries the fee position.
 */
export const ProgressBar = ({ paid, owed, className = '', tone = 'brand' }) => {
  const total = Number(owed) || 0;
  const percent =
    total <= 0 ? 0 : Math.min(100, Math.max(0, ((Number(paid) || 0) / total) * 100));

  const fills = {
    brand: 'bg-[#0A5C36]',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(percent)} percent of the fees paid`}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${fills[tone] || fills.brand}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

/** A labelled section heading, for the parts of the page that need one. */
export const SectionHeading = ({ children, action }) => (
  <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
    <h2 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">{children}</h2>
    {action}
  </div>
);

/**
 * A short line of reassurance under a heading or a button.
 *
 * Exists because this page asks a parent for money and a phone number, and the
 * single most common reason they abandon it is not understanding where the money
 * goes. Saying it in plain words — before the tap, not in a footer — is the
 * difference.
 */
export const Reassurance = ({ children, className = '' }) => (
  <p className={`flex items-start gap-1.5 text-[13px] leading-relaxed text-slate-500 ${className}`}>
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M9 12l2 2 4-4M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>{children}</span>
  </p>
);

export default Card;