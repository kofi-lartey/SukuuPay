import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { SIGNUP_ROLES } from '../../utils/constants';

/**
 * Role selection, collapsed by default.
 *
 * Four stacked description cards cost ~358px — 28% of the signup form — for a
 * four-way choice, and the overwhelming majority of users take the default. So the
 * choice is presented as a single summary row that states what was picked and what
 * it grants, with the full card list one tap away.
 *
 * The summary is the accessibility-critical part and it must be honest: it renders
 * `selectedRole` looked up from the current value, so a user who chose *Teacher*
 * sees "Teacher" and not a stale "School administrator". A collapsed control that
 * misreports its own value is worse than a tall one.
 *
 * Kept as a real `fieldset` + native radios when expanded — never a styled
 * `div` — so arrow-key navigation, the roving focus and the selected state
 * conveyed by more than colour all come from the platform.
 */
const RoleSelector = ({ value, onChange, error = '', touched = false }) => {
  const panelId = useId();
  const groupRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  const errorText = touched ? error : '';

  // Preselected, so a valid choice is almost always present; falling back to the
  // first role keeps the summary truthful for any unexpected value rather than
  // rendering an empty label.
  const selectedRole =
    SIGNUP_ROLES.find((role) => role.value === value) || SIGNUP_ROLES[0];

  // Move focus into the group when it opens, so a keyboard user is not left
  // tabbing blind past the radios they just revealed.
  useEffect(() => {
    if (expanded) {
      groupRef.current?.querySelector('input:checked')?.focus();
    }
  }, [expanded]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-slate-50"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14px] font-bold text-ink">{selectedRole.label}</span>
            <span className="text-[11px] font-medium text-slate-500">
              · {selectedRole.description}
            </span>
          </span>
          {!selectedRole.canCreateSchool && (
            <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-amber-700">
              Joins an existing school with a school code.
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-brand-700">
          {expanded ? 'Done' : 'Change'}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {expanded && (
        <div id={panelId} ref={groupRef} className="border-t border-slate-200 p-3">
          <fieldset>
            <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              How will you use SukuuPay?
            </legend>

            <div
              className="grid gap-2"
              role="radiogroup"
              aria-required="true"
              aria-invalid={errorText ? 'true' : undefined}
              aria-describedby={errorText ? `${panelId}-error` : undefined}
            >
              {SIGNUP_ROLES.map((role) => {
                const checked = value === role.value;

                return (
                  <label
                    key={role.value}
                    htmlFor={`role-${role.value}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                      checked
                        ? 'border-brand-700 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      id={`role-${role.value}`}
                      type="radio"
                      name="role"
                      value={role.value}
                      checked={checked}
                      onChange={() => onChange(role.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-brand-700 focus:ring-brand-700/30"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-bold text-ink">{role.label}</span>
                        {role.value === 'school_admin' && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-800">
                            Most schools
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
                        {role.description}
                      </span>
                      {!role.canCreateSchool && (
                        <span className="mt-1 block text-[11px] font-semibold leading-snug text-amber-700">
                          Joins an existing school with a school code.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}

      {errorText && (
        <p id={`${panelId}-error`} role="alert" className="px-3 pb-2 text-[12px] font-semibold text-red-600">
          {errorText}
        </p>
      )}
    </div>
  );
};

export default RoleSelector;
