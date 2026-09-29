/**
 * Scenarios: named configurations of latency and failure behaviour.
 *
 * Each one exists because it is a state the product will actually meet in
 * production. Together they cover the paths that are hard to reach against a
 * healthy backend — a dead network, a timeout on a 5,000-row upload, a school
 * whose settlement details the server silently refuses to store.
 *
 * `latencyMs` and `flakyRate` are read by the adapter, not by a handler.
 */

export const SCENARIOS = [
  {
    id: 'healthy',
    label: 'Healthy API',
    description: 'Everything the real API supports, working. Payout, Hubtel verification and SMS send all succeed.',
    config: { latencyMs: 120, mockOnlyEnabled: true },
  },
  {
    id: 'payout-unsupported',
    label: 'Payout endpoint missing (real API today)',
    description:
      'PUT /schools/:id/payout 404s. This is the true state of the backend right now, and the path the wizard takes by default in the real app.',
    config: { latencyMs: 120, mockOnlyEnabled: false },
  },
  {
    id: 'hubtel-unsupported',
    label: 'Hubtel verification missing',
    description: 'The verify-hubtel route 405s, so Step 2 must say verification is unavailable rather than show a green Verified badge.',
    config: { latencyMs: 120, mockOnlyEnabled: true },
  },
  {
    id: 'sms-unsupported',
    label: 'Bulk SMS missing',
    description: 'POST /sms/bulk/:schoolId 404s, matching the real API. Step 4 must not claim reminders were sent.',
    config: { latencyMs: 120, mockOnlyEnabled: false },
  },
  {
    id: 'sms-no-recipients',
    label: 'SMS — nobody owes anything',
    description: 'A fully paid school. Sending must fail with a clear "no outstanding balance" rather than send zero messages.',
    config: { latencyMs: 120, mockOnlyEnabled: true, forceNoRecipients: true },
  },
  {
    id: 'slow',
    label: 'Slow network (2.5s)',
    description: 'Latency on every request. Exposes loading states that are missing, double-submits, and un-cancelled requests.',
    config: { latencyMs: 2500, mockOnlyEnabled: true },
  },
  {
    id: 'flaky',
    label: 'Flaky network (30% failures)',
    description: 'Random 500s. Verifies error toasts, that the form is not left locked, and that a retry succeeds.',
    config: { latencyMs: 300, flakyRate: 0.3, mockOnlyEnabled: true },
  },
  {
    id: 'offline',
    label: 'Offline',
    description: 'Every request fails at the network layer, as it would with the dev server stopped.',
    config: { offline: true, mockOnlyEnabled: true },
  },
  {
    id: 'import-reject-all',
    label: 'Import rejected wholesale',
    description: 'POST /students/bulk rejects the file outright. Step 3 must show a file-level error, not a per-row list.',
    config: { latencyMs: 400, importRejectAll: true, mockOnlyEnabled: true },
  },
  {
    id: 'import-all-valid',
    label: 'Import — every row accepted',
    description: 'Bypasses the phone-number and parent checks so a file the client flagged can still be seen to import.',
    config: { latencyMs: 400, importAllValid: true, mockOnlyEnabled: true },
  },
  {
    id: 'slow-import',
    label: 'Import takes 4 seconds',
    description: 'A slow upload on a large roster. The progress bar and the cancel-safe button state both get exercised.',
    config: { latencyMs: 150, slowImport: true, mockOnlyEnabled: true },
  },
  {
    id: 'fail-profile',
    label: 'Step 1 save rejected (422)',
    description: 'The server rejects the profile. The wizard must show the message and must not advance to Step 2.',
    config: { latencyMs: 200, failProfile: true, mockOnlyEnabled: true },
  },
  {
    id: 'fail-school-update',
    label: 'Step 1 save conflicts (409)',
    description: 'Another bursar is editing the same school. Tests the conflict path and whether the form stays editable.',
    config: { latencyMs: 200, failSchoolUpdate: true, mockOnlyEnabled: true },
  },
];

export const getScenario = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
