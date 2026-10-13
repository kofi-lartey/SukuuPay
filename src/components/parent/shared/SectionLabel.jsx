/**
 * The small caps label that opens a section.
 *
 * One component rather than the class string typed out per page: the label is
 * the portal's quietest typographic voice, and a section where it drifts —
 * tracking, size, weight — reads as a page assembled from parts.
 */
const SectionLabel = ({ children, className = '' }) => (
  <p
    className={`text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400 ${className}`}
  >
    {children}
  </p>
);

export default SectionLabel;
