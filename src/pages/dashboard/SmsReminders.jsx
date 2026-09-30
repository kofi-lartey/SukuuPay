import React from 'react';
import { CalendarClock, MessageSquare, MessageSquareText, Send, Users } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The SMS Reminders module.
 *
 * The constraint here is real and belongs in the layout, not in a support
 * article: there is no school-facing SMS send route on the API. The only SMS
 * endpoints are the provider's delivery webhooks and the platform balance
 * admin, and automated nudging runs server-side from a cron. So this module
 * cannot ship a "Send SMS" button that reports success for zero delivered
 * messages — which is exactly what `services/sms.js` throws to prevent.
 *
 * That is why the module is scoped as reminders-with-a-schedule: compose,
 * target, schedule, and read delivery. The send itself is a backend capability
 * this screen drives, not one it performs.
 */
const SmsReminders = () => (
  <ModuleScaffold
    title="SMS Reminders"
    description="Tell a parent what is owed, when it is due, and how to pay it."
    action={
      <>
        <Send className="h-4 w-4" />
        Send reminders
      </>
    }
    sections={[
      {
        title: 'Reminder templates',
        description:
          'The standing messages a school sends: due soon, overdue, plan accepted, payment received.',
        endpoint: 'Scheduled server-side',
        icon: MessageSquareText,
      },
      {
        title: 'Target selection',
        description: 'Everyone behind, one class, or one named student — the same audience the reports use.',
        endpoint: 'GET /reports/overdue/:schoolId',
        icon: Users,
      },
      {
        title: 'Schedule',
        description:
          'Automatic nudges before and after a due date, so the bursar is not writing them by hand.',
        endpoint: 'installmentReminder cron',
        icon: CalendarClock,
      },
      {
        title: 'Delivery log',
        description: 'What was sent, to which parent, and whether the gateway accepted it.',
        endpoint: 'GET /webhooks/sms',
        icon: MessageSquare,
      },
    ]}
    notes={[
      'No school-facing SMS send endpoint exists today. The button above is disabled on purpose — a live-looking control here would report success for messages that were never sent.',
      'WhatsApp is the sendable channel that does exist today (POST /whatsapp/send-bulk/:schoolId, with a template catalogue). If reminders need to be manual and immediate, that is the path available now.',
      'Message bodies must respect SMS_SEGMENT_LENGTH. Longer copy splits into multiple billed segments, which matters for cost estimates shown to the school.',
    ]}
  />
);

export default SmsReminders;
