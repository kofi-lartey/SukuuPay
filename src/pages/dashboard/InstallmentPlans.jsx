import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Plus,
  UserSearch,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import ModuleTabs from '../../components/dashboard/ModuleTabs';
import Card from '../../components/dashboard/ui/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/dashboard/ui/Badge';
import ComplianceKpiRow from '../../components/plans/ComplianceKpiRow';
import PlanHealthBar from '../../components/plans/PlanHealthBar';
import ComplianceFilterBar from '../../components/plans/ComplianceFilterBar';
import ComplianceTable from '../../components/plans/ComplianceTable';
import PlanScheduleDrawer from '../../components/plans/PlanScheduleDrawer';
import BroadcastAtRiskModal from '../../components/plans/BroadcastAtRiskModal';
import CreatePlanForm from '../../components/plans/CreatePlanForm';
import PlanProjection from '../../components/plans/PlanProjection';
import StudentPicker from '../../components/plans/StudentPicker';
import useInstallmentPlans from '../../hooks/useInstallmentPlans';
import usePlanBuilder from '../../hooks/usePlanBuilder';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { getSchool } from '../../services/school';
import { endOfThisMonth, firstOfNextMonth, adminAcceptPaymentPlan } from '../../services/paymentPlans';
import { ROUTES } from '../../utils/constants';
import { formatCedis, formatCount } from '../../utils/format';

/**
 * The Installment Plans module: compliance monitoring, and creating a plan.
 *
 * Two tabs rather than two routes, because the second is reached from the first.
 * A bursar sees a family in default on the compliance table, opens the schedule
 * drawer, decides the family needs more room, and cancels and rebuilds — a flow
 * that should not involve a URL change, a full page transition, and re-finding
 * their filters. The tab lives in the query string so the create screen is still
 * linkable, which is what lets a bursar send a colleague "the plan I built for
 * Adjoa Mensah" rather than a description of it.
 *
 * The compliance list's *filters* are also in the URL, for the reason every other
 * filtered module in this app keeps them there: this screen is the one a bursar
 * forwards to a head teacher, and "JHS 2A, overdue only" is a claim somebody else
 * needs to be able to open and check.
 */

const TABS = [
  { value: 'compliance', label: 'Compliance' },
  { value: 'create', label: 'Create Plan' },
];

/** How many page buttons to draw around the current one. */
const pageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
};

const InstallmentPlans = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') === 'create' ? 'create' : 'compliance';
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'compliance') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  // The student being planned for, also in the URL — the same reasoning as the
  // tab, one level down.
  const planningFor = searchParams.get('student') || null;

  const plans = useInstallmentPlans();
  const builder = usePlanBuilder(planningFor);

  const [school, setSchool] = useState(null);
  const [view, setView] = useState('table');
  const [drawerPlan, setDrawerPlan] = useState(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    getSchool(user.schoolId)
      .then((result) => {
        if (active) setSchool(result);
      })
      .catch(() => {
        // The class filter degrades to nothing rather than blocking the module: a
        // school whose class list cannot be read should still see its compliance.
        if (active) setSchool(null);
      });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  // The compliance endpoint already joins the student's name, class and primary
  // parent onto each row, so the table needs no second request to render
  // "Parent: K. O. Mensah". It deliberately does *not* include the phone — a
  // compliance list has no use for twenty guardians' numbers.
  const rowsWithParent = plans.rows;

  const classes = useMemo(() => {
    const list = school?.academic?.classes || school?.classes || [];
    return Array.isArray(list) ? list : [];
  }, [school]);

  const terms = useMemo(
    () => [school?.academic?.currentTerm, ...(school?.academic?.termHistory || []).map((t) => t.term)]
        .filter(Boolean)
        .map((term) => (typeof term === 'string' ? term : term.term))
        .filter((term, index, all) => all.indexOf(term) === index),
    [school]
  );

  const onSort = (key) => {
    const sameColumn = plans.filters.sortBy === key;
    plans.setFilter({
      sortBy: key,
      // Toggling rather than always descending: a bursar who sorted by amount to
      // see the biggest debts clicks again to see the smallest, and a column that
      // only ever sorts one way makes the second click feel broken.
      sortOrder: sameColumn ? (plans.filters.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc',
    });
  };

  /**
   * The CSV export.
   *
   * Built in the browser from the rows on the current page, and the button says
   * so. A button labelled "Export Compliance Report (CSV/PDF)" implies the whole
   * school; delivering twenty rows of 176 under that label is how a bursar hands a
   * head teacher an incomplete picture and calls it the school's compliance.
   * A full export has to be a server job.
   */
  const exportCsv = () => {
    setExporting(true);
    try {
      const header = [
        'Student',
        'Class',
        'Student ID',
        'Parent',
        'Plan',
        'Tranches',
        'Paid',
        'Next Due',
        'Tranche Amount (GHS)',
        'Outstanding (GHS)',
        'Compliance',
      ];

      const lines = rowsWithParent.map((plan) => {
        const student = plan.student || {};
        const next = plan.nextInstallment;
        const paid = (plan.installments || []).filter(
          (installment) => installment.status === 'paid' || installment.status === 'waived'
        ).length;
        return [
          student.studentName,
          student.studentClass,
          student.studentId,
          student.parentName,
          plan.planName,
          (plan.installments || []).length,
          paid,
          // ISO, not the design's "30 Oct 2026": a CSV is opened in a
          // spreadsheet, where a localised date is a date the spreadsheet will
          // silently re-interpret in its own locale. ISO is unambiguous and sorts
          // lexicographically, which is what a date column should do.
          next ? new Date(next.dueDate).toISOString().slice(0, 10) : '',
          next ? ((next.amount - (next.amountPaid || 0)) / 100).toFixed(2) : '',
          ((plan.outstandingAmount ?? 0) / 100).toFixed(2),
          plan.complianceStatus,
        ]
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',');
      });

      const csv = [header.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `installment-compliance-page-${plans.filters.page}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      toast.warning(
        `Exported the ${formatCount(lines.length)} plan${lines.length === 1 ? '' : 's'} on this page. A whole-school export is a server job — ask support for one.`
      );
    } finally {
      setExporting(false);
    }
  };

  const atRisk = plans.summary?.atRiskPlans ?? 0;

  // ── Create-plan tab ──
  if (tab === 'create') {
    const nextParam = (value) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'create');
      if (value) next.set('student', value);
      else next.delete('student');
      setSearchParams(next, { replace: true });
    };

    return (
      <>
        <PageHeader
          eyebrow={
            <>
              <Link to={ROUTES.DASHBOARD_PLANS}>Installment Plans</Link>
              <span aria-hidden="true">›</span>
              New Plan Setup
            </>
          }
          title={
            builder.student
              ? `Create Payment Plan — ${builder.student.studentName}`
              : 'Create Payment Plan'
          }
          description={
            builder.student
              ? `Class: ${builder.student.studentClass} • Student ID: ${builder.student.studentId} • Total Fee Owed: GH₵ ${formatCedis(builder.figures.totalOwed)}`
              : 'Structure an outstanding balance into dated installments for one student.'
          }
          actions={
            <Link
              to={ROUTES.DASHBOARD_PLANS}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back to compliance
            </Link>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <StudentPicker
              selected={builder.student}
              loading={builder.loading}
              onSelect={(id) => nextParam(id)}
            />

            {builder.student && (
              <div className="mt-5">
                <CreatePlanForm
                  figures={builder.figures}
                  guardian={builder.guardian}
                  numberOfInstallments={builder.numberOfInstallments}
                  setNumberOfInstallments={builder.setNumberOfInstallments}
                  interval={builder.interval}
                  setInterval={builder.setInterval}
                  startDate={builder.startDate}
                  setStartDate={builder.setStartDate}
                  onStartDatePreset={(target) =>
                    builder.setStartDate(
                      // The presets are computed here rather than in the hook so the
                      // hook stays a state machine and the two "end of this month"
                      // definitions cannot drift apart.
                      target === 'endOfMonth' ? endOfThisMonth() : firstOfNextMonth()
                    )
                  }
                  planName={builder.planName}
                  setPlanName={builder.setPlanName}
                  adminNotes={builder.adminNotes}
                  setAdminNotes={builder.setAdminNotes}
                  autoCollect={builder.autoCollect}
                  setAutoCollect={builder.setAutoCollect}
                  reminderDays={builder.reminderDays}
                  setReminderDays={builder.setReminderDays}
                  reminderTime={builder.reminderTime}
                  setReminderTime={builder.setReminderTime}
                />
              </div>
            )}
          </div>

          <div>
            <PlanProjection
              projection={builder.projection}
              figures={builder.figures}
              loading={builder.loading}
              planName={builder.planName || `${builder.numberOfInstallments}-Month Plan`}
              term={school?.academic?.currentTerm}
              academicYear={school?.academic?.currentYear}
              schoolName={user?.schoolName || school?.name}
              guardian={builder.guardian}
            />
          </div>
        </div>

        {/* The action bar. It states the blocker in words rather than presenting a
            dead button — and it states the SMS that is about to be sent, because
            the parent is about to be messaged and that is not a side effect. */}
        {builder.student && (
          <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-[12px] font-semibold text-slate-600">
                {builder.blocker ? (
                  <span className="text-amber-700">{builder.blocker}</span>
                ) : builder.guardian ? (
                  <>
                    Plan notification ready for dispatch to{' '}
                    <span className="font-extrabold text-ink">
                      {builder.guardian.parentName} ({builder.guardian.phone})
                    </span>
                  </>
                ) : (
                  <>
                    No guardian on record — the plan will be created, but nobody will be
                    told about it.
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => nextParam(null)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    builder.save().catch(() => {});
                    toast.info('Draft kept in this browser. Nothing has been sent.');
                  }}
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await builder.save();
                      navigate(ROUTES.DASHBOARD_PLANS);
                    } catch (error) {
                      toast.error(error?.message || 'The plan could not be created.');
                    }
                  }}
                  disabled={!builder.canSubmit || builder.saving}
                >
                  Generate Plan &amp; Send to Parent
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Compliance tab ──
  return (
    <>
      <PageHeader
        eyebrow="Overview / Installment Plans / Compliance"
        title="Installment Compliance Dashboard"
        description={`Real-time monitoring of structured parent payment plans for ${
          user?.schoolName || school?.name || 'your school'
        }${school?.academic?.currentTerm ? ` • ${school.academic.currentTerm}` : ''}${
          school?.academic?.currentYear ? ` (${school.academic.currentYear})` : ''
        }`}
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting || !rowsWithParent.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export this page (CSV)
            </button>
            <button
              type="button"
              onClick={() => setTab('create')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create New Plan
            </button>
          </>
        }
      />

      <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Installment plan sections" />

      <div className="space-y-5">
        <ComplianceKpiRow summary={plans.summary} loading={plans.loading} />

        <PlanHealthBar
          summary={plans.summary}
          loading={plans.loading}
          activeFilter={plans.filters.status}
          onFilter={(status) => plans.setFilter({ status })}
        />

        <Card padding="p-4">
          <ComplianceFilterBar
            filters={plans.filters}
            onFilter={plans.setFilter}
            onClear={plans.clearFilters}
            hasFilters={plans.hasFilters}
            onRefresh={plans.reload}
            refreshing={plans.loading}
            classes={classes}
            terms={terms}
            resultCount={plans.meta?.total ?? null}
            view={view}
            onViewChange={setView}
          />
        </Card>

        <Card padding="p-0" className="overflow-hidden">
          {view === 'table' ? (
            <ComplianceTable
              rows={rowsWithParent}
              loading={plans.loading}
              error={plans.error}
              hasFilters={plans.hasFilters}
              busyPlanId={drawerPlan?._id}
              onViewSchedule={setDrawerPlan}
              onChase={() => setBroadcastOpen(true)}
              onAccept={async (plan) => {
                try {
                  await adminAcceptPaymentPlan(plan._id);
                  toast.success('Plan accepted and activated.');
                  plans.reload();
                } catch (e) {
                  toast.error(e.message || 'Could not accept plan.');
                }
              }}
              onSort={onSort}
              sortBy={plans.filters.sortBy}
              sortOrder={plans.filters.sortOrder}
            />
          ) : (
            <ComplianceCardGrid
              rows={rowsWithParent}
              loading={plans.loading}
              hasFilters={plans.hasFilters}
              onViewSchedule={setDrawerPlan}
              onChase={() => setBroadcastOpen(true)}
            />
          )}

          {/* The footer. Both halves matter: the row range says what you are
              looking at, and the broadcast button is the reason the compliance
              dashboard is actionable rather than merely informative. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] font-semibold text-slate-500">
              {plans.loading
                ? 'Loading…'
                : plans.meta?.total
                  ? `Showing ${formatCount((plans.filters.page - 1) * plans.filters.perPage + 1)} to ${formatCount(
                      Math.min(plans.filters.page * plans.filters.perPage, plans.meta.total)
                    )} of ${formatCount(plans.meta.total)} plan records`
                  : 'No plan records'}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBroadcastOpen(true)}
                disabled={atRisk === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[12px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                Broadcast SMS to all {formatCount(atRisk)} At-Risk &amp; Approving Parents
              </button>

              <Pagination
                page={plans.filters.page}
                totalPages={plans.meta?.totalPages || 1}
                onChange={(page) => plans.setFilter({ page }, { resetPage: false })}
              />
            </div>
          </div>
        </Card>
      </div>

      <PlanScheduleDrawer
        plan={drawerPlan}
        open={Boolean(drawerPlan)}
        onClose={() => setDrawerPlan(null)}
        onChanged={(updated) => {
          if (updated) setDrawerPlan({ ...drawerPlan, ...updated });
          plans.reload();
        }}
      />

      <BroadcastAtRiskModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSent={() => toast.success('Chaser queued. Track delivery on the SMS Reminders module.')}
      />
    </>
  );
};

/** The card view the table's toggle switches to. */
const ComplianceCardGrid = ({ rows, loading, hasFilters, onViewSchedule, onChase }) => {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 px-4 py-12 text-[12px] font-semibold text-slate-500">
        Loading plan compliance…
      </p>
    );
  }
  if (!rows.length) {
    return (
      <p className="px-4 py-12 text-center text-[12px] font-semibold text-slate-500">
        {hasFilters
          ? 'No plans match these filters.'
          : 'No payment plans yet. Create one from a student with an outstanding balance.'}
      </p>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((plan) => {
        const student = plan.student || {};
        const next = plan.nextInstallment;
        const isOverdue = plan.complianceStatus === 'overdue';

        return (
          <Card key={plan._id} padding="p-4" className="flex flex-col">
            <p className="text-[13px] font-extrabold text-ink">{student.studentName}</p>
            <p className="text-[11px] font-semibold text-slate-500">
              {student.studentClass} · {student.studentId}
            </p>

            <p className="mt-3 text-[12px] font-extrabold text-ink">{plan.planName}</p>
            <p
              className={`mt-0.5 text-[15px] font-extrabold ${
                isOverdue ? 'text-red-600' : 'text-ink'
              }`}
            >
              GH₵ {formatCedis(next ? Math.max(next.amount - (next.amountPaid || 0), 0) : 0)}
            </p>
            {next && (
              <p className="text-[11px] font-semibold text-slate-500">
                Next due {new Date(next.dueDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </p>
            )}

            <div className="mt-auto flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => onChase(plan)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50"
              >
                Chase
              </button>
              <button
                type="button"
                onClick={() => onViewSchedule(plan)}
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-ink hover:bg-slate-200"
              >
                View Schedule
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

/** Page buttons, with ellipses where the run is long. */
const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Plan compliance pages" className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {pageWindow(page, totalPages).map((entry, index) =>
        entry === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-[12px] font-bold text-slate-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={`h-8 min-w-8 rounded-lg px-2 text-[12px] font-extrabold transition-colors ${
              entry === page
                ? 'bg-brand-700 text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {entry}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </nav>
  );
};

export default InstallmentPlans;
