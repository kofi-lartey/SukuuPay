import { createContext, useContext } from 'react';
import { Outlet, Link, Navigate, useParams } from 'react-router-dom';
import { usePayToken, useOnlineStatus } from '../hooks/usePayToken';
import { PARENT_ROUTES } from '../utils/constants';

/**
 * The parent portal's shell.
 *
 * Deliberately **not** the app shell. No sidebar, no user menu, no notifications
 * bell, no dashboard chrome — the parent who opens this link has no account and
 * wants one thing. Every element of the authenticated shell would be a dead end
 * and a reason for the browser's back button to leave the one page they can use.
 *
 * ## Why the read model lives here
 *
 * `usePayToken` is mounted once at this level and handed down through context,
 * because a parent moves between the landing page, the plan request, the history
 * and the support form, and each of those would otherwise re-fetch the student. On
 * a 3G connection that is a blank frame between every tap — the difference between
 * a site that feels native and one that feels like a form to fill in.
 *
 * ## Why there is no footer navigation
 *
 * The screenshots in the brief show a four-item bottom bar (Fees, Schedule,
 * Receipts, Wards). That is a navigation for someone who lives in the app — someone
 * who logs in, who has several children, who comes back weekly. It is the wrong
 * shape for a parent who arrived from an SMS with a task and a token, and it is the
 * shape that implies a login is coming. The portal's own navigation is text links
 * inside the single scroll, where they are read in the order they matter and are
 * invisible to someone who only wants to pay.
 */

/**
 * The shared read model.
 *
 * Exported as well as `useParentPay`, so a render check can supply a fixture
 * without standing up `ParentLayout` and a live `/pay/:token` request. The hook is
 * what application code should use; this is for tests.
 */
export const ParentPayContext = createContext(null);

/** The shared read model. Must be used inside `ParentLayout`. */
export const useParentPay = () => {
  const context = useContext(ParentPayContext);
  if (!context) {
    throw new Error('useParentPay must be used within a ParentLayout');
  }
  return context;
};

/**
 * The first paint, before any data exists.
 *
 * Shaped like the real page rather than a centred spinner. A parent on a slow
 * connection is looking at this for several seconds, and the silhouette of the page
 * they are about to see — photo, then a big figure, then a row of stats — means the
 * content that replaces it lands where they were already looking. A spinner in the
 * middle of an empty screen makes every arrival feel like a different page.
 */
const ShellSkeleton = () => (
  <div className="min-h-dvh bg-[#F6F8F7]">
    <div className="mx-auto max-w-md px-4 pb-32 pt-5">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-slate-200" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-5 h-32 animate-pulse rounded-2xl bg-white" />
      <div className="mt-3 h-14 animate-pulse rounded-2xl bg-white" />
      <div className="mt-3 h-64 animate-pulse rounded-2xl bg-white" />
    </div>
    {/* Stops the layout jumping when the real footer arrives. */}
    <div className="h-24" />
  </div>
);

/**
 * The offline banner.
 *
 * Says so plainly, and says what it means for the page. "You are offline" on its
 * own leaves a parent on a prepaid bundle refreshing a button that will not work;
 * naming the consequence is what stops them burning their data.
 */
const OfflineBanner = () => (
  <div
    role="status"
    className="sticky top-0 z-40 flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-900 ring-1 ring-inset ring-amber-200"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 2l20 20M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 013.5-2.4M1.4 9.2a15 15 0 015-3.2M22.6 9.2a15 15 0 00-9.9-3.7" strokeLinecap="round" />
    </svg>
    <span>You&rsquo;re offline. Payments need internet — your balance below is the last one loaded.</span>
  </div>
);

/** The footer: what this is, who built it, and how to reach a human. */
const PortalFooter = ({ school }) => (
  <footer className="mt-8 border-t border-slate-200/80 px-4 pb-28 pt-6 text-center sm:pb-10">
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-[15px] font-extrabold tracking-tight text-[#0A5C36]">
        Suku<span className="text-amber-500">u</span>Pay
      </span>
    </div>
    <p className="mt-1 text-[12px] font-medium text-slate-500">Sukuu Sika Mu Nti</p>

    {school?.phone ? (
      <p className="mt-3 text-[13px] text-slate-600">
        Questions?{' '}
        <a
          href={`tel:${school.phone}`}
          className="font-bold text-[#0A5C36] underline underline-offset-2"
        >
          {school.phone}
        </a>
      </p>
    ) : null}

    <div className="mt-4 flex items-center justify-center gap-3 text-[12px] text-slate-500">
      <Link to="/privacy" className="underline underline-offset-2 hover:text-slate-700">
        Privacy
      </Link>
      <span aria-hidden="true" className="text-slate-300">
        &middot;
      </span>
      <Link to="/terms" className="underline underline-offset-2 hover:text-slate-700">
        Terms
      </Link>
    </div>

    <p className="mx-auto mt-4 max-w-xs text-[11px] leading-relaxed text-slate-400">
      Payments are processed through Ghana Interbank Payment &amp; Settlement Systems.
      A receipt is issued for every settled payment.
    </p>
  </footer>
);

/**
 * `ParentLayout` — the frame every parent page renders inside.
 *
 * Owns three things the pages should not each re-decide: the read model, the
 * offline state, and the fact that a dead token has its own page rather than a
 * generic 404.
 */
const ParentLayout = () => {
  const { token } = useParams();
  const { view, error, loading, refresh } = usePayToken(token);
  const online = useOnlineStatus();

  // A token the server refused is not an error state of this page — it is a
  // different page. Rendering "InvalidLink" from here means the four sub-routes
  // (history, plan, support) each get the right answer for free, instead of
  // three of them rendering a broken history list against a token that was never
  // valid in the first place.
  if (error && error.status === 404) {
    return <NavigateToInvalid reason={error} />;
  }

  if (loading && !view) return <ShellSkeleton />;

  if (error && !view) {
    return (
      <div className="min-h-dvh bg-[#F6F8F7] px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-extrabold text-slate-900">We could not load this page</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{error.message}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-5 min-h-[44px] w-full rounded-xl bg-[#0A5C36] px-4 text-[15px] font-bold text-white"
          >
            Try again
          </button>
          <p className="mt-3 text-[13px] text-slate-500">
            If this keeps happening, please call your school&rsquo;s office.
          </p>
        </div>
      </div>
    );
  }

  const context = {
    token,
    view,
    loading,
    online,
    refresh,
    student: view?.student || null,
    school: view?.school || null,
    plan: view?.paymentPlan || null,
    recentPayments: view?.recentPayments || [],
    suspended: Boolean(view?.suspended),
    canPay: Boolean(view?.canPay),
  };

  return (
    <ParentPayContext.Provider value={context}>
      <div className="min-h-dvh bg-[#F6F8F7] pb-2">
        {!online ? <OfflineBanner /> : null}
        <Outlet />
        <PortalFooter school={view?.school} />
      </div>
    </ParentPayContext.Provider>
  );
};

/**
 * Sends a refused token to the dedicated invalid-link page.
 *
 * A separate component because `Navigate` needs a stable position in the tree, and
 * because the message has to travel through router state — the alternative,
 * rendering `InvalidLink` inline here, would nest its heading inside this layout's
 * error chrome and leave a parent on `/pay/…/history` looking at a page whose
 * breadcrumbs make no sense.
 */
const NavigateToInvalid = ({ reason }) => (
  <Navigate
    to={PARENT_ROUTES.INVALID}
    replace
    state={{ message: reason?.message, status: reason?.status }}
  />
);

export default ParentLayout;