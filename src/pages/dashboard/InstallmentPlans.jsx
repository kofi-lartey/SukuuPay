import React from 'react';
import { CalendarClock, CheckCircle2, Plus, TrendingUp } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The Installment Plans module.
 *
 * The most schedule-heavy of the eight, and the one where the layout does real
 * work before any data arrives: a plan is a vertical timeline of dated
 * installments, so the screen it wants is a list per student with each due date,
 * its amount and whether it is paid. A table of plans without that vertical
 * read makes a bursar open each student to answer one question.
 *
 * That is why this module is the natural home for the timeline component, and
 * why it is listed first: the schedule is the product, the plan record is just
 * the container for it.
 */
const InstallmentPlans = () => (
  <ModuleScaffold
    title="Installment Plans"
    description="Split a student’s bill into dated installments and track each one."
    action={
      <>
        <Plus className="h-4 w-4" />
        Create a plan
      </>
    }
    sections={[
      {
        title: 'Plan timeline',
        description:
          'One row per installment: due date, amount, and paid or overdue. The default view.',
        endpoint: 'GET /payment-plans/:studentId',
        icon: CalendarClock,
      },
      {
        title: 'Create a plan',
        description: 'Split an existing balance across dated installments for one student.',
        endpoint: 'POST /payment-plans/create/:studentId',
        icon: Plus,
      },
      {
        title: 'Prepay an installment',
        description: 'Record money paid against a specific future installment.',
        endpoint: 'POST /payment-plans/:planId/prepay',
        icon: CheckCircle2,
      },
      {
        title: 'Mark an installment paid',
        description: 'Settle one installment by hand, for a cash payment at the bursar’s desk.',
        endpoint: 'PUT /payment-plans/:planId/installment/:num',
        icon: CheckCircle2,
      },
      {
        title: 'Plan compliance',
        description: 'How many families are current against the school-wide schedule.',
        endpoint: 'GET /payment-plans/school/:schoolId/compliance',
        icon: TrendingUp,
      },
      {
        title: 'Edit and cancel',
        description: 'Reschedule a plan, or cancel it without deleting the history behind it.',
        endpoint: 'PUT /payment-plans/:planId',
        icon: CalendarClock,
      },
    ]}
    notes={[
      'Cancellation is a soft cancel (DELETE /payment-plans/:planId). The plan stays readable, because a school needs to explain to a parent why a schedule stopped.',
      'A parent accepts and prepays against a plan from their own page using the SMS token. This module is the school’s view of that, not a second place to take the money.',
    ]}
  />
);

export default InstallmentPlans;
