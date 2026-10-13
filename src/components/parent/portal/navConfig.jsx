import { PARENT_ROUTES } from '../../../utils/constants';

/**
 * Where the portal goes, in one place.
 *
 * The bottom bar and the desktop rail read this same list, which is the only
 * way the two navigations can stay honest: a destination that exists on one
 * and not the other is how a parent ends up with a tab that works on their
 * phone and a rail row that 404s on their laptop.
 *
 * ## Two groups, because the phone has one bar and the desktop has a column
 *
 * The phone shows `PRIMARY` plus a More tab; the desktop rail shows `PRIMARY`
 * and `SECONDARY` as two clearly-labelled groups, because a column has room
 * for eight rows and a 360px screen does not. Both point at the same
 * destinations — the difference is grouping, not content.
 *
 * ## Icons are 24×24 viewBox, stroke 2, `currentColor`
 *
 * Every icon is drawn at the same visual weight so a row of them reads as a
 * set. The active state thickens the stroke to 2.3 — enough to feel "on"
 * without a size change that would shift the layout.
 */

const HOME_ICON = (
  <>
    <path d="M3 10.5L12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.5 21v-6h5v6" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const ATTENDANCE_ICON = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    <path d="M9 15.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const RECORDS_ICON = (
  <>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 3v5h5M9 13h6M9 17h6" strokeLinecap="round" />
  </>
);

const FEES_ICON = (
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" strokeLinecap="round" />
  </>
);

const MORE_ICON = (
  <>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </>
);

const MESSAGES_ICON = (
  <>
    <path d="M21 12a8 8 0 01-8 8H4l2-3a8 8 0 1115-5z" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const NOTIFICATIONS_ICON = (
  <>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const TIMETABLE_ICON = (
  <>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
    <path d="M8 13h3M8 16.5h6" strokeLinecap="round" />
  </>
);

const PROFILE_ICON = (
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/**
 * The five destinations that earn a permanent slot on the phone's bar.
 *
 * More is the hub for the long tail — the mobile design puts the secondary
 * destinations behind one tab rather than behind a hamburger, because the
 * parent who opens this from an SMS should never meet a drawer.
 */
export const PRIMARY_NAV = [
  { key: 'home', label: 'Home', path: (token) => PARENT_ROUTES.portal(token), icon: HOME_ICON },
  {
    key: 'attendance',
    label: 'Attendance',
    path: (token) => PARENT_ROUTES.attendance(token),
    icon: ATTENDANCE_ICON,
  },
  {
    key: 'records',
    label: 'Records',
    path: (token) => PARENT_ROUTES.records(token),
    icon: RECORDS_ICON,
  },
  { key: 'fees', label: 'Fees', path: (token) => PARENT_ROUTES.fees(token), icon: FEES_ICON },
  { key: 'more', label: 'More', path: (token) => PARENT_ROUTES.profile(token), icon: MORE_ICON },
];

/**
 * Everything the desktop rail shows under "More".
 *
 * Deliberately not a separate set of routes: the phone reaches these through
 * the profile page's link list, and the rail reaches them directly. One
 * source, two presentations.
 */
export const SECONDARY_NAV = [
  {
    key: 'messages',
    label: 'Messages',
    path: (token) => PARENT_ROUTES.messages(token),
    icon: MESSAGES_ICON,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    path: (token) => PARENT_ROUTES.notifications(token),
    icon: NOTIFICATIONS_ICON,
  },
  {
    key: 'timetable',
    label: 'Timetable',
    path: (token) => PARENT_ROUTES.timetable(token),
    icon: TIMETABLE_ICON,
  },
  {
    key: 'profile',
    label: 'Profile & Settings',
    path: (token) => PARENT_ROUTES.profile(token),
    icon: PROFILE_ICON,
  },
];
