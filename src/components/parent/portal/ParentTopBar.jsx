import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { PARENT_ROUTES } from '../../../utils/constants';
import { initialsOf } from '../../../utils/parentFormat';
import { PRIMARY_NAV } from './navConfig';

/**
 * The bar: brand, page title, notifications, avatar.
 *
 * Full-width with a `max-w-7xl` inner measure rather than the `max-w-md`
 * column it started as — the shell's grid puts it beside a rail on desktop, so
 * a phone-width centering here would float the bell and avatar in the middle of
 * a wide screen with nothing to the left of them.
 *
 * ## The title comes from the route, not the page
 *
 * Each page renders its own big heading; this bar's title is the compact one,
 * derived here so a page cannot be on screen under a title that belongs to
 * another page. A route the map does not know falls back to the brand.
 *
 * ## One main title, one sub-line
 *
 * The title is the page. The sub-line is context — the student's name on the
 * parent pages, the page's own sub-heading elsewhere. Both are single-line
 * truncated, so the bar's height never depends on the content beneath it.
 */

/** Maps the path under `/pay/:token` to the compact title. */
const titleForPath = (rest) => {
  if (!rest.length) return 'Home';
  switch (rest[0]) {
    case 'fees':
      return 'Fees & Bills';
    case 'attendance':
      return 'Attendance';
    case 'records':
      return 'Records';
    case 'timetable':
      return 'Timetable';
    case 'notifications':
      return 'Notifications';
    case 'messages':
      return rest[1] ? 'Conversation' : 'Messages';
    case 'profile':
      return 'Profile';
    case 'plan':
      return 'Payment plan';
    case 'support':
      return 'Message the school';
    case 'history':
      return 'Payment history';
    default:
      return 'SukuuPay';
  }
};

/**
 * The bell. A dot rather than a count: the count belongs to the feed, and a
 * number in a 24px icon is unreadable on the handsets this portal is built
 * for. The dot is the only red in the bar so it cannot be confused with
 * anything else on it.
 */
const BellButton = ({ unread, href }) => (
  <Link
    to={href}
    aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
  >
    <svg
      viewBox="0 0 24 24"
      className="h-[21px] w-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {unread > 0 ? (
      <span
        aria-hidden="true"
        className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
      />
    ) : null}
  </Link>
);

/** The avatar, which is the only route to the profile page from the bar. */
const AvatarButton = ({ initials, href }) => (
  <Link
    to={href}
    aria-label="Profile and settings"
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[12.5px] font-extrabold text-[#0A5C36] ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-200"
  >
    {initials}
  </Link>
);

const ParentTopBar = ({ student, unread = 0 }) => {
  const { token } = useParams();
  const { pathname } = useLocation();

  // Everything after the token segment. `/pay/abc/messages/thread-1` →
  // ['messages','thread-1'], which is what `titleForPath` reads.
  const rest = pathname.split('/').slice(3);
  const title = titleForPath(rest);

  // The sub-line is the student's name on any page that is about the child,
  // and blank on the rest. Home, Attendance, Records, Timetable, Messages,
  // Fees — every one of these reads better with "Kwame Mensah · JHS 2A"
  // underneath it than it does with nothing.
  const showStudentLine = Boolean(
    student?.studentName && rest[0] !== 'profile' && rest[0] !== 'notifications'
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* The brand mark is only visible on mobile, where the rail's header
            is not there to carry it. On desktop the rail already announces
            SukuuPay above this bar. */}
        <Link
          to={PARENT_ROUTES.portal(token)}
          aria-label="Home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A5C36] text-[15px] font-extrabold text-white shadow-sm lg:hidden"
        >
          S
        </Link>

        {/* Title block. `min-w-0` + `truncate` means a long title ellipsises
            rather than pushing the icons off the bar. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16.5px] font-extrabold leading-tight tracking-tight text-slate-900">
            {title}
          </h1>
          {showStudentLine ? (
            <p className="mt-0.5 truncate text-[11.5px] font-medium leading-tight text-slate-500">
              {student.studentName}
              {student.studentClass ? ` · ${student.studentClass}` : ''}
            </p>
          ) : null}
        </div>

        <BellButton unread={unread} href={PARENT_ROUTES.notifications(token)} />
        <AvatarButton
          initials={initialsOf(student?.studentName)}
          href={PARENT_ROUTES.profile(token)}
        />
      </div>
    </header>
  );
};

/**
 * The bottom bar: the five places a phone can reach.
 *
 * **Five, not everything.** The design mock's tab bar is Home / Attendance /
 * Records / Fees / More, and More is where the long tail lives (messages,
 * notifications, timetable, help). A seventh tab would halve each target on a
 * 360px screen for destinations a parent opens once a term.
 *
 * **Hidden above `lg`.** The rail takes over there, and two navigations
 * disagreeing about the same five routes is worse than either alone — so the
 * bar is removed from the desktop layout rather than shrunk into it.
 *
 * **NavLink, not a manual active check.** Active state belongs to the router —
 * a second implementation of "am I on this page" is a second place for the two
 * to disagree, and the disagreement shows up as a highlighted tab that goes
 * nowhere.
 */
const BottomNav = () => {
  const { token } = useParams();

  return (
    <nav
      aria-label="Portal sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-md">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.key}
            to={item.path(token)}
            end={item.key === 'home'}
            className={({ isActive }) =>
              `relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 pt-1.5 text-[10.5px] font-bold transition-colors ${
                isActive
                  ? 'text-[#0A5C36]'
                  : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active dot above the icon — a small, quiet indicator that
                    reads at a glance on a dark or light background, and
                    survives the icon weight change without needing a pill. */}
                <span
                  aria-hidden="true"
                  className={`absolute top-1 h-1 w-1 rounded-full bg-[#0A5C36] transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.3 : 2}
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export { ParentTopBar, BottomNav };
export default ParentTopBar;
