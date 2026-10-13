/**
 * Loading placeholders shaped like the content they stand in for.
 *
 * Three shapes, because a list, a card and a stat row fail differently when
 * they are replaced by a generic spinner: the parent loses the place the
 * answer was going to land. Each skeleton mirrors the padding, radius and
 * line count of its real counterpart so the swap is a fill, not a reflow.
 */

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 ${className}`}>
    <SkeletonBlock className="h-3 w-1/3" />
    <SkeletonBlock className="mt-3 h-6 w-2/3" />
    <SkeletonBlock className="mt-3 h-3 w-full" />
    <SkeletonBlock className="mt-2 h-3 w-5/6" />
  </div>
);

export const SkeletonRow = () => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3">
    <SkeletonBlock className="h-10 w-10 rounded-full" />
    <div className="flex-1">
      <SkeletonBlock className="h-3 w-2/3" />
      <SkeletonBlock className="mt-2 h-3 w-1/2" />
    </div>
  </div>
);
