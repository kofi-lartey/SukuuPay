/**
 * Money and number formatting for the dashboard.
 *
 * Every amount in this app is a **pesewas integer** on the wire — the Student
 * model's `totalOwed`, every report aggregate and every payment amount. Cedis
 * only exist at the moment of display. Formatting here rather than in each card
 * is the point: the same figure reading "GH₵ 0.01" in one report and
 * "GH₵ 100" in another is the specific bug this module exists to make
 * impossible.
 *
 * `formatCedi` takes pesewas. Passing cedis to it renders 100× too large, which
 * is why every money figure in the app is written through the
 * `gh()` helper rather than as a bare literal.
 */

const PESEWAS_PER_CEDI = 100;

/** Cedi → pesewas. For authoring fixtures, never for display. */
export const gh = (cedis) => Math.round(cedis * PESEWAS_PER_CEDI);

const nf = new Intl.NumberFormat('en-GH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfWhole = new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 });

/**
 * `formatCedi(31800000)` → `"GH₵ 318,000.00"`.
 *
 * The full amount, to the pesewa. Used wherever the figure is a number someone
 * may reconcile against a bank statement.
 */
export const formatCedi = (pesewas) => `GH₵ ${nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;

/**
 * `formatCediShort(31800000)` → `"GH₵ 318,000"`.
 *
 * Drops the pesewas for headline figures that are never reconciled to the
 * pesewa, which keeps the KPI row from overflowing at the width the design gives
 * it. Deliberately *not* a rounding function — a school collecting GH₵ 318,400
 * must still read 318,400 here, so no abbreviation above six figures.
 */
export const formatCediShort = (pesewas) =>
  `GH₵ ${nfWhole.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;

/** Cedi only, no symbol — for dense table cells that already say "Amount". */
export const formatCedis = (pesewas) => nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI);

/**
 * Cedi with no decimals and no symbol.
 *
 * For tiles that set the symbol themselves as a separate, larger node, and where
 * a whole-cedi figure is what the design shows. Same rounding policy as
 * `formatCediShort` — nothing is abbreviated, so a six-figure total still reads
 * in full.
 */
export const formatCediWhole = (pesewas) =>
  nfWhole.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI);

/** `formatCount(1000)` → `"1,000"`. Whole numbers, no decimals, ever. */
export const formatCount = (value) => nfWhole.format(Number(value) || 0);

/** `formatPercent(74.8)` → `"74.8%"`. One decimal; whole numbers lose the `.0`. */
export const formatPercent = (value) => {
  const n = Number(value) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};

/**
 * Splits a headline amount into the two pieces the design renders separately.
 *
 * The KPI tiles set the currency symbol smaller than the figure, so the two
 * have to be separate nodes rather than one string — that is what
 * `symbol`/`value` are for.
 */
export const splitCedi = (pesewas) => {
  const [whole, fraction] = nf
    .format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)
    .split('.');
  return { symbol: 'GH₵', whole, fraction };
};

export default {
  gh,
  formatCedi,
  formatCediShort,
  formatCediWhole,
  formatCedis,
  formatCount,
  formatPercent,
  splitCedi,
};
