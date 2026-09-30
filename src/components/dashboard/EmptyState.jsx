import React from 'react';

/**
 * The state a module is in when it has no rows to show.
 *
 * Takes an `action` rather than assuming one, because "no students yet" and
 * "no students match this filter" need different next steps and conflating them
 * is how an empty roster ends up looking like a broken search.
 */
const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
    {Icon && (
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    <h3 className="text-base font-extrabold text-ink">{title}</h3>
    {description && (
      <p className="mt-1 max-w-md text-sm font-medium text-slate-500">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
