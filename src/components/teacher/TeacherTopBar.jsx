import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TEACHER_ROUTES } from '../../utils/constants';

/**
 * Page title from the path.
 *
 * Derived rather than set per page, so a new route cannot arrive without a
 * title — the alternative is a header that reads "Teacher" over a working
 * screen. Segment-aware (`slice(2)`), because every teacher route is
 * `/teacher/<section>[/<id>]` and the section is the title; the id is what
 * makes it a detail page, which is a different word but not a different
 * section.
 */
const titleForPath = (pathname) => {
  const rest = pathname.split('/').slice(2);
  if (!rest.length) return 'Dashboard';
  switch (rest[0]) {
    case 'classes':
      return rest[1] ? 'Class' : 'My Classes';
    case 'attendance':
      return rest[1] ? 'Take Attendance' : 'Attendance';
    case 'grades':
      return rest[1] ? 'Enter Grades' : 'Grades';
    case 'records':
      return 'Terminal Reports';
    case 'schedule':
      return 'My Schedule';
    case 'notifications':
      return 'Notifications';
    case 'profile':
      return 'Profile';
    default:
      return 'Teacher';
  }
};

/**
 * The header: what screen this is, and who is signed in.
 *
 * Sticky with a backdrop blur, so a teacher who has scrolled halfway down a
 * thirty-name register still knows whether they are marking attendance or
 * entering grades — the two most similar-looking screens in the portal.
 *
 * The bell is `h-11 w-11` rather than a smaller `h-10`: it is the only
 * icon-only control up here, and on a phone it is the tap that has to work
 * first time.
 */
const TeacherTopBar = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to={TEACHER_ROUTES.dashboard}
          aria-label="Home"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A5C36] text-[15px] font-extrabold text-white lg:hidden"
        >
          S
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16.5px] font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-[11.5px] font-medium text-slate-500">
            {user?.name || 'Teacher'}
          </p>
        </div>
        <Link
          to={TEACHER_ROUTES.notifications}
          aria-label="Notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <Bell className="h-[21px] w-[21px]" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
};

export default TeacherTopBar;
