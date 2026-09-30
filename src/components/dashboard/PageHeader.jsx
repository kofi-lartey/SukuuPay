import React from 'react';

/**
 * Page-level header: eyebrow, title, supporting copy, and the page's actions.
 *
 * The anatomy is the Overview header's — an uppercase eyebrow above the title —
 * so every module opens the same way. The eyebrow is where a module states its
 * own state (which section, or that it is a work in progress), which is why it
 * is a prop rather than something derived here.
 *
 * Separate from the topbar on purpose. The topbar scopes the whole session
 * (school, term, search); this scopes one page, and carries the actions that
 * belong to that page alone — "Export CSV" means nothing on Installment Plans,
 * and putting it in the shell would mean every module ships a button that means
 * nothing on it.
 */
const PageHeader = ({ eyebrow, title, description, actions, meta }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && (
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          {eyebrow}
        </p>
      )}

      <h1 className={`${eyebrow ? 'mt-1.5' : ''} text-2xl font-extrabold tracking-tight text-ink sm:text-3xl`}>
        {title}
      </h1>

      {description && (
        <p className="mt-1 max-w-2xl text-[13px] font-semibold text-slate-500">{description}</p>
      )}

      {meta && <div className="mt-3">{meta}</div>}
    </div>

    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
