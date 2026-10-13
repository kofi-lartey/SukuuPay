/**
 * Timetable & assignments fixtures — the data behind the Timetable page.
 *
 * ## Week shape
 *
 * `week` is a map of weekday → array of periods, in period order. The grid
 * renders Mon–Fri; a school that runs Saturday school will add a `sat` key and
 * the grid already maps whatever days exist. Each period carries `subject`,
 * `teacher` and `room` — a parent reading "where does my child need to be"
 * needs all three, and a timetable without the room sends them to the school
 * gate to ask.
 */

/** Period times, in the 12-hour clock the portal uses everywhere else. */
export const PERIODS = [
  { index: 1, time: '7:35 – 8:15 am', label: 'Assembly' },
  { index: 2, time: '8:15 – 9:00 am' },
  { index: 3, time: '9:00 – 9:45 am' },
  { index: 4, time: '9:45 – 10:30 am' },
  { index: 5, time: '10:30 – 11:15 am' },
  { index: 6, time: '11:15 – 12:00 pm' },
  { index: 7, time: '12:00 – 12:45 pm' },
];

const lesson = (subject, teacher, room) => ({ subject, teacher, room });

export const timetable = {
  mon: [
    lesson('Mathematics', 'Mr. Owusu', 'Room 4'),
    lesson('English Language', 'Mrs. Adjei', 'Room 4'),
    lesson('Integrated Science', 'Mr. Boateng', 'Lab 1'),
    lesson('ICT', 'Mr. Quansah', 'ICT Lab'),
    lesson('Career Technology', 'Mr. Mensah', 'Workshop'),
    lesson('Social Studies', 'Mrs. Asante', 'Room 4'),
    lesson('R.M.E.', 'Mrs. Adjei', 'Room 4'),
  ],
  tue: [
    lesson('Mathematics', 'Mr. Owusu', 'Room 4'),
    lesson('French', 'Mlle. Ama', 'Room 4'),
    lesson('Career Technology', 'Mr. Mensah', 'Workshop'),
    lesson('English Language', 'Mrs. Adjei', 'Room 4'),
    lesson('Integrated Science', 'Mr. Boateng', 'Lab 1'),
    lesson('Social Studies', 'Mrs. Asante', 'Room 4'),
    lesson('ICT', 'Mr. Quansah', 'ICT Lab'),
  ],
  wed: [
    lesson('Mathematics', 'Mr. Owusu', 'Room 4'),
    lesson('Integrated Science', 'Mr. Boateng', 'Lab 1'),
    lesson('English Language', 'Mrs. Adjei', 'Room 4'),
    lesson('French', 'Mlle. Ama', 'Room 4'),
    lesson('R.M.E.', 'Mrs. Adjei', 'Room 4'),
    lesson('Career Technology', 'Mr. Mensah', 'Workshop'),
    lesson('Social Studies', 'Mrs. Asante', 'Room 4'),
  ],
  thu: [
    lesson('English Language', 'Mrs. Adjei', 'Room 4'),
    lesson('Mathematics', 'Mr. Owusu', 'Room 4'),
    lesson('Career Technology', 'Mr. Mensah', 'Workshop'),
    lesson('ICT', 'Mr. Quansah', 'ICT Lab'),
    lesson('Integrated Science', 'Mr. Boateng', 'Lab 1'),
    lesson('Social Studies', 'Mrs. Asante', 'Room 4'),
    lesson('French', 'Mlle. Ama', 'Room 4'),
  ],
  fri: [
    lesson('Mathematics', 'Mr. Owusu', 'Room 4'),
    lesson('English Language', 'Mrs. Adjei', 'Room 4'),
    lesson('Social Studies', 'Mrs. Asante', 'Room 4'),
    lesson('Integrated Science', 'Mr. Boateng', 'Lab 1'),
    lesson('R.M.E.', 'Mrs. Adjei', 'Room 4'),
    lesson('Career Technology', 'Mr. Mensah', 'Workshop'),
  ],
};

/** The weekday the mock is drawn in — Wednesday, matching the attendance anchor. */
export const timetableToday = 'wed';

/**
 * Assignments, soonest due first.
 *
 * `status` is the *school's* view of the child's submission — a parent should
 * never be able to mark homework done on the child's behalf, so the row is
 * read-only with a "Mark as seen" affordance instead.
 */
export const assignments = [
  {
    id: 'asg-1',
    subject: 'Mathematics',
    title: 'Exercise 4b — Algebraic fractions',
    teacher: 'Mr. Owusu',
    dueDate: '2026-10-08',
    dueLabel: 'Tomorrow',
    dueTone: 'amber',
    status: 'pending',
    attachments: [{ name: 'algebraic-fractions.pdf', size: '240 KB' }],
  },
  {
    id: 'asg-2',
    subject: 'Integrated Science',
    title: 'Draw and label the human digestive system',
    teacher: 'Mr. Boateng',
    dueDate: '2026-10-09',
    dueLabel: 'Fri 09 Oct',
    dueTone: 'slate',
    status: 'pending',
    attachments: [],
  },
  {
    id: 'asg-3',
    subject: 'English Language',
    title: 'Letter writing — informal letter to a friend',
    teacher: 'Mrs. Adjei',
    dueDate: '2026-10-12',
    dueLabel: 'Mon 12 Oct',
    dueTone: 'slate',
    status: 'pending',
    attachments: [{ name: 'letter-rubric.pdf', size: '180 KB' }],
  },
  {
    id: 'asg-4',
    subject: 'ICT',
    title: 'Spreadsheet formulas worksheet',
    teacher: 'Mr. Quansah',
    dueDate: '2026-10-02',
    dueLabel: 'Submitted',
    dueTone: 'green',
    status: 'submitted',
    attachments: [],
  },
];

/**
 * Dated events the school has published, rendered as the strip under the
 * timetable. The PTA assembly is the one the Home page's banner also shows —
 * one source for both surfaces.
 */
export const schoolEvents = [
  {
    id: 'evt-1',
    title: 'PTA General Assembly',
    when: 'Saturday, 9:00 AM at the School Assembly Hall',
    date: '2026-10-10',
    tone: 'amber',
  },
  {
    id: 'evt-2',
    title: 'Term 2 Mid-term Assessment',
    when: 'Monday 19 Oct – Friday 23 Oct',
    date: '2026-10-19',
    tone: 'slate',
  },
];
