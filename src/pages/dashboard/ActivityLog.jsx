import React from 'react';
import { Download, Filter, ScrollText, User } from 'lucide-react';
import ModuleScaffold from '../../components/dashboard/ModuleScaffold';

/**
 * The Activity Log module.
 *
 * The one module nobody asks for until something has gone wrong, and the one
 * where the layout is the whole feature: an audit trail is only useful if it is
 * filterable to the exact question. "Who changed this student's record, and
 * when?" is answered by actor, entity and date range — so those are the three
 * controls the page leads with, above the list.
 *
 * Read-only by construction. There is no create, update or delete in this
 * module's surface, and none should ever be added: a log that its own product
 * can edit is not evidence of anything.
 */
const ActivityLog = () => (
  <ModuleScaffold
    title="Activity Log"
    description="Who changed what, in your school, and when they did it."
    action={
      <>
        <Filter className="h-4 w-4" />
        Filter
      </>
    }
    sections={[
      {
        title: 'School activity',
        description: 'Every change across the school, newest first, with filters on actor and date.',
        endpoint: 'GET /audit-logs/:schoolId',
        icon: ScrollText,
      },
      {
        title: 'One user’s activity',
        description: 'Everything a single member of staff has done.',
        endpoint: 'GET /audit-logs/user/:userId',
        icon: User,
      },
      {
        title: 'Export',
        description: 'The filtered list as CSV, for an external review.',
        endpoint: 'GET /audit-logs/:schoolId/export',
        icon: Download,
      },
    ]}
    notes={[
      'Read-only by design. This module gets no create, update or delete; a log the product can edit is not evidence of anything.',
      'The export must honour the filters on screen. An export that silently returns the unfiltered log is worse than no export, because it looks like a complete answer.',
      'Entries reference a user and an entity, so the log is the natural place to link back to the student or payment it concerns — as a route into that record, not a copy of its details.',
    ]}
  />
);

export default ActivityLog;
