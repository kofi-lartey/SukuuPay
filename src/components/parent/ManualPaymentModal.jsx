import React, { useState } from 'react';
import {
  Copy, CheckCircle2, Phone, HelpCircle, Clock
} from 'lucide-react';
import { initiateManualPayment } from '../../services/parent/payments';
import useToast from '../../hooks/useToast';

export const ManualPaymentModal = ({ token, student, amount, schoolPhone, onClose }) => {
  const [reference, setReference] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await initiateManualPayment(token, {
        studentId: student?._id || student?.id,
        amount: amount,
      });
      setReference(res.data.referenceCode);
    } catch (err) {
      toast.error('Could not generate reference code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formattedAmount = (amount / 100).toFixed(2);

  return (
    <div className="p-6 space-y-6">
      {!reference ? (
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Phone className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-ink">Pay via Mobile Money</h2>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            To pay <strong>GH₵ {formattedAmount}</strong> for {student.studentName},
            we need to generate a unique reference code. You will use this code when sending the money.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-brand-700 py-3.5 text-sm font-extrabold text-white hover:bg-brand-800"
          >
            {loading ? 'Generating…' : 'Generate Reference Code'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-4 text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 mb-1">
              Your Reference Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-extrabold tracking-widest text-brand-900">{reference}</span>
              <button
                onClick={() => copyToClipboard(reference)}
                className="p-2.5 bg-white border border-brand-200 text-brand-700 rounded-xl hover:bg-brand-100 transition-colors shadow-sm"
                title="Copy Code"
              >
                <Copy className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[11px] font-medium text-brand-600 mt-2">
              Save this code. You will need it for the payment.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              How to complete this payment
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-extrabold text-slate-600">1</div>
                <div>
                  <p className="text-[13px] font-bold text-ink">Open your Mobile Money app</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">Use MTN, Telecel, or AT Money.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-extrabold text-slate-600">2</div>
                <div>
                  <p className="text-[13px] font-bold text-ink">Send exactly GH₵ {formattedAmount}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">To: <strong className="text-ink">{schoolPhone}</strong></p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[12px] font-extrabold text-white">3</div>
                <div>
                  <p className="text-[13px] font-bold text-amber-900">Enter the Reference Code</p>
                  <p className="text-[12px] text-amber-800 mt-0.5">
                    In the "Reference" or "Reason" box, type: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300">{reference}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[12px] font-extrabold text-slate-600">4</div>
                <div>
                  <p className="text-[13px] font-bold text-ink">Confirm with your MoMo PIN</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">You will see a success message on your phone.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0 text-brand-600 mt-0.5" />
            <div>
              <p className="text-[13px] font-extrabold text-ink">What happens next?</p>
              <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
                The school accountant will check their MoMo messages, verify your code <strong>{reference}</strong>, and update your child's balance manually. You will receive a receipt once this is done (usually within a few hours).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-brand-700 py-3.5 text-sm font-extrabold text-white hover:bg-brand-800"
          >
            I have made the payment
          </button>
        </div>
      )}
    </div>
  );
};

export default ManualPaymentModal;
