import { Outlet } from 'react-router-dom';
import ScrollToTop from '../components/layout/ScrollToTop';
import TeacherTopBar from '../components/teacher/TeacherTopBar';
import TeacherSidebar from '../components/teacher/TeacherSidebar';
import TeacherBottomNav from '../components/teacher/TeacherBottomNav';

/**
 * The teacher portal's shell.
 *
 * A sibling of `DashboardLayout` and `ParentLayout`, not a branch of either: a
 * teacher is authenticated by JWT and needs a rail, a top bar and a bottom bar,
 * while the marketing chrome around the public site is of no use to them. The
 * structure is copied from those two deliberately — the same two-column grid,
 * the same `pb-28` that clears the fixed bottom bar on mobile and drops away at
 * `lg` — so the three consoles read as siblings of one product.
 *
 * The shell owns no data. `TeacherSidebar` reads the identity from
 * `AuthContext`, every page reads its own queries through its own hook, and
 * this component only decides where they are laid out. That is what keeps a
 * route change to a client-side transition with no re-fetch on the 3G
 * connection a teacher in a classroom is on.
 */
const TeacherLayout = () => (
  <div className="min-h-dvh bg-[#F7F9F8]">
    {/* Renders null; outside the grid so it never becomes a cell. */}
    <ScrollToTop />

    <div className="lg:grid lg:grid-cols-[240px_1fr]">
      <TeacherSidebar />
      <div className="flex min-h-dvh flex-col">
        <TeacherTopBar />
        <main className="flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    <TeacherBottomNav />
  </div>
);

export default TeacherLayout;
