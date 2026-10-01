import React from 'react';
import { Check, GraduationCap, PencilLine, RotateCcw, Sparkles } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import { formatCount, formatCedi } from '../../../utils/format';

/**
 * Step 1 of the end-of-year wizard: what happens to each class.
 *
 * This is the step where a bursar catches a mistake, so it shows the *whole*
 * class list rather than only the classes the server could map. A final-year
 * class has no next class and is therefore absent from the preview response
 * entirely — a matrix built from the preview alone would quietly omit the exact
 * rows the wizard exists to make you notice.
 *
 * The target is editable per row because a class list is ordered, not
 * necessarily a progression. A school listing `JHS 1A, JHS 1B, JHS 2A, JHS 2B`
 * would otherwise promote 1A into 1B; the override is how the user says so
 * without reordering the list that every other screen reads.
 */
const ClassMappingStep = ({ matrix, classes, onTargetChange, onReset, hasOverrides, loading, error }) => {
  if (error) {
    return (
      <Card padding="p-5">
        <p className="text-sm font-bold text-red-700">{error.message}</p>
      </Card>
    );
  }

  if (!loading && !matrix.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No classes to promote"
        description="This school has no classes configured, so there is nothing to promote. Add your class list to run an end-of-year rollover."
      />
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-ink">
            Class transition mapping
          </h2>
          <p className="text-[12px] font-semibold text-slate-500">
            Review where every class moves to before anything is written.
          </p>
        </div>

        {/* Only rendered once there is something to undo. A "reset" that is
            always on screen invites being pressed on an untouched form, and a
            user who does that has to re-enter every real override. */}
        {hasOverrides && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset to school defaults
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50">
              {['Current class', 'Enrolled', 'Promote to', 'Outcome'].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td colSpan={4} className="px-5 py-4">
                      <div className="h-6 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              : matrix.map((row) => (
                  <tr
                    key={row.className}
                    className={row.isFinalYear ? 'border-t border-amber-100 bg-amber-50/40' : 'border-t border-slate-100'}
                  >
                    <th scope="row" className="px-5 py-3.5 font-normal">
                      <span className="block text-[13px] font-extrabold text-ink">
                        {row.className}
                      </span>
                      {row.outstanding.length > 0 && (
                        <span className="block text-[11px] font-semibold text-amber-700">
                          {formatCount(row.outstanding.length)} with an outstanding balance
                        </span>
                      )}
                    </th>

                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px] font-extrabold tabular-nums text-slate-700">
                      {formatCount(row.enrolled)}
                    </td>

                    <td className="px-5 py-3.5">
                      {row.isFinalYear ? (
                        <span className="text-[13px] font-extrabold text-amber-800">
                          Graduate — move to Alumni
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <select
                              aria-label={`Promote ${row.className} to`}
                              value={row.target || ''}
                              onChange={(event) => onTargetChange(row.className, event.target.value)}
                              className={`h-9 cursor-pointer appearance-none rounded-lg border bg-white py-1 pl-3 pr-8 text-[13px] font-extrabold focus:outline-none focus:ring-2 focus:ring-brand-700/20 ${
                                row.overridden
                                  ? 'border-amber-300 text-amber-900'
                                  : 'border-slate-200 text-ink'
                              }`}
                            >
                              {/* A class may legitimately promote to itself, or to
                                  any other class, not only to the next one. So
                                  the list is the whole class list with the
                                  current class struck out — narrowing it to
                                  "later classes only" would forbid a split
                                  stream merging backwards, which a real
                                  timetable does. */}
                              {classes
                                .filter((name) => name !== row.className)
                                .map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
                              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          </div>

                          {row.overridden && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700">
                              <PencilLine className="h-3 w-3" aria-hidden="true" />
                              Overridden
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {row.isFinalYear ? (
                        <Badge tone="amber" icon={GraduationCap}>
                          Final year cohort
                        </Badge>
                      ) : row.repeating.length > 0 ? (
                        <Badge tone="amber">{formatCount(row.repeating.length)} repeating</Badge>
                      ) : (
                        <Badge tone="green" icon={Check}>
                          Standard progression
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {matrix.some((row) => row.isFinalYear) && (
        <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[12px] font-semibold text-slate-500">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
          Final-year classes are set by your school's class list. They are
          graduated, not promoted, and are handled in the last step of this
          wizard.
        </p>
      )}
    </Card>
  );
};

/**
 * The band between the matrix and the confirm button.
 *
 * Separate from the matrix because it answers a different question: the matrix
 * is per-class, this is per-school, and a bursar scanning for "how many people
 * does this touch" should not have to add up a column of a table.
 */
export const PromotionSummary = ({ totals, balanceLabel = 'outstanding' }) => {
  const tiles = [
    {
      label: 'Promoting to next class',
      value: formatCount(totals.promoting),
      suffix: 'students',
      foot: `${formatCount(totals.promotingClasses)} class${totals.promotingClasses === 1 ? '' : 'es'}`,
    },
    {
      label: 'Graduating to Alumni',
      value: formatCount(totals.graduating),
      suffix: 'students',
      foot: `${formatCount(totals.graduatingClasses)} final-year class${totals.graduatingClasses === 1 ? '' : 'es'}`,
      tone: 'text-amber-700',
    },
    {
      label: 'Marked repeating',
      value: formatCount(totals.repeating),
      suffix: 'students',
      foot: totals.repeating ? 'Held back from promotion' : 'None held back',
    },
    {
      label: `Total ${balanceLabel}`,
      value: formatCedi(totals.outstandingAmount),
      suffix: null,
      foot: `${formatCount(totals.outstanding)} ledger${totals.outstanding === 1 ? '' : 's'} unsettled`,
      tone: totals.outstandingAmount > 0 ? 'text-amber-700' : 'text-ink',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} padding="p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
            {tile.label}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-[22px] font-extrabold leading-none tracking-tight ${tile.tone || 'text-ink'}`}>
              {tile.value}
            </span>
            {tile.suffix && (
              <span className="text-[11px] font-extrabold text-slate-500">{tile.suffix}</span>
            )}
          </p>
          <p className="mt-2 text-[11px] font-semibold text-slate-500">{tile.foot}</p>
        </Card>
      ))}
    </div>
  );
};

export default ClassMappingStep;
