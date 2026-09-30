import React from 'react';
import { BarChart3, Download, PieChart, Printer, TrendingUp } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The Reports module.
 *
 * The widest module and the most likely to be misused, so its layout is the
 * part that matters most: a report is a question with a date range and a
 * comparison, and every endpoint below is one of those questions. Each gets its
 * own card with a stated period, never a merged "reports" dashboard — a single
 * number mixing this term with last is worse than no number.
 *
 * All nine endpoints are already server-side. This is the module closest to
 * shipping as-is once a chart component is chosen.
 */
const Reports = () => (
  <ModuleScaffold
    title="Reports"
    description="Where the money came from, who has not paid, and how the term is tracking."
    action={
      <>
        <Download className="h-4 w-4" />
        Export
      </>
    }
    sections={[
      {
        title: 'Daily collections',
        description: 'What came in today, by method.',
        endpoint: 'GET /reports/daily/:schoolId',
        icon: TrendingUp,
      },
      {
        title: 'Term summary',
        description: 'Expected against collected for a whole term.',
        endpoint: 'GET /reports/term/:schoolId',
        icon: BarChart3,
      },
      {
        title: 'Outstanding balances',
        description: 'Who still owes, and by how much. The report that drives reminders.',
        endpoint: 'GET /reports/outstanding/:schoolId',
        icon: PieChart,
      },
      {
        title: 'Overdue only',
        description: 'The same list filtered to past the due date.',
        endpoint: 'GET /reports/overdue/:schoolId',
        icon: TrendingUp,
      },
      {
        title: 'Payment methods',
        description: 'The split across MTN, Telecel and AirtelTigo.',
        endpoint: 'GET /reports/payment-methods/:schoolId',
        icon: PieChart,
      },
      {
        title: 'Class collections',
        description: 'Collection rate per class, for a headteacher’s review.',
        endpoint: 'GET /reports/class-collections/:schoolId',
        icon: BarChart3,
      },
      {
        title: 'Installment compliance',
        description: 'How many families are current against the agreed schedule.',
        endpoint: 'GET /reports/compliance/:schoolId',
        icon: TrendingUp,
      },
      {
        title: 'Headteacher monthly',
        description: 'The month-end summary a school signs off internally.',
        endpoint: 'GET /reports/headmaster-monthly/:schoolId',
        icon: Printer,
      },
      {
        title: 'Parent contacts',
        description: 'Exportable contact list, for the school’s own records.',
        endpoint: 'GET /reports/parent-contacts/:schoolId',
        icon: Download,
      },
    ]}
    notes={[
      'Every report takes an academic year and term, which live in Settings. Reports are therefore scoped by the school’s current setting unless the caller overrides it.',
      'Amounts are pesewas integers on the wire. Formatting to cedis belongs in one shared helper, or the same figure will read GH₵ 0.01 and GH₵ 100 in two reports.',
    ]}
  />
);

export default Reports;
