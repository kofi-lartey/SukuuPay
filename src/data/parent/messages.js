/**
 * Messaging fixtures — the data behind the Messages page.
 *
 * ## Two lists, not one
 *
 * `notices` are the school's broadcasts (read-only, one-to-many, authored in the
 * school dashboard's announcements module — this is a *read* fixture for the
 * parent side). `threads` are the two-way conversations, which extend the
 * existing one-way `notify-school` flow: the school's replies are what makes a
 * thread, and `unread` counts what the parent has not opened.
 *
 * Voice notes reuse the same upload pipeline as the existing support form
 * (`AudioRecorder` → multipart `POST`), so a thread message may carry
 * `voiceNote: { durationSeconds }` exactly as a sent message carries an
 * attachment.
 */

export const notices = [
  {
    id: 'notice-1',
    title: 'PTA General Assembly',
    body:
      'All parents and guardians are invited to the PTA General Assembly on Saturday, 9:00 AM at the School Assembly Hall. Fee payment arrangements for Term 2 will be discussed.',
    postedAt: '2 days ago',
    postedBy: 'School Administration',
    pinned: true,
    tone: 'amber',
  },
  {
    id: 'notice-2',
    title: 'Term 2 report cards are out',
    body:
      'Term 2 formal assessment results have been signed by the Headteacher and are now available under Records.',
    postedAt: '2 days ago',
    postedBy: 'Academic Board',
    pinned: false,
    tone: 'green',
  },
];

export const threads = [
  {
    id: 'thread-1',
    with: { name: 'Mrs. Adjei', role: 'JHS 2A Class Teacher' },
    subject: 'Mathematics participation',
    unread: 2,
    lastAt: '2 hours ago',
    messages: [
      {
        id: 'm-1',
        from: 'school',
        body:
          'Good afternoon Madam. I wanted to share that Kwame has shown strong improvement in Mathematics this term.',
        at: 'Yesterday, 3:12 pm',
      },
      {
        id: 'm-2',
        from: 'school',
        body:
          'He should work on participating more in class discussions — he often knows the answer but waits to be called.',
        at: '2 hours ago',
      },
    ],
  },
  {
    id: 'thread-2',
    with: { name: 'School Bursar', role: 'Fees Office' },
    subject: 'Term 2 fee balance',
    unread: 1,
    lastAt: '5 days ago',
    messages: [
      {
        id: 'm-3',
        from: 'parent',
        body:
          'I paid GHS 300.00 at the office last Friday. Please confirm it has been posted to Kwame\u2019s account.',
        at: '6 days ago',
      },
      {
        id: 'm-4',
        from: 'school',
        body:
          'Confirmed, Madam. The GHS 300.00 MoMo payment (Ref #SKP-2024-9104) has been posted. The remaining GHS 550.00 is due in 5 days.',
        at: '5 days ago',
      },
    ],
  },
  {
    id: 'thread-3',
    with: { name: 'Mrs. Evelyn Owusu', role: 'Attendance Officer' },
    subject: 'Absence on 03 October',
    unread: 0,
    lastAt: '4 days ago',
    messages: [
      {
        id: 'm-5',
        from: 'school',
        body:
          'This is to notify you that Kwame was marked absent today. If this is in error, please reply here or call the school office.',
        at: '4 days ago',
      },
      {
        id: 'm-6',
        from: 'parent',
        body: 'He was sick with malaria, Madam. Thank you for the message.',
        at: '4 days ago',
      },
    ],
  },
];
