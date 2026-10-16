import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * The teacher shell speaks the school console's design language.
 *
 * This test exists because the shell did not, and nothing caught it. The
 * teacher portal was built as a parallel design rather than a sibling of the
 * console: its own background (`#F7F9F8`), its own rail width (`248px`), its own
 * content width (`1200px`), its own row metrics (`min-h-[44px]`, `text-[13.5px]`,
 * `h-[19px]` icons), and Tailwind's built-in `sky` palette — which appears
 * nowhere else in SukuuPay. A teacher who also holds a school-admin account
 * crossed between two apps that looked like two companies.
 *
 * The assertions below read the source, because the thing being asserted is a
 * *set of class strings* shared between two files. A screenshot test would not
 * fail on `248px` vs `15.25rem`; a unit test of a component cannot see the
 * shell. Reading the tokens is what makes a drift fail on the next commit.
 *
 * Scope: the shell — `layouts/TeacherLayout.jsx`,
 * `components/teacher/{TeacherSidebar,TeacherTopBar,TeacherBottomNav}.jsx`, and
 * the identity card inside the rail. Page-level accents in the eleven teacher
 * *pages* are a separate, deliberate follow-up and are not asserted here.
 */
const SHELL_FILES = [
  '../layouts/TeacherLayout.jsx',
  '../components/teacher/TeacherSidebar.jsx',
  '../components/teacher/TeacherTopBar.jsx',
  '../components/teacher/TeacherBottomNav.jsx',
];

const readShell = async (relative) => {
  const source = await readFile(new URL(`${relative}`, import.meta.url), 'utf8');
  return codeOnly(source);
};

/**
 * The source with its comments removed.
 *
 * Necessary, because this file's whole subject is a set of class strings, and the
 * comments in the shell explain the *old* design by naming it — `sky-600`,
 * `#F7F9F8`, `248px`. A regex over raw source therefore matches the
 * documentation of the thing it is checking for, which is a test that fails for
 * having been written well. Stripping first means the assertion sees what the
 * browser will render and nothing else.
 *
 * Not a parser: it handles line comments and block comments, which is the only
 * form this codebase uses. A comment marker inside a string literal would be
 * mangled — and there are none in these four files.
 */
const codeOnly = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

const readConsole = async () => {
  const source = await readFile(new URL('../components/dashboard/DashboardSidebar.jsx', import.meta.url), 'utf8');
  return codeOnly(source);
};

describe('the teacher shell uses the product palette', () => {
  it('contains no sky accents — the palette nothing else uses', async () => {
    for (const file of SHELL_FILES) {
      const source = await readShell(file);
      assert.ok(
        !/sky-\d/.test(source),
        `${file} still uses the sky palette, which appears nowhere else in the product`
      );
    }
  });

  it('uses brand-700 for every accent the console uses', async () => {
    const sidebars = await Promise.all([readShell('../components/teacher/TeacherSidebar.jsx'), readConsole()]);
    const [teacher, console_] = sidebars;

    assert.ok(teacher.includes('bg-brand-700'), 'the teacher rail has no brand fill');
    assert.ok(teacher.includes('text-brand-700'), 'the teacher wordmark is not brand-coloured');
    // The token must exist in both, or the two are not the same language.
    assert.ok(console_.includes('bg-brand-700'), 'the console rail changed under this test');
  });
});

describe('the teacher shell matches the console dimensions', () => {
  it('uses the 15.25rem rail column and max-w-7xl content', async () => {
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(
      layout.includes('lg:grid-cols-[15.25rem_minmax(0,1fr)]'),
      'the rail column drifted from the console width'
    );
    assert.ok(layout.includes('max-w-7xl'), 'the content column drifted from the console width');
  });

  it('keeps the mobile bottom-bar clear as its only padding delta', async () => {
    // The console's main is `px-4 pb-8 pt-6 sm:px-6 lg:px-8`. The teacher shell
    // is the same with `pb-20` below `lg` for the fixed bottom bar — the one
    // delta that is a real difference between the two portals.
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(layout.includes('px-4'), 'the horizontal padding drifted');
    assert.ok(layout.includes('pt-6'), 'the top padding drifted');
    assert.ok(layout.includes('lg:pb-8'), 'the desktop bottom padding drifted');
    assert.ok(layout.includes('pb-20'), 'the mobile bottom-bar clearance was lost');
  });

  it('uses bg-slate-50 for the shell, not a bespoke tint', async () => {
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(layout.includes('bg-slate-50'), 'the shell background drifted');
    assert.ok(!/#F7F9F8/i.test(layout), 'the bespoke background came back');
  });
});

describe('the teacher rail renders the same row as the console rail', () => {
  it('shares the nav-row class string', async () => {
    const [teacher, console_] = await Promise.all([
      readShell('../components/teacher/TeacherSidebar.jsx'),
      readConsole(),
    ]);

    // The exact substring `DashboardSidebar` uses for every nav link. If either
    // file's row changes without the other, this fails.
    const row = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold';
    assert.ok(teacher.includes(row), 'the teacher nav row no longer matches the console');
    assert.ok(console_.includes(row), 'the console nav row changed shape');

    for (const token of ['h-[18px] w-[18px]', 'focus-visible:ring-brand-700/40', 'shadow-lift']) {
      assert.ok(teacher.includes(token), `the teacher row lost ${token}`);
    }
  });

  it('shares the brand-row height and border', async () => {
    const [teacher, console_] = await Promise.all([
      readShell('../components/teacher/TeacherSidebar.jsx'),
      readConsole(),
    ]);
    for (const token of ['h-16 shrink-0', 'border-b border-slate-100']) {
      assert.ok(teacher.includes(token), `the teacher brand row lost ${token}`);
      assert.ok(console_.includes(token), `the console brand row lost ${token}`);
    }
  });

  it('shares the bottom-block border and the filled identity card', async () => {
    const [teacher, console_] = await Promise.all([
      readShell('../components/teacher/TeacherSidebar.jsx'),
      readConsole(),
    ]);
    assert.ok(teacher.includes('shrink-0 border-t border-slate-100 p-3'), 'the teacher bottom block drifted');
    assert.ok(console_.includes('shrink-0 border-t border-slate-100 p-3'), 'the console bottom block drifted');
    assert.ok(teacher.includes('rounded-xl bg-brand-700 p-3 text-white'), 'the identity card is no longer a filled brand card');
  });
});

describe('structural parity the console has and the shell used to lack', () => {
  it('has a skip-to-content link whose target is the focusable main', async () => {
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(layout.includes('Skip to content'), 'no skip link — a keyboard user re-tabs the whole rail on every page');
    assert.ok(layout.includes('href="#teacher-main"'), 'the skip link does not point at the main');
    assert.ok(layout.includes('id="teacher-main"'), 'the main is not the skip target');
    assert.ok(layout.includes('tabIndex={-1}'), 'the skip target is not focusable');
  });

  it('wraps the outlet in an error boundary', async () => {
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(layout.includes('ErrorBoundaryResetOnChange'), 'a throw in one module blanks the whole portal');
    assert.ok(layout.includes('routeKey={pathname}'), 'the boundary does not reset on navigation');
  });

  it('reaches the legal documents, as the console does', async () => {
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    assert.ok(layout.includes('LegalLinks'), 'the legal documents are unreachable from the teacher portal');
  });

  it('has a mobile drawer with a backdrop and Escape', async () => {
    // The rail is `hidden lg:flex`. Without a drawer it could never be opened on
    // a phone, so schedule, reports, notifications and sign-out had no way in.
    const layout = await readShell('../layouts/TeacherLayout.jsx');
    const topbar = await readShell('../components/teacher/TeacherTopBar.jsx');

    assert.ok(topbar.includes('Open navigation'), 'no hamburger in the top bar');
    assert.ok(topbar.includes('teacher-nav-drawer'), 'the hamburger does not target a drawer');
    assert.ok(layout.includes('aria-label="Close navigation"'), 'the drawer has no backdrop to dismiss it');
    assert.ok(/event\.key === 'Escape'/.test(layout), 'Escape does not close the drawer');
  });
});

describe('what the refactor had to keep', () => {
  it('keeps the seven teacher destinations in the rail', async () => {
    const sidebar = await readShell('../components/teacher/TeacherSidebar.jsx');
    for (const label of ['Dashboard', 'My Classes', 'Attendance', 'Grades', 'Schedule', 'Terminal Reports', 'Notifications']) {
      assert.ok(sidebar.includes(label), `the rail lost ${label}`);
    }
  });

  it('keeps the identity card, the avatar control and the settings menu', async () => {
    const sidebar = await readShell('../components/teacher/TeacherSidebar.jsx');
    assert.ok(sidebar.includes('AvatarUpload'), 'the avatar upload is gone from the rail');
    assert.ok(sidebar.includes('TEACHER_ROUTES.profile'), 'the identity card no longer links to the profile');
    assert.ok(sidebar.includes('Profile'), 'the settings entry is gone');
    assert.ok(sidebar.includes('Sign out'), 'sign out is gone');
  });

  it('keeps the rail usable as both the fixed column and the drawer', async () => {
    const sidebar = await readShell('../components/teacher/TeacherSidebar.jsx');
    assert.ok(sidebar.includes("variant = 'fixed'"), 'no fixed variant');
    assert.ok(sidebar.includes('isDrawer'), 'no drawer branch');
    assert.ok(sidebar.includes("isDrawer ? 'border-r shadow-2xl' : 'sticky top-0 h-screen border-r'"), 'the two variants diverged');
  });
});
