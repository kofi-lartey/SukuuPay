import React, { useCallback, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
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
 * through, and which student's balance it credited. It is the module a bursar
 * opens to answer "did this parent actually pay?" — which is why the table leads
 * with the transaction reference and the drawer exists at all.
 *
 * **Every mutation funnels through one `reloadKey`.** Recording a payment at the
 * desk, refunding one, or pulling the refresh button all bump the same counter,
 * which re-runs the list *and* the KPI band together. Two separate refreshes
 * would let the tile read GH₵ 318,000 while the table below it shows the
 * payment that was just recorded — the one disagreement on this screen that
 * matters.
 *
 * The page owns no data fetching of its own beyond `reloadKey`; the list and the
 * summary each come from a hook, and the table and the band are pure
 * presentation over what those return.
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

  const { rows, meta, loading, error, filters, setFilter, clearFilters, hasFilters } =
    usePayments(reloadKey);
  const { summary, loading: summaryLoading, error: summaryError } = usePaymentSummary(filters);

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
      // Deliberately **not** the page's filters. `page`, `perPage` and the sort
      // keys are pagination, and sending them would export one page of a
      // filtered list and label it as everything. The search term and the
      // channel/class/date filters do carry across — "export what I am looking
      // at" is the contract, and the server shares this exact filter builder.
      const { search, class: className, status, network, paymentMethod, startDate, endDate } =
        filters;
      const { filename } = await exportPayments({
        // `search`, not the `q` this component keeps in the URL. `q` is the
        // roster's URL spelling and this hook's local name; the API parameter is
        // `search`, and `paymentExportQuerySchema` runs with `stripUnknown`, so a
        // `q` is dropped without complaint — the export would silently ignore
        // whatever the bursar had typed.
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
    success('Payment recorded and the student’s balance updated');
  }, [refresh, success]);

  const onRefunded = useCallback(() => {
    setRefundTarget(null);
    setDetailId(null);
    refresh();
    success('Refund recorded and the balance reversed');
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
        eyebrow="Payments & Transactions"
        title="Payments & Settlements"
        description="Real-time automated reconciliation across MTN MoMo, Telecel Cash, and Bank settlements via GhiPSS"
        actions={
          <>
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export transactions'}
            </Button>
            <Button onClick={() => setRecording(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Record manual / cash payment
            </Button>
          </>
        }
      />

      {summary && summary.totalTransactions > 0 && (
        <p className="sr-only" role="status">
          {formatCedi(summary.totalInflow)} collected across{' '}
          {formatCount(summary.totalTransactions)} transactions.
        </p>
      )}

      {/* The band gets the summary's own error, not the table's: a list-only failure
          would otherwise blank four figures that loaded perfectly well. */}
      <PaymentKpiRow summary={summary} loading={summaryLoading} error={summaryError} />

      <PaymentFilterBar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        hasFilters={hasFilters}
        classes={classes}
        summary={summary}
        onRefresh={onRefresh}
        refreshing={refreshing}
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

      <ReceiptDialog open={Boolean(receiptId)} paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </div>
  );
};

export default Payments;