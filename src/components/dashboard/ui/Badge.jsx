import React from 'react';

const TONES = {
  brand: 'bg-brand-50 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-50 text-red-700',
  rose: 'bg-rose-50 text-rose-700',
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-violet-50 text-violet-700',
  slate: 'bg-slate-100 text-slate-600',
  ink: 'bg-ink text-white',
  mtn: 'bg-momo-mtn-soft text-momo-mtn-ink',
  telecel: 'bg-momo-telecel-soft text-momo-telecel-ink',
  at: 'bg-momo-at-soft text-momo-at-ink',
};

/** The dot colours for a MoMo network pill, matching the `momo` palette. */
const NETWORK_DOTS = {
  mtn: 'bg-momo-mtn',
  telecel: 'bg-momo-telecel',
  at: 'bg-momo-at',
};

/**
 * The pill, used for statuses, counts and network tags throughout the dashboard.
 *
 * `icon` is optional and rendered before the label, which is how the design marks
 * an urgent badge ("Immediate Attention") apart from a neutral one. When a
 * network is named, the dot colour comes from `NETWORK_DOTS` so the pill, the
 * stacked bar and the chart filter cannot disagree about what MTN looks like.
 */
const Badge = ({ children, tone = 'slate', icon: Icon, dot, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
      TONES[tone] || TONES.slate
    } ${className}`}
  >
    {dot && (
      <span className={`h-2 w-2 shrink-0 rounded-full ${NETWORK_DOTS[dot] || 'bg-current'}`} />
    )}
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </span>
);

export { NETWORK_DOTS };
export default Badge;
