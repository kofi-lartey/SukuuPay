import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { SelectField } from '../../common/FormField';
import Badge from '../../dashboard/ui/Badge';
import { listSchools } from '../../../services/admin';

/**
 * A school `<select>` for the finance filters and the batch builder.
 *
 * ### Why this exists rather than four free-text id boxes
 *
 * Every list in this section filters by `schoolId`, which on the wire is a
 * 24-character `ObjectId`. An operator cannot type one — they have a school's
 * name off a support call — so a text input would either be unusable or would
 * silently do nothing while looking like a search box. The picker is the only
 * honest shape for a server-side id filter.
 *
 * ### The 200-school ceiling, stated rather than hidden
 *
 * `listSchools` is clamped to `MAX_PER_PAGE = 200` server-side
 * (`Backend/src/utils/platformQuery.js`) and there is no "all schools" endpoint to
 * page through — `GET /admin/schools` is paged by design precisely because it is
 * platform-wide. So this control can only ever offer the first 200 schools by the
 * sort it asks for.
 *
 * The response is therefore requested **`sortBy: 'name', sortOrder: 'asc'`**, so
 * the truncation lands at the *end of the alphabet* — a school called Zummuni
 * cannot be picked, and "Achimota" always can. Sorting by `createdAt desc` (the
 * endpoint's own default, which `AdminSchools.jsx` uses) would instead hide the
 * oldest schools, which is the opposite of the right bias: a school nobody has
 * billed in two years is precisely the one an operator comes looking for.
 *
 * When the response says there were more than arrived, the control says so in
 * words. A silently truncated dropdown is a filter that looks complete and is
 * not, and the operator's conclusion from it — "this school is not on the
 * platform" — would be wrong in the most expensive direction.
 *
 * All lifecycle states are included, not just `active`. A suspended school's
 * ledger still exists and still needs to be read; filtering the picker to active
 * schools would make the one tenant an operator most needs to look at the one
 * they cannot select.
 */
const SchoolSelect = ({
  value,
  onChange,
  label = 'School',
  hint,
  required = false,
  error,
  className,
  placeholder = 'All schools',
  // Called once with the resolved rows. Exists so a consumer that needs the
  // selected school's *name* — the batch builder's confirm button, which must
  // never name a 24-character id — can have it without issuing the same
  // 200-school request a second time.
  onLoaded,
}) => {
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listSchools({ perPage: 200, sortBy: 'name', sortOrder: 'asc' })
      .then((result) => {
        if (!active) return;
        const rows = result.rows || [];
        setState({ rows, total: Number(result.meta?.total) || 0, loading: false, error: null });
        onLoaded?.(rows);
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], total: 0, loading: false, error });
        onLoaded?.([]);
      });

    return () => {
      active = false;
    };
    // `onLoaded` is intentionally not a dependency: a caller passing an inline
    // arrow would otherwise re-fetch all 200 schools on every one of its renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loaded = state.rows.length;
  const truncated = state.total > loaded;

  return (
    <div className={className}>
      <SelectField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        error={error}
        hint={hint}
      >
        <option value="">{state.loading ? 'Loading schools…' : placeholder}</option>
        {/*
          The "no match" option, only once the list has actually arrived.

          Without it, a failed or empty request renders a picker containing
          nothing but "All schools", which an operator reads as "no schools on the
          platform" — the most confident wrong answer this control could give.
        */}
        {!state.loading && !state.error && loaded === 0 && (
          <option value="" disabled>
            No schools returned
          </option>
        )}
        {state.rows.map((school) => (
          <option key={school._id} value={school._id}>
            {school.name}
            {school.schoolCode ? ` · ${school.schoolCode}` : ''}
          </option>
        ))}
      </SelectField>

      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
        {state.error ? (
          <span className="text-red-600">
            The school list could not be loaded, so this filter cannot be used. Reload the page.
          </span>
        ) : truncated ? (
          <>
            Showing the first {loaded} schools by name. {state.total - loaded} more exist on the
            platform and cannot be selected here — narrow with the date filters and open the school
            from its own page instead.
          </>
        ) : (
          <>
            <Building2 className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
            Every school on the platform, all lifecycle states.
          </>
        )}
      </p>
    </div>
  );
};

/**
 * The batch builder's picker, which is the same control with a different
 * question.
 *
 * `createDisbursement` **refuses a suspended school with a 409** before anything
 * is written (`disbursements.service.js:332-338`), so offering one here is an
 * action the server will decline for a stated reason. The option is rendered
 * with the refusal attached rather than removed: hiding it would leave an
 * operator who *knows* there is a suspended school with open payments wondering
 * whether the platform has forgotten it, and the refusal message is more useful
 * than an absent row. `Badge` is not used inside an `<option>` — the native
 * picker will not render markup — so the state is spelled out in the text.
 *
 * `required` because `createDisbursementBatchSchema` requires `schoolId` with no
 * default (`admin.finance.validation.js:92`); the client-side check is for a
 * better message, not a substitute for the server's.
 */
export const SchoolPicker = ({ value, onChange, error, className, onLoaded }) => (
  <div className={className}>
    <SchoolSelect
      label="School to pay"
      value={value}
      onChange={onChange}
      placeholder="Choose a school"
      required
      error={error}
      onLoaded={onLoaded}
    />
    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-400">
      A suspended school is refused by the server before a batch is written — a tenant the platform
      has said should not be transacting must not have money queued to leave it.
    </p>
  </div>
);

/**
 * The same control again, for the confirmation dialogs.
 *
 * Shared with the filters rather than duplicated because a dialog that lists a
 * *different* school than the one the operator just picked is the kind of
 * divergence that gets money paid to the wrong tenant — and there is no
 * undisplayed truth to catch it, since the dialog is the last thing read before
 * the money moves. Rendered read-only (see `ApproveBatchModal`), which is why the
 * third argument differs rather than the component.
 */
export const SchoolSummary = ({ school }) => (
  <span className="flex items-center gap-2">
    <Badge tone="brand" icon={Building2}>
      {school?.schoolName || school?.name || 'Unknown school'}
    </Badge>
    {school?.schoolCode ? (
      <span className="font-mono text-[11px] font-bold text-slate-400">{school.schoolCode}</span>
    ) : null}
  </span>
);

export default SchoolSelect;
