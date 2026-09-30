import React from 'react';

/**
 * The dashboard's card: white, `rounded-2xl`, hairline border, soft shadow.
 *
 * One component rather than the design's hand-written markup per region, so the
 * padding, radius and shadow cannot drift between the KPI row and the cards
 * below it. The radius in particular is the most visible tell of a UI assembled
 * card-by-card, and it is the thing you stop noticing once it is wrong.
 *
 * `accent` tints the border and washes a gradient into the top-right corner, as
 * the Collected tile does in the design. It is decorative, so it is
 * `aria-hidden` via the empty wrapper rather than announced.
 */
const Card = ({ children, className = '', padding = 'p-5', accent, icon }) => (
  <div
    className={`relative overflow-hidden rounded-2xl border bg-white shadow-soft ${padding} ${
      accent ? 'border-brand-200/60' : 'border-slate-100'
    } ${className}`}
  >
    {accent && (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-70 blur-2xl"
        style={{ background: 'radial-gradient(circle, #A6F4C5 0%, rgba(255,255,255,0) 70%)' }}
      />
    )}

    {icon && (
      <span
        aria-hidden="true"
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
      >
        {icon}
      </span>
    )}

    <div className="relative">{children}</div>
  </div>
);

export default Card;
