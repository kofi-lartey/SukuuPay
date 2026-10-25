import { Link } from 'react-router-dom';
import { Users, ChevronRight } from 'lucide-react';
import { useMyClasses } from '../../hooks/teacher/useMyClasses';
import { TEACHER_ROUTES } from '../../utils/constants';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';

/**
 * The class list.
 *
 * A plain list rather than cards with sparklines: the question a teacher is
 * answering here is "which of my classes do I want to open", and the answer is
 * a name plus a headcount. Anything more is noise they have already seen on
 * the dashboard.
 *
 * The error state offers a retry rather than only a message — the query is
 * `useMyClasses`, which React Query caches for five minutes, so without an
 * explicit `refetch` a teacher on a dropped connection would have to leave the
 * page and come back to try again.
 */
const MyClasses = () => {
  const { data: classes, isLoading, error, refetch } = useMyClasses();

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorBanner
          message={error.message || 'Your classes could not be loaded.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] font-semibold text-slate-500">
        {isLoading ? 'Loading your classes…' : `${classes?.length || 0} classes`}
      </p>

      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !classes?.length ? (
        <EmptyState
          icon={Users}
          title="No classes assigned yet"
          description="Your school administrator will assign your classes. Check back soon."
        />
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li key={c.className}>
              <Link
                to={TEACHER_ROUTES.classDetail(c.className)}
                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition-colors hover:border-sky-200 hover:bg-sky-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold text-ink">{c.className}</p>
                  <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                    {c.subjects?.length ? c.subjects.join(', ') : 'Class teacher'} · {c.studentCount} students
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyClasses;
