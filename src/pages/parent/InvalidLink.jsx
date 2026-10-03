import { Link, useLocation } from 'react-router-dom';

/**
 * The link did not work.
 *
 * **This is a designed page, not an error screen.** A pay link expires — schools
 * reissue them each term, a child's record is archived when they move, a token is
 * rotated after a suspected leak. For the parent this is a *known, recurring* event,
 * not a malfunction, and the brief for it is completely different from a 404:
 * they have clicked a link in an SMS expecting to pay a bill, and the most useful
 * thing on the page is "ask the school for a new one", reachable in one tap.
 *
 * So there is no stack trace, no error code and no generic apology. There is what
 * happened, what to do, and the school's phone number.
 *
 * ## On the message
 *
 * The reason is read from router state, so the parent's own message from the
 * server appears rather than a paragraph written for every possible cause. An
 * archived child ("This account is no longer active") and a mistyped link ("This
 * payment link is invalid") both end up here, and they want different things — one
 * wants a phone call about a record, the other a new link. The fallback text covers
 * both without asserting either.
 *
 * ## No retry button
 *
 * Retrying a dead token cannot succeed. A "Try again" here teaches a parent that the
 * page is flaky when the truth is that the link is finished, and they will try it
 * three times before reading anything below.
 */
const InvalidLink = () => {
  const location = useLocation();
  const serverMessage = location.state?.message;
  const status = location.state?.status;

  const archived = status === 410;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F6F8F7]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              {archived ? (
                <path
                  d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>

          <h1 className="mt-5 text-[21px] font-extrabold tracking-tight text-slate-900">
            {archived ? 'This account has moved on' : 'This link is not working'}
          </h1>

          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">
            {serverMessage ||
              'This payment link is invalid or has expired. Please contact the school for a new link.'}
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-[13px] font-bold text-slate-900">What to do</p>
            <ol className="mt-2 space-y-2 text-[14px] leading-relaxed text-slate-600">
              <li className="flex gap-2.5">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-[#0A5C36]">
                  1
                </span>
                <span>Call or visit the school&rsquo;s office.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-[#0A5C36]">
                  2
                </span>
                <span>
                  Ask them to send you a new payment link — they can send it by SMS to this phone.
                </span>
              </li>
            </ol>
          </div>

          {/*
            Deliberately no "Try again". The token is finished; a retry button would
            read as "the page is flaky" and send a parent round the same loop.
          */}
          <Link
            to="/"
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0A5C36] px-5 text-[15px] font-bold text-white"
          >
            Back to SukuuPay
          </Link>
        </div>

        <p className="mt-6 text-center text-[13px] leading-relaxed text-slate-500">
          Your child&rsquo;s records are not affected — only this link has stopped working.
        </p>
      </div>

      <footer className="pb-8 text-center">
        <p className="text-[12px] font-medium text-slate-400">Sukuu Sika Mu Nti</p>
      </footer>
    </div>
  );
};

export default InvalidLink;