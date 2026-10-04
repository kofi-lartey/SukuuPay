import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_OVERVIEW } from '../data/dashboardEmpty';
import { getStudentStats, listStudents } from '../services/students';
import { getOutstanding, getPaymentMethods, listRecentPayments } from '../services/dashboard';
import { getSchool } from '../services/school';
import { toTransactionRow } from '../utils/transactionRow';

/**
 * The management system's Overview data seam.
 *
 * **Every region comes from the API, and the ones with no endpoint render empty.**
 *
 * This hook used to seed itself from `data/dashboardDemo.js` and overwrite three
 * regions as answers arrived, which read as a safe fallback and was not one. The
 * school name, the term, the academic year, the weekly collections curve, the
 * payment-channel split, the upcoming tranches and the SMS-broadcast template
 * were never overwritten by any request, so they rendered for every signed-in
 * bursar on a live deployment — the persistent dashboard header showed a
 * fictional school next to a green "Live sync active" badge. The cards' "demo
 * data" captions did not catch it: they were gated on one page-level `isDemo`
 * flag that turned false as soon as the first request succeeded, so a single live
 * KPI suppressed the disclaimer on all seven fabricated regions.
 *
 * The fix is not a better fallback. It is that `data/dashboardDemo.js` is gone
 * and there is nothing to fall back to.
 *
 * What each region is bound to:
 *
 *   school, term   GET  /schools/:id           (name, city, academic.currentTerm/Year)
 *   kpis           GET  /students/stats
 *   active         GET  /students
 *   transactions   GET  /payments
 *   channels       GET  /reports/payment-methods/:schoolId
 *   smsBroadcast   GET  /reports/outstanding/:schoolId
 *   weeklyInflow   — none; see getWeeklyCollections
 *   upcoming       — none; see getUpcomingInstallments
 *
 * The last two are absent from the response, not defaulted, so the cards can tell
 * "not available yet" from "nothing to report".
 */
export const useDashboardOverview = (schoolId) => {
  const [state, setState] = useState({
    data: EMPTY_OVERVIEW,
    loading: true,
    // Means "the API did not answer", not "a fixture is showing". It still gates
    // the header actions: a bursar must not be offered "Record Manual Payment"
    // against numbers that were never stored.
    isFallback: false,
    error: null,
    liveRegions: [],
  });

  useEffect(() => {
    if (!schoolId) {
      setState({ data: EMPTY_OVERVIEW, loading: false, isFallback: true, error: null, liveRegions: [] });
      return undefined;
    }

    let active = true;
    const live = [];

    // `Promise.allSettled`, not `all`: one endpoint failing must not take the rest
    // of the dashboard down with it.
    Promise.allSettled([
      getSchool(schoolId),
      getStudentStats({ status: 'all' }),
      listStudents({ status: 'all', perPage: 6, sortBy: 'createdAt', sortOrder: 'desc' }),
      listRecentPayments({ page: 1, perPage: 6, sortBy: 'createdAt', sortOrder: 'desc' }),
      getPaymentMethods(schoolId),
      getOutstanding(schoolId),
    ]).then(([school, stats, students, payments, methods, outstanding]) => {
      if (!active) return;

      const next = { ...EMPTY_OVERVIEW };
      let anyLive = false;

      if (school.status === 'fulfilled' && school.value) {
        const s = school.value;
        const term = s.academic?.currentTerm || '';
        const academicYear = s.academic?.currentYear || '';
        next.school = {
          name: s.name || '',
          city: s.city || '',
          schoolCode: s.schoolCode || '',
        };
        next.term = {
          term,
          academicYear,
          label: term ? `${term} · ${academicYear}`.trim() : '',
        };
        live.push('school');
        anyLive = true;
      }

      if (stats.status === 'fulfilled' && stats.value) {
        const s = stats.value;
        const owed = s.totalOwed ?? 0;
        const paid = s.totalPaid ?? 0;
        next.kpis = {
          totalStudents: { value: s.totalRoster ?? s.totalStudents ?? 0 },
          expectedOwed: { amount: owed },
          collected: {
            amount: paid,
            ratePercent: owed ? Math.round((paid / owed) * 1000) / 10 : 0,
            rateLabel: 'Collection Rate',
          },
          overdue: {
            students: s.overdueStudents ?? 0,
            amount: s.overdueAmount ?? 0,
          },
        };
        live.push('kpis');
        anyLive = true;
      }

      if (students.status === 'fulfilled' && students.value?.rows?.length) {
        next.active = students.value.rows;
        live.push('students');
        anyLive = true;
      }

      if (payments.status === 'fulfilled' && payments.value?.rows?.length) {
        next.transactions = payments.value.rows.map(toTransactionRow);
        next.transactionCount = payments.value.meta?.total ?? next.transactions.length;
        live.push('transactions');
        anyLive = true;
      }

      if (methods.status === 'fulfilled' && methods.value?.rows?.length) {
        // The endpoint groups by payment method (`momo`, `card`, `bank_transfer`,
        // `manual`) and reports a count of transactions. The fixture claimed a
        // per-network split with an authorisation rate and an "accounts" count,
        // which is why the card is now built on this shape instead.
        next.channels = methods.value.rows.map((row) => ({
          key: row.label,
          label: row.label,
          amount: row.amount ?? 0,
          transactionCount: row.count ?? 0,
          sharePercent: row.percentage ?? 0,
        }));
        live.push('channels');
        anyLive = true;
      }

      if (outstanding.status === 'fulfilled' && outstanding.value?.summary) {
        const s = outstanding.value.summary;
        next.smsBroadcast = {
          recipientCount: s.studentCount ?? 0,
          fullyUnpaidCount: s.fullyUnpaidCount ?? 0,
          partiallyPaidCount: s.partiallyPaidCount ?? 0,
          totalOutstanding: s.totalOutstanding ?? 0,
        };
        live.push('smsBroadcast');
        anyLive = true;
      }

      setState({
        data: next,
        loading: false,
        isFallback: !anyLive,
        error: null,
        liveRegions: live,
      });
    });

    return () => {
      active = false;
    };
  }, [schoolId]);

  /**
   * The weekly series, narrowed to one network.
   *
   * Empty by construction: `getWeeklyCollections` throws, because teaching weeks
   * have to be bucketed against the school calendar rather than `date % 7`. The
   * signature is kept so the card and the chart are unchanged when the route
   * lands — it becomes a fourth fetcher and the empty state disappears on its own.
   */
  const seriesFor = useMemo(
    () => (channel) =>
      (EMPTY_OVERVIEW.weeklyInflow || []).map((row) => ({
        label: row.week,
        value: channel === 'all' ? row.total : row[channel],
      })),
    []
  );

  /**
   * Force a re-read.
   *
   * Called after a mutation. Deliberately not a filter change, so recording a
   * payment refreshes the collection figures without the page re-deriving
   * anything about itself.
   */
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (nonce === 0 || !schoolId) return;
    getStudentStats({ status: 'all' })
      .then((s) => {
        setState((current) => ({
          ...current,
          data: {
            ...current.data,
            kpis: {
              ...current.data.kpis,
              collected: {
                ...current.data.kpis.collected,
                amount: s?.totalPaid ?? current.data.kpis.collected.amount,
              },
            },
          },
        }));
      })
      .catch(() => {});
  }, [nonce, schoolId]);

  return { ...state, seriesFor, refresh };
};

export default useDashboardOverview;
