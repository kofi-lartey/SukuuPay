import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPaymentHistory } from '../../services/parentPay';
import { DetailedReceiptRow } from '../../components/parent/ReceiptCard';
import { Card, Pill, Amount, ProgressBar } from '../../components/parent/primitives';
import { PARENT_ROUTES } from '../../utils/constants';

/**
 * A back link that is one tap and always in the same place.
 *
 * A parent who came here to check a receipt and finds an error should be able to
 * leave without reading anything. The alternative — no back link, relying on the
 * browser's back button, which on Android is either a gesture they have not
 * discovered or a hardware button that leaves the page entirely — turns a wrong tap
 * into a lost one.
 */
const BackLink = () => {
  const { token } = useParams();
  return (
    <Link
      to={PARENT_ROUTES.portal(token)}
      className="inline-flex min-h-[44px] items-center gap-1.5 px-1 text-[14px] font-bold text-[#0A5C36]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Fee page
    </Link>
  );
};

/** The running totals, so this page answers "how much have I paid in all?" too. */
const TotalsBanner = ({ student }) => {
  if (!student) return null;

  return (
    <Card className="p-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Bill</dt>
          <dd className="mt-1">
            <Amount pesewas={student.totalOwed} size="sm" className="font-bold" />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Paid</dt>
          <dd className="mt-1">
            <Amount pesewas={student.totalPaid} size="sm" className="font-bold text-emerald-700" />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Left</dt>
          <dd className="mt-1">
            <Amount pesewas={student.balance} size="sm" className="font-bold text-[#0A5C36]" />
          </dd>
        </div>
      </dl>
      <ProgressBar
        paid={student.totalPaid}
        owed={student.totalOwed}
        className="mt-3.5"
        tone={student.balance > 0 ? 'brand' : 'brand'}
      />
    </Card>
  );
};

/**
 * Every settled payment for this student.
 *
 * Paginated rather than one long list. A parent with four years of payments behind
 * them would otherwise download every row on a 3G connection to look at the one from
 * last term — and the list is only readable if it is not a thousand rows.
 *
 * **"Load more" rather than paging.** A parent looking for last term's receipt knows
 * roughly how far back to look, and a numbered pager means counting pages. Loading
 * the next page in place keeps what they have already scanned on screen, which is
 * the thing that would otherwise have to be re-read after every tap.
 */
const PaymentHistory = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ page = 1, append = false } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const response = await fetchPaymentHistory(token, { page, perPage: 20 });
        setData(response);
        setPayments((existing) => (append ? [...existing, ...(response?.payments || [])] : response?.payments || []));
        setError(null);
      } catch (caught) {
        setError(caught?.message || 'We could not load your payments.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const pagination = data?.pagination;
  const hasMore = Boolean(pagination?.hasMore);

  return (
    <div className="min-h-dvh bg-[#F6F8F7]">
      <div className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <BackLink />
          <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">
            Payment history
          </h1>
        </div>
      </div>

      <main className="mx-auto max-w-md px-4 pb-16 pt-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          </div>
        ) : error ? (
          <Card className="p-5 text-center">
            <p className="text-[15px] font-bold text-slate-900">We could not load your payments</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-4 min-h-[44px] w-full rounded-xl bg-[#0A5C36] px-4 text-[15px] font-bold text-white"
            >
              Try again
            </button>
          </Card>
        ) : (
          <>
            <TotalsBanner student={data?.student} />

            <h2 className="mb-2.5 mt-5 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-500">
              {pagination?.total
                ? `${pagination.total} payment${pagination.total === 1 ? '' : 's'}`
                : 'Payments'}
            </h2>

            {payments.length ? (
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {payments.map((payment, index) => (
                  <div key={payment.paymentId || payment._id || index}>
                    <DetailedReceiptRow payment={payment} token={token} />
                  </div>
                ))}
              </Card>
            ) : (
              <Card className="px-4 py-8 text-center">
                <p className="text-[15px] font-bold text-slate-900">No payments yet</p>
                <p className="mx-auto mt-1.5 max-w-xs text-[14px] leading-relaxed text-slate-500">
                  When you pay school fees through this link, every receipt will be listed here.
                </p>
                <Link
                  to={PARENT_ROUTES.portal(token)}
                  className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#0A5C36] px-5 text-[14px] font-bold text-white"
                >
                  Go to the fee page
                </Link>
              </Card>
            )}

            {hasMore ? (
              <button
                type="button"
                onClick={() => load({ page: (pagination?.page || 1) + 1, append: true })}
                disabled={loadingMore}
                className="mt-3 min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white text-[14px] font-bold text-slate-700 disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}

            {payments.length && !hasMore && pagination?.total > 0 ? (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-slate-400">
                <Pill tone="slate">End of list</Pill>
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
};

export default PaymentHistory;