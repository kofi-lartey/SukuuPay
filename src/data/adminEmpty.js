/**
 * The shape `GET /admin/dashboard` returns when nothing is known yet.
 *
 * Mirrors `data/dashboardEmpty.js`, which exists because the school Overview used
 * to merge six responses into one object and had to decide what a *failed* one
 * looked like — and answered "zero", which put a school named "Prampram Basic
 * School" with invented revenue on a live bursar's screen. Naming the empty shape
 * forces the difference to be written down: loading is not the same as empty, and
 * neither is the same as failed.
 *
 * Every consumer treats this as "not loaded yet", never as a real reading. A tile
 * given this renders a skeleton, not a zero — a platform with no schools is a
 * different statement from a platform whose figures have not arrived.
 */
export const EMPTY_ADMIN_KPIS = {
  schools: {
    total: 0,
    active: 0,
    suspended: 0,
    archived: 0,
    onTrial: 0,
    paid: 0,
  },
  users: {
    total: 0,
    students: 0,
    staff: 0,
  },
  payments: {
    totalCompleted: 0,
    totalRevenue: 0,
    mtdRevenue: 0,
    mtdCount: 0,
    ytdRevenue: 0,
    ytdCount: 0,
    platformMarkup: 0,
    pendingPayouts: 0,
  },
  sms: {
    totalBalance: 0,
  },
  recentSchools: [],
};

/** The shape `GET /admin/revenue` returns before a period has been resolved. */
export const EMPTY_ADMIN_REVENUE = {
  summary: {
    totalRevenue: 0,
    totalPayments: 0,
    avgPayment: 0,
    platformMarkupRevenue: 0,
  },
  filters: {
    period: 'all',
    startDate: null,
    endDate: null,
    plan: null,
    region: null,
  },
};

export default EMPTY_ADMIN_KPIS;