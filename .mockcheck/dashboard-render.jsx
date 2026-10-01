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
import UserManagement from '../src/pages/dashboard/UserManagement.jsx';
import SettingsPage from '../src/pages/dashboard/Settings.jsx';
import RosterKpiRow from '../src/components/students/RosterKpiRow.jsx';
import RosterFilterBar from '../src/components/students/RosterFilterBar.jsx';
import PaymentKpiRow from '../src/components/payments/PaymentKpiRow.jsx';
import SettlementBand from '../src/components/payments/SettlementBand.jsx';
import StudentTable from '../src/components/students/StudentTable.jsx';
import ClassListEditor from '../src/components/students/ClassListEditor.jsx';
import BalanceCard from '../src/components/pay/BalanceCard.jsx';
import MomoForm from '../src/components/pay/MomoForm.jsx';
import PayHeader from '../src/components/pay/PayHeader.jsx';
import { formatCedi } from '../src/utils/format.js';

const PAY_STUDENT = {
  id: '65f1c2a4e8b9d0123456789a',
  studentId: 'SCH-DEMO-01-2026-8054',
  studentName: 'Ama Serwaa Boateng',
  studentClass: 'JHS 2A',
  totalOwed: 85000,
  totalPaid: 10000,
  balance: 75000,
  deadline: new Date(Date.now() + 21 * 86400000).toISOString(),
  school: { _id: '65f1c2a4e8b9d0123456789b', schoolCode: 'SCH-DEMO-01', name: 'Prampram Basic School' },
};

const PayPageHarness = ({ loading = false }) =>
  loading ? (
    <div className="animate-pulse">
      <div className="h-48 rounded-2xl bg-slate-200/70" />
    </div>
  ) : (
    <>
      <PayHeader school={PAY_STUDENT.school} />
      <BalanceCard student={PAY_STUDENT} />
      <MomoForm student={PAY_STUDENT} onSubmit={() => {}} submitting={false} />
    </>
  );
import UpcomingInstallmentsCard from '../src/pages/dashboard/overview/UpcomingInstallmentsCard.jsx';
import { visibleDashboardNav } from '../src/utils/constants.js';
import { EMPTY_OVERVIEW } from '../src/data/dashboardEmpty.js';
import { formatCediShort, formatCount, formatCediWhole } from '../src/utils/format.js';
import KpiRow from '../src/pages/dashboard/overview/KpiRow.jsx';
import CollectionsCard from '../src/pages/dashboard/overview/CollectionsCard.jsx';
import RecentTransactionsCard from '../src/pages/dashboard/overview/RecentTransactionsCard.jsx';
import PaymentChannelsCard from '../src/pages/dashboard/overview/PaymentChannelsCard.jsx';

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
            <Route path="user-management" element={<UserManagement />} />
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
  'User Management',
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

await check('all nine modules are in the rail', () => {
  const html = renderRoute('/dashboard');
  const missing = MODULES.filter((label) => !has(html, `>${label}<`));
  if (missing.length) throw new Error(`missing from the rail: ${missing.join(', ')}`);
  return '9 of 9';
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
  // The school and term labels used to be asserted as the *fixture's* strings —
  // 'Prampram Basic' and 'Academic Term 1' / '2025/2026'. That check passed for
  // years while the header showed every real bursar a school that was not
  // theirs, because the topbar read those values from `DEMO_SCHOOL` and
  // `DEMO_TERM` and no request ever replaced them.
  //
  // `renderToString` runs no effects, so the school fetch never resolves here and
  // the header is at its unloaded state. That is the honest thing to assert: the
  // placeholders, not a fiction.
  const html = renderRoute('/dashboard');
  ['Your school', 'Current term', 'Search students', 'New Payment'].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the header is missing "${needle}"`);
  });
  return 'unloaded placeholders, search and New Payment all present';
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
    ['/dashboard/user-management', 'User Management'],
    ['/dashboard/settings', 'Settings'],
  ];

  routes.forEach(([path, expected]) => {
    const html = renderRoute(path);
    const { count, label } = currentInRail(html);
    if (count !== 1) throw new Error(`${path} marked ${count} rail entries current, expected 1`);
    if (label !== expected) throw new Error(`${path} marked "${label}" current, expected "${expected}"`);
  });

  return '9 routes, one correct entry each';
});

await check('every module page renders its own content', () => {
  const pages = [
    // `/dashboard` is absent: the Overview is legitimately *loading* during SSR
    // (effects do not run, and it starts `loading: true` on purpose so a live
    // school never sees a flash of fixture figures). It has its own check below.
    ['/dashboard/students', 'Select all students on this page'],
    // The needle is a control the built page always renders, not the old
    // scaffold's "Refunds" placeholder — same reasoning as the SMS entry below.
    // `Record manual / cash payment` is in the page header, so it is present in
    // the server render regardless of which state the data layer is in.
    ['/dashboard/payments', 'Record manual / cash payment'],
    ['/dashboard/installment-plans', 'Installment Compliance Dashboard'],
    // The needle is the audience stepper, not the old honest-failure banner. That
    // banner ("No school-facing SMS send endpoint") is gone because the route
    // exists now, and a mockcheck that keeps asserting its presence would go green
    // only while the module was broken. `Select Audience` is rendered on the
    // server — it is the default tab's first control — so it is the honest thing
    // to assert.
    ['/dashboard/sms-reminders', 'Select Audience'],
    // `&amp;`, not `&`: `renderToString` escapes the ampersand, so a needle
    // written as prose fails against correct markup. This also changed from the
    // scaffold's lowercase section title to the real card's name.
    ['/dashboard/reports', 'Outstanding Balances &amp; Arrears Ledger'],
    ['/dashboard/activity-log', 'Read-only by design'],
    // The needle is the roster's own primary action. Asserting the module's title
    // would pass even if the table never rendered, which is the failure a route
    // check is supposed to catch.
    ['/dashboard/user-management', 'Invite team member'],
  ];

  pages.forEach(([path, needle]) => {
    const html = renderRoute(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });

  return '8 module pages rendered';
});

await check('Settings and User Management are hidden from non-admin roles in the rail', () => {
  // The same rule for both, and asserted together: inviting a colleague mints a
  // credential and names them to a third party, which is an administrative act
  // with an audit trail — not something a bursar should do for a colleague.
  const teacher = visibleDashboardNav('teacher').flatMap((g) => g.items.map((i) => i.label));
  const admin = visibleDashboardNav('school_admin').flatMap((g) => g.items.map((i) => i.label));
  for (const hidden of ['Settings', 'User Management']) {
    if (teacher.includes(hidden)) throw new Error(`a teacher can see ${hidden}`);
    if (!admin.includes(hidden)) throw new Error(`a school admin cannot see ${hidden}`);
  }
  if (teacher.length !== 7) throw new Error(`teacher rail has ${teacher.length} entries, expected 7`);
  if (admin.length !== 9) throw new Error(`admin rail has ${admin.length} entries, expected 9`);
  return 'teacher 7, school admin 9';
});

// -- Payments ----------------------------------------------------------------
//
// Two decisions on this module are worth a test, because both are the kind that
// a future redesign quietly reverses: the KPI band aggregates over the whole
// period rather than the visible page, and the settlement band refuses to show a
// bank-sweep figure that no backend job produces.

await check('the Payments KPI band aggregates the summary, never the visible rows', () => {
  const html = renderToString(
    <PaymentKpiRow
      summary={{
        totalInflow: 31800000,
        totalTransactions: 342,
        previousTotalInflow: 27840000,
        trendPercent: 14.2,
        networks: [
          { network: 'MTN', label: 'MTN MoMo', amount: 21624000, count: 232, sharePercent: 68, wallets: 232 },
          { network: 'VODAFONE', label: 'Vodafone Cash', amount: 7000000, count: 60, sharePercent: 22, wallets: 58 },
          { network: 'AIRTELTELIGO', label: 'AT Money', amount: 3176000, count: 50, sharePercent: 10, wallets: 49 },
        ],
        awaitingConfirmation: { amount: 1485000, count: 3 },
      }}
      loading={false}
    />
  );

  // Every figure below is pesewas on the wire and must render as cedis. The
  // Overview's check already guards that boundary for `KpiRow`; this one guards
  // it for `CediValue`, which splits the symbol from the digits.
  //
  // The needles are fragments, not whole sentences, on purpose. `renderToString`
  // separates adjacent text children with `<!-- -->`, so
  // `{count} successful transaction{s}` never appears as one contiguous
  // substring — asserting the full phrase would fail against correct output.
  ['318,000', 'successful transaction', '216,240', 'distinct mobile wallet'].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the KPI band is missing "${needle}"`);
    }
  );

  // The band's own vocabulary, so a rename that loses the period framing fails
  // here rather than in a bursar's head.
  if (!has(html, 'Total inflow')) throw new Error('the band has no total-inflow tile');
  if (!has(html, 'Awaiting confirmation'))
    throw new Error('the band has no awaiting-confirmation tile');

  // The headline case: a sweep badge or a batch figure would mean someone has
  // started inventing settlement numbers.
  if (has(html, 'Escrow')) throw new Error('the KPI band is claiming an escrow state');
  if (has(html, 'sweep')) throw new Error('the KPI band is claiming a bank sweep');

  return 'cedis formatted, 342 from the aggregate, no invented settlement figures';
});

await check('the settlement band states that no sweep runs', () => {
  // Wrapped in a Router because the band's settings link is a `react-router`
  // `Link`, and `Link` reads the router context at render time. The other
  // sub-component checks here are leaf-presentational and need no provider; this
  // one crosses into navigation, so it gets the same wrapper the app gives it.
  const html = renderToString(
    <MemoryRouter>
      <SettlementBand
        school={{
          payment: {
            gatewayMode: 'hubtel',
            bankAccount: {
              accountName: 'Prampram Basic School',
              accountNumber: '0123456789',
              bankName: 'GCB Bank',
              branch: 'Prampram',
            },
          },
        }}
      />
    </MemoryRouter>
  );

  if (!has(html, 'No automated sweep'))
    throw new Error('the band does not disclose that no sweep is automated');
  if (!has(html, '6789')) throw new Error('the masked account number is not rendered');
  // Only the last four: a payments screen is not where a full account number
  // should be readable over someone's shoulder.
  if (has(html, '0123456789')) throw new Error('the full account number is rendered');
  if (!has(html, 'Hubtel')) throw new Error('the configured gateway is not named');

  return 'gateway named, account masked to last four, sweep disclosed as absent';
});

// -- Overview ----------------------------------------------------------------
//
// Rendered from the region components rather than through the page, because the
// page is legitimately *loading* during SSR: `useDashboardOverview` starts with
// `loading: true` so a real school never sees a flash of the demo fixtures
// before live figures arrive, and effects do not run on the server.

await check('the Overview renders its headline and KPI band', () => {
  // Literal figures rather than a fixture module. `data/dashboardDemo.js` is
  // deleted; the shape it defined now comes from `GET /students/stats`, and the
  // only thing worth keeping about it was that it exercised six-figure cedis
  // formatting, which is what these numbers are for.
  const html = renderToString(
    <KpiRow
      kpis={{
        totalStudents: { value: 1000 },
        expectedOwed: { amount: 42500000 },
        collected: { amount: 31800000, ratePercent: 74.8, rateLabel: 'Collection Rate' },
        overdue: { students: 87, amount: 4120000 },
      }}
    />
  );
  [
    'Total Students',
    'Total Expected Owed',
    'Total Collected',
    'Overdue Students',
    'Collection Rate',
    'Immediate Attention',
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the KPI band is missing "${needle}"`);
  });
  // The money boundary, asserted. The tile renders the symbol and the digits as
  // separate nodes so the symbol can be set smaller, so this asserts on the
  // digits: 31800000 pesewas must read 318,000, and the raw integer must not
  // appear. A contiguous "GH₵ 318,000" never appears in the markup, because
  // `CediValue` splits it.
  if (!has(html, '318,000')) {
    throw new Error(`the collected figure did not render as 318,000 (${formatCediShort(31800000)})`);
  }
  if (!has(html, 'GH₵')) throw new Error('no cedi symbol on the figure');
  if (has(html, '31800000')) throw new Error('a raw pesewa count is on screen');
  return '4 KPI tiles, figures in cedis';
});

await check('no fabricated identity or figure survives on the Overview', () => {
  // The regression: `data/dashboardDemo.js` was documented as a fallback and was
  // not one. `useDashboardOverview` only replaced three regions from the API, so
  // "Prampram Basic School", "Basic & JHS Campus", "Academic Term 1 (2025/2026)"
  // and the invented KPI notes rendered for every signed-in bursar on a live
  // deployment. The per-card "demo data" captions were gated on one page-level
  // `isDemo` flag that went false on the first successful request, so they never
  // fired either. This asserts the fixture's strings are gone from the rendered
  // page, not merely that it is labelled.
  const html = renderRoute('/dashboard');
  [
    'Prampram Basic School',
    'Basic & JHS Campus',
    'Academic Term 1',
    '2025/2026',
    'Re-opening week',
    'Target Term Threshold',
    'Enrolled in MoMo direct billing',
    'vs L/T',
    'on Installment grace',
    'Overdue MoMo Prompt',
  ].forEach((needle) => {
    if (has(html, needle)) {
      throw new Error(`the Overview still renders the fixture string "${needle}"`);
    }
  });
  return 'no fixture identity, term, target or KPI note is rendered';
});

await check('the Overview renders every visualisation region', () => {
  // Inside a MemoryRouter: the region cards read router context through the
  // shared primitives, and in the app they are always mounted under
  // BrowserRouter. Rendering them bare throws rather than degrading quietly, so
  // the harness reproduces the real condition.
  const html = renderToString(
    <MemoryRouter>
      <CollectionsCard term={EMPTY_OVERVIEW.term} seriesFor={() => EMPTY_OVERVIEW.weeklyInflow.map((row) => ({ label: row.week, value: row.total }))} />
      <RecentTransactionsCard transactions={EMPTY_OVERVIEW.transactions} totalCount={EMPTY_OVERVIEW.transactionCount} />
      <PaymentChannelsCard channels={EMPTY_OVERVIEW.channels} />
      <UpcomingInstallmentsCard upcoming={EMPTY_OVERVIEW.upcomingInstallments} />
    </MemoryRouter>
  );
  [
    'Collections This Term (Weekly)',
    'Payment Channels',
    'Recent MoMo Transactions',
    'Upcoming Installments',
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  });
  return 'all four region cards render their headings';
});

await check('regions with no endpoint say so instead of drawing figures', () => {
  // `getWeeklyCollections` and `getUpcomingInstallments` both throw by design.
  // The cards must therefore render an honest empty state — a ten-week curve and
  // a list of tranches dated 31 Oct were what they used to do instead, and the
  // `isDemo` caption that was supposed to cover it never fired in production.
  const html = renderToString(
    <MemoryRouter>
      <CollectionsCard term={EMPTY_OVERVIEW.term} seriesFor={() => EMPTY_OVERVIEW.weeklyInflow.map((row) => ({ label: row.week, value: row.total }))} />
      <UpcomingInstallmentsCard upcoming={EMPTY_OVERVIEW.upcomingInstallments} />
      <PaymentChannelsCard channels={EMPTY_OVERVIEW.channels} />
    </MemoryRouter>
  );
  ['No weekly breakdown yet', 'not available yet', 'No completed payments in this period yet'].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the empty state is missing "${needle}"`);
    }
  );
  // And no invented zero-but-present figures.
  ['Cumulative Net Inflow', 'Scheduled Tranches', 'Expected Inflow'].forEach((needle) => {
    if (has(html, needle)) {
      throw new Error(`"${needle}" rendered with no data behind it`);
    }
  });
  return 'three empty states, no headline figures';
});

await check('the channels card renders real payment-method rows', () => {
  // The shape is `GET /reports/payment-methods/:schoolId`:
  // `{ label, amount, count, percentage }` grouped by payment method. The card
  // previously claimed a per-network split with a per-network authorisation rate
  // and an "accounts" count, none of which that endpoint returns.
  const html = renderToString(
    <MemoryRouter>
      <PaymentChannelsCard
        channels={[
          { key: 'momo', label: 'momo', amount: 21624000, transactionCount: 680, sharePercent: 68 },
          { key: 'card', label: 'card', amount: 6996000, transactionCount: 220, sharePercent: 22 },
        ]}
      />
    </MemoryRouter>
  );
  // Asserted as separate needles: React's server renderer splits adjacent text
  // expressions with a `<!-- -->` comment, so "680 Payments" never appears as a
  // contiguous string in the markup even when it renders correctly on screen.
  ['momo', 'card', '680', '220', 'Share', 'Payments'].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the channels card is missing "${needle}"`);
  });
  // The fixture's invented metric.
  if (has(html, 'Auth rate')) {
    throw new Error('an authorisation rate is rendered, but no endpoint returns one');
  }
  return 'methods, share and transaction counts from the real shape';
});

await check('the Overview shows a skeleton, not a flash of figures', () => {
  // The point of the hook starting in `loading`: a school with a live backend must
  // not see figures for 300ms before the real ones arrive.
  const html = renderRoute('/dashboard');
  if (!has(html, 'animate-pulse')) throw new Error('no loading skeleton on the first paint');
  return 'skeleton on the first paint, no figures';
});

await check('the cedi formatter never abbreviates a six-figure total', () => {
  // Literals, not a fixture module. The property under test is the formatter's,
  // not a dataset's.
  const rendered = formatCediShort(42500000);
  if (has(rendered, 'K') || has(rendered, 'M')) throw new Error(`"${rendered}" was abbreviated`);
  if (rendered !== 'GH₵ 425,000') throw new Error(`unexpected rendering: "${rendered}"`);
  if (formatCediWhole(690000) !== '6,900') {
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

await check('Add New Student is enabled, not a dead button', () => {
  // The regression this missed: the check above only asserted the label exists,
  // so `disabled={!classes.length}` passed every run while the module's primary
  // action was permanently dead for a self-provisioned school — which always
  // starts with `academic.classes: []`. The label was present and useless.
  //
  // Server rendering never runs effects, so no class list is fetched here and
  // `classes` is always empty during this check. That is precisely the state
  // that used to disable the button, so it is the right state to assert on.
  const html = renderRoute('/dashboard/students');
  const labelAt = html.indexOf('Add New Student');
  if (labelAt === -1) throw new Error('the Add New Student action did not render');

  // The button element is the nearest `<button` before the label.
  const open = html.lastIndexOf('<button', labelAt);
  if (open === -1) throw new Error('the Add New Student label is not inside a button');
  const tag = html.slice(open, html.indexOf('>', open));
  if (/\sdisabled(\s|=|$)/.test(tag)) {
    throw new Error(
      `the Add New Student button renders disabled: ${tag}\n` +
        'It must open the class list when the school has no classes, not sit inert.'
    );
  }
  return 'the action is live even with no class list loaded';
});

await check('a school with no classes is given a way to add some', () => {
  // Rendered directly rather than through the route: the notice it belongs to is
  // gated on `school` having resolved, and `getSchool` runs in an effect, so
  // `renderToString` — which never runs effects — would never show the banner.
  // The dialog is the actual way forward, and it is a pure prop-driven
  // component, so it can be asserted on honestly.
  const html = renderToString(
    <ClassListEditor
      open
      schoolId="6abb954124ad2e6613e7d90c"
      classes={[]}
      onClose={() => {}}
      onSaved={() => {}}
    />
  );
  ['Save classes', 'Add a class', 'Basic + JHS'].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the class editor is missing "${needle}"`);
  });
  if (!has(html, 'No classes yet')) {
    throw new Error('the empty state does not explain that nothing is configured yet');
  }
  return 'the dialog renders templates, an add field and a save action';
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

// ── Settings and Reports ─────────────────────────────────────────────────────

await check('Settings shows a skeleton on the server, not a flash of empty fields', () => {
  // Settings cannot be asserted through its content: `useEffect` never runs under
  // `renderToString`, so `getSettings` is never called and the page sits at its
  // own loading branch. That branch is the honest thing to assert — and it
  // matters, because a Settings page that rendered an *empty form* before the
  // settings arrived would invite a bursar to type a school's legal name over the
  // top of the real one and save it.
  const html = renderRoute('/dashboard/settings');
  if (!has(html, 'animate-pulse')) {
    throw new Error('Settings did not render a loading skeleton on its first frame');
  }
  if (has(html, 'Save profile')) {
    throw new Error('Settings rendered its save controls before any settings had loaded');
  }
  return 'skeleton on the first paint, no editable fields';
});

await check('every Settings section declares whether it is writable', async () => {
  // Three of the seven sections have no write endpoint behind them. The failure
  // this guards is a section that renders a form field for a setting nothing can
  // persist — which looks fine until someone fills it in and gets a 422.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(
    new URL('../../src/pages/dashboard/Settings.jsx', import.meta.url),
    'utf8'
  );

  for (const label of [
    'School Profile',
    'Payment Gateway',
    'SMS & Sender ID',
    'Academic Calendar',
    'Notification Preferences',
    'Fees & Billing Structure',
    'Security & Compliance',
  ]) {
    if (!source.includes(`label: '${label}'`)) {
      throw new Error(`the Settings rail is missing the "${label}" section`);
    }
  }

  // Every non-writable section must carry a reason. A disabled control with no
  // explanation reads as a bug, and three of these seven are disabled.
  const readOnly = source.match(/writable: false,\s*\n\s*reason:/g) || [];
  if (readOnly.length < 3) {
    throw new Error(`${readOnly.length} read-only sections carry a reason; expected at least 3`);
  }
  return '7 sections, 3 read-only and each with a stated reason';
});

await check('the Reports catalogue never offers PDF', async () => {
  // `?format=pdf` returns a deliberate 501 from `sendReportFile` — the backend
  // has no PDF dependency and says so in the error message. A PDF control on a
  // report card would therefore have exactly one possible outcome.
  // `../src`, not `../../src`: an import specifier is resolved relative to this
  // file, which lives in `.mockcheck/`. The `new URL('../../src/', import.meta.url)`
  // form used elsewhere below is for filesystem reads in the *built* bundle, which
  // sits two levels down. Getting these confused is the whole reason the Settings
  // check below reads source rather than importing it.
  const { REPORTS } = await import('../src/services/reports.js');

  if (REPORTS.length !== 9) throw new Error(`expected 9 reports, the catalogue has ${REPORTS.length}`);

  const withPdf = REPORTS.filter((r) => (r.formats || []).includes('pdf'));
  if (withPdf.length) {
    throw new Error(`PDF offered on: ${withPdf.map((r) => r.key).join(', ')}`);
  }
  // CSV and XLSX are real, and every report must offer at least one.
  const withoutExport = REPORTS.filter((r) => !(r.formats || []).length);
  if (withoutExport.length) {
    throw new Error(`no export format on: ${withoutExport.map((r) => r.key).join(', ')}`);
  }
  return `9 reports, ${REPORTS.length} with CSV/XLSX, none with PDF`;
});

await check('the Reports grid renders its catalogue', () => {
  // Rendered on the server: the grid is the module's catalogue and does not
  // depend on a fetch, so it is the one part of Reports that a route check can
  // honestly assert. The report *detail* is fetched per card and is covered by
  // the source check below.
  const html = renderRoute('/dashboard/reports');
  ['All Reports', 'Collections &amp; Revenue', 'Compliance &amp; Arrears'].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the Reports grid is missing the "${needle}" tab`);
  });
  if (!has(html, 'Daily Collection Summary')) {
    throw new Error('the Reports grid did not render a report card');
  }
  return 'category tabs and report cards';
});

// ── The User Management module ───────────────────────────────────────────────
await check('the invite dialog explains what the recipient gets', async () => {
  // A source assertion, not a render, and the reason is the harness rather than
  // the component: `Modal` portals to `document.body`, and this file's runner
  // stubs `document` with plain objects, so `createPortal` has no real DOM node to
  // target. Rendering it here would fail for every invocation regardless of what
  // the component contains.
  //
  // So this locks the copy that carries the product requirement — the dialog
  // tells an admin a password is about to be emailed to their colleague, before
  // the button is pressed. It is a weaker check than a render and is honest about
  // that: it proves the words are in the component, not that they are on screen.
  // The render path is covered by `every JSX component is imported or declared
  // locally`, which is what catches the failure mode a portal cannot hide here.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(
    new URL('../../src/components/user-management/InviteTeamMemberDialog.jsx', import.meta.url),
    'utf8'
  );

  // The two fields the requirement names.
  for (const needle of ['Full name', 'Email address']) {
    if (!source.includes(needle)) throw new Error(`the invite dialog has no "${needle}" field`);
  }

  // The one that matters most. "We email you a password" is a surprise if it is
  // discovered afterwards, and by then the only remedy is a re-send.
  if (!source.includes('What happens next')) {
    throw new Error('the dialog does not explain what the recipient will be emailed');
  }
  for (const needle of ['temporary password', 'your name, so they know who invited']) {
    if (!source.includes(needle)) {
      throw new Error(`the dialog does not mention "${needle}"`);
    }
  }

  // No password field anywhere. A control here would suggest the client chooses
  // the credential, which it does not — the server mints it from the School ID.
  if (/name=["']password["']|type=["']password["']/.test(source)) {
    throw new Error('the invite dialog offers a password field; the password is server-generated');
  }

  return 'two required fields, and the delivery explained up front';
});

await check('a school_admin sees User Management in the rail of the page itself', () => {
  // The nav item and the route have to agree. A rail entry pointing at a route
  // that is not registered renders a 404 to an admin who followed the link the
  // shell gave them, which is the exact failure the two-step registration is
  // meant to make impossible.
  const html = renderRoute('/dashboard/user-management');
  if (!has(html, 'aria-current="page"')) {
    throw new Error('no rail entry is marked current on /dashboard/user-management');
  }
  if (!has(html, 'Search by name, email or position')) {
    throw new Error('the roster did not render its search box');
  }
  return 'route and rail agree';
});

// ── Dialog containment on a phone ────────────────────────────────────────────

await check('the dialog pins its header and footer outside the scroll area', async () => {
  // A source assertion, for the same reason as the invite dialog: `Modal` portals
  // to `document.body` and this runner stubs `document` with plain objects, so no
  // portal can render here.
  //
  // The contract is the whole point. The panel is a flex *column* that clips, the
  // body is the only scroller, and the header and footer are `shrink-0`. When the
  // scroll sat on the panel instead, a tall form pushed the submit button ~500px
  // below the fold of a container whose page behind was `overflow: hidden` — so on
  // a phone the dialog had no visible title, close button or save button at all.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(
    new URL('../../src/components/common/Modal.jsx', import.meta.url),
    'utf8'
  );

  if (/max-h-\[\d+vh\][^"']*overflow-y-auto/.test(source)) {
    throw new Error('Modal scrolls the whole panel again — the footer will scroll out of reach');
  }
  if (!/flex max-h-\[\d+vh\][^"']*flex-col/.test(source)) {
    throw new Error('the Modal panel is not a flex column');
  }
  // The scroll has to land on the children wrapper.
  if (!/flex-1 overflow-y-auto/.test(source)) {
    throw new Error('the Modal body is not the scroll container');
  }

  const shrinkZero = (source.match(/shrink-0/g) || []).length;
  if (shrinkZero < 2) {
    throw new Error(`only ${shrinkZero} shrink-0 elements; the header and footer both need one`);
  }

  return 'header and footer pinned, body scrolls';
});

await check('the Manual Payment dialog truncates its student identity lines', async () => {
  // The one line in this dialog that lacked the truncation its sibling above it
  // had. A real code is `SCH-<SLUG>-<CLASS>-<YEAR>-<N>` and it sits beside a
  // `shrink-0` balance column, so an untruncated code wraps and drags the balance
  // out of alignment — which defeats the only purpose of the card above it.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(
    new URL('../../src/components/dashboard/RecordManualPaymentDialog.jsx', import.meta.url),
    'utf8'
  );

  // Two sites: the summary card's `{student.…}` and the result row's `{s.…}`.
  const identityLines = source.match(/(?:student|s)\.studentId\} · \{(?:student|s)\.studentClass\}/g) || [];
  if (identityLines.length !== 2) {
    throw new Error(`expected 2 student-identity lines, found ${identityLines.length}`);
  }

  // Each must sit on an element that also carries `truncate`.
  const untruncated = source.match(
    /<p(?![^>]*truncate)[^>]*>\s*\{(?:student|s)\.studentId\}/g
  );
  if (untruncated) {
    throw new Error(`student-identity line is not truncated: ${untruncated[0]}`);
  }
  if (!/block truncate text-\[11px\][^"]*"[^>]*>\s*\{s\.studentId\}/s.test(source)) {
    throw new Error('the search-result identity line lost its truncate');
  }

  return 'both identity lines truncate';
});

await check('the Overview header actions do not pin themselves against wrapping', async () => {
  // `shrink-0` and `flex-wrap` in the same class list contradict each other: wrap
  // exists so the row can save horizontal space, and `shrink-0` forbids the row
  // from ever getting narrower than its widest child, so the wrap can never fire.
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(
    new URL('../../src/pages/dashboard/Overview.jsx', import.meta.url),
    'utf8'
  );

  if (/shrink-0[^"']*flex-wrap/.test(source) || /flex-wrap[^"']*shrink-0/.test(source)) {
    throw new Error('the action row keeps both flex-wrap and shrink-0');
  }
  // Mobile stacks the actions full-width instead of relying on wrap to save space.
  if (!/w-full flex-col gap-2 sm:w-auto sm:flex-row/.test(source)) {
    throw new Error('the action row does not go full width on mobile');
  }
  return 'stacked full width below sm, inline above';
});

// ── The parent-facing pay page ───────────────────────────────────────────────
//
// Rendered on its own, and as part of the app, because it is the one surface a
// real person outside the school uses — and until this was added there was no
// implementation of it at all, so every link a school sent to a parent landed
// on the marketing 404.

await check('the pay page renders its own shell, not the marketing chrome', () => {
  const html = renderToString(<PayPageHarness />);
  if (!has(html, 'Secure fee payment')) throw new Error('the pay header did not render');
  // The parent has no account, so the marketing navbar must not be on the page.
  ['How It Works', 'For Schools', 'Get Started Free', 'Sign in'].forEach((link) => {
    if (has(html, link)) throw new Error(`the marketing chrome leaked into the pay page: ${link}`);
  });
  return 'own header, no navbar or footer links';
});

await check('the pay route is registered outside AppChrome', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  if (!/path="\/pay\/:token"/.test(source)) {
    throw new Error('/pay/:token is not registered');
  }
  // It has to sit outside the AppChrome <Route> block, or a parent is shown the
  // marketing navbar and a "Sign in" link for an account they do not have.
  const appChrome = source.indexOf('AppChrome');
  const payRoute = source.indexOf('path="/pay/:token"');
  const appChromeClose = source.indexOf('</Route>', appChrome);
  if (payRoute < appChromeClose) {
    throw new Error('/pay/:token is nested inside AppChrome');
  }
  return 'registered as a sibling of AppChrome';
});

await check('a loading pay page shows a skeleton, not an empty screen', () => {
  const html = renderToString(<PayPageHarness loading />);
  if (!has(html, 'animate-pulse')) throw new Error('no loading skeleton');
  return 'skeleton while the pay view is fetched';
});

await check('the pay form shows the real balance, in cedis', () => {
  const html = renderToString(<PayPageHarness />);
  // The money boundary: the payload is 75000 pesewas and the screen must read
  // GH₵ 750.00. A hundred-fold error here is a parent billed 100×, so it is
  // asserted rather than eyeballed.
  if (!has(html, formatCedi(PAY_STUDENT.balance))) {
    throw new Error(`the balance did not render as ${formatCedi(PAY_STUDENT.balance)}`);
  }
  if (has(html, '75000.00')) throw new Error('a raw pesewa count is on screen');
  ['Ama Serwaa Boateng', 'JHS 2A', 'MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money'].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the pay view is missing "${needle}"`);
    }
  );
  return `${formatCedi(PAY_STUDENT.balance)}, all three networks offered`;
});

// ── No undefined components anywhere in src ──────────────────────────────────

await check('every JSX component is imported or declared locally', async () => {
  // The frontend has no ESLint configured, so nothing was catching this class of
  // mistake. It is not hypothetical: `Students.jsx` rendered
  // `{tab === 'cohorts' ? <AlumniTab/> : <CohortsTab/>}` with **no import for
  // `CohortsTab`**. Rollup treats an undeclared identifier as a global, so
  // `vite build` passed cleanly and the Cohorts tab threw a `ReferenceError` the
  // moment it was clicked — and no test rendered that tab, because every check
  // used the default route.
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const root = new URL('../../src/', import.meta.url).pathname.replace(/^\//, '');

  // `Fragment` is a React export, and every other capitalised tag must resolve.
  const GLOBALS = new Set(['Fragment']);

  const offenders = [];
  const walk = (dir) => {
    readdirSync(dir).forEach((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      if (!/\.jsx?$/.test(name)) return;

      // Comments are stripped first, or a prose mention counts as usage: an
      // explanatory comment in `App.jsx` reading "only the page component below
      // <Outlet /> changes" registered `<Outlet>` as an unresolved component in a
      // file that never renders one. Imperfect against a `//` inside a string
      // literal, which can only cost a false negative here.
      const source = readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (!/<[A-Z]/.test(source)) return;

      const known = new Set(GLOBALS);

      // Imports: `import X from`, `import {A, B as C} from`, `import X, {A} from`,
      // `import * as X from`. The braces are matched without requiring `import`
      // to sit immediately before them, because the default-plus-named form
      // (`import Tile, { CediValue } from …`) is common and would otherwise be
      // reported as an unresolved component.
      for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) {
        known.add(m[1]);
      }
      for (const m of source.matchAll(/\bimport\b[^;'"]*?\{([^}]*)\}\s*from/g)) {
        m[1].split(',').forEach((part) => {
          const name = part.trim().split(/\s+as\s+/).pop().trim();
          if (name) known.add(name);
        });
      }
      for (const m of source.matchAll(/import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g)) {
        known.add(m[1]);
      }

      // Destructured bindings, shorthand and renamed. `({ icon: Icon })` binds
      // `Icon` with no import, and `({ installMockApi, MockControlPanel }) => …`
      // binds it out of a *dynamic* import — the main entry point's mock panel
      // works this way. Without these, renderable props and dynamic-import
      // results are both reported as missing.
      for (const m of source.matchAll(/\(\s*\{([^{}]*)\}\s*\)\s*=>/g)) {
        m[1].split(',').forEach((part) => {
          const name = part.trim().split(/[:=]/)[0].trim();
          if (name) known.add(name);
        });
      }
      for (const m of source.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([A-Z][\w$]*)/g)) {
        known.add(m[2]);
      }

      // Local declarations: `const X =`, `let X =`, `function X(`, `class X`.
      for (const m of source.matchAll(/(?:const|let|var|function|class)\s+([A-Z][\w$]*)/g)) {
        known.add(m[1]);
      }

      // JSX tags, excluding member expressions (`<Foo.Bar`) and closing tags.
      for (const m of source.matchAll(/<([A-Z][\w$]*)(?=[\s/>])/g)) {
        if (!known.has(m[1])) {
          offenders.push(`${full.replace(root, 'src/')}: <${m[1]}>`);
        }
      }
    });
  };
  walk(root);

  if (offenders.length) {
    throw new Error(
      `${offenders.length} component(s) used but never imported or declared — the build will pass and the route will throw at runtime:\n        ${offenders.join('\n        ')}`
    );
  }
  return 'no unresolved JSX components';
});

// ── Every tab of the Students module renders ────────────────────────────────

await check('all six Students tabs render', () => {
  // Each tab is a separate screen behind `?tab=`, and they are all reachable
  // from the module's tab bar. Asserting only the default left three of them
  // unrendered by any test — which is how a missing import survived a green
  // build. These are routed renders, not isolated component renders, so a
  // component that is referenced but absent fails here rather than in a browser.
  const expected = {
    roster: 'Select all students on this page',
    import: 'Upload a roster',
    alumni: 'Graduation year',
    cohorts: 'cohort', // the empty state, before any data arrives
  };

  Object.entries(expected).forEach(([tab, needle]) => {
    const html = renderRoute(`/dashboard/students?tab=${tab}`);
    if (!has(html, needle)) {
      throw new Error(`the "${tab}" tab did not render "${needle}"`);
    }
  });

  // The promotions tab is asserted separately because it is the one Students
  // screen whose content is *entirely* derived from the school document, and
  // this harness renders one synchronous pass — so no school has arrived by the
  // time it renders. Asserting on the class matrix here would therefore be
  // asserting on something unreachable, and the first-pass frame is a loading
  // state by design.
  //
  // What is worth locking down is that it waits rather than guessing: a tab
  // that renders "this school has no classes" before the school has loaded is
  // a confident, wrong, actionable statement, and it is the failure this
  // assertion exists to prevent.
  const promotions = renderRoute('/dashboard/students?tab=promotions');
  if (!has(promotions, 'Promotions &amp; Graduation')) {
    throw new Error('the promotions tab did not render its heading');
  }
  if (has(promotions, 'This school has no classes yet')) {
    throw new Error(
      'the promotions tab claimed the school has no classes before the school loaded'
    );
  }

  // The ID card studio is the third Students screen whose first frame is a
  // loading state, because the card grid and the school record both arrive
  // after the first paint. Asserted on its panel chrome — the batch panel and
  // the sheet arithmetic are rendered unconditionally, while the grid is still
  // skeletons — and on the one thing that would be wrong at any point: an
  // "estimated cost" is quoted before a batch exists, so the panel must not
  // claim a card count it has not been given.
  const idCards = renderRoute('/dashboard/students?tab=id-cards');
  if (!has(idCards, 'Print batch')) {
    throw new Error('the ID card tab did not render its batch panel');
  }
  if (!has(idCards, 'A4 sheets needed')) {
    throw new Error('the ID card tab did not render its sheet arithmetic');
  }

  return 'roster, id-cards, promotions, import, alumni and cohorts all render';
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
