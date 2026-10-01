import React, { useEffect, useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Badge from '../dashboard/ui/Badge';
import EmptyState from '../dashboard/EmptyState';
import { getCohort, listCohorts } from '../../services/students';
import StudentAvatar from './StudentAvatar';
import { formatCount } from '../../utils/format';

/**
 * Graduating cohorts.
 *
 * A cohort is not a stored record — there is no `Cohort` collection. It is the
 * set of students sharing a `graduationYear`, reconstructed by the server. That
 * is worth stating here because it shapes the UI: a cohort has no editable
 * name, no dates and no teacher, only a year and the students who left in it.
 *
 * The class counts come from the server's own final-year list, which honours
 * `School.academic.finalYearClasses` when a school has named its own. So a
 * basic-and-JHS school shows "JHS 3: 46" rather than the last three classes on
 * its list, which would have been JHS 1–3.
 */
const CohortsTab = ({ schoolId }) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [openCohort, setOpenCohort] = useState(null);
  const [detail, setDetail] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!schoolId) return undefined;
    let active = true;
    setState((current) => ({ ...current, loading: true }));

    listCohorts({ schoolId, page: 1, limit: 20 })
      .then((result) => {
        if (active) setState({ ...result, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ rows: [], meta: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [schoolId]);

  const open = (cohort) => {
    setOpenCohort(cohort);
    setDetail({ data: null, loading: true, error: null });
    getCohort(cohort.id, { schoolId, page: 1, limit: 50 })
      .then((data) => setDetail({ data, loading: false, error: null }))
      .catch((error) => setDetail({ data: null, loading: false, error }));
  };

  if (state.error) {
    return (
      <Card padding="p-5">
        <p className="text-sm font-bold text-red-700">{state.error.message}</p>
      </Card>
    );
  }

  if (!state.loading && !state.rows.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No cohorts yet"
        description="A cohort appears here once its students have graduated. Graduate a class from this module to create the first one."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
            ))
          : state.rows.map((cohort) => (
              <button
                key={cohort._id || cohort.id}
                type="button"
                onClick={() => open(cohort)}
                className="rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-soft transition-colors hover:border-brand-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-extrabold text-ink">{cohort.name}</h3>
                  <Badge tone="slate">{cohort._id || cohort.id}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                  {cohort.academicYear}
                </p>

                <p className="mt-3 text-2xl font-extrabold text-ink">
                  {formatCount(cohort.studentCount)}
                </p>
                <p className="text-[11px] font-semibold text-slate-500">students in the cohort</p>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="font-semibold text-slate-400">Graduated</dt>
                    <dd className="font-extrabold text-ink">{formatCount(cohort.graduatedCount || 0)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-400">Transferred</dt>
                    <dd className="font-extrabold text-ink">
                      {formatCount(cohort.transferredCount || 0)}
                    </dd>
                  </div>
                </dl>
              </button>
            ))}
      </div>

      {openCohort && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-slate-50 shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-ink">
                  {openCohort.name}
                </h2>
                <p className="text-[12px] font-semibold text-slate-500">
                  {openCohort.academicYear} · {formatCount(openCohort.studentCount)} students
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenCohort(null)}
                className="rounded-lg px-3 py-1.5 text-[13px] font-extrabold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </header>

            <div className="space-y-4 p-5">
              {detail.loading && <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />}
              {detail.error && (
                <p className="text-sm font-bold text-red-700">{detail.error.message}</p>
              )}

              {detail.data && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Total', value: detail.data.cohort.statistics.totalStudents },
                      { label: 'Graduated', value: detail.data.cohort.statistics.graduated },
                      { label: 'Transferred', value: detail.data.cohort.statistics.transferred },
                      { label: 'Repeating', value: detail.data.cohort.statistics.repeating },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-white p-4 shadow-soft">
                        <p className="text-[11px] font-extrabold uppercase text-slate-400">
                          {stat.label}
                        </p>
                        <p className="mt-1 text-xl font-extrabold tabular-nums text-ink">
                          {formatCount(stat.value || 0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {detail.data.cohort.classes?.length > 0 && (
                    <Card padding="p-5">
                      <h3 className="mb-3 text-sm font-extrabold text-ink">Final-year classes</h3>
                      <ul className="space-y-2">
                        {detail.data.cohort.classes.map((cls) => (
                          <li
                            key={cls.id}
                            className="flex items-center justify-between gap-3 text-[13px]"
                          >
                            <span className="font-extrabold text-ink">{cls.name}</span>
                            <span className="flex items-center gap-3 text-slate-500">
                              <span className="flex items-center gap-1 font-semibold">
                                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatCount(cls.studentCount)}
                              </span>
                              {/* Reported as null rather than an empty string: there is
                                  no teacher assignment anywhere in this system, and a
                                  blank reads as missing data rather than "not
                                  recorded". */}
                              <span className="text-[11px]">
                                {cls.teacher || 'no teacher recorded'}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  <Card padding="p-0">
                    <ul className="divide-y divide-slate-100">
                      {detail.data.students.map((student) => (
                        <li
                          key={student._id}
                          className="flex items-center justify-between gap-3 px-5 py-3"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <StudentAvatar student={student} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-extrabold text-ink">
                                {student.studentName}
                              </span>
                              <span className="block text-[11px] font-semibold text-slate-500">
                                {student.studentId} · {student.studentClass}
                              </span>
                            </span>
                          </span>
                          <Badge tone="slate">{student.status?.replace(/_/g, ' ')}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CohortsTab;
