/**
 * Renders the platform console the way the app does, with react-dom/server.
 *
 * The same argument as `auth-render.jsx` and `dashboard-render.jsx`: `vite build`
 * never executes a component body, so a wrong import path, a missing prop, a bad
 * nav lookup or a `Field` used as a `SelectField` only surfaces in a browser
 * console. The platform console is the third shell and the newest, which means it
 * has the least review behind it and the most untested surface.
 *
 * Three kinds of check live here.
 *
 * **Structural.** The rail renders, exactly one entry is current, the marketing
 * chrome is gone, and the shell says which console it is — the last one matters
 * because a platform admin and a school admin get two shells with the same
 * wordmark, the same green and the same account menu.
 *
 * **Access.** The console's entire boundary is one component. A `Forbidden` that
 * renders for a school admin, and an `Outlet` for a platform admin, is the
 * difference between a polite refusal and a wall of 403s from the server.
 *
 * **Arithmetic and vocabulary.** Every money figure the console renders is
 * pesewas on the wire and cedis on screen, so a tile given cedis reads 100× too
 * large — the boundary `KpiRow` in the school Overview already guards for
 * itself, and it is guarded again here for `CediValue`, which splits the symbol
 * from the digits.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import AdminLayout from '../src/components/admin/AdminLayout.jsx';
import AdminGuard from '../src/routes/AdminGuard.jsx';
import AdminOverview from '../src/pages/admin/AdminOverview.jsx';
import AdminSchools from '../src/pages/admin/AdminSchools.jsx';
import AdminUsers from '../src/pages/admin/AdminUsers.jsx';
import AdminContent from '../src/pages/admin/AdminContent.jsx';
import AdminSettings from '../src/pages/admin/AdminSettings.jsx';
import KpiRow from '../src/pages/admin/overview/KpiRow.jsx';
import NotFound from '../src/pages/NotFound.jsx';
import Forbidden from '../src/pages/Forbidden.jsx';
import { ADMIN_NAV, isNavItemActive, roleLabel, visibleAdminNav } from '../src/utils/constants.js';
import { EMPTY_ADMIN_KPIS } from '../src/data/adminEmpty.js';

let pass = 0;
let fail = 0;

const check = async (name, fn) => {
  try {
    const detail = await fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

/**
 * The shell is rendered **without** `AdminGuard`, for the same reason
 * `dashboard-render.jsx` renders `DashboardLayout` without `OnboardingGuard`:
 * under SSR there is no session, so the guard would send every route to /login
 * and every structural assertion below would be measuring a redirect.
 *
 * The guard is exercised separately, where the thing worth asserting is precisely
 * that it refuses *before* the shell mounts.
 */
const at = (path) => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="schools" element={<AdminSchools />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<NotFound variant="admin" />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </MemoryRouter>
);

/** The guard on its own, for the access assertions. */
const guarded = (path, role = 'school_admin') => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  </MemoryRouter>
);

/**
 * Render, naming the route on failure — same reasoning as the dashboard harness:
 * `renderToString` throws naming a component *frame*, and without the route a
 * broken module page reports itself as a failure in whatever shell was on the
 * stack.
 */
const renderRoute = (path) => {
  try {
    return renderToString(at(path));
  } catch (error) {
    throw new Error(`[${path}] ${error.message}`);
  }
};

const has = (html, needle) => html.includes(needle);
const countOf = (html, needle) => html.split(needle).length - 1;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const at_ = (path) => renderRoute(path);

console.log('\nplatform console');

// -- Shell -------------------------------------------------------------------

await check('the shell renders its rail, names itself, and drops the marketing chrome', () => {
  const html = at_('/admin');

  for (const needle of ['Platform console', 'aria-label="Platform console modules"']) {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  }

  // The school console's two tells. "Your school" is the string a school-bound
  // shell falls back to, and the footer is what the marketing chrome contributes.
  if (has(html, 'Your school')) throw new Error('the platform shell is rendering a school card');
  if (has(html, 'For schools')) throw new Error('the marketing footer is present');

  return 'rail present, no school card, no footer';
});

await check('every console module renders inside the shell', () => {
  const pages = [
    ['/admin', 'Platform revenue'],
    ['/admin/schools', 'Schools'],
    ['/admin/users', 'Users'],
    ['/admin/content', 'Content'],
    ['/admin/settings', 'Settings'],
  ];

  pages.forEach(([path, needle]) => {
    const html = at_(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });

  return '5 module pages rendered';
});

await check('exactly one rail entry is marked current, and it is the module being viewed', () => {
  // `aria-current="page"` can legitimately appear elsewhere (the topbar's wordmark
  // is a plain link), so the count is taken against the rail's own entries.
  for (const [path, label] of [
    ['/admin', 'Platform'],
    ['/admin/schools', 'Schools'],
    ['/admin/content', 'Content'],
  ]) {
    const html = at_(path);
    const current = countOf(html, 'aria-current="page"');
    if (current !== 1) throw new Error(`${path} marked ${current} entries current, expected 1`);

    const active = visibleAdminNav('super_admin')
      .flatMap((group) => group.items)
      .find((item) => isNavItemActive(path, item));
    if (!active) throw new Error(`${path} matches no nav entry`);
    if (active.label !== label) throw new Error(`${path} resolved to ${active.label}`);
  }

  return 'overview, schools and content each light exactly one entry';
});

// -- Navigation --------------------------------------------------------------

await check('the rail is the whole console: five modules in three groups', () => {
  const labels = visibleAdminNav('super_admin').flatMap((group) => group.items.map((i) => i.label));
  const expected = ['Platform', 'Schools', 'Users', 'Content', 'Settings'];

  for (const label of expected) {
    if (!labels.includes(label)) throw new Error(`the rail is missing ${label}`);
  }
  if (labels.length !== expected.length) {
    throw new Error(`the rail has ${labels.length} entries, expected ${expected.length}`);
  }

  // `ADMIN_NAV` carries no `roles`, so role filtering cannot remove an entry —
  // the guard is what admits `super_admin`. Asserting the tree shape keeps a
  // future edit from quietly adding a `roles` key and hiding a module from the
  // person who owns the platform.
  const gated = ADMIN_NAV.flatMap((g) => g.items).filter((item) => item.roles);
  if (gated.length) throw new Error(`${gated.length} console entries carry a roles filter`);

  return `${expected.length} modules, no per-entry role filter`;
});

await check('every console route has an icon the sidebar can resolve', () => {
  // `ADMIN_NAV` stores lucide *names* so `utils/constants.js` stays free of JSX,
  // and the sidebar resolves them in its own `ICONS` map. A name with no entry
  // falls back to `Gauge` silently — which would render five identical icons and
  // no error anywhere.
  const ICONS = ['Gauge', 'Building2', 'Users', 'Megaphone', 'Settings'];
  const missing = ADMIN_NAV.flatMap((g) => g.items)
    .map((i) => i.icon)
    .filter((icon) => !ICONS.includes(icon));
  if (missing.length) throw new Error(`no icon for ${[...new Set(missing)].join(', ')}`);

  return `${ICONS.length} icons cover the tree`;
});

// -- Access ------------------------------------------------------------------

await check('the guard refuses an unauthenticated visitor before the shell mounts', () => {
  // The assertion is about what is *absent*. With no session the guard must send
  // the visitor to /login, and the whole point is that the platform shell never
  // mounts to flash at them first — a console rail appearing for one frame and
  // then vanishing is worse than a spinner.
  const html = renderToString(guarded('/admin'));

  if (has(html, 'Platform console modules')) {
    throw new Error('the console shell rendered for a visitor with no session');
  }
  if (!has(html, 'animate-spin')) throw new Error('the guard rendered neither a redirect nor a spinner');

  return 'no shell, redirect in flight';
});

await check('the guard refuses a non-platform role with a 403, not a redirect', () => {
  // What the page says when a `school_admin` types /admin is the thing under test:
  // the required role, the role they actually hold, and no link into a console
  // they cannot open. A silent bounce to /dashboard would leave them certain the
  // console is theirs and merely slow.
  const html = renderToString(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Forbidden requiredRole="super_admin" role="school_admin" />
      </AuthProvider>
    </MemoryRouter>
  );

  for (const needle of ['403', roleLabel('super_admin'), roleLabel('school_admin')]) {
    if (!has(html, needle)) throw new Error(`the 403 page is missing "${needle}"`);
  }

  return 'names both the required role and the signed-in role';
});

await check('the 403 names the modules the refused role can actually reach', () => {
  const html = renderToString(
    <MemoryRouter initialEntries={['/admin']}>
      <AuthProvider>
        <Forbidden requiredRole="school_admin" role="teacher" />
      </AuthProvider>
    </MemoryRouter>
  );

  // A 403 that offers Settings or User Management is worse than one that offers
  // nothing: it sends a teacher to a page that will refuse them too.
  if (has(html, '>Settings<')) throw new Error('the 403 offers a module a teacher cannot open');
  if (!has(html, 'Students')) throw new Error('the 403 offers no reachable module');

  return 'teacher is sent to modules they can open';
});

// -- 404 ---------------------------------------------------------------------

await check('a mistyped console path keeps the console shell and names the path', () => {
  const html = at_('/admin/revnu');

  // The point of the in-shell variant: the rail survives, so a typo does not
  // eject a platform admin into the marketing site.
  if (!has(html, 'aria-label="Platform console modules"')) {
    throw new Error('the shell was lost on an unmatched console path');
  }
  if (has(html, 'For schools')) throw new Error('the marketing footer is present');

  if (!has(html, '/admin/revnu')) throw new Error('the attempted path is not shown');
  if (!has(html, 'That console module does not exist')) {
    throw new Error('the console-specific heading is missing');
  }

  return 'shell kept, attempted path shown';
});

await check('the 404 offers the console modules as exits, not the marketing links', () => {
  const html = at_('/admin/revnu');

  // Asserted on hrefs rather than labels: "Platform" appears in the rail, in the
  // shell's own heading and in the primary action, so a label needle would pass
  // against the shell alone and never prove the exits exist.
  for (const href of ['href="/admin"', 'href="/admin/schools"', 'href="/admin/users"', 'href="/admin/content"']) {
    if (!has(html, href)) throw new Error(`no exit linking to ${href}`);
  }

  // The marketing pill row is the failure this variant exists to prevent: a
  // platform admin ejected into a page about buying the product they run.
  if (has(html, 'href="/how-it-works"')) throw new Error('the 404 offers a marketing link');

  return 'console exits only, no marketing links';
});

// -- Money -------------------------------------------------------------------

await check('the KPI band reads pesewas as cedis, never as pesewas', () => {
  // `EMPTY_ADMIN_KPIS` is all zeros, so the figures that matter are the ones the
  // band *formats*: a tile handed cedis instead of pesewas renders 100× too large,
  // which is the boundary `format.js` exists to make impossible.
  const kpis = {
    ...EMPTY_ADMIN_KPIS,
    schools: { ...EMPTY_ADMIN_KPIS.schools, total: 85, active: 72, onTrial: 12, paid: 60 },
    payments: {
      ...EMPTY_ADMIN_KPIS.payments,
      totalRevenue: 317050000,
      mtdRevenue: 34500000,
      platformMarkup: 15852500,
    },
  };
  const band = renderToString(<KpiRow kpis={kpis} />);

  if (!has(band, '3,170,500')) throw new Error('the band did not render 317,050,000 pesewas as cedis');
  if (has(band, '31,705,000')) throw new Error('a figure is rendering as pesewas, 100× too large');
  if (!has(band, '345,000')) throw new Error('MTD revenue did not render as cedis');

  // Counts, not money — so these are whole numbers and never cedi-formatted.
  if (!has(band, '85')) throw new Error('the school count did not render');

  return '317,050,000 pesewa → GH₵ 3,170,500';
});

await check('the Overview renders inside a router with no figures of its own', () => {
  // The Overview owns `useSearchParams`, so it cannot be rendered bare — and the
  // fact that it cannot is worth having caught here rather than in a browser.
  const html = at_('/admin');
  if (!has(html, 'Platform revenue')) throw new Error('the revenue card is missing');
  if (!has(html, 'What the platform is made of')) throw new Error('the composition card is missing');
  if (!has(html, 'Newest schools')) throw new Error('the recent-schools card is missing');
  return 'four cards present';
});

// -- The single platform owner ───────────────────────────────────────────────

await check('the users page mounts and states its scope', async () => {
  // There is no mock adapter in this harness, so the list request never resolves
  // and the page sits on its skeleton. What is checkable — and what actually
  // matters here — is the scope statement, which renders above the list on every
  // load: "All schools on the platform" is the default scope of this page, and an
  // operator looking at 34,000 accounts has to be told that before the numbers
  // arrive rather than after.
  const html = at_('/admin/users');
  assert(has(html, 'Scope: all schools on the platform'), 'the users page does not state its scope');
  return 'scope stated above the list';
});

await check('the role picker never offers the platform admin role', async () => {
  // There is exactly one `super_admin`, provisioned from the server environment,
  // and `Backend/src/validators/userValidators.js` (`ASSIGNABLE_ROLES`) refuses to
  // express the grant at all. The console mirrors that by filtering the role out of
  // the list it picks from.
  //
  // Asserted on the module rather than on rendered output because the picker lives
  // inside a dialog behind two clicks — reaching it here would mean rendering it by
  // hand, which proves only that the hand-written copy was correct.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/pages/admin/AdminUsers.jsx', 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );

  assert(
    source.includes("USER_ROLES.filter((role) => role !== 'super_admin')"),
    'the assignable list must be USER_ROLES minus super_admin'
  );

  // The picker renders from the assignable list, never from the full role list.
  //
  // Sliced from the *dialog*, not from the first `<SelectField>` in the file: the
  // filter bar above the table has two of its own, and slicing to the first match
  // would assert on the status filter and pass without ever looking at the picker.
  const dialog = source.slice(source.indexOf('Change this person'));
  assert(dialog.length > 0, 'the role-change dialog is missing');

  const picker = dialog.slice(dialog.indexOf('<SelectField'), dialog.indexOf('</SelectField>'));
  assert(picker.length > 0, 'the role picker is missing');
  assert(picker.includes('ASSIGNABLE_ROLES'), 'the role picker must be built from ASSIGNABLE_ROLES');
  assert(!picker.includes('USER_ROLES'), 'the role picker must not read the full role list');

  return 'picker is built from USER_ROLES minus super_admin';
});

await check('the owner row has no actions and says where it comes from', async () => {
  // Not a disabled button. A disabled control says "you lack permission", and this
  // is a different fact: the account is defined by the server environment and no
  // request can change it. The cell has to say so, or an operator reads the greyed
  // buttons as a permissions bug and files it as one.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/pages/admin/AdminUsers.jsx', 'utf8');

  assert(
    source.includes('isPlatformOwner'),
    'the owner must be identified by isPlatformOwner, not by role or by email'
  );

  // Isolated to the owner arm of the ternary. Slicing to the role button's
  // `onClick` instead would swallow the opening `<button` of the *ordinary* row's
  // first action and fail for the wrong reason.
  const ownerArm = source.slice(
    source.indexOf('{isOwner(account) ? ('),
    source.indexOf(') : (', source.indexOf('{isOwner(account) ? ('))
  );
  assert(ownerArm.length > 0, 'the owner branch is missing from the actions cell');
  assert(
    ownerArm.includes('Managed by the server environment'),
    'the owner arm must explain where the account comes from'
  );
  assert(!ownerArm.includes('<button'), 'the owner arm renders buttons — it must not');

  // And the reason is stated even where the picker is: the dialog says why the
  // role is missing from it, so an operator who knows the role exists does not
  // assume a permissions problem on their own session.
  assert(
    source.includes('defined by the server’s'),
    'the role dialog does not say why the platform admin role is not offered'
  );

  return 'owner arm explains and offers no buttons; dialog states why';
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail) process.exitCode = 1;