import React, { useState, useEffect } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { confirmManualPayment } from '../../services/payments';
import useToast from '../../hooks/useToast';

export const ManualPaymentConfirmation = ({ initialReferenceCode = '', initialAmount = '' }) => {
  const [referenceCode, setReferenceCode] = useState(initialReferenceCode);
  const [amountReceived, setAmountReceived] = useState(initialAmount);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setReferenceCode(initialReferenceCode || '');
    setAmountReceived(initialAmount ? String(Number(initialAmount) / 100) : '');
  }, [initialReferenceCode, initialAmount]);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!referenceCode || !amountReceived) return;

    setLoading(true);
    try {
      await confirmManualPayment({
        referenceCode: referenceCode.toUpperCase(),
        amountReceived: Number(amountReceived) * 100,
      });
      toast.success('Payment confirmed and student balance updated!');
      setSuccess(true);
      setReferenceCode('');
      setAmountReceived('');
    } catch (err) {
      toast.error(err.message || 'Could not confirm payment. Check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold text-ink">Manual Payment Confirmation</h2>
        <p className="text-sm text-slate-500 mt-1">Search the parent's MoMo reference code to credit their child.</p>
      </div>

      <form onSubmit={handleConfirm} className="space-y-4">
        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Reference Code</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
              placeholder="e.g. KM123"
              maxLength={5}
              className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-200 text-lg font-mono font-bold tracking-widest uppercase focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Amount Received (GHS)</label>
          <input
            type="number"
            step="0.01"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            placeholder="e.g. 300.00"
            className="w-full h-12 px-3 rounded-xl border border-slate-200 text-lg font-bold focus:border-brand-700 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !referenceCode || !amountReceived}
          className="w-full h-12 mt-2 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Processing...' : <><CheckCircle2 className="h-5 w-5" /> Confirm Payment</>}
        </button>
      </form>

      {success && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Successfully added to student's balance.
        </div>
      )}
    </div>
  );
};

export default ManualPaymentConfirmation;
