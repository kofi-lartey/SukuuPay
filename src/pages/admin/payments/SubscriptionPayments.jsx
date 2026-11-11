import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, LoaderCircle, Phone } from 'lucide-react';
import {
  listPendingSubscriptionPayments,
  approveSubscriptionPayment,
} from '../../../services/admin';

const GHS = (amount) => `GH₵ ${amount.toLocaleString('en-GH')}`;

/**
 * Pending subscription payments queue for the platform administrator.
 *
 * Schools that selected a paid tier but have not yet been approved appear here.
 * The administrator reviews each one, confirms the Mobile Money payment was
 * received at `05576655008`, and approves it — which flips the school's
 * subscription from `suspended` / `pending` to `active`.
 */
const SubscriptionPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(new Set());
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await listPendingSubscriptionPayments();
      setPayments(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || 'We could not load the pending payments.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    setApproving((prev) => new Set(prev).add(id));
    try {
      await approveSubscriptionPayment(id);
      setPayments((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setError(err.message || 'We could not approve that payment.');
    } finally {
      setApproving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (busy && payments.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-brand-700" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">
              Pending subscription payments
            </h1>
            <p className="mt-1 text-slate-500">
              Schools that paid via Mobile Money and await your approval.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
            <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="text-[12px] font-mono font-bold text-ink">05576655008</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Clock className="h-8 w-8 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-extrabold text-ink">No pending payments</h3>
            <p className="mt-2 text-slate-500">
              Every school that requested a paid plan has been approved.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                    Received
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink">{payment.schoolName}</div>
                      <div className="text-[11px] text-slate-500">{payment.schoolCode}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{payment.plan}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-ink">
                        {GHS(payment.expectedAmount / 100)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-slate-600">{payment.referenceCode}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {approving.has(payment._id) ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-brand-700" aria-label="Approving" />
                      ) : (
                        <button
                          onClick={() => approve(payment._id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-800 active:bg-brand-900"
                        >
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-[12px] text-slate-400">
          Approving a payment activates the school's subscription immediately. The
          school is then taken off the 7-day free trial and onto the selected paid
          tier.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPayments;
