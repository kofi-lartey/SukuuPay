/**
 * Renders the dashboard shell and the Overview the way the app does, with
 * react-dom/server.
 *
 * `vite build` passed before this existed, and could not have caught a mistake
 * in it: the build never executes a component body, so a wrong import path, a
 * missing prop or a bad nav lookup only surfaces in a browser console. This is
 * the same argument as `auth-render.jsx`, applied to the shell.
 *
 * Two kinds of check live here. The first is structural — the rail renders, one
 * entry is current, the marketing chrome is gone. The second is arithmetic: the
 * demo fixture claims to be internally consistent, and that claim is worth
 * enforcing, because a reviewer *will* add the numbers up and a fixture that
 * does not balance trains people to stop trusting the rest of the page.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import DashboardLayout from '../src/components/dashboard/DashboardLayout.jsx';
import Overview from '../src/pages/dashboard/Overview.jsx';
import Students from '../src/pages/dashboard/Students.jsx';
import Payments from '../src/pages/dashboard/Payments.jsx';
import InstallmentPlans from '../src/pages/dashboard/InstallmentPlans.jsx';
import SmsReminders from '../src/pages/dashboard/SmsReminders.jsx';
import Reports from '../src/pages/dashboard/Reports.jsx';
import ActivityLog from '../src/pages/dashboard/ActivityLog.jsx';
import SettingsPage from '../src/pages/dashboard/Settings.jsx';
import RosterKpiRow from '../src/components/students/RosterKpiRow.jsx';
import RosterFilterBar from '../src/components/students/RosterFilterBar.jsx';
import StudentTable from '../src/components/students/StudentTable.jsx';
import { visibleDashboardNav } from '../src/utils/constants.js';
import { DEMO_OVERVIEW, DEMO_WEEKLY_INFLOW, DEMO_CHANNELS } from '../src/data/dashboardDemo.js';
import { formatCediShort, formatCount, formatCediWhole } from '../src/utils/format.js';

let pass = 0;
let fail = 0;

const check = async (name, fn) => {
  try {
    // Awaited: several checks are async (dynamic imports, a filesystem walk)
    // and without this the `try` never sees their rejection, so a failing async
    // check reports as a pass with `[object Promise]` as its detail.
    const detail = await fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

const at = (path) => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="students" element={<Students />} />
            <Route path="payments" element={<Payments />} />
            <Route path="installment-plans" element={<InstallmentPlans />} />
            <Route path="sms-reminders" element={<SmsReminders />} />
            <Route path="reports" element={<Reports />} />
            <Route path="activity-log" element={<ActivityLog />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </MemoryRouter>
);

const render = (path) => renderToString(at(path));

/**
 * Render, naming the route on failure.
 *
 * `renderToString` throws on the first bad element it meets, and its stack names
 * a component *frame* rather than the route — so a broken module page reports
 * itself as a failure in whatever shell or sidebar happened to be on the stack.
 * Naming the route here is the difference between a two-second diagnosis and an
 * afternoon of reading the wrong file.
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

const MODULES = [
  'Dashboard',
  'Students',
  'Payments',
  'Installment Plans',
  'SMS Reminders',
  'Reports',
  'Activity Log',
  'Settings',
];

/**
 * The label of the single nav entry marked current, and how many are marked.
 *
 * Counted *within the rail* only. A module page can legitimately mark its own
 * sub-navigation as current, so a page-wide count reports 2 for a page with one
 * active rail entry — and the check would "fail" on correct markup. Scoping to
 * the rail's own `<nav>` is what makes the assertion mean what it says.
 */
const currentInRail = (html) => {
  const railStart = html.indexOf('aria-label="Dashboard modules"');
  if (railStart === -1) return { count: 0, label: null };

  const railEnd = html.indexOf('</nav>', railStart);
  const rail = railEnd === -1 ? html.slice(railStart) : html.slice(railStart, railEnd);

  const count = countOf(rail, 'aria-current="page"');
  if (count === 0) return { count, label: null };

  // Forward from the attribute, not backward: `aria-current` sits on the anchor
  // and the label is inside it, after an inlined lucide SVG longer than any
  // sane character count.
  const at_ = rail.indexOf('aria-current="page"');
  const close = rail.indexOf('</a>', at_);
  const anchor = rail.slice(at_, close === -1 ? at_ + 4000 : close);
  return { count, label: MODULES.find((label) => anchor.includes(`>${label}<`)) || '(unreadable)' };
};

// ── Shell ───────────────────────────────────────────────────────────────────

await check('the shell mounts at /dashboard', () => {
  const html = renderRoute('/dashboard');
  if (!has(html, 'Skip to content')) throw new Error('no skip link');
  if (!has(html, 'aria-label="Dashboard modules"')) throw new Error('the module rail is missing');
  return 'skip link and rail present';
});

await check('all eight modules are in the rail', () => {
  const html = renderRoute('/dashboard');
  const missing = MODULES.filter((label) => !has(html, `>${label}<`));
  if (missing.length) throw new Error(`missing from the rail: ${missing.join(', ')}`);
  return '8 of 8';
});

await check('the shell replaces the marketing chrome', () => {
  const html = renderRoute('/dashboard');
  // The marketing navbar's own links, not its logo: the shell keeps a logo, so
  // testing for one would fail for the right reason and read as the wrong bug.
  ['How It Works', 'For Schools', 'Get Started Free'].forEach((link) => {
    if (has(html, link)) throw new Error(`the marketing navbar leaked in: "${link}"`);
  });
  if (!has(html, 'Back to website')) throw new Error('no route back to the public site');
  return 'no marketing links, footer escape preserved';
});

await check('the header scopes school, term and search', () => {
  const html = renderRoute('/dashboard');
  ['Prampram Basic', 'Academic Term 1', '2025/2026', 'Search students', 'New Payment'].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the header is missing "${needle}"`);
    }
  );
  return 'school, term, search and New Payment all present';
});

// The regression this file exists for: a `startsWith` match lights up the
// overview on every module, because /dashboard is their common prefix.
await check('exactly one rail entry is marked current, on every route', () => {
  const routes = [
    ['/dashboard', 'Dashboard'],
    ['/dashboard/students', 'Students'],
    ['/dashboard/payments', 'Payments'],
    ['/dashboard/installment-plans', 'Installment Plans'],
    ['/dashboard/sms-reminders', 'SMS Reminders'],
    ['/dashboard/reports', 'Reports'],
    ['/dashboard/activity-log', 'Activity Log'],
    ['/dashboard/settings', 'Settings'],
  ];

  routes.forEach(([path, expected]) => {
    const html = renderRoute(path);
    const { count, label } = currentInRail(html);
    if (count !== 1) throw new Error(`${path} marked ${count} rail entries current, expected 1`);
    if (label !== expected) throw new Error(`${path} marked "${label}" current, expected "${expected}"`);
  });

  return '8 routes, one correct entry each';
});

await check('every module page renders its own content', () => {
  const pages = [
    ['/dashboard', 'Dashboard Overview'],
    ['/dashboard/students', 'Select all students on this page'],
    ['/dashboard/payments', 'Refunds'],
    ['/dashboard/installment-plans', 'Plan timeline'],
    ['/dashboard/sms-reminders', 'No school-facing SMS send endpoint'],
    ['/dashboard/reports', 'Outstanding balances'],
    ['/dashboard/activity-log', 'Read-only by design'],
    ['/dashboard/settings', 'Academic year and term'],
  ];

  pages.forEach(([path, needle]) => {
    const html = renderRoute(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });

  return '8 pages rendered';
});

await check('Settings is hidden from non-admin roles in the rail', () => {
  const teacher = visibleDashboardNav('teacher').flatMap((g) => g.items.map((i) => i.label));
  const admin = visibleDashboardNav('school_admin').flatMap((g) => g.items.map((i) => i.label));
  if (teacher.includes('Settings')) throw new Error('a teacher can see Settings');
  if (!admin.includes('Settings')) throw new Error('a school admin cannot see Settings');
  return 'teacher 7, school admin 8';
});

// ── Overview ────────────────────────────────────────────────────────────────

await check('the Overview renders its headline and KPI band', () => {
  const html = renderRoute('/dashboard');
  [
    'Dashboard Overview',
    'Total Students',
    'Total Expected Owed',
    'Total Collected',
    'Overdue Students',
    'Collection Rate',
    'Immediate Attention',
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  });
  return '4 KPI tiles with their labels';
});

await check('the Overview renders every visualisation region', () => {
  const html = renderRoute('/dashboard');
  [
    'Collections This Term (Weekly)',
    'Payment Channels',
    'Recent MoMo Transactions',
    'Broadcast SMS Prompt',
    'Upcoming Installments',
    'Cumulative Net Inflow',
    'Target Term Threshold',
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  });
  // The chart is an SVG described in one aria-label listing every week, which is
  // what makes the curve readable without sight of it.
  if (!has(html, 'Collections by week')) throw new Error('the chart has no accessible description');
  if (!has(html, 'progressbar')) throw new Error('the collection rate has no progressbar role');
  return 'chart, channels, table, SMS and installments all present';
});

await check('the Overview marks demo data instead of claiming live sync', () => {
  const html = renderRoute('/dashboard');
  if (has(html, 'Live sync active')) {
    throw new Error('the live marker is showing over fixture data');
  }
  if (!has(html, 'Demo data')) throw new Error('no demo marker');
  // The export and manual-payment actions would hand out fiction otherwise.
  if (!has(html, 'Available once reports are wired')) {
    throw new Error('the export action is not disabled on demo data');
  }
  return 'demo marker present, live marker absent, export disabled';
});

await check('amounts render through the pesewas formatter', () => {
  const html = renderRoute('/dashboard');
  if (!has(html, formatCediShort(DEMO_OVERVIEW.kpis.collected.amount))) {
    throw new Error(`collected total "${formatCediShort(DEMO_OVERVIEW.kpis.collected.amount)}" missing`);
  }
  if (!has(html, formatCount(DEMO_OVERVIEW.kpis.totalStudents.value))) {
    throw new Error('the student count is missing');
  }
  return `${formatCediShort(DEMO_OVERVIEW.kpis.collected.amount)} and 1,000 both render`;
});

// ── The demo fixture's own arithmetic ───────────────────────────────────────

await check('the demo fixture reconciles', () => {
  const { kpis, upcomingInstallments, channels, weeklyInflow } = DEMO_OVERVIEW;

  const weekSum = weeklyInflow.reduce((sum, w) => sum + w.total, 0);
  if (weekSum !== kpis.collected.amount) {
    throw new Error(
      `weekly inflows total ${formatCediShort(weekSum)} but the headline says ${formatCediShort(kpis.collected.amount)}`
    );
  }

  const channelSum = channels.reduce((sum, c) => sum + c.amount, 0);
  if (channelSum !== kpis.collected.amount) {
    throw new Error(
      `channels total ${formatCediShort(channelSum)} but the headline says ${formatCediShort(kpis.collected.amount)}`
    );
  }

  const accounts = channels.reduce((sum, c) => sum + c.accounts, 0);
  if (accounts !== kpis.totalStudents.value) {
    throw new Error(`channel accounts total ${accounts}, not the ${kpis.totalStudents.value} students`);
  }

  const rate = (kpis.collected.amount / kpis.expectedOwed.amount) * 100;
  if (Math.abs(rate - kpis.collected.ratePercent) > 0.1) {
    throw new Error(`collection rate computes to ${rate.toFixed(1)}%, fixture says ${kpis.collected.ratePercent}%`);
  }

  const tranches = upcomingInstallments.days.reduce((sum, d) => sum + d.students, 0);
  if (tranches !== upcomingInstallments.scheduledTranches) {
    throw new Error(`days sum to ${tranches} students, not ${upcomingInstallments.scheduledTranches}`);
  }
  const inflow = upcomingInstallments.days.reduce((sum, d) => sum + d.amount, 0);
  if (inflow !== upcomingInstallments.expectedInflow) {
    throw new Error(`days sum to ${formatCediShort(inflow)}, not ${formatCediShort(upcomingInstallments.expectedInflow)}`);
  }

  return 'weeks, channels, accounts, rate, tranches and inflow all balance';
});

await check('each week splits into its three networks', () => {
  DEMO_WEEKLY_INFLOW.forEach((week) => {
    const split = week.mtn + week.telecel + week.at;
    if (split !== week.total) {
      throw new Error(`${week.week} splits to ${formatCediShort(split)}, not ${formatCediShort(week.total)}`);
    }
  });
  DEMO_CHANNELS.forEach((channel) => {
    const summed = DEMO_WEEKLY_INFLOW.reduce((sum, w) => sum + w[channel.key], 0);
    if (summed !== channel.amount) {
      throw new Error(
        `${channel.network} weeks sum to ${formatCediShort(summed)}, not ${formatCediShort(channel.amount)}`
      );
    }
  });
  return '10 weeks × 3 networks, and each network total, balance';
});

await check('the cedi formatter never abbreviates a six-figure total', () => {
  const rendered = formatCediShort(DEMO_OVERVIEW.kpis.expectedOwed.amount);
  if (has(rendered, 'K') || has(rendered, 'M')) throw new Error(`"${rendered}" was abbreviated`);
  if (rendered !== 'GH₵ 425,000') throw new Error(`unexpected rendering: "${rendered}"`);
  if (formatCediWhole(DEMO_OVERVIEW.upcomingInstallments.expectedInflow) !== '6,900') {
    throw new Error('formatCediWhole did not drop the decimals');
  }
  return 'GH₵ 425,000 and 6,900';
});

// ── The Students module ─────────────────────────────────────────────────────
//
// Rendered in isolation as well as through its route. A component that only
// breaks outside the page — a bad import, a prop the route happens to always
// pass — is invisible to a route-level check, and that is how the
// `SelectField` default-import bug survived a green build: the route rendered
// an input with `<option>` children and React rejected it with an error naming
// neither the field nor the import.
await check('the roster sub-components render on their own', () => {
  // With a real `stats` object, not `loading` — the band renders a skeleton
  // until the aggregates arrive, so asserting its labels against a loading
  // render would assert the wrong screen. This checks the populated band, which
  // is the one a bursar actually reads.
  renderToString(
    <RosterKpiRow
      stats={{
        totalRoster: 1000,
        fullyCleared: 737,
        clearedPercent: 73.7,
        activePlans: 176,
        activePlanStudents: 150,
        overdueStudents: 87,
        overdueAmount: 4120000,
        totalOwed: 42500000,
        totalPaid: 31800000,
        outstanding: 10700000,
      }}
    />
  );
  const band = renderToString(
    <RosterKpiRow
      stats={{
        totalRoster: 1000,
        fullyCleared: 737,
        clearedPercent: 73.7,
        activePlans: 176,
        activePlanStudents: 150,
        overdueStudents: 87,
        overdueAmount: 4120000,
        totalOwed: 42500000,
        totalPaid: 31800000,
        outstanding: 10700000,
      }}
    />
  );
  ['Total Roster', 'Fully Cleared', 'Installment Pledges', 'Overdue Balances'].forEach((label) => {
    if (!has(band, label)) throw new Error(`the KPI band is missing "${label}"`);
  });
  // The clearing share is a real figure, not a placeholder.
  if (!has(band, '73.7%')) throw new Error('the cleared percentage is not rendered');

  renderToString(
    <RosterFilterBar
      filters={{ search: '', class: '', feeStatus: '', planStatus: '', gender: '', status: 'active' }}
      setFilter={() => {}}
      clearFilters={() => {}}
      hasFilters={false}
      classes={['JHS 1', 'JHS 2A']}
    />
  );

  renderToString(
    <StudentTable
      rows={[]}
      loading={false}
      error={null}
      meta={{ page: 1, perPage: 20, total: 0, totalPages: 0 }}
      filters={{ sortBy: 'createdAt', sortOrder: 'desc' }}
      hasFilters={false}
      selection={{
        allVisibleSelected: false,
        selected: new Set(),
        toggleAllVisible: () => {},
        toggleRow: () => {},
      }}
      onSort={() => {}}
      onPageChange={() => {}}
      onPerPageChange={() => {}}
      onOpenProfile={() => {}}
      onEdit={() => {}}
      onClearFilters={() => {}}
      onMessage={() => {}}
      onRegeneratePayLink={() => {}}
    />
  );
  return 'KPI band, filter bar and table all render';
});

await check('the roster renders its own regions', () => {
  const html = renderRoute('/dashboard/students');
  [
    // `&amp;`, not `&`: `renderToString` escapes the ampersand in the title, and
    // a needle written as prose fails against correct markup.
    'Students &amp; Fee Roster',
    'Fee Status',
    'Plan Status',
    'Export Roster',
    'Add New Student',
    'Select all students on this page',
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the roster is missing "${needle}"`);
  });
  return 'header, KPI band, filters, table and actions';
});

await check('the module tab bar marks exactly one section', () => {
  // The regression: a module's sections are query parameters on one path, and
  // `NavLink` matches on pathname — so all four resolved to `/dashboard/students`
  // and every tab rendered as current.
  const html = renderRoute('/dashboard/students');
  const navStart = html.indexOf('aria-label="Students sections"');
  if (navStart === -1) throw new Error('the section tabs did not render');
  const tabs = html.slice(navStart, html.indexOf('</nav>', navStart));
  const count = countOf(tabs, 'aria-current="page"');
  if (count !== 1) throw new Error(`${count} tabs marked current, expected 1`);
  if (!has(tabs, '>Roster<')) throw new Error('the roster section should be the current one');
  return 'exactly one section current';
});

await check('FormField is only ever imported by name', async () => {
  // `FormField.jsx` has `export default Field` and a *named* `SelectField`, so
  // `import SelectField from '.../FormField'` binds the text input. It builds
  // cleanly, type-checks nowhere, and fails at render with "input is a
  // self-closing tag and must neither have children" — an error that names
  // neither the import nor the field. A static check is the only thing that
  // catches it before a user sees it.
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  // Two levels up, not one: `import.meta.url` points at the *built* bundle in
  // `.mockcheck/out-dashboard/`, so `../src` would resolve to `.mockcheck/src`.
  const root = new URL('../../src/', import.meta.url).pathname.replace(/^\//, '');
  const offenders = [];

  const walk = (dir) => {
    readdirSync(dir).forEach((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      if (!full.endsWith('.jsx')) return;
      const source = readFileSync(full, 'utf8');
      if (/^import\s+SelectField\s+from/m.test(source)) {
        offenders.push(full.replace(root, 'src/'));
      }
    });
  };
  walk(root);

  if (offenders.length) {
    throw new Error(`default-imported SelectField (which is Field) in: ${offenders.join(', ')}`);
  }
  return 'no default imports of SelectField';
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
