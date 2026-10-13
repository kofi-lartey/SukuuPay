/**
 * Pure normalizer for the `GET /admin/academic/overview` payload.
 *
 * The server returns counts keyed by `Grade.approvalStatus`
 * (`"draft" | "submitted" | "approved" | "rejected"`) and by
 * `ReportCard.status` (`"draft" | "review" | "published" | "archived"`), but
 * the headmaster's overview only needs to answer three questions:
 *
 *  - how many grade blocks still need my stamp this term,
 *  - how many report cards are ready for me to release, and
 *  - how the school is standing overall (totals, class averages, top pupils).
 *
 * This maps the raw envelope onto those three, and it does so defensively: a
 * half-populated or future-shaped payload still yields a usable, zero-defaulted
 * summary rather than throwing — the dashboard must not blank out because one
 * sub-count was absent.
 */

const EMPTY_GRADES = { draft: 0, submitted: 0, approved: 0, rejected: 0 };
const EMPTY_REPORTS = { draft: 0, review: 0, published: 0, archived: 0 };

const asCount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const countOf = (entry) =>
  entry && typeof entry === 'object' ? asCount(entry.count) : asCount(entry);

export const academicSummary = (raw = {}) => {
  const totals = {
    students: asCount(raw?.totals?.students),
    classes: asCount(raw?.totals?.classes),
    attendanceRate: asCount(raw?.totals?.attendanceRate),
  };

  const grades = { ...EMPTY_GRADES, ...(raw?.grades || {}) };
  const reportCards = { ...EMPTY_REPORTS, ...(raw?.reportCards || {}) };

  // Marks a teacher has handed in and the headmaster has not yet stamped.
  // `draft` grades have not crossed the desk yet, so they are not pending here.
  const pendingApprovals = asCount(grades.submitted);

  // `review` cards are compiled and awaiting the headmaster's publish stamp.
  const publishReady = countOf(reportCards.review);

  const classAverages = Array.isArray(raw?.classAverages)
    ? raw.classAverages.map((c) => ({
        className: c?.className ?? '—',
        average: asCount(c?.average),
        count: asCount(c?.count),
      }))
    : [];

  const topStudents = Array.isArray(raw?.topStudents)
    ? raw.topStudents.map((s) => ({
        studentName: s?.studentName ?? '',
        studentId: s?.studentId ?? '',
        className: s?.className ?? '',
        average: asCount(s?.average),
        grade: typeof s?.grade === 'string' ? s.grade : '',
      }))
    : [];

  return {
    term: raw?.term ?? null,
    academicYear: raw?.academicYear ?? null,
    totals,
    gradeApprovalCounts: grades,
    reportCardCounts: reportCards,
    pendingApprovals,
    publishReady,
    classAverages,
    topStudents,
    isEmpty:
      totals.students === 0 &&
      totals.classes === 0 &&
      pendingApprovals === 0 &&
      publishReady === 0,
  };
};

export default academicSummary;

/**
 * Normalise the `GET /admin/grades/approval-queue` envelope to its `queue`
 * array — the headmaster's queue, not the service's wrapper.
 *
 * Extracted so the queue page's row-mapping stays a pure, node:test-able
 * function rather than hook state. The server returns `{ queue, meta? }`; a
 * missing or malformed envelope degrades to an empty queue, never a crash.
 */
export const normalizeGradeQueue = (raw = {}) =>
  Array.isArray(raw?.queue) ? raw.queue : [];
