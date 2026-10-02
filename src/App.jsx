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
import PayPage from './pages/pay/PayPage';
import DashboardLayout from './components/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Students from './pages/dashboard/Students';
import Payments from './pages/dashboard/Payments';
import InstallmentPlans from './pages/dashboard/InstallmentPlans';
import SmsReminders from './pages/dashboard/SmsReminders';
import Reports from './pages/dashboard/Reports';
import ActivityLog from './pages/dashboard/ActivityLog';
import UserManagement from './pages/dashboard/UserManagement';
import Settings from './pages/dashboard/Settings';
import OnboardingLayout from './pages/onboarding/OnboardingLayout';
import Step1SchoolProfile from './pages/onboarding/Step1SchoolProfile';
import Step2PaymentSetup from './pages/onboarding/Step2PaymentSetup';
import Step3ImportStudents from './pages/onboarding/Step3ImportStudents';
import Step4SendReminder from './pages/onboarding/Step4SendReminder';
import AdminLayout from './components/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminSchools from './pages/admin/AdminSchools';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminSettings from './pages/admin/AdminSettings';
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
            */}
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="schools" element={<AdminSchools />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="content" element={<AdminContent />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<NotFound variant="admin" />} />
              </Route>
            </Route>

            {/*
              The parent-facing fee page, a sibling of AppChrome like the wizard.

              It has to be: a parent opening an SMS link has no account, so the
              marketing navbar would offer them "Sign in" and a footer of links to
              products they are not shopping for, and the pay token in the URL is
              the only credential involved. The page carries its own minimal header
              and nothing else.
            */}
            <Route path="/pay/:token" element={<PayPage />} />

            {/*
              A malformed pay path — `/pay/`, or a stray segment under it.

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
