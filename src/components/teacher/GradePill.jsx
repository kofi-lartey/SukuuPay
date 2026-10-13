/**
 * A grade letter, in its band's colour.
 *
 * The band boundaries are the school's, not the client's — Ghanaian grading
 * runs A1 … F9, and this maps the leading letter onto the design system's
 * four tones. Anything that is not an A, B or C is `red`, which is deliberately
 * broad: a C is a pass at most schools and an F is not, and a pill that
 * reported them differently would be making a promotion decision the client is
 * not entitled to make.
 *
 * A missing or unsent grade renders as an em dash in slate rather than as an
 * empty box or a guessed letter. "—" reads as *not entered*, which is the
 * truth; a blank reads as a rendering failure.
 */
const gradeTone = (grade) => {
  if (!grade) return 'slate';
  if (grade.startsWith('A')) return 'green';
  if (grade.startsWith('B')) return 'green';
  if (grade.startsWith('C')) return 'amber';
  return 'red';
};

const TONES = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  slate: 'bg-slate-100 text-slate-700',
};

const GradePill = ({ grade }) => (
  <span
    className={`inline-flex min-w-[40px] items-center justify-center rounded-full px-2 py-[3px] text-[11px] font-extrabold ${
      TONES[gradeTone(grade)]
    }`}
  >
    {grade || '—'}
  </span>
);

export default GradePill;
