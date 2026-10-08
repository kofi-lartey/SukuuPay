import React, { useCallback, useMemo, useState } from 'react';
import {
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Button from '../../components/common/Button';
import RecordManualPaymentDialog from '../../components/dashboard/RecordManualPaymentDialog';
import PaymentKpiRow from '../../components/payments/PaymentKpiRow';
import PaymentFilterBar from '../../components/payments/PaymentFilterBar';
import TransactionTable from '../../components/payments/TransactionTable';
import PaymentDetailDrawer from '../../components/payments/PaymentDetailDrawer';
import RefundPaymentDialog from '../../components/payments/RefundPaymentDialog';
import ReceiptDialog from '../../components/payments/ReceiptDialog';
import SettlementBand from '../../components/payments/SettlementBand';
import useToast from '../../hooks/useToast';
import { usePayments, usePaymentSummary } from '../../hooks/usePayments';
import { useAuth } from '../../context/AuthContext';
import { exportPayments } from '../../services/payments';
import { formatCedi, formatCount } from '../../utils/format';

/**
 * Payments & settlements.
 *
 * The reconciliation surface: every cedi the school has taken, where it came in
 * through, and which student's balance it credited. The module a bursar opens
 * to answer "did this parent actually pay?".
 *
 * Every mutation funnels through one `reloadKey`, so the KPI band and the table
 * never disagree. The two "pull fresh data" actions (Export, Refresh) share a
 * single split control in the header. The primary write action — recording a
 * payment at the desk — lives as a floating action button, so it stays
 * thumb-reachable on tablets and phones while the list scrolls.
 */
const Payments = () => {
  const { user, school } = useAuth();
  const { success, error: errorToast } = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [receiptId, setReceiptId] = useState(null);

  const {
    rows,
    meta,
    loading,
    error,
    filters,
    setFilter,
    clearFilters,
    hasFilters,
  } = usePayments(reloadKey);
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
  } = usePaymentSummary(filters);

  const classes = useMemo(
    () => school?.academic?.classes || school?.classes || [],
    [school]
  );

  /** The single invalidation point every mutation funnels through. */
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * Manual refresh, with a spinner.
   *
   * Separate from `refresh()` because a mutation should not leave a spinner
   * behind: the refetch after a save is not something the bursar asked for, and
   * a button that spins for a request they did not trigger reads as a second
   * request still running.
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    // The hooks re-fetch off `reloadKey`; this only needs to outlast the change
    // reaching them, not the request they make.
    setTimeout(() => setRefreshing(false), 600);
  }, [refresh]);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      // Deliberately **not** the page's pagination keys. `page`, `perPage` and
      // the sort fields would export one page and label it as everything. The
      // search term and the channel/class/date filters do carry across —
      // "export what I am looking at" is the contract.
      const {
        search,
        class: className,
        status,
        network,
        paymentMethod,
        startDate,
        endDate,
      } = filters;
      const { filename } = await exportPayments({
        search,
        class: className,
        status: status === 'all' ? '' : status,
        network,
        paymentMethod,
        startDate,
        endDate,
      });
      success(`Exported ${filename}`);
    } catch (apiError) {
      errorToast(apiError.message);
    } finally {
      setExporting(false);
    }
  }, [filters, success, errorToast]);

  const onRecorded = useCallback(() => {
    setRecording(false);
    refresh();
    success('Payment recorded');
  }, [refresh, success]);

  const onRefunded = useCallback(() => {
    setRefundTarget(null);
    setDetailId(null);
    refresh();
    success('Refund recorded');
  }, [refresh, success]);

  /**
   * The server gates every payment route on `authorize('super_admin',
   * 'school_admin')`, refund included, so the action is hidden rather than
   * offered-and-refused. Presentation only — `authorize` is the boundary, and
   * hiding a button must never be the thing that enforces it.
   */
  const canRefund = ['super_admin', 'school_admin'].includes(user?.role);

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Payments & Settlements"
        description="Real-time reconciliation across MTN MoMo, Telecel Cash, and Bank settlements via GhiPSS"
        actions={
          /* Split control. One visual button, two hit targets, a thin divider
             between them. Groups the two "pull fresh data" actions under one
             mental model and saves horizontal space on tablet widths. */
          <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={onExport}
              disabled={exporting}
              aria-label="Export transactions"
              title="Export transactions"
              className="inline-flex h-9 items-center justify-center px-3 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <span className="w-px self-stretch bg-slate-200" aria-hidden="true" />

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              title="Refresh"
              className="inline-flex h-9 items-center justify-center px-3 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        }
      />

      {summary && summary.totalTransactions > 0 && (
        <p className="sr-only" role="status">
          {formatCedi(summary.totalInflow)} collected across{' '}
          {formatCount(summary.totalTransactions)} transactions.
        </p>
      )}

      {/* The band gets the summary's own error, not the table's: a list-only
          failure would otherwise blank four figures that loaded perfectly. */}
      <PaymentKpiRow summary={summary} loading={summaryLoading} error={summaryError} />

      <PaymentFilterBar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        hasFilters={hasFilters}
        classes={classes}
        summary={summary}
      />

      <TransactionTable
        rows={rows}
        loading={loading}
        error={error}
        meta={meta}
        filters={filters}
        onSort={setFilter}
        onPageChange={(page) => setFilter({ page }, { resetPage: false })}
        onPerPageChange={(perPage) => setFilter({ perPage })}
        onOpenDetail={(payment) => setDetailId(payment.paymentId)}
        onViewReceipt={(payment) => setReceiptId(payment.paymentId)}
        onRefund={(payment) => setRefundTarget(payment)}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
        canRefund={canRefund}
      />

      <SettlementBand school={school} />

      {/* Floating action button. Fixed to the bottom-right of the viewport so it
          stays reachable on scroll. Bottom offset respects the iOS safe area
          via env(safe-area-inset-bottom), so on an iPhone the FAB sits above
          the home indicator rather than under it. */}
      <button
        type="button"
        onClick={() => setRecording(true)}
        aria-label="Record payment"
        title="Record payment"
        className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-700/30 sm:bottom-8 sm:right-8"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <RecordManualPaymentDialog
        open={recording}
        onClose={() => setRecording(false)}
        onRecorded={onRecorded}
      />

      <PaymentDetailDrawer
        paymentId={detailId}
        onClose={() => setDetailId(null)}
        onRefund={(payment) => {
          setDetailId(null);
          setRefundTarget(payment);
        }}
      />

      <RefundPaymentDialog
        open={Boolean(refundTarget)}
        payment={refundTarget}
        onClose={() => setRefundTarget(null)}
        onRefunded={onRefunded}
      />

      <ReceiptDialog
        open={Boolean(receiptId)}
        paymentId={receiptId}
        onClose={() => setReceiptId(null)}
      />
    </div>
  );
};

export default Payments;