import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, ClipboardList, Users, Menu } from 'lucide-react';
import { TEACHER_ROUTES } from '../../utils/constants';

/** Five destinations, matched to the thumb. "More" is Profile, which holds the rest. */
const TABS = [
  { key: 'dashboard', label: 'Home', to: TEACHER_ROUTES.dashboard, icon: LayoutDashboard },
  { key: 'classes', label: 'Classes', to: TEACHER_ROUTES.classes, icon: Users },
  { key: 'attendance', label: 'Attendance', to: TEACHER_ROUTES.attendance, icon: CalendarCheck },
  { key: 'grades', label: 'Grades', to: TEACHER_ROUTES.grades, icon: ClipboardList },
  { key: 'profile', label: 'More', to: TEACHER_ROUTES.profile, icon: Menu },
];

/**
 * The bottom bar — the mobile face of `TeacherSidebar`.
 *
 * Fixed, with the safe-area inset as bottom padding so it clears the home
 * indicator on a notched handset rather than sitting under it. `pb-[env(...)]`
 * is on the outer `nav` and the tab heights stay constant, because a bar that
 * grows on some devices makes every target on it move.
 *
 * Five items is the ceiling, not a starting point: at 320px anything more is
 * either a squashed icon or a truncated word, and a bar whose labels move is
 * one people stop trusting. Everything else — schedule, reports,
 * notifications, sign-out — lives behind "More", which is Profile.
 */
const TeacherBottomNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
    <div className="mx-auto flex max-w-md">
      {TABS.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.key === 'dashboard'}
          className={({ isActive }) =>
            `relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 pt-1.5 text-[10.5px] font-bold ${
              isActive ? 'text-sky-700' : 'text-slate-500 hover:text-slate-700'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {/*
                The sky-600 accent on the current tab — a bar along the top edge,
                where a thumb does not cover it. Colour alone would not do: a
                colour-blind teacher, or a washed-out screen in daylight, reads
                the weight of the icon and the label as the change, and the bar
                is what makes the state legible at a glance.
              */}
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-0 h-1 -translate-x-1/2 rounded-full bg-sky-600 transition-all ${
                  isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'
                }`}
              />
              <item.icon
                className="h-[22px] w-[22px]"
                strokeWidth={isActive ? 2.3 : 2}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default TeacherBottomNav;
