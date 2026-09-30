import React from 'react';
import Card from './Card';
import { splitCedi } from '../../../utils/format';

/**
 * A KPI tile — the shape every headline figure in the app takes.
 *
 * Extracted from the Overview's KPI row rather than left there, because the
 * Students module needs the same four tiles and importing a page component from
 * a component is the dependency pointing the wrong way. Two KPI rows in one app
 * that do not match is the clearest sign of a UI assembled screen by screen.
 *
 * `Tile` takes a rendered `value` so a tile can hold a figure, a figure with a
 * currency symbol set smaller (`CediValue`), or a count with a unit. The two
 * things that make a KPI row read as a single band rather than four unrelated
 * boxes — the label baseline and the footer height — live here, once.
 */
const Tile = ({ label, icon: Icon, badge, value, valueTone = 'text-ink', suffix, footer, accent }) => (
  <Card padding="p-5" accent={accent} className="flex flex-col">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[13px] font-extrabold leading-tight text-slate-600">{label}</p>
      {badge || (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      )}
    </div>

    <p className="mt-4 flex items-baseline gap-1.5">
      <span className={`text-[28px] font-extrabold leading-none tracking-tight ${valueTone}`}>
        {value}
      </span>
      {suffix && (
        <span className={`text-sm font-extrabold ${valueTone === 'text-ink' ? 'text-slate-500' : valueTone}`}>
          {suffix}
        </span>
      )}
    </p>

    <div className="mt-auto pt-4">{footer}</div>
  </Card>
);

/**
 * The currency symbol set smaller than the figure, as the design does.
 *
 * Takes pesewas, because everything on the wire does. `formatCediShort` cannot
 * be reused here: it returns one string, and this needs the symbol and the digits
 * as separate nodes so the symbol can be rendered at a different size.
 */
export const CediValue = ({ pesewas, tone = 'text-ink' }) => {
  const { symbol, whole } = splitCedi(pesewas);
  return (
    <>
      <span className={`text-base font-extrabold ${tone === 'text-ink' ? 'text-slate-500' : tone}`}>
        {symbol}
      </span>
      <span className={`text-[28px] font-extrabold leading-none tracking-tight ${tone}`}>{whole}</span>
    </>
  );
};

export default Tile;
