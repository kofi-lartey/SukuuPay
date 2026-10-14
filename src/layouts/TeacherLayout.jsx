import React from 'react';
import { Outlet } from 'react-router-dom';
import ScrollToTop from '../components/layout/ScrollToTop';
import TeacherSidebar from '../components/teacher/TeacherSidebar';
import TeacherTopBar from '../components/teacher/TeacherTopBar';
import TeacherBottomNav from '../components/teacher/TeacherBottomNav';
import { useAuth } from '../context/AuthContext';

/**
 * The teacher shell: a rail on the desktop, a top bar and a bottom bar on the
 * phone.
 *
 * ## Layout
 *
 *   ┌────────────────────────────┐
 *   │ rail │      top bar        │
 *   │      ├─────────────────────┤
 *   │      │      main           │
 *   │      │  (max-w-[1200px])   │
 *   └────────────────────────────┘
 *              bottom bar (mobile)
 *
 * A fixed rail with its own scroll at `lg`, and one column below it. Both
 * surfaces render at every width — `hidden lg:flex` on the rail, `lg:hidden` on
 * the bars — so a resize moves a teacher between them without unmounting
 * either, and the navigation's active state is always the router's rather than
 * a snapshot kept by one component.
 *
 * ## Column widths, and why they moved
 *
 * The rail is `lg:w-[248px]` and the column `lg:grid-cols-[248px_1fr]`. Eight
 * destinations, one of which is "Terminal Reports", needed the room: the old
 * 220px column truncated "Terminal Reports" to "Terminal Rep…" on the
 * 1366×768 laptops a school office actually has, and a truncated label is a
 * navigation that has to be guessed at. The rail's own grid uses the literal
 * `248px` in both declarations so they cannot drift apart — Tailwind cannot
 * read an arbitrary value from a variable, so this is the honest version.
 *
 * ## The bottom bar
 *
 * `TeacherBottomNav` is fixed, so the content column carries `pb-20` to clear it
 * below `lg` and none above it, where the bar is `lg:hidden` — the same padding
 * `DashboardLayout` and `ParentLayout` use, so a page built for one console
 * works unchanged in another.
 */
const TeacherLayout = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#F7F9F8]">
      {/*
        Scroll restoration on navigation, not on mount: it belongs to the shell
        for the same reason it belongs to the other two consoles, and dropping it
        here would send a teacher from the bottom of a thirty-name register to the
        top of a blank column when they tap a student.
      */}
      <ScrollToTop />

      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <TeacherSidebar className="hidden lg:flex" />

        <div className="flex min-h-screen min-w-0 flex-col">
          <TeacherTopBar />

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 pb-20 sm:px-6 lg:px-8 lg:pb-8">
            {/*
              No role check here, deliberately. `TeacherGuard` decides who gets
              into `/teacher` at all, and this layout is mounted *inside* that
              route — so a non-teacher never reaches this component, which means
              the shell never has to defend itself. The one thing this reads from
              the session, `user`, is only used to address the person in the top
              bar.
            */}
            <Outlet context={{ user }} />
          </main>
        </div>
      </div>

      <TeacherBottomNav />
    </div>
  );
};

export default TeacherLayout;
