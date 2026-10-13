import { createContext, useContext, useMemo } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useParentPortal } from '../hooks/parent/useParentPortal';
import { ParentTopBar, BottomNav } from '../components/parent/portal/ParentTopBar';
import ParentSidebar from '../components/parent/portal/ParentSidebar';
import ScrollToTop from '../components/layout/ScrollToTop';

const ParentPayContext = createContext(null);

export const useParentPay = () => {
  const ctx = useContext(ParentPayContext);
  if (!ctx) throw new Error('useParentPay must be used inside ParentLayout');
  return ctx;
};

/**
 * The first paint, before the portal payload lands.
 *
 * Shaped like the page rather than a centred spinner: a parent on a slow
 * connection is looking at this for several seconds, and the silhouette of
 * what is coming — rail, title, one tall card — means the content that
 * replaces it lands where they were already looking.
 */
const ShellSkeleton = () => (
  <div className="min-h-dvh bg-[#F7F9F8]">
    <div className="lg:grid lg:grid-cols-[260px_1fr]">
      <div className="hidden min-h-dvh border-r border-slate-200/80 bg-white lg:block" />
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-4 h-14 w-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-5 h-36 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-3 h-14 animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-3 h-52 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
    {/* Stops the layout jumping when the real bottom bar's padding arrives. */}
    <div className="h-24" />
  </div>
);

const ParentLayout = () => {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useParentPortal(token);

  const value = useMemo(
    () => ({
      token,
      student: data?.student || null,
      school: data?.school || null,
      unreadCount: data?.unreadCount || 0,
      // The portal payload's own extras, carried through for the Home page so
      // it does not have to re-fetch what the layout already holds. Additive
      // to the pages' contract: every page reads `student`, `school` and the
      // counters, and Home reads these two as well.
      recentPayments: data?.recentPayments || [],
      paymentPlan: data?.paymentPlan || null,
      loading: isLoading,
      error,
      refresh: refetch,
    }),
    [token, data, isLoading, error, refetch]
  );

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-[16px] font-extrabold text-slate-900">
            This link is not valid
          </h1>
          <p className="mt-2 text-[13px] text-slate-500">
            {error.message ||
              'Ask the school for a fresh payment link and try again.'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !data) {
    return <ShellSkeleton />;
  }

  return (
    <ParentPayContext.Provider value={value}>
      <div className="min-h-dvh bg-[#F7F9F8]">
        {/* Renders null; outside the grid so it never becomes a cell. */}
        <ScrollToTop />

        <div className="lg:grid lg:grid-cols-[260px_1fr]">
          <ParentSidebar />

          <div className="flex min-h-dvh flex-col">
            <ParentTopBar student={value.student} unread={value.unreadCount} />
            {/* `pb-28` clears the fixed bottom bar on mobile; the rail takes
                over at `lg`, where the bar hides itself. */}
            <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
              <div className="mx-auto w-full max-w-5xl">
                <Outlet context={value} />
              </div>
            </main>
          </div>
        </div>
        <BottomNav />
      </div>
    </ParentPayContext.Provider>
  );
};

export default ParentLayout;
