import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search, UserPlus } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import { listStudents } from '../../services/students';
import { formatCedis, formatCount } from '../../utils/format';

/**
 * Which student is being planned for.
 *
 * Not a free-text field and not a dropdown of 500 students. It is a search over
 * the roster, filtered to students who **owe something**, because a plan is
 * written against an outstanding balance and the server refuses a zero one. That
 * filter is the component: a bursar who searches "Mensah" and finds four
 * children, two of whom are square, is now deciding which of the two they meant
 * every time — and if they pick a square one, they get a dead end after filling
 * the form in.
 *
 * The already-has-a-plan case is **not** shown here as a badge, and that is a
 * deliberate omission. The roster projection excludes `paymentPlans`, and the only
 * accurate answer — is there a *live* plan, as opposed to one that was completed
 * or cancelled — comes from `GET /payment-plans/:studentId`, which
 * `usePlanBuilder` calls for the selected student and which turns the refusal into
 * a stated blocker on the form. A badge derived from the raw `paymentPlans` array
 * would be true for every student who has ever been on a plan, including the ones
 * who finished it, and would be wrong more often than right.
 */
const StudentPicker = ({ selected, loading, onSelect, className = '' }) => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setFetching(true);
    setError(null);

    // `feeStatus: 'owing'` is the roster's own filter for "owes something", and
    // it is a *post-filter*: the server narrows the page it returns but does not
    // change `meta.total`, because the total is a computed `balance` that Mongo
    // cannot express. Sent as a query param rather than filtered here for exactly
    // that reason — fetching 20 students and dropping the square ones client-side
    // would tell a bursar "no match" for a school with fifty owing families, and
    // would mean paging the whole roster to find one.
    listStudents({ feeStatus: 'owing', search: search.trim(), perPage: 20 })
      .then((result) => {
        if (active) setRows(result.rows || []);
      })
      .catch((err) => {
        if (active) {
          setRows([]);
          setError(err);
        }
      })
      .finally(() => {
        if (active) setFetching(false);
      });

    return () => {
      active = false;
    };
  }, [search]);

  const owing = useMemo(() => rows.filter((row) => (row.balance || 0) > 0), [rows]);

  if (selected) {
    return (
      <Card padding="p-4" className={`flex items-start gap-3 ${className}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-700">
          {(selected.studentName || '?').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-ink">{selected.studentName}</p>
          <p className="text-[12px] font-semibold text-slate-500">
            {selected.studentClass} · {selected.studentId}
          </p>
          <p className="mt-1 text-[12px] font-extrabold text-ink">
            Balance to structure: GH₵ {formatCedis(selected.balance)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Change
        </button>
      </Card>
    );
  }

  return (
    <Card padding="p-4" className={className}>
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <h2 className="text-[13px] font-extrabold text-ink">Who is this plan for?</h2>
      </div>

      <p className="mt-1 text-[12px] font-medium text-slate-500">
        Only students with an outstanding balance appear. A plan is written against what a
        family still owes.
      </p>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by student name or ID…"
          aria-label="Search students who owe a balance"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />
      </div>

      {fetching && (
        <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Searching the roster…
        </p>
      )}

      {!fetching && error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error.message}
        </p>
      )}

      {!fetching && !error && !owing.length && (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-500">
          {search
            ? 'No student matching that name owes a balance.'
            : 'Every student is settled. There is nothing to structure.'}
        </p>
      )}

      {owing.length > 0 && (
        <ul className="mt-3 max-h-[280px] divide-y divide-slate-100 overflow-y-auto">
          {owing.map((row) => (
            <li key={row._id}>
              <button
                type="button"
                onClick={() => onSelect(row._id)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold text-ink">
                    {row.studentName}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    {row.studentClass} · {row.studentId}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-extrabold text-ink">
                    GH₵ {formatCedis(row.balance)}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    of GH₵ {formatCedis(row.totalOwed)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] font-semibold text-slate-400">
        {formatCount(owing.length)} student{owing.length === 1 ? '' : 's'} shown.
      </p>
    </Card>
  );
};

export default StudentPicker;
