/**
 * The parent portal's academic surfaces, mocked.
 *
 * The school-facing mock fakes endpoints that **exist**. The portal's
 * attendance, records, timetable, notifications, messages, payments and plan
 * surfaces either have no endpoint yet or exist only in part — the fee reads
 * (`GET /pay/:token`, `/history`, `/receipt/:paymentId`) are real and are
 * handled in `handlers.js` itself. This module stands in for the rest, so the
 * portal's pages, skeletons and empty states are exercisable in mock mode
 * against the shapes `services/parent/*` will receive when the backend grows
 * them.
 *
 * ## Two sources, one fiction
 *
 * The student and school resolve from the mock database by pay token, exactly
 * as the real portal read does — the same figures, the same 404 for a dead
 * link. The academic payloads come from `data/parent`, the approved design
 * mock's fixtures, because no roll-call service has produced them for the
 * fixture student. That is the same fiction `services/parentPortal.js` made
 * before this module existed, and it disappears the day the endpoints land.
 *
 * ## Envelope
 *
 * Handlers return plain objects; the adapter in `adapter.js` wraps them in the
 * `{ success, data }` envelope every parent endpoint answers with, and
 * `__file` marks a download.
 */

import { getDb } from './db';
import {
  attendanceLog,
  attendanceMonths,
  attendanceSummary,
  attendanceToday,
  DEMO_TODAY,
  reportCards,
  bill,
  notifications as notificationFixture,
  threads as threadFixture,
  timetable as timetableFixture,
  PERIODS,
} from '../data/parent';

/**
 * A route-local error.
 *
 * `MockError` lives in `handlers.js`, which imports this module to register
 * these routes — importing it back would close a cycle. The adapter only ever
 * reads `status`, `message` and `code` off a rejected handler, so this carries
 * exactly those three.
 */
class PortalError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const payTokenOf = (student) => String(student.payLink || '').split('/').pop();

/** The student a pay token resolves to, or null — the real route's behaviour. */
const studentForToken = (token) => {
  const db = getDb();
  return db.students.find((s) => payTokenOf(s) === token) || null;
};

const requireStudent = (token) => {
  const student = studentForToken(token);
  if (!student) {
    throw new PortalError(404, 'Invalid or expired payment link', 'INVALID_TOKEN');
  }
  return student;
};

const schoolOf = (student) =>
  getDb().schools.find((s) => s._id === student.schoolId) || null;

/** Settled payments for this student, newest first, refunds excluded. */
const settledPayments = (student) =>
  getDb()
    .payments.filter(
      (p) =>
        p.studentId === student._id &&
        p.status === 'completed' &&
        !p.deletedAt &&
        !p.refundOfPaymentId
    )
    .sort((a, b) => String(b.completedAt || b.createdAt).localeCompare(String(a.completedAt || a.createdAt)));

const overdueFor = (student, now = new Date()) =>
  (student.balance || 0) > 0 &&
  student.deadline &&
  new Date(student.deadline) < now;

// ── Reads ───────────────────────────────────────────────────────────────

/**
 * `GET /pay/:token` — the portal's one shared read.
 *
 * Shaped after `getPortalView` in `pay.service.js` — student, school, plan,
 * recent payments — plus `unreadCount`, which the shell's bell and rail read
 * and the fee endpoint does not yet send. `feesBreakdown` carries the
 * itemised bill's contract (`data/parent/profile.js`), which the fees page
 * renders when present and hides when not.
 */
const portalView = ({ params }) => {
  const student = requireStudent(params.token);
  const school = schoolOf(student);

  return {
    student: {
      studentId: student.studentId,
      studentName: student.studentName,
      studentClass: student.studentClass,
      academicYear: student.academicYear,
      totalOwed: student.totalOwed || 0,
      totalPaid: student.totalPaid || 0,
      balance: Math.max(student.balance || 0, 0),
      deadline: student.deadline || null,
      isOverdue: overdueFor(student),
      feesBreakdown: bill.items.map(({ label, amount }) => ({ label, amount })),
    },
    school: school
      ? {
          name: school.name,
          phone: school.phone || null,
          email: school.email || null,
          address: school.address || null,
          city: school.city || null,
        }
      : null,
    unreadCount: notificationFixture.filter((n) => n.unread).length,
    paymentPlan: null,
    recentPayments: settledPayments(student)
      .slice(0, 3)
      .map((p) => ({
        paymentId: p.paymentId,
        amount: p.amount,
        receiptNumber: p.receiptNumber || null,
        completedAt: p.completedAt || p.createdAt,
        createdAt: p.createdAt,
      })),
  };
};

/** ISO date → the day-of-month the calendar cell prints. */
const dayOf = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getUTCDate();

/**
 * `GET /pay/:token/attendance` — summary, months, log.
 *
 * The fixtures store a month as an ISO-date → status map; the calendar renders
 * an array of cells, so the map is expanded here rather than in the page —
 * which is where it was expanded before, twice.
 */
const attendance = ({ params }) => {
  requireStudent(params.token);

  const months = attendanceMonths.map((month) => {
    const days = Object.entries(month.days).map(([date, status]) => ({
      date,
      day: dayOf(date),
      status,
      isToday: date === attendanceToday,
    }));
    const count = (status) => days.filter((d) => d.status === status).length;
    return {
      label: month.monthLabel,
      present: count('present'),
      late: count('late'),
      absent: count('absent'),
      days,
    };
  });

  const recorded = attendanceSummary.present + attendanceSummary.late + attendanceSummary.absent;

  return {
    summary: {
      present: attendanceSummary.present,
      late: attendanceSummary.late,
      absent: attendanceSummary.absent,
      rate: recorded ? Math.round((attendanceSummary.present / recorded) * 1000) / 10 : 0,
      termLabel: attendanceSummary.termLabel,
    },
    months,
    recent: attendanceLog.slice(0, 8).map((entry) => ({
      date: entry.date,
      status: entry.status,
      note: entry.note || entry.detail || '',
    })),
  };
};

/** The term pills' labels to the fixture's term ids. */
const TERM_IDS = { 'Term 1': 't1', 'Term 2': 't2', 'Term 3': 't3' };

/**
 * `GET /pay/:token/records` — one term's report card.
 *
 * A term with no published card resolves to a null summary rather than a 404:
 * Term 3's empty state is a real state, not an error.
 */
const records = ({ params, query }) => {
  requireStudent(params.token);
  const card = reportCards[TERM_IDS[query?.term] || 't2'];
  if (!card) return { summary: null };

  return {
    summary: {
      average: card.overallAverage,
      position: card.classPosition,
      classSize: card.classSize,
      grade: card.aggregate,
    },
    subjects: card.subjects.map((subject) => ({
      subject: subject.name,
      score: subject.score,
      grade: subject.grade,
    })),
    teacherRemark: { text: card.classRemark.body, author: card.classRemark.author },
    headRemark: { text: card.headRemark.body, author: card.headRemark.author },
    conduct: card.conduct.rating,
    attendance: {
      present: card.attendance?.daysPresent || 0,
      total: card.attendance?.daysRecorded || 0,
    },
  };
};

/**
 * `GET /pay/:token/records.pdf` — the report card as a download.
 *
 * Not a real PDF, and the comment in `handlers.js` says why that is the
 * house style for mock downloads: it only has to be bytes the browser saves.
 */
const recordsPdf = ({ params, query }) => {
  const student = requireStudent(params.token);
  const term = String(query?.term || 'Term 2').replace(/\s/g, '');
  return {
    __file: {
      filename: `report-${student.studentId}-${term}.pdf`,
      mimeType: 'application/pdf',
      body: `%PDF-1.4 mock report card for ${student.studentName}, ${query?.term || 'Term 2'}`,
    },
  };
};

/** `7:35 – 8:15 am` → `{ startTime: '7:35', endTime: '8:15 am' }`. */
const splitPeriodTime = (time) => {
  const [start, end] = String(time).split('–').map((part) => part.trim());
  return { startTime: start, endTime: end };
};

/** Fixture weekday keys to the page's day names, in week order. */
const WEEK_DAYS = [
  ['Monday', 'mon'],
  ['Tuesday', 'tue'],
  ['Wednesday', 'wed'],
  ['Thursday', 'thu'],
  ['Friday', 'fri'],
];

/**
 * `GET /pay/:token/timetable` — the week grid.
 *
 * Keyed by full day name because that is what the page's day tabs select; the
 * fixture's short keys are an implementation detail of the mock.
 */
const timetable = ({ params }) => {
  requireStudent(params.token);

  const days = {};
  WEEK_DAYS.forEach(([label, key]) => {
    days[label] = (timetableFixture[key] || []).map((lesson, index) => {
      const period = PERIODS[index + 1] || {};
      return {
        ...splitPeriodTime(period.time || ''),
        subject: lesson.subject,
        teacher: lesson.teacher,
        room: lesson.room,
        ongoing: false,
      };
    });
  });

  return { days };
};

// ── Notifications ────────────────────────────────────────────────────────

/**
 * Fixture notification types to the route vocabulary the page's
 * `routeForNotification` reads: `payment`, `attendance`, `record`, `message`.
 */
const NOTIFICATION_TYPES = {
  fee: 'payment',
  academics: 'record',
  notice: 'message',
};

/**
 * How long ago a fixture row is, as an ISO timestamp.
 *
 * The fixtures are anchored to `DEMO_TODAY` so their relative labels stay
 * true; `createdAt` is derived from the same anchor rather than from the
 * reader's clock, or a row labelled "2 days ago" would date itself to today.
 */
const fixtureTimestamp = (label, anchor) => {
  const days = /(\d+)\s*days?\s*ago/.exec(label);
  if (days) return new Date(anchor.getTime() - Number(days[1]) * 86400000).toISOString();
  const hours = /(\d+)\s*hours?\s*ago/.exec(label);
  if (hours) return new Date(anchor.getTime() - Number(hours[1]) * 3600000).toISOString();
  return anchor.toISOString();
};

/** Read state lives in memory: a badge that clears and stays cleared. */
const readNotificationIds = new Set();

const notificationRows = () =>
  notificationFixture.map((row) => ({
    _id: row.id,
    type: NOTIFICATION_TYPES[row.type] || row.type,
    title: row.title,
    message: row.body,
    relativeTime: row.at,
    createdAt: fixtureTimestamp(row.at, DEMO_TODAY),
    readAt: row.unread ? null : fixtureTimestamp(row.at, DEMO_TODAY),
  }));

const notifications = ({ params, query }) => {
  requireStudent(params.token);

  const all = notificationRows().map((row) =>
    readNotificationIds.has(row._id) ? { ...row, readAt: row.readAt || DEMO_TODAY.toISOString() } : row
  );

  const filter = query?.filter && query.filter !== 'all' ? query.filter : null;
  const filtered = filter ? all.filter((row) => row.type.includes(filter)) : all;

  return {
    notifications: filtered,
    meta: { total: filtered.length, unreadCount: all.filter((row) => !row.readAt).length },
  };
};

const markNotificationRead = ({ params }) => {
  requireStudent(params.token);
  readNotificationIds.add(params.id);
  return { id: params.id, read: true };
};

const markAllNotificationsRead = ({ params }) => {
  requireStudent(params.token);
  notificationFixture.forEach((row) => readNotificationIds.add(row.id));
  return { updated: notificationFixture.length };
};

// ── Messages ─────────────────────────────────────────────────────────────

/** Fixture senders to the bubble's author vocabulary. */
const toAuthor = (from) => (from === 'parent' ? 'parent' : 'school');

const conversationSummaries = () =>
  threadFixture.map((thread) => {
    const last = thread.messages[thread.messages.length - 1];
    const initials = thread.with.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
    return {
      threadId: thread.id,
      subject: thread.subject,
      recipient: `${thread.with.name} · ${thread.with.role}`,
      initials,
      lastMessage: last ? last.body : '',
      relativeTime: thread.lastAt,
      unreadCount: thread.unread,
    };
  });

const conversationDetail = (threadId) => {
  const thread = threadFixture.find((t) => t.id === threadId);
  if (!thread) throw new PortalError(404, 'Conversation not found', 'NOT_FOUND');

  return {
    conversation: {
      threadId: thread.id,
      subject: thread.subject,
      recipient: `${thread.with.name} · ${thread.with.role}`,
    },
    messages: thread.messages.map((message) => ({
      _id: message.id,
      body: message.body,
      author: toAuthor(message.from),
      relativeTime: message.at,
      timestamp: message.at,
    })),
  };
};

const conversations = ({ params }) => {
  requireStudent(params.token);
  return { conversations: conversationSummaries() };
};

const conversation = ({ params }) => {
  requireStudent(params.token);
  return conversationDetail(params.threadId);
};

/**
 * `POST /pay/:token/messages` — sends into a thread, or opens a new one.
 *
 * The reply is echoed the way the server will: with an id and a timestamp the
 * page can render without inventing either. Appending to the fixture keeps
 * the thread readable after the round trip, which is the only way the send
 * button looks like it worked.
 */
const sendMessage = ({ params, body }) => {
  const student = requireStudent(params.token);

  const thread = body?.threadId
    ? threadFixture.find((t) => t.id === body.threadId)
    : null;

  if (thread) {
    const message = {
      id: `m-local-${Date.now()}`,
      from: 'parent',
      body: body.body,
      at: 'Just now',
    };
    thread.messages.push(message);
    thread.unread = 0;
    thread.lastAt = 'Just now';
    return { id: message.id, threadId: thread.id, at: message.at };
  }

  const created = {
    id: `thread-local-${Date.now()}`,
    with: { name: 'School Office', role: student.schoolId || 'School' },
    subject: body?.subject || 'New conversation',
    unread: 0,
    lastAt: 'Just now',
    messages: [{ id: `m-local-${Date.now()}`, from: 'parent', body: body?.body || '', at: 'Just now' }],
  };
  threadFixture.push(created);
  return { id: created.id, threadId: created.id, at: 'Just now' };
};

const markConversationRead = ({ params }) => {
  requireStudent(params.token);
  const thread = threadFixture.find((t) => t.id === params.threadId);
  if (thread) thread.unread = 0;
  return { threadId: params.threadId, read: true };
};

// ── Payments and plans ───────────────────────────────────────────────────

/**
 * `GET /pay/:token/payments` — the settled ledger, plus the three figures the
 * page's summary band reads. `thisTerm` is this calendar year's share; the
 * term boundary is the school's, not the browser's, and the mock has no
 * academic calendar to consult.
 *
 * `filter` narrows the list to the same window the real route narrows it to:
 * `all` (everything), `year` (this calendar year) and `term` (the same year,
 * because the mock has no term dates to work from). The summary figures are
 * always the lifetime totals, so the band does not change under the parent's
 * finger.
 */
const paymentHistory = ({ params, query }) => {
  const student = requireStudent(params.token);
  const rows = settledPayments(student).map((p) => ({
    paymentId: p.paymentId,
    amount: p.amount,
    receiptNumber: p.receiptNumber || null,
    paymentMethod: p.paymentMethod,
    completedAt: p.completedAt || p.createdAt,
    createdAt: p.createdAt,
  }));

  const year = new Date().getUTCFullYear();
  const thisYear = rows.filter(
    (p) => new Date(p.completedAt).getUTCFullYear() === year
  );

  const filter = String(query?.filter || 'all');
  const scoped = filter === 'all' ? rows : thisYear;

  const totalPaid = rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const thisTerm = thisYear.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return {
    payments: scoped,
    stats: { totalPaid, thisTerm, balance: Math.max(student.balance || 0, 0) },
  };
};

/**
 * `GET /pay/:token/receipt/:paymentId` — the receipt as a PDF.
 *
 * The real route streams a PDF (`getParentReceiptPdfController`), so this
 * returns one rather than the receipt JSON the admin route serves — the two
 * are different endpoints answering in different media, and the parent's
 * download button is the proof.
 */
const receiptPdf = ({ params }) => {
  const student = requireStudent(params.token);
  const payment = settledPayments(student).find((p) => p.paymentId === params.paymentId);
  if (!payment) {
    throw new PortalError(404, 'Receipt not found', 'RECEIPT_NOT_FOUND');
  }
  return {
    __file: {
      filename: `${payment.receiptNumber || payment.paymentId}.pdf`,
      mimeType: 'application/pdf',
      body: `%PDF-1.4 mock receipt ${payment.receiptNumber || payment.paymentId} for ${student.studentName}`,
    },
  };
};

/** No fixture parent holds a live plan, so the list page shows its empty state. */
const paymentPlan = ({ params }) => {
  requireStudent(params.token);
  return { plan: null };
};

const requestPlan = ({ params }) => {
  const student = requireStudent(params.token);
  if (!student.balance || student.balance <= 0) {
    throw new PortalError(400, 'There is no balance to split', 'NOTHING_TO_PLAN');
  }
  return { request: { status: 'pending_review', message: 'The school will review your request.' } };
};

const cancelPlan = ({ params }) => {
  requireStudent(params.token);
  return { plan: null, message: 'Cancellation request sent to the school.' };
};

/**
 * `POST /pay/:token/support` — the parent's letter to the school office.
 *
 * It lands in the same inbox as the pay page's "contact the school" form,
 * because it *is* that form, asked for in a place with room to type. The mock
 * answers with the shape the real route does, so the page's success path is
 * exercisable here too.
 */
const support = ({ params, body }) => {
  const student = requireStudent(params.token);
  const text = String(body?.body || '').trim();

  if (text.length < 10) {
    throw new PortalError(
      400,
      'Please write at least a short message so the school can help',
      'MESSAGE_TOO_SHORT'
    );
  }

  return {
    messageId: `msg-local-${Date.now()}`,
    delivered: true,
    adminsNotified: 1,
    category: body?.category || 'other',
    subject: body?.subject || 'Support request',
    studentName: student.studentName,
  };
};

export const parentPortalHandlers = {
  portalView,
  attendance,
  records,
  recordsPdf,
  timetable,
  notifications,
  markNotificationRead,
  markAllNotificationsRead,
  conversations,
  conversation,
  sendMessage,
  markConversationRead,
  paymentHistory,
  receiptPdf,
  paymentPlan,
  requestPlan,
  cancelPlan,
  support,
};

export default parentPortalHandlers;
