import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Link2Off, ShieldCheck } from 'lucide-react';
import PayHeader from '../../components/pay/PayHeader';
import BalanceCard from '../../components/pay/BalanceCard';
import MomoForm from '../../components/pay/MomoForm';
import CardForm from '../../components/pay/CardForm';
import PaymentResult from '../../components/pay/PaymentResult';
import Card from '../../components/dashboard/ui/Card';
import { getPayView, initiatePay, verifyPay, downloadPayReceipt } from '../../services/publicPay';
import { ROUTES } from '../../utils/constants';

/**
 * The student-facing fee page.
 *
 * This is the whole student view, and it was the one thing in the product with no
 * implementation at all: the backend has had `GET /pay/:token`,
 * `POST /pay/:token/initiate` and `POST /pay/:token/verify` for some time, and
 * every link a school sends to a parent landed on the marketing 404. The parent
 * side of the product simply did not exist.
 *
 * **The pay token is the credential.** There is no session and no login: a parent
 * opens an SMS link and can see that child's balance and pay it. That is why the
 * page carries no account chrome at all, and why the backend's response is
 * deliberately narrow — a name, a class, three figures, a deadline and the
 * school. No guardian phone numbers cross this boundary.
 *
 * **Polling is bounded and then it stops.** After a prompt is approved the
 * gateway's webhook is the real source of truth, so this page polls as a
 * convenience and then hands over. An unbounded poll against a payment that has
 * silently failed is how a parent ends up staring at "waiting" forever, so the
 * attempt count is capped and the UI says what to do next.
 */
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 15; // ~60s, then stop and let the parent decide

const PayPage = () => {
  const { token } = useParams();

  const [state, setState] = useState({ loading: true, error: null, view: null });
  const [payment, setPayment] = useState({ status: 'idle', error: null, data: null });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const polls = useRef(0);
  const timer = useRef(null);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    getPayView(token)
      .then((view) => setState({ loading: false, error: null, view }))
      .catch((error) => setState({ loading: false, error, view: null }));
  }, [token]);

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  const stopPolling = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => stopPolling, []);

  const poll = useCallback(
    (refs) => {
      if (polls.current >= MAX_POLLS) {
        setPayment({
          status: 'pending',
          data: null,
          error:
            'We have not heard back from your network yet. If you approved the prompt, the payment will still go through and the school will see it — you can close this page and check back later.',
        });
        return;
      }
      polls.current += 1;
      // eslint-disable-next-line no-use-before-define
      verifyPay(token, refs)
        .then((result) => {
          const status = String(result?.status || result?.payment?.status || '').toLowerCase();
          if (status === 'completed' || status === 'success' || status === 'successful') {
            stopPolling();
            setPayment({ status: 'completed', data: result?.payment || result, error: null });
            // Re-read the balance so the figure at the top is the one after the
            // payment, not the one that prompted it.
            load();
            return;
          }
          if (['failed', 'cancelled', 'reversed'].includes(status)) {
            stopPolling();
            setPayment({
              status: 'failed',
              data: null,
              error: 'Your network declined the payment. No money has left your account.',
            });
            return;
          }
          timer.current = setTimeout(() => poll(refs), POLL_INTERVAL_MS);
        })
        .catch(() => {
          timer.current = setTimeout(() => poll(refs), POLL_INTERVAL_MS);
        });
    },
    [token, load]
  );

  const startPayment = async (payload) => {
    setPayment({ status: 'starting', error: null, data: null });
    polls.current = 0;
    try {
      const result = await initiatePay(token, payload);
      // Paystack returns an authorizationUrl — redirect the parent to Paystack's
      // hosted checkout. The webhook settles the payment on return.
      if (result?.paystack?.authorizationUrl) {
        window.location.href = result.paystack.authorizationUrl;
        return;
      }

      // A gateway that accepts the request but reports "pending" inline should not
      // send us back to the form — the prompt is already out.
      const inline = String(result?.status || '').toLowerCase();
      if (['completed', 'success'].includes(inline)) {
        setPayment({ status: 'completed', data: result, error: null });
        load();
        return;
      }

      setPayment({ status: 'pending', data: result, error: null });
      poll({
        ...(result?.hubtelTransactionId ? { hubtelTransactionId: result.hubertelTransactionId } : {}),
        ...(result?.hubtelOrderId ? { hubtelOrderId: result.hubertelOrderId } : {}),
        ...(result?.transactionId ? { hubtelTransactionId: result.transactionId } : {}),
        ...(result?.reference ? { hubtelTransactionId: result.reference } : {}),
      });
    } catch (error) {
      // A 502 from the gateway is a real, common state: the school has no MTN
      // credentials configured, and a parent must be told the payment did not go
      // through rather than left on a spinner.
      setPayment({ status: 'failed', data: null, error: error.message });
    }
  };

  const retry = () => {
    stopPolling();
    polls.current = 0;
    setPayment({ status: 'idle', error: null, data: null });
  };

  const onDownloadReceipt = () => {
    const paymentId = payment?.data?.paymentId || payment?.data?.id;
    if (!paymentId) return;
    downloadPayReceipt(token, paymentId).catch(() => {});
  };

  // ── Invalid or expired link ──
  if (!state.loading && state.error) {
    const expired = /expired|not found|invalid or expired/i.test(state.error.message);
    return (
      <div className="min-h-screen bg-slate-50">
        <PayHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Card padding="p-8" className="text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Link2Off className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-extrabold text-ink">
              {expired ? 'This payment link has expired' : 'This link could not be opened'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[13px] font-semibold leading-relaxed text-slate-600">
              {expired
                ? 'Payment links are replaced from time to time. Ask the school for a new link and it will arrive by SMS.'
                : state.error.message}
            </p>
            <Link
              to={ROUTES.HOME}
              className="mt-5 inline-block rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-800"
            >
              Go to SukuuPay
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const student = state.view?.student;

  return (
    <div className="min-h-screen bg-slate-50">
      <PayHeader school={student?.school} />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {state.loading && (
          <div className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
          </div>
        )}

        {student && (
          <>
            <BalanceCard student={student} />

             <div className="mt-4">
               {payment.status === 'idle' || payment.status === 'starting' ? (
                 <>
                   <div className="mb-4 flex gap-2">
                     <button
                       type="button"
                       onClick={() => setPaymentMethod('momo')}
                       className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-extrabold ${
                         paymentMethod === 'momo'
                           ? 'bg-brand-700 text-white'
                           : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                       }`}
                     >
                       Mobile Money (MTN)
                     </button>
                     <button
                       type="button"
                       onClick={() => setPaymentMethod('card')}
                       className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-extrabold ${
                         paymentMethod === 'card'
                           ? 'bg-brand-700 text-white'
                           : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                       }`}
                     >
                       Card or Bank (Paystack)
                     </button>
                   </div>

                   {paymentMethod === 'momo' ? (
                     <MomoForm
                       student={student}
                       submitting={payment.status === 'starting'}
                       onSubmit={startPayment}
                     />
                   ) : (
                     <CardForm
                       student={student}
                       submitting={payment.status === 'starting'}
                       onSubmit={startPayment}
                     />
                   )}
                 </>
               ) : (
                 <PaymentResult
                  status={payment.status}
                  payment={payment.data}
                  error={payment.error}
                  onRetry={payment.status === 'completed' ? onDownloadReceipt : retry}
                />
              )}
            </div>

            {payment.status === 'completed' && (
              <p className="mt-4 text-center">
                <button
                  type="button"
                  onClick={retry}
                  className="text-[13px] font-extrabold text-brand-700 hover:underline"
                >
                  Pay another instalment
                </button>
              </p>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5 px-4 py-6 text-center sm:px-6">
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-slate-600">
            <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
            Payments are made directly to {student?.school?.name || 'the school'}
          </p>
          <p className="text-[11px] font-semibold text-slate-400">
            Keep this link private — it shows a child's fee balance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PayPage;
