import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentFees } from '../../services/student';
import { CreditCard, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const Fees = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['student-fees', page],
    queryFn: () => getStudentFees({ page, perPage: 20 }),
    staleTime: 60 * 1000,
    select: (response) => response?.data?.data || response?.data || {},
  });

  const fees = data || {};
  const payments = Array.isArray(fees.payments) ? fees.payments : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-[13px] font-semibold text-amber-900">Could not load fees.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Fee Payments</h1>
          <p className="text-[13px] font-semibold text-slate-500">Balance and payment history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">Outstanding</p>
          <p className="text-2xl font-extrabold text-rose-900 mt-1">GH₵ {Number(fees.balance || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Owed</p>
          <p className="text-2xl font-extrabold text-ink mt-1">GH₵ {Number(fees.totalOwed || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Paid</p>
          <p className="text-2xl font-extrabold text-ink mt-1">GH₵ {Number(fees.totalPaid || 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">Payment History</h2>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-2 pr-3 font-extrabold">Date</th>
                  <th className="py-2 pr-3 font-extrabold">Amount</th>
                  <th className="py-2 pr-3 font-extrabold">Method</th>
                  <th className="py-2 font-extrabold">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={p._id ?? idx} className="border-t border-slate-100">
                    <td className="py-2 pr-3 text-slate-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 font-bold text-ink">GH₵ {Number((p.amount || 0) / 100).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-slate-600">{p.method || p.paymentMethod || '—'}</td>
                    <td className="py-2 font-extrabold text-brand-700">{p.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-slate-500 text-center py-6">No payments recorded</p>
        )}
        {fees.meta?.totalPages > page && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Fees;
