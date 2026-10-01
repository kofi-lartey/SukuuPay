import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppChrome from './components/layout/AppChrome';
import OnboardingGuard from './routes/OnboardingGuard';

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
                <Route index element={<Overview />} />
                <Route path="students" element={<Students />} />
                <Route path="payments" element={<Payments />} />
                <Route path="installment-plans" element={<InstallmentPlans />} />
                <Route path="sms-reminders" element={<SmsReminders />} />
                <Route path="reports" element={<Reports />} />
                <Route path="activity-log" element={<ActivityLog />} />
                <Route path="user-management" element={<UserManagement />} />
                <Route path="settings" element={<Settings />} />
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
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
