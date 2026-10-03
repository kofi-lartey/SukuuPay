import { Amount, Pill } from './primitives';
import { formatDate, networkLabel } from '../../utils/parentFormat';
import { receiptDownloadUrl } from '../../services/parentPay';

/**
 * One settled payment, as a row.
 *
 * A receipt number is shown when there is one and hidden when there is not, because
 * `RCT-2026-0142` on its own line is what a parent reads out at the bursar's window —
 * and a row that sometimes reads "Receipt pending" is a row they cannot act on. The
 * number is minted in the payment's pre-save hook, so a payment settled a moment ago
 * may not have one yet, and the row degrades to the date instead of a placeholder.
 *
 * The download is a real `<a download>`, not a button with a fetch behind it. Two
 * reasons, both about the handset: a browser streams a direct download to disk where
 * a blob has to be buffered whole in memory first, and an anchor keeps working if
 * the page is backgrounded mid-tap — which is what happens when a parent rotates
 * their phone to photograph a screen and comes back to a button whose handler no
 * longer has anything to report to.
 */
const ReceiptCard = ({ payment, token, onDownloaded }) => {
  const receiptNumber = payment.receiptNumber;
  const when = formatDate(payment.completedAt || payment.createdAt);
  const network = networkLabel(payment.network);
  const canDownload = Boolean(token && payment.paymentId);

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold tabular-nums text-slate-900">
          {receiptNumber || when}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">
          {receiptNumber ? when : 'Receipt number being issued'}
          {network ? ` · ${network}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Amount pesewas={payment.amount} size="sm" className="font-extrabold" />
        {canDownload ? (
          <a
            href={receiptDownloadUrl(token, payment.paymentId)}
            download
            onClick={onDownloaded}
            aria-label={`Download receipt ${
              receiptNumber || `for ${when}`
            }`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0A5C36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A5C36]"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : null}
      </div>
    </li>
  );
};

/**
 * The last few payments, on the landing page.
 *
 * Wraps `ReceiptCard` and owns the empty state, which is the common one: most parents
 * opening this link for the first time have paid nothing, and a bare "No payments
 * yet" reads as a broken list rather than as the start of a record. It says what to
 * do instead.
 */
export const ReceiptList = ({ payments, token }) => {
  if (!payments?.length) {
    return (
      <p className="px-4 py-5 text-center text-[14px] leading-relaxed text-slate-500">
        No payments on record yet. Once you pay, your receipt will appear here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {payments.map((payment) => (
        <ReceiptCard
          key={payment.paymentId || payment._id}
          payment={payment}
          token={token}
        />
      ))}
    </ul>
  );
};

/** The same row, for the full history page, where the channel matters more. */
export const DetailedReceiptRow = ({ payment, token }) => {
  const network = networkLabel(payment.network);

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold tabular-nums text-slate-900">
            {payment.receiptNumber || 'Receipt number being issued'}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {formatDate(payment.completedAt || payment.createdAt)}
          </p>
        </div>
        <Amount pesewas={payment.amount} className="shrink-0" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {network ? <Pill tone="brand">{network}</Pill> : null}
        {payment.reference ? (
          <span className="text-[11px] tabular-nums text-slate-400">{payment.reference}</span>
        ) : null}
        {token && payment.paymentId ? (
          <a
            href={receiptDownloadUrl(token, payment.paymentId)}
            download
            className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            PDF
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default ReceiptCard;