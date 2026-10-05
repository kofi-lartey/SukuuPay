import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppChrome from './components/layout/AppChrome';
import OnboardingGuard from './routes/OnboardingGuard';
import AdminGuard from './routes/AdminGuard';
import RoleLanding from './routes/RoleLanding';
import { ROUTES } from './utils/constants';

import Home from './pages/Home';
import Features from './pages/Features';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';
import ForSchools from './pages/ForSchools';
import Contact from './pages/Contact';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import VerifyEmail from './pages/auth/VerifyEmail';
import ResetPassword from './pages/auth/ResetPassword';
import NewPassword from './pages/auth/NewPassword';
import ParentLayout from './layouts/ParentLayout';
import ParentPayPortal from './pages/parent/ParentPayPortal';
import PaymentHistory from './pages/parent/PaymentHistory';
import RequestPlan from './pages/parent/RequestPlan';
import ContactSchool from './pages/parent/ContactSchool';
import InvalidLink from './pages/parent/InvalidLink';
import DashboardLayout from './components/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Students from './pages/dashboard/Students';
import Payments from './pages/dashboard/Payments';
import InstallmentPlans from './pages/dashboard/InstallmentPlans';
import SmsReminders from './pages/dashboard/SmsReminders';
import SmsCreditRequests from './pages/dashboard/SmsCreditRequests';
import ParentMessages from './pages/dashboard/ParentMessages';
import Advertisements from './pages/dashboard/Advertisements';
import Reports from './pages/dashboard/Reports';
import ActivityLog from './pages/dashboard/ActivityLog';
import UserManagement from './pages/dashboard/UserManagement';
import Settings from './pages/dashboard/Settings';
import OnboardingLayout from './pages/onboarding/OnboardingLayout';
import Step1SchoolProfile from './pages/onboarding/Step1SchoolProfile';
import Step2PaymentSetup from './pages/onboarding/Step2PaymentSetup';
import Step3ImportStudents from './pages/onboarding/Step3ImportStudents';
import StepPricing from './pages/onboarding/StepPricing';
import Step4SendReminder from './pages/onboarding/Step4SendReminder';
import AdminLayout from './components/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminContent from './pages/admin/AdminContent';
import AdminAdCreate from './pages/admin/AdminAdCreate';
import SchoolsList from './pages/admin/schools/SchoolsList';
import SchoolDetail from './pages/admin/schools/SchoolDetail';
import SchoolCreate from './pages/admin/schools/SchoolCreate';
import UsersList from './pages/admin/users/UsersList';
import UserDetail from './pages/admin/users/UserDetail';
import PaymentsList from './pages/admin/payments/PaymentsList';
import PaymentDetail from './pages/admin/payments/PaymentDetail';
import FinanceOverview from './pages/admin/finance/FinanceOverview';
import LedgerList from './pages/admin/finance/LedgerList';
import DisbursementsList from './pages/admin/finance/DisbursementsList';
import DisbursementDetail from './pages/admin/finance/DisbursementDetail';
import Reconciliation from './pages/admin/finance/Reconciliation';
import InvoicesList from './pages/admin/finance/InvoicesList';
import SmsOverview from './pages/admin/sms/SmsOverview';
import SmsCredits from './pages/admin/sms/SmsCredits';
import SmsRequests from './pages/admin/sms/SmsRequests';
import SmsLogs from './pages/admin/sms/SmsLogs';
import AnnouncementsList from './pages/admin/announcements/AnnouncementsList';
import AnnouncementCreate from './pages/admin/announcements/AnnouncementCreate';
import AnnouncementEdit from './pages/admin/announcements/AnnouncementEdit';
import AuditLogList from './pages/admin/auditLogs/AuditLogList';
import AuditLogDetail from './pages/admin/auditLogs/AuditLogDetail';
import AnalyticsDashboard from './pages/admin/analytics/AnalyticsDashboard';
import RevenueAnalytics from './pages/admin/analytics/RevenueAnalytics';
import SchoolsAnalytics from './pages/admin/analytics/SchoolsAnalytics';
import CollectionRateAnalytics from './pages/admin/analytics/CollectionRateAnalytics';
import SystemHealth from './pages/admin/health/SystemHealth';
import ReportsCenter from './pages/admin/reports/ReportsCenter';
import PlatformSettings from './pages/admin/settings/PlatformSettings';
import ImpersonationHistory, {
  ImpersonationSessionDetail,
} from './pages/admin/impersonation/ImpersonationHistory';
import { Terms, Privacy } from './pages/Legal';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      {/*
        ToastProvider sits above BrowserRouter so any page or future
        non-router surface (the marketing navbar, a future worker) can raise a
        notification without a route context.
      */}
      <ToastProvider>
        <BrowserRouter>
          {/*
            AppChrome owns the navbar and footer for every route below it. It
            sits outside <Routes> so it mounts once and stays mounted for the
            life of the app; only the page component below <Outlet /> changes.
          */}
          <Routes>
            <Route element={<AppChrome />}>
              <Route path="/" element={<Home />} />
              <Route path="/features" element={<Features />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/for-schools" element={<ForSchools />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              {/* Both reset routes are listed: the previous exact-match check
                  missed `/reset-password/:token`, so the emailed reset link
                  rendered the new-password screen without the auth chrome. */}
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/reset-password/:token" element={<NewPassword />} />

              {/*
                The marketing catch-all, and the reason it is the *only* one.

                It used to be the single catch-all for the whole app, which fixed
                the marketing pages and quietly broke the other two shells: an
                unmatched path under /dashboard or /pay fell through to it and
                arrived wearing the marketing navbar and a footer of product links.
                Each guarded subtree below now carries its own, so a mistyped
                module path stays inside the console the person is working in.
              */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* The wizard is a sibling of AppChrome, not a child: it renders
                its own Navbar and must not pick up the marketing footer. */}
            <Route element={<OnboardingGuard />}>
              <Route path="/onboarding" element={<OnboardingLayout />}>
                <Route index element={<Navigate to="school-profile" replace />} />
                <Route path="school-profile" element={<Step1SchoolProfile />} />
                <Route path="payment-setup" element={<Step2PaymentSetup />} />
                <Route path="import-students" element={<Step3ImportStudents />} />
                <Route path="pricing" element={<StepPricing />} />
                <Route path="send-reminder" element={<Step4SendReminder />} />
                <Route path="*" element={<NotFound variant="app" />} />
              </Route>
            </Route>

            {/* The management system, and the same decision as the wizard
                above: it mounts its own shell and must not pick up the
                marketing navbar and footer, which cost vertical space an
                authenticated admin needs for the module they are working in.
                The shell carries a "Back to website" link, so the way out of
                the app is not lost with the navbar.

                One route group, one shell, nine modules as children. Nesting
                is what makes the subtree a single unit the guard can gate, and
                what lets a new module be one <Route> plus one nav entry rather
                than a new guarded branch. The shell owns the rail and the
                topbar; each child owns only its page. */}
            <Route element={<OnboardingGuard />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                {/*
                  A platform admin opening /dashboard is sent to the console that
                  belongs to them.

                  `OnboardingGuard` waves a `super_admin` straight through — they
                  legitimately have no school, so `linkState.linked` is false for
                  them and the onboarding redirect would lock them out of the only
                  console they have. But every module under /dashboard is
                  school-scoped, so the alternative was a school console full of
                  empty panels around a rail that says "Your school". The redirect
                  is here rather than in the guard because it is a *routing*
                  preference about where a super admin lands, not an access rule:
                  the guard still decides they are allowed in.
                */}
                <Route
                  index
                  element={
                    <RoleLanding role="super_admin" to={ROUTES.ADMIN}>
                      <Overview />
                    </RoleLanding>
                  }
                />
                <Route path="students" element={<Students />} />
                <Route path="payments" element={<Payments />} />
                <Route path="installment-plans" element={<InstallmentPlans />} />
                <Route path="sms-reminders" element={<SmsReminders />} />
                <Route path="sms-requests" element={<SmsCreditRequests />} />
                <Route path="messages" element={<ParentMessages />} />
                <Route path="advertisements" element={<Advertisements />} />
                <Route path="reports" element={<Reports />} />
                <Route path="activity-log" element={<ActivityLog />} />
                <Route path="user-management" element={<UserManagement />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound variant="app" />} />
              </Route>
            </Route>

            {/*
              The platform console: the whole system, seen from outside any school.

              A third sibling shell rather than a branch of the dashboard, and the
              same reasoning as the wizard above: it mounts its own rail and topbar
              and must not pick up the marketing navbar or a school console's
              chrome. Nesting it under /dashboard was never an option — that shell
              binds to `user.schoolId`, and a super_admin has none.

              Gated by `AdminGuard`, which is the app's only *role* check. The
              server's `authorize("super_admin")` on `admin.routes.js:37` is the
              real boundary; this is the version that says so before the first
              request rather than after it.

              Five modules, one guard, one nav definition — same contract as
              /dashboard, so a new console module is one <Route> plus one entry in
              `ADMIN_NAV`.

              **The console is now eighteen modules**, and the ordering below is not
              alphabetical — it is the order the rail groups them in (`ADMIN_NAV`),
              so that a route added here is added in the place a reader would look for
              it. Two placement rules are load-bearing and both are about Express-
              shaped patterns under React Router, which matches in declaration order:

                - **`schools/new` before `schools/:schoolId`.** Reversed, `new` is read
                  as a school id, and the create form becomes a school detail page for
                  a school named "new".
                - **`announcements/new` before `announcements/:id`,** for the same
                  reason, and **disbursements/:batchId` last** among its siblings so it
                  cannot shadow the list.

              `AdminGuard` does more than check the role: while an impersonation
              session is open it redirects every path outside the impersonated
              school's scope back to that school. The server enforces the read-only
              half; this is the half that stops an operator wandering into everyone's
              finance while wearing one school's banner.
            */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />

                <Route path="schools" element={<SchoolsList />} />
                <Route path="schools/new" element={<SchoolCreate />} />
                <Route path="schools/:schoolId" element={<SchoolDetail />} />

                <Route path="users" element={<UsersList />} />
                <Route path="users/:userId" element={<UserDetail />} />

                <Route path="payments" element={<PaymentsList />} />
                <Route path="payments/:paymentId" element={<PaymentDetail />} />

                <Route path="finance" element={<FinanceOverview />} />
                <Route path="finance/ledger" element={<LedgerList />} />
                <Route path="finance/disbursements" element={<DisbursementsList />} />
                <Route path="finance/disbursements/:batchId" element={<DisbursementDetail />} />
                <Route path="finance/reconciliation" element={<Reconciliation />} />
                <Route path="finance/invoices" element={<InvoicesList />} />

                <Route path="sms" element={<SmsOverview />} />
                <Route path="sms/requests" element={<SmsRequests />} />
                <Route path="sms/credits" element={<SmsCredits />} />
                <Route path="sms/logs" element={<SmsLogs />} />

                <Route path="announcements" element={<AnnouncementsList />} />
                <Route path="announcements/new" element={<AnnouncementCreate />} />
                <Route path="announcements/:id" element={<AnnouncementEdit />} />

                <Route path="audit-logs" element={<AuditLogList />} />
                <Route path="audit-logs/:id" element={<AuditLogDetail />} />
                <Route path="impersonation" element={<ImpersonationHistory />} />
                <Route path="impersonation/:sessionId" element={<ImpersonationSessionDetail />} />

                <Route path="analytics" element={<AnalyticsDashboard />} />
                <Route path="analytics/revenue" element={<RevenueAnalytics />} />
                <Route path="analytics/schools" element={<SchoolsAnalytics />} />
                <Route path="analytics/collection-rate" element={<CollectionRateAnalytics />} />

                <Route path="health" element={<SystemHealth />} />
                <Route path="reports" element={<ReportsCenter />} />
                <Route path="content" element={<AdminContent />} />
                {/*
                  `content/new` has no `content/:id` sibling to be shadowed by — the
                  queue is a list without a detail route, because reviewing is done in
                  a dialog on the row. It still sits directly after `content` so the
                  pair reads as one module, and `isNavItemActive`'s prefix matching is
                  what keeps Content lit as the current module here.
                */}
                <Route path="content/new" element={<AdminAdCreate />} />
                <Route path="settings" element={<PlatformSettings />} />

                <Route path="*" element={<NotFound variant="admin" />} />
              </Route>
            </Route>

            {/*
              The parent pay portal — a sibling of AppChrome like the wizard.

              It has to be: a parent opening an SMS link has no account, so the
              marketing navbar would offer them "Sign in" and a footer of links to
              products they are not shopping for, and the pay token in the URL is
              the only credential involved. The portal carries its own minimal
              header and nothing else.

              `ParentLayout` owns the read model for the whole subtree, so moving
              between the fee page, the history, the plan request and the support
              form is a client-side route change with no re-fetch — which on the
              3G connection this is built for is the difference between a site and
              a series of pages.
            */}
            <Route path="/pay" element={<ParentLayout />}>
              {/*
                Declared before `/pay/:token` for readability only — React Router
                ranks the static segment above the dynamic one, so `/pay/invalid`
                can never be read as a token. Saying so, because the two being
                adjacent is exactly the shape that *does* break in a router that
                matches in declaration order.
              */}
              <Route path="invalid" element={<InvalidLink />} />
              <Route path=":token" element={<ParentPayPortal />} />
              <Route path=":token/history" element={<PaymentHistory />} />
              <Route path=":token/plan/request" element={<RequestPlan />} />
              <Route path=":token/support" element={<ContactSchool />} />
            </Route>

            {/*
              A malformed pay path — `/pay/` on its own, with no token.

              This used to fall through to the marketing catch-all, so a parent
              whose SMS link had been truncated by a messaging app arrived at the
              marketing navbar and a footer of product links. A fee link is the
              worst possible place to advertise, and the parent has no account to
              reach anything else from, so this variant offers contact and
              nothing else.
            */}
            <Route path="/pay/*" element={<NotFound variant="pay" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
