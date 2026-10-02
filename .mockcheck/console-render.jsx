/**
 * Renders every platform-console page the way the app mounts it, to find the crash.
 *
 * `vite build` never executes a component body, so a wrong import, a missing prop or
 * an undefined variable surfaces only in a browser — which is exactly the class of
 * failure that makes a page "keep breaking" while every build stays green.
 *
 * Each page is rendered inside the real providers and a MemoryRouter at its own path,
 * wrapped so a throw names the route that threw rather than killing the whole run.
 * Effects do not fire under `renderToString`, so this catches render-time failures
 * only — but that is the class where a page dies before it can show anything, which
 * is what "breaking" looks like from the outside.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import AdminLayout from '../src/components/admin/AdminLayout.jsx';
import AdminSidebar from '../src/components/admin/AdminSidebar.jsx';
import AdminTopbar from '../src/components/admin/AdminTopbar.jsx';
import ImpersonationBanner from '../src/components/admin/ImpersonationBanner.jsx';

import AdminOverview from '../src/pages/admin/AdminOverview.jsx';
import AdminContent from '../src/pages/admin/AdminContent.jsx';
import SchoolsList from '../src/pages/admin/schools/SchoolsList.jsx';
import SchoolCreate from '../src/pages/admin/schools/SchoolCreate.jsx';
import SchoolDetail from '../src/pages/admin/schools/SchoolDetail.jsx';
import UsersList from '../src/pages/admin/users/UsersList.jsx';
import UserDetail from '../src/pages/admin/users/UserDetail.jsx';
import PaymentsList from '../src/pages/admin/payments/PaymentsList.jsx';
import PaymentDetail from '../src/pages/admin/payments/PaymentDetail.jsx';
import FinanceOverview from '../src/pages/admin/finance/FinanceOverview.jsx';
import LedgerList from '../src/pages/admin/finance/LedgerList.jsx';
import DisbursementsList from '../src/pages/admin/finance/DisbursementsList.jsx';
import DisbursementDetail from '../src/pages/admin/finance/DisbursementDetail.jsx';
import Reconciliation from '../src/pages/admin/finance/Reconciliation.jsx';
import InvoicesList from '../src/pages/admin/finance/InvoicesList.jsx';
import SmsOverview from '../src/pages/admin/sms/SmsOverview.jsx';
import SmsCredits from '../src/pages/admin/sms/SmsCredits.jsx';
import SmsLogs from '../src/pages/admin/sms/SmsLogs.jsx';
import AnnouncementsList from '../src/pages/admin/announcements/AnnouncementsList.jsx';
import AnnouncementCreate from '../src/pages/admin/announcements/AnnouncementCreate.jsx';
import AnnouncementEdit from '../src/pages/admin/announcements/AnnouncementEdit.jsx';
import AuditLogList from '../src/pages/admin/auditLogs/AuditLogList.jsx';
import AuditLogDetail from '../src/pages/admin/auditLogs/AuditLogDetail.jsx';
import AnalyticsDashboard from '../src/pages/admin/analytics/AnalyticsDashboard.jsx';
import RevenueAnalytics from '../src/pages/admin/analytics/RevenueAnalytics.jsx';
import SchoolsAnalytics from '../src/pages/admin/analytics/SchoolsAnalytics.jsx';
import CollectionRateAnalytics from '../src/pages/admin/analytics/CollectionRateAnalytics.jsx';
import SystemHealth from '../src/pages/admin/health/SystemHealth.jsx';
import ReportsCenter from '../src/pages/admin/reports/ReportsCenter.jsx';
import PlatformSettings from '../src/pages/admin/settings/PlatformSettings.jsx';
import ImpersonationHistory from '../src/pages/admin/impersonation/ImpersonationHistory.jsx';

const SCHOOL = '0123456789abcdef01234567';

const PAGES = [
  ['/admin', AdminOverview],
  ['/admin/schools', SchoolsList],
  ['/admin/schools/new', SchoolCreate],
  [`/admin/schools/${SCHOOL}`, SchoolDetail],
  ['/admin/users', UsersList],
  ['/admin/users/:userId', UserDetail],
  ['/admin/payments', PaymentsList],
  ['/admin/payments/:paymentId', PaymentDetail],
  ['/admin/finance', FinanceOverview],
  ['/admin/finance/ledger', LedgerList],
  ['/admin/finance/disbursements', DisbursementsList],
  ['/admin/finance/disbursements/:batchId', DisbursementDetail],
  ['/admin/finance/reconciliation', Reconciliation],
  ['/admin/finance/invoices', InvoicesList],
  ['/admin/sms', SmsOverview],
  ['/admin/sms/credits', SmsCredits],
  ['/admin/sms/logs', SmsLogs],
  ['/admin/announcements', AnnouncementsList],
  ['/admin/announcements/new', AnnouncementCreate],
  ['/admin/announcements/:id', AnnouncementEdit],
  ['/admin/audit-logs', AuditLogList],
  ['/admin/audit-logs/:id', AuditLogDetail],
  ['/admin/analytics', AnalyticsDashboard],
  ['/admin/analytics/revenue', RevenueAnalytics],
  ['/admin/analytics/schools', SchoolsAnalytics],
  ['/admin/analytics/collection-rate', CollectionRateAnalytics],
  ['/admin/health', SystemHealth],
  ['/admin/reports', ReportsCenter],
  ['/admin/settings', PlatformSettings],
  ['/admin/impersonation', ImpersonationHistory],
];

const shellComponents = [
  ['AdminSidebar', AdminSidebar],
  ['AdminTopbar', AdminTopbar],
  ['ImpersonationBanner', ImpersonationBanner],
];

let failures = 0;

const attempt = (label, fn) => {
  try {
    const html = fn();
    const empty = !html || html.replace(/\s/g, '').length < 40;
    if (empty) {
      failures += 1;
      console.log(`EMPTY  ${label} — rendered almost nothing`);
    } else {
      console.log(`ok     ${label}`);
    }
  } catch (error) {
    failures += 1;
    console.log(`THREW  ${label}`);
    console.log(`       ${error.message.split('\n')[0]}`);
    if (error.stack) {
      const frame = error.stack.split('\n').slice(1, 4).join('\n       ');
      console.log(`       ${frame}`);
    }
  }
};

const USER = { _id: SCHOOL, name: 'Platform Owner', email: 'owner@sukuupay.com', role: 'super_admin' };

/**
 * `AdminLayout` and `AdminTopbar` call `useAuth`, so every render needs the real
 * provider — not a stand-in. Its `/auth/me` fetch is in an effect, which does not
 * run under `renderToString`, so `user` resolves to `null` and the shell renders
 * its signed-out shape. That is still enough to exercise every code path a crash
 * would live in, and it is honest about what is covered.
 */
const wrap = (children) => (
  <AuthProvider>
    <ToastProvider>{children}</ToastProvider>
  </AuthProvider>
);

for (const [name, Component] of shellComponents) {
  attempt(name, () =>
    renderToString(
      wrap(
        <MemoryRouter initialEntries={['/admin']}>
          <Component user={USER} pathname="/admin" />
        </MemoryRouter>
      )
    )
  );
}

for (const [path, Page] of PAGES) {
  attempt(path, () =>
    renderToString(
      wrap(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path={path} element={<Page />} />
            </Route>
          </Routes>
        </MemoryRouter>
      )
    )
  );
}

console.log(failures ? `\n${failures} page(s) failed` : `\nall ${PAGES.length + shellComponents.length} rendered`);
process.exit(failures ? 1 : 0);