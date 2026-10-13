/**
 * Notification fixtures — the feed behind the bell and the Notifications page.
 *
 * Every row carries a `to` deep link (relative to the pay token), because a
 * notification that cannot be tapped into the page it refers to is just a
 * message about something the parent now has to go and find. `type` selects the
 * icon and colour — one vocabulary across the bell, the feed and Home's Recent
 * Activity, which reads the same rows.
 */

export const notifications = [
  {
    id: 'notif-1',
    type: 'attendance',
    title: 'Attendance marked',
    body: 'Kwame arrived at JHS 2A homeroom · 8:15 am',
    at: 'Today, 8:15 am',
    atShort: '8:15 am',
    unread: true,
    to: 'attendance',
  },
  {
    id: 'notif-2',
    type: 'academics',
    title: 'Terminal report ready',
    body: 'Term 2 formal assessment signed by Headmaster',
    at: '2 days ago',
    atShort: '2d ago',
    unread: true,
    to: 'records',
  },
  {
    id: 'notif-3',
    type: 'message',
    title: 'New message from Mrs. Adjei',
    body: 'He should work on participating more in class discussions',
    at: '2 hours ago',
    atShort: '2h ago',
    unread: true,
    to: 'messages/thread-1',
  },
  {
    id: 'notif-4',
    type: 'fee',
    title: 'Payment received',
    body: 'GHS 300.00 · MTN MoMo Ref #SKP-2024-9104',
    at: '5 days ago',
    atShort: '5d ago',
    unread: false,
    to: 'fees',
  },
  {
    id: 'notif-5',
    type: 'notice',
    title: 'PTA General Assembly',
    body: 'Saturday, 9:00 AM at the School Assembly Hall',
    at: '2 days ago',
    atShort: '2d ago',
    unread: false,
    to: 'messages',
  },
  {
    id: 'notif-6',
    type: 'fee',
    title: 'Term 2 fees due soon',
    body: 'GHS 550.00 remaining · due in 5 days',
    at: '3 days ago',
    atShort: '3d ago',
    unread: false,
    to: 'fees',
  },
];

/** Unread count for the bell badge — derived, never stored. */
export const unreadNotificationCount = notifications.filter((n) => n.unread).length;
