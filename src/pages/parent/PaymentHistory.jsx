import { useState } from 'react';
import { CheckCircle2, FileDown, History } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { usePaymentHistory } from '../../hooks/parent/usePaymentHistory';
import { downloadReceiptPdf } from '../../services/parent/payments';
import { formatCedi, formatDate } from '../../utils/parentFormat';
import StudentRow from '../../components/parent/shared/StudentRow';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonCard } from '../../components/parent/shared/Skeleton';
import useToast from '../../hooks/useToast';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'term', label: 'This term' },
  { key: 'year', label: 'This year' },
];

const Summary = ({ stats }) => {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div>
        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
          Total paid
        </p>
        <p className="mt-1 text-[15px] font-extrabold tabular-nums text-ink">
          {formatCedi(stats.totalPaid)}
        </p>
      </div>
      <div>
        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
          This term
        </p>
        <p className="mt-1 text-[15px] font-extrabold tabular-nums text-ink">
          {formatCedi(stats.thisTerm)}
        </p>
      </div>
      <div>
        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
          Balance
        </p>
        <p className="mt-1 text-[15px] font-extrabold tabular-nums text-ink">
          {formatCedi(stats.balance)}
        </p>
      </div>
    </div>
  );
};

const PaymentRow = ({ token, payment, onDownload }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14px] font-extrabold tabular-nums text-ink">
        {formatCedi(payment.amount)}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11.5px] text-slate-500">
        {payment.receiptNumber || payment.paymentId}
      </p>
      <p className="truncate text-[11px] text-slate-400">
        {formatDate(payment.completedAt || payment.createdAt)}
      </p>
    </div>
    <button
      type="button"
      onClick={() => onDownload(payment)}
      aria-label="Download receipt"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
);

const PaymentHistory = () => {
  const { token, student, school } = useParentPay();
  const [filter, setFilter] = useState('all');
  const toast = useToast();
  const { data, isLoading, error, refetch } = usePaymentHistory(token, { filter });

  const handleDownload = async (payment) => {
    try {
      const blob = await downloadReceiptPdf(token, payment.paymentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${payment.receiptNumber || 'receipt'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Receipt downloaded');
    } catch (err) {
      toast.error(err.message || 'Could not download the receipt.');
    }
  };

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      {data?.stats ? <Summary stats={data.stats} /> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                active
                  ? 'bg-[#0A5C36] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <ErrorBanner message={error.message} onRetry={refetch} />
      ) : isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !data?.payments?.length ? (
        <EmptyState
          icon={History}
          title="No payments yet"
          description="Once you make a payment, it will appear here with a downloadable receipt."
        />
      ) : (
        <div className="space-y-2">
          {data.payments.map((p) => (
            <PaymentRow
              key={p.paymentId}
              token={token}
              payment={p}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
