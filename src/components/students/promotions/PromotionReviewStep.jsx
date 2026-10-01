import React, { useMemo, useState } from 'react';
import { ArrowUpRight, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import EmptyState from '../../dashboard/EmptyState';
import Pagination from '../Pagination';
import StudentAvatar from '../StudentAvatar';
import { SelectField } from '../../common/FormField';
import { formatCedi, formatCount } from '../../../utils/format';

const PER_PAGE = 20;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'promote', label: 'Promoting' },
  { value: 'repeat', label: 'Repeating' },
];

/**
 * Step 2: every student who is about to move, one row each.
 *
 * The step is a *decision* surface, not a confirmation of what the bulk call
 * will do — a bursar who disagrees with one student out of 121 has to be able to
 * say so here, or the wizard is only a one-click way to move a JHS 1 into a JHS
 * 2. The decision is held in `decisions` and applied on commit, so nothing is
 * written while the user is still scrolling.
 *
 * Repeating is a *server* flag (`Student.isRepeating`) with its own counter and
 * its own audit entry, not a value this screen invents. So the repeat toggle
 * calls `markRepeating`, and turning it back off calls `clearRepeating` — which
 * needs a written reason, because the server records it. That asymmetry is why
 * a cleared repeat opens a prompt rather than silently reverting.
 *
 * Outstanding balances are surfaced, never blocked on. A bursar can and should
 * be able to promote a student who owes money — the ledger follows the student.
 * Hiding the column would make the review screen look like a fee screen.
 */
const PromotionReviewStep = ({
  students,
  decisions,
  onDecide,
  onClearRepeat,
  classes,
  loading,
  error,
  busy,
}) => {
  const [filter, setFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      if (classFilter && student.studentClass !== classFilter) return false;
      if (term && !String(student.studentName || '').toLowerCase().includes(term)) return false;
      // The decision map is the truth about intent, not `isRepeating`: a user
      // who has just ticked "repeat" should see the row move tabs immediately,
      // rather than waiting on a refetch of a flag the server has not seen yet.
      const intent = decisions[String(student._id || student.id)];
      if (filter === 'repeat') return intent === 'repeat';
      if (filter === 'promote') return intent !== 'repeat';
      return true;
    });
  }, [students, decisions, filter, classFilter, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visible = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const counts = useMemo(
    () => ({
      all: students.length,
      repeat: students.filter((s) => decisions[String(s._id || s.id)] === 'repeat').length,
    }),
    [students, decisions]
  );

  const setFilterAndReset = (next) => {
    setFilter(next);
    setPage(1);
  };

  if (error) {
    return (
      <Card padding="p-5">
        <p className="text-sm font-bold text-red-700">{error.message}</p>
      </Card>
    );
  }

  if (!loading && !students.length) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No students to review"
        description="There are no active students in the classes you mapped, so there is nothing to promote or review."
      />
    );
  }

  return (
    <>
      <Card padding="p-4" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter students by decision"
            className="flex items-center gap-1.5"
          >
            {FILTERS.map((option) => {
              const count = option.value === 'all' ? counts.all : counts[option.value];
              const active = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilterAndReset(option.value)}
                  aria-pressed={active}
                  className={`rounded-xl px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
                    active ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                  <span className={active ? 'ml-1.5 text-brand-100' : 'ml-1.5 text-slate-400'}>
                    {formatCount(count)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[13rem] flex-1">
            <label htmlFor="promotion-search" className="sr-only">
              Search students
            </label>
            <Search
              className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="promotion-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search student name…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <div className="w-full sm:w-48">
            <SelectField
              label="Class"
              value={classFilter}
              onChange={(event) => {
                setClassFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All classes</option>
              {classes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </Card>

      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                {['Student', 'Current class', 'Balance', 'Decision'].map((heading) => (
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
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td colSpan={4} className="px-5 py-4">
                        <div className="h-6 animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                : visible.map((student) => {
                    const id = String(student._id || student.id);
                    const intent = decisions[id];
                    const repeating = intent === 'repeat';

                    return (
                      <tr
                        key={id}
                        className={repeating ? 'border-t border-amber-100 bg-amber-50/40' : 'border-t border-slate-100'}
                      >
                        <th scope="row" className="px-5 py-3 font-normal">
                          <div className="flex items-center gap-3">
                            <StudentAvatar student={student} size="md" />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-extrabold text-ink">
                                {student.studentName}
                              </span>
                              <span className="block font-mono text-[11px] font-bold text-slate-500">
                                {student.studentId}
                              </span>
                            </span>
                          </div>
                        </th>

                        <td className="whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600">
                          {student.studentClass}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3 text-[13px] font-extrabold tabular-nums">
                          {(student.balance || 0) > 0 ? (
                            <span className="text-amber-700">{formatCedi(student.balance)}</span>
                          ) : (
                            <span className="text-emerald-600">{formatCedi(0)}</span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              role="group"
                              aria-label={`Promotion decision for ${student.studentName}`}
                              className="flex items-center gap-1"
                            >
                              <button
                                type="button"
                                onClick={() => onDecide(id, 'promote')}
                                disabled={busy}
                                aria-pressed={!repeating}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors disabled:opacity-50 ${
                                  !repeating
                                    ? 'bg-brand-700 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                Promote
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  // Clearing an *already-set* repeat is a different
                                  // act from setting one: the server records a
                                  // written reason and stamps an audit entry, so
                                  // it is confirmed rather than assumed.
                                  if (student.isRepeating && !repeating) onClearRepeat(student);
                                  else onDecide(id, 'repeat');
                                }}
                                disabled={busy}
                                aria-pressed={repeating}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors disabled:opacity-50 ${
                                  repeating
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                Repeat
                              </button>
                            </div>

                            {repeating && !student.isRepeating && (
                              <Badge tone="amber">New</Badge>
                            )}
                            {student.isRepeating && repeating && (
                              <Badge tone="slate">Already flagged</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {!loading && !visible.length && (
          <p className="px-5 py-10 text-center text-[13px] font-semibold text-slate-500">
            No students match these filters.
          </p>
        )}

        {rows.length > PER_PAGE && (
          <Pagination
            meta={{ page: safePage, perPage: PER_PAGE, total: rows.length, totalPages }}
            onPageChange={setPage}
            itemLabel="students in review"
          />
        )}
      </Card>
    </>
  );
};

export default PromotionReviewStep;
