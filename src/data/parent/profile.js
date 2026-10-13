/**
 * Profile & settings fixtures — the data behind the More tab (Profile page).
 *
 * ## Parents, not accounts
 *
 * The portal is token-based, so "the parent" is a phone number with a name, not
 * a login. `wards` is what makes the Profile page worth having: the same parent
 * number can hold pay links for several children, and switching wards is the
 * single most common reason a parent opens this page. When the portal gains
 * phone+OTP sessions, this fixture is exactly the shape `GET /pay/:token/profile`
 * will return — the token stays in the path either way.
 */

export const profile = {
  parent: {
    name: 'Mrs. Akosua Mensah',
    phone: '024 412 8890',
    initials: 'AM',
  },
  wards: [
    {
      studentId: 'STU-8F3K9D2L',
      name: 'Kwame Mensah',
      className: 'JHS 2A',
      school: 'Achimota Basic School',
      balanceLabel: 'GHS 550.00 due',
      feeStatus: 'due',
      current: true,
    },
    {
      studentId: 'STU-2K8M1Q7P',
      name: 'Ama Mensah',
      className: 'Primary 4',
      school: 'Achimota Basic School',
      balanceLabel: 'All paid up',
      feeStatus: 'settled',
      current: false,
    },
  ],
  school: {
    name: 'Achimota Basic School',
    phone: '0302 402 1234',
    address: 'Achimota, Accra',
  },
  /**
   * Preference defaults chosen so the first run is already useful: a parent
   * hears about absences and dues without touching anything, and can quiet
   * announcements later. Toggles write through the service layer, which today
   * mutates this copy and tomorrow POSTs.
   */
  preferences: [
    {
      id: 'attendance-alerts',
      label: 'Attendance alerts',
      detail: 'SMS when Kwame is marked absent or late',
      enabled: true,
      channel: 'sms',
    },
    {
      id: 'fee-reminders',
      label: 'Fee reminders',
      detail: 'SMS when fees are due or overdue',
      enabled: true,
      channel: 'sms',
    },
    {
      id: 'announcements',
      label: 'School announcements',
      detail: 'Notices from the school office',
      enabled: true,
      channel: 'in-app',
    },
    {
      id: 'report-cards',
      label: 'Report card alerts',
      detail: 'When a term result is signed and published',
      enabled: false,
      channel: 'in-app',
    },
  ],
  /** Saved MoMo numbers, so the pay sheet can prefill the right one. */
  paymentMethods: [
    { id: 'pm-1', network: 'MTN', number: '024 412 8890', isDefault: true },
    { id: 'pm-2', network: 'Telecel', number: '020 911 5540', isDefault: false },
  ],
};

/**
 * Term 2's bill, itemised.
 *
 * The portal's real API today exposes one number (`totalOwed`); the itemised
 * lines are what the approved mock's fee page shows, and the shape here is the
 * contract for the `billItems` field the endpoint will grow. `amount` is in
 * pesewas, like every other money figure in the app.
 */
export const bill = {
  termLabel: 'Term 2',
  academicYear: '2026/2027',
  dueInDays: 5,
  dueLabel: 'Due in 5 days',
  items: [
    { id: 'bill-1', label: 'Tuition fee', amount: 45000, note: 'Term 2 · 3 installments available' },
    { id: 'bill-2', label: 'PTA levy', amount: 20000, note: 'One-off per term' },
    { id: 'bill-3', label: 'Examination levy', amount: 12000, note: 'Covers Term 2 assessments' },
    { id: 'bill-4', label: 'ICT practical fee', amount: 8000, note: 'Laboratory access' },
  ],
  paidItems: [
    { id: 'paid-1', label: 'MTN MoMo payment', amount: 30000, note: 'Ref #SKP-2024-9104 · 5 days ago' },
  ],
};
