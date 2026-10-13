/**
 * The centred, quiet answer to "there is nothing here yet".
 *
 * Width-capped because a paragraph that runs the full width of a phone reads
 * as an essay, and a parent skimming for their child's attendance stops
 * reading. `action` is a slot — the empty state is where a dead end should
 * offer the one tap that leaves it, and what that tap is belongs to the page.
 */
const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-12 text-center">
    {Icon ? (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
    ) : null}
    <h2 className="text-[15px] font-extrabold tracking-tight text-slate-800">
      {title}
    </h2>
    {description ? (
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default EmptyState;
