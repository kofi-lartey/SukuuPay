import React, { useEffect, useState } from 'react';
import { GraduationCap, Search } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Badge from '../dashboard/ui/Badge';
import EmptyState from '../dashboard/EmptyState';
import { SelectField } from '../common/FormField';
import { listAlumni } from '../../services/students';
import StudentAvatar from './StudentAvatar';
import { formatCedi, formatCount } from '../../utils/format';
import { formatGhanaPhone } from '../../utils/ghanaPhone';

const HONORS = [
  ['', 'All honors'],
  ['NONE', 'No honors'],
  ['HONORS', 'Honors'],
  ['HIGH_HONORS', 'High Honors'],
  ['HIGHEST_HONORS', 'Highest Honors'],
];

/**
 * Students who have graduated.
 *
 * The honors filter is on this screen because it now works: `honors` was
 * written by the graduation endpoint and read by this query but had no field on
 * the model, so with Mongoose `strict` on the write was dropped and the filter
 * matched nothing. An alumni list that silently cannot be filtered by honors is
 * worse than one that admits the column is not recorded.
 */
const AlumniTab = ({ schoolId }) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [search, setSearch] = useState('');
  const [honors, setHonors] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!schoolId) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listAlumni({ schoolId, page, limit: 20, search: search || undefined, honors: honors || undefined, graduationYear: graduationYear || undefined })
      .then((result) => {
        if (active) setState({ ...result, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ rows: [], meta: null, loading: false, error });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, page, search, honors, graduationYear]);

  return (
    <>
      <Card padding="p-4" className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <label htmlFor="alumni-search" className="mb-0.5 block text-[11px] font-semibold text-slate-700">
              Search
            </label>
            <Search
              className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="alumni-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, student number or certificate…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <SelectField
            label="Graduation year"
            value={graduationYear}
            onChange={(event) => {
              setGraduationYear(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All years</option>
            {[2026, 2025, 2024, 2023, 2022].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Honors"
            value={honors}
            onChange={(event) => {
              setHonors(event.target.value);
              setPage(1);
            }}
          >
            {HONORS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      {state.error && (
        <Card padding="p-5">
          <p className="text-sm font-bold text-red-700">{state.error.message}</p>
        </Card>
      )}

      {!state.error && !state.loading && !state.rows.length ? (
        <EmptyState
          icon={GraduationCap}
          title="No graduates recorded yet"
          description="Students appear here once they have been graduated from this module, with their certificate number and honors."
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50">
                  {['Student', 'Graduated', 'Certificate', 'Honors', 'Outstanding at exit'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {state.loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="h-6 animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))
                  : state.rows.map((alumnus) => {
                      const guardian = (alumnus.parents || []).find((p) => p.isPrimary);
                      return (
                        <tr key={alumnus._id} className="border-t border-slate-100">
                      <th scope="row" className="flex items-center gap-3 px-5 py-3 font-normal">
                        <StudentAvatar student={alumnus} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-extrabold text-ink">
                            {alumnus.studentName}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500">
                            {alumnus.studentId}
                            {guardian?.phone ? ` · ${formatGhanaPhone(guardian.phone)}` : ''}
                          </span>
                        </span>
                      </th>
                          <td className="whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600">
                            {alumnus.graduationDate
                              ? new Date(alumnus.graduationDate).toLocaleDateString('en-GB')
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] font-bold text-slate-600">
                            {alumnus.certificateNumber || '—'}
                          </td>
                          <td className="px-5 py-3">
                            {alumnus.honors && alumniIsHonoured(alumnus.honors) ? (
                              <Badge tone="brand">{alumnus.honors.replace(/_/g, ' ')}</Badge>
                            ) : (
                              <span className="text-[12px] font-semibold text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums">
                            {alumnus.balance > 0 ? (
                              <span className="text-red-600">{formatCedi(alumnus.balance)}</span>
                            ) : (
                              <span className="text-emerald-600">{formatCedi(0)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {state.meta?.totalItems > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12px] font-semibold text-slate-500">
              <span>
                {formatCount(state.meta.totalItems)} graduate
                {state.meta.totalItems === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-extrabold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-extrabold text-ink">
                  {page} / {state.meta.totalPages || 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!state.meta.hasNext}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-extrabold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
};

const alumniIsHonoured = (honors) => honors && honors !== 'NONE';

export default AlumniTab;
