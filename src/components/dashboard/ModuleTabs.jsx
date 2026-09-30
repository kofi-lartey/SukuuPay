import React from 'react';

/**
 * The sub-navigation *within* a module.
 *
 * The rail answers "which module?"; this answers "which part of it?". Students
 * alone splits into roster, import, alumni and cohorts, and Payments into
 * transactions, receipts and refunds — more than fits as rail entries, and a
 * collapsible tree inside the rail would make the eight-module overview harder
 * to read, not easier.
 *
 * **Controlled, not `NavLink`.** A module's sections here are *query parameters*
 * on one path (`/dashboard/students?tab=import`), and `NavLink` matches on
 * pathname — so all four tabs resolve to `/dashboard/students` and every one
 * renders as active. That is not a styling problem, it is a wrong-`to` problem:
 * the tab bar highlighted all of its tabs at once. So active state is compared
 * against the value the page owns, and the tab is a button.
 *
 * The URL is still the state. A bursar sharing "the import tab" sends a link that
 * reopens it, and the back button walks the sections — which is the reason the
 * tabs are query parameters rather than local state in the first place.
 */
const ModuleTabs = ({ items, value, onChange, ariaLabel = 'Section' }) => {
  if (!items?.length) return null;

  const tabClass = (active) =>
    `whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
      active
        ? 'border-brand-700 text-brand-800'
        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-ink'
    }`;

  return (
    <nav aria-label={ariaLabel} className="mb-6 border-b border-slate-200">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {items.map((item) => {
          const active = value === item.value;
          return (
            <li key={item.value} className="shrink-0">
              <button
                type="button"
                onClick={() => onChange(item.value)}
                aria-current={active ? 'page' : undefined}
                className={tabClass(active)}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default ModuleTabs;
