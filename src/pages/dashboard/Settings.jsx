import React from 'react';
import { Bell, Building2, CalendarClock, CreditCard, Receipt, Save } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The Settings module.
 *
 * The only module gated by role in the rail (see `DASHBOARD_NAV`), because it is
 * the only one holding the school's paystack credentials and subscription. A
 * teacher or a viewer is not offered a page of controls that would return 403.
 *
 * Structured as four sections rather than one long form, because the four
 * settings have different lifetimes: a school profile is edited when the
 * school changes its name, an academic year is set once a term, notification
 * preferences whenever someone wants to hear less, and billing is not edited at
 * all. One form makes all four look equally editable, which is how a bursar ends
 * up hunting for the term selector in the middle of a phone number.
 */
const Settings = () => (
  <ModuleScaffold
    title="Settings"
    description="Your school, your academic year, your paystack and your subscription."
    action={
      <>
        <Save className="h-4 w-4" />
        Save changes
      </>
    }
    sections={[
      {
        title: 'School profile',
        description: 'Name, classification, region, logo and contact details.',
        endpoint: 'GET /settings/:schoolId',
        icon: Building2,
      },
      {
        title: 'Academic year and term',
        description:
          'Sets the period every report, plan and deadline is measured against.',
        endpoint: 'PUT /settings/:schoolId/academic-year',
        icon: CalendarClock,
      },
      {
        title: 'Notification preferences',
        description: 'What the school is told about, and how often.',
        endpoint: 'PUT /settings/:schoolId/notifications',
        icon: Bell,
      },
      {
        title: 'Paystack',
        description: 'The MoMo account or merchant credentials payments are collected into.',
        endpoint: 'PUT /settings/:schoolId',
        icon: CreditCard,
      },
      {
        title: 'Subscription and billing',
        description: 'Current plan and what it costs. Read-only; changed through billing.',
        endpoint: 'GET /settings/:schoolId/billing',
        icon: Receipt,
      },
    ]}
    notes={[
      'Credentials must never be echoed back into a form field. Read them masked, and write only when the school actually changes them.',
      'Changing the academic year re-bases every report and due date in the system, so it needs confirming rather than a quiet save.',
      'This is the module that owns the staff list and roles, so invitations and permission changes belong here as their own section.',
    ]}
  />
);

export default Settings;
