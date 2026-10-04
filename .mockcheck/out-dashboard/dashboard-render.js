import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { useLocation, Link, useNavigate, Outlet, useSearchParams, MemoryRouter, Routes, Route } from "react-router-dom";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef, useMemo, useId } from "react";
import { a as api, t as toApiError, r as runReport, d as downloadReport, R as REPORTS, b as REPORT_CATEGORIES } from "./assets/reports-BcS3xgcI.js";
import { Info, TriangleAlert, CircleAlert, CircleCheck, X, UserCog, Settings as Settings$1, ScrollText, ChartColumn, Megaphone, Coins, Inbox, MessageSquare, CalendarClock, CreditCard, Users, LayoutDashboard, Building2, ChevronUp, Bell, CheckCheck, Loader2, Trash2, Menu, GraduationCap, ChevronDown, Search, Plus, User, LogOut, AlertTriangle, RotateCcw, TrendingUp, ChevronRight, Send, Download, Receipt, HandCoins, SlidersHorizontal, Hourglass, ChevronLeft, ArrowUp, ArrowDown, PencilLine, Ban, Link as Link$1, Archive, CirclePlay, Wallet, History, Star, ShieldCheck, Camera, UploadCloud, ImageOff, FileSpreadsheet, Check, Sparkles, ArrowUpRight, ArrowRight, ArrowLeft, QrCode, Printer, BadgeCheck, Eye, FileText, UserPlus, Smartphone, Clock, ArrowDownRight, RefreshCw, Landmark, Banknote, ExternalLink, CheckCircle2, AlertCircle, List, LayoutGrid, BellRing, CalendarX2, CalendarDays, CircleDollarSign, Circle, Flag, Signal, Wifi, BatteryMedium, MoreVertical, Save, BarChart3, Filter, UserRound, AtSign, KeyRound, Lock, School } from "lucide-react";
import { createPortal } from "react-dom";
import "axios";
const TOKEN_KEYS = ["auth_token", "refresh_token"];
const storeTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) localStorage.setItem("auth_token", accessToken);
  if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
};
const clearTokens = () => TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
const toError = (error, fallback) => {
  const message = error?.response?.data?.message || error?.message;
  const wrapped = new Error(message || fallback);
  wrapped.status = error?.response?.status;
  wrapped.code = error?.response?.data?.code;
  return wrapped;
};
const login = async (email, password) => {
  try {
    const { data } = await api.post("/auth/login", { email, password });
    storeTokens(data.tokens || {});
    return { user: data.user, onboarding: data.onboarding, message: data.message };
  } catch (error) {
    throw toError(error, "Invalid email or password");
  }
};
const signup = async (payload) => {
  try {
    const { data } = await api.post("/auth/signup", payload);
    return { user: data.user, verification: data.verification, message: data.message };
  } catch (error) {
    if (error?.response?.data?.code === "EMAIL_SEND_FAILED") {
      return {
        user: null,
        verification: null,
        message: error.response.data.message,
        partial: true,
        emailSent: false
      };
    }
    throw toError(error, "Failed to create account. Please try again.");
  }
};
const signOutUser = async () => {
  try {
    await api.post("/auth/logout");
  } catch {
  } finally {
    clearTokens();
  }
};
const getCurrentUser = async () => {
  const { data } = await api.get("/auth/me");
  return { user: data.user, onboarding: data.onboarding };
};
let authListeners = [];
const notifyListeners = (user, onboarding) => {
  authListeners.forEach((listener) => listener({ user, onboarding }));
};
const onAuthChange = (callback) => {
  authListeners.push(callback);
  const token = localStorage.getItem("auth_token");
  if (token) {
    getCurrentUser().then((session) => notifyListeners(session.user, session.onboarding)).catch(() => {
      clearTokens();
      notifyListeners(null, null);
    });
  } else {
    notifyListeners(null, null);
  }
  return () => {
    authListeners = authListeners.filter((listener) => listener !== callback);
  };
};
window.addEventListener("storage", (event) => {
  if (!TOKEN_KEYS.includes(event.key)) return;
  const token = localStorage.getItem("auth_token");
  if (token) {
    getCurrentUser().then((session) => notifyListeners(session.user, session.onboarding)).catch(() => notifyListeners(null, null));
  } else {
    notifyListeners(null, null);
  }
});
const updateMe = async (userId, patch) => {
  try {
    const { data } = await api.put(`/users/${userId}`, patch);
    return data.user || data.data?.user || data.data || data;
  } catch (error) {
    throw toApiError(error, "Failed to save your profile.");
  }
};
const listUsers = async ({ page = 1, limit = 50, role, status } = {}) => {
  try {
    const { data } = await api.get("/users", { params: { page, limit, role, status } });
    return {
      users: data.users || [],
      pagination: data.pagination || { page, limit, total: 0, pages: 0 }
    };
  } catch (error) {
    throw toApiError(error, "Failed to load the team list.");
  }
};
const inviteUser = async (payload) => {
  try {
    const { data } = await api.post("/users/invite", payload);
    return { user: data.user, emailSent: data.emailSent === true, message: data.message };
  } catch (error) {
    throw toApiError(error, "Could not send that invitation.");
  }
};
const resendUserInvite = async (userId) => {
  try {
    const { data } = await api.post(`/users/${userId}/resend-invite`);
    return { user: data.user, emailSent: data.emailSent === true, message: data.message };
  } catch (error) {
    throw toApiError(error, "Could not re-send that invitation.");
  }
};
const updateUserRole = async (userId, role) => {
  try {
    const { data } = await api.put(`/users/${userId}/role`, { role });
    return data.user;
  } catch (error) {
    throw toApiError(error, "Could not change that role.");
  }
};
const removeUser = async (userId) => {
  try {
    const { data } = await api.delete(`/users/${userId}`);
    return data;
  } catch (error) {
    throw toApiError(error, "Could not remove that user.");
  }
};
const AuthContext = createContext();
const ONBOARDING_FLAG_KEY = "sukuupay_onboarding_completed";
const readOnboardingFlag = (userId) => userId ? localStorage.getItem(`${ONBOARDING_FLAG_KEY}_${userId}`) === "true" : false;
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
const UNKNOWN_LINK_STATE = {
  linked: false,
  reason: "UNKNOWN",
  schoolId: null,
  completed: false,
  highestStep: 0,
  nextRoute: null
};
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(UNKNOWN_LINK_STATE);
  const [school, setSchool] = useState(null);
  useEffect(() => {
    if (!user) {
      setOnboarding(UNKNOWN_LINK_STATE);
      setSchool(null);
      return;
    }
    setOnboarding((current) => ({
      ...current,
      // The API is authoritative. The localStorage read only fills the gap while
      // the server says nothing, so a cleared flag can never strand a bursar in
      // the wizard after the server confirmed they finished.
      completed: user.onboardingCompleted === true || readOnboardingFlag(user._id),
      highestStep: user.onboardingHighestStep ?? current.highestStep ?? 0
    }));
  }, [user?._id, user?.onboardingCompleted, user?.onboardingHighestStep]);
  const applySession = useCallback((userData, linkState) => {
    setUser(userData ?? null);
    if (!userData) {
      setOnboarding(UNKNOWN_LINK_STATE);
      return;
    }
    setOnboarding({
      ...UNKNOWN_LINK_STATE,
      ...linkState || {},
      linked: linkState?.linked ?? Boolean(userData.schoolId),
      completed: userData.onboardingCompleted === true || readOnboardingFlag(userData._id),
      highestStep: userData.onboardingHighestStep ?? 0
    });
  }, []);
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const session = await getCurrentUser();
          if (mounted) applySession(session.user, session.onboarding);
        } catch (error) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          if (mounted) applySession(null);
        }
      }
      if (mounted) setLoading(false);
    };
    checkAuth();
    const unsubscribe = onAuthChange((session) => {
      applySession(session?.user ?? null, session?.onboarding);
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applySession]);
  const login$1 = async (email, password) => {
    const { user: signedIn, onboarding: linkState, message } = await login(email, password);
    applySession(signedIn, linkState);
    return { user: signedIn, onboarding: linkState, message };
  };
  const signup$1 = async (payload) => {
    const result = await signup(payload);
    applySession(null);
    return result;
  };
  const logout = useCallback(async () => {
    await signOutUser();
    applySession(null);
  }, [applySession]);
  const refreshUser = useCallback(async () => {
    const session = await getCurrentUser();
    applySession(session.user, session.onboarding);
    if (session.onboarding?.linked && session.onboarding.schoolId) {
      setSchool((current) => current ?? null);
    }
    return session.user;
  }, [applySession]);
  const applyUser = useCallback((nextUser, linkState) => {
    applySession(nextUser ?? user, linkState);
  }, [applySession, user]);
  const markOnboardingComplete = useCallback(async () => {
    const userId = user?._id;
    if (!userId) return;
    localStorage.setItem(`${ONBOARDING_FLAG_KEY}_${userId}`, "true");
    setOnboarding((current) => ({ ...current, completed: true }));
    try {
      const updated = await updateMe(userId, { onboardingCompleted: true });
      if (updated?.onboardingCompleted !== void 0) {
        setOnboarding((current) => ({ ...current, completed: updated.onboardingCompleted }));
      }
    } catch {
    }
  }, [user?._id]);
  const saveOnboardingStep = useCallback(
    (step) => {
      const userId = user?._id;
      if (!userId) return;
      setOnboarding(
        (current) => current.highestStep >= step ? current : { ...current, highestStep: step }
      );
      updateMe(userId, { onboardingHighestStep: step }).catch(() => {
      });
    },
    [user?._id]
  );
  const needsSchoolProvisioning = Boolean(user) && onboarding.linked === false && user.role !== "super_admin";
  const value = {
    user,
    school,
    setSchool,
    onboarding,
    linkState: onboarding,
    needsSchoolProvisioning,
    login: login$1,
    signup: signup$1,
    logout,
    loading,
    onboardingCompleted: onboarding.completed,
    markOnboardingComplete,
    saveOnboardingStep,
    refreshUser,
    applyUser
  };
  return /* @__PURE__ */ jsx(AuthContext.Provider, { value, children });
};
const ToastContext = createContext(null);
const TONES$2 = {
  success: {
    icon: CircleCheck,
    ring: "border-brand-200 bg-brand-50 text-brand-800",
    iconClass: "text-brand-600"
  },
  error: {
    icon: CircleAlert,
    ring: "border-red-200 bg-red-50 text-red-800",
    iconClass: "text-red-600"
  },
  warning: {
    icon: TriangleAlert,
    ring: "border-amber-200 bg-amber-50 text-amber-800",
    iconClass: "text-amber-600"
  },
  info: {
    icon: Info,
    ring: "border-slate-200 bg-slate-50 text-slate-700",
    iconClass: "text-slate-500"
  }
};
const DISMISS_AFTER_MS = 5e3;
let nextId = 0;
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(/* @__PURE__ */ new Map());
  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);
  const push = useCallback(
    (message, tone = "info") => {
      const id = `toast_${nextId += 1}`;
      setToasts((current) => [...current, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS)
      );
      return id;
    },
    [dismiss]
  );
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);
  const value = useMemo(
    () => ({
      toast: push,
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      warning: (message) => push(message, "warning"),
      info: (message) => push(message, "info"),
      dismiss
    }),
    [push, dismiss]
  );
  return /* @__PURE__ */ jsxs(ToastContext.Provider, { value, children: [
    children,
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6",
        role: "region",
        "aria-label": "Notifications",
        children: toasts.map(({ id, message, tone }) => {
          const { icon: Icon, ring, iconClass } = TONES$2[tone] || TONES$2.info;
          return /* @__PURE__ */ jsxs(
            "div",
            {
              role: "status",
              "aria-live": "polite",
              className: `pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-soft ${ring}`,
              children: [
                /* @__PURE__ */ jsx(Icon, { className: `mt-px h-4 w-4 shrink-0 ${iconClass}`, "aria-hidden": "true" }),
                /* @__PURE__ */ jsx("p", { className: "min-w-0 flex-1 text-[13px] font-semibold leading-snug", children: message }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => dismiss(id),
                    "aria-label": "Dismiss notification",
                    className: "-mr-1 shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100",
                    children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                  }
                )
              ]
            },
            id
          );
        })
      }
    )
  ] });
};
const ROUTES = {
  HOME: "/",
  FEATURES: "/features",
  PRICING: "/pricing",
  HOW_IT_WORKS: "/how-it-works",
  FOR_SCHOOLS: "/for-schools",
  CONTACT: "/contact",
  LOGIN: "/login",
  SIGNUP: "/signup",
  VERIFY_EMAIL: "/verify-email",
  RESET_PASSWORD: "/reset-password",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  DASHBOARD: "/dashboard",
  // Dashboard modules nest under DASHBOARD so the whole management system is one
  // guarded subtree: a single `<Route path="/dashboard">` owns the shell, and
  // the guard's one dashboard check covers every module beneath it.
  DASHBOARD_STUDENTS: "/dashboard/students",
  DASHBOARD_PAYMENTS: "/dashboard/payments",
  DASHBOARD_PLANS: "/dashboard/installment-plans",
  DASHBOARD_SMS: "/dashboard/sms-reminders",
  DASHBOARD_SMS_PURCHASE: "/dashboard/sms-requests",
  DASHBOARD_REPORTS: "/dashboard/reports",
  DASHBOARD_MESSAGES: "/dashboard/messages",
  DASHBOARD_ACTIVITY: "/dashboard/activity-log",
  DASHBOARD_USERS: "/dashboard/user-management",
  DASHBOARD_SETTINGS: "/dashboard/settings",
  DASHBOARD_ADVERTISEMENTS: "/dashboard/advertisements",
  ONBOARDING: "/onboarding",
  // The platform console. A sibling of DASHBOARD, not a child of it, and the
  // path matches the API's base path (`/api/admin`) exactly — so the service
  // layer below maps one-to-one onto `Backend/src/routes/admin.routes.js` with no
  // prefix translation, and a route in one is findable in the other by name.
  //
  // Separate rather than nested for a structural reason: `DashboardLayout` binds
  // to school data (`useDashboardOverview(user?.schoolId)`, the school-scoped SMS
  // pill, the school card in the rail), and a `super_admin` has `schoolId: null`
  // by design. Nested under /dashboard it would mount a school console around a
  // platform admin and read "Your school" forever.
  ADMIN: "/admin",
  ADMIN_SCHOOLS: "/admin/schools",
  ADMIN_USERS: "/admin/users",
  ADMIN_CONTENT: "/admin/content",
  ADMIN_SETTINGS: "/admin/settings",
  ADMIN_PAYMENTS: "/admin/payments",
  ADMIN_FINANCE: "/admin/finance",
  ADMIN_SMS: "/admin/sms",
  ADMIN_ANNOUNCEMENTS: "/admin/announcements",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_HEALTH: "/admin/health",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_IMPERSONATION: "/admin/impersonation"
};
const GRADUATION_TYPES = [
  { value: "STANDARD", label: "Standard" },
  { value: "EARLY", label: "Early graduation" },
  { value: "HONORARY", label: "Honorary" },
  { value: "DEFERRED", label: "Deferred" }
];
const TRANSFER_REASONS = [
  { value: "RELOCATION", label: "Family relocation" },
  { value: "ACADEMIC", label: "Academic transfer" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "PERSONAL", label: "Personal" },
  { value: "EXPULSION", label: "Expulsion" },
  { value: "OTHER", label: "Other" }
];
const INSTITUTION_TYPES = [
  { value: "PUBLIC_SCHOOL", label: "Public school" },
  { value: "PRIVATE_SCHOOL", label: "Private school" },
  { value: "INTERNATIONAL_SCHOOL", label: "International school" },
  { value: "HOMESCHOOL", label: "Homeschool" },
  { value: "VOCATIONAL", label: "Vocational school" },
  { value: "COLLEGE_UNIVERSITY", label: "College / University" },
  { value: "OTHER", label: "Other" }
];
const DASHBOARD_NAV = [
  {
    id: "overview",
    label: null,
    items: [
      {
        to: ROUTES.DASHBOARD,
        label: "Dashboard",
        icon: "LayoutDashboard",
        exact: true,
        description: "Collection position and what needs attention today."
      }
    ]
  },
  {
    id: "records",
    label: "Records",
    items: [
      {
        to: ROUTES.DASHBOARD_STUDENTS,
        label: "Students",
        icon: "Users",
        description: "Roster, imports, class transfers and parent contacts."
      },
      {
        to: ROUTES.DASHBOARD_PAYMENTS,
        label: "Payments",
        icon: "CreditCard",
        description: "Every MoMo payment, its receipt and its refunds."
      },
      {
        to: ROUTES.DASHBOARD_PLANS,
        label: "Installment Plans",
        icon: "CalendarClock",
        description: "Split a student bill into dated installments."
      }
    ]
  },
  {
    id: "outreach",
    label: "Outreach",
    items: [
      {
        to: ROUTES.DASHBOARD_SMS,
        label: "SMS Reminders",
        icon: "MessageSquare",
        description: "Nudge parents who have not paid, and track delivery."
      },
      {
        to: ROUTES.DASHBOARD_SMS_PURCHASE,
        label: "Buy SMS Credit",
        icon: "Coins",
        // A bursar and an accountant only — the same roles the server admits
        // (`smsRequest.routes.js` → `authorize('school_admin', 'accountant')`).
        // Spending the school's money is not a teacher's decision, and this entry sits
        // next to a read-only one, so a visible purchase button would be the first sign
        // that role separation here is decorative.
        roles: ["super_admin", "school_admin", "accountant"],
        description: "Pay for messages, with an administrator releasing the credit."
      },
      {
        to: ROUTES.DASHBOARD_MESSAGES,
        label: "Parent Messages",
        icon: "Inbox",
        // `school_admin` and `accountant` — the same two roles
        // `findSchoolRecipients` in `pay.service.js` alerts about a parent message.
        //
        // **`teacher` is deliberately excluded.** This module carries every parent
        // phone number in the school in full, alongside what they wrote about a
        // balance. `findSchoolRecipients` already draws that line and states why:
        // "a teacher has no business acting on a balance dispute". Reading the
        // dispute is the same act as acting on it. Letting the rail expose this to
        // every teacher would hand the entire staff room the contact list, which is
        // the one thing the masked copy in `Notification` exists to prevent — and it
        // would make that masking pointless, since the inbox sits one click away.
        roles: ["super_admin", "school_admin", "accountant"],
        description: "What parents wrote or recorded from their fee link."
      }
    ]
  },
  {
    id: "insight",
    label: "Insight",
    items: [
      {
        to: ROUTES.DASHBOARD_REPORTS,
        label: "Reports",
        icon: "ChartColumn",
        description: "Daily, term, outstanding and compliance reporting."
      },
      {
        to: ROUTES.DASHBOARD_ACTIVITY,
        label: "Activity Log",
        icon: "ScrollText",
        description: "Who changed what, and when."
      }
    ]
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        to: ROUTES.DASHBOARD_USERS,
        label: "User Management",
        icon: "UserCog",
        // Same audience as Settings, and for a sharper reason. Inviting a
        // colleague mints a credential and names them to a third party, so it is
        // an administrative act with an audit trail — not something a teacher or
        // a bursar should be able to do for their colleagues. Hiding the module
        // keeps the rail honest about who administers what; the server's
        // `authorize('super_admin', 'school_admin')` remains the boundary, and
        // this must never be the thing that enforces it.
        roles: ["super_admin", "school_admin"],
        description: "Invite colleagues, manage roles and review who has access."
      },
      {
        to: ROUTES.DASHBOARD_SETTINGS,
        label: "Settings",
        icon: "Settings",
        // A teacher's job is records; a bursar's is money. Both would find the
        // school's paystack settings and billing page in Settings irrelevant at
        // best and alarming at worst, so the module is hidden rather than shown
        // disabled — a rail full of dead entries trains people to ignore it.
        // This is presentation only: the server's `authorize` is the boundary,
        // and hiding an entry must never be the thing that enforces it.
        roles: ["super_admin", "school_admin"],
        description: "School profile, academic year, paystack and billing."
      },
      {
        to: ROUTES.DASHBOARD_ADVERTISEMENTS,
        label: "Advertisements",
        icon: "Megaphone",
        // `school_admin` and `accountant`, matching
        // `requireAdvertiser` in `schoolAd.routes.js`.
        //
        // Deliberately **not** in the Outreach group. That group is read-and-act on the
        // school's own parents, and an ad request is the school asking the *platform*
        // for something — a different direction of travel, and it does not belong in
        // the same rail section as SMS reminders.
        roles: ["super_admin", "school_admin", "accountant"],
        description: "Ask to be advertised, and track the decision."
      }
    ]
  }
];
const canAccessNavItem = (role, item) => {
  if (!item?.roles) return true;
  if (!role) return true;
  return item.roles.includes(role);
};
const visibleNav = (nav, role) => nav.map((group) => ({
  ...group,
  items: group.items.filter((item) => canAccessNavItem(role, item))
})).filter((group) => group.items.length > 0);
const visibleDashboardNav = (role) => visibleNav(DASHBOARD_NAV, role);
const isNavItemActive = (pathname, item) => item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
const SIGNUP_ROLES = [
  {
    value: "school_admin",
    label: "School administrator",
    description: "Full access, including payments, staff and settings.",
    canCreateSchool: true
  },
  {
    value: "accountant",
    label: "Accountant / bursar",
    description: "Payments, receipts and financial reports.",
    canCreateSchool: false
  },
  {
    value: "teacher",
    label: "Teacher",
    description: "Student records and class information.",
    canCreateSchool: false
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to reports and records.",
    canCreateSchool: false
  }
];
const USER_ROLES = ["super_admin", "school_admin", "accountant", "teacher", "viewer"];
const ROLE_LABELS = {
  super_admin: "Platform admin",
  school_admin: "School administrator",
  accountant: "School bursar",
  teacher: "Teacher",
  viewer: "Viewer"
};
const roleLabel = (role) => ROLE_LABELS[role] || "Signed in";
const OTHER_POSITION = "OTHER";
const POSITIONS = [
  { value: "Headteacher / Headmistress", label: "Headteacher / Headmistress" },
  { value: "Proprietor / Proprietress", label: "Proprietor / Proprietress" },
  { value: "Administrator", label: "Administrator" },
  { value: "Accountant", label: "Accountant" },
  { value: "Bursar", label: "Bursar" },
  { value: "Registrar", label: "Registrar" },
  { value: "Librarian", label: "Librarian" },
  { value: "Senior Teacher", label: "Senior Teacher" },
  { value: "Teacher", label: "Teacher" },
  { value: "School Secretary", label: "School Secretary" },
  { value: "Parent / Guardian", label: "Parent / Guardian" },
  { value: OTHER_POSITION, label: "Other" }
];
const STUDENT_IMPORT_COLUMNS = [
  "Student Name",
  "Student Class",
  "Gender",
  "Date Of Birth",
  "Parent Name",
  "Parent Phone",
  "Parent Email",
  "Parent Relationship",
  "Total Owed",
  "Deadline"
];
const ICONS = {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarClock,
  MessageSquare,
  Inbox,
  Coins,
  Megaphone,
  ChartColumn,
  ScrollText,
  Settings: Settings$1,
  UserCog
};
const DashboardSidebar = ({ user, school, variant = "fixed", className = "", onClose }) => {
  const { pathname } = useLocation();
  const groups = visibleDashboardNav(user?.role);
  const isDrawer = variant === "drawer";
  return /* @__PURE__ */ jsxs(
    "aside",
    {
      className: `flex-col border-slate-200 bg-white ${isDrawer ? "border-r shadow-2xl" : "sticky top-0 h-screen border-r"} ${className}`,
      "aria-label": "Dashboard modules",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-lg font-extrabold tracking-tight text-ink", children: [
            "Sukuu",
            /* @__PURE__ */ jsx("span", { className: "text-brand-700", children: "Pay" })
          ] }),
          isDrawer && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: onClose,
              "aria-label": "Close navigation",
              className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink",
              children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx("nav", { className: "min-h-0 flex-1 overflow-y-auto px-3 py-4", children: /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1", children: groups.flatMap((group) => group.items).map((item) => {
          const Icon = ICONS[item.icon] || LayoutDashboard;
          const active = isNavItemActive(pathname, item);
          return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
            Link,
            {
              to: item.to,
              "aria-current": active ? "page" : void 0,
              title: item.description,
              className: `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${active ? "bg-brand-700 text-white shadow-lift" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`,
              children: [
                /* @__PURE__ */ jsx(Icon, { className: "h-[18px] w-[18px] shrink-0", "aria-hidden": "true" }),
                /* @__PURE__ */ jsx("span", { className: "truncate", children: item.label })
              ]
            }
          ) }, item.to);
        }) }) }),
        /* @__PURE__ */ jsxs("div", { className: "shrink-0 border-t border-slate-100 p-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 rounded-xl bg-brand-700 p-3 text-white", children: [
            /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15", children: /* @__PURE__ */ jsx(Building2, { className: "h-4 w-4", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsxs(Link, { to: ROUTES.DASHBOARD_SETTINGS, className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight", children: school?.name || "Your school" }),
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-white/70", children: school?.city || "School settings" })
            ] }),
            /* @__PURE__ */ jsx(
              Link,
              {
                to: ROUTES.DASHBOARD_SETTINGS,
                "aria-label": "School settings",
                className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20",
                children: /* @__PURE__ */ jsx(ChevronUp, { className: "h-4 w-4", "aria-hidden": "true" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            Link,
            {
              to: ROUTES.HOME,
              className: "mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700",
              children: "Back to website"
            }
          )
        ] })
      ]
    }
  );
};
const PESEWAS_PER_CEDI = 100;
const nf = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const nfWhole = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });
const formatCedi = (pesewas) => `GH₵ ${nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;
const formatCediShort = (pesewas) => `GH₵ ${nfWhole.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;
const formatCedis = (pesewas) => nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI);
const formatCediWhole = (pesewas) => nfWhole.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI);
const formatCount = (value) => nfWhole.format(Number(value) || 0);
const formatPercent = (value) => {
  const n = Number(value) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};
const splitCedi = (pesewas) => {
  const [whole, fraction] = nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI).split(".");
  return { symbol: "GH₵", whole, fraction };
};
const LogoMark = ({ className = "w-12 h-12" }) => /* @__PURE__ */ jsx(
  "img",
  {
    src: "/sukuupay-logo.png",
    alt: "",
    "aria-hidden": "true",
    width: 256,
    height: 256,
    decoding: "async",
    className: `${className} shrink-0 object-contain`
  }
);
const NOTIFICATION_META = {
  "payment.received": { tone: "green", label: "Payment" },
  "plan.created": { tone: "blue", label: "Plan" },
  "plan.accepted": { tone: "green", label: "Plan" },
  "plan.overdue": { tone: "amber", label: "Arrears" },
  "student.imported": { tone: "slate", label: "Roster" },
  "sms.sent": { tone: "blue", label: "SMS" },
  "subscription.expiring": { tone: "amber", label: "Subscription" },
  "school.join_request": { tone: "amber", label: "Access" },
  "plan.requested": { tone: "amber", label: "Needs action" },
  "parent.message": { tone: "blue", label: "Parent" },
  "parent.audio_message": { tone: "blue", label: "Parent · voice" },
  "system.alert": { tone: "red", label: "System" }
};
const notificationMeta = (type) => NOTIFICATION_META[type] || NOTIFICATION_META["system.alert"];
const listNotifications = async ({
  page = 1,
  perPage = 20,
  read: read2,
  type
} = {}) => {
  try {
    const { data } = await api.get("/notifications", {
      params: {
        page,
        perPage,
        read: read2 === void 0 || read2 === null ? void 0 : String(Boolean(read2)),
        type: type || void 0
      }
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: {
        page: Number(data?.meta?.page) || 1,
        perPage: Number(data?.meta?.perPage) || perPage,
        total: Number(data?.meta?.total) || 0,
        totalPages: Math.max(1, Number(data?.meta?.totalPages) || 1),
        // The count is deliberately read from the server on every load rather than
        // derived from `rows`. A bell that says "3 unread" while the panel lists five
        // is worse than one that is briefly blank, because a bursar triages on it.
        unreadCount: Number(data?.meta?.unreadCount) || 0
      }
    };
  } catch (error) {
    throw toApiError(error, "Your notifications could not be loaded.");
  }
};
const fetchUnreadCount = async () => {
  try {
    const { data } = await api.get("/notifications", {
      params: { read: "false", perPage: 1, page: 1 }
    });
    return Number(data?.meta?.unreadCount) || 0;
  } catch (error) {
    return 0;
  }
};
const markNotificationRead = async (notificationId) => {
  try {
    const { data } = await api.put(`/notifications/${notificationId}/read`);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "That notification could not be marked as read.");
  }
};
const markAllNotificationsRead = async () => {
  try {
    const { data } = await api.put("/notifications/read-all");
    return Number(data?.data?.updatedCount) || 0;
  } catch (error) {
    throw toApiError(error, "Your notifications could not be cleared.");
  }
};
const deleteNotification = async (notificationId) => {
  try {
    await api.delete(`/notifications/${notificationId}`);
    return true;
  } catch (error) {
    throw toApiError(error, "That notification could not be deleted.");
  }
};
const notificationAge = (iso) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1e3));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
const POLL_MS = 6e4;
const useNotifications = ({ enabled = true } = {}) => {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, perPage: 20, total: 0, totalPages: 1, unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const openRef = useRef(open);
  openRef.current = open;
  const refreshBadge = useCallback(async () => {
    if (!enabled) return;
    try {
      const unreadCount = await fetchUnreadCount();
      setMeta((current) => current.unreadCount === unreadCount ? current : { ...current, unreadCount });
    } catch {
    }
  }, [enabled]);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listNotifications({ perPage: 20 });
      setRows(result.rows);
      setMeta(result.meta);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return void 0;
    refreshBadge();
    const tick = () => {
      if (document.visibilityState === "visible" && !openRef.current) {
        refreshBadge();
      }
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refreshBadge]);
  const handleToggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (next) load();
      return next;
    });
  }, [load]);
  const handleRead = useCallback(
    async (notificationId) => {
      const previous = rows.find((row) => String(row._id) === String(notificationId));
      if (!previous || previous.read) return;
      setRows(
        (current) => current.map(
          (row) => String(row._id) === String(notificationId) ? { ...row, read: true, readAt: (/* @__PURE__ */ new Date()).toISOString() } : row
        )
      );
      setMeta((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1)
      }));
      try {
        await markNotificationRead(notificationId);
      } catch (caught) {
        setRows(
          (current) => current.map((row) => String(row._id) === String(notificationId) ? previous : row)
        );
        setMeta((current) => ({
          ...current,
          unreadCount: current.unreadCount + 1
        }));
        toast?.error?.(caught?.message || "That could not be marked as read.");
      }
    },
    [rows, toast]
  );
  const handleReadAll = useCallback(async () => {
    if (meta.unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      await load();
      toast?.success?.("All notifications cleared.");
    } catch (caught) {
      toast?.error?.(caught?.message || "They could not be cleared.");
    }
  }, [load, meta.unreadCount, toast]);
  const handleDelete = useCallback(
    async (notificationId) => {
      try {
        await deleteNotification(notificationId);
        setRows((current) => current.filter((row) => String(row._id) !== String(notificationId)));
      } catch (caught) {
        toast?.error?.(caught?.message || "That could not be deleted.");
      }
    },
    [toast]
  );
  return {
    rows,
    meta,
    open,
    loading,
    error,
    unreadCount: meta.unreadCount,
    toggle: handleToggle,
    close: () => setOpen(false),
    read: handleRead,
    readAll: handleReadAll,
    remove: handleDelete,
    refresh: load,
    refreshBadge,
    // Presentation helpers passed down so the panel and any future second surface
    // render a type identically without each re-deriving the fallback.
    metaFor: notificationMeta,
    ageFor: notificationAge
  };
};
const NotificationBell = ({ className = "" }) => {
  const {
    rows,
    loading,
    error,
    open,
    unreadCount,
    toggle,
    close,
    read: read2,
    readAll,
    remove,
    metaFor,
    ageFor
  } = useNotifications();
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return void 0;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: `relative ${className}`, children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: toggle,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "aria-label": unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications",
        className: "relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
        children: [
          /* @__PURE__ */ jsx(Bell, { className: "h-5 w-5", "aria-hidden": "true" }),
          unreadCount > 0 ? /* @__PURE__ */ jsx(
            "span",
            {
              "aria-hidden": "true",
              className: "absolute right-1.5 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-none text-white",
              children: unreadCount > 99 ? "99+" : unreadCount
            }
          ) : null
        ]
      }
    ),
    open ? /* @__PURE__ */ jsxs(
      "div",
      {
        role: "dialog",
        "aria-label": "Notifications",
        className: "absolute right-0 z-50 mt-2 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Notifications" }),
            unreadCount > 0 ? /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: readAll,
                className: "inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-700 transition-colors hover:text-brand-800",
                children: [
                  /* @__PURE__ */ jsx(CheckCheck, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                  "Mark all read"
                ]
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "max-h-[26rem] overflow-y-auto", children: [
            loading && rows.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-2 px-4 py-10 text-slate-400", children: [
              /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
              /* @__PURE__ */ jsx("span", { className: "text-[13px]", children: "Loading…" })
            ] }) : null,
            error ? /* @__PURE__ */ jsx("p", { className: "px-4 py-6 text-center text-[13px] font-semibold text-red-600", children: error.message }) : null,
            !loading && !error && rows.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 px-4 py-10 text-center", children: [
              /* @__PURE__ */ jsx(Inbox, { className: "h-6 w-6 text-slate-300", "aria-hidden": "true" }),
              /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-slate-500", children: "Nothing new right now." }),
              /* @__PURE__ */ jsx("p", { className: "text-[12px] text-slate-400", children: "A parent message or a fee request will appear here." })
            ] }) : null,
            /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: rows.map((row) => {
              const meta = metaFor(row.type);
              const isParentMessage = row.type === "parent.message" || row.type === "parent.audio_message";
              return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
                "div",
                {
                  className: `flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${row.read ? "" : "bg-brand-50/40"}`,
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        "aria-hidden": "true",
                        className: `mt-1 h-2 w-2 shrink-0 rounded-full ${row.read ? "bg-transparent" : "bg-brand-700"}`
                      }
                    ),
                    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
                      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                        /* @__PURE__ */ jsx("p", { className: "min-w-0 text-[13px] font-extrabold leading-snug text-ink", children: row.title }),
                        /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[11px] font-semibold text-slate-400", children: ageFor(row.createdAt) })
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px] font-semibold text-slate-500", children: meta.label }),
                      isParentMessage && row.meta?.message ? /* @__PURE__ */ jsx("p", { className: "mt-1.5 rounded-lg bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-200", children: row.meta.message }) : /* @__PURE__ */ jsx("p", { className: "mt-1 text-[13px] leading-relaxed text-slate-600", children: row.message }),
                      row.meta?.audioUrl ? /* @__PURE__ */ jsx(
                        "audio",
                        {
                          controls: true,
                          preload: "none",
                          src: row.meta.audioUrl,
                          className: "mt-2 h-9 w-full max-w-[16rem]",
                          children: /* @__PURE__ */ jsx("a", { href: row.meta.audioUrl, download: true, children: "Download the voice note" })
                        }
                      ) : null,
                      isParentMessage && row.meta?.parentPhone ? /* @__PURE__ */ jsxs(
                        "a",
                        {
                          href: `tel:${row.meta.parentPhone}`,
                          className: "mt-1.5 inline-block text-[12px] font-extrabold text-brand-700 hover:underline",
                          children: [
                            "Call ",
                            row.meta.parentName,
                            " · ",
                            row.meta.parentPhone
                          ]
                        }
                      ) : null,
                      /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-3", children: [
                        /* @__PURE__ */ jsx(
                          Link,
                          {
                            to: row.link || "/dashboard/messages",
                            onClick: () => {
                              if (!row.read) read2(row._id);
                              close();
                            },
                            className: "text-[12px] font-extrabold text-brand-700 hover:underline",
                            children: isParentMessage ? "Open inbox" : "Open"
                          }
                        ),
                        !row.read ? /* @__PURE__ */ jsx(
                          "button",
                          {
                            type: "button",
                            onClick: () => read2(row._id),
                            className: "text-[12px] font-bold text-slate-500 hover:text-slate-700",
                            children: "Mark read"
                          }
                        ) : null,
                        /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => remove(row._id),
                            "aria-label": `Delete notification: ${row.title}`,
                            className: "inline-flex items-center gap-1 text-[12px] font-bold text-slate-400 hover:text-red-600",
                            children: [
                              /* @__PURE__ */ jsx(Trash2, { className: "h-3 w-3", "aria-hidden": "true" }),
                              "Delete"
                            ]
                          }
                        )
                      ] })
                    ] })
                  ]
                }
              ) }, row._id);
            }) })
          ] })
        ]
      }
    ) : null
  ] });
};
const Popover = ({ label, align = "left", width = "w-64", children, panel, className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return void 0;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return /* @__PURE__ */ jsxs("div", { ref: rootRef, className: `relative ${className}`, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "menu",
        className: "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
        children: label
      }
    ),
    open && /* @__PURE__ */ jsx(
      "div",
      {
        role: "menu",
        className: `absolute z-50 mt-2 ${width} ${align === "right" ? "right-0" : "left-0"} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft`,
        children: panel
      }
    )
  ] });
};
const TONES$1 = {
  brand: "bg-brand-50 text-brand-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-50 text-red-700",
  rose: "bg-rose-50 text-rose-700",
  blue: "bg-blue-50 text-blue-700",
  slate: "bg-slate-100 text-slate-600",
  ink: "bg-ink text-white",
  mtn: "bg-momo-mtn-soft text-momo-mtn-ink",
  telecel: "bg-momo-telecel-soft text-momo-telecel-ink",
  at: "bg-momo-at-soft text-momo-at-ink"
};
const NETWORK_DOTS = {
  mtn: "bg-momo-mtn",
  telecel: "bg-momo-telecel",
  at: "bg-momo-at"
};
const Badge = ({ children, tone = "slate", icon: Icon, dot, className = "" }) => /* @__PURE__ */ jsxs(
  "span",
  {
    className: `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${TONES$1[tone] || TONES$1.slate} ${className}`,
    children: [
      dot && /* @__PURE__ */ jsx("span", { className: `h-2 w-2 shrink-0 rounded-full ${NETWORK_DOTS[dot] || "bg-current"}` }),
      Icon && /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
      children
    ]
  }
);
const MenuItem = ({ to, icon: Icon, children, onClick }) => /* @__PURE__ */ jsxs(
  Link,
  {
    to,
    role: "menuitem",
    onClick,
    className: "flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-700",
    children: [
      Icon && /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4 text-slate-400", "aria-hidden": "true" }),
      children
    ]
  }
);
const DashboardTopbar = ({ user, onOpenNav, navOpen = false, school, term, smsCredit }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const displayName = user?.name || "Account";
  const roleLabelText = roleLabel(user?.role);
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const shortName = nameParts.length > 2 ? `${nameParts[0][0]}. ${nameParts.slice(1).join(" ")}` : displayName;
  const onSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    navigate(q ? `${ROUTES.DASHBOARD_STUDENTS}?q=${encodeURIComponent(q)}` : ROUTES.DASHBOARD_STUDENTS);
    setQuery("");
  };
  return /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white", children: /* @__PURE__ */ jsxs("div", { className: "flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: onOpenNav,
        "aria-label": "Open navigation",
        "aria-expanded": navOpen,
        "aria-controls": "dashboard-nav-drawer",
        className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden",
        children: /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
      }
    ),
    /* @__PURE__ */ jsxs(
      Link,
      {
        to: ROUTES.DASHBOARD,
        className: "flex shrink-0 items-center gap-2.5 pr-1",
        "aria-label": "SukuuPay dashboard",
        children: [
          /* @__PURE__ */ jsx(LogoMark, { className: "h-10 w-10" }),
          /* @__PURE__ */ jsxs("span", { className: "hidden text-lg font-extrabold tracking-tight text-ink sm:block", children: [
            "Sukuu",
            /* @__PURE__ */ jsx("span", { className: "text-brand-700", children: "Pay" })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "hidden min-w-0 items-center divide-x divide-slate-200 xl:flex", children: [
      /* @__PURE__ */ jsx(
        Popover,
        {
          className: "max-w-[15rem]",
          panel: /* @__PURE__ */ jsxs("div", { className: "py-1.5", children: [
            /* @__PURE__ */ jsx("p", { className: "px-3.5 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Your schools" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 bg-brand-50/60 px-3.5 py-2.5", children: [
              /* @__PURE__ */ jsx(Building2, { className: "h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block truncate text-sm font-extrabold text-ink", children: school?.name || "Your school" }),
                /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold text-slate-500", children: school?.city || "Current school" })
              ] })
            ] }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.DASHBOARD_SETTINGS, icon: Building2, children: "School settings" })
          ] }),
          label: /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(GraduationCap, { className: "h-5 w-5 shrink-0 text-slate-400", "aria-hidden": "true" }),
            /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight text-ink", children: school?.name || "Your school" }),
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-slate-500", children: school?.city || "Switch school" })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-slate-400", "aria-hidden": "true" })
          ] })
        }
      ),
      /* @__PURE__ */ jsx(
        Popover,
        {
          className: "ml-1 max-w-[11rem]",
          panel: /* @__PURE__ */ jsxs("div", { className: "py-1.5", children: [
            /* @__PURE__ */ jsx("p", { className: "px-3.5 pb-1.5 pt-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Academic term" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 bg-brand-50/60 px-3.5 py-2.5", children: [
              /* @__PURE__ */ jsx(GraduationCap, { className: "h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block truncate text-sm font-extrabold text-ink", children: term?.label || "Current term" }),
                /* @__PURE__ */ jsxs("span", { className: "block truncate text-[11px] font-semibold text-slate-500", children: [
                  "(",
                  term?.academicYear || "—",
                  ")"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.DASHBOARD_SETTINGS, icon: GraduationCap, children: "Change term in settings" })
          ] }),
          label: /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight text-ink", children: term?.label || "Current term" }),
              /* @__PURE__ */ jsxs("span", { className: "block truncate text-[11px] font-semibold leading-tight text-slate-500", children: [
                "(",
                term?.academicYear || "—",
                ")"
              ] })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-slate-400", "aria-hidden": "true" })
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ jsx("form", { onSubmit: onSearch, role: "search", className: "ml-auto hidden min-w-0 flex-1 md:block", children: /* @__PURE__ */ jsxs("div", { className: "relative mx-auto max-w-md", children: [
      /* @__PURE__ */ jsx(
        Search,
        {
          className: "pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "search",
          value: query,
          onChange: (event) => setQuery(event.target.value),
          placeholder: "Search student name or ID…",
          "aria-label": "Search students",
          className: "h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex shrink-0 items-center gap-2 md:ml-0", children: [
      smsCredit && /* @__PURE__ */ jsxs(Badge, { tone: "amber", icon: MessageSquare, className: "hidden lg:inline-flex", children: [
        formatCount(smsCredit.units),
        " SMS left"
      ] }),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: ROUTES.DASHBOARD_PAYMENTS,
          className: "inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 sm:px-4",
          children: [
            /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "New Payment" })
          ]
        }
      ),
      /* @__PURE__ */ jsx(NotificationBell, {}),
      /* @__PURE__ */ jsx(
        Popover,
        {
          align: "right",
          className: "max-w-[13rem]",
          panel: /* @__PURE__ */ jsxs("div", { className: "py-1.5", children: [
            /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 px-3.5 py-2.5", children: [
              /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-extrabold text-ink", children: displayName }),
              /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-semibold text-slate-500", children: roleLabelText })
            ] }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.DASHBOARD_SETTINGS, icon: User, children: "Account settings" }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.HOME, icon: Building2, children: "Back to website" }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                role: "menuitem",
                onClick: logout,
                className: "flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50",
                children: [
                  /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4 text-red-400", "aria-hidden": "true" }),
                  "Logout"
                ]
              }
            )
          ] }),
          label: /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white", children: /* @__PURE__ */ jsx(User, { className: "h-4 w-4", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsxs("span", { className: "hidden min-w-0 lg:block", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight text-ink", children: shortName }),
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-slate-500", children: roleLabelText })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { className: "hidden h-4 w-4 shrink-0 text-slate-400 lg:block", "aria-hidden": "true" })
          ] })
        }
      )
    ] })
  ] }) });
};
const LEGAL_LINKS = [
  { to: ROUTES.PRIVACY, label: "Privacy" },
  { to: ROUTES.TERMS, label: "Terms" }
];
const LegalLinks = ({ className = "" }) => /* @__PURE__ */ jsx("nav", { "aria-label": "Legal", className: `flex items-center gap-4 ${className}`, children: LEGAL_LINKS.map((link) => /* @__PURE__ */ jsx(
  Link,
  {
    to: link.to,
    className: "text-xs font-semibold text-slate-500 transition-colors hover:text-brand-700",
    children: link.label
  },
  link.to
)) });
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }
  /**
   * `getDerivedStateFromError` rather than setting state in `componentDidCatch`.
   *
   * The render pass has already thrown by the time `componentDidCatch` runs, so a
   * state update from there produces a second render that *also* renders the broken
   * children — the boundary does not catch until the next pass, and React logs the
   * original error as an uncaught exception either way.
   */
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error,
      info?.componentStack
    );
  }
  handleReset() {
    this.setState({ error: null });
  }
  render() {
    const { error } = this.state;
    const { children, label, className = "" } = this.props;
    if (!error) return children;
    return /* @__PURE__ */ jsx("div", { className: `rounded-2xl border border-red-200 bg-red-50/60 p-5 ${className}`, children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700",
          children: /* @__PURE__ */ jsx(AlertTriangle, { className: "h-[18px] w-[18px]" })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-[13px] font-extrabold text-red-900", children: label ? `${label} could not be displayed` : "This section could not be displayed" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px] font-semibold leading-relaxed text-red-800", children: "The rest of the page is unaffected and still shows live figures. The error is in the browser console." }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 break-words rounded-lg bg-white/70 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-red-700", children: String(error?.message || error) }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: this.handleReset,
            className: "mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-[12px] font-extrabold text-red-800 transition-colors hover:bg-red-100",
            children: [
              /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
              "Try again"
            ]
          }
        )
      ] })
    ] }) });
  }
}
const EMPTY_SCHOOL = {
  name: "",
  city: "",
  schoolCode: ""
};
const EMPTY_TERM = {
  term: "",
  academicYear: "",
  label: ""
};
const EMPTY_KPIS = {
  totalStudents: { value: 0 },
  expectedOwed: { amount: 0 },
  // `ratePercent` is the only derived figure here, and it is computed from
  // `collected / expectedOwed` in the hook — never stored.
  collected: { amount: 0, ratePercent: 0, rateLabel: "Collection Rate" },
  overdue: { students: 0, amount: 0 }
};
const EMPTY_CHANNELS = [];
const EMPTY_TRANSACTIONS = [];
const EMPTY_WEEKLY_INFLOW = [];
const EMPTY_UPCOMING = {
  horizonDays: 0,
  scheduledTranches: 0,
  expectedInflow: 0,
  days: []
};
const EMPTY_BROADCAST = {
  recipientCount: 0,
  fullyUnpaidCount: 0,
  partiallyPaidCount: 0,
  totalOutstanding: 0
};
const EMPTY_OVERVIEW = {
  school: EMPTY_SCHOOL,
  term: EMPTY_TERM,
  kpis: EMPTY_KPIS,
  channels: EMPTY_CHANNELS,
  transactions: EMPTY_TRANSACTIONS,
  transactionCount: 0,
  weeklyInflow: EMPTY_WEEKLY_INFLOW,
  upcomingInstallments: EMPTY_UPCOMING,
  smsBroadcast: EMPTY_BROADCAST
};
const listStudents = async (params = {}) => {
  try {
    const { data } = await api.get("/students", { params, timeout: 15e3 });
    return {
      // `listStudentsController` returns `{ success, data, meta }` with `data`
      // the page of rows.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || { page: 1, perPage: 20, total: 0, totalPages: 0 },
      offline: false
    };
  } catch (error) {
    const neverReachedServer = !error?.response || error?.code === "ERR_NETWORK" || error?.response?.status === 0;
    if (neverReachedServer) {
      return {
        rows: [],
        meta: { page: 1, perPage: params.perPage || 20, total: 0, totalPages: 0 },
        offline: true
      };
    }
    throw toApiError(error, "The student roster could not be loaded.");
  }
};
const getStudentStats = async (params = {}) => {
  try {
    const { data } = await api.get("/students/stats", { params, timeout: 15e3 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "Roster totals could not be loaded.");
  }
};
const getStudentProfile = async (id) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}/profile`, {
      timeout: 15e3
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "This student could not be loaded.");
  }
};
const getStudent = async (id) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}`, { timeout: 15e3 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "This student could not be loaded.");
  }
};
const exportStudents = async (params = {}) => {
  try {
    const response = await api.get("/students/export", {
      params: { ...params, format: params.format || "csv" },
      responseType: "blob",
      timeout: 6e4
    });
    const disposition = response.headers?.["content-disposition"] || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `students.${params.format || "csv"}`;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { filename };
  } catch (error) {
    throw toApiError(error, "The roster could not be exported.");
  }
};
const listAlumni = async (params = {}) => {
  try {
    const { data } = await api.get(`/alumni/${params.schoolId}`, {
      params: {
        page: params.page,
        limit: params.limit,
        graduationYear: params.graduationYear,
        honors: params.honors,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      },
      timeout: 15e3
    });
    const result = data?.data || {};
    return { rows: result.alumni || [], meta: result.pagination || null };
  } catch (error) {
    throw toApiError(error, "The alumni list could not be loaded.");
  }
};
const listCohorts = async (params = {}) => {
  try {
    const { data } = await api.get(`/cohorts/${params.schoolId}`, {
      params: { page: params.page, limit: params.limit, year: params.year, search: params.search },
      timeout: 15e3
    });
    const result = data?.data || {};
    return { rows: result.cohorts || [], meta: result.pagination || null };
  } catch (error) {
    throw toApiError(error, "Cohorts could not be loaded.");
  }
};
const getCohort = async (cohortId, params = {}) => {
  try {
    const { data } = await api.get(`/cohorts/detail/${encodeURIComponent(cohortId)}`, {
      params,
      timeout: 15e3
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "This cohort could not be loaded.");
  }
};
const createStudent = async (payload) => {
  try {
    const { data } = await api.post("/students/single", payload, { timeout: 15e3 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The student could not be created.");
  }
};
const bulkImport = async (file, meta = {}) => {
  const form = new FormData();
  form.append("file", file);
  if (meta.schoolId) form.append("schoolId", meta.schoolId);
  if (meta.academicYear) form.append("academicYear", meta.academicYear);
  if (meta.defaultDeadline) form.append("defaultDeadline", meta.defaultDeadline);
  if (meta.defaultOwed !== void 0 && meta.defaultOwed !== null && meta.defaultOwed !== "") {
    form.append("defaultOwed", String(meta.defaultOwed));
  }
  if (meta.dryRun) form.append("dryRun", "true");
  try {
    const { data } = await api.post("/students/bulk", form, {
      timeout: 12e4,
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The roster could not be imported.");
  }
};
const validateImport = (file, meta = {}) => bulkImport(file, { ...meta, dryRun: true });
const updateStudent = async (id, payload) => {
  try {
    const { data } = await api.put(`/students/${encodeURIComponent(id)}`, payload, {
      timeout: 15e3
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The student could not be updated.");
  }
};
const promoteStudent = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/promote`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The student could not be promoted.");
  }
};
const previewPromotion = async (payload) => {
  try {
    const { data } = await api.post("/students/promote/preview", payload, { timeout: 2e4 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The promotion preview could not be generated.");
  }
};
const markRepeating = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/repeat`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The student could not be marked as repeating.");
  }
};
const clearRepeating = async (id, reason) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/unrepeat`, { reason });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The repeat flag could not be cleared.");
  }
};
const bulkGraduate = async (schoolId, payload) => {
  try {
    const { data } = await api.post(`/students/bulk-graduate/${schoolId}`, payload, {
      timeout: 6e4
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The bulk graduation could not be completed.");
  }
};
const transferOut = async (id, payload) => {
  try {
    const { data } = await api.post(`/students/${encodeURIComponent(id)}/transfer-out`, payload);
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The transfer could not be recorded.");
  }
};
const regeneratePayLink = async (id, { notify = false } = {}) => {
  try {
    const { data } = await api.get(`/students/${encodeURIComponent(id)}/pay-link`, {
      params: { notify }
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The pay link could not be regenerated.");
  }
};
const bulkTarget = (target) => target?.ids?.length ? { ids: target.ids } : { filter: target?.filter || { status: "active" } };
const bulkWrite = async (path, body, timeout = 6e4) => {
  try {
    const { data } = await api.post(path, body, { timeout });
    return { ok: true, result: data?.data || null };
  } catch (error) {
    const apiError = toApiError(error, "The bulk action could not be completed.");
    apiError.details = error?.response?.data?.data || null;
    return { ok: false, error: apiError };
  }
};
const bulkUpdateStudents = (target, update, fields, { dryRun = false } = {}) => bulkWrite("/students/bulk/update", {
  ...bulkTarget(target),
  update,
  ...{},
  dryRun
});
const bulkArchiveStudents = (target, { reason, force = false, dryRun = false } = {}) => bulkWrite("/students/bulk/archive", {
  ...bulkTarget(target),
  reason,
  force,
  dryRun
});
const bulkSetStatus = (target, status, { reason, dryRun = false } = {}) => bulkWrite("/students/bulk/status", {
  ...bulkTarget(target),
  status,
  reason,
  dryRun
});
const bulkRegeneratePayLinks = (target, { dryRun = false } = {}) => bulkWrite("/students/bulk/pay-links", { ...bulkTarget(target), dryRun });
const getOutstanding = async (schoolId) => {
  try {
    const { data } = await api.get(`/reports/outstanding/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "Outstanding balances could not be loaded.");
  }
};
const getPaymentMethods = async (schoolId) => {
  try {
    const { data } = await api.get(`/reports/payment-methods/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "Payment channels could not be loaded.");
  }
};
const getSmsCredit = async (schoolId) => {
  if (!schoolId) throw new Error("A school must be in scope to read its SMS credit.");
  try {
    const { data } = await api.get(`/sms/credits/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "Your SMS balance could not be loaded.");
  }
};
const listRecentPayments = async (params = {}) => {
  try {
    const { data } = await api.get("/payments", { params, timeout: 15e3 });
    return {
      // `listPaymentsController` returns `{ success, message, data, meta }` with
      // `data` a bare array — the same unwrap trap `listStudents` documents.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || null
    };
  } catch (error) {
    throw toApiError(error, "Recent payments could not be loaded.");
  }
};
const getSchool = async (schoolId) => {
  try {
    const { data } = await api.get(`/schools/${schoolId}`);
    return data.data?.school || data.school || data.data || data;
  } catch (error) {
    throw toApiError(error, "Failed to load your school.");
  }
};
const updateSchoolClasses = async (schoolId, classes) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}`, {
      "academic.classes": classes
    });
    return data.data?.school || data.school || data.data || data;
  } catch (error) {
    throw toApiError(error, "Failed to save your class list.");
  }
};
const toTransactionRow = (p = {}, index = 0) => {
  const row = p && typeof p === "object" ? p : {};
  const student = row.studentId && typeof row.studentId === "object" ? row.studentId : null;
  const studentName2 = student?.studentName || (typeof row.studentName === "string" ? row.studentName : null) || (typeof student?.studentId === "string" ? student.studentId : null) || (typeof row.studentId === "string" ? row.studentId : null) || "Payment";
  const studentCode = student?.studentId || (typeof row.studentCode === "string" ? row.studentCode : null) || "";
  const className = student?.studentClass || (typeof row.className === "string" ? row.className : null) || "";
  const at2 = row.createdAt ? new Date(row.createdAt) : null;
  const hasDate = Boolean(at2) && !Number.isNaN(at2.getTime());
  return {
    ...row,
    // A real key. `p.id` does not exist on a Payment — the field is `paymentId` — so
    // the table was keyed on `undefined` for every row, which React warns about and
    // which breaks reconciliation when the list re-sorts.
    id: row.paymentId || row._id || `${row.reference || "row"}-${row.createdAt || index}`,
    studentName: String(studentName2),
    studentCode: String(studentCode),
    className: String(className),
    // The populated object is passed through untouched rather than re-shaped. The card
    // does not read it, and flattening it here would hide the real API shape behind a
    // second invented one — which is how the drift started in the first place.
    studentRef: row.studentId ?? null,
    // `Badge` maps `mtn | telecel | at` onto a dot colour and falls back to the current
    // text colour otherwise — so an unmapped value still renders, just wrong.
    network: String(row.momoNetwork || "UNKNOWN").toLowerCase().slice(0, 8),
    networkLabel: row.momoNetwork || row.paymentMethod?.toUpperCase() || "Manual",
    reference: row.reference || row.mtnReferenceId || row.paymentId || "—",
    // `toLocaleDateString(new Date(undefined))` yields the string "Invalid Date", so a
    // missing or unparseable timestamp is checked rather than formatted.
    dateLabel: hasDate ? at2.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—",
    timeLabel: hasDate ? at2.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""
  };
};
const useDashboardOverview = (schoolId) => {
  const [state, setState] = useState({
    data: EMPTY_OVERVIEW,
    loading: true,
    // Means "the API did not answer", not "a fixture is showing". It still gates
    // the header actions: a bursar must not be offered "Record Manual Payment"
    // against numbers that were never stored.
    isFallback: false,
    error: null,
    liveRegions: []
  });
  useEffect(() => {
    if (!schoolId) {
      setState({ data: EMPTY_OVERVIEW, loading: false, isFallback: true, error: null, liveRegions: [] });
      return void 0;
    }
    let active = true;
    const live = [];
    Promise.allSettled([
      getSchool(schoolId),
      getStudentStats({ status: "all" }),
      listStudents({ status: "all", perPage: 6, sortBy: "createdAt", sortOrder: "desc" }),
      listRecentPayments({ page: 1, perPage: 6, sortBy: "createdAt", sortOrder: "desc" }),
      getPaymentMethods(schoolId),
      getOutstanding(schoolId)
    ]).then(([school, stats, students, payments, methods, outstanding]) => {
      if (!active) return;
      const next = { ...EMPTY_OVERVIEW };
      let anyLive = false;
      if (school.status === "fulfilled" && school.value) {
        const s = school.value;
        const term = s.academic?.currentTerm || "";
        const academicYear = s.academic?.currentYear || "";
        next.school = {
          name: s.name || "",
          city: s.city || "",
          schoolCode: s.schoolCode || ""
        };
        next.term = {
          term,
          academicYear,
          label: term ? `${term} · ${academicYear}`.trim() : ""
        };
        live.push("school");
        anyLive = true;
      }
      if (stats.status === "fulfilled" && stats.value) {
        const s = stats.value;
        const owed = s.totalOwed ?? 0;
        const paid = s.totalPaid ?? 0;
        next.kpis = {
          totalStudents: { value: s.totalRoster ?? s.totalStudents ?? 0 },
          expectedOwed: { amount: owed },
          collected: {
            amount: paid,
            ratePercent: owed ? Math.round(paid / owed * 1e3) / 10 : 0,
            rateLabel: "Collection Rate"
          },
          overdue: {
            students: s.overdueStudents ?? 0,
            amount: s.overdueAmount ?? 0
          }
        };
        live.push("kpis");
        anyLive = true;
      }
      if (students.status === "fulfilled" && students.value?.rows?.length) {
        next.active = students.value.rows;
        live.push("students");
        anyLive = true;
      }
      if (payments.status === "fulfilled" && payments.value?.rows?.length) {
        next.transactions = payments.value.rows.map(toTransactionRow);
        next.transactionCount = payments.value.meta?.total ?? next.transactions.length;
        live.push("transactions");
        anyLive = true;
      }
      if (methods.status === "fulfilled" && methods.value?.rows?.length) {
        next.channels = methods.value.rows.map((row) => ({
          key: row.label,
          label: row.label,
          amount: row.amount ?? 0,
          transactionCount: row.count ?? 0,
          sharePercent: row.percentage ?? 0
        }));
        live.push("channels");
        anyLive = true;
      }
      if (outstanding.status === "fulfilled" && outstanding.value?.summary) {
        const s = outstanding.value.summary;
        next.smsBroadcast = {
          recipientCount: s.studentCount ?? 0,
          fullyUnpaidCount: s.fullyUnpaidCount ?? 0,
          partiallyPaidCount: s.partiallyPaidCount ?? 0,
          totalOutstanding: s.totalOutstanding ?? 0
        };
        live.push("smsBroadcast");
        anyLive = true;
      }
      setState({
        data: next,
        loading: false,
        isFallback: !anyLive,
        error: null,
        liveRegions: live
      });
    });
    return () => {
      active = false;
    };
  }, [schoolId]);
  const seriesFor = useMemo(
    () => (channel) => (EMPTY_OVERVIEW.weeklyInflow || []).map((row) => ({
      label: row.week,
      value: channel === "all" ? row.total : row[channel]
    })),
    []
  );
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    if (nonce === 0 || !schoolId) return;
    getStudentStats({ status: "all" }).then((s) => {
      setState((current) => ({
        ...current,
        data: {
          ...current.data,
          kpis: {
            ...current.data.kpis,
            collected: {
              ...current.data.kpis.collected,
              amount: s?.totalPaid ?? current.data.kpis.collected.amount
            }
          }
        }
      }));
    }).catch(() => {
    });
  }, [nonce, schoolId]);
  return { ...state, seriesFor, refresh };
};
const ErrorBoundaryResetOnChange = ({ routeKey, children }) => /* @__PURE__ */ jsx(ErrorBoundary, { label: "This page", children }, routeKey);
const DashboardLayout = () => {
  const { user, school } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data } = useDashboardOverview(user?.schoolId);
  const schoolCard = useMemo(
    () => ({
      name: school?.name || data?.school?.name || "",
      city: data?.school?.city || ""
    }),
    [school, data]
  );
  const term = data?.term;
  const [smsCredit, setSmsCredit] = useState(null);
  const schoolId = user?.schoolId;
  useEffect(() => {
    if (!schoolId) {
      setSmsCredit(null);
      return void 0;
    }
    let active = true;
    getSmsCredit(schoolId).then((result) => {
      if (active) setSmsCredit(result);
    }).catch(() => {
      if (active) setSmsCredit(null);
    });
    return () => {
      active = false;
    };
  }, [schoolId, pathname]);
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      window.scrollTo(0, 0);
    } else {
      const previous = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = previous;
    }
  }, [pathname]);
  useEffect(() => {
    if (!drawerOpen) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-slate-50", children: [
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "#dashboard-main",
        className: "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white",
        children: "Skip to content"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]", children: [
      /* @__PURE__ */ jsx(
        DashboardSidebar,
        {
          user,
          school: schoolCard,
          variant: "fixed",
          className: "hidden lg:flex"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col", children: [
        /* @__PURE__ */ jsx(
          DashboardTopbar,
          {
            user,
            navOpen: drawerOpen,
            onOpenNav: () => setDrawerOpen(true),
            school: schoolCard,
            term,
            smsCredit
          }
        ),
        /* @__PURE__ */ jsx("main", { id: "dashboard-main", tabIndex: -1, className: "min-w-0 flex-1 px-4 pb-8 pt-6 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-7xl", children: /* @__PURE__ */ jsx(ErrorBoundaryResetOnChange, { routeKey: pathname, children: /* @__PURE__ */ jsx(Outlet, {}) }) }) }),
        /* @__PURE__ */ jsx("div", { className: "border-t border-slate-200 px-4 py-4 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx(LegalLinks, { className: "justify-center" }) })
      ] })
    ] }),
    drawerOpen && /* @__PURE__ */ jsxs("div", { className: "lg:hidden", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          "aria-label": "Close navigation",
          onClick: () => setDrawerOpen(false),
          className: "fixed inset-0 z-40 cursor-default bg-ink/40 backdrop-blur-[2px]"
        }
      ),
      /* @__PURE__ */ jsx("div", { id: "dashboard-nav-drawer", children: /* @__PURE__ */ jsx(
        DashboardSidebar,
        {
          user,
          school: schoolCard,
          variant: "drawer",
          onClose: () => setDrawerOpen(false),
          className: "fixed inset-y-0 left-0 z-50 flex w-[15.25rem] max-w-[85vw]"
        }
      ) })
    ] })
  ] });
};
const Modal = ({ open, onClose, title, description, children, footer, size = "md" }) => {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };
  return createPortal(
    /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-0 bg-ink/55 backdrop-blur-sm",
          onClick: onClose,
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: panelRef,
          tabIndex: -1,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          className: `relative flex max-h-[92vh] w-full flex-col overflow-hidden ${widths[size]} rounded-t-2xl bg-white shadow-soft outline-none sm:rounded-2xl`,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold tracking-tight text-ink", children: title }),
                description && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[13px] font-medium leading-snug text-slate-500", children: description })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: onClose,
                  "aria-label": "Close dialog",
                  className: "-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700",
                  children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "overscroll-contain flex-1 overflow-y-auto px-5 py-5 sm:px-6", children }),
            footer && /* @__PURE__ */ jsx("div", { className: "flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6", children: footer })
          ]
        }
      )
    ] }),
    document.body
  );
};
const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const baseStyles = "font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "text-gray-700 hover:bg-gray-100 focus:ring-gray-500"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg"
  };
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`,
      ...props,
      children
    }
  );
};
const baseControl = "w-full rounded-lg border border-slate-200 bg-white py-2 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-all focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30";
const Label = ({ htmlFor, children, hint, required = false }) => /* @__PURE__ */ jsxs("div", { className: "mb-0.5 flex items-baseline justify-between gap-3", children: [
  /* @__PURE__ */ jsxs("label", { htmlFor, className: "text-[11px]/[15px] font-semibold text-slate-700", children: [
    children,
    required && /* @__PURE__ */ jsx("span", { className: "ml-0.5 text-red-600", children: "*" })
  ] }),
  hint && /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[10px]/[14px] font-medium text-slate-500", children: hint })
] });
const Field = ({
  label,
  hint,
  icon: Icon,
  error,
  trailing,
  className = "",
  ...props
}) => {
  const generatedId = useId();
  const controlId = props.id || generatedId;
  return /* @__PURE__ */ jsxs("div", { className, children: [
    /* @__PURE__ */ jsx(Label, { htmlFor: controlId, hint, required: props.required, children: label }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      Icon && /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
      /* @__PURE__ */ jsx(
        "input",
        {
          id: controlId,
          "aria-invalid": error ? "true" : void 0,
          className: `${baseControl} ${Icon ? "pl-9" : "pl-3"} pr-9 ${error ? "border-red-300" : ""}`,
          ...props
        }
      ),
      trailing && /* @__PURE__ */ jsx("span", { className: "absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500", children: trailing })
    ] }),
    error && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-red-600", children: error })
  ] });
};
const SelectField = ({
  label,
  hint,
  icon: Icon,
  error,
  children,
  className = "",
  ...props
}) => {
  const generatedId = useId();
  const controlId = props.id || generatedId;
  return /* @__PURE__ */ jsxs("div", { className, children: [
    /* @__PURE__ */ jsx(Label, { htmlFor: controlId, hint, required: props.required, children: label }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      Icon && /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-slate-500", children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" }) }),
      /* @__PURE__ */ jsx(
        "select",
        {
          id: controlId,
          "aria-invalid": error ? "true" : void 0,
          className: `${baseControl} cursor-pointer appearance-none pr-9 ${Icon ? "pl-9" : "pl-3"} ${error ? "border-red-300" : ""}`,
          ...props,
          children
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500", children: /* @__PURE__ */ jsx(ChevronDown, { className: "h-4 w-4" }) })
    ] }),
    error && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-red-600", children: error })
  ] });
};
const FormAlert = ({ tone = "error", children }) => {
  if (!children) return null;
  const tones = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-brand-200 bg-brand-50 text-brand-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
    // Amber, not red: used when something went wrong but the account itself is
    // fine and the user has a working next step. Red reads as "you are stuck".
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: tone === "error" ? "alert" : "status",
      className: `rounded-lg border px-3 py-2.5 text-[13px] font-semibold ${tones[tone]}`,
      children
    }
  );
};
const MoneyInput = ({
  label,
  hint,
  error,
  value,
  onChange,
  className = "",
  disabled = false,
  ...props
}) => {
  const toCedis = (pesewas) => pesewas === null || pesewas === void 0 ? "" : String(pesewas / 100);
  const [text, setText] = useState(() => toCedis(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(toCedis(value));
  }, [value, focused]);
  const commit = (raw) => {
    const cleaned = String(raw).replace(/[^0-9.]/g, "");
    const parsed = cleaned === "" ? null : Number(cleaned);
    onChange(parsed === null || Number.isNaN(parsed) ? null : Math.round(parsed * 100));
  };
  const onBlur = () => {
    setFocused(false);
    if (text === "") return;
    const parsed = Number(text);
    setText(Number.isNaN(parsed) ? "" : parsed.toFixed(2));
  };
  return /* @__PURE__ */ jsx(
    Field,
    {
      label,
      hint,
      error,
      className,
      type: "text",
      inputMode: "decimal",
      placeholder: "0.00",
      disabled,
      value: text,
      onFocus: () => setFocused(true),
      onChange: (event) => {
        setText(event.target.value);
        commit(event.target.value);
      },
      onBlur,
      trailing: /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold", children: "GH₵" }),
      ...props
    }
  );
};
const normaliseMeta = (meta) => ({
  page: Number(meta?.page) || 1,
  perPage: Number(meta?.perPage ?? meta?.limit) || 20,
  total: Number(meta?.total) || 0,
  totalPages: Number(meta?.totalPages) || 0
});
const recordManualPayment = async (payload) => {
  try {
    const { data } = await api.post("/payments/record", payload, { timeout: 2e4 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The payment could not be recorded.");
  }
};
const listPayments = async (params = {}) => {
  try {
    const { data } = await api.get("/payments", { params, timeout: 15e3 });
    return {
      // `listPaymentsController` returns `{ success, data, meta }` with `data` a
      // bare array.
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: normaliseMeta(data?.meta)
    };
  } catch (error) {
    throw toApiError(error, "Payments could not be loaded.");
  }
};
const getPayment = async (paymentId, { includeWebhookData = false } = {}) => {
  try {
    const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}`, {
      params: includeWebhookData ? { includeWebhookData: true } : void 0,
      timeout: 15e3
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "That payment could not be loaded.");
  }
};
const getPaymentSummary = async (params = {}) => {
  try {
    const { data } = await api.get("/payments/summary", { params, timeout: 2e4 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The payment summary could not be loaded.");
  }
};
const exportPayments = async (params = {}) => {
  try {
    const response = await api.get("/payments/export", {
      params: { ...params, format: params.format || "csv" },
      responseType: "blob",
      timeout: 6e4
    });
    const disposition = response.headers?.["content-disposition"] || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `payments.${params.format || "csv"}`;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { filename };
  } catch (error) {
    throw toApiError(error, "The transactions could not be exported.");
  }
};
const refundPayment = async (paymentId, payload) => {
  try {
    const { data } = await api.post(`/payments/${encodeURIComponent(paymentId)}/refund`, payload, {
      timeout: 2e4
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The payment could not be refunded.");
  }
};
const getReceipt = async (paymentId) => {
  try {
    const { data } = await api.get(`/payments/${encodeURIComponent(paymentId)}/receipt`, {
      timeout: 2e4
    });
    return data?.data?.receipt || null;
  } catch (error) {
    throw toApiError(error, "The receipt could not be loaded.");
  }
};
const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" }
];
const DEBOUNCE_MS$2 = 300;
const RecordManualPaymentDialog = ({ open, onClose, onRecorded }) => {
  const { success, error: errorToast } = useToast();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState(null);
  const [amount, setAmount] = useState(null);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const reset = () => {
    setTerm("");
    setResults([]);
    setStudent(null);
    setAmount(null);
    setMethod("cash");
    setReference("");
    setNotes("");
    setAllowOverpayment(false);
    setFormError(null);
  };
  useEffect(() => {
    if (open) reset();
  }, [open]);
  useEffect(() => {
    if (!open || !student) return void 0;
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return void 0;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      listStudents({ status: "all", search: q, perPage: 8 }).then((r) => setResults(r.rows)).catch(() => setResults([])).finally(() => setSearching(false));
    }, DEBOUNCE_MS$2);
    return () => clearTimeout(timer);
  }, [term, open, student]);
  const balance = student?.balance || 0;
  const overpaying = amount !== null && amount > balance;
  const blockingReason = useMemo(() => {
    if (!student) return "Choose a student first";
    if (amount === null) return "Enter the amount received";
    if (overpaying && !allowOverpayment) return "That is more than the outstanding balance";
    return null;
  }, [student, amount, overpaying, allowOverpayment]);
  const submit = async () => {
    if (blockingReason) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await recordManualPayment({
        studentRef: student.studentId,
        amount,
        method,
        reference: reference || void 0,
        notes: notes || void 0,
        allowOverpayment: allowOverpayment || void 0
      });
      success(
        `Recorded ${formatCedi(amount)} from ${student.studentName}. Balance is now ${formatCedi(
          result?.student?.balance ?? Math.max(0, balance - amount)
        )}.`
      );
      onRecorded?.();
      onClose();
    } catch (error) {
      setFormError(error.message);
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose,
      title: "Record a manual payment",
      description: "Cash, a cheque, or a transfer into the school's account.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: submit, disabled: Boolean(blockingReason) || saving, children: saving ? "Recording…" : "Record payment" })
      ] }),
      children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        formError && /* @__PURE__ */ jsx(FormAlert, { children: formError }),
        student ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-extrabold text-ink", children: student.studentName }),
              /* @__PURE__ */ jsxs("p", { className: "truncate text-[12px] font-semibold text-slate-500", children: [
                student.studentId,
                " · ",
                student.studentClass
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "shrink-0 text-right", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Outstanding" }),
              /* @__PURE__ */ jsx(
                "p",
                {
                  className: `text-base font-extrabold tabular-nums ${balance > 0 ? "text-red-600" : "text-emerald-600"}`,
                  children: formatCedi(balance)
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => {
                setStudent(null);
                setResults([]);
              },
              className: "text-[12px] font-extrabold text-brand-700 hover:underline",
              children: "Choose a different student"
            }
          )
        ] }) : /* @__PURE__ */ jsx(
          Field,
          {
            label: "Find the student",
            hint: "by name or student number",
            placeholder: "e.g. Ama Mensah, or SCH-DEMO-01-2026-8054",
            value: term,
            onChange: (event) => setTerm(event.target.value),
            autoFocus: true
          }
        ),
        !student && term.trim().length >= 2 && /* @__PURE__ */ jsxs("div", { className: "max-h-56 overflow-y-auto rounded-xl border border-slate-200", children: [
          searching && /* @__PURE__ */ jsx("p", { className: "px-4 py-3 text-[13px] font-semibold text-slate-400", children: "Searching…" }),
          !searching && !results.length && /* @__PURE__ */ jsxs("p", { className: "px-4 py-3 text-[13px] font-semibold text-slate-400", children: [
            "No student matches “",
            term.trim(),
            "”."
          ] }),
          /* @__PURE__ */ jsx("ul", { children: results.map((s) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => {
                setStudent(s);
                setResults([]);
              },
              className: "flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: s.studentName }),
                  /* @__PURE__ */ jsxs("span", { className: "block truncate text-[11px] font-semibold text-slate-500", children: [
                    s.studentId,
                    " · ",
                    s.studentClass
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `shrink-0 text-[12px] font-extrabold tabular-nums ${s.balance > 0 ? "text-red-600" : "text-emerald-600"}`,
                    children: formatCedi(s.balance || 0)
                  }
                )
              ]
            }
          ) }, s._id || s.id)) })
        ] }),
        student && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              MoneyInput,
              {
                label: "Amount received",
                hint: "cedis",
                required: true,
                value: amount,
                error: overpaying && !allowOverpayment ? "More than the outstanding balance" : void 0,
                onChange: setAmount,
                disabled: balance === 0
              }
            ),
            /* @__PURE__ */ jsx(SelectField, { label: "Method", value: method, onChange: (e) => setMethod(e.target.value), children: METHODS.map((m) => /* @__PURE__ */ jsx("option", { value: m.value, children: m.label }, m.value)) })
          ] }),
          balance === 0 && /* @__PURE__ */ jsx(FormAlert, { tone: "info", children: "This student has nothing outstanding. Tick the credit box below to record a payment anyway — it will be recorded as a credit against the balance." }),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: method === "bank_transfer" ? "Bank reference" : "Reference",
              hint: "optional — cheque or transfer number",
              value: reference,
              onChange: (event) => setReference(event.target.value),
              placeholder: "e.g. CHQ-000123"
            }
          ),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Note",
              hint: "optional",
              value: notes,
              onChange: (event) => setNotes(event.target.value),
              placeholder: "e.g. Lodged at the bursary by the father"
            }
          ),
          overpaying && /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] font-semibold text-amber-900", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: allowOverpayment,
                onChange: (event) => setAllowOverpayment(event.target.checked),
                className: "mt-0.5 h-4 w-4"
              }
            ),
            /* @__PURE__ */ jsxs("span", { children: [
              "Record ",
              formatCedi(amount - balance),
              ' more than the outstanding balance as a credit. A negative balance changes what every "owes money" figure in the product means, so it is an explicit choice.'
            ] })
          ] }),
          amount !== null && !overpaying && /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-semibold text-slate-600", children: [
            student.studentName,
            "'s balance goes from ",
            formatCedi(balance),
            " to",
            " ",
            /* @__PURE__ */ jsx("span", { className: "font-extrabold text-brand-700", children: formatCedi(balance - amount) }),
            "."
          ] })
        ] }),
        blockingReason && !student && /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-[12px] font-semibold text-slate-400", children: [
          /* @__PURE__ */ jsx(Search, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
          blockingReason
        ] })
      ] })
    }
  );
};
const Card = ({ children, className = "", padding = "p-5", accent, icon }) => /* @__PURE__ */ jsxs(
  "div",
  {
    className: `relative overflow-hidden rounded-2xl border bg-white shadow-soft ${padding} ${accent ? "border-brand-200/60" : "border-slate-100"} ${className}`,
    children: [
      accent && /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          className: "pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-70 blur-2xl",
          style: { background: "radial-gradient(circle, #A6F4C5 0%, rgba(255,255,255,0) 70%)" }
        }
      ),
      icon && /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          className: "mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600",
          children: icon
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "relative", children })
    ]
  }
);
const Tile = ({ label, icon: Icon, badge, value, valueTone = "text-ink", suffix, footer, accent }) => /* @__PURE__ */ jsxs(Card, { padding: "p-5", accent, className: "flex flex-col", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold leading-tight text-slate-600", children: label }),
    badge || /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500", children: /* @__PURE__ */ jsx(Icon, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) })
  ] }),
  /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-baseline gap-1.5", children: [
    /* @__PURE__ */ jsx("span", { className: `text-[28px] font-extrabold leading-none tracking-tight ${valueTone}`, children: value }),
    suffix && /* @__PURE__ */ jsx("span", { className: `text-sm font-extrabold ${valueTone === "text-ink" ? "text-slate-500" : valueTone}`, children: suffix })
  ] }),
  /* @__PURE__ */ jsx("div", { className: "mt-auto pt-4", children: footer })
] });
const CediValue = ({ pesewas, tone = "text-ink" }) => {
  const { symbol, whole } = splitCedi(pesewas);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("span", { className: `text-base font-extrabold ${tone === "text-ink" ? "text-slate-500" : tone}`, children: symbol }),
    /* @__PURE__ */ jsx("span", { className: `text-[28px] font-extrabold leading-none tracking-tight ${tone}`, children: whole })
  ] });
};
const ProgressBar = ({ value = 0, label, className = "", barClassName = "bg-brand-600" }) => {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));
  return /* @__PURE__ */ jsx("div", { className, children: /* @__PURE__ */ jsx(
    "div",
    {
      role: "progressbar",
      "aria-label": label,
      "aria-valuenow": Math.round(percent),
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      className: "h-2 w-full overflow-hidden rounded-full bg-slate-200",
      children: /* @__PURE__ */ jsx(
        "div",
        {
          className: `h-full rounded-full transition-[width] duration-500 ${barClassName}`,
          style: { width: `${percent}%` }
        }
      )
    }
  ) });
};
const KpiRow = ({ kpis }) => /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
  /* @__PURE__ */ jsx(
    Tile,
    {
      label: "Total Students",
      icon: Users,
      value: formatCount(kpis.totalStudents.value)
    }
  ),
  /* @__PURE__ */ jsx(
    Tile,
    {
      label: "Total Expected Owed",
      icon: GraduationCap,
      value: /* @__PURE__ */ jsx(CediValue, { pesewas: kpis.expectedOwed.amount })
    }
  ),
  /* @__PURE__ */ jsx(
    Tile,
    {
      label: "Total Collected",
      icon: TrendingUp,
      accent: true,
      valueTone: "text-brand-700",
      value: /* @__PURE__ */ jsx(CediValue, { pesewas: kpis.collected.amount, tone: "text-brand-700" }),
      footer: /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-slate-500", children: kpis.collected.rateLabel }),
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: formatPercent(kpis.collected.ratePercent) })
        ] }),
        /* @__PURE__ */ jsx(
          ProgressBar,
          {
            value: kpis.collected.ratePercent,
            label: kpis.collected.rateLabel,
            className: "w-full"
          }
        )
      ] })
    }
  ),
  /* @__PURE__ */ jsx(
    Tile,
    {
      label: "Overdue Students",
      icon: TriangleAlert,
      valueTone: "text-red-600",
      suffix: "learners",
      badge: /* @__PURE__ */ jsx(Badge, { tone: "red", dot: true, children: "Immediate Attention" }),
      value: formatCount(kpis.overdue.students),
      footer: /* @__PURE__ */ jsxs("p", { className: "flex items-center justify-between gap-3 text-[11px] font-extrabold text-red-600", children: [
        /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-500", children: "Outstanding overdue" }),
        formatCediShort(kpis.overdue.amount)
      ] })
    }
  )
] });
const monotonePath = (points) => {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const secants = points.slice(0, -1).map((p, i) => {
    const next = points[i + 1];
    return (next.y - p.y) / (next.x - p.x);
  });
  const tangents = new Array(points.length);
  tangents[0] = secants[0];
  tangents[points.length - 1] = secants[secants.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const before = secants[i - 1];
    const after = secants[i];
    if (before * after <= 0) {
      tangents[i] = 0;
    } else {
      const w1 = 2 * (points[i + 1].x - points[i].x) + (points[i].x - points[i - 1].x);
      const w2 = points[i + 1].x - points[i].x + 2 * (points[i].x - points[i - 1].x);
      tangents[i] = (w1 + w2) / (w1 / before + w2 / after);
    }
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = (p1.x - p0.x) / 3;
    d += ` C ${p0.x + h} ${p0.y + tangents[i] * h}, ${p1.x - h} ${p1.y - tangents[i + 1] * h}, ${p1.x} ${p1.y}`;
  }
  return d;
};
const AreaChart = ({
  series = [],
  formatValue,
  formatAxis,
  peakIndex = -1,
  height = 260,
  className = ""
}) => {
  const gradientId = useId();
  const [hover, setHover] = useState(null);
  const width = 800;
  const pad = { top: 28, right: 16, bottom: 30, left: 16 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const { points, linePath, areaPath, ticks, max } = useMemo(() => {
    if (!series.length) {
      return { points: [], linePath: "", areaPath: "", ticks: [], max: 0 };
    }
    const values = series.map((d) => d.value);
    const rawMax = Math.max(...values, 0);
    const max2 = rawMax === 0 ? 1 : rawMax * 1.08;
    const pts = series.map((d, i) => ({
      x: pad.left + (series.length === 1 ? plotW / 2 : i / (series.length - 1) * plotW),
      y: pad.top + plotH - d.value / max2 * plotH,
      label: d.label,
      value: d.value
    }));
    const line = monotonePath(pts);
    const area = `${line} L ${pts[pts.length - 1].x} ${pad.top + plotH} L ${pts[0].x} ${pad.top + plotH} Z`;
    const gridCount = 4;
    const grid = Array.from({ length: gridCount + 1 }, (_, i) => {
      const ratio = i / gridCount;
      return {
        y: pad.top + plotH * (1 - ratio),
        value: max2 * ratio
      };
    });
    return { points: pts, linePath: line, areaPath: area, ticks: grid, max: max2 };
  }, [series, plotH, plotW]);
  if (!series.length) {
    return /* @__PURE__ */ jsx("div", { className: `flex items-center justify-center text-sm font-semibold text-slate-400 ${className}`, children: "No collection data for this period." });
  }
  const activeIndex = hover ?? (peakIndex >= 0 ? peakIndex : -1);
  const active = activeIndex >= 0 ? points[activeIndex] : null;
  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const vbX = (event.clientX - rect.left) / rect.width * width;
    const ratio = (vbX - pad.left) / plotW;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  };
  return /* @__PURE__ */ jsxs("div", { className: `relative ${className}`, children: [
    /* @__PURE__ */ jsxs(
      "svg",
      {
        viewBox: `0 0 ${width} ${height}`,
        className: "h-auto w-full touch-pan-y",
        role: "img",
        "aria-label": `Collections by week. ${series.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ")}.`,
        onMouseMove: onMove,
        onMouseLeave: () => setHover(null),
        children: [
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#12B76A", stopOpacity: "0.28" }),
            /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#12B76A", stopOpacity: "0.02" })
          ] }) }),
          ticks.map((tick) => /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx(
              "line",
              {
                x1: pad.left,
                x2: width - pad.right,
                y1: tick.y,
                y2: tick.y,
                stroke: "#E2E8F0",
                strokeWidth: "1",
                strokeDasharray: "4 5"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: pad.left,
                y: tick.y - 6,
                fill: "#94A3B8",
                fontSize: "11",
                fontWeight: "700",
                children: formatAxis ? formatAxis(tick.value) : tick.value
              }
            )
          ] }, tick.y)),
          /* @__PURE__ */ jsx("path", { d: areaPath, fill: `url(#${gradientId})` }),
          /* @__PURE__ */ jsx(
            "path",
            {
              d: linePath,
              fill: "none",
              stroke: "#0F5132",
              strokeWidth: "2.5",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ),
          points.map((p, i) => /* @__PURE__ */ jsx(
            "circle",
            {
              cx: p.x,
              cy: p.y,
              r: i === activeIndex ? 5 : 3.5,
              fill: i === activeIndex ? "#0F5132" : "#FFFFFF",
              stroke: "#0F5132",
              strokeWidth: "2"
            },
            p.label
          )),
          points.map((p, i) => /* @__PURE__ */ jsx(
            "text",
            {
              x: p.x,
              y: height - 8,
              textAnchor: "middle",
              fill: i === activeIndex ? "#0F5132" : "#64748B",
              fontSize: "12",
              fontWeight: i === activeIndex ? "800" : "600",
              children: p.label
            },
            p.label
          ))
        ]
      }
    ),
    active && /* @__PURE__ */ jsx(
      "div",
      {
        className: "pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-lift",
        style: {
          left: `${active.x / width * 100}%`,
          top: `${active.y / height * 100}%`,
          marginTop: "-8px"
        },
        children: formatValue(active.value)
      }
    )
  ] });
};
const FILTERS$2 = [
  { key: "all", label: "All Channels" },
  { key: "mtn", label: "MTN MoMo" },
  { key: "telecel", label: "Telecel Cash" },
  { key: "at", label: "AT Money" }
];
const CollectionsCard = ({ term, seriesFor }) => {
  const [channel, setChannel] = useState("all");
  const series = useMemo(() => seriesFor(channel), [seriesFor, channel]);
  const cumulative = useMemo(
    () => series.reduce((sum, point) => sum + point.value, 0),
    [series]
  );
  const peakIndex = useMemo(() => {
    if (!series.length) return -1;
    return series.reduce(
      (best, point, i) => point.value > series[best].value ? i : best,
      0
    );
  }, [series]);
  const activeFilter = FILTERS$2.find((f) => f.key === channel);
  const hasSeries = series.length > 0;
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-extrabold tracking-tight text-ink", children: "Collections This Term (Weekly)" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-md text-[13px] font-medium leading-snug text-slate-500", children: "Automated Mobile Money settlements reconciled directly via Bank of Ghana switch" })
      ] }),
      /* @__PURE__ */ jsx(
        "div",
        {
          role: "group",
          "aria-label": "Filter collections by network",
          className: "flex shrink-0 items-center gap-1 rounded-full bg-slate-100 p-1",
          children: FILTERS$2.map((filter) => {
            const active = filter.key === channel;
            return /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setChannel(filter.key),
                "aria-pressed": active,
                className: `rounded-full px-3 py-1.5 text-[11px] font-extrabold leading-tight transition-colors ${active ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`,
                children: filter.label
              },
              filter.key
            );
          })
        }
      )
    ] }),
    hasSeries ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Cumulative Net Inflow" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-lg font-extrabold tracking-tight text-brand-700", children: formatCedi(cumulative) })
      ] }) }),
      /* @__PURE__ */ jsx(
        AreaChart,
        {
          series,
          peakIndex,
          formatValue: formatCediShort,
          formatAxis: formatCediShort,
          className: "mt-4"
        }
      ),
      /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-semibold text-slate-400", children: [
        "Showing ",
        activeFilter?.label,
        ". Hover a point for its exact amount."
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "No weekly breakdown yet" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-1.5 max-w-md text-[12px] font-medium leading-relaxed text-slate-500", children: "This chart needs the daily collections report bucketed into teaching weeks from your school calendar. Until that exists, the term total is on the Total Collected tile above and every payment is listed below." })
    ] })
  ] });
};
const StackedBar = ({ segments = [], className = "" }) => {
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (!total) return null;
  return /* @__PURE__ */ jsx("div", { className: `flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`, children: segments.map((segment) => {
    const share = (Number(segment.value) || 0) / total * 100;
    return /* @__PURE__ */ jsx(
      "div",
      {
        className: segment.className || "bg-slate-300",
        style: { width: `${Math.max(share, 1.5)}%` },
        title: `${segment.label}: ${share.toFixed(1)}%`
      },
      segment.key
    );
  }) });
};
const SEGMENT_CLASS = {
  momo: "bg-momo-mtn",
  card: "bg-momo-telecel",
  bank_transfer: "bg-momo-at",
  manual: "bg-slate-300"
};
const PaymentChannelsCard = ({ channels = [] }) => {
  if (!channels.length) {
    return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold tracking-tight text-ink", children: "Payment Channels" }),
        /* @__PURE__ */ jsx(Badge, { tone: "brand", children: "Automated" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "text-[12px] font-medium leading-relaxed text-slate-500", children: "No completed payments in this period yet. The split by MoMo, card, bank transfer and manual appears here as soon as there are some." })
    ] });
  }
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold tracking-tight text-ink", children: "Payment Channels" }),
      /* @__PURE__ */ jsx(Badge, { tone: "brand", children: "Automated" })
    ] }),
    /* @__PURE__ */ jsx(
      StackedBar,
      {
        segments: channels.map((c) => ({
          key: c.key,
          label: c.label,
          value: c.amount,
          className: SEGMENT_CLASS[c.key] || "bg-slate-300"
        })),
        className: "mb-5"
      }
    ),
    /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-3", children: channels.map((channel) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("div", { className: "rounded-xl bg-slate-50 p-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-start gap-2.5", children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            className: `mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEGMENT_CLASS[channel.key] || "bg-slate-300"}`,
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "truncate text-[13px] font-extrabold capitalize text-ink", children: channel.key?.replace(/_/g, " ") }),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            formatPercent(channel.sharePercent),
            " Share •",
            " ",
            formatCount(channel.transactionCount),
            " Payments"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "shrink-0 text-right", children: /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-brand-700", children: formatCediShort(channel.amount) }) })
    ] }) }) }, channel.key)) })
  ] });
};
const initials$1 = (name) => {
  const text = typeof name === "string" ? name : (
    // A populated student object, or `{ _id }` with nothing else on it.
    name && typeof name === "object" ? String(name.studentName || name.studentId || name._id || "") : name == null ? "" : String(name)
  );
  return text.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
};
const AVATAR_TONES$1 = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700"
];
const RecentTransactionsCard = ({ transactions, totalCount, isDemo }) => /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600", children: /* @__PURE__ */ jsx(ScrollText, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsx("div", { className: "min-w-0", children: /* @__PURE__ */ jsx("h3", { className: "truncate text-base font-extrabold tracking-tight text-ink", children: "Recent MoMo Transactions" }) }),
      /* @__PURE__ */ jsx(Badge, { tone: "slate", className: "hidden sm:inline-flex", children: "Reconciled Instantly" })
    ] }),
    /* @__PURE__ */ jsxs(
      Link,
      {
        to: ROUTES.DASHBOARD_PAYMENTS,
        className: "inline-flex items-center gap-1 text-[13px] font-extrabold text-brand-700 transition-colors hover:text-brand-800",
        children: [
          "View All (",
          formatCount(totalCount),
          ")",
          /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4", "aria-hidden": "true" })
        ]
      }
    )
  ] }),
  /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[46rem] border-collapse text-left", children: [
    /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "bg-slate-50", children: ["Student Name", "Class", "Amount", "Network", "MoMo Reference", "Date & Time"].map(
      (heading) => /* @__PURE__ */ jsx(
        "th",
        {
          scope: "col",
          className: "whitespace-nowrap px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
          children: heading
        },
        heading
      )
    ) }) }),
    /* @__PURE__ */ jsxs("tbody", { children: [
      transactions.length === 0 ? (
        /*
         * An explicit empty body rather than zero rows under a header.
         *
         * A `<tbody>` with nothing in it leaves the column headings sitting on an
         * empty grey band, which reads as "the table failed to load" — the exact
         * wrong conclusion for a school whose first payment has simply not happened
         * yet. Spanning all six columns keeps the headings and the explanation in
         * the same visual object.
         */
        /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsxs(
          "td",
          {
            colSpan: 6,
            className: "px-5 py-10 text-center text-[13px] font-semibold text-slate-500",
            children: [
              "No payments recorded yet.",
              /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[12px] font-medium text-slate-400", children: "They will appear here as parents pay, from the app or at the office." })
            ]
          }
        ) })
      ) : null,
      transactions.map((txn, index) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-t border-slate-100 transition-colors hover:bg-slate-50/70",
          children: [
            /* @__PURE__ */ jsx("th", { scope: "row", className: "px-5 py-3 font-normal", children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${AVATAR_TONES$1[index % AVATAR_TONES$1.length]}`,
                  "aria-hidden": "true",
                  children: initials$1(txn.studentName)
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: txn.studentName }),
                /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                  "ID: ",
                  txn.studentCode
                ] })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600", children: txn.className }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums text-ink", children: formatCedis(txn.amount) }),
            /* @__PURE__ */ jsx("td", { className: "px-5 py-3", children: /* @__PURE__ */ jsx(Badge, { tone: txn.network, dot: true, children: txn.networkLabel }) }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-[12px] font-semibold text-slate-500", children: txn.reference }),
            /* @__PURE__ */ jsxs("td", { className: "whitespace-nowrap px-5 py-3", children: [
              /* @__PURE__ */ jsx("span", { className: "block text-[12px] font-bold text-slate-700", children: txn.dateLabel }),
              /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-400", children: txn.timeLabel })
            ] })
          ]
        },
        txn.id
      ))
    ] })
  ] }) }),
  isDemo && /* @__PURE__ */ jsx("p", { className: "border-t border-slate-100 px-5 py-3 text-[11px] font-semibold text-slate-400", children: "Demo data. Backed by GET /payments once wired." })
] });
const SMS_SEND_NOT_SUPPORTED = "SMS_SEND_NOT_SUPPORTED";
const unwrapList = (data) => Array.isArray(data?.data) ? data.data : [];
const getSmsCredits = async (schoolId) => {
  if (!schoolId) throw new Error("A school must be in scope to read its SMS credits.");
  try {
    const { data } = await api.get(`/sms/credits/${schoolId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "Your SMS balance could not be loaded.");
  }
};
const topUpSmsCredits = async (payload) => {
  try {
    const { data } = await api.post("/sms/credits/top-up", payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The credit could not be added.");
  }
};
const previewAudience = async (audience, schoolId) => {
  try {
    const { data } = await api.post("/sms/audience/preview", { audience, schoolId });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The audience could not be sized.");
  }
};
const sendBulkSms = async (payload) => {
  try {
    const { data } = await api.post("/sms/bulk", payload);
    return data.data || data;
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 405) {
      const wrapped = toApiError(error, "Broadcasting SMS is not available on this server.");
      wrapped.code = SMS_SEND_NOT_SUPPORTED;
      throw wrapped;
    }
    throw toApiError(error, "The broadcast could not be queued.");
  }
};
const listSmsJobs = async (params = {}) => {
  try {
    const { data } = await api.get("/sms/jobs", { params });
    return { jobs: unwrapList(data), meta: data?.meta || null };
  } catch (error) {
    throw toApiError(error, "Broadcast history could not be loaded.");
  }
};
const cancelSmsJob = async (jobId, reason = "") => {
  try {
    const { data } = await api.post(`/sms/jobs/${jobId}/cancel`, { reason });
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The broadcast could not be cancelled.");
  }
};
const listSmsMessages = async (params = {}) => {
  try {
    const { data } = await api.get("/sms/messages", { params });
    return { messages: unwrapList(data), meta: data?.meta || null };
  } catch (error) {
    throw toApiError(error, "The message history could not be loaded.");
  }
};
const listSmsTemplates = async (params = {}) => {
  try {
    const { data } = await api.get("/sms/templates", { params });
    return unwrapList(data);
  } catch (error) {
    throw toApiError(error, "Templates could not be loaded.");
  }
};
const createSmsTemplate = async (payload) => {
  try {
    const { data } = await api.post("/sms/templates", payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The template could not be saved.");
  }
};
const updateSmsTemplate = async (templateId, payload) => {
  try {
    const { data } = await api.patch(`/sms/templates/${templateId}`, payload);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The template could not be updated.");
  }
};
const deleteSmsTemplate = async (templateId) => {
  try {
    const { data } = await api.delete(`/sms/templates/${templateId}`);
    return data.data || data;
  } catch (error) {
    throw toApiError(error, "The template could not be deleted.");
  }
};
const renderBodyLocally = (body = "", values = {}) => String(body).replace(
  /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
  (match, token) => values[token] === void 0 || values[token] === null || values[token] === "" ? match : String(values[token])
);
const extractTokens = (body = "") => {
  const found = [];
  const pattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let match = pattern.exec(String(body));
  while (match) {
    if (!found.includes(match[1])) found.push(match[1]);
    match = pattern.exec(String(body));
  }
  return found;
};
const countSegments = (body = "") => {
  const text = String(body ?? "");
  const gsm7 = /^[\x20-\x7E\n\r]*$/.test(text) || /^[\x20-\x7E\n\r@£$¥èéùìòÇØøÅå]*$/.test(text);
  const perSegment = gsm7 ? 160 : 70;
  if (text.length <= perSegment) return 1;
  return Math.ceil((text.length - perSegment) / (perSegment - 7)) + 1;
};
const PRESET_TEMPLATES = [
  {
    key: "gentle_prompt",
    name: "Gentle Prompt",
    category: "fee_reminder",
    requiredTokens: ["balance", "payLink"],
    body: "Dear {parentName}, {studentName} owes GHC {balance} for this term at {schoolName}. Please pay via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}"
  },
  {
    key: "final_warning",
    name: "Final Warning",
    category: "final_warning",
    requiredTokens: ["balance", "dueDate", "payLink"],
    body: "Dear {parentName}, this is a final reminder for {studentName}'s GHC {balance} outstanding at {schoolName}. Fees must be cleared by {dueDate}. Pay now: {payLink}"
  },
  {
    key: "pta_special",
    name: "PTA Special",
    category: "pta",
    requiredTokens: ["balance", "payLink"],
    body: "Dear {parentName}, the PTA of {schoolName} requests GHC {balance} from you for {studentName}. Pay via {payLink}. Thank you."
  },
  {
    key: "custom",
    name: "Custom Message",
    category: "custom",
    requiredTokens: ["balance", "payLink"],
    body: "Dear {parentName}, kindly settle the outstanding balance of GHC {balance} for {studentName} at {schoolName}. Payment link: {payLink}"
  }
];
const SMS_TOKENS = [
  { token: "parentName", label: "Parent name", sample: "Mr. Mensah" },
  { token: "studentName", label: "Student name", sample: "Kwame Mensah" },
  { token: "studentClass", label: "Class", sample: "JHS 2A" },
  { token: "balance", label: "Amount owing", sample: "550.00" },
  { token: "amountPaid", label: "Already paid", sample: "0.00" },
  { token: "dueDate", label: "Due date", sample: "30 Nov 2025" },
  { token: "schoolName", label: "School name", sample: "Prampram Basic School" },
  { token: "payLink", label: "Payment link", sample: "sukuupay.com/pay/STU-8F3K9D2L" },
  { token: "term", label: "Term", sample: "Term 1" }
];
const AUDIENCE_RULES = [
  {
    value: "all_owing",
    title: "All Owing Students",
    description: "Outstanding balance above GHC 0.00"
  },
  {
    value: "overdue",
    title: "Overdue Only",
    description: "Past statutory 30-day grace period",
    badge: "High Priority"
  },
  {
    value: "installment_due_soon",
    title: "Installment Due in 5 Days",
    description: "Tranche 2 auto-scheduled reminders"
  },
  {
    value: "class",
    title: "By Specific Class",
    description: "Target individual grades or wings"
  },
  {
    value: "students",
    title: "By Specific Students",
    description: "Hand-picked from the roster"
  },
  {
    value: "all",
    title: "Whole School",
    description: "Every active student, settled or not"
  }
];
const STORAGE_KEY = "sukuupay.sms.draft.v1";
const readStoredDraft = (schoolId) => {
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY}.${schoolId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeStoredDraft = (schoolId, draft) => {
  try {
    window.sessionStorage.setItem(`${STORAGE_KEY}.${schoolId}`, JSON.stringify(draft));
  } catch {
  }
};
const clearStoredDraft = (schoolId) => {
  try {
    window.sessionStorage.removeItem(`${STORAGE_KEY}.${schoolId}`);
  } catch {
  }
};
const useSmsReminders = (reloadKey = 0) => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "compose";
  const historyFilters = useMemo(
    () => ({
      status: searchParams.get("status") || "all",
      category: searchParams.get("category") || "all",
      search: searchParams.get("q") || "",
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 20
    }),
    [searchParams]
  );
  const setParam = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const [credits, setCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsError, setCreditsError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const stored = useMemo(() => readStoredDraft(schoolId), [schoolId]);
  const [audienceType, setAudienceType] = useState(stored?.audienceType || "overdue");
  const [classFilter, setClassFilter] = useState(stored?.classFilter || "");
  const [studentIds, setStudentIds] = useState(
    () => Array.isArray(stored?.studentIds) ? stored.studentIds.map(String) : []
  );
  const [minBalance, setMinBalance] = useState(stored?.minBalance ?? 1);
  const [overdueDays, setOverdueDays] = useState(stored?.overdueDays ?? 30);
  const [gracePeriodDays, setGracePeriodDays] = useState(stored?.gracePeriodDays ?? 30);
  const [dueSoonDays, setDueSoonDays] = useState(stored?.dueSoonDays ?? 5);
  const [excludeRecentPayers, setExcludeRecentPayers] = useState(
    stored?.excludeRecentPayers ?? true
  );
  const [recentPaymentWindowHours, setRecentPaymentWindowHours] = useState(
    stored?.recentPaymentWindowHours ?? 48
  );
  const [body, setBody] = useState(stored?.body || PRESET_TEMPLATES[0].body);
  const [category, setCategory] = useState(stored?.category || "fee_reminder");
  const [templateId, setTemplateId] = useState(stored?.templateId || null);
  const [scheduledAt, setScheduledAt] = useState(stored?.scheduledAt || "");
  const [confirmed, setConfirmed] = useState(false);
  const audience = useMemo(
    () => ({
      type: audienceType,
      minBalance: Number(minBalance) || 0,
      overdueDays: Number(overdueDays) || 30,
      gracePeriodDays: Number(gracePeriodDays) || 30,
      dueSoonDays: Number(dueSoonDays) || 5,
      excludeRecentPayers,
      recentPaymentWindowHours: Number(recentPaymentWindowHours) || 48,
      ...audienceType === "class" && classFilter ? { class: classFilter } : {},
      // The one field the `students` rule needs. Omitted entirely when the list is
      // empty rather than sent as `studentIds: []`, because the schema reads an
      // empty array as "no recipients named" and refuses it — and because
      // `sms.service.js` turns it into `$in: []`, which is a query matching nobody
      // if it ever slipped past validation. The preview is suppressed below, so
      // this shape only exists between the two and the send is guarded by the
      // button.
      ...audienceType === "students" && studentIds.length ? { studentIds } : {},
      // `all` is the one rule where a zero balance is coherent, and it says so
      // explicitly rather than by leaving `minBalance` at 0 — the server rejects
      // a whole-school broadcast that did not opt in.
      ...audienceType === "all" ? { includeZeroBalance: true } : {}
    }),
    [
      audienceType,
      classFilter,
      studentIds,
      minBalance,
      overdueDays,
      gracePeriodDays,
      dueSoonDays,
      excludeRecentPayers,
      recentPaymentWindowHours
    ]
  );
  const tokens = useMemo(() => extractTokens(body), [body]);
  const knownTokens = useMemo(() => new Set(SMS_TOKENS.map((entry) => entry.token)), []);
  const unknown = useMemo(() => tokens.filter((token) => !knownTokens.has(token)), [tokens, knownTokens]);
  const [previewSample, setPreviewSample] = useState(null);
  const sampleValues = useMemo(
    () => ({
      parentName: "Mr. Mensah",
      studentName: "Kwame Mensah",
      studentClass: "JHS 2A",
      schoolName: user?.schoolName || "Prampram Basic School",
      payLink: "sukuupay.com/pay/STU-8F3K9D2L",
      term: "Term 1",
      ...Object.fromEntries(
        SMS_TOKENS.filter((entry) => entry.sample && !["parentName", "studentName", "studentClass", "schoolName", "payLink", "term"].includes(entry.token)).map((entry) => [entry.token, entry.sample])
      ),
      ...previewSample ? {
        parentName: previewSample.parentName,
        studentName: previewSample.studentName,
        balance: previewSample.balanceDisplay,
        payLink: previewSample.payLink ? previewSample.payLink.replace(/^https?:\/\//, "") : void 0
      } : {}
    }),
    [previewSample, user?.schoolName]
  );
  const rendered = useMemo(() => renderBodyLocally(body, sampleValues), [body, sampleValues]);
  const segments = useMemo(() => countSegments(rendered), [rendered]);
  const perSegmentLimit = useMemo(
    () => /^[\x20-\x7E\n\r]*$/.test(rendered) || /^[\x20-\x7E\n\r@£$¥èéùìòÇØøÅå]*$/.test(rendered) ? 160 : 70,
    [rendered]
  );
  const overSegmentLimit = segments > 10;
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyJobId, setBusyJobId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsMeta, setJobsMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesMeta, setMessagesMeta] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  useEffect(() => {
    if (!schoolId) {
      setCreditsLoading(false);
      return void 0;
    }
    let active = true;
    setCreditsLoading(true);
    getSmsCredits(schoolId).then((result) => {
      if (!active) return;
      setCredits(result);
      setCreditsError(null);
    }).catch((error) => {
      if (!active) return;
      setCredits(null);
      setCreditsError(error);
    }).finally(() => {
      if (active) setCreditsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [schoolId, reloadKey]);
  const loadTemplates = useCallback(async () => {
    if (!schoolId) return;
    setTemplatesLoading(true);
    try {
      const result = await listSmsTemplates({ schoolId });
      setTemplates(result);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, [schoolId]);
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates, reloadKey]);
  const loadHistory = useCallback(async () => {
    if (!schoolId) return;
    setHistoryLoading(true);
    try {
      const [jobResult, messageResult] = await Promise.all([
        listSmsJobs({ schoolId, status: "all", category: "all", ...historyFilters }),
        listSmsMessages({ schoolId, status: historyFilters.status, category: historyFilters.category, search: historyFilters.search, page: historyFilters.page, perPage: historyFilters.perPage })
      ]);
      setJobs(jobResult.jobs);
      setJobsMeta(jobResult.meta);
      setMessages(messageResult.messages);
      setMessagesMeta(messageResult.meta);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error);
    } finally {
      setHistoryLoading(false);
    }
  }, [schoolId, historyFilters]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory, reloadKey]);
  const previewTimer = useRef(null);
  useEffect(() => {
    if (!schoolId) return void 0;
    const needsTarget = audienceType === "class" && !classFilter || audienceType === "students" && !studentIds.length;
    if (needsTarget) {
      clearTimeout(previewTimer.current);
      setAudiencePreview(null);
      setAudienceError(null);
      setAudienceLoading(false);
      return void 0;
    }
    clearTimeout(previewTimer.current);
    setAudienceLoading(true);
    previewTimer.current = setTimeout(() => {
      previewAudience(audience, schoolId).then((result) => {
        setAudiencePreview(result);
        setAudienceError(null);
        if (result?.sample) setPreviewSample(result.sample);
      }).catch((error) => {
        setAudiencePreview(null);
        setAudienceError(error);
      }).finally(() => setAudienceLoading(false));
    }, 400);
    return () => clearTimeout(previewTimer.current);
  }, [schoolId, audience, audienceType, classFilter, studentIds]);
  useEffect(() => {
    if (!schoolId) return;
    writeStoredDraft(schoolId, {
      audienceType,
      classFilter,
      studentIds,
      minBalance,
      overdueDays,
      gracePeriodDays,
      dueSoonDays,
      excludeRecentPayers,
      recentPaymentWindowHours,
      body,
      category,
      templateId,
      scheduledAt
    });
  }, [
    schoolId,
    audienceType,
    classFilter,
    studentIds,
    minBalance,
    overdueDays,
    gracePeriodDays,
    dueSoonDays,
    excludeRecentPayers,
    recentPaymentWindowHours,
    body,
    category,
    templateId,
    scheduledAt
  ]);
  const estimatedCost = audiencePreview?.matchCount ? segments * audiencePreview.matchCount : null;
  const affordable = credits?.balance !== void 0 && estimatedCost !== null ? credits.balance >= estimatedCost : null;
  const applyTemplate = useCallback((template) => {
    setBody(template.body);
    if (template.category) setCategory(template.category);
    setTemplateId(template.schoolId ? template._id : null);
    setSendResult(null);
    setSendError(null);
  }, []);
  const resetComposer = useCallback(() => {
    setAudienceType("overdue");
    setClassFilter("");
    setMinBalance(1);
    setOverdueDays(30);
    setGracePeriodDays(30);
    setDueSoonDays(5);
    setExcludeRecentPayers(true);
    setRecentPaymentWindowHours(48);
    setBody(PRESET_TEMPLATES[0].body);
    setCategory("fee_reminder");
    setTemplateId(null);
    setScheduledAt("");
    setConfirmed(false);
    setSendResult(null);
    setSendError(null);
    clearStoredDraft(schoolId);
  }, [schoolId]);
  const saveTemplate = useCallback(
    async ({ name, body: body_, category: category_, id } = {}) => {
      if (!schoolId) return null;
      const payload = {
        name: name ?? "Untitled template",
        body: body_ ?? body,
        category: category_ ?? category
      };
      const saved = id ? await updateSmsTemplate(id, payload) : await createSmsTemplate({ ...payload, schoolId });
      await loadTemplates();
      return saved;
    },
    [schoolId, body, category, loadTemplates]
  );
  const removeTemplate = useCallback(
    async (id) => {
      await deleteSmsTemplate(id);
      if (String(templateId) === String(id)) setTemplateId(null);
      await loadTemplates();
    },
    [templateId, loadTemplates]
  );
  const refreshCredits = useCallback(async () => {
    if (!schoolId) return null;
    try {
      const result = await getSmsCredits(schoolId);
      setCredits(result);
      return result;
    } catch (error) {
      setCreditsError(error);
      return null;
    }
  }, [schoolId]);
  const send = useCallback(async () => {
    if (audienceType === "students" && !studentIds.length) {
      const error = new Error("Pick at least one student, or choose a different audience.");
      setSendError(error);
      throw error;
    }
    setSending(true);
    setSendError(null);
    try {
      const result = await sendBulkSms({
        schoolId,
        audience,
        body,
        category,
        templateId: templateId || void 0,
        scheduledAt: scheduledAt || void 0,
        confirmBroadcast: audienceType === "all" ? true : void 0
      });
      setSendResult(result);
      setConfirmed(false);
      const refreshed = await getSmsCredits(schoolId);
      setCredits(refreshed);
      await loadHistory();
      return result;
    } catch (error) {
      setSendError(error);
      throw error;
    } finally {
      setSending(false);
    }
  }, [schoolId, audience, body, category, templateId, scheduledAt, audienceType, studentIds, loadHistory]);
  const cancelJob = useCallback(
    async (jobId) => {
      setBusyJobId(jobId);
      setActionError(null);
      try {
        await cancelSmsJob(jobId);
        await loadHistory();
        const refreshed = await getSmsCredits(schoolId);
        setCredits(refreshed);
      } catch (error) {
        setActionError(error);
        throw error;
      } finally {
        setBusyJobId(null);
      }
    },
    [schoolId, loadHistory]
  );
  const readyToConfirm = Boolean(body.trim()) && unknown.length === 0 && !overSegmentLimit && audiencePreview?.matchCount > 0 && affordable === true;
  const canQueue = readyToConfirm && confirmed;
  return {
    // Scope
    schoolId,
    // Navigation
    tab,
    setTab: (value) => setParam({ tab: value }, { resetPage: false }),
    historyFilters,
    setHistoryFilter: (patch) => setParam(patch),
    clearHistoryFilters: () => setParam({ status: "all", category: "all", q: "" }, { resetPage: false }),
    // Credits
    credits,
    creditsLoading,
    creditsError,
    balance: credits?.balance ?? null,
    balanceCedis: credits?.balanceCedis ?? null,
    ratePes: credits?.ratePes ?? 12,
    deliveryRate: credits?.usage?.deliveryRate ?? null,
    usage: credits?.usage ?? null,
    topUps: credits?.topUps ?? [],
    // Whether a send would reach a handset at all. The composer states this
    // rather than letting a bursar compose 200 messages and discover it on send.
    canSend: credits?.canSend ?? null,
    gateway: credits?.gateway ?? null,
    // Templates
    templates,
    presets: PRESET_TEMPLATES,
    tokens: SMS_TOKENS,
    templatesLoading,
    applyTemplate,
    saveTemplate,
    removeTemplate,
    refreshCredits,
    reloadKey,
    // Composer
    audienceType,
    setAudienceType,
    audienceRules: AUDIENCE_RULES,
    classFilter,
    setClassFilter,
    studentIds,
    setStudentIds,
    minBalance,
    setMinBalance,
    overdueDays,
    setOverdueDays,
    gracePeriodDays,
    setGracePeriodDays,
    dueSoonDays,
    setDueSoonDays,
    excludeRecentPayers,
    setExcludeRecentPayers,
    recentPaymentWindowHours,
    setRecentPaymentWindowHours,
    body,
    setBody,
    category,
    setCategory,
    templateId,
    scheduledAt,
    setScheduledAt,
    confirmed,
    setConfirmed,
    // Derived
    audience,
    tokensInBody: tokens,
    unknownTokens: unknown,
    rendered,
    segments,
    perSegmentLimit,
    overSegmentLimit,
    audiencePreview,
    audienceLoading,
    audienceError,
    estimatedCost,
    affordable,
    canQueue,
    readyToConfirm,
    // Actions
    send,
    sending,
    sendError,
    sendResult,
    resetComposer,
    cancelJob,
    busyJobId,
    actionError,
    // History
    jobs,
    jobsMeta,
    messages,
    messagesMeta,
    historyLoading,
    historyError,
    reloadHistory: loadHistory
  };
};
const BroadcastSmsCard = ({ broadcast }) => {
  const { user } = useAuth();
  const { warning, error: errorToast, success } = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState(null);
  const AUDIENCE = { type: "overdue", minBalance: 1, overdueDays: 30, gracePeriodDays: 30 };
  useEffect(() => {
    if (!user?.schoolId) {
      setLoading(false);
      return void 0;
    }
    let active = true;
    previewAudience(AUDIENCE, user.schoolId).then((result) => {
      if (active) setOverdue(result);
    }).catch(() => {
      if (active) setOverdue(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);
  const recipientCount = overdue?.matchCount ?? broadcast?.recipientCount ?? 0;
  const totalOwed = overdue?.totalBalance ?? broadcast?.totalOutstanding ?? 0;
  const nothingSent = recipientCount === 0;
  const runSend = async () => {
    setConfirming(false);
    if (!user?.schoolId) {
      warning("This account is not linked to a school yet, so there is nobody to notify.");
      return;
    }
    setSending(true);
    try {
      const result = await sendBulkSms({
        schoolId: user.schoolId,
        audience: AUDIENCE,
        body: PRESET_TEMPLATES[0].body,
        category: "overdue"
      });
      success(
        `Reminder queued for ${formatCount(result?.job?.recipients || 0)} parents. Track it on the SMS Reminders page.`
      );
    } catch (err) {
      if (err?.code === "SMS_SEND_NOT_SUPPORTED") {
        warning(err.message);
      } else {
        errorToast(err?.message || "The reminders could not be queued.");
      }
    } finally {
      setSending(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "border-red-100 bg-red-50/40", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600", children: /* @__PURE__ */ jsx(Bell, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold leading-tight tracking-tight text-ink", children: "Broadcast SMS Prompt" })
      ] }),
      nothingSent && !loading ? /* @__PURE__ */ jsx("p", { className: "mt-4 text-[13px] font-semibold leading-relaxed text-slate-600", children: "No student currently owes a fee, so there is nobody to remind. This card appears once a balance is outstanding." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("p", { className: "mt-4 flex items-center gap-2 text-[13px] font-extrabold text-red-600", children: loading ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
          "Sizing the overdue list…"
        ] }) : `${formatCount(recipientCount)} Overdue Parents detected` }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-3 space-y-1.5 rounded-xl bg-white/70 p-3 text-[12px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Outstanding total" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCediShort(totalOwed) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Overdue means" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: "Past 30-day grace" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Message" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: "Gentle Prompt" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setConfirming(true),
            disabled: sending || loading,
            className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60",
            children: [
              /* @__PURE__ */ jsx(Send, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Send Overdue Fee SMS Prompt"
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => navigate(ROUTES.DASHBOARD_SMS),
            className: "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
            children: "Edit in the SMS Reminders composer"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: confirming,
        onClose: () => setConfirming(false),
        title: "Send the overdue reminder?",
        description: "This messages real parents and cannot be unsent.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => setConfirming(false), children: "Cancel" }),
          /* @__PURE__ */ jsxs(Button, { variant: "primary", onClick: runSend, disabled: sending, children: [
            "Send to ",
            formatCount(recipientCount),
            " parents"
          ] })
        ] }),
        children: /* @__PURE__ */ jsx("dl", { className: "space-y-2.5 text-sm", children: [
          { label: "Recipients", value: `${formatCount(recipientCount)} parents` },
          { label: "Audience", value: "Past the 30-day grace period" },
          { label: "Message", value: "Gentle Prompt (platform preset)" },
          { label: "Outstanding total", value: formatCediShort(totalOwed) }
        ].map((row) => /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
          /* @__PURE__ */ jsx("dt", { className: "font-medium text-slate-500", children: row.label }),
          /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: row.value })
        ] }, row.label)) })
      }
    )
  ] });
};
const UpcomingInstallmentsCard = ({ upcoming }) => {
  const days = upcoming?.days ?? [];
  const hasSchedule = days.length > 0;
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600", children: /* @__PURE__ */ jsx(CalendarClock, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold leading-tight tracking-tight text-ink", children: "Upcoming Installments" })
      ] }),
      hasSchedule && /* @__PURE__ */ jsxs(Badge, { tone: "slate", children: [
        "Next ",
        upcoming.horizonDays,
        " Days"
      ] })
    ] }),
    hasSchedule ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-extrabold leading-none tracking-tight text-ink", children: formatCount(upcoming.scheduledTranches) }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold leading-snug text-slate-500", children: "Scheduled Tranches" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-extrabold leading-none tracking-tight text-brand-700", children: formatCediWhole(upcoming.expectedInflow) }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold leading-snug text-slate-500", children: "Expected Inflow" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("ul", { className: "mt-3 flex flex-col divide-y divide-slate-100", children: days.map((day) => /* @__PURE__ */ jsxs("li", { className: "flex items-center justify-between gap-3 py-2.5", children: [
        /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("span", { className: "block truncate text-[12px] font-extrabold text-ink", children: day.dateLabel }),
          /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
            formatCount(day.students),
            " students"
          ] })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[13px] font-extrabold tabular-nums text-ink", children: formatCediShort(day.amount) })
      ] }, day.dateLabel)) })
    ] }) : /* @__PURE__ */ jsx("p", { className: "text-[12px] font-medium leading-relaxed text-slate-500", children: "A day-by-day list of what falls due is not available yet. The full installment schedule and its compliance is on the Installment Plans module." }),
    /* @__PURE__ */ jsxs(
      Link,
      {
        to: ROUTES.DASHBOARD_PLANS,
        className: "mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-200",
        children: [
          "View Compliance Schedule",
          /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4", "aria-hidden": "true" })
        ]
      }
    )
  ] });
};
const Overview = () => {
  const { user } = useAuth();
  const { data, loading, isFallback, seriesFor, refresh } = useDashboardOverview(user?.schoolId);
  const { success, error: errorToast } = useToast();
  const [recording, setRecording] = useState(false);
  const onExport = () => {
    exportStudents({ status: "all", perPage: 100, format: "csv" }).then(({ filename }) => success(`Downloaded ${filename}`)).catch((error) => errorToast(error.message));
  };
  if (loading || !data) {
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "h-8 w-64 animate-pulse rounded-lg bg-slate-200" }),
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-2xl bg-slate-200/70" }, i)) })
    ] });
  }
  const { school, term, kpis, channels, transactions, transactionCount, upcomingInstallments, smsBroadcast } = data;
  const subtitle = [
    term.term,
    term.academicYear ? `Academic Year ${term.academicYear}` : "",
    school.city
  ].filter(Boolean).join(" • ");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: [
          "Overview",
          /* @__PURE__ */ jsx("span", { className: "h-1 w-1 rounded-full bg-slate-300", "aria-hidden": "true" }),
          isFallback ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 text-amber-600", children: [
            /* @__PURE__ */ jsx(TriangleAlert, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "Not connected"
          ] }) : /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 text-brand-700", children: [
            /* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-brand-500", "aria-hidden": "true" }),
            "Live sync active"
          ] })
        ] }),
        /* @__PURE__ */ jsx("h1", { className: "mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl", children: "Dashboard Overview" }),
        subtitle && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[13px] font-semibold text-slate-500", children: subtitle })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onExport,
            disabled: isFallback,
            title: isFallback ? "Available once the dashboard can reach the API" : "Export this term’s figures",
            className: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300",
            children: [
              /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Export Financial Report",
              /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "(CSV/PDF)" })
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setRecording(true),
            disabled: isFallback,
            title: isFallback ? "Available once the dashboard can reach the API" : "Record a cash, cheque or bank transfer payment",
            className: "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
            children: [
              /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Record Manual Payment"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(ErrorBoundary, { label: "The KPI figures", children: /* @__PURE__ */ jsx(KpiRow, { kpis }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 xl:col-span-2", children: [
        /* @__PURE__ */ jsx(ErrorBoundary, { label: "Collections", children: /* @__PURE__ */ jsx(CollectionsCard, { term, seriesFor }) }),
        /* @__PURE__ */ jsx(ErrorBoundary, { label: "Recent transactions", children: /* @__PURE__ */ jsx(
          RecentTransactionsCard,
          {
            transactions,
            totalCount: transactionCount,
            isDemo: isFallback
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsx(ErrorBoundary, { label: "Payment channels", children: /* @__PURE__ */ jsx(PaymentChannelsCard, { channels }) }),
        /* @__PURE__ */ jsx(ErrorBoundary, { label: "SMS reminders", children: /* @__PURE__ */ jsx(BroadcastSmsCard, { broadcast: smsBroadcast }) }),
        /* @__PURE__ */ jsx(ErrorBoundary, { label: "Upcoming installments", children: /* @__PURE__ */ jsx(UpcomingInstallmentsCard, { upcoming: upcomingInstallments }) })
      ] })
    ] }),
    isFallback && /* @__PURE__ */ jsx("p", { className: "mt-4 text-[11px] font-semibold text-amber-700", children: "The dashboard could not reach the API, so every figure above is empty rather than estimated. Nothing on this page is a placeholder." }),
    /* @__PURE__ */ jsx(
      RecordManualPaymentDialog,
      {
        open: recording,
        onClose: () => setRecording(false),
        onRecorded: refresh
      }
    )
  ] });
};
const PageHeader = ({ eyebrow, title, description, actions, meta }) => /* @__PURE__ */ jsxs("div", { className: "mb-5 flex flex-wrap items-start justify-between gap-4", children: [
  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
    eyebrow && /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: eyebrow }),
    /* @__PURE__ */ jsx("h1", { className: `${eyebrow ? "mt-1.5" : ""} text-2xl font-extrabold tracking-tight text-ink sm:text-3xl`, children: title }),
    description && /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-2xl text-[13px] font-semibold text-slate-500", children: description }),
    meta && /* @__PURE__ */ jsx("div", { className: "mt-3", children: meta })
  ] }),
  actions && /* @__PURE__ */ jsx("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: actions })
] });
const ModuleTabs = ({ items, value, onChange, ariaLabel = "Section" }) => {
  if (!items?.length) return null;
  const tabClass = (active) => `whitespace-nowrap border-b-2 px-1 pb-3 pt-1 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${active ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink"}`;
  return /* @__PURE__ */ jsx("nav", { "aria-label": ariaLabel, className: "mb-6 border-b border-slate-200", children: /* @__PURE__ */ jsx("ul", { className: "-mb-px flex gap-6 overflow-x-auto", children: items.map((item) => {
    const active = value === item.value;
    return /* @__PURE__ */ jsx("li", { className: "shrink-0", children: /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => onChange(item.value),
        "aria-current": active ? "page" : void 0,
        className: tabClass(active),
        children: item.label
      }
    ) }, item.value);
  }) }) });
};
const RosterKpiRow = ({ stats, loading }) => {
  if (loading || !stats) {
    return /* @__PURE__ */ jsx("div", { className: "mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [0, 1, 2, 3].map((i) => /* @__PURE__ */ jsx("div", { className: "h-28 animate-pulse rounded-2xl bg-slate-200/60" }, i)) });
  }
  const collectionRate = stats.totalOwed ? stats.totalPaid / stats.totalOwed * 100 : 0;
  return /* @__PURE__ */ jsxs("div", { className: "mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Total Roster",
        icon: Receipt,
        value: formatCount(stats.totalRoster),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-brand-700", children: formatCount(stats.activePlanStudents) }),
          " ",
          "on an installment plan"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Fully Cleared",
        icon: CircleCheck,
        value: formatCount(stats.fullyCleared),
        valueTone: "text-emerald-600",
        footer: /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-slate-500", children: "Share of roster" }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: formatPercent(stats.clearedPercent) })
          ] }),
          /* @__PURE__ */ jsx(ProgressBar, { value: stats.clearedPercent, label: "Share fully cleared", barClassName: "bg-emerald-500" })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Installment Pledges",
        icon: HandCoins,
        value: formatCount(stats.activePlans),
        valueTone: "text-amber-600",
        footer: /* @__PURE__ */ jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-slate-500", children: "Collection rate" }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: formatPercent(collectionRate) })
          ] }),
          /* @__PURE__ */ jsx(ProgressBar, { value: collectionRate, label: "Collection rate", barClassName: "bg-amber-500" })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Overdue Balances",
        icon: TriangleAlert,
        value: formatCount(stats.overdueStudents),
        valueTone: "text-red-600",
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-red-600", children: formatCediShort(stats.overdueAmount) }),
          " ",
          "outstanding past deadline"
        ] })
      }
    )
  ] });
};
const DEBOUNCE_MS$1 = 300;
const RosterFilterBar = ({ filters, setFilter, clearFilters, hasFilters, classes = [] }) => {
  const [term, setTerm] = useState(filters.search);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setTerm(filters.search), [filters.search]);
  useEffect(() => {
    if (term === filters.search) return void 0;
    const timer = setTimeout(() => setFilter({ q: term }), DEBOUNCE_MS$1);
    return () => clearTimeout(timer);
  }, [term, filters.search, setFilter]);
  const update = (patch) => setFilter(patch);
  return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "mb-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-end", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative lg:max-w-sm lg:flex-1", children: [
        /* @__PURE__ */ jsx("label", { htmlFor: "roster-search", className: "mb-0.5 block text-[11px] font-semibold text-slate-700", children: "Search" }),
        /* @__PURE__ */ jsx(
          Search,
          {
            className: "pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400",
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            id: "roster-search",
            type: "search",
            value: term,
            onChange: (event) => setTerm(event.target.value),
            placeholder: "Student name, ID, or parent phone…",
            className: "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Class",
          value: filters.class,
          onChange: (event) => update({ class: event.target.value }),
          className: "lg:w-44",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All Classes" }),
            classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Fee Status",
          value: filters.feeStatus,
          onChange: (event) => update({ feeStatus: event.target.value }),
          className: "lg:w-40",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All" }),
            /* @__PURE__ */ jsx("option", { value: "cleared", children: "Fully Cleared" }),
            /* @__PURE__ */ jsx("option", { value: "owing", children: "Owing" }),
            /* @__PURE__ */ jsx("option", { value: "overdue", children: "Overdue" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Plan Status",
          value: filters.planStatus,
          onChange: (event) => update({ planStatus: event.target.value }),
          className: "lg:w-40",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All Students" }),
            /* @__PURE__ */ jsx("option", { value: "active", children: "On Track" }),
            /* @__PURE__ */ jsx("option", { value: "pending", children: "Awaiting Parent" }),
            /* @__PURE__ */ jsx("option", { value: "completed", children: "Completed" }),
            /* @__PURE__ */ jsx("option", { value: "defaulted", children: "Defaulted" }),
            /* @__PURE__ */ jsx("option", { value: "none", children: "No Plan" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => setExpanded((value) => !value),
          "aria-expanded": expanded,
          className: "mb-0.5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
          children: [
            /* @__PURE__ */ jsx(SlidersHorizontal, { className: "h-4 w-4", "aria-hidden": "true" }),
            expanded ? "Fewer" : "More"
          ]
        }
      )
    ] }),
    expanded && /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end", children: [
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Record status",
          value: filters.status,
          onChange: (event) => update({ status: event.target.value }),
          className: "sm:w-44",
          children: [
            /* @__PURE__ */ jsx("option", { value: "active", children: "Active" }),
            /* @__PURE__ */ jsx("option", { value: "suspended", children: "Suspended" }),
            /* @__PURE__ */ jsx("option", { value: "graduated", children: "Graduated" }),
            /* @__PURE__ */ jsx("option", { value: "transferred_out", children: "Transferred Out" }),
            /* @__PURE__ */ jsx("option", { value: "all", children: "All Records" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Gender",
          value: filters.gender,
          onChange: (event) => update({ gender: event.target.value }),
          className: "sm:w-40",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All" }),
            /* @__PURE__ */ jsx("option", { value: "male", children: "Male" }),
            /* @__PURE__ */ jsx("option", { value: "female", children: "Female" })
          ]
        }
      ),
      hasFilters && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: clearFilters,
          className: "mb-0.5 h-9 rounded-lg px-3 text-[13px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50",
          children: "Clear all filters"
        }
      )
    ] })
  ] });
};
const RosterFilterBar$1 = React.memo(RosterFilterBar);
const EmptyState = ({ icon: Icon, title, description, action }) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center", children: [
  Icon && /* @__PURE__ */ jsx("span", { className: "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-6 w-6", "aria-hidden": "true" }) }),
  /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: title }),
  description && /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-md text-sm font-medium text-slate-500", children: description }),
  action && /* @__PURE__ */ jsx("div", { className: "mt-5", children: action })
] });
const feeStatusOf = (student) => {
  const balance = student.balance || 0;
  if (balance <= 0) return "paid";
  const deadline = student.deadline ? new Date(student.deadline) : null;
  if (deadline && deadline < /* @__PURE__ */ new Date()) return student.onGrace ? "grace" : "overdue";
  return "owing";
};
const FEE = {
  paid: { label: "Paid", tone: "green", icon: CircleCheck },
  grace: { label: "On Grace", tone: "amber", icon: Hourglass },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  owing: { label: "Due Soon", tone: "amber", icon: TrendingUp }
};
const FeeStatusBadge = ({ student, className = "" }) => {
  const key = feeStatusOf(student);
  const config = FEE[key];
  return /* @__PURE__ */ jsx(Badge, { tone: config.tone, icon: config.icon, className, children: config.label });
};
const PLAN = {
  none: { label: "No Plan", tone: "slate" },
  pending: { label: "Awaiting Parent", tone: "amber" },
  active: { label: "On Track", tone: "green" },
  completed: { label: "Completed", tone: "brand" },
  defaulted: { label: "Defaulted", tone: "red" }
};
const PlanStatusBadge = ({ status, className = "" }) => {
  const config = PLAN[status] || PLAN.none;
  return /* @__PURE__ */ jsx(Badge, { tone: config.tone, className, children: config.label });
};
const STATUS = {
  active: { label: "Active", tone: "green" },
  suspended: { label: "Suspended", tone: "amber" },
  removed: { label: "Removed", tone: "slate" },
  graduated: { label: "Graduated", tone: "brand" },
  transferred_out: { label: "Transferred Out", tone: "blue" }
};
const StatusBadge = ({ status, className = "" }) => {
  const config = STATUS[status] || { label: status, tone: "slate" };
  return /* @__PURE__ */ jsx(Badge, { tone: config.tone, className, children: config.label });
};
const PER_PAGE_OPTIONS = [8, 20, 50, 100];
const pageWindow$1 = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window2 = /* @__PURE__ */ new Set([1, totalPages, page, page - 1, page + 1]);
  const pages = [...window2].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return pages;
};
const Pagination$1 = ({ meta = {}, onPageChange, onPerPageChange, itemLabel = "students" }) => {
  const { page = 1, perPage = 20, total = 0, totalPages = 0 } = meta;
  if (!total) return null;
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const pages = pageWindow$1(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between", children: [
    /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
      "Showing ",
      /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(first) }),
      "–",
      /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(last) }),
      " of",
      " ",
      /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(total) }),
      " ",
      itemLabel,
      /* @__PURE__ */ jsx("span", { className: "mx-2 text-slate-300", "aria-hidden": "true", children: "•" }),
      /* @__PURE__ */ jsx("label", { htmlFor: "roster-per-page", className: "whitespace-nowrap", children: "Rows per page:" }),
      " ",
      /* @__PURE__ */ jsx(
        "select",
        {
          id: "roster-per-page",
          value: perPage,
          onChange: (event) => onPerPageChange(Number(event.target.value)),
          className: "rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-[12px] font-extrabold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20",
          children: PER_PAGE_OPTIONS.map((option) => /* @__PURE__ */ jsx("option", { value: option, children: option }, option))
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("nav", { "aria-label": "Pagination", className: "flex items-center gap-1", children: [
      /* @__PURE__ */ jsxs(
        PageButton,
        {
          onClick: () => onPageChange(page - 1),
          disabled: !canPrev,
          label: "Previous page",
          children: [
            /* @__PURE__ */ jsx(ChevronLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Previous" })
          ]
        }
      ),
      pages.map((p, index) => {
        const previous = pages[index - 1];
        const gap = previous !== void 0 && p - previous > 1;
        return /* @__PURE__ */ jsxs(React.Fragment, { children: [
          gap && /* @__PURE__ */ jsx("span", { className: "px-1 text-slate-300", children: "…" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => onPageChange(p),
              "aria-current": p === page ? "page" : void 0,
              "aria-label": `Page ${p}`,
              className: `h-9 min-w-9 rounded-lg px-2.5 text-[13px] font-extrabold transition-colors ${p === page ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`,
              children: p
            }
          )
        ] }, p);
      }),
      /* @__PURE__ */ jsxs(PageButton, { onClick: () => onPageChange(page + 1), disabled: !canNext, label: "Next page", children: [
        /* @__PURE__ */ jsx("span", { className: "hidden sm:inline", children: "Next" }),
        /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4", "aria-hidden": "true" })
      ] })
    ] })
  ] });
};
const PageButton = ({ children, disabled, onClick, label }) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    onClick,
    disabled,
    "aria-label": label,
    className: "inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40",
    children
  }
);
const TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700"
];
const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg"
};
const initialsOf$1 = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
const toneFor = (student) => {
  const key = String(student?._id || student?.id || student?.studentName || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = hash * 31 + key.charCodeAt(i) >>> 0;
  }
  return TONES[hash % TONES.length];
};
const StudentAvatar = ({ student, size = "md", className = "", decorative = true }) => {
  const [failed, setFailed] = useState(false);
  const image = student?.studentImage;
  const showImage = Boolean(image) && !failed;
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: `flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold ${SIZES[size] || SIZES.md} ${showImage ? "bg-slate-100" : toneFor(student)} ${className}`,
      "aria-hidden": decorative ? "true" : void 0,
      role: decorative ? void 0 : "img",
      "aria-label": decorative ? void 0 : student?.studentName || "Student",
      children: showImage ? /* @__PURE__ */ jsx(
        "img",
        {
          src: image,
          alt: "",
          onError: () => setFailed(true),
          className: "h-full w-full object-cover",
          loading: "lazy"
        }
      ) : initialsOf$1(student?.studentName) || "?"
    }
  );
};
const GHANA_PHONE_REGEX = /^(0[2-5]\d{8}|233[2-5]\d{8})$/;
const formatGhanaPhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  const local = digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  if (local.length !== 10) return raw || "";
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
};
const maskGhanaPhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  const local = digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  if (local.length !== 10) return raw || "";
  return `${local.slice(0, 3)} ••• •${local.slice(-2)}`;
};
const COLUMNS$1 = [
  { key: "studentName", label: "Student", sortable: true },
  { key: "studentClass", label: "Class", sortable: false },
  { key: "totalOwed", label: "Fee / Paid", sortable: true },
  { key: "balance", label: "Balance", sortable: true },
  { key: "plan", label: "Installment", sortable: false },
  { key: "fee", label: "Fee Status", sortable: false }
];
const StudentTable = ({
  rows,
  loading,
  error,
  meta,
  filters,
  onSort,
  onPageChange,
  onPerPageChange,
  onOpenProfile,
  onEdit,
  onClearFilters,
  hasFilters,
  selection,
  onMessage,
  onRegeneratePayLink,
  onTransferOut
}) => {
  const toggleSort = (key) => {
    if (!key) return;
    if (filters.sortBy === key) {
      onSort({ sortBy: key, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
    } else {
      onSort({ sortBy: key, sortOrder: "asc" });
    }
  };
  if (error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-0", children: /* @__PURE__ */ jsx("div", { className: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: error.message }) }) });
  }
  if (!loading && !rows.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Search,
        title: hasFilters ? "No students match these filters" : "No students on the roster yet",
        description: hasFilters ? "Try widening the class or fee status. A filter that matches nothing usually means the school is ahead of schedule, not that the data is missing." : "Add a student one at a time, or import the whole roster from a spreadsheet.",
        action: hasFilters && /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClearFilters, children: "Clear filters" })
      }
    );
  }
  return /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[60rem] border-collapse text-left", children: [
      /* @__PURE__ */ jsxs("caption", { className: "sr-only", children: [
        "Students on the roster. ",
        meta?.total ? formatCount(meta.total) : 0,
        " students."
      ] }),
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "bg-slate-50", children: [
        /* @__PURE__ */ jsx("th", { scope: "col", className: "w-10 px-4 py-3", children: /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: selection.allVisibleSelected,
            onChange: selection.toggleAllVisible,
            "aria-label": "Select all students on this page",
            disabled: !rows.length,
            className: "h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
          }
        ) }),
        COLUMNS$1.map((column) => /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            "aria-sort": filters.sortBy === column.key ? filters.sortOrder === "asc" ? "ascending" : "descending" : "none",
            className: "whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
            children: column.sortable ? /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => toggleSort(column.key),
                className: "inline-flex items-center gap-1 transition-colors hover:text-ink",
                children: [
                  column.label,
                  filters.sortBy === column.key && (filters.sortOrder === "asc" ? /* @__PURE__ */ jsx(ArrowUp, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(ArrowDown, { className: "h-3.5 w-3.5", "aria-hidden": "true" }))
                ]
              }
            ) : column.label
          },
          column.label
        )),
        /* @__PURE__ */ jsx("th", { scope: "col", className: "w-24 px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Actions" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: loading ? Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: COLUMNS$1.length + 2, className: "px-4 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, `skeleton-${index}`)) : rows.map((student, index) => {
        const id = String(student._id || student.id);
        const primaryParent = (student.parents || []).find((p) => p.isPrimary) || student.parents?.[0];
        const isOverdue = student.balance > 0 && student.deadline < /* @__PURE__ */ new Date();
        return /* @__PURE__ */ jsxs(
          "tr",
          {
            className: "border-t border-slate-100 transition-colors hover:bg-slate-50/70",
            children: [
              /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: selection.selected.has(id),
                  onChange: () => selection.toggleRow(id),
                  "aria-label": `Select ${student.studentName}`,
                  className: "h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                }
              ) }),
              /* @__PURE__ */ jsx("th", { scope: "row", className: "px-4 py-3 font-normal", children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => onOpenProfile(student),
                  className: "group flex items-center gap-3 text-left",
                  children: [
                    /* @__PURE__ */ jsx(StudentAvatar, { student, size: "md" }),
                    /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                      /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink group-hover:text-brand-700", children: student.studentName }),
                      /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                        student.studentId,
                        primaryParent?.phone && /* @__PURE__ */ jsxs(Fragment, { children: [
                          " · ",
                          maskGhanaPhone(primaryParent.phone)
                        ] })
                      ] })
                    ] })
                  ]
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: /* @__PURE__ */ jsx("span", { className: "inline-block rounded-md bg-slate-100 px-2 py-1 text-[12px] font-extrabold text-slate-700", children: student.studentClass }) }),
              /* @__PURE__ */ jsxs("td", { className: "whitespace-nowrap px-4 py-3 text-right", children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold tabular-nums text-ink", children: formatCedis(student.totalOwed) }),
                /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold tabular-nums text-slate-500", children: [
                  "paid ",
                  formatCedis(student.totalPaid)
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "td",
                {
                  className: `whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold tabular-nums ${student.balance > 0 ? isOverdue ? "text-red-600" : "text-amber-600" : "text-emerald-600"}`,
                  children: formatCedis(student.balance)
                }
              ),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: student.planStatus && student.planStatus !== "none" ? /* @__PURE__ */ jsx(PlanStatusBadge, { status: student.planStatus }) : /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-400", children: "—" }) }),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: /* @__PURE__ */ jsx(FeeStatusBadge, { student }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onMessage(student),
                    "aria-label": `Send a reminder to the guardian of ${student.studentName}`,
                    title: "Send fee reminder",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onRegeneratePayLink(student),
                    "aria-label": `Regenerate the pay link for ${student.studentName}`,
                    title: "Regenerate pay link",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(CreditCard, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                onTransferOut && /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onTransferOut(student),
                    "aria-label": `Record a transfer out for ${student.studentName}`,
                    title: "Record transfer out (GES TS-4)",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onEdit(student),
                    "aria-label": `Edit ${student.studentName}`,
                    title: "Edit student",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(PencilLine, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onOpenProfile(student),
                    "aria-label": `Open the profile of ${student.studentName}`,
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                )
              ] }) })
            ]
          },
          id
        );
      }) })
    ] }) }),
    meta?.total > 0 && /* @__PURE__ */ jsx(
      Pagination$1,
      {
        meta,
        onPageChange,
        onPerPageChange,
        itemLabel: "students"
      }
    )
  ] });
};
const BulkActionBar = ({ selection, onDone, onError }) => {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [update, setUpdate] = useState({ field: "totalOwed", totalOwed: null, deadline: "" });
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("suspended");
  const [statusReason, setStatusReason] = useState("");
  if (!selection.hasSelection) return null;
  const scopeLabel = selection.allMatching ? "every student matching your filters" : `${formatCount(selection.selected.size)} selected student${selection.selected.size === 1 ? "" : "s"}`;
  const close = () => {
    setDialog(null);
    setPreview(null);
  };
  const run = async (fn) => {
    setBusy(true);
    try {
      const result = await fn();
      onDone(result);
      close();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "sticky bottom-4 z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lift sm:flex-row sm:items-center sm:justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: selection.clear,
            "aria-label": "Clear selection",
            className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink",
            children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4", "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ jsxs("p", { className: "min-w-0 text-[13px] font-bold text-slate-600", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: selection.allMatching ? "All filtered students" : `${formatCount(selection.selected.size)} selected` }),
          selection.allMatching && /* @__PURE__ */ jsx("span", { className: "ml-2 text-[12px] font-semibold text-amber-700", children: "includes students not visible on this page" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsx(BulkButton, { icon: PencilLine, onClick: () => setDialog("update"), children: "Update" }),
        /* @__PURE__ */ jsx(BulkButton, { icon: Ban, onClick: () => setDialog("status"), children: "Suspend / Reactivate" }),
        /* @__PURE__ */ jsx(BulkButton, { icon: Link$1, onClick: () => setDialog("paylinks"), children: "Pay links" }),
        /* @__PURE__ */ jsx(BulkButton, { icon: Archive, danger: true, onClick: () => setDialog("archive"), children: "Archive" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: dialog === "update",
        onClose: close,
        title: `Update ${scopeLabel}?`,
        description: "This writes the same value to every selected student.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "primary",
              disabled: busy || update.field === "totalOwed" && update.totalOwed === null || update.field === "deadline" && !update.deadline,
              onClick: async () => {
                setBusy(true);
                try {
                  const payload = update.field === "totalOwed" ? { totalOwed: update.totalOwed } : { deadline: update.deadline };
                  const result = await onDone.previewBulkUpdate(selection.target, payload);
                  setPreview(result);
                } catch (err) {
                  onError(err);
                } finally {
                  setBusy(false);
                }
              },
              children: "Preview change"
            }
          )
        ] }),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            update.field === "totalOwed" && /* @__PURE__ */ jsx(
              MoneyInput,
              {
                label: "New total owed",
                hint: "Enter cedis",
                required: true,
                value: update.totalOwed,
                onChange: (value) => setUpdate((u) => ({ ...u, totalOwed: value }))
              }
            ),
            update.field === "deadline" && /* @__PURE__ */ jsx(
              Field,
              {
                label: "New deadline",
                type: "date",
                required: true,
                min: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
                value: update.deadline,
                onChange: (event) => setUpdate({ ...update, deadline: event.target.value })
              }
            ),
            preview ? /* @__PURE__ */ jsxs(FormAlert, { tone: "info", children: [
              /* @__PURE__ */ jsxs("span", { className: "font-extrabold", children: [
                formatCount(preview.matched),
                " students"
              ] }),
              " match your selection and will be updated. ",
              formatCount(preview.unchanged || 0),
              " already have this value and will not change."
            ] }) : /* @__PURE__ */ jsxs(FormAlert, { tone: "warning", children: [
              /* @__PURE__ */ jsx(TriangleAlert, { className: "mr-1.5 inline h-3.5 w-3.5", "aria-hidden": "true" }),
              "You are about to change ",
              update.field,
              " on ",
              scopeLabel,
              "."
            ] })
          ] }),
          preview && /* @__PURE__ */ jsxs("div", { className: "mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4", children: [
            /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => setPreview(null), children: "Change value" }),
            /* @__PURE__ */ jsxs(
              Button,
              {
                variant: "primary",
                disabled: busy,
                onClick: () => run(
                  () => onDone.bulkUpdate(selection.target, {
                    [update.field]: update.field === "totalOwed" ? update.totalOwed : update.deadline
                  })
                ),
                children: [
                  "Update ",
                  formatCount(preview.matched),
                  " students"
                ]
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: dialog === "archive",
        onClose: close,
        title: `Archive ${scopeLabel}?`,
        description: "They leave the roster. Payment history is kept, and this can be undone.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              variant: "danger",
              disabled: busy,
              onClick: () => run(() => onDone.bulkArchive(selection.target, { reason })),
              children: [
                /* @__PURE__ */ jsx(Trash2, { className: "mr-1.5 h-4 w-4", "aria-hidden": "true" }),
                "Archive ",
                selection.allMatching ? "all filtered" : `${formatCount(selection.selected.size)} students`
              ]
            }
          )
        ] }),
        children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Reason",
              hint: "optional, but useful later",
              value: reason,
              onChange: (event) => setReason(event.target.value),
              placeholder: "e.g. Transferred to another school"
            }
          ),
          /* @__PURE__ */ jsx(FormAlert, { tone: "warning", children: "Students with an outstanding balance are refused rather than archived, because archiving someone who still owes a term's fees is how a school loses track of who to chase. The response will list them." })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: dialog === "status",
        onClose: close,
        title: `Change status for ${scopeLabel}?`,
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              variant: "primary",
              disabled: busy,
              onClick: () => run(() => onDone.bulkStatus(selection.target, status, { reason: statusReason })),
              children: [
                /* @__PURE__ */ jsx(CirclePlay, { className: "mr-1.5 h-4 w-4", "aria-hidden": "true" }),
                "Apply to",
                " ",
                selection.allMatching ? "all filtered" : `${formatCount(selection.selected.size)} students`
              ]
            }
          )
        ] }),
        children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxs(
            SelectField,
            {
              label: "New status",
              value: status,
              onChange: (event) => setStatus(event.target.value),
              children: [
                /* @__PURE__ */ jsx("option", { value: "suspended", children: "Suspended" }),
                /* @__PURE__ */ jsx("option", { value: "active", children: "Active (reactivate)" })
              ]
            }
          ),
          status === "suspended" && /* @__PURE__ */ jsx(
            Field,
            {
              label: "Reason",
              hint: "required for a suspension",
              required: true,
              value: statusReason,
              onChange: (event) => setStatusReason(event.target.value),
              placeholder: "e.g. Fees unpaid for two terms"
            }
          ),
          /* @__PURE__ */ jsx(FormAlert, { tone: "info", children: "Only students currently in a state that allows this change are affected. Archived students must be restored instead, and the response lists anyone skipped." })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: dialog === "paylinks",
        onClose: close,
        title: `Regenerate pay links for ${scopeLabel}?`,
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: close, children: "Cancel" }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              variant: "primary",
              disabled: busy,
              onClick: () => run(() => onDone.bulkPayLinks(selection.target)),
              children: [
                /* @__PURE__ */ jsx(RotateCcw, { className: "mr-1.5 h-4 w-4", "aria-hidden": "true" }),
                "Regenerate"
              ]
            }
          )
        ] }),
        children: /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-slate-600", children: "Every existing link for these students stops working immediately. Use this when a link has been shared outside the school, not as a routine action." })
      }
    )
  ] });
};
const BulkButton = ({ icon: Icon, children, danger, onClick }) => /* @__PURE__ */ jsxs(
  "button",
  {
    type: "button",
    onClick,
    className: `inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-extrabold transition-colors ${danger ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`,
    children: [
      /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4", "aria-hidden": "true" }),
      children
    ]
  }
);
const TABS$3 = [
  { key: "overview", label: "Overview", icon: Wallet },
  { key: "payments", label: "Payments", icon: Receipt },
  { key: "plan", label: "Plan", icon: CalendarClock },
  { key: "guardians", label: "Guardians", icon: Users },
  { key: "history", label: "History", icon: History }
];
const StudentProfileDrawer = ({ open, studentId, onClose, onArchived }) => {
  const [tab, setTab] = useState("overview");
  const [state, setState] = useState({ data: null, loading: false, error: null });
  useEffect(() => {
    if (!open || !studentId) return void 0;
    let active = true;
    setState({ data: null, loading: true, error: null });
    setTab("overview");
    getStudentProfile(studentId).then((data2) => {
      if (active) setState({ data: data2, loading: false, error: null });
    }).catch((error2) => {
      if (active) setState({ data: null, loading: false, error: error2 });
    });
    return () => {
      active = false;
    };
  }, [open, studentId]);
  useEffect(() => {
    if (!open) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;
  const { data, loading, error } = state;
  const student = data?.student;
  const primaryGuardian2 = (data?.guardians || []).find((g) => g.isPrimary) || data?.guardians?.[0];
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex justify-end", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "aria-label": "Close the student profile",
        onClick: onClose,
        className: "absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      }
    ),
    /* @__PURE__ */ jsxs(
      "aside",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": student ? `${student.studentName}'s profile` : "Student profile",
        className: "relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-slate-50 shadow-2xl",
        children: [
          /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
                /* @__PURE__ */ jsx("span", { className: "mt-0.5", children: /* @__PURE__ */ jsx(StudentAvatar, { student, size: "xl" }) }),
                /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  loading && /* @__PURE__ */ jsx("div", { className: "h-6 w-48 animate-pulse rounded bg-slate-200" }),
                  student && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                      /* @__PURE__ */ jsx("h2", { className: "truncate text-lg font-extrabold tracking-tight text-ink", children: student.studentName }),
                      /* @__PURE__ */ jsx(StatusBadge, { status: student.status }),
                      student.isRepeating && /* @__PURE__ */ jsx(Badge, { tone: "amber", children: "Repeating" })
                    ] }),
                    /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: [
                      student.studentId,
                      " · ",
                      student.studentClass,
                      student.academicYear ? ` · ${student.academicYear}` : ""
                    ] })
                  ] }),
                  error && /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-sm font-bold text-red-600", children: [
                    /* @__PURE__ */ jsx(CircleAlert, { className: "h-4 w-4", "aria-hidden": "true" }),
                    error.message
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: onClose,
                  "aria-label": "Close",
                  className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink",
                  children: /* @__PURE__ */ jsx(X, { className: "h-5 w-5" })
                }
              )
            ] }),
            student && /* @__PURE__ */ jsx("nav", { "aria-label": "Profile sections", className: "mt-4 -mb-4 flex gap-5 overflow-x-auto", children: TABS$3.map((t) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setTab(t.key),
                "aria-current": tab === t.key ? "page" : void 0,
                className: `whitespace-nowrap border-b-2 pb-3 pt-1 text-[13px] font-extrabold transition-colors ${tab === t.key ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-ink"}`,
                children: t.label
              },
              t.key
            )) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-4 p-5", children: [
            loading && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
              /* @__PURE__ */ jsx("div", { className: "h-24 animate-pulse rounded-2xl bg-slate-200/60" }),
              /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-2xl bg-slate-200/60" })
            ] }),
            student && tab === "overview" && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
                /* @__PURE__ */ jsx(Figure$1, { label: "Total owed", value: formatCediShort(student.totalOwed) }),
                /* @__PURE__ */ jsx(Figure$1, { label: "Paid", value: formatCediShort(student.totalPaid), tone: "text-brand-700" }),
                /* @__PURE__ */ jsx(
                  Figure$1,
                  {
                    label: "Balance",
                    value: formatCediShort(student.balance),
                    tone: student.balance > 0 ? "text-red-600" : "text-emerald-600"
                  }
                ),
                /* @__PURE__ */ jsx(Figure$1, { label: "Fee status", value: /* @__PURE__ */ jsx(FeeStatusBadge, { student }) })
              ] }),
              /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Details" }),
                /* @__PURE__ */ jsx("dl", { className: "grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2", children: [
                  { label: "Gender", value: student.gender },
                  {
                    label: "Date of birth",
                    value: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB") : "Not recorded"
                  },
                  { label: "Class", value: student.studentClass },
                  {
                    label: "Deadline",
                    value: student.deadline ? new Date(student.deadline).toLocaleDateString("en-GB") : "—"
                  },
                  {
                    label: "Primary guardian",
                    value: primaryGuardian2 ? `${primaryGuardian2.parentName}${primaryGuardian2.phone ? ` · ${formatGhanaPhone(primaryGuardian2.phone)}` : ""}` : "—"
                  },
                  { label: "Pay link", value: student.payLink || "Not generated" }
                ].map((row) => /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: row.label }),
                  /* @__PURE__ */ jsx("dd", { className: "truncate text-[13px] font-bold text-ink", children: row.value })
                ] }, row.label)) })
              ] }),
              (student.certificateNumber || student.honors !== "NONE") && /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
                /* @__PURE__ */ jsxs("h3", { className: "mb-3 flex items-center gap-2 text-sm font-extrabold text-ink", children: [
                  /* @__PURE__ */ jsx(Star, { className: "h-4 w-4 text-amber-500", "aria-hidden": "true" }),
                  "Graduation"
                ] }),
                /* @__PURE__ */ jsxs("dl", { className: "grid grid-cols-2 gap-3", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: "Certificate" }),
                    /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-bold text-ink", children: student.certificateNumber || "—" })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: "Honors" }),
                    /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-bold text-ink", children: student.honors === "NONE" ? "—" : student.honors.replace(/_/g, " ") })
                  ] })
                ] })
              ] }),
              student.transferOutRecord?.destinationInstitution && /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "border-blue-200 bg-blue-50/40", children: [
                /* @__PURE__ */ jsx("h3", { className: "mb-2 text-sm font-extrabold text-ink", children: "Transferred to" }),
                /* @__PURE__ */ jsx("p", { className: "text-[13px] font-bold text-slate-700", children: student.transferOutRecord.destinationInstitution }),
                /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: [
                  student.transferOutDate ? new Date(student.transferOutDate).toLocaleDateString("en-GB") : "",
                  student.transferOutRecord.recordsTransferred ? " · records transferred" : " · records not transferred"
                ] })
              ] })
            ] }),
            student && tab === "payments" && /* @__PURE__ */ jsxs(Card, { padding: "p-0", children: [
              /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 px-5 py-4", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-extrabold text-ink", children: "Payment history" }),
                /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: "The 20 most recent settlements." })
              ] }),
              data.recentPayments?.length ? /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: data.recentPayments.map((payment) => /* @__PURE__ */ jsxs("li", { className: "flex items-center justify-between gap-3 px-5 py-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("p", { className: "truncate text-[13px] font-extrabold text-ink", children: formatCedi(payment.amount) }),
                  /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
                    payment.paymentMethod?.toUpperCase(),
                    " ·",
                    " ",
                    new Date(payment.createdAt).toLocaleDateString("en-GB")
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
                  Badge,
                  {
                    tone: payment.status === "completed" ? "green" : payment.status === "failed" ? "red" : "slate",
                    children: payment.status
                  }
                )
              ] }, payment._id)) }) : /* @__PURE__ */ jsx("p", { className: "px-5 py-8 text-center text-[13px] font-semibold text-slate-400", children: "No payments recorded against this student." })
            ] }),
            student && tab === "plan" && /* @__PURE__ */ jsx(Card, { padding: "p-5", children: data.installmentProgress ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-baseline justify-between gap-3", children: [
                /* @__PURE__ */ jsx("h3", { className: "text-sm font-extrabold text-ink", children: "Installment progress" }),
                /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold tabular-nums text-brand-700", children: formatPercent(data.installmentProgress.percent) })
              ] }),
              /* @__PURE__ */ jsx(
                ProgressBar,
                {
                  value: data.installmentProgress.percent,
                  label: "Installments paid",
                  barClassName: "bg-brand-600"
                }
              ),
              /* @__PURE__ */ jsxs("dl", { className: "mt-4 grid grid-cols-3 gap-3 text-center", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase text-slate-400", children: "Paid" }),
                  /* @__PURE__ */ jsxs("dd", { className: "text-[13px] font-extrabold text-ink", children: [
                    data.installmentProgress.paid,
                    "/",
                    data.installmentProgress.total
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase text-slate-400", children: "Paid" }),
                  /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-brand-700", children: formatCediShort(data.installmentProgress.paidAmount) })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase text-slate-400", children: "Next due" }),
                  /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-ink", children: data.installmentProgress.nextDueDate ? new Date(data.installmentProgress.nextDueDate).toLocaleDateString("en-GB") : "—" })
                ] })
              ] })
            ] }) : /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-ink", children: "No installment plan" }),
              /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[13px] font-semibold text-slate-500", children: [
                "This student is billed as a single amount due by",
                " ",
                student.deadline ? new Date(student.deadline).toLocaleDateString("en-GB") : "no deadline",
                "."
              ] }),
              /* @__PURE__ */ jsx(
                Link,
                {
                  to: `/dashboard/installment-plans?student=${encodeURIComponent(student.studentId)}`,
                  className: "mt-3 inline-block text-[13px] font-extrabold text-brand-700 hover:text-brand-800",
                  children: "Create a plan →"
                }
              )
            ] }) }),
            student && tab === "guardians" && /* @__PURE__ */ jsxs(Fragment, { children: [
              data.guardians?.length ? /* @__PURE__ */ jsx("ul", { className: "space-y-3", children: data.guardians.map((guardian) => /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("p", { className: "truncate text-[13px] font-extrabold text-ink", children: guardian.parentName }),
                  /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold capitalize text-slate-500", children: [
                    guardian.relationship,
                    guardian.phone ? ` · ${formatGhanaPhone(guardian.phone)}` : ""
                  ] }),
                  guardian.email && /* @__PURE__ */ jsx("p", { className: "truncate text-[12px] font-semibold text-slate-500", children: guardian.email })
                ] }),
                guardian.isPrimary ? /* @__PURE__ */ jsx(Badge, { tone: "green", icon: ShieldCheck, children: "Primary" }) : /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "Secondary" })
              ] }) }, guardian._id)) }) : /* @__PURE__ */ jsx(Card, { padding: "p-6", children: /* @__PURE__ */ jsx("p", { className: "text-center text-[13px] font-semibold text-slate-500", children: "No guardians recorded. At least one is required." }) }),
              data.emergencyContacts?.length > 0 && /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Emergency contacts" }),
                /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: data.emergencyContacts.map((contact, index) => /* @__PURE__ */ jsxs("li", { className: "text-[13px] font-semibold text-slate-600", children: [
                  contact.contactName,
                  " · ",
                  contact.relationship,
                  " ·",
                  " ",
                  formatGhanaPhone(contact.phone)
                ] }, index)) })
              ] })
            ] }),
            student && tab === "history" && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Class history" }),
                data.classHistory?.length ? /* @__PURE__ */ jsx("ol", { className: "space-y-2.5", children: data.classHistory.slice().reverse().map((entry, index) => /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3 text-[13px]", children: [
                  /* @__PURE__ */ jsx("span", { className: "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsxs("span", { children: [
                    /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-ink", children: [
                      entry.from,
                      " → ",
                      entry.to
                    ] }),
                    /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                      new Date(entry.date).toLocaleDateString("en-GB"),
                      entry.reason ? ` · ${entry.reason}` : ""
                    ] })
                  ] })
                ] }, index)) }) : /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-slate-400", children: "No class changes recorded." })
              ] }),
              /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
                /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Recent activity" }),
                data.auditTrail?.length ? /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: data.auditTrail.map((entry) => /* @__PURE__ */ jsxs("li", { className: "flex items-center justify-between gap-3 text-[12px]", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: entry.action }),
                  /* @__PURE__ */ jsx("span", { className: "shrink-0 text-slate-400", children: new Date(entry.createdAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  }) })
                ] }, entry._id)) }) : /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-slate-400", children: "No activity recorded yet." })
              ] })
            ] })
          ] })
        ]
      }
    )
  ] });
};
const Figure$1 = ({ label, value, tone = "text-ink" }) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-white p-4 shadow-soft", children: [
  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: label }),
  /* @__PURE__ */ jsx("p", { className: `mt-1 text-lg font-extrabold tabular-nums ${tone}`, children: value })
] });
const PhoneInput = ({ label, hint, error, value, onChange, className = "", ...props }) => {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused && value) onChange(normalise(value));
  }, [value, focused]);
  return /* @__PURE__ */ jsx(
    Field,
    {
      label,
      hint,
      error,
      className,
      type: "tel",
      inputMode: "tel",
      placeholder: "024 123 4567",
      maxLength: 14,
      value: value || "",
      onFocus: () => setFocused(true),
      onChange: (event) => onChange(normalise(event.target.value)),
      onBlur: () => {
        setFocused(false);
        onChange(normalise(value));
      },
      ...props
    }
  );
};
const normalise = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (digits.startsWith("233")) return `0${digits.slice(3)}`;
  return digits;
};
const isValidGhanaPhone = (raw) => GHANA_PHONE_REGEX.test(normalise(raw));
const asMultipart = (file, field = "file", extra = {}) => {
  const form = new FormData();
  form.append(field, file);
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== void 0 && value !== null) form.append(key, String(value));
  });
  return form;
};
const uploadStudentPhoto = async (file, studentId) => {
  try {
    const { data } = await api.post(
      "/upload/student-photo",
      asMultipart(file, "file", { studentId }),
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 6e4 }
    );
    return data?.data?.url || data?.url || null;
  } catch (error) {
    throw toApiError(error, "The photo could not be uploaded.");
  }
};
const PHOTO_CHANGED_EVENT = "sukuupay:student-photo-changed";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;
const MIN_DIMENSION = 200;
const ACCEPT = ALLOWED_TYPES.join(",");
const validatePhotoFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use a JPG, PNG or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return `That image is ${(file.size / (1024 * 1024)).toFixed(1)}MB. The limit is 2MB.`;
  }
  return null;
};
const readDimensions = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    resolve(null);
  };
  image.src = url;
});
const StudentPhotoField = ({ student, pendingFile, onPendingFile, onError }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const isEdit = Boolean(student?._id || student?.id);
  const savedImage = student?.studentImage || null;
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return void 0;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);
  const fail2 = (text) => {
    setMessage(text);
    onError?.(text);
  };
  const pick = async (file) => {
    setMessage(null);
    if (!file) return;
    const basic = validatePhotoFile(file);
    if (basic) {
      fail2(basic);
      return;
    }
    const size = await readDimensions(file);
    if (!size) {
      fail2("That file could not be read as an image.");
      return;
    }
    if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
      fail2(
        `That image is ${size.width}×${size.height}px. It must be at least ${MIN_DIMENSION}×${MIN_DIMENSION}px so it still prints clearly on a card.`
      );
      return;
    }
    if (!isEdit) {
      onPendingFile(file);
      setMessage(null);
      return;
    }
    setBusy(true);
    try {
      await uploadStudentPhoto(file, student._id || student.id);
      setMessage(null);
      onError?.(null);
      window.dispatchEvent(new CustomEvent(PHOTO_CHANGED_EVENT));
    } catch (err) {
      fail2(err.message || "The photo could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setMessage(null);
    if (!isEdit) {
      onPendingFile(null);
      return;
    }
    setBusy(true);
    try {
      await updateStudent(student._id || student.id, { studentImage: null });
      window.dispatchEvent(new CustomEvent(PHOTO_CHANGED_EVENT));
    } catch (err) {
      fail2(err.message || "The photo could not be removed.");
    } finally {
      setBusy(false);
    }
  };
  const shown = previewUrl || savedImage;
  return /* @__PURE__ */ jsxs("fieldset", { className: "rounded-xl border border-slate-200 p-4", children: [
    /* @__PURE__ */ jsx("legend", { className: "px-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Profile photo" }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative shrink-0", children: [
        shown ? /* @__PURE__ */ jsx("span", { className: "block h-20 w-20 overflow-hidden rounded-xl ring-1 ring-slate-200", children: /* @__PURE__ */ jsx(
          "img",
          {
            src: shown,
            alt: "",
            className: "h-full w-full object-cover"
          }
        ) }) : /* @__PURE__ */ jsx("span", { className: "block h-20 w-20 rounded-xl bg-slate-50 ring-1 ring-slate-200", children: /* @__PURE__ */ jsx(StudentAvatar, { student, size: "xl", className: "!h-20 !w-20 !rounded-xl !text-xl" }) }),
        busy && /* @__PURE__ */ jsx("span", { className: "absolute inset-0 flex items-center justify-center rounded-xl bg-white/70", children: /* @__PURE__ */ jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: "Used on ID cards, printed rosters and fee reminders. A square, front-facing photo with a clear background works best." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2.5 flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: inputRef,
              type: "file",
              accept: ACCEPT,
              className: "sr-only",
              onChange: (event) => {
                pick(event.target.files?.[0]);
                event.target.value = "";
              }
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => inputRef.current?.click(),
              disabled: busy,
              className: "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50",
              children: [
                shown ? /* @__PURE__ */ jsx(Camera, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(UploadCloud, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                shown ? "Replace photo" : "Upload photo"
              ]
            }
          ),
          (shown || pendingFile) && /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: remove,
              disabled: busy,
              className: "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                "Remove"
              ]
            }
          ),
          !shown && !busy && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400", children: [
            /* @__PURE__ */ jsx(ImageOff, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "Optional"
          ] })
        ] }),
        message && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[12px] font-semibold text-red-700", children: message }),
        pendingFile && !message && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[12px] font-semibold text-slate-500", children: "Uploads once the student is saved." })
      ] })
    ] })
  ] });
};
const emptyDraft = (classes) => ({
  studentName: "",
  studentClass: classes[0] || "",
  gender: "",
  dateOfBirth: "",
  totalOwed: null,
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10),
  academicYear: "",
  guardians: [{ parentName: "", relationship: "guardian", phone: "", email: "", isPrimary: true }]
});
const StudentForm = ({ open, onClose, onSaved, classes = [], student = null }) => {
  const isEdit = Boolean(student);
  const [draft, setDraft] = useState(() => emptyDraft(classes));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { warning } = useToast();
  const [pendingPhoto, setPendingPhoto] = useState(null);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setPendingPhoto(null);
    if (student) {
      setDraft({
        studentName: student.studentName || "",
        studentClass: student.studentClass || "",
        gender: student.gender || "",
        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : "",
        totalOwed: student.totalOwed ?? null,
        deadline: student.deadline ? new Date(student.deadline).toISOString().slice(0, 10) : "",
        academicYear: student.academicYear || "",
        guardians: (student.parents || []).map((guardian) => ({ ...guardian }))
      });
    } else {
      setDraft(emptyDraft(classes));
    }
  }, [open, student, classes]);
  const setField = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const setGuardian = (index, patch) => setDraft((current) => {
    const guardians = current.guardians.map(
      (guardian, i) => i === index ? { ...guardian, ...patch } : guardian
    );
    if (patch.isPrimary) {
      guardians.forEach((guardian, i) => {
        guardian.isPrimary = i === index;
      });
    }
    return { ...current, guardians };
  });
  const validate = () => {
    const next = {};
    if (!draft.studentName || draft.studentName.trim().length < 2) {
      next.studentName = "Enter the student’s full name";
    }
    if (!draft.studentClass) next.studentClass = "Choose a class";
    if (!draft.gender) next.gender = "Choose a gender";
    if (isEdit) {
      if (draft.totalOwed !== null && draft.totalOwed < 0) {
        next.totalOwed = "Cannot be negative";
      }
    } else if (draft.totalOwed === null) {
      next.totalOwed = "Enter the fee for this term";
    }
    if (!draft.deadline) next.deadline = "Choose a payment deadline";
    const primary = draft.guardians.find((g) => g.isPrimary) || draft.guardians[0];
    if (!primary?.parentName) next.guardianName = "A guardian name is required";
    if (!primary?.phone) next.guardianPhone = "A guardian phone is required";
    else if (!isValidGhanaPhone(primary.phone)) {
      next.guardianPhone = "That is not a valid Ghana number";
    }
    draft.guardians.forEach((guardian, index) => {
      if (guardian.phone && !isValidGhanaPhone(guardian.phone)) {
        next[`guardian${index}Phone`] = "That is not a valid Ghana number";
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    draft.guardians.find((g) => g.isPrimary) || draft.guardians[0];
    const payload = {
      studentName: draft.studentName.trim(),
      studentClass: draft.studentClass,
      gender: draft.gender,
      deadline: draft.deadline,
      parents: draft.guardians.filter((guardian) => guardian.parentName && guardian.phone).map((guardian) => ({
        // The `_id` has to survive the round trip: the guardian endpoints
        // address a parent by its sub-document id.
        ...guardian._id ? { _id: guardian._id } : {},
        parentName: guardian.parentName.trim(),
        relationship: guardian.relationship,
        phone: guardian.phone,
        email: guardian.email || void 0,
        isPrimary: Boolean(guardian.isPrimary),
        isAlive: guardian.isAlive !== false
      }))
    };
    if (draft.dateOfBirth) payload.dateOfBirth = draft.dateOfBirth;
    if (draft.academicYear) payload.academicYear = draft.academicYear;
    if (draft.totalOwed !== null) payload.totalOwed = draft.totalOwed;
    if (isEdit && !payload.parents.length) {
      setFormError("A student must keep at least one guardian.");
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit ? await updateStudent(student._id || student.id, payload) : await createStudent(payload);
      let photoError = null;
      if (pendingPhoto && saved?._id) {
        try {
          await uploadStudentPhoto(pendingPhoto, saved._id);
        } catch (uploadErr) {
          photoError = uploadErr.message || "the photo could not be uploaded";
        }
      }
      onSaved(saved, isEdit);
      onClose();
      if (photoError) {
        warning(
          `${saved.studentName || "The student"} was saved, but ${photoError}. Open the student to retry the photo.`
        );
      }
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };
  if (!open) return null;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]", children: /* @__PURE__ */ jsxs(
    "form",
    {
      onSubmit: submit,
      className: "my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl",
      "aria-label": isEdit ? "Edit student" : "Add a student",
      children: [
        /* @__PURE__ */ jsxs("header", { className: "border-b border-slate-100 px-6 py-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-extrabold tracking-tight text-ink", children: isEdit ? `Edit ${student.studentName}` : "Add a new student" }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: isEdit ? "Fees are in cedis. The student number cannot be changed." : "Fees are in cedis. A guardian is required — reminders go to them." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-5 px-6 py-5", children: [
          formError && /* @__PURE__ */ jsx(FormAlert, { children: formError }),
          /* @__PURE__ */ jsx(
            StudentPhotoField,
            {
              student,
              pendingFile: pendingPhoto,
              onPendingFile: setPendingPhoto
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Full name",
                required: true,
                value: draft.studentName,
                error: errors.studentName,
                onChange: (event) => setField({ studentName: event.target.value }),
                placeholder: "e.g. Kwame Mensah"
              }
            ),
            /* @__PURE__ */ jsx(
              SelectField,
              {
                label: "Class",
                required: true,
                value: draft.studentClass,
                error: errors.studentClass,
                onChange: (event) => setField({ studentClass: event.target.value }),
                children: classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
              }
            ),
            /* @__PURE__ */ jsxs(
              SelectField,
              {
                label: "Gender",
                required: true,
                value: draft.gender,
                error: errors.gender,
                onChange: (event) => setField({ gender: event.target.value }),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Choose…" }),
                  /* @__PURE__ */ jsx("option", { value: "male", children: "Male" }),
                  /* @__PURE__ */ jsx("option", { value: "female", children: "Female" })
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Date of birth",
                type: "date",
                max: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
                value: draft.dateOfBirth,
                onChange: (event) => setField({ dateOfBirth: event.target.value })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsx(
              MoneyInput,
              {
                label: "Total owed this term",
                hint: "cedis",
                required: !isEdit,
                value: draft.totalOwed,
                error: errors.totalOwed,
                onChange: (value) => setField({ totalOwed: value })
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Payment deadline",
                type: "date",
                required: true,
                min: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
                value: draft.deadline,
                error: errors.deadline,
                onChange: (event) => setField({ deadline: event.target.value })
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Academic year",
                hint: "optional",
                placeholder: "2025/2026",
                value: draft.academicYear,
                onChange: (event) => setField({ academicYear: event.target.value })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("fieldset", { className: "rounded-xl border border-slate-200 p-4", children: [
            /* @__PURE__ */ jsx("legend", { className: "px-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Guardians" }),
            /* @__PURE__ */ jsx("div", { className: "space-y-4", children: draft.guardians.map((guardian, index) => /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
              index > 0 && /* @__PURE__ */ jsx("div", { className: "border-t border-slate-100" }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [
                /* @__PURE__ */ jsx(
                  Field,
                  {
                    label: index === 0 ? "Name" : `Guardian ${index + 1} name`,
                    required: index === 0,
                    value: guardian.parentName,
                    error: index === 0 ? errors.guardianName : void 0,
                    onChange: (event) => setGuardian(index, { parentName: event.target.value })
                  }
                ),
                /* @__PURE__ */ jsxs(
                  SelectField,
                  {
                    label: "Relationship",
                    value: guardian.relationship,
                    onChange: (event) => setGuardian(index, { relationship: event.target.value }),
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "father", children: "Father" }),
                      /* @__PURE__ */ jsx("option", { value: "mother", children: "Mother" }),
                      /* @__PURE__ */ jsx("option", { value: "guardian", children: "Guardian" }),
                      /* @__PURE__ */ jsx("option", { value: "other", children: "Other" })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  PhoneInput,
                  {
                    label: "Phone",
                    required: index === 0,
                    value: guardian.phone,
                    error: errors[`guardian${index}Phone`] || (index === 0 ? errors.guardianPhone : void 0),
                    onChange: (value) => setGuardian(index, { phone: value })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
                /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-[12px] font-bold text-slate-600", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "radio",
                      name: "primary-guardian",
                      checked: Boolean(guardian.isPrimary),
                      onChange: () => setGuardian(index, { isPrimary: true }),
                      className: "h-3.5 w-3.5"
                    }
                  ),
                  "Primary contact for reminders"
                ] }),
                draft.guardians.length > 1 && /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setDraft((current) => ({
                      ...current,
                      guardians: current.guardians.filter((_, i) => i !== index)
                    })),
                    className: "text-[12px] font-bold text-red-600 hover:underline",
                    children: "Remove"
                  }
                )
              ] })
            ] }, guardian._id || index)) }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => setDraft((current) => ({
                  ...current,
                  guardians: [
                    ...current.guardians,
                    { parentName: "", relationship: "guardian", phone: "", email: "" }
                  ]
                })),
                className: "mt-3 text-[12px] font-extrabold text-brand-700 hover:text-brand-800",
                children: "+ Add another guardian"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("footer", { className: "flex justify-end gap-2 border-t border-slate-100 px-6 py-4", children: [
          /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", onClick: onClose, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "submit", variant: "primary", disabled: saving, children: saving ? "Saving…" : isEdit ? "Save changes" : "Add student" })
        ] })
      ]
    }
  ) });
};
const PRESETS = {
  "Basic + JHS": ["Nursery 1", "Nursery 2", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "JHS 1", "JHS 2", "JHS 3"],
  "Basic only": ["Nursery 1", "Nursery 2", "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  "JHS only": ["JHS 1", "JHS 2", "JHS 3"],
  "Primary only": ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  "SHS only": ["Year 1", "Year 2", "Year 3"]
};
const ClassListEditor = ({ open, onClose, onSaved, schoolId, classes: initial = [] }) => {
  const [draft, setDraft] = useState(initial);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setName("");
    setError(null);
    setRemoving(null);
  }, [open, initial]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  if (!open) return null;
  const addClass = (value) => {
    const label = String(name).trim();
    if (!label) return;
    if (draft.some((c) => c.toLowerCase() === label.toLowerCase())) {
      setError(`"${label}" is already on the list.`);
      return;
    }
    setDraft((current) => [...current, label]);
    setName("");
    setError(null);
    inputRef.current?.focus();
  };
  const save = async () => {
    if (!draft.length) {
      setError("Add at least one class — students are placed in a class.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateSchoolClasses(schoolId, draft);
      onSaved(saved?.academic?.classes || draft);
      onClose();
    } catch (err) {
      setError(err.message || "Your class list could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]", children: /* @__PURE__ */ jsxs(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Manage your classes",
      className: "my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl",
      children: [
        /* @__PURE__ */ jsxs("header", { className: "border-b border-slate-100 px-6 py-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-extrabold tracking-tight text-ink", children: "Your classes" }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: "Every student sits in one of these, and the roster filters by them." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-5 px-6 py-5", children: [
          error && /* @__PURE__ */ jsx(FormAlert, { children: error }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Start from a template" }),
            /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: Object.entries(PRESETS).map(([label, list]) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  setDraft(list);
                  setError(null);
                },
                className: "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors hover:border-brand-700 hover:text-brand-700",
                children: label
              },
              label
            )) }),
            /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] font-medium text-slate-500", children: "Replaces the list below. Edit it before saving." })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: [
              "Classes (",
              draft.length,
              ")"
            ] }),
            draft.length ? /* @__PURE__ */ jsx("ul", { className: "space-y-1.5", children: draft.map((c, index) => /* @__PURE__ */ jsxs(
              "li",
              {
                className: "flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2",
                children: [
                  /* @__PURE__ */ jsx(GraduationCap, { className: "h-4 w-4 shrink-0 text-slate-400", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsx("span", { className: "flex-1 text-[13px] font-bold text-ink", children: c }),
                  removing === index ? /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-500", children: "Students here will leave the class filter. Remove?" }),
                    /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => {
                      setDraft((current) => current.filter((_, i) => i !== index));
                      setRemoving(null);
                    }, children: "Yes" }),
                    /* @__PURE__ */ jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => setRemoving(null), children: "No" })
                  ] }) : /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      "aria-label": `Remove ${c}`,
                      onClick: () => setRemoving(index),
                      className: "rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600",
                      children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4", "aria-hidden": "true" })
                    }
                  )
                ]
              },
              `${c}-${index}`
            )) }) : /* @__PURE__ */ jsx("p", { className: "rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[12px] font-semibold text-slate-500", children: "No classes yet. Pick a template or add one below." })
          ] }),
          /* @__PURE__ */ jsxs(
            "form",
            {
              onSubmit: (event) => {
                event.preventDefault();
                addClass();
              },
              children: [
                /* @__PURE__ */ jsxs(
                  "label",
                  {
                    htmlFor: "class-list-new-class",
                    className: "mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700",
                    children: [
                      "Add a class",
                      /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-[10px]/[14px] font-medium text-slate-500", children: "e.g. JHS 1" })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      id: "class-list-new-class",
                      ref: inputRef,
                      value: name,
                      onChange: (event) => setName(event.target.value),
                      placeholder: "Class name",
                      maxLength: 50,
                      className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 transition-all focus:border-brand-700 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
                    }
                  ),
                  /* @__PURE__ */ jsxs(Button, { type: "submit", variant: "secondary", disabled: !name.trim(), children: [
                    /* @__PURE__ */ jsx(Plus, { className: "mr-1 inline h-4 w-4", "aria-hidden": "true" }),
                    "Add class"
                  ] })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("footer", { className: "flex justify-end gap-2 border-t border-slate-100 px-6 py-4", children: [
          /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", onClick: onClose, children: "Cancel" }),
          /* @__PURE__ */ jsx(Button, { type: "button", variant: "primary", onClick: save, disabled: saving, children: saving ? "Saving…" : "Save classes" })
        ] })
      ]
    }
  ) });
};
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ImportTab = ({ school, onImported }) => {
  const { success, error: errorToast, warning } = useToast();
  const [file, setFile] = useState(null);
  const [academicYear, setAcademicYear] = useState("");
  const [defaultDeadline, setDefaultDeadline] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10)
  );
  const [defaultOwed, setDefaultOwed] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const onFile = (chosen) => {
    setResult(null);
    setPreview(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (chosen.size > MAX_FILE_BYTES) {
      errorToast(`That file is ${(chosen.size / 1024 / 1024).toFixed(1)}MB. The limit is 10MB.`);
      return;
    }
    setFile(chosen);
  };
  const meta = () => ({
    schoolId: school?.schoolId || school?._id,
    academicYear: academicYear || void 0,
    defaultDeadline: defaultDeadline || void 0,
    // Cedis. The importer multiplies by 100.
    defaultOwed: defaultOwed === "" ? void 0 : Number(defaultOwed)
  });
  const runValidation = async () => {
    if (!file) {
      errorToast("Choose a file first.");
      return;
    }
    setBusy(true);
    try {
      const data = await validateImport(file, meta());
      setPreview(data);
      if (data.failed) {
        warning(`${formatCount(data.failed)} of ${formatCount(data.total)} rows need attention before this can be imported.`);
      }
    } catch (err) {
      errorToast(err.message);
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    setBusy(true);
    try {
      const data = await bulkImport(file, meta());
      setResult(data);
      setPreview(null);
      if (data.created > 0) {
        success(`${formatCount(data.created)} students imported.`);
        if (data.failed === 0) onImported?.();
      } else {
        warning("Nothing was imported. Check the failures below.");
      }
    } catch (err) {
      const details = err?.details;
      if (details?.errors?.length) {
        setResult(details);
        errorToast(err.message);
      } else {
        errorToast(err.message);
      }
    } finally {
      setBusy(false);
    }
  };
  const downloadTemplate = () => {
    const sample = [
      "Kwame Mensah",
      school?.academic?.classes?.[0] || "JHS 1",
      "male",
      "Ama Mensah",
      "0241234567",
      "850",
      defaultDeadline || "2026-03-31",
      "2014-06-02",
      "mother",
      "ama@example.com"
    ];
    const csv = `Student Name,Class,Gender,Parent Name,Parent Phone,Total Owed (CEDIS),Deadline,Date of Birth,Parent Relationship,Parent Email
${sample.join(
      ","
    )}
`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const report = preview || result;
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-3", children: [
    /* @__PURE__ */ jsx("div", { className: "lg:col-span-2", children: /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: "Upload a roster" }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-[13px] font-medium text-slate-500", children: "CSV or Excel, up to 5,000 students per file. Columns are matched loosely, so “Student Name”, “student name” and “studentname” all work." }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Academic year",
            hint: "optional",
            placeholder: "2025/2026",
            value: academicYear,
            onChange: (event) => setAcademicYear(event.target.value)
          }
        ),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Default deadline",
            type: "date",
            hint: "used when a row has none",
            min: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
            value: defaultDeadline,
            onChange: (event) => setDefaultDeadline(event.target.value)
          }
        ),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Default fee",
            hint: "in cedis, not pesewas",
            inputMode: "decimal",
            placeholder: "850.00",
            value: defaultOwed,
            onChange: (event) => setDefaultOwed(event.target.value),
            className: "sm:col-span-2"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        "label",
        {
          htmlFor: "roster-file",
          className: "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40",
          children: [
            /* @__PURE__ */ jsx(UploadCloud, { className: "h-8 w-8 text-slate-400", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { className: "mt-2 text-sm font-extrabold text-ink", children: file ? file.name : "Choose a file" }),
            /* @__PURE__ */ jsx("span", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: file ? `${(file.size / 1024).toFixed(0)}KB` : "or drop one here" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: "roster-file",
                type: "file",
                accept: ".csv,.xlsx,.xls",
                onChange: (event) => onFile(event.target.files?.[0]),
                className: "sr-only"
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: runValidation, disabled: !file || busy, children: busy ? "Checking…" : "Check the file" }),
        /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "secondary",
            onClick: commit,
            disabled: !file || busy || preview && preview.valid === 0,
            children: [
              "Import ",
              preview ? `${formatCount(preview.valid)} students` : "anyway"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(Button, { variant: "ghost", onClick: downloadTemplate, children: [
          /* @__PURE__ */ jsx(Download, { className: "mr-1.5 h-4 w-4", "aria-hidden": "true" }),
          "Download template"
        ] })
      ] }),
      /* @__PURE__ */ jsxs(FormAlert, { tone: "warning", children: [
        /* @__PURE__ */ jsx(TriangleAlert, { className: "mr-1.5 inline h-3.5 w-3.5", "aria-hidden": "true" }),
        "The ",
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "Total Owed" }),
        " column is in",
        " ",
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "cedis" }),
        " — 850 means GH₵ 850.00. The API itself uses pesewas everywhere else, so this column is the one place the two differ, and it is converted when the file is read."
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "lg:col-span-1", children: report ? /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: result ? "Import result" : "Validation report" }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 space-y-2", children: [
        result && /* @__PURE__ */ jsx(
          Stat,
          {
            tone: result.created > 0 ? "green" : "slate",
            label: "Imported",
            value: formatCount(result.created || 0),
            icon: CircleCheck
          }
        ),
        preview && !result && /* @__PURE__ */ jsx(
          Stat,
          {
            tone: "green",
            label: "Ready to import",
            value: formatCount(preview.valid || 0),
            icon: CircleCheck
          }
        ),
        /* @__PURE__ */ jsx(
          Stat,
          {
            tone: report.failed > 0 ? "red" : "slate",
            label: report.failed > 0 ? "Need attention" : "No failures",
            value: formatCount(report.failed || 0),
            icon: report.failed > 0 ? TriangleAlert : CircleCheck
          }
        )
      ] }),
      report.errors?.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-4 max-h-72 space-y-2 overflow-y-auto", children: report.errors.slice(0, 100).map((rowError, index) => /* @__PURE__ */ jsxs(
        "li",
        {
          className: "rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700",
          children: [
            rowError.row ? /* @__PURE__ */ jsxs("span", { className: "font-extrabold", children: [
              "Row ",
              rowError.row,
              ": "
            ] }) : null,
            rowError.reason
          ]
        },
        `${rowError.row}-${index}`
      )) }),
      report.errors?.length > 100 && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-semibold text-slate-500", children: [
        "Showing the first 100 of ",
        formatCount(report.errors.length),
        " failures."
      ] })
    ] }) : /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
      /* @__PURE__ */ jsxs("h3", { className: "flex items-center gap-2 text-base font-extrabold text-ink", children: [
        /* @__PURE__ */ jsx(FileSpreadsheet, { className: "h-4 w-4 text-slate-400", "aria-hidden": "true" }),
        "Columns"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px] font-semibold text-slate-500", children: "Only the first five are required. The rest are optional." }),
      /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-1.5", children: STUDENT_IMPORT_COLUMNS.map((column) => /* @__PURE__ */ jsxs("li", { className: "flex items-baseline justify-between gap-2 text-[12px]", children: [
        /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: column.label }),
        /* @__PURE__ */ jsx("span", { className: "text-right font-semibold text-slate-500", children: column.required ? "required" : "optional" })
      ] }, column.key)) })
    ] }) })
  ] });
};
const Stat = ({ label, value, tone, icon: Icon }) => /* @__PURE__ */ jsxs(
  "div",
  {
    className: `flex items-center justify-between rounded-xl px-3 py-2.5 ${tone === "green" ? "bg-emerald-50" : tone === "red" ? "bg-red-50" : "bg-slate-50"}`,
    children: [
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 text-[13px] font-bold text-slate-600", children: [
        /* @__PURE__ */ jsx(
          Icon,
          {
            className: `h-4 w-4 ${tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-slate-400"}`,
            "aria-hidden": "true"
          }
        ),
        label
      ] }),
      /* @__PURE__ */ jsx("span", { className: "text-[15px] font-extrabold tabular-nums text-ink", children: value })
    ]
  }
);
const HONORS = [
  ["", "All honors"],
  ["NONE", "No honors"],
  ["HONORS", "Honors"],
  ["HIGH_HONORS", "High Honors"],
  ["HIGHEST_HONORS", "Highest Honors"]
];
const AlumniTab = ({ schoolId }) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [search, setSearch] = useState("");
  const [honors, setHonors] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!schoolId) return void 0;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAlumni({ schoolId, page, limit: 20, search: search || void 0, honors: honors || void 0, graduationYear: graduationYear || void 0 }).then((result) => {
      if (active) setState({ ...result, loading: false, error: null });
    }).catch((error) => {
      if (active) setState({ rows: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [schoolId, page, search, honors, graduationYear]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Card, { padding: "p-4", className: "mb-4", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx("label", { htmlFor: "alumni-search", className: "mb-0.5 block text-[11px] font-semibold text-slate-700", children: "Search" }),
        /* @__PURE__ */ jsx(
          Search,
          {
            className: "pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400",
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            id: "alumni-search",
            type: "search",
            value: search,
            onChange: (event) => {
              setSearch(event.target.value);
              setPage(1);
            },
            placeholder: "Name, student number or certificate…",
            className: "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Graduation year",
          value: graduationYear,
          onChange: (event) => {
            setGraduationYear(event.target.value);
            setPage(1);
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All years" }),
            [2026, 2025, 2024, 2023, 2022].map((year) => /* @__PURE__ */ jsx("option", { value: year, children: year }, year))
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        SelectField,
        {
          label: "Honors",
          value: honors,
          onChange: (event) => {
            setHonors(event.target.value);
            setPage(1);
          },
          children: HONORS.map(([value, label]) => /* @__PURE__ */ jsx("option", { value, children: label }, value))
        }
      )
    ] }) }),
    state.error && /* @__PURE__ */ jsx(Card, { padding: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: state.error.message }) }),
    !state.error && !state.loading && !state.rows.length ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: GraduationCap,
        title: "No graduates recorded yet",
        description: "Students appear here once they have been graduated from this module, with their certificate number and honors."
      }
    ) : /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[42rem] border-collapse text-left", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "bg-slate-50", children: ["Student", "Graduated", "Certificate", "Honors", "Outstanding at exit"].map(
          (heading) => /* @__PURE__ */ jsx(
            "th",
            {
              scope: "col",
              className: "whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
              children: heading
            },
            heading
          )
        ) }) }),
        /* @__PURE__ */ jsx("tbody", { children: state.loading ? Array.from({ length: 4 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: 5, className: "px-5 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, index)) : state.rows.map((alumnus) => {
          const guardian = (alumnus.parents || []).find((p) => p.isPrimary);
          return /* @__PURE__ */ jsxs("tr", { className: "border-t border-slate-100", children: [
            /* @__PURE__ */ jsxs("th", { scope: "row", className: "flex items-center gap-3 px-5 py-3 font-normal", children: [
              /* @__PURE__ */ jsx(StudentAvatar, { student: alumnus, size: "sm" }),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: alumnus.studentName }),
                /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                  alumnus.studentId,
                  guardian?.phone ? ` · ${formatGhanaPhone(guardian.phone)}` : ""
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600", children: alumnus.graduationDate ? new Date(alumnus.graduationDate).toLocaleDateString("en-GB") : "—" }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 font-mono text-[12px] font-bold text-slate-600", children: alumnus.certificateNumber || "—" }),
            /* @__PURE__ */ jsx("td", { className: "px-5 py-3", children: alumnus.honors && alumniIsHonoured(alumnus.honors) ? /* @__PURE__ */ jsx(Badge, { tone: "brand", children: alumnus.honors.replace(/_/g, " ") }) : /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-400", children: "—" }) }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-right text-[13px] font-extrabold tabular-nums", children: alumnus.balance > 0 ? /* @__PURE__ */ jsx("span", { className: "text-red-600", children: formatCedi(alumnus.balance) }) : /* @__PURE__ */ jsx("span", { className: "text-emerald-600", children: formatCedi(0) }) })
          ] }, alumnus._id);
        }) })
      ] }) }),
      state.meta?.totalItems > 0 && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          formatCount(state.meta.totalItems),
          " graduate",
          state.meta.totalItems === 1 ? "" : "s"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setPage((p) => Math.max(1, p - 1)),
              disabled: page <= 1,
              className: "rounded-lg border border-slate-200 px-2.5 py-1 font-extrabold disabled:opacity-40",
              children: "Previous"
            }
          ),
          /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-ink", children: [
            page,
            " / ",
            state.meta.totalPages || 1
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setPage((p) => p + 1),
              disabled: !state.meta.hasNext,
              className: "rounded-lg border border-slate-200 px-2.5 py-1 font-extrabold disabled:opacity-40",
              children: "Next"
            }
          )
        ] })
      ] })
    ] })
  ] });
};
const alumniIsHonoured = (honors) => honors && honors !== "NONE";
const CohortsTab = ({ schoolId }) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [openCohort, setOpenCohort] = useState(null);
  const [detail, setDetail] = useState({ data: null, loading: false, error: null });
  useEffect(() => {
    if (!schoolId) return void 0;
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    listCohorts({ schoolId, page: 1, limit: 20 }).then((result) => {
      if (active) setState({ ...result, loading: false, error: null });
    }).catch((error) => {
      if (active) setState({ rows: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [schoolId]);
  const open = (cohort) => {
    setOpenCohort(cohort);
    setDetail({ data: null, loading: true, error: null });
    getCohort(cohort.id, { schoolId, page: 1, limit: 50 }).then((data) => setDetail({ data, loading: false, error: null })).catch((error) => setDetail({ data: null, loading: false, error }));
  };
  if (state.error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: state.error.message }) });
  }
  if (!state.loading && !state.rows.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: GraduationCap,
        title: "No cohorts yet",
        description: "A cohort appears here once its students have graduated. Graduate a class from this module to create the first one."
      }
    );
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", children: state.loading ? Array.from({ length: 3 }).map((_, index) => /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-2xl bg-slate-200/60" }, index)) : state.rows.map((cohort) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => open(cohort),
        className: "rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-soft transition-colors hover:border-brand-200",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: cohort.name }),
            /* @__PURE__ */ jsx(Badge, { tone: "slate", children: cohort._id || cohort.id })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: cohort.academicYear }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-2xl font-extrabold text-ink", children: formatCount(cohort.studentCount) }),
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "students in the cohort" }),
          /* @__PURE__ */ jsxs("dl", { className: "mt-3 grid grid-cols-2 gap-2 text-[11px]", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-400", children: "Graduated" }),
              /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCount(cohort.graduatedCount || 0) })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-400", children: "Transferred" }),
              /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCount(cohort.transferredCount || 0) })
            ] })
          ] })
        ]
      },
      cohort._id || cohort.id
    )) }),
    openCohort && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px]", children: /* @__PURE__ */ jsxs("div", { className: "my-8 w-full max-w-3xl rounded-2xl bg-slate-50 shadow-2xl", children: [
      /* @__PURE__ */ jsxs("header", { className: "flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-extrabold tracking-tight text-ink", children: openCohort.name }),
          /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
            openCohort.academicYear,
            " · ",
            formatCount(openCohort.studentCount),
            " students"
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setOpenCohort(null),
            className: "rounded-lg px-3 py-1.5 text-[13px] font-extrabold text-slate-600 hover:bg-slate-100",
            children: "Close"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4 p-5", children: [
        detail.loading && /* @__PURE__ */ jsx("div", { className: "h-32 animate-pulse rounded-2xl bg-slate-200/60" }),
        detail.error && /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: detail.error.message }),
        detail.data && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
            { label: "Total", value: detail.data.cohort.statistics.totalStudents },
            { label: "Graduated", value: detail.data.cohort.statistics.graduated },
            { label: "Transferred", value: detail.data.cohort.statistics.transferred },
            { label: "Repeating", value: detail.data.cohort.statistics.repeating }
          ].map((stat) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-white p-4 shadow-soft", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase text-slate-400", children: stat.label }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xl font-extrabold tabular-nums text-ink", children: formatCount(stat.value || 0) })
          ] }, stat.label)) }),
          detail.data.cohort.classes?.length > 0 && /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
            /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Final-year classes" }),
            /* @__PURE__ */ jsx("ul", { className: "space-y-2", children: detail.data.cohort.classes.map((cls) => /* @__PURE__ */ jsxs(
              "li",
              {
                className: "flex items-center justify-between gap-3 text-[13px]",
                children: [
                  /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: cls.name }),
                  /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3 text-slate-500", children: [
                    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 font-semibold", children: [
                      /* @__PURE__ */ jsx(Users, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                      formatCount(cls.studentCount)
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: "text-[11px]", children: cls.teacher || "no teacher recorded" })
                  ] })
                ]
              },
              cls.id
            )) })
          ] }),
          /* @__PURE__ */ jsx(Card, { padding: "p-0", children: /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: detail.data.students.map((student) => /* @__PURE__ */ jsxs(
            "li",
            {
              className: "flex items-center justify-between gap-3 px-5 py-3",
              children: [
                /* @__PURE__ */ jsxs("span", { className: "flex min-w-0 items-center gap-3", children: [
                  /* @__PURE__ */ jsx(StudentAvatar, { student, size: "sm" }),
                  /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName }),
                    /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                      student.studentId,
                      " · ",
                      student.studentClass
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsx(Badge, { tone: "slate", children: student.status?.replace(/_/g, " ") })
              ]
            },
            student._id
          )) }) })
        ] })
      ] })
    ] }) })
  ] });
};
const ClassMappingStep = ({ matrix, classes, onTargetChange, onReset, hasOverrides, loading, error }) => {
  if (error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: error.message }) });
  }
  if (!loading && !matrix.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: GraduationCap,
        title: "No classes to promote",
        description: "This school has no classes configured, so there is nothing to promote. Add your class list to run an end-of-year rollover."
      }
    );
  }
  return /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold tracking-tight text-ink", children: "Class transition mapping" }),
        /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: "Review where every class moves to before anything is written." })
      ] }),
      hasOverrides && /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: onReset,
          className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
          children: [
            /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "Reset to school defaults"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[48rem] border-collapse text-left", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "bg-slate-50", children: ["Current class", "Enrolled", "Promote to", "Outcome"].map((heading) => /* @__PURE__ */ jsx(
        "th",
        {
          scope: "col",
          className: "whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
          children: heading
        },
        heading
      )) }) }),
      /* @__PURE__ */ jsx("tbody", { children: loading ? Array.from({ length: 4 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: 4, className: "px-5 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, index)) : matrix.map((row) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: row.isFinalYear ? "border-t border-amber-100 bg-amber-50/40" : "border-t border-slate-100",
          children: [
            /* @__PURE__ */ jsxs("th", { scope: "row", className: "px-5 py-3.5 font-normal", children: [
              /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: row.className }),
              row.outstanding.length > 0 && /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-amber-700", children: [
                formatCount(row.outstanding.length),
                " with an outstanding balance"
              ] })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3.5 text-[13px] font-extrabold tabular-nums text-slate-700", children: formatCount(row.enrolled) }),
            /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: row.isFinalYear ? /* @__PURE__ */ jsx("span", { className: "text-[13px] font-extrabold text-amber-800", children: "Graduate — move to Alumni" }) : /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsx(
                  "select",
                  {
                    "aria-label": `Promote ${row.className} to`,
                    value: row.target || "",
                    onChange: (event) => onTargetChange(row.className, event.target.value),
                    className: `h-9 cursor-pointer appearance-none rounded-lg border bg-white py-1 pl-3 pr-8 text-[13px] font-extrabold focus:outline-none focus:ring-2 focus:ring-brand-700/20 ${row.overridden ? "border-amber-300 text-amber-900" : "border-slate-200 text-ink"}`,
                    children: classes.filter((name) => name !== row.className).map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 20 20", className: "h-4 w-4", "aria-hidden": "true", fill: "currentColor", children: /* @__PURE__ */ jsx(
                  "path",
                  {
                    fillRule: "evenodd",
                    d: "M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z",
                    clipRule: "evenodd"
                  }
                ) }) })
              ] }),
              row.overridden && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700", children: [
                /* @__PURE__ */ jsx(PencilLine, { className: "h-3 w-3", "aria-hidden": "true" }),
                "Overridden"
              ] })
            ] }) }),
            /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: row.isFinalYear ? /* @__PURE__ */ jsx(Badge, { tone: "amber", icon: GraduationCap, children: "Final year cohort" }) : row.repeating.length > 0 ? /* @__PURE__ */ jsxs(Badge, { tone: "amber", children: [
              formatCount(row.repeating.length),
              " repeating"
            ] }) : /* @__PURE__ */ jsx(Badge, { tone: "green", icon: Check, children: "Standard progression" }) })
          ]
        },
        row.className
      )) })
    ] }) }),
    matrix.some((row) => row.isFinalYear) && /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[12px] font-semibold text-slate-500", children: [
      /* @__PURE__ */ jsx(Sparkles, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600", "aria-hidden": "true" }),
      "Final-year classes are set by your school's class list. They are graduated, not promoted, and are handled in the last step of this wizard."
    ] })
  ] });
};
const PromotionSummary = ({ totals, balanceLabel = "outstanding" }) => {
  const tiles = [
    {
      label: "Promoting to next class",
      value: formatCount(totals.promoting),
      suffix: "students",
      foot: `${formatCount(totals.promotingClasses)} class${totals.promotingClasses === 1 ? "" : "es"}`
    },
    {
      label: "Graduating to Alumni",
      value: formatCount(totals.graduating),
      suffix: "students",
      foot: `${formatCount(totals.graduatingClasses)} final-year class${totals.graduatingClasses === 1 ? "" : "es"}`,
      tone: "text-amber-700"
    },
    {
      label: "Marked repeating",
      value: formatCount(totals.repeating),
      suffix: "students",
      foot: totals.repeating ? "Held back from promotion" : "None held back"
    },
    {
      label: `Total ${balanceLabel}`,
      value: formatCedi(totals.outstandingAmount),
      suffix: null,
      foot: `${formatCount(totals.outstanding)} ledger${totals.outstanding === 1 ? "" : "s"} unsettled`,
      tone: totals.outstandingAmount > 0 ? "text-amber-700" : "text-ink"
    }
  ];
  return /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", children: tiles.map((tile) => /* @__PURE__ */ jsxs(Card, { padding: "p-4", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: tile.label }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 flex items-baseline gap-1.5", children: [
      /* @__PURE__ */ jsx("span", { className: `text-[22px] font-extrabold leading-none tracking-tight ${tile.tone || "text-ink"}`, children: tile.value }),
      tile.suffix && /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-slate-500", children: tile.suffix })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] font-semibold text-slate-500", children: tile.foot })
  ] }, tile.label)) });
};
const PER_PAGE$1 = 20;
const FILTERS$1 = [
  { value: "all", label: "All" },
  { value: "promote", label: "Promoting" },
  { value: "repeat", label: "Repeating" }
];
const PromotionReviewStep = ({
  students,
  decisions,
  onDecide,
  onClearRepeat,
  classes,
  loading,
  error,
  busy
}) => {
  const [filter, setFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((student) => {
      if (classFilter && student.studentClass !== classFilter) return false;
      if (term && !String(student.studentName || "").toLowerCase().includes(term)) return false;
      const intent = decisions[String(student._id || student.id)];
      if (filter === "repeat") return intent === "repeat";
      if (filter === "promote") return intent !== "repeat";
      return true;
    });
  }, [students, decisions, filter, classFilter, search]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE$1));
  const safePage = Math.min(page, totalPages);
  const visible = rows.slice((safePage - 1) * PER_PAGE$1, safePage * PER_PAGE$1);
  const counts = useMemo(
    () => ({
      all: students.length,
      repeat: students.filter((s) => decisions[String(s._id || s.id)] === "repeat").length
    }),
    [students, decisions]
  );
  const setFilterAndReset = (next) => {
    setFilter(next);
    setPage(1);
  };
  if (error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: error.message }) });
  }
  if (!loading && !students.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: SlidersHorizontal,
        title: "No students to review",
        description: "There are no active students in the classes you mapped, so there is nothing to promote or review."
      }
    );
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Card, { padding: "p-4", className: "mb-4", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          role: "group",
          "aria-label": "Filter students by decision",
          className: "flex items-center gap-1.5",
          children: FILTERS$1.map((option) => {
            const count = option.value === "all" ? counts.all : counts[option.value];
            const active = filter === option.value;
            return /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setFilterAndReset(option.value),
                "aria-pressed": active,
                className: `rounded-xl px-3 py-1.5 text-[12px] font-extrabold transition-colors ${active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
                children: [
                  option.label,
                  /* @__PURE__ */ jsx("span", { className: active ? "ml-1.5 text-brand-100" : "ml-1.5 text-slate-400", children: formatCount(count) })
                ]
              },
              option.value
            );
          })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "relative min-w-[13rem] flex-1", children: [
        /* @__PURE__ */ jsx("label", { htmlFor: "promotion-search", className: "sr-only", children: "Search students" }),
        /* @__PURE__ */ jsx(
          Search,
          {
            className: "pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400",
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            id: "promotion-search",
            type: "search",
            value: search,
            onChange: (event) => {
              setSearch(event.target.value);
              setPage(1);
            },
            placeholder: "Search student name…",
            className: "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "w-full sm:w-48", children: /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Class",
          value: classFilter,
          onChange: (event) => {
            setClassFilter(event.target.value);
            setPage(1);
          },
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All classes" }),
            classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
          ]
        }
      ) })
    ] }) }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[52rem] border-collapse text-left", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "bg-slate-50", children: ["Student", "Current class", "Balance", "Decision"].map((heading) => /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            className: "whitespace-nowrap px-5 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
            children: heading
          },
          heading
        )) }) }),
        /* @__PURE__ */ jsx("tbody", { children: loading ? Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: 4, className: "px-5 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, index)) : visible.map((student) => {
          const id = String(student._id || student.id);
          const intent = decisions[id];
          const repeating = intent === "repeat";
          return /* @__PURE__ */ jsxs(
            "tr",
            {
              className: repeating ? "border-t border-amber-100 bg-amber-50/40" : "border-t border-slate-100",
              children: [
                /* @__PURE__ */ jsx("th", { scope: "row", className: "px-5 py-3 font-normal", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsx(StudentAvatar, { student, size: "md" }),
                  /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName }),
                    /* @__PURE__ */ jsx("span", { className: "block font-mono text-[11px] font-bold text-slate-500", children: student.studentId })
                  ] })
                ] }) }),
                /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-[13px] font-semibold text-slate-600", children: student.studentClass }),
                /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-5 py-3 text-[13px] font-extrabold tabular-nums", children: (student.balance || 0) > 0 ? /* @__PURE__ */ jsx("span", { className: "text-amber-700", children: formatCedi(student.balance) }) : /* @__PURE__ */ jsx("span", { className: "text-emerald-600", children: formatCedi(0) }) }),
                /* @__PURE__ */ jsx("td", { className: "px-5 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxs(
                    "div",
                    {
                      role: "group",
                      "aria-label": `Promotion decision for ${student.studentName}`,
                      className: "flex items-center gap-1",
                      children: [
                        /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => onDecide(id, "promote"),
                            disabled: busy,
                            "aria-pressed": !repeating,
                            className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors disabled:opacity-50 ${!repeating ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
                            children: [
                              /* @__PURE__ */ jsx(ArrowUpRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                              "Promote"
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxs(
                          "button",
                          {
                            type: "button",
                            onClick: () => {
                              if (student.isRepeating && !repeating) onClearRepeat(student);
                              else onDecide(id, "repeat");
                            },
                            disabled: busy,
                            "aria-pressed": repeating,
                            className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors disabled:opacity-50 ${repeating ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
                            children: [
                              /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                              "Repeat"
                            ]
                          }
                        )
                      ]
                    }
                  ),
                  repeating && !student.isRepeating && /* @__PURE__ */ jsx(Badge, { tone: "amber", children: "New" }),
                  student.isRepeating && repeating && /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "Already flagged" })
                ] }) })
              ]
            },
            id
          );
        }) })
      ] }) }),
      !loading && !visible.length && /* @__PURE__ */ jsx("p", { className: "px-5 py-10 text-center text-[13px] font-semibold text-slate-500", children: "No students match these filters." }),
      rows.length > PER_PAGE$1 && /* @__PURE__ */ jsx(
        Pagination$1,
        {
          meta: { page: safePage, perPage: PER_PAGE$1, total: rows.length, totalPages },
          onPageChange: setPage,
          itemLabel: "students in review"
        }
      )
    ] })
  ] });
};
const today$2 = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const GraduationStep = ({ classes, students, schoolId, onConfirm, busy, result }) => {
  const [graduationDate, setGraduationDate] = useState(today$2);
  const [graduationType, setGraduationType] = useState("STANDARD");
  const [autoAssign, setAutoAssign] = useState(true);
  const [prefix, setPrefix] = useState("CERT");
  const unsettled = useMemo(() => students.filter((s) => (s.balance || 0) > 0), [students]);
  const settledTotal = useMemo(
    () => students.reduce((sum, s) => sum + (s.totalPaid || 0), 0),
    [students]
  );
  const outstandingTotal = useMemo(
    () => unsettled.reduce((sum, s) => sum + (s.balance || 0), 0),
    [unsettled]
  );
  const collected = settledTotal + outstandingTotal;
  if (!classes.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: GraduationCap,
        title: "No final-year class",
        description: "None of your classes sit at the end of the class list, so there is no cohort to graduate. Check the class mapping in step 1."
      }
    );
  }
  if (!students.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: GraduationCap,
        title: "No students in the final-year class",
        description: `${classes.join(", ")} ${classes.length === 1 ? "has" : "have"} no active students. Nobody will be graduated until someone is enrolled.`
      }
    );
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    result && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(ShieldCheck, { className: "h-5 w-5 shrink-0 text-brand-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-brand-900", children: [
        /* @__PURE__ */ jsxs("span", { className: "font-extrabold", children: [
          formatCount(result.summary?.graduated || 0),
          " graduated"
        ] }),
        result.summary?.ineligible ? `, ${formatCount(result.summary.ineligible)} ineligible and not touched` : "",
        ". Their records are in the Alumni register with their certificates."
      ] })
    ] }),
    unsettled.length > 0 && /* Amber, not red. Nothing here is wrong — a balance is a fact about a
    ledger, not an error, and red would read as "this is broken" when the
    correct action is to carry it into the alumni archive. */
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-amber-900", children: [
        /* @__PURE__ */ jsxs("span", { className: "font-extrabold", children: [
          formatCount(unsettled.length),
          " graduating",
          " ",
          unsettled.length === 1 ? "student has" : "students have",
          " an outstanding balance"
        ] }),
        " ",
        "totalling ",
        formatCedi(outstandingTotal),
        ". You can still graduate",
        " ",
        unsettled.length === 1 ? "them" : "them",
        " — the balance is preserved in the alumni ledger and their guardian keeps the ability to pay."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsx("div", { className: "lg:col-span-2", children: /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
        /* @__PURE__ */ jsxs("header", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold tracking-tight text-ink", children: "Graduating cohort" }),
            /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: classes.join(" · ") })
          ] }),
          /* @__PURE__ */ jsxs(Badge, { tone: "amber", icon: GraduationCap, children: [
            formatCount(students.length),
            " students"
          ] })
        ] }),
        /* @__PURE__ */ jsx("ul", { className: "max-h-[22rem] divide-y divide-slate-100 overflow-y-auto", children: students.map((student) => {
          const guardian = (student.parents || []).find((p) => p.isPrimary);
          const owed = (student.balance || 0) > 0;
          return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-3 px-5 py-3", children: [
            /* @__PURE__ */ jsx(StudentAvatar, { student, size: "sm" }),
            /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName }),
              /* @__PURE__ */ jsxs("span", { className: "block font-mono text-[11px] font-bold text-slate-500", children: [
                student.studentId,
                guardian?.parentName ? ` · ${guardian.parentName}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "whitespace-nowrap text-[12px] font-semibold text-slate-500", children: [
              "Paid ",
              formatCedi(student.totalPaid || 0)
            ] }),
            owed ? /* @__PURE__ */ jsxs(Badge, { tone: "amber", children: [
              formatCedi(student.balance),
              " due"
            ] }) : /* @__PURE__ */ jsx(Badge, { tone: "green", children: "Cleared" })
          ] }, student._id || student.id);
        }) })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
          /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Graduation details" }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "mb-0.5 block text-[11px] font-semibold text-slate-700", children: "Graduation date" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "date",
                  value: graduationDate,
                  max: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
                  onChange: (event) => setGraduationDate(event.target.value),
                  className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                }
              )
            ] }),
            /* @__PURE__ */ jsx(
              SelectField,
              {
                label: "Graduation type",
                value: graduationType,
                onChange: (event) => setGraduationType(event.target.value),
                children: GRADUATION_TYPES.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
              }
            ),
            /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: autoAssign,
                  onChange: (event) => setAutoAssign(event.target.checked),
                  className: "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[12px] font-extrabold text-ink", children: "Assign certificate numbers" }),
                /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-500", children: "Sequenced per school from a shared counter, so no two graduates collide." })
              ] })
            ] }),
            autoAssign && /* @__PURE__ */ jsxs("label", { className: "block", children: [
              /* @__PURE__ */ jsx("span", { className: "mb-0.5 block text-[11px] font-semibold text-slate-700", children: "Certificate prefix" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: prefix,
                  onChange: (event) => setPrefix(event.target.value.toUpperCase()),
                  placeholder: "CERT",
                  className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] font-bold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
          /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-extrabold text-ink", children: "Collection summary" }),
          /* @__PURE__ */ jsxs("dl", { className: "space-y-2 text-[13px]", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Total collected" }),
              /* @__PURE__ */ jsx("dd", { className: "font-extrabold tabular-nums text-ink", children: formatCedi(settledTotal) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Outstanding" }),
              /* @__PURE__ */ jsx(
                "dd",
                {
                  className: `font-extrabold tabular-nums ${outstandingTotal > 0 ? "text-amber-700" : "text-emerald-600"}`,
                  children: formatCedi(outstandingTotal)
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2", children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Collection rate" }),
              /* @__PURE__ */ jsx("dd", { className: "font-extrabold tabular-nums text-ink", children: collected > 0 ? `${(settledTotal / collected * 100).toFixed(1)}%` : "—" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => onConfirm({
              classNames: classes,
              graduationDate,
              graduationType,
              autoAssignCertificates: autoAssign,
              certificatePrefix: autoAssign ? prefix : void 0
            }),
            disabled: busy || !graduationDate,
            className: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4", "aria-hidden": "true" }),
              busy ? "Graduating…" : `Graduate ${formatCount(students.length)} ${students.length === 1 ? "student" : "students"}`
            ]
          }
        )
      ] })
    ] })
  ] });
};
const usePromotionData = ({ schoolId, classes = [], enabled = true }) => {
  const [state, setState] = useState({
    rows: [],
    loading: true,
    error: null,
    preview: null
  });
  const [overrides, setOverrides] = useState({});
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const classKey = classes.join("|");
  useEffect(() => {
    if (!enabled || !schoolId || !classes.length) {
      setState({ rows: [], loading: false, error: null, preview: null });
      return void 0;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.all([
      previewPromotion({ schoolId, classNames: classes }).catch(() => null),
      Promise.all(
        classes.map(
          (className) => listStudents({ class: className, status: "active", perPage: 100 }).then((result) => result.rows || []).catch(() => [])
        )
      ).catch(() => [])
    ]).then(([preview, perClass]) => {
      if (!active) return;
      const seen = /* @__PURE__ */ new Set();
      const rows = perClass.flat().filter((student) => {
        const id = String(student._id || student.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setState({ rows, loading: false, error: null, preview });
    }).catch((error) => {
      if (!active) return;
      setState({ rows: [], loading: false, error, preview: null });
    });
    return () => {
      active = false;
    };
  }, [schoolId, classKey, enabled, revision]);
  const matrix = useMemo(() => {
    const byClass = /* @__PURE__ */ new Map();
    state.rows.forEach((student) => {
      const key = student.studentClass;
      if (!byClass.has(key)) byClass.set(key, []);
      byClass.get(key).push(student);
    });
    const previewTargets = /* @__PURE__ */ new Map();
    (state.preview?.mapping || []).forEach((entry) => {
      previewTargets.set(entry.currentClass, entry);
    });
    return classes.map((className) => {
      const students = byClass.get(className) || [];
      const isLast = classes.indexOf(className) === classes.length - 1;
      const entry = previewTargets.get(className);
      const serverTarget = entry?.targetClass || null;
      const target = overrides[className] !== void 0 ? overrides[className] : serverTarget;
      return {
        className,
        students,
        enrolled: students.length,
        // The class list is ordered, so "is this the top" is positional, and a
        // school whose list ends in a final-year stream has a last class that is
        // also its graduating class. Both readings agree here.
        isFinalYear: isLast || !serverTarget,
        serverTarget,
        target,
        overridden: overrides[className] !== void 0 && overrides[className] !== serverTarget,
        outstanding: students.filter((s) => (s.balance || 0) > 0),
        balance: students.reduce((sum, s) => sum + (s.balance || 0), 0),
        repeating: students.filter((s) => s.isRepeating)
      };
    });
  }, [classes, state.rows, state.preview, overrides]);
  const totals = useMemo(() => {
    const promoteClasses = matrix.filter((row) => !row.isFinalYear);
    const graduateClasses = matrix.filter((row) => row.isFinalYear);
    return {
      promoting: promoteClasses.reduce((n, row) => n + row.enrolled, 0),
      promotingClasses: promoteClasses.length,
      graduating: graduateClasses.reduce((n, row) => n + row.enrolled, 0),
      graduatingClasses: graduateClasses.length,
      repeating: matrix.reduce((n, row) => n + row.repeating.length, 0),
      outstanding: matrix.reduce((n, row) => n + row.outstanding.length, 0),
      outstandingAmount: matrix.reduce((n, row) => n + row.balance, 0),
      total: matrix.reduce((n, row) => n + row.enrolled, 0)
    };
  }, [matrix]);
  const setTarget = useCallback((className, target) => {
    setOverrides((current) => ({ ...current, [className]: target }));
  }, []);
  const resetTargets = useCallback(() => setOverrides({}), []);
  return {
    ...state,
    matrix,
    totals,
    setTarget,
    resetTargets,
    refresh,
    hasOverrides: Object.keys(overrides).length > 0
  };
};
const STEPS = [
  { key: "mapping", label: "Class mapping" },
  { key: "review", label: "Review students" },
  { key: "graduate", label: "Graduate cohort" }
];
const PromotionsTab = ({ schoolId, classes, onRosterChanged }) => {
  const { success, warning, error: errorToast } = useToast();
  const [step, setStep] = useState(0);
  const [decisions, setDecisions] = useState({});
  const [committing, setCommitting] = useState(false);
  const [graduating, setGraduating] = useState(false);
  const [graduationResult, setGraduationResult] = useState(null);
  const { matrix, totals, loading, error, setTarget, resetTargets, hasOverrides, refresh } = usePromotionData({ schoolId, classes });
  const finalClasses = useMemo(
    () => matrix.filter((row) => row.isFinalYear).map((row) => row.className),
    [matrix]
  );
  const reviewStudents = useMemo(
    () => matrix.filter((row) => !row.isFinalYear).flatMap((row) => row.students),
    [matrix]
  );
  const finalStudents = useMemo(
    () => matrix.filter((row) => row.isFinalYear).flatMap((row) => row.students),
    [matrix]
  );
  const decide = useCallback((id, decision) => {
    setDecisions((current) => ({ ...current, [id]: decision }));
  }, []);
  const onClearRepeat = async (student) => {
    const reason = window.prompt(
      `Clear the repeat flag for ${student.studentName}?

A reason is required and is recorded in the audit trail.`
    );
    if (!reason || reason.trim().length < 3) {
      return;
    }
    try {
      await clearRepeating(student._id || student.id, reason.trim());
      decide(String(student._id || student.id), "promote");
      success(`${student.studentName} is no longer marked as repeating`);
      refresh();
    } catch (err) {
      errorToast(err.message);
    }
  };
  const commit = async () => {
    setCommitting(true);
    const toRepeat = Object.entries(decisions).filter(([, decision]) => decision === "repeat").map(([id]) => id);
    const toPromote = reviewStudents.filter(
      (s) => decisions[String(s._id || s.id)] !== "repeat"
    );
    const failed = [];
    try {
      for (const id of toRepeat) {
        const student = reviewStudents.find((s) => String(s._id || s.id) === id);
        if (student?.isRepeating) continue;
        try {
          await markRepeating(id, { repeatReason: "ACADEMIC" });
        } catch (err) {
          failed.push({ name: student?.studentName || id, action: "mark as repeating", error: err });
        }
      }
      for (const student of toPromote) {
        const id = student._id || student.id;
        try {
          await promoteStudent(id, {});
        } catch (err) {
          failed.push({ name: student.studentName || id, action: "promote", error: err });
        }
      }
      if (failed.length) {
        warning(
          `${formatCount(failed.length)} of ${formatCount(
            reviewStudents.length
          )} students could not be processed. ${failed.slice(0, 3).map((f) => f.name).join(", ")}${failed.length > 3 ? " and others" : ""} — open each student to check.`
        );
      } else {
        success(
          `${formatCount(toPromote.length)} promoted, ${formatCount(toRepeat.length)} marked as repeating`
        );
      }
      setDecisions({});
      refresh();
      onRosterChanged?.();
      setStep(2);
    } finally {
      setCommitting(false);
    }
  };
  const onGraduate = async (payload) => {
    setGraduating(true);
    try {
      const result = await bulkGraduate(schoolId, payload);
      setGraduationResult(result);
      const graduated = result?.summary?.graduated || 0;
      const ineligible = result?.summary?.ineligible || 0;
      if (graduated) {
        success(`${formatCount(graduated)} students graduated and moved to Alumni`);
      }
      if (ineligible) {
        warning(
          `${formatCount(ineligible)} ${ineligible === 1 ? "student was" : "students were"} skipped — not in a final-year class.`
        );
      }
      refresh();
      onRosterChanged?.();
    } catch (err) {
      errorToast(err.message);
      throw err;
    } finally {
      setGraduating(false);
    }
  };
  if (!classes.length) {
    return /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-amber-900", children: [
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "This school has no classes yet." }),
        " ",
        "Promotions map one class onto the next, so there is nothing to promote until your class list is set up."
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx("ol", { className: "flex flex-wrap items-center gap-2", "aria-label": "Promotion progress", children: STEPS.map((item, index) => {
      const active = index === step;
      const done = index < step;
      return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setStep(index),
            "aria-current": active ? "step" : void 0,
            className: `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-extrabold transition-colors ${active ? "bg-brand-700 text-white" : done ? "bg-brand-50 text-brand-800 hover:bg-brand-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`,
            children: [
              /* @__PURE__ */ jsx(
                "span",
                {
                  className: `flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? "bg-white/20" : done ? "bg-brand-700 text-white" : "bg-white/60"}`,
                  children: done ? /* @__PURE__ */ jsx(Check, { className: "h-3 w-3", "aria-hidden": "true" }) : index + 1
                }
              ),
              item.label
            ]
          }
        ),
        index < STEPS.length - 1 && /* @__PURE__ */ jsx(ArrowRight, { className: "h-3.5 w-3.5 text-slate-300", "aria-hidden": "true" })
      ] }, item.key);
    }) }),
    error && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-red-900", children: [
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "The promotion preview could not be loaded." }),
        " ",
        error.message
      ] })
    ] }),
    step === 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        ClassMappingStep,
        {
          matrix,
          classes,
          onTargetChange: setTarget,
          onReset: resetTargets,
          hasOverrides,
          loading,
          error
        }
      ),
      /* @__PURE__ */ jsx(PromotionSummary, { totals }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("p", { className: "flex-1 text-[12px] font-semibold text-slate-500", children: "Nothing is written on this step. The next step shows every student individually so you can hold anyone back." }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setStep(1),
            disabled: loading,
            className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50",
            children: [
              "Review ",
              formatCount(totals.promoting),
              " students",
              /* @__PURE__ */ jsx(ArrowRight, { className: "h-4 w-4", "aria-hidden": "true" })
            ]
          }
        )
      ] })
    ] }),
    step === 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PromotionReviewStep,
        {
          students: reviewStudents,
          decisions,
          onDecide: decide,
          onClearRepeat,
          classes,
          loading,
          error,
          busy: committing
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setStep(0),
            disabled: committing,
            className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Back to mapping"
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
            /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-ink", children: [
              formatCount(totals.promoting - totals.repeating),
              " promoting"
            ] }),
            totals.repeating > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-amber-700", children: [
                formatCount(totals.repeating),
                " repeating"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: commit,
              disabled: committing || !reviewStudents.length,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Sparkles, { className: "h-4 w-4", "aria-hidden": "true" }),
                committing ? "Committing…" : "Confirm all promotions"
              ]
            }
          )
        ] })
      ] })
    ] }),
    step === 2 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        GraduationStep,
        {
          classes: finalClasses,
          students: finalStudents,
          schoolId,
          onConfirm: onGraduate,
          busy: graduating,
          result: graduationResult
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "flex justify-start", children: /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => setStep(1),
          className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
            "Back to student review"
          ]
        }
      ) })
    ] })
  ] });
};
const CARD_GEOMETRY = {
  widthMm: 85.6,
  heightMm: 53.98,
  /** 30 mil ≈ 0.762 mm; the bleed allowance the print spec assumes. */
  bleedMm: 3.175
};
const CARD_FIELDS = [
  // ── Issuing institution ────────────────────────────────────────────────
  { section: "header", key: "schoolName", label: "School name", path: "school.name", source: "school", required: "print" },
  { section: "header", key: "schoolLogo", label: "School logo", path: "school.logo", source: "school", required: "recommended" },
  { section: "header", key: "schoolMotto", label: "School motto", path: "school.motto", source: "school", required: "optional" },
  { section: "header", key: "schoolAddress", label: "School address", path: "school.address", source: "school", required: "optional" },
  { section: "header", key: "schoolCode", label: "GES / school code", path: "school.schoolCode", source: "school", required: "print" },
  { section: "header", key: "cardSerial", label: "Card serial number", path: "derived: studentId + issue sequence", source: "derived", required: "print", available: false },
  // ── Student identity ───────────────────────────────────────────────────
  { section: "identity", key: "studentImage", label: "Student photograph", path: "student.studentImage", source: "student", required: "print" },
  { section: "identity", key: "studentName", label: "Full student name", path: "student.studentName", source: "student", required: "print" },
  { section: "identity", key: "studentId", label: "Student ID", path: "student.studentId", source: "student", required: "print" },
  { section: "identity", key: "emisId", label: "EMIS identification number", path: "student.emisId", source: "student", required: "recommended", available: false },
  { section: "identity", key: "dateOfBirth", label: "Date of birth", path: "student.dateOfBirth", source: "student", required: "recommended" },
  { section: "identity", key: "gender", label: "Gender", path: "student.gender", source: "student", required: "optional" },
  { section: "identity", key: "nationality", label: "Nationality", path: "student.nationality", source: "student", required: "optional", available: false },
  // ── Academic record ────────────────────────────────────────────────────
  { section: "academic", key: "studentClass", label: "Class / stream", path: "student.studentClass", source: "student", required: "print" },
  { section: "academic", key: "academicYear", label: "Academic cycle", path: "student.academicYear", source: "student", required: "recommended" },
  { section: "academic", key: "house", label: "House", path: "student.house", source: "student", required: "optional", available: false },
  { section: "academic", key: "admissionDate", label: "Date of admission", path: "student.admissionDate", source: "student", required: "optional", available: false },
  { section: "academic", key: "bloodGroup", label: "Blood group", path: "student.bloodGroup", source: "student", required: "optional", available: false },
  // ── Guardian & emergency contact ───────────────────────────────────────
  { section: "contact", key: "guardianName", label: "Primary guardian", path: "student.parents[isPrimary].parentName", source: "student", required: "print" },
  { section: "contact", key: "guardianPhone", label: "Guardian telephone", path: "student.parents[isPrimary].phone", source: "student", required: "print" },
  { section: "contact", key: "emergencyContact", label: "Emergency contact", path: "student.emergencyContacts[0]", source: "student", required: "recommended" },
  { section: "contact", key: "guardianEmail", label: "Guardian email", path: "student.parents[isPrimary].email", source: "student", required: "optional" },
  // ── Payment access ─────────────────────────────────────────────────────
  { section: "payment", key: "payLink", label: "Fee payment link", path: "student.payLink", source: "student", required: "recommended" },
  { section: "payment", key: "qrCode", label: "MoMo / card pay QR", path: "derived: QR of student.payLink", source: "derived", required: "recommended" },
  { section: "payment", key: "feeBalance", label: "Fee balance", path: "student.balance", source: "student", required: "optional" },
  // ── Security & machine-readable ────────────────────────────────────────
  { section: "security", key: "magneticTrack", label: "ISO/IEC 7810 Track 1/2", path: "derived: SukuuPay card token", source: "derived", required: "optional", available: false },
  { section: "security", key: "barcode", label: "Barcode of student ID", path: "derived: Code 128 of student.studentId", source: "derived", required: "recommended" },
  { section: "security", key: "hologram", label: "Holographic DOVID", path: "derived: printer-side security mark", source: "derived", required: "optional", available: false },
  { section: "security", key: "signature", label: "Bearer signature strip", path: "derived: guardian signature", source: "derived", required: "optional", available: false },
  { section: "security", key: "validFrom", label: "Valid from", path: "derived: issue date", source: "derived", required: "recommended", available: false },
  { section: "security", key: "validUntil", label: "Expires", path: "derived: issue date + academic cycle", source: "derived", required: "print", available: false },
  // ── Terms, issuer & signature ──────────────────────────────────────────
  { section: "terms", key: "issuerSignature", label: "Authorised signature", path: "school.stamp", source: "school", required: "optional" },
  { section: "terms", key: "termsText", label: "Institutional terms", path: "derived: school-owned copy", source: "derived", required: "print" }
];
const UNAVAILABLE_FIELDS = CARD_FIELDS.filter((f) => f.available === false);
const read = (source, path) => path.split(".").reduce((value, key) => value == null ? void 0 : value[key], source);
const relativePath = (field) => field.path.replace(/^(school|student)\./, "");
const primaryGuardian = (student) => (student?.parents || []).find((parent) => parent.isPrimary) || (student?.parents || [])[0] || null;
const resolveCardFields = (student = {}, school = {}, derived = {}) => {
  const guardian = primaryGuardian(student);
  const resolved = {};
  CARD_FIELDS.forEach((field) => {
    if (field.source === "derived") {
      resolved[field.key] = derived[field.key] ?? null;
      return;
    }
    if (field.key === "guardianName") return void (resolved[field.key] = guardian?.parentName || null);
    if (field.key === "guardianPhone") return void (resolved[field.key] = guardian?.phone || null);
    if (field.key === "guardianEmail") return void (resolved[field.key] = guardian?.email || null);
    if (field.key === "emergencyContact") {
      const contact = (student.emergencyContacts || [])[0];
      return void (resolved[field.key] = contact ? `${contact.contactName} (${contact.phone})` : null);
    }
    resolved[field.key] = read(field.source === "school" ? school : student, relativePath(field)) ?? null;
  });
  return resolved;
};
const cardReadiness = (student = {}, school = {}, derived = {}) => {
  const values = resolveCardFields(student, school, derived);
  const missing = CARD_FIELDS.filter(
    (field) => field.available !== false && isBlank(values[field.key])
  ).map((field) => field);
  const unavailable = UNAVAILABLE_FIELDS.map((field) => field);
  const blocking = missing.filter((field) => field.required === "print");
  const recommended = missing.filter((field) => field.required === "recommended");
  return {
    values,
    missing,
    unavailable,
    blocking,
    recommended,
    canPrint: blocking.length === 0,
    /** 0–1 over the fields the model can actually supply. */
    completeness: CARD_FIELDS.length === 0 ? 0 : (CARD_FIELDS.length - unavailable.length - missing.length) / (CARD_FIELDS.length - unavailable.length)
  };
};
const isBlank = (value) => value === null || value === void 0 || value === "";
const CardSurface = ({ children, className = "", bleed = false }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: `relative w-full overflow-hidden rounded-[6%] bg-white shadow-sm ring-1 ring-slate-900/10 ${bleed ? "p-[3%]" : ""} ${className}`,
    style: { aspectRatio: `${CARD_GEOMETRY.widthMm} / ${CARD_GEOMETRY.heightMm}` },
    children
  }
);
const IdCardFront = ({ values, school, showPhoto = true, showQr = true }) => /* @__PURE__ */ jsxs(CardSurface, { className: "flex flex-col p-[4%]", children: [
  /* @__PURE__ */ jsxs("header", { className: "flex items-start justify-between gap-2 border-b-2 border-amber-400 pb-[3%]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-700 text-[10px] font-extrabold text-white", children: "S" }),
      /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("span", { className: "block truncate text-[10px] font-extrabold uppercase leading-tight text-ink", children: school?.name || "School name not set" }),
        school?.motto && /* @__PURE__ */ jsx("span", { className: "block truncate text-[7px] italic text-slate-500", children: school.motto })
      ] })
    ] }),
    /* @__PURE__ */ jsx("span", { className: "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[7px] font-bold text-slate-600", children: school?.schoolCode || "—" })
  ] }),
  /* @__PURE__ */ jsxs("div", { className: "flex flex-1 gap-[4%] pt-[4%]", children: [
    /* @__PURE__ */ jsx("div", { className: "shrink-0", children: showPhoto && values.studentImage ? /* @__PURE__ */ jsx(
      "img",
      {
        src: values.studentImage,
        alt: "",
        className: "h-16 w-16 rounded-md object-cover ring-1 ring-slate-900/10"
      }
    ) : (
      /* An explicit "no photo" block rather than an empty hole. On a
         *printed card a blank rectangle reads as a printing fault; a
         labelled one reads as a missing photograph, which is what it is. */
      /* @__PURE__ */ jsx("span", { className: "flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md bg-slate-100 text-[7px] font-bold uppercase text-slate-400 ring-1 ring-slate-900/5", children: "No photo" })
    ) }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 space-y-[3%]", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Full student name" }),
        /* @__PURE__ */ jsx("p", { className: "truncate text-[12px] font-extrabold leading-tight text-ink", children: values.studentName || "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Student ID" }),
          /* @__PURE__ */ jsx("p", { className: "truncate font-mono text-[9px] font-bold text-ink", children: values.studentId || "—" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Class / stream" }),
          /* @__PURE__ */ jsx("p", { className: "truncate text-[9px] font-extrabold text-ink", children: values.studentClass || "—" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Academic cycle" }),
          /* @__PURE__ */ jsx("p", { className: "truncate text-[9px] font-extrabold text-ink", children: values.academicYear || "—" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Date of birth" }),
          /* @__PURE__ */ jsx("p", { className: "truncate text-[9px] font-extrabold text-ink", children: values.dateOfBirth ? new Date(values.dateOfBirth).toLocaleDateString("en-GB") : "—" })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "min-w-0 border-t border-slate-100 pt-[2%]", children: /* @__PURE__ */ jsxs("p", { className: "truncate text-[7px] font-semibold text-slate-500", children: [
        "Guardian:",
        " ",
        /* @__PURE__ */ jsx("span", { className: "font-extrabold text-slate-700", children: values.guardianName || "—" }),
        values.guardianPhone && ` · ${values.guardianPhone}`
      ] }) })
    ] }),
    showQr && /* @__PURE__ */ jsxs("div", { className: "shrink-0 text-center", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-12 w-12 items-center justify-center rounded bg-slate-50 ring-1 ring-slate-900/5", children: /* @__PURE__ */ jsx(QrCode, { className: "h-8 w-8 text-slate-700", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsx("span", { className: "mt-0.5 block text-[5px] font-bold uppercase tracking-wide text-slate-400", children: "Scan to pay" })
    ] })
  ] }),
  /* @__PURE__ */ jsxs("footer", { className: "flex items-center justify-between border-t border-slate-100 pt-[2%]", children: [
    /* @__PURE__ */ jsx("span", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "GES compliant student card" }),
    /* @__PURE__ */ jsx("span", { className: "rounded bg-brand-50 px-1.5 py-0.5 text-[6px] font-extrabold text-brand-800", children: "Powered by SukuuPay" })
  ] })
] });
const IdCardBack = ({ values, school }) => /* @__PURE__ */ jsxs(CardSurface, { className: "flex flex-col p-[4%]", children: [
  /* @__PURE__ */ jsxs("div", { className: "-mx-[4%] -mt-[4%] flex items-center justify-between bg-slate-800 px-[4%] py-[3%]", children: [
    /* @__PURE__ */ jsx("span", { className: "text-[6px] font-bold uppercase tracking-wider text-slate-400", children: "Track 1 encrypted" }),
    /* @__PURE__ */ jsx("span", { className: "font-mono text-[7px] font-bold text-slate-200", children: "SUKUUPAY" })
  ] }),
  /* @__PURE__ */ jsxs("div", { className: "mt-[4%] space-y-[3%]", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-[6px] font-bold uppercase tracking-wide text-slate-400", children: "Institutional terms & conditions" }),
      /* @__PURE__ */ jsxs("p", { className: "line-clamp-3 text-[6px] leading-tight text-slate-500", children: [
        "This credential is the exclusive legal property of",
        " ",
        school?.name || "the issuing school",
        ". It is not transferable. Return it promptly if so requested. Authorised for classroom identification only."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx("div", { className: "flex h-10 flex-1 items-end gap-px bg-white px-1.5 pb-1 pt-1 ring-1 ring-slate-900/10", children: (values.studentId || "000000").split("").map((char, index) => /* @__PURE__ */ jsx(
        "span",
        {
          className: "h-full bg-slate-900",
          style: {
            width: `${(char.charCodeAt(0) % 3 + 1) * 0.7}px`,
            opacity: char.charCodeAt(0) % 5 / 7 + 0.45
          }
        },
        index
      )) }),
      /* @__PURE__ */ jsxs("p", { className: "shrink-0 font-mono text-[6px] font-bold text-slate-600", children: [
        "“",
        values.studentId || "—",
        "”"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("dl", { className: "grid grid-cols-2 gap-x-2 gap-y-1 text-[6px]", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "font-bold uppercase text-slate-400", children: "Guardian" }),
        /* @__PURE__ */ jsx("dd", { className: "truncate font-extrabold text-slate-700", children: values.guardianName || "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "font-bold uppercase text-slate-400", children: "Emergency" }),
        /* @__PURE__ */ jsx("dd", { className: "truncate font-extrabold text-slate-700", children: values.emergencyContact || "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "font-bold uppercase text-slate-400", children: "Holder" }),
        /* @__PURE__ */ jsx("dd", { className: "truncate font-extrabold text-slate-700", children: values.studentName || "—" })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "font-bold uppercase text-slate-400", children: "Expires" }),
        /* @__PURE__ */ jsx("dd", { className: "truncate font-extrabold text-amber-700", children: "Not tracked" })
      ] })
    ] })
  ] })
] });
const IdCardPreview = ({ student, school, showBleed = false }) => {
  const readiness = cardReadiness(student, school, {
    qrCode: student?.payLink ? "generated" : null,
    barcode: student?.studentId || null,
    termsText: school?.name || null
  });
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs("div", { className: showBleed ? "rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3" : "", children: [
      /* @__PURE__ */ jsx("p", { className: "mb-1.5 text-[11px] font-extrabold text-ink", children: "Card front" }),
      /* @__PURE__ */ jsx(IdCardFront, { values: readiness.values, school })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: showBleed ? "rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3" : "", children: [
      /* @__PURE__ */ jsx("p", { className: "mb-1.5 text-[11px] font-extrabold text-ink", children: "Card back" }),
      /* @__PURE__ */ jsx(IdCardBack, { values: readiness.values, school })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-slate-50 px-3 py-2", children: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
      "Preview only. The printed file is the server’s PDF — CMYK, 300 DPI, ",
      CARD_GEOMETRY.widthMm,
      " × ",
      CARD_GEOMETRY.heightMm,
      " mm with",
      " ",
      CARD_GEOMETRY.bleedMm.toFixed(3),
      " mm bleed."
    ] }) })
  ] });
};
const usePrintRoster = ({ page = 1, perPage = 24, className = "", search = "" } = {}) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    const params = Object.fromEntries(
      Object.entries({ page, perPage, class: className, search }).filter(
        ([, value]) => value !== "" && value !== null
      )
    );
    listStudents(params).then((result) => {
      if (!active) return;
      if (result.offline) {
        setState({
          rows: [],
          meta: null,
          loading: false,
          error: new Error(
            "Could not reach the server. No students are listed — this is a connection problem, not an empty roster."
          )
        });
        return;
      }
      setState({ rows: result.rows || [], meta: result.meta || null, loading: false, error: null });
    }).catch((error) => {
      if (active) setState({ rows: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [page, perPage, className, search, revision]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  return { ...state, refresh };
};
const saveBlob = (response, fallbackName) => {
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
  return filename;
};
const createIdCardBatch = async (studentIds, options = {}) => {
  try {
    const { data } = await api.post(
      "/id-cards/batch",
      {
        studentIds,
        includeQr: options.includeQr !== false,
        includePhoto: options.includePhoto !== false,
        cardTemplate: "default"
      },
      { timeout: 6e4 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The print batch could not be started.");
  }
};
const downloadIdCardBatchPdf = async (batchId) => {
  try {
    const response = await api.get(
      `/id-cards/batch/${encodeURIComponent(batchId)}/pdf`,
      { responseType: "blob", timeout: 12e4 }
    );
    if (response.status === 202) {
      return { status: "pending" };
    }
    return saveBlob(response, "id-cards.pdf");
  } catch (error) {
    if (error.response?.status === 409) {
      const body = await parseMaybeJson(error.response.data);
      throw new Error(body?.message || "This batch could not be generated.");
    }
    throw toApiError(error, "The print file could not be downloaded.");
  }
};
const downloadStudentIdCard = async (studentId) => {
  try {
    const response = await api.get(
      `/id-cards/${encodeURIComponent(studentId)}`,
      { responseType: "blob", timeout: 6e4 }
    );
    return saveBlob(response, "student-id-card.pdf");
  } catch (error) {
    throw toApiError(error, "This student's card could not be generated.");
  }
};
const exportQrLinks = async (schoolId, params = {}) => {
  try {
    const response = await api.get(
      `/id-cards/qr-links/${encodeURIComponent(schoolId)}`,
      { params, responseType: "blob", timeout: 6e4 }
    );
    return saveBlob(response, "qr-links.csv");
  } catch (error) {
    throw toApiError(error, "The QR links export could not be downloaded.");
  }
};
const parseMaybeJson = async (body) => {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body?.text === "function") {
    try {
      return JSON.parse(await body.text());
    } catch {
      return null;
    }
  }
  return body;
};
const PER_PAGE = 24;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "ready", label: "Printable" },
  { value: "blocked", label: "Needs attention" },
  { value: "no-photo", label: "Missing photo" }
];
const CARDS_PER_SHEET = 8;
const IdCardPrintStudio = ({ schoolId, school, classes }) => {
  const { success, warning, error: errorToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState(() => /* @__PURE__ */ new Set());
  const [focused, setFocused] = useState(null);
  const [showBleed, setShowBleed] = useState(false);
  const [batch, setBatch] = useState({ status: "idle", batchId: null });
  const pollRef = useRef(null);
  const { rows: students, loading, error, meta, refresh } = usePrintRoster({
    page,
    perPage: PER_PAGE,
    className: classFilter,
    search
  });
  const rows = useMemo(
    () => students.map((student) => ({
      student,
      readiness: cardReadiness(student, school, {
        qrCode: student.payLink ? "generated" : null,
        barcode: student.studentId || null,
        termsText: school?.name || null
      })
    })),
    [students, school]
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ student, readiness }) => {
      if (term && !String(student.studentName || "").toLowerCase().includes(term)) return false;
      if (filter === "ready") return readiness.canPrint;
      if (filter === "blocked") return !readiness.canPrint;
      if (filter === "no-photo") return !student.studentImage;
      return true;
    });
  }, [rows, filter, search]);
  const totals = useMemo(
    () => ({
      shown: visible.length,
      printable: visible.filter((r) => r.readiness.canPrint).length,
      blocked: visible.filter((r) => !r.readiness.canPrint).length,
      noPhoto: visible.filter((r) => !r.student.studentImage).length,
      withQr: visible.filter((r) => Boolean(r.student.payLink)).length
    }),
    [visible]
  );
  const selectedPrintable = useMemo(
    () => visible.filter(({ student, readiness }) => readiness.canPrint && selection.has(String(student._id || student.id))),
    [visible, selection]
  );
  const sheets = Math.ceil(selectedPrintable.length / CARDS_PER_SHEET);
  const QUOTE_PER_CARD = 3.5;
  const estimate = selectedPrintable.length * QUOTE_PER_CARD;
  const toggle = (id) => setSelection((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => {
    const printableIds = visible.filter(({ readiness }) => readiness.canPrint).map(({ student }) => String(student._id || student.id));
    setSelection((current) => {
      const allSelected = printableIds.every((id) => current.has(id));
      const next = new Set(current);
      printableIds.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };
  const blockedSelected = useMemo(() => {
    const blocked = new Set(
      rows.filter(({ readiness }) => !readiness.canPrint).map(({ student }) => String(student._id || student.id))
    );
    return [...selection].filter((id) => blocked.has(id));
  }, [rows, selection]);
  useEffect(() => () => clearTimeout(pollRef.current), []);
  const downloadWhenReady = useCallback(
    async (batchId, attempt = 0) => {
      if (attempt > 40) {
        setBatch({ status: "failed", batchId, error: "Timed out waiting for the print file." });
        return;
      }
      try {
        const result = await downloadIdCardBatchPdf(batchId);
        if (result?.status === "pending") {
          pollRef.current = setTimeout(() => downloadWhenReady(batchId, attempt + 1), 4e3);
          return;
        }
        success(`Downloaded ${result}`);
        setBatch({ status: "idle", batchId: null });
      } catch (err) {
        setBatch({ status: "failed", batchId, error: err.message });
        errorToast(err.message);
      }
    },
    [errorToast, success]
  );
  const startBatch = async () => {
    if (blockedSelected.length) {
      warning(
        `${formatCount(blockedSelected.length)} selected ${blockedSelected.length === 1 ? "student is" : "students are"} missing a required card field. Clear the selection and pick only printable students.`
      );
      return;
    }
    if (!selectedPrintable.length) return;
    setBatch({ status: "starting", batchId: null });
    try {
      const result = await createIdCardBatch(
        selectedPrintable.map(({ student }) => student._id || student.id)
      );
      setBatch({ status: "pending", batchId: result.batchId });
      pollRef.current = setTimeout(() => downloadWhenReady(result.batchId), 3e3);
    } catch (err) {
      setBatch({ status: "failed", batchId: null, error: err.message });
      errorToast(err.message);
    }
  };
  const busy = batch.status === "starting" || batch.status === "pending";
  if (error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: error.message }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-5 xl:grid-cols-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "space-y-4 xl:col-span-2", children: [
      /* @__PURE__ */ jsxs(Card, { padding: "p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "relative min-w-[13rem] flex-1", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "idcard-search", className: "sr-only", children: "Search students" }),
            /* @__PURE__ */ jsx(
              Search,
              {
                className: "pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400",
                "aria-hidden": "true"
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: "idcard-search",
                type: "search",
                value: search,
                onChange: (event) => {
                  setSearch(event.target.value);
                  setPage(1);
                },
                placeholder: "Search student name…",
                className: "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "w-full sm:w-44", children: /* @__PURE__ */ jsxs(
            SelectField,
            {
              label: "Class",
              value: classFilter,
              onChange: (event) => {
                setClassFilter(event.target.value);
                setPage(1);
              },
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "All classes" }),
                classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            role: "group",
            "aria-label": "Filter students by print readiness",
            className: "mt-3 flex flex-wrap items-center gap-1.5",
            children: FILTERS.map((option) => {
              const active = filter === option.value;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setFilter(option.value);
                    setPage(1);
                  },
                  "aria-pressed": active,
                  className: `rounded-xl px-3 py-1.5 text-[12px] font-extrabold transition-colors ${active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
                  children: option.label
                },
                option.value
              );
            })
          }
        )
      ] }),
      loading && !students.length ? /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3", children: Array.from({ length: 9 }).map((_, index) => /* @__PURE__ */ jsx("div", { className: "h-36 animate-pulse rounded-xl bg-slate-100" }, index)) }) : !visible.length ? /* @__PURE__ */ jsx(
        EmptyState,
        {
          icon: Printer,
          title: "No students match",
          description: "Adjust the class or filter to find students to print."
        }
      ) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-[12px] font-extrabold text-slate-600", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: visible.some(({ readiness }) => readiness.canPrint) && visible.filter(({ readiness }) => readiness.canPrint).every(({ student }) => selection.has(String(student._id || student.id))),
                onChange: toggleAll,
                className: "h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
              }
            ),
            "Select all printable on this page"
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
            formatCount(totals.shown),
            " shown · ",
            formatCount(totals.printable),
            " printable ·",
            " ",
            formatCount(totals.blocked),
            " blocked"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3", children: visible.map(({ student, readiness }) => {
          const id = String(student._id || student.id);
          const chosen = selection.has(id);
          return /* @__PURE__ */ jsxs(
            "div",
            {
              className: `group relative overflow-hidden rounded-xl border-2 bg-white p-3 text-left transition-all ${chosen ? "border-brand-700 shadow-lift" : readiness.canPrint ? "border-slate-200 hover:border-slate-300" : "border-amber-300 hover:border-amber-400"}`,
              children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    onClick: () => toggle(id),
                    "aria-pressed": chosen,
                    className: "w-full text-left",
                    children: [
                      /* @__PURE__ */ jsx("span", { className: "absolute right-2 top-2", children: /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold ${chosen ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-400"}`,
                          "aria-hidden": "true",
                          children: chosen ? "✓" : ""
                        }
                      ) }),
                      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2.5 pr-6", children: [
                        /* @__PURE__ */ jsx(StudentAvatar, { student, size: "lg", decorative: false }),
                        /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1", children: [
                          /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName }),
                          /* @__PURE__ */ jsx("span", { className: "block truncate font-mono text-[11px] font-bold text-slate-500", children: student.studentId }),
                          /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold text-slate-500", children: student.studentClass })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs("span", { className: "mt-2.5 flex flex-wrap items-center gap-1.5", children: [
                        readiness.canPrint ? /* @__PURE__ */ jsx(Badge, { tone: "green", icon: BadgeCheck, children: "Ready" }) : /* @__PURE__ */ jsxs(Badge, { tone: "amber", icon: CircleAlert, children: [
                          formatCount(readiness.blocking.length),
                          " required"
                        ] }),
                        !student.studentImage && /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "No photo" }),
                        student.payLink && /* @__PURE__ */ jsx(Badge, { tone: "brand", icon: QrCode, children: "QR" })
                      ] }),
                      !readiness.canPrint && /* @__PURE__ */ jsxs("span", { className: "mt-1.5 block truncate text-[11px] font-semibold text-amber-800", children: [
                        "Missing ",
                        readiness.blocking.map((f) => f.label).join(", ")
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setFocused({ student, readiness }),
                    "aria-label": `Preview the card for ${student.studentName}`,
                    title: "Preview & single PDF",
                    className: "absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(Eye, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
                  }
                )
              ]
            },
            id
          );
        }) }),
        meta && meta.totalPages > 1 && /* @__PURE__ */ jsx(
          Pagination$1,
          {
            meta,
            onPageChange: setPage,
            itemLabel: "students"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-extrabold text-ink", children: "Print batch" }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-3 space-y-2.5 text-[13px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Cards selected" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold tabular-nums text-ink", children: formatCount(selectedPrintable.length) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "A4 sheets needed" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold tabular-nums text-ink", children: formatCount(sheets) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Verified photos" }),
            /* @__PURE__ */ jsxs("dd", { className: "font-extrabold tabular-nums text-ink", children: [
              formatCount(totals.noPhoto ? visible.length - totals.noPhoto : visible.length),
              /* @__PURE__ */ jsxs("span", { className: "ml-1 text-[11px] text-slate-400", children: [
                "/ ",
                formatCount(visible.length)
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Pay QR linked" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold tabular-nums text-ink", children: formatCount(totals.withQr) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-lg bg-slate-50 px-3 py-2.5", children: [
          /* @__PURE__ */ jsxs("p", { className: "flex items-baseline gap-2 text-[13px]", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-bold uppercase tracking-wide text-slate-400", children: "Estimated" }),
            /* @__PURE__ */ jsx("span", { className: "font-extrabold tabular-nums text-ink", children: formatCedi(estimate * 100) })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[11px] font-semibold text-slate-500", children: [
            formatCedi(QUOTE_PER_CARD * 100),
            " per card. An estimate from the print partner — nothing is charged here."
          ] })
        ] }),
        batch.status === "failed" && /* @__PURE__ */ jsxs("div", { className: "mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2", children: [
          /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-red-900", children: batch.error })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: startBatch,
            disabled: busy || !selectedPrintable.length,
            className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
            children: [
              busy ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Printer, { className: "h-4 w-4", "aria-hidden": "true" }),
              batch.status === "starting" ? "Starting…" : batch.status === "pending" ? "Generating print file…" : `Batch print ${formatCount(selectedPrintable.length)} ${selectedPrintable.length === 1 ? "card" : "cards"}`
            ]
          }
        ),
        batch.status === "pending" && /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] font-semibold text-slate-500", children: "The cards render in the background. The download starts on its own when the file is ready." }),
        /* @__PURE__ */ jsx("div", { className: "mt-3 grid grid-cols-1 gap-2", children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => {
              if (!schoolId) return;
              exportQrLinks(schoolId).then((name) => success(`Downloaded ${name}`)).catch((err) => errorToast(err.message));
            },
            className: "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50",
            children: [
              /* @__PURE__ */ jsx(QrCode, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
              "Export pay links CSV"
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-extrabold text-ink", children: "Card preview" }),
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-1.5 text-[11px] font-extrabold text-slate-600", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked: showBleed,
                onChange: (event) => setShowBleed(event.target.checked),
                className: "h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
              }
            ),
            "Show bleed"
          ] })
        ] }),
        focused ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { className: "mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2", children: [
            /* @__PURE__ */ jsx(StudentAvatar, { student: focused.student, size: "sm", decorative: false }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "truncate text-[12px] font-extrabold text-ink", children: focused.student.studentName }),
              /* @__PURE__ */ jsx("p", { className: "font-mono text-[11px] font-bold text-slate-500", children: focused.student.studentId })
            ] }),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => downloadStudentIdCard(focused.student._id || focused.student.id).then((name) => success(`Downloaded ${name}`)).catch((err) => errorToast(err.message)),
                className: "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50",
                children: [
                  /* @__PURE__ */ jsx(FileText, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                  "PDF"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx(IdCardPreview, { student: focused.student, school, showBleed }) })
        ] }) : /* @__PURE__ */ jsx(
          EmptyState,
          {
            icon: FileText,
            title: "No student selected",
            description: "Choose a card from the grid to preview it and download a single PDF."
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-4", children: [
        /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx(ShieldCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600", "aria-hidden": "true" }),
          "Cards are generated on the server from your school’s own record. Printability is checked per student against the card field list, so a card without a name or guardian is held back rather than printed."
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: refresh,
            className: "mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-brand-700 hover:underline",
            children: [
              /* @__PURE__ */ jsx(Download, { className: "h-3 w-3", "aria-hidden": "true" }),
              "Refresh readiness"
            ]
          }
        )
      ] })
    ] })
  ] });
};
const today$1 = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const TransferOutDialog = ({ open, student, onClose, onConfirm }) => {
  const [form, setForm] = useState({
    destinationInstitution: "",
    destinationInstitutionType: "PUBLIC_SCHOOL",
    transferDate: today$1(),
    transferReason: "RELOCATION",
    customReason: "",
    contactPerson: "",
    contactPhone: "",
    recordsTransferred: true,
    notes: ""
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm({
        destinationInstitution: "",
        destinationInstitutionType: "PUBLIC_SCHOOL",
        transferDate: today$1(),
        transferReason: "RELOCATION",
        customReason: "",
        contactPerson: "",
        contactPhone: "",
        recordsTransferred: true,
        notes: ""
      });
      setError(null);
    }
  }, [open, student?._id]);
  if (!open || !student) return null;
  const guardian = (student.parents || []).find((p) => p.isPrimary);
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const needsCustomReason = form.transferReason === "OTHER";
  const submit = async () => {
    if (!form.destinationInstitution.trim()) {
      setError("Enter the school the student is transferring to.");
      return;
    }
    if (needsCustomReason && form.customReason.trim().length < 5) {
      setError("Give a reason of at least 5 characters, or choose a different reason.");
      return;
    }
    if (new Date(form.transferDate) > new Date(Date.now() + 30 * 864e5)) {
      setError("The transfer date cannot be more than 30 days in the future.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        ...form,
        customReason: needsCustomReason ? form.customReason : void 0
      });
    } catch (err) {
      setError(err.message || "The transfer could not be recorded.");
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose,
      size: "lg",
      title: `Record transfer out — ${student.studentName}`,
      description: `${student.studentClass} · Student ID: ${student.studentId}`,
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onClose,
            disabled: busy,
            className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: submit,
            disabled: busy,
            className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx(LogOut, { className: "h-4 w-4", "aria-hidden": "true" }),
              busy ? "Recording…" : "Confirm transfer out"
            ]
          }
        )
      ] }),
      children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2", children: [
          /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("p", { className: "flex-1 text-[12px] font-semibold text-brand-900", children: "GES Standard Form TS-4. The cumulative record stays on this student's ledger permanently." }),
          /* @__PURE__ */ jsx(Badge, { tone: "brand", children: "TS-4" })
        ] }),
        error && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: error }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Destination school",
              required: true,
              placeholder: "e.g. Achimota Basic School, Accra Metropolitan",
              value: form.destinationInstitution,
              onChange: (event) => set({ destinationInstitution: event.target.value })
            }
          ),
          /* @__PURE__ */ jsx(
            SelectField,
            {
              label: "Destination type",
              required: true,
              value: form.destinationInstitutionType,
              onChange: (event) => set({ destinationInstitutionType: event.target.value }),
              children: INSTITUTION_TYPES.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
            }
          ),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Transfer effective date",
              type: "date",
              required: true,
              max: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
              value: form.transferDate,
              onChange: (event) => set({ transferDate: event.target.value })
            }
          ),
          /* @__PURE__ */ jsx(
            SelectField,
            {
              label: "Reason for transfer",
              required: true,
              value: form.transferReason,
              onChange: (event) => set({ transferReason: event.target.value }),
              children: TRANSFER_REASONS.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
            }
          ),
          needsCustomReason && /* @__PURE__ */ jsx(
            Field,
            {
              label: "Please specify",
              required: true,
              className: "sm:col-span-2",
              value: form.customReason,
              onChange: (event) => set({ customReason: event.target.value })
            }
          ),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Contact person at destination",
              value: form.contactPerson,
              onChange: (event) => set({ contactPerson: event.target.value })
            }
          ),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Contact phone",
              value: form.contactPhone,
              onChange: (event) => set({ contactPhone: event.target.value })
            }
          )
        ] }),
        (student.balance || 0) > 0 && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-amber-900", children: [
            "Outstanding balance · ",
            formatCedi(student.balance)
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[12px] font-semibold text-amber-800", children: [
            guardian ? `${guardian.parentName} remains liable. ` : "No primary guardian is recorded, so this balance has no named payer. ",
            "The ledger is preserved and the balance carries into the transfer record."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: form.recordsTransferred,
              onChange: (event) => set({ recordsTransferred: event.target.checked }),
              className: "mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700"
            }
          ),
          /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("span", { className: "block text-[12px] font-extrabold text-ink", children: "Hard-copy records have been transferred" }),
            /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-500", children: "Recorded on the cumulative record file as required by GES." })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Administrative notes",
            hint: "Optional",
            className: "block",
            value: form.notes,
            onChange: (event) => set({ notes: event.target.value })
          }
        ),
        guardian?.phone && /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[12px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400", "aria-hidden": "true" }),
          "The guardian at ",
          formatGhanaPhone(guardian.phone),
          " will keep the ability to settle any balance. Reminder SMS are sent from the SMS Reminders module."
        ] })
      ] })
    }
  );
};
const useStudents = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      search: searchParams.get("q") || "",
      class: searchParams.get("class") || "",
      status: searchParams.get("status") || "active",
      feeStatus: searchParams.get("feeStatus") || "",
      planStatus: searchParams.get("planStatus") || "",
      gender: searchParams.get("gender") || "",
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 20
    }),
    [searchParams]
  );
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "" && value !== null)
    );
    listStudents(params).then((result) => {
      if (!active) return;
      if (result.offline) {
        setState({
          rows: [],
          meta: null,
          loading: false,
          error: Object.assign(
            new Error("Could not reach the server. Showing no students — this is a connection problem, not an empty roster."),
            { offline: true }
          )
        });
        return;
      }
      setState({ rows: result.rows, meta: result.meta, loading: false, error: null });
    }).catch((error) => {
      if (!active) return;
      setState({ rows: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (filters.search) next.set("q", filters.search);
    setSearchParams(next, { replace: true });
  }, [filters.search, setSearchParams]);
  const hasFilters = Boolean(
    filters.class || filters.feeStatus || filters.planStatus || filters.gender || filters.status !== "active"
  );
  return { ...state, filters, setFilter, clearFilters, hasFilters };
};
const useStudentStats = (filters) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const scope = useMemo(
    () => ({
      class: filters.class || void 0,
      status: filters.status || void 0
    }),
    [filters.class, filters.status]
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    getStudentStats(scope).then((result) => {
      if (active) {
        setStats(result);
        setLoading(false);
      }
    }).catch(() => {
      if (active) {
        setStats(null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [scope]);
  return { stats, loading };
};
const useRosterSelection = (rows, filters) => {
  const [selected, setSelected] = useState(() => /* @__PURE__ */ new Set());
  const [allMatching, setAllMatching] = useState(false);
  useEffect(() => {
    setSelected(/* @__PURE__ */ new Set());
    setAllMatching(false);
  }, [filters.search, filters.class, filters.status, filters.feeStatus, filters.planStatus, filters.gender]);
  const visibleIds = useMemo(() => rows.map((row) => String(row._id || row.id)), [rows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleRow = (id) => setSelected((current) => {
    const next = new Set(current);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const toggleAllVisible = () => setSelected((current) => {
    const next = new Set(current);
    if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    return next;
  });
  const selectAllMatching = () => {
    setAllMatching(true);
    setSelected(/* @__PURE__ */ new Set());
  };
  const clear = () => {
    setSelected(/* @__PURE__ */ new Set());
    setAllMatching(false);
  };
  const target = useMemo(() => {
    if (allMatching) return { filter: { ...filters, ids: void 0 } };
    return { ids: [...selected] };
  }, [allMatching, selected, filters]);
  return {
    selected,
    selectedCount: allMatching ? null : selected.size,
    allMatching,
    allVisibleSelected,
    hasSelection: allMatching || selected.size > 0,
    toggleRow,
    toggleAllVisible,
    selectAllMatching,
    clear,
    target
  };
};
const TABS$2 = [
  { value: "roster", label: "Roster" },
  { value: "id-cards", label: "ID Cards" },
  { value: "promotions", label: "Promotions" },
  { value: "import", label: "Import" },
  { value: "alumni", label: "Alumni" },
  { value: "cohorts", label: "Cohorts" }
];
const Students = () => {
  const { user } = useAuth();
  const { success, warning, error: errorToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "roster";
  const [school, setSchool] = useState(null);
  const [schoolError, setSchoolError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingClasses, setEditingClasses] = useState(false);
  const [transferringOut, setTransferringOut] = useState(null);
  const [addAfterClasses, setAddAfterClasses] = useState(false);
  const { rows, meta, loading, error, filters, setFilter, clearFilters, hasFilters } = useStudents(reloadKey);
  const { stats, loading: statsLoading } = useStudentStats(filters);
  const selection = useRosterSelection(rows, filters);
  useEffect(() => {
    if (!user?.schoolId) return;
    let active = true;
    getSchool(user.schoolId).then((result) => {
      if (!active) return;
      setSchool(result);
      setSchoolError(null);
    }).catch((error2) => {
      if (!active) return;
      setSchool(null);
      setSchoolError(error2.message || "Your school could not be loaded.");
    });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);
  const classes = useMemo(
    () => school?.academic?.classes || school?.classes || [],
    [school]
  );
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  useEffect(() => {
    const onPhotoChanged = () => refresh();
    window.addEventListener(PHOTO_CHANGED_EVENT, onPhotoChanged);
    return () => window.removeEventListener(PHOTO_CHANGED_EVENT, onPhotoChanged);
  }, [refresh]);
  const onClassesSaved = useCallback(
    (next) => {
      setSchool(
        (current) => current ? { ...current, academic: { ...current.academic, classes: next } } : current
      );
      success(`${formatCount(next.length)} ${next.length === 1 ? "class" : "classes"} saved`);
      if (addAfterClasses) {
        setAddAfterClasses(false);
        setCreating(true);
      }
    },
    [success, addAfterClasses]
  );
  const onAddStudent = () => {
    if (classes.length) {
      setCreating(true);
      return;
    }
    setAddAfterClasses(true);
    setEditingClasses(true);
  };
  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === "roster") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };
  const onExport = async () => {
    try {
      const { filename } = await exportStudents(filters);
      success(`Downloaded ${filename}`);
    } catch (err) {
      errorToast(err.message);
    }
  };
  const onMessage = (student) => {
    warning(
      `Reminders for ${student.studentName} are sent from the SMS Reminders module — the send API is not wired yet.`
    );
    setSearchParams({ tab: "roster" }, { replace: true });
  };
  const onRegeneratePayLink = async (student) => {
    try {
      const result = await regeneratePayLink(student._id || student.id);
      success(
        result?.payLink ? `New pay link for ${student.studentName}: ${result.payLink}` : `Pay link regenerated for ${student.studentName}`
      );
      refresh();
    } catch (err) {
      errorToast(err.message);
    }
  };
  const onSaved = (saved, wasEdit) => {
    if (wasEdit) {
      success(`${saved?.studentName || "Student"} updated`);
    } else if (hasFilters) {
      setFilter({ class: "", feeStatus: "", planStatus: "", gender: "", status: "active", page: 1 });
      success(
        `${saved?.studentName || "Student"} added. Your filters were cleared so you can see them.`
      );
    } else {
      success(`${saved?.studentName || "Student"} added`);
    }
    setEditing(null);
    setCreating(false);
    refresh();
  };
  const bulkHandlers = useMemo(
    () => ({
      previewBulkUpdate: (target, update) => bulkUpdateStudents(target, update, void 0, { dryRun: true }).then((result) => {
        if (!result.ok) throw result.error;
        return result.result;
      }),
      bulkUpdate: (target, update) => bulkUpdateStudents(target, update).then((result) => {
        if (!result.ok) throw result.error;
        success(`${formatCount(result.result.updated)} students updated`);
        selection.clear();
        refresh();
        return result.result;
      }),
      bulkArchive: (target, options) => bulkArchiveStudents(target, options).then((result) => {
        if (!result.ok) {
          throw result.error;
        }
        success(`${formatCount(result.result.archived)} students archived`);
        selection.clear();
        refresh();
        return result.result;
      }),
      bulkStatus: (target, status, options) => bulkSetStatus(target, status, options).then((result) => {
        if (!result.ok) throw result.error;
        const { changed, failed } = result.result;
        success(
          failed ? `${formatCount(changed)} updated, ${formatCount(failed)} skipped` : `${formatCount(changed)} students updated`
        );
        selection.clear();
        refresh();
        return result.result;
      }),
      bulkPayLinks: (target) => bulkRegeneratePayLinks(target).then((result) => {
        if (!result.ok) throw result.error;
        success(`${formatCount(result.result.regenerated)} pay links regenerated`);
        selection.clear();
        refresh();
        return result.result;
      })
    }),
    [success, selection, refresh]
  );
  const onTransferOut = async (payload) => {
    const student = transferringOut;
    await transferOut(student._id || student.id, payload);
    success(`${student.studentName} transferred out to ${payload.destinationInstitution}`);
    setTransferringOut(null);
    refresh();
  };
  const onBulkError = (err) => {
    const refused = err?.details?.errors?.length;
    if (refused) {
      warning(
        `${formatCount(refused)} students have an outstanding balance and were not archived. Open the list to see who.`
      );
      return;
    }
    errorToast(err?.message || "That bulk action could not be completed.");
  };
  if (tab === "id-cards") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          eyebrow: "Students",
          title: "ID card print studio",
          description: "Print-ready CR80 student cards, generated from your school's own record."
        }
      ),
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
      /* @__PURE__ */ jsx(IdCardPrintStudio, { schoolId: user?.schoolId, school, classes })
    ] });
  }
  if (tab === "promotions") {
    if (!school && !schoolError) {
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          PageHeader,
          {
            eyebrow: "Students",
            title: "Promotions & Graduation",
            description: "Move every class to the next one, hold individual students back, and graduate the final-year cohort."
          }
        ),
        /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
        /* @__PURE__ */ jsx("div", { className: "h-64 animate-pulse rounded-2xl bg-slate-200/60", "aria-busy": "true" })
      ] });
    }
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          eyebrow: "Students",
          title: "Promotions & Graduation",
          description: "Move every class to the next one, hold individual students back, and graduate the final-year cohort."
        }
      ),
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
      /* @__PURE__ */ jsx(
        PromotionsTab,
        {
          schoolId: user?.schoolId,
          classes,
          onRosterChanged: refresh
        }
      )
    ] });
  }
  if (tab === "import") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          eyebrow: "Students",
          title: "Students & Fee Roster",
          description: "Bring a whole class in at once, or add them one at a time."
        }
      ),
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
      /* @__PURE__ */ jsx(
        ImportTab,
        {
          school,
          onImported: () => {
            refresh();
            setTab("roster");
          }
        }
      )
    ] });
  }
  if (tab === "alumni" || tab === "cohorts") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          eyebrow: "Students",
          title: "Students & Fee Roster",
          description: "Students who have graduated, and the cohorts they left with."
        }
      ),
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
      tab === "alumni" ? /* @__PURE__ */ jsx(AlumniTab, { schoolId: user?.schoolId }) : /* @__PURE__ */ jsx(CohortsTab, { schoolId: user?.schoolId })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Students",
        title: "Students & Fee Roster",
        description: meta?.total ? `Showing ${formatCount(meta.total)} ${meta.total === 1 ? "student" : "students"} on the roster.` : "Everyone on the roster, and every change their record can go through.",
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onExport,
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Export Roster"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: onAddStudent,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
              children: [
                /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Add New Student"
              ]
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$2, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
    /* @__PURE__ */ jsx(RosterKpiRow, { stats, loading: statsLoading }),
    schoolError && /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-amber-900", children: [
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "Your class list could not be loaded." }),
        " ",
        schoolError,
        " ",
        "Adding a student needs it, because a student must be in a class your school defines."
      ] })
    ] }),
    school && !schoolError && !classes.length && /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "h-4 w-4 shrink-0 text-slate-400", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("p", { className: "flex-1 text-[13px] font-semibold text-slate-600", children: "This school has no classes yet, so students cannot be added or promoted. Add your class list to get started." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setEditingClasses(true),
          className: "rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50",
          children: "Set up classes"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      RosterFilterBar$1,
      {
        filters,
        setFilter,
        clearFilters,
        hasFilters,
        classes
      }
    ),
    /* @__PURE__ */ jsx(
      StudentTable,
      {
        rows,
        loading,
        error,
        meta,
        filters,
        hasFilters,
        selection,
        onSort: (patch) => setFilter(patch),
        onPageChange: (page) => setFilter({ page }, { resetPage: false }),
        onPerPageChange: (perPage) => setFilter({ perPage }),
        onOpenProfile: (student) => setProfileId(student._id || student.id),
        onEdit: (student) => setEditing(student),
        onClearFilters: clearFilters,
        onMessage,
        onRegeneratePayLink,
        onTransferOut: setTransferringOut
      }
    ),
    /* @__PURE__ */ jsx(BulkActionBar, { selection, onDone: bulkHandlers, onError: onBulkError }),
    /* @__PURE__ */ jsx(
      StudentProfileDrawer,
      {
        open: Boolean(profileId),
        studentId: profileId,
        onClose: () => setProfileId(null)
      }
    ),
    /* @__PURE__ */ jsx(
      ClassListEditor,
      {
        open: editingClasses,
        schoolId: user?.schoolId,
        classes,
        onClose: () => setEditingClasses(false),
        onSaved: onClassesSaved
      }
    ),
    /* @__PURE__ */ jsx(
      StudentForm,
      {
        open: creating,
        classes,
        onClose: () => setCreating(false),
        onSaved
      }
    ),
    /* @__PURE__ */ jsx(
      StudentForm,
      {
        open: Boolean(editing),
        student: editing,
        classes,
        onClose: () => setEditing(null),
        onSaved
      }
    ),
    /* @__PURE__ */ jsx(
      TransferOutDialog,
      {
        open: Boolean(transferringOut),
        student: transferringOut,
        onClose: () => setTransferringOut(null),
        onConfirm: onTransferOut
      }
    )
  ] });
};
const TrendBadge = ({ percent }) => {
  if (percent === null || percent === void 0) return null;
  const up = percent >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return /* @__PURE__ */ jsx(Badge, { tone: up ? "green" : "red", icon: Icon, children: `${up ? "+" : ""}${formatPercent(percent)}` });
};
const UnavailableTile = ({ label, icon: Icon }) => /* @__PURE__ */ jsx(
  Tile,
  {
    label,
    icon: Icon,
    value: /* @__PURE__ */ jsx("span", { className: "text-slate-300", children: "—" }),
    footer: /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-400", children: "Not available — the summary could not be loaded." })
  }
);
const PaymentKpiRow = ({ summary, loading, error }) => {
  if (error || !loading && !summary) {
    return /* @__PURE__ */ jsxs("div", { className: "mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
      /* @__PURE__ */ jsx(UnavailableTile, { label: "Total inflow", icon: Building2 }),
      /* @__PURE__ */ jsx(UnavailableTile, { label: "Mobile money volume", icon: Smartphone }),
      /* @__PURE__ */ jsx(UnavailableTile, { label: "Other networks", icon: Smartphone }),
      /* @__PURE__ */ jsx(UnavailableTile, { label: "Awaiting confirmation", icon: Clock })
    ] });
  }
  const networks = summary?.networks || [];
  const totalInflow = summary?.totalInflow || 0;
  const [leading, ...rest] = [...networks].sort((a, b) => b.amount - a.amount);
  const othersAmount = rest.reduce((sum, n) => sum + (n.amount || 0), 0);
  const othersCount = rest.reduce((sum, n) => sum + (n.count || 0), 0);
  const othersWallets = rest.reduce((sum, n) => sum + (n.wallets || 0), 0);
  const othersLabel = rest.length ? rest.map((n) => n.label.replace(" Money", "")).join(" & ") : "Other networks";
  const awaiting = summary?.awaitingConfirmation || { amount: 0, count: 0 };
  const skeleton = (label, icon) => /* @__PURE__ */ jsx(
    Tile,
    {
      label,
      icon,
      value: /* @__PURE__ */ jsx("span", { className: "inline-block h-7 w-28 animate-pulse rounded bg-slate-100" }),
      footer: /* @__PURE__ */ jsx("div", { className: "h-3 w-32 animate-pulse rounded bg-slate-100" })
    }
  );
  return /* @__PURE__ */ jsx("div", { className: "mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: loading || !summary ? /* @__PURE__ */ jsxs(Fragment, { children: [
    skeleton("Total inflow", Building2),
    skeleton("Mobile money volume", Smartphone),
    skeleton("Other networks", Smartphone),
    skeleton("Awaiting confirmation", Clock)
  ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Total inflow",
        icon: Building2,
        badge: /* @__PURE__ */ jsx(TrendBadge, { percent: summary.trendPercent }),
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: totalInflow }),
        accent: true,
        footer: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            formatCount(summary.totalTransactions),
            " successful transaction",
            summary.totalTransactions === 1 ? "" : "s",
            " collected"
          ] }),
          summary.previousTotalInflow > 0 && /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-400", children: [
            "Previous period ",
            formatCedi(summary.previousTotalInflow)
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: leading?.label ? `${leading.label} volume` : "Mobile money volume",
        icon: Smartphone,
        badge: leading ? /* @__PURE__ */ jsx(Badge, { tone: "amber", dot: "mtn", children: `${formatPercent(leading.sharePercent)} share` }) : null,
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: leading?.amount || 0 }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          formatCount(leading?.wallets || 0),
          " distinct mobile wallet",
          (leading?.wallets || 0) === 1 ? "" : "s"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: othersLabel,
        icon: Smartphone,
        badge: /* @__PURE__ */ jsx(Badge, { tone: "slate", children: `${formatPercent(
          totalInflow ? othersAmount / totalInflow * 100 : 0
        )} share` }),
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: othersAmount }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          formatCount(othersCount),
          " collection",
          othersCount === 1 ? "" : "s",
          " across",
          " ",
          formatCount(othersWallets),
          " wallet",
          othersWallets === 1 ? "" : "s"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Awaiting confirmation",
        icon: Clock,
        badge: /* @__PURE__ */ jsx(Badge, { tone: awaiting.count ? "amber" : "green", children: awaiting.count ? "In progress" : "All settled" }),
        value: /* @__PURE__ */ jsx("span", { className: awaiting.count ? "text-amber-600" : "text-emerald-600", children: formatCediShort(awaiting.amount) }),
        footer: /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: awaiting.count ? `${formatCount(awaiting.count)} transaction${awaiting.count === 1 ? "" : "s"} waiting on a provider callback` : "No payments are waiting on a provider callback" })
      }
    )
  ] }) });
};
const DEBOUNCE_MS = 300;
const PERIODS = [
  { value: "month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "", label: "All time" }
];
const toIso = (date) => date.toISOString().slice(0, 10);
const periodToRange = (value, today2 = /* @__PURE__ */ new Date()) => {
  if (!value) return { startDate: "", endDate: "" };
  const start = new Date(today2);
  if (value === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (value === "30d" ? 29 : 89));
  return { startDate: toIso(start), endDate: toIso(today2) };
};
const rangeToPeriod = ({ startDate, endDate }, today2 = /* @__PURE__ */ new Date()) => {
  if (!startDate && !endDate) return "";
  if (!startDate || !endDate) return "custom";
  const span = Math.round((today2 - new Date(startDate)) / 864e5);
  if (toIso(today2) === endDate) {
    if (span < 29) return "30d";
    if (span < 89) return "90d";
  }
  if (startDate === `${new Date(Date.UTC(today2.getUTCFullYear(), today2.getUTCMonth(), 1))}`.slice(0, 10))
    return "month";
  return "custom";
};
const PaymentFilterBar = ({
  filters,
  setFilter,
  clearFilters,
  hasFilters,
  classes = [],
  summary,
  onRefresh,
  refreshing = false
}) => {
  const [term, setTerm] = useState(filters.search);
  useEffect(() => setTerm(filters.search), [filters.search]);
  useEffect(() => {
    if (term === filters.search) return void 0;
    const timer = setTimeout(() => setFilter({ q: term }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, filters.search, setFilter]);
  const period = useMemo(() => rangeToPeriod(filters), [filters.startDate, filters.endDate]);
  const chips = useMemo(() => {
    const networks = (summary?.networks || []).filter((n) => n.count > 0).map((n) => ({
      key: `network:${n.network}`,
      label: n.label,
      count: n.count,
      active: filters.network === n.network,
      apply: () => setFilter({ network: n.network, paymentMethod: "" })
    }));
    const nonMomo = (summary?.byMethod || []).filter((m) => m.method && m.method !== "momo" && m.count > 0).map((m) => ({
      key: `method:${m.method}`,
      label: m.label,
      count: m.count,
      active: filters.paymentMethod === m.method,
      apply: () => setFilter({ paymentMethod: m.method, network: "" })
    }));
    return [
      {
        key: "all",
        label: "All inflows",
        count: summary?.totalTransactions || 0,
        active: !filters.network && !filters.paymentMethod,
        apply: () => setFilter({ network: "", paymentMethod: "" })
      },
      ...networks,
      ...nonMomo
    ];
  }, [summary, filters.network, filters.paymentMethod, setFilter]);
  return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "mb-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-end", children: [
      /* @__PURE__ */ jsxs("div", { className: "relative lg:max-w-sm lg:flex-1", children: [
        /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: "payments-search",
            className: "mb-0.5 block text-[11px] font-semibold text-slate-700",
            children: "Search"
          }
        ),
        /* @__PURE__ */ jsx(
          Search,
          {
            className: "pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400",
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            id: "payments-search",
            type: "search",
            value: term,
            onChange: (event) => setTerm(event.target.value),
            placeholder: "Transaction ref, receipt no. or student…",
            className: "h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Period",
          value: period,
          onChange: (event) => setFilter(periodToRange(event.target.value)),
          className: "lg:w-44",
          children: [
            PERIODS.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.label)),
            period === "custom" && /* @__PURE__ */ jsx("option", { value: "custom", children: "Custom range" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Channel",
          value: filters.network,
          onChange: (event) => setFilter({ network: event.target.value, paymentMethod: "" }),
          className: "lg:w-44",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All Channels" }),
            (summary?.networks || []).map((network) => /* @__PURE__ */ jsx("option", { value: network.network, children: network.label }, network.network))
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Status",
          value: filters.status,
          onChange: (event) => setFilter({ status: event.target.value }),
          className: "lg:w-40",
          children: [
            /* @__PURE__ */ jsx("option", { value: "all", children: "All statuses" }),
            /* @__PURE__ */ jsx("option", { value: "completed", children: "Completed" }),
            /* @__PURE__ */ jsx("option", { value: "processing", children: "Processing" }),
            /* @__PURE__ */ jsx("option", { value: "pending", children: "Pending" }),
            /* @__PURE__ */ jsx("option", { value: "failed", children: "Failed" }),
            /* @__PURE__ */ jsx("option", { value: "refunded", children: "Refunded" }),
            /* @__PURE__ */ jsx("option", { value: "cancelled", children: "Cancelled" })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Class",
          value: filters.class,
          onChange: (event) => setFilter({ class: event.target.value }),
          className: "lg:w-40",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All Classes" }),
            classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
          ]
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onRefresh,
          disabled: refreshing,
          "aria-label": "Refresh transactions",
          title: "Refresh",
          className: "mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50",
          children: /* @__PURE__ */ jsx(RefreshCw, { className: `h-4 w-4 ${refreshing ? "animate-spin" : ""}`, "aria-hidden": "true" })
        }
      )
    ] }),
    chips.length > 1 && /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3", children: [
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: [
        /* @__PURE__ */ jsx(Wallet, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
        "Batches"
      ] }),
      chips.map((chip) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: chip.apply,
          "aria-pressed": chip.active,
          className: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition-colors ${chip.active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
          children: [
            chip.label,
            /* @__PURE__ */ jsxs("span", { className: chip.active ? "text-brand-100" : "text-slate-400", children: [
              "(",
              formatCount(chip.count),
              ")"
            ] })
          ]
        },
        chip.key
      )),
      hasFilters && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: clearFilters,
          className: "ml-1 text-[11px] font-extrabold text-brand-700 transition-colors hover:text-brand-800",
          children: "Clear filters"
        }
      )
    ] })
  ] });
};
const PaymentFilterBar$1 = React.memo(PaymentFilterBar);
const PAYMENT_STATUS_TONES = {
  completed: "green",
  processing: "blue",
  pending: "amber",
  failed: "red",
  cancelled: "slate",
  refunded: "rose"
};
const PAYMENT_STATUS_LABELS = {
  completed: "Completed",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded"
};
const PaymentStatusBadge = ({ status }) => {
  const key = String(status || "").toLowerCase();
  return /* @__PURE__ */ jsx(Badge, { tone: PAYMENT_STATUS_TONES[key] || "slate", children: PAYMENT_STATUS_LABELS[key] || "Unknown" });
};
const NETWORK_TONES = {
  MTN: "mtn",
  VODAFONE: "telecel",
  AIRTELTELIGO: "at",
  UNKNOWN: "slate"
};
const NETWORK_LABELS = {
  MTN: "MTN MoMo",
  VODAFONE: "Vodafone Cash",
  AIRTELTELIGO: "AT Money",
  UNKNOWN: "Unidentified"
};
const NON_MOMO_LABELS = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  manual: "Manual"
};
const METHOD_ICONS = {
  momo: Smartphone,
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Landmark
};
const PaymentChannelBadge = ({ network, paymentMethod }) => {
  const isMomo = paymentMethod === "momo" || Boolean(network);
  const key = String(network || "").toUpperCase();
  if (isMomo && key && key !== "UNKNOWN") {
    return /* @__PURE__ */ jsx(Badge, { tone: NETWORK_TONES[key] || "slate", dot: NETWORK_DOTS[key] ? key.toLowerCase() : void 0, children: NETWORK_LABELS[key] || key });
  }
  const label = NON_MOMO_LABELS[paymentMethod] || "Cash Counter";
  const Icon = METHOD_ICONS[paymentMethod] || Banknote;
  return /* @__PURE__ */ jsx(Badge, { tone: "slate", icon: Icon, children: label });
};
const ACCRA = "Africa/Accra";
const parse = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatDateTime = (value) => {
  const date = parse(value);
  if (!date) return "—";
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: ACCRA,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: ACCRA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
  return `${day}, ${time}`;
};
const formatDate$1 = (value) => {
  const date = parse(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ACCRA,
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
};
const paymentTimestamp = (payment) => payment?.completedAt || payment?.initiatedAt || payment?.createdAt || null;
const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700"
];
const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
const feeItemFor = (payment) => payment.description || "School fees";
const COLUMNS = [
  { key: "paymentId", label: "Transaction ref & time", sortable: true },
  { key: "studentName", label: "Student", sortable: false },
  { key: "studentClass", label: "Class", sortable: false },
  { key: "guardian", label: "Guardian contact", sortable: false },
  { key: "channel", label: "Channel", sortable: false },
  { key: "description", label: "Fee item", sortable: false },
  { key: "amount", label: "Amount", sortable: true },
  // Not sortable. `paymentsQuerySchema` allow-lists `sortBy` and `status` is not
  // on it, so a click here was a 422 in production — a sort control that fails its
  // own request is worse than no control, and "group by status" is the status
  // filter's job anyway.
  { key: "status", label: "Status", sortable: false }
];
const TransactionTable = ({
  rows,
  loading,
  error,
  meta,
  filters,
  onSort,
  onPageChange,
  onPerPageChange,
  onOpenDetail,
  onViewReceipt,
  onRefund,
  onClearFilters,
  hasFilters,
  canRefund
}) => {
  const toggleSort = (key) => {
    if (!key) return;
    if (filters.sortBy === key) {
      onSort({ sortBy: key, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" });
    } else {
      onSort({ sortBy: key, sortOrder: "desc" });
    }
  };
  if (error) {
    return /* @__PURE__ */ jsx(Card, { padding: "p-0", children: /* @__PURE__ */ jsx("div", { className: "p-5", children: /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-red-700", children: error.message }) }) });
  }
  if (!loading && !rows.length) {
    return /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Search,
        title: hasFilters ? "No transactions match these filters" : "No payments recorded yet",
        description: hasFilters ? "Try widening the period, channel or class. A filter that matches nothing usually means the school has not collected that way yet, not that the data is missing." : "Payments appear here as parents pay by Mobile Money, and as you record cash, card or bank transfers at the desk.",
        action: hasFilters && /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClearFilters, children: "Clear filters" })
      }
    );
  }
  return /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[72rem] border-collapse text-left", children: [
      /* @__PURE__ */ jsxs("caption", { className: "sr-only", children: [
        "Payment transactions. ",
        meta?.total ? formatCount(meta.total) : 0,
        " transactions."
      ] }),
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "bg-slate-50", children: [
        COLUMNS.map((column) => /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            "aria-sort": filters.sortBy === column.key ? filters.sortOrder === "asc" ? "ascending" : "descending" : "none",
            className: `whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 ${column.key === "amount" ? "text-right" : ""}`,
            children: column.sortable ? /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => toggleSort(column.key),
                className: `inline-flex items-center gap-1 transition-colors hover:text-ink ${column.key === "amount" ? "flex-row-reverse" : ""}`,
                children: [
                  column.label,
                  filters.sortBy === column.key && (filters.sortOrder === "asc" ? /* @__PURE__ */ jsx(ArrowUp, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(ArrowDown, { className: "h-3.5 w-3.5", "aria-hidden": "true" }))
                ]
              }
            ) : column.label
          },
          column.key
        )),
        /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            className: "w-28 px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wide text-slate-500",
            children: "Actions"
          }
        )
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: loading ? Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: COLUMNS.length + 1, className: "px-4 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, `skeleton-${index}`)) : rows.map((payment, index) => {
        const id = String(payment._id || payment.paymentId);
        const student = payment.studentId || {};
        const guardian = (student.parents || [])[0] || null;
        const isRefund = Number(payment.amount) < 0;
        return /* @__PURE__ */ jsxs(
          "tr",
          {
            className: "border-t border-slate-100 transition-colors hover:bg-slate-50/70",
            children: [
              /* @__PURE__ */ jsx("th", { scope: "row", className: "px-4 py-3 font-normal", children: /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => onOpenDetail(payment),
                  className: "text-left",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "block whitespace-nowrap text-[13px] font-extrabold text-ink hover:text-brand-700", children: payment.paymentId }),
                    /* @__PURE__ */ jsx("span", { className: "block whitespace-nowrap text-[11px] font-semibold text-slate-500", children: formatDateTime(paymentTimestamp(payment)) })
                  ]
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${AVATAR_TONES[index % AVATAR_TONES.length]}`,
                    "aria-hidden": "true",
                    children: initials(student.studentName)
                  }
                ),
                /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName || "Unknown student" }),
                  /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-500", children: student.studentId || "—" })
                ] })
              ] }) }),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: student.studentClass ? /* @__PURE__ */ jsx("span", { className: "inline-block rounded-md bg-slate-100 px-2 py-1 text-[12px] font-extrabold text-slate-700", children: student.studentClass }) : /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-400", children: "—" }) }),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: guardian ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-bold text-ink", children: guardian.parentName }),
                /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold tabular-nums text-slate-500", children: formatGhanaPhone(guardian.phone) })
              ] }) : /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-400", children: "—" }) }),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: /* @__PURE__ */ jsx(
                PaymentChannelBadge,
                {
                  network: payment.momoNetwork,
                  paymentMethod: payment.paymentMethod
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[13px] font-semibold text-slate-700", children: [
                /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: `h-1.5 w-1.5 shrink-0 rounded-full ${isRefund ? "bg-red-400" : "bg-emerald-500"}`,
                    "aria-hidden": "true"
                  }
                ),
                /* @__PURE__ */ jsx("span", { className: "line-clamp-1", title: feeItemFor(payment), children: feeItemFor(payment) })
              ] }) }),
              /* @__PURE__ */ jsx(
                "td",
                {
                  className: `whitespace-nowrap px-4 py-3 text-right text-[13px] font-extrabold tabular-nums ${isRefund ? "text-red-600" : "text-ink"}`,
                  children: isRefund ? `−${formatCedis(Math.abs(payment.amount))}` : formatCedis(payment.amount)
                }
              ),
              /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-4 py-3", children: /* @__PURE__ */ jsx(PaymentStatusBadge, { status: payment.status }) }),
              /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onViewReceipt(payment),
                    "aria-label": `View the receipt for ${payment.paymentId}`,
                    title: "View receipt",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(Receipt, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onOpenDetail(payment),
                    "aria-label": `Open the details of ${payment.paymentId}`,
                    title: "View details",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700",
                    children: /* @__PURE__ */ jsx(Eye, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                ),
                canRefund && payment.status === "completed" && /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onRefund(payment),
                    "aria-label": `Refund ${payment.paymentId}`,
                    title: "Refund this payment",
                    className: "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600",
                    children: /* @__PURE__ */ jsx(RotateCcw, { className: "h-4 w-4", "aria-hidden": "true" })
                  }
                )
              ] }) })
            ]
          },
          id
        );
      }) })
    ] }) }),
    meta?.total > 0 && /* @__PURE__ */ jsx(
      Pagination$1,
      {
        meta,
        onPageChange,
        onPerPageChange,
        itemLabel: "transactions"
      }
    )
  ] });
};
const Row = ({ label, value, mono = false }) => /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4 border-b border-slate-50 py-2 last:border-b-0", children: [
  /* @__PURE__ */ jsx("dt", { className: "shrink-0 text-[11px] font-semibold text-slate-500", children: label }),
  /* @__PURE__ */ jsx(
    "dd",
    {
      className: `min-w-0 break-words text-right text-[13px] font-bold text-ink ${mono ? "font-mono text-[12px]" : ""}`,
      children: value || "—"
    }
  )
] });
const PaymentDetailDrawer = ({ paymentId, onClose, onRefund }) => {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!paymentId) return void 0;
    let active = true;
    setLoading(true);
    setError(null);
    getPayment(paymentId).then((result) => {
      if (active) setPayment(result);
    }).catch((apiError) => {
      if (active) setError(apiError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [paymentId]);
  useEffect(() => {
    if (!paymentId) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [paymentId, onClose]);
  if (!paymentId) return null;
  const student = payment?.studentId || {};
  const school = payment?.schoolId || {};
  const guardians = student.parents || [];
  const isRefund = Number(payment?.amount) < 0;
  return createPortal(
    /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[95] flex justify-end", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-0 bg-ink/50 backdrop-blur-sm",
          onClick: onClose,
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsxs(
        "aside",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Payment details",
          className: "relative flex h-full w-full max-w-md flex-col bg-white shadow-soft",
          children: [
            /* @__PURE__ */ jsxs("header", { className: "flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Transaction" }),
                /* @__PURE__ */ jsx("h2", { className: "truncate text-base font-extrabold tracking-tight text-ink", children: payment?.paymentId || paymentId })
              ] }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: onClose,
                  "aria-label": "Close payment details",
                  className: "-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700",
                  children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-y-auto px-5 py-5", children: [
              loading && /* @__PURE__ */ jsx("div", { className: "space-y-3", children: Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ jsx("div", { className: "h-10 animate-pulse rounded-lg bg-slate-100" }, index)) }),
              !loading && error && /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2.5", children: /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-red-700", children: error.message }) }),
              !loading && !error && payment && /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
                /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-4", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: isRefund ? "Refunded" : "Amount received" }),
                  /* @__PURE__ */ jsx(
                    "p",
                    {
                      className: `mt-1 text-2xl font-extrabold tracking-tight tabular-nums ${isRefund ? "text-red-600" : "text-ink"}`,
                      children: isRefund ? `−${formatCedi(Math.abs(payment.amount))}` : formatCedi(payment.amount)
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
                    /* @__PURE__ */ jsx(PaymentStatusBadge, { status: payment.status }),
                    /* @__PURE__ */ jsx(
                      PaymentChannelBadge,
                      {
                        network: payment.momoNetwork,
                        paymentMethod: payment.paymentMethod
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("section", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Payment" }),
                  /* @__PURE__ */ jsxs("dl", { children: [
                    /* @__PURE__ */ jsx(Row, { label: "Date", value: formatDateTime(paymentTimestamp(payment)) }),
                    /* @__PURE__ */ jsx(Row, { label: "Method", value: payment.paymentMethod }),
                    /* @__PURE__ */ jsx(Row, { label: "Provider", value: payment.provider }),
                    /* @__PURE__ */ jsx(Row, { label: "Network", value: payment.momoNetwork }),
                    /* @__PURE__ */ jsx(Row, { label: "Transaction ref", value: payment.paymentId, mono: true }),
                    /* @__PURE__ */ jsx(Row, { label: "Gateway reference", value: payment.hubtelTransactionId, mono: true }),
                    /* @__PURE__ */ jsx(Row, { label: "Receipt", value: payment.receiptNumber, mono: true }),
                    /* @__PURE__ */ jsx(Row, { label: "Description", value: payment.description }),
                    payment.failureReason && /* @__PURE__ */ jsx(Row, { label: "Failure reason", value: payment.failureReason }),
                    payment.refundedAt && /* @__PURE__ */ jsx(Row, { label: "Refunded on", value: formatDateTime(payment.refundedAt) })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("section", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Student" }),
                  /* @__PURE__ */ jsxs("dl", { children: [
                    /* @__PURE__ */ jsx(Row, { label: "Name", value: student.studentName }),
                    /* @__PURE__ */ jsx(Row, { label: "Student ID", value: student.studentId, mono: true }),
                    /* @__PURE__ */ jsx(Row, { label: "Class", value: student.studentClass })
                  ] }),
                  guardians.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-1", children: guardians.map((guardian) => /* @__PURE__ */ jsxs(
                    "li",
                    {
                      className: "flex items-center justify-between gap-3 text-[12px]",
                      children: [
                        /* @__PURE__ */ jsxs("span", { className: "font-semibold text-slate-600", children: [
                          guardian.parentName,
                          guardian.isPrimary && /* @__PURE__ */ jsx("span", { className: "ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-800", children: "Primary" })
                        ] }),
                        /* @__PURE__ */ jsx("span", { className: "font-semibold tabular-nums text-ink", children: formatGhanaPhone(guardian.phone) })
                      ]
                    },
                    `${guardian.parentName}-${guardian.phone}`
                  )) })
                ] }),
                school.name && /* @__PURE__ */ jsxs("section", { children: [
                  /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "School" }),
                  /* @__PURE__ */ jsxs("dl", { children: [
                    /* @__PURE__ */ jsx(Row, { label: "Name", value: school.name }),
                    /* @__PURE__ */ jsx(Row, { label: "Code", value: school.schoolCode, mono: true })
                  ] })
                ] }),
                student.studentId && /* @__PURE__ */ jsxs(
                  Link,
                  {
                    to: `${ROUTES.DASHBOARD_STUDENTS}?q=${encodeURIComponent(student.studentId)}`,
                    className: "inline-flex items-center gap-1.5 text-[13px] font-extrabold text-brand-700 transition-colors hover:text-brand-800",
                    children: [
                      "Open ",
                      student.studentName || "this student",
                      " on the roster",
                      /* @__PURE__ */ jsx(ExternalLink, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
                    ]
                  }
                )
              ] })
            ] }),
            payment?.status === "completed" && onRefund && /* @__PURE__ */ jsx("footer", { className: "border-t border-slate-100 px-5 py-4", children: /* @__PURE__ */ jsxs(
              Button,
              {
                variant: "danger",
                className: "w-full",
                onClick: () => onRefund(payment),
                children: [
                  /* @__PURE__ */ jsx(RotateCcw, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }),
                  "Refund this payment"
                ]
              }
            ) })
          ]
        }
      )
    ] }),
    document.body
  );
};
const studentName = (payment) => {
  const student = payment.studentId || {};
  return student.studentName ? `${student.studentName}'s balance` : "the student";
};
const RefundPaymentDialog = ({ open, payment, onClose, onRefunded }) => {
  const [amount, setAmount] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !payment) return;
    setAmount(payment.amount ?? null);
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open, payment]);
  if (!open || !payment) return null;
  const overRefunding = amount !== null && amount > payment.amount;
  const invalid = !reason.trim() || !amount || amount < 1 || overRefunding;
  const isFull = amount === payment.amount;
  const submit = async (event) => {
    event.preventDefault();
    if (invalid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await refundPayment(payment.paymentId, { amount, reason: reason.trim() });
      onRefunded?.(payment);
    } catch (apiError) {
      setError(apiError);
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose,
      title: "Refund this payment",
      description: `${payment.paymentId} · ${studentName(payment)} · taken ${formatDateTime(
        paymentTimestamp(payment)
      )}`,
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, disabled: submitting, children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { variant: "danger", onClick: submit, disabled: invalid || submitting, children: submitting ? "Refunding…" : isFull ? `Refund the full ${formatCedi(payment.amount)}` : `Refund ${amount ? formatCedi(amount) : "—"}` })
      ] }),
      children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
        /* @__PURE__ */ jsx(FormAlert, { tone: "warning", children: /* @__PURE__ */ jsxs("span", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("span", { children: "Refunding returns the money to the student's balance and writes a reversing entry against this payment. It does not move money back to the parent — that is a separate transfer the bursar makes." })
        ] }) }),
        /* @__PURE__ */ jsx(
          MoneyInput,
          {
            label: "Amount to refund",
            hint: `of ${formatCedi(payment.amount)} taken`,
            value: amount,
            onChange: setAmount,
            disabled: submitting,
            required: true,
            error: overRefunding ? "A refund cannot be larger than the payment it reverses." : !amount ? "Enter the amount to refund." : void 0
          }
        ),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Reason",
            hint: "Recorded in the activity log",
            value: reason,
            onChange: (event) => setReason(event.target.value),
            disabled: submitting,
            required: true,
            error: !reason.trim() && reason.length > 0 ? "A reason is required." : void 0,
            placeholder: "Cheque bounced, duplicate payment, wrong student…"
          }
        ),
        /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: error?.message })
      ] })
    }
  );
};
const ReceiptDialog = ({ open, paymentId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !paymentId) return void 0;
    let active = true;
    setLoading(true);
    setError(null);
    setReceipt(null);
    getReceipt(paymentId).then((result) => {
      if (active) setReceipt(result);
    }).catch((apiError) => {
      if (active) setError(apiError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, paymentId]);
  if (!open) return null;
  const student = receipt?.student || {};
  const school = receipt?.school || {};
  const breakdown = Array.isArray(receipt?.feesBreakdown) ? receipt.feesBreakdown : [];
  return /* @__PURE__ */ jsxs(
    Modal,
    {
      open,
      onClose,
      title: "Payment receipt",
      description: receipt?.receiptNumber ? `Receipt ${receipt.receiptNumber}` : void 0,
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: "Close" }),
        /* @__PURE__ */ jsxs(Button, { onClick: () => window.print(), disabled: !receipt, children: [
          /* @__PURE__ */ jsx(Printer, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }),
          "Print"
        ] })
      ] }),
      children: [
        loading && /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-lg bg-slate-100" }),
        !loading && error && /* @__PURE__ */ jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2.5", children: /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-red-700", children: error.message }) }),
        !loading && !error && receipt && /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: school.name || "School" }),
            school.address && /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: school.address }),
            school.city && /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: [school.city, school.region].filter(Boolean).join(", ") })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-100 bg-slate-50 p-4", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Amount received" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-2xl font-extrabold tracking-tight tabular-nums text-ink", children: formatCedi(receipt.amount) })
          ] }),
          /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Received from" }),
            /* @__PURE__ */ jsxs("dl", { children: [
              /* @__PURE__ */ jsx(Row, { label: "Student", value: student.studentName }),
              /* @__PURE__ */ jsx(Row, { label: "Student ID", value: student.studentId, mono: true }),
              /* @__PURE__ */ jsx(Row, { label: "Class", value: student.studentClass })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Receipt" }),
            /* @__PURE__ */ jsxs("dl", { children: [
              /* @__PURE__ */ jsx(Row, { label: "Receipt number", value: receipt.receiptNumber, mono: true }),
              /* @__PURE__ */ jsx(Row, { label: "Payment ref", value: receipt.paymentId, mono: true }),
              /* @__PURE__ */ jsx(
                Row,
                {
                  label: "Date",
                  value: receipt.date ? `${formatDate$1(receipt.date)} · ${formatDateTime(receipt.date)}` : void 0
                }
              ),
              /* @__PURE__ */ jsx(Row, { label: "Method", value: receipt.paymentMethod }),
              /* @__PURE__ */ jsx(Row, { label: "Description", value: receipt.description })
            ] })
          ] }),
          breakdown.length > 0 && /* @__PURE__ */ jsxs("section", { children: [
            /* @__PURE__ */ jsx("h3", { className: "mb-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "What it paid for" }),
            /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: breakdown.map((line, index) => /* @__PURE__ */ jsxs(
              "li",
              {
                className: "flex items-center justify-between gap-3 py-2 text-[13px]",
                children: [
                  /* @__PURE__ */ jsx("span", { className: "font-semibold text-slate-700", children: line.description || line.label || "Fee item" }),
                  /* @__PURE__ */ jsx("span", { className: "font-extrabold tabular-nums text-ink", children: formatCedi(line.amount) })
                ]
              },
              `${line.description || line.label || "item"}-${index}`
            )) })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "border-t border-slate-100 pt-3 text-center text-[11px] font-semibold text-slate-400", children: "Thank you. Please keep this receipt for your records." })
        ] })
      ]
    }
  );
};
const maskAccount = (accountNumber) => {
  const digits = String(accountNumber || "").replace(/\s+/g, "");
  if (!digits) return null;
  return `••••${digits.slice(-4)}`;
};
const GATEWAY_LABELS = {
  hubtel: "Hubtel",
  arke: "Arke",
  mnotify: "MNotify",
  manual: "recorded manually"
};
const SettlementBand = ({ school }) => {
  const payment = school?.payment || {};
  const account = payment.bankAccount || {};
  const masked = maskAccount(account.accountNumber);
  return /* @__PURE__ */ jsx(
    "section",
    {
      className: "mt-4 rounded-2xl bg-ink px-5 py-4 text-white",
      "aria-label": "Collection account",
      children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              "aria-hidden": "true",
              className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white",
              children: /* @__PURE__ */ jsx(Building2, { className: "h-5 w-5" })
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsx("h2", { className: "text-sm font-extrabold", children: "Collection account" }),
              payment.gatewayMode && GATEWAY_LABELS[payment.gatewayMode] && /* @__PURE__ */ jsxs(Badge, { tone: "green", children: [
                "Paid in via ",
                GATEWAY_LABELS[payment.gatewayMode]
              ] }),
              /* @__PURE__ */ jsx(Badge, { tone: "amber", icon: Info, children: "No automated sweep" })
            ] }),
            masked ? /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[13px] font-semibold text-white/80", children: [
              account.bankName || "Bank account",
              account.accountName ? ` · ${account.accountName}` : "",
              " ·",
              " ",
              /* @__PURE__ */ jsx("span", { className: "tabular-nums", children: masked }),
              account.branch ? ` · ${account.branch}` : ""
            ] }) : /* @__PURE__ */ jsx("p", { className: "mt-1 text-[13px] font-semibold text-white/80", children: "No collection account is set on this school yet." }),
            /* @__PURE__ */ jsxs("p", { className: "mt-1.5 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-white/60", children: [
              /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
              /* @__PURE__ */ jsx("span", { children: "Parents pay into this account through the configured gateway, and SukuuPay records each collection against the student's balance. Moving the money off this account is still a manual step — no transfer is initiated by this system." })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          Link,
          {
            to: ROUTES.DASHBOARD_SETTINGS,
            className: "shrink-0 self-start rounded-lg bg-white/95 px-3 py-2 text-[13px] font-extrabold text-ink transition-colors hover:bg-white lg:self-center",
            children: "Payment settings"
          }
        )
      ] })
    }
  );
};
const DEFAULTS = {
  search: "",
  class: "",
  status: "all",
  paymentMethod: "",
  network: "",
  provider: "",
  startDate: "",
  endDate: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  perPage: 20
};
const usePayments = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      search: searchParams.get("q") || DEFAULTS.search,
      class: searchParams.get("class") || DEFAULTS.class,
      status: searchParams.get("status") || DEFAULTS.status,
      paymentMethod: searchParams.get("paymentMethod") || DEFAULTS.paymentMethod,
      network: searchParams.get("network") || DEFAULTS.network,
      provider: searchParams.get("provider") || DEFAULTS.provider,
      startDate: searchParams.get("startDate") || DEFAULTS.startDate,
      endDate: searchParams.get("endDate") || DEFAULTS.endDate,
      sortBy: searchParams.get("sortBy") || DEFAULTS.sortBy,
      sortOrder: searchParams.get("sortOrder") || DEFAULTS.sortOrder,
      page: Number(searchParams.get("page")) || DEFAULTS.page,
      perPage: Number(searchParams.get("perPage")) || DEFAULTS.perPage
    }),
    [searchParams]
  );
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "" && value !== null)
    );
    params.limit = params.perPage;
    delete params.perPage;
    listPayments(params).then((result) => {
      if (!active) return;
      setState({ rows: result.rows, meta: result.meta, loading: false, error: null });
    }).catch((error) => {
      if (!active) return;
      setState({ rows: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0 || value === DEFAULTS[key]) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (filters.search) next.set("q", filters.search);
    setSearchParams(next, { replace: true });
  }, [filters.search, setSearchParams]);
  const hasFilters = Boolean(
    filters.class || filters.status !== DEFAULTS.status || filters.paymentMethod || filters.network || filters.provider || filters.startDate || filters.endDate
  );
  return { ...state, filters, setFilter, clearFilters, hasFilters };
};
const scopeOf = (filters) => ({
  startDate: filters.startDate || void 0,
  endDate: filters.endDate || void 0,
  class: filters.class || void 0,
  network: filters.network || void 0,
  paymentMethod: filters.paymentMethod || void 0
});
const usePaymentSummary = (filters) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scope = useMemo(() => scopeOf(filters), [filters]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPaymentSummary(scope).then((result) => {
      if (active) {
        setSummary(result);
        setLoading(false);
      }
    }).catch((apiError) => {
      if (active) {
        setSummary(null);
        setError(apiError);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [scope]);
  return { summary, loading, error };
};
const Payments = () => {
  const { user, school } = useAuth();
  const { success, error: errorToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const { rows, meta, loading, error, filters, setFilter, clearFilters, hasFilters } = usePayments(reloadKey);
  const { summary, loading: summaryLoading, error: summaryError } = usePaymentSummary(filters);
  const classes = useMemo(
    () => school?.academic?.classes || school?.classes || [],
    [school]
  );
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [refresh]);
  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const { search, class: className, status, network, paymentMethod, startDate, endDate } = filters;
      const { filename } = await exportPayments({
        // `search`, not the `q` this component keeps in the URL. `q` is the
        // roster's URL spelling and this hook's local name; the API parameter is
        // `search`, and `paymentExportQuerySchema` runs with `stripUnknown`, so a
        // `q` is dropped without complaint — the export would silently ignore
        // whatever the bursar had typed.
        search,
        class: className,
        status: status === "all" ? "" : status,
        network,
        paymentMethod,
        startDate,
        endDate
      });
      success(`Exported ${filename}`);
    } catch (apiError) {
      errorToast(apiError.message);
    } finally {
      setExporting(false);
    }
  }, [filters, success, errorToast]);
  const onRecorded = useCallback(() => {
    setRecording(false);
    refresh();
    success("Payment recorded and the student’s balance updated");
  }, [refresh, success]);
  const onRefunded = useCallback(() => {
    setRefundTarget(null);
    setDetailId(null);
    refresh();
    success("Refund recorded and the balance reversed");
  }, [refresh, success]);
  const canRefund = ["super_admin", "school_admin"].includes(user?.role);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Payments & Transactions",
        title: "Payments & Settlements",
        description: "Real-time automated reconciliation across MTN MoMo, Telecel Cash, and Bank settlements via GhiPSS",
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(Button, { variant: "secondary", onClick: onExport, disabled: exporting, children: [
            /* @__PURE__ */ jsx(Download, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }),
            exporting ? "Exporting…" : "Export transactions"
          ] }),
          /* @__PURE__ */ jsxs(Button, { onClick: () => setRecording(true), children: [
            /* @__PURE__ */ jsx(Plus, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }),
            "Record manual / cash payment"
          ] })
        ] })
      }
    ),
    summary && summary.totalTransactions > 0 && /* @__PURE__ */ jsxs("p", { className: "sr-only", role: "status", children: [
      formatCedi(summary.totalInflow),
      " collected across",
      " ",
      formatCount(summary.totalTransactions),
      " transactions."
    ] }),
    /* @__PURE__ */ jsx(PaymentKpiRow, { summary, loading: summaryLoading, error: summaryError }),
    /* @__PURE__ */ jsx(
      PaymentFilterBar$1,
      {
        filters,
        setFilter,
        clearFilters,
        hasFilters,
        classes,
        summary,
        onRefresh,
        refreshing
      }
    ),
    /* @__PURE__ */ jsx(
      TransactionTable,
      {
        rows,
        loading,
        error,
        meta,
        filters,
        onSort: setFilter,
        onPageChange: (page) => setFilter({ page }, { resetPage: false }),
        onPerPageChange: (perPage) => setFilter({ perPage }),
        onOpenDetail: (payment) => setDetailId(payment.paymentId),
        onViewReceipt: (payment) => setReceiptId(payment.paymentId),
        onRefund: (payment) => setRefundTarget(payment),
        onClearFilters: clearFilters,
        hasFilters,
        canRefund
      }
    ),
    /* @__PURE__ */ jsx(SettlementBand, { school }),
    /* @__PURE__ */ jsx(
      RecordManualPaymentDialog,
      {
        open: recording,
        onClose: () => setRecording(false),
        onRecorded
      }
    ),
    /* @__PURE__ */ jsx(
      PaymentDetailDrawer,
      {
        paymentId: detailId,
        onClose: () => setDetailId(null),
        onRefund: (payment) => {
          setDetailId(null);
          setRefundTarget(payment);
        }
      }
    ),
    /* @__PURE__ */ jsx(
      RefundPaymentDialog,
      {
        open: Boolean(refundTarget),
        payment: refundTarget,
        onClose: () => setRefundTarget(null),
        onRefunded
      }
    ),
    /* @__PURE__ */ jsx(ReceiptDialog, { open: Boolean(receiptId), paymentId: receiptId, onClose: () => setReceiptId(null) })
  ] });
};
const ComplianceKpiRow = ({ summary, loading }) => {
  const onTrack = summary?.onTrack ?? 0;
  const approaching = summary?.approachingDue ?? 0;
  const overdue = summary?.overdue ?? 0;
  const active = summary?.activePlans ?? 0;
  const rate = summary?.complianceRate;
  const hasRate = rate !== null && rate !== void 0;
  return /* @__PURE__ */ jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "On Track",
        icon: CheckCircle2,
        accent: "green",
        value: loading ? "—" : formatCount(onTrack),
        valueTone: "text-ink",
        badge: /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600", children: /* @__PURE__ */ jsx(CheckCircle2, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          hasRate ? `${formatPercent(rate)} of active plans` : "No active plans yet",
          " · zero overdue tranches"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Approaching Due (Next 5 Days)",
        icon: TrendingUp,
        accent: "amber",
        value: loading ? "—" : formatCount(approaching),
        valueTone: "text-ink",
        suffix: "students",
        badge: /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600", children: /* @__PURE__ */ jsx(TrendingUp, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          formatCediShort(summary?.approachingInflow ?? 0),
          " expected inflow"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Overdue Installments",
        icon: AlertCircle,
        accent: "red",
        value: loading ? "—" : formatCount(overdue),
        valueTone: "text-red-600",
        suffix: "students",
        badge: /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600", children: /* @__PURE__ */ jsx(AlertCircle, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-red-600", children: [
          formatCediShort(summary?.overdueArrears ?? 0),
          " arrears · immediate action"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Total Active Plans",
        icon: FileText,
        accent: "green",
        value: loading ? "—" : formatCount(active),
        valueTone: "text-emerald-600",
        suffix: "active plans",
        badge: /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600", children: /* @__PURE__ */ jsx(FileText, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          "Covering ",
          formatCediShort(summary?.committedAmount ?? 0),
          " committed"
        ] })
      }
    )
  ] });
};
const BANDS = [
  { key: "onTrack", countKey: "onTrack", valueKey: "onTrackValue", label: "On Track", bar: "bg-brand-700", dot: "bg-brand-700" },
  { key: "approachingDue", countKey: "approachingDue", valueKey: "approachingDueValue", label: "Approaching", bar: "bg-amber-400", dot: "bg-amber-400" },
  { key: "overdue", countKey: "overdue", valueKey: "overdueValue", label: "In Default", bar: "bg-red-600", dot: "bg-red-600" }
];
const TARGET_COMPLIANCE = 95;
const PlanHealthBar = ({ summary, activeFilter, onFilter, loading }) => {
  const active = summary?.activePlans ?? 0;
  const rate = summary?.complianceRate;
  const hasRate = rate !== null && rate !== void 0;
  const segments = BANDS.map((band) => ({
    ...band,
    count: summary?.[band.countKey] ?? 0,
    value: summary?.[band.valueKey] ?? 0,
    // Proportion of the *active* plans. Guarded against a zero denominator: an
    // empty school renders an empty bar, not a NaN-width one.
    share: active ? (summary?.[band.countKey] ?? 0) / active * 100 : 0
  }));
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold tracking-tight text-ink", children: "Schoolwide Plan Health" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px] font-medium text-slate-500", children: "Real-time status aggregate across all active grade tiers" })
      ] }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          role: "group",
          "aria-label": "Filter plans by health",
          className: "inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1",
          children: [
            /* @__PURE__ */ jsx(
              FilterPill,
              {
                active: activeFilter === "all",
                onClick: () => onFilter("all"),
                label: `All Plans (${formatCount(active)})`
              }
            ),
            BANDS.map((band) => /* @__PURE__ */ jsx(
              FilterPill,
              {
                active: activeFilter === band.key,
                onClick: () => onFilter(band.key),
                label: `${band.label} (${formatCount(summary?.[band.countKey] ?? 0)})`
              },
              band.key
            ))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-5", children: active === 0 && !loading ? /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: "No active plans yet. Create one from a student with an outstanding balance and this bar starts to fill." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "flex h-3 w-full overflow-hidden rounded-full bg-slate-100",
          role: "img",
          "aria-label": segments.map((segment) => `${segment.label} ${Math.round(segment.share)}%`).join(", "),
          children: segments.map(
            (segment) => segment.count > 0 ? /* @__PURE__ */ jsx(
              "span",
              {
                className: `${segment.bar} transition-[width] duration-300`,
                style: { width: `${segment.share}%` }
              },
              segment.key
            ) : null
          )
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5", children: [
        segments.map((segment) => /* @__PURE__ */ jsxs(
          "span",
          {
            className: "flex items-center gap-1.5 text-[11px] font-semibold text-slate-600",
            children: [
              /* @__PURE__ */ jsx("span", { className: `h-2 w-2 rounded-full ${segment.dot}`, "aria-hidden": "true" }),
              Math.round(segment.share),
              "% ",
              segment.label,
              " (",
              formatCediShort(segment.value),
              ")"
            ]
          },
          segment.key
        )),
        /* @__PURE__ */ jsxs("span", { className: "ml-auto text-[11px] font-semibold text-slate-500", children: [
          "Target Compliance: ",
          TARGET_COMPLIANCE,
          "%",
          hasRate && /* @__PURE__ */ jsxs("span", { className: rate >= TARGET_COMPLIANCE ? " text-emerald-600" : " text-slate-600", children: [
            " ",
            "· now ",
            formatPercent(rate)
          ] })
        ] })
      ] })
    ] }) })
  ] });
};
const FilterPill = ({ active, onClick, label }) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    onClick,
    "aria-pressed": active,
    className: `rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-colors ${active ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:bg-white/60"}`,
    children: label
  }
);
const ComplianceFilterBar = ({
  filters,
  onFilter,
  onClear,
  hasFilters,
  onRefresh,
  refreshing,
  classes,
  terms,
  resultCount,
  view,
  onViewChange
}) => {
  const [draft, setDraft] = useState(filters.search);
  useEffect(() => {
    setDraft(filters.search);
  }, [filters.search]);
  useEffect(() => {
    if (draft === filters.search) return void 0;
    const timer = setTimeout(() => onFilter({ search: draft }), 350);
    return () => clearTimeout(timer);
  }, [draft, filters.search, onFilter]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "relative min-w-[220px] flex-1", children: [
      /* @__PURE__ */ jsx(
        Search,
        {
          className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "search",
          value: draft,
          onChange: (event) => setDraft(event.target.value),
          placeholder: "Search student name, ID or parent…",
          "aria-label": "Search plans by student name, ID or parent",
          className: "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      SelectControl,
      {
        label: "All Classes",
        value: filters.class,
        onChange: (value) => onFilter({ class: value }),
        options: classes,
        emptyLabel: "All Classes",
        hint: resultCount !== null ? `${formatCount(resultCount)} shown` : null
      }
    ),
    /* @__PURE__ */ jsx(
      SelectControl,
      {
        label: "Current Term",
        value: filters.term,
        onChange: (value) => onFilter({ term: value }),
        options: terms,
        emptyLabel: "All Terms"
      }
    ),
    hasFilters && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: onClear,
        className: "rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
        children: "Clear"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onRefresh,
          disabled: refreshing,
          "aria-label": "Refresh plan compliance",
          className: "rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50",
          children: /* @__PURE__ */ jsx(
            RefreshCw,
            {
              className: `h-4 w-4 ${refreshing ? "animate-spin" : ""}`,
              "aria-hidden": "true"
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs("div", { role: "group", "aria-label": "View mode", className: "inline-flex rounded-xl border border-slate-200 p-0.5", children: [
        /* @__PURE__ */ jsx(
          ViewButton,
          {
            active: view === "table",
            onClick: () => onViewChange("table"),
            label: "Table view",
            children: /* @__PURE__ */ jsx(List, { className: "h-4 w-4", "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ jsx(
          ViewButton,
          {
            active: view === "cards",
            onClick: () => onViewChange("cards"),
            label: "Card view",
            children: /* @__PURE__ */ jsx(LayoutGrid, { className: "h-4 w-4", "aria-hidden": "true" })
          }
        )
      ] })
    ] })
  ] });
};
const ViewButton = ({ active, onClick, label, children }) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    onClick,
    "aria-pressed": active,
    "aria-label": label,
    className: `rounded-[10px] p-2 transition-colors ${active ? "bg-slate-100 text-ink" : "text-slate-400 hover:text-slate-600"}`,
    children
  }
);
const SelectControl = ({ label, value, onChange, options, emptyLabel, hint }) => /* @__PURE__ */ jsxs("div", { className: "relative", children: [
  /* @__PURE__ */ jsxs(
    "select",
    {
      value,
      onChange: (event) => onChange(event.target.value),
      "aria-label": label,
      className: "cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30",
      children: [
        /* @__PURE__ */ jsx("option", { value: "", children: emptyLabel }),
        options.map((option) => /* @__PURE__ */ jsx("option", { value: option, children: option }, option))
      ]
    }
  ),
  /* @__PURE__ */ jsx(
    ChevronDown,
    {
      className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
      "aria-hidden": "true"
    }
  ),
  hint && /* @__PURE__ */ jsx("span", { className: "sr-only", children: hint })
] });
const PlanRowActions = ({ plan, busy, onView, onChase }) => {
  const status = plan.complianceStatus || plan.planStatus;
  const isSettled = ["completed", "cancelled", "expired"].includes(status) || plan.planStatus === "completed";
  const isOverdue = status === "overdue" || status === "defaulted";
  const isDueSoon = status === "approaching_due";
  const isAwaiting = status === "pending_acceptance";
  if (busy) {
    return /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }),
      "Working…"
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
    isOverdue ? /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: onChase,
        className: "inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-red-700",
        children: [
          /* @__PURE__ */ jsx(BellRing, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
          "Push MoMo Chaser"
        ]
      }
    ) : isDueSoon || isAwaiting ? /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: onChase,
        className: "inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-amber-600",
        children: [
          /* @__PURE__ */ jsx(Send, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
          "Send MoMo Prompt"
        ]
      }
    ) : null,
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: onView,
        className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${isSettled ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "border border-slate-300 bg-slate-100 text-ink hover:bg-slate-200"}`,
        children: [
          /* @__PURE__ */ jsx(Eye, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
          "View Schedule"
        ]
      }
    )
  ] });
};
const STATUS_TONES$1 = {
  on_track: "green",
  approaching_due: "amber",
  overdue: "red",
  pending_acceptance: "blue",
  defaulted: "rose",
  completed: "slate"
};
const STATUS_LABELS$1 = {
  on_track: "On Track",
  approaching_due: "Approaching Due",
  overdue: "Overdue",
  pending_acceptance: "Awaiting Acceptance",
  defaulted: "Defaulted",
  completed: "Completed"
};
const daysUntil = (date) => {
  if (!date) return null;
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const todayUtc = Date.UTC(
    (/* @__PURE__ */ new Date()).getUTCFullYear(),
    (/* @__PURE__ */ new Date()).getUTCMonth(),
    (/* @__PURE__ */ new Date()).getUTCDate()
  );
  const dueUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((dueUtc - todayUtc) / 864e5);
};
const DueDateCell = ({ dueDate, overdue }) => {
  const days = daysUntil(dueDate);
  const date = new Date(dueDate);
  const formatted = Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const soon = !overdue && days !== null && days <= 2;
  const Icon = overdue ? CalendarX2 : soon ? Clock : CalendarDays;
  return /* @__PURE__ */ jsxs(
    "span",
    {
      className: `inline-flex items-center gap-1.5 text-[12px] font-extrabold ${overdue ? "text-red-600" : soon ? "text-amber-600" : "text-ink"}`,
      children: [
        /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        formatted
      ]
    }
  );
};
const PlanProgressCell = ({ plan }) => {
  const installments = plan.installments || [];
  const paid = installments.filter(
    (installment) => installment.status === "paid" || installment.status === "waived"
  ).length;
  const percent = installments.length ? paid / installments.length * 100 : 0;
  const hasOverdue = installments.some((installment) => installment.status === "overdue");
  return /* @__PURE__ */ jsxs("div", { className: "min-w-[150px]", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[12px] font-extrabold text-ink", children: plan.planName }),
    /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("div", { className: "h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: `h-full rounded-full ${hasOverdue ? "bg-red-600" : "bg-brand-700"}`,
          style: { width: `${percent}%` }
        }
      ) }),
      /* @__PURE__ */ jsxs("span", { className: "shrink-0 text-[11px] font-bold text-slate-500", children: [
        paid,
        " of ",
        installments.length,
        " Paid"
      ] })
    ] })
  ] });
};
const ComplianceStatusCell = ({ plan }) => {
  const status = plan.complianceStatus || plan.planStatus;
  const days = daysUntil(plan.nextInstallment?.dueDate);
  let label = STATUS_LABELS$1[status] || status;
  if (status === "overdue" && days !== null) {
    label = `Overdue (${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"})`;
  } else if (status === "approaching_due" && days !== null) {
    label = days <= 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`;
  }
  return /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES$1[status] || "slate", children: label });
};
const EmptyRow$1 = ({ colSpan, children }) => /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan, className: "px-4 py-12 text-center text-[12px] font-semibold text-slate-500", children }) });
const ComplianceTable = ({
  rows,
  loading,
  error,
  hasFilters,
  onView,
  onChase,
  onViewSchedule,
  busyPlanId,
  onSort,
  sortBy,
  sortOrder
}) => /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[900px] border-collapse", children: [
  /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "border-b border-slate-100 text-left", children: [
    { key: null, label: "Student" },
    { key: null, label: "Class & ID" },
    { key: null, label: "Plan Progress" },
    { key: "endDate", label: "Next Due Date" },
    { key: "totalAmount", label: "Tranche Amount" },
    { key: "complianceStatus", label: "Compliance Status" },
    { key: null, label: "Action" }
  ].map((column) => /* @__PURE__ */ jsx(
    "th",
    {
      scope: "col",
      className: "px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400",
      children: column.key && onSort ? /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => onSort(column.key),
          className: "inline-flex items-center gap-1 hover:text-slate-600",
          children: [
            column.label,
            sortBy === column.key && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: sortOrder === "asc" ? "↑" : "↓" })
          ]
        }
      ) : column.label
    },
    column.label
  )) }) }),
  /* @__PURE__ */ jsxs("tbody", { children: [
    loading && /* @__PURE__ */ jsx(EmptyRow$1, { colSpan: 7, children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
      "Loading plan compliance…"
    ] }) }),
    !loading && error && /* @__PURE__ */ jsx(EmptyRow$1, { colSpan: 7, children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 text-red-600", children: [
      /* @__PURE__ */ jsx(AlertCircle, { className: "h-4 w-4", "aria-hidden": "true" }),
      error.message
    ] }) }),
    !loading && !error && !rows.length && /* @__PURE__ */ jsx(EmptyRow$1, { colSpan: 7, children: hasFilters ? "No plans match these filters." : "No payment plans yet. Create one from a student with an outstanding balance to start tracking compliance." }),
    !loading && !error && rows.map((plan) => {
      const student = plan.student || {};
      const next = plan.nextInstallment;
      const outstanding = next ? Math.max(next.amount - (next.amountPaid || 0), 0) : 0;
      const isOverdue = plan.complianceStatus === "overdue";
      return /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 last:border-0 hover:bg-slate-50/60", children: [
        /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: student.studentName || "Unknown student" }),
          student.parentName && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            "Parent: ",
            student.parentName
          ] })
        ] }),
        /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-extrabold text-ink", children: student.studentClass || "—" }),
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: student.studentId })
        ] }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(PlanProgressCell, { plan }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: next ? /* @__PURE__ */ jsx(DueDateCell, { dueDate: next.dueDate, overdue: isOverdue }) : /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-400", children: plan.planStatus === "completed" ? "Fully settled" : "—" }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(
          "span",
          {
            className: `text-[13px] font-extrabold ${isOverdue ? "text-red-600" : "text-ink"}`,
            children: formatCedi(outstanding || plan.totalAmount || 0)
          }
        ) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(ComplianceStatusCell, { plan }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(
          PlanRowActions,
          {
            plan,
            busy: busyPlanId === plan._id,
            onView: () => onViewSchedule(plan),
            onChase: () => onChase(plan)
          }
        ) })
      ] }, plan._id);
    })
  ] })
] }) });
const INTERVALS = [
  { value: "weekly", label: "Weekly", hint: "Every 7 days" },
  { value: "biweekly", label: "Fortnightly", hint: "Every 14 days" },
  { value: "monthly", label: "Monthly", hint: "Recommended for salary workers" }
];
const INSTALLMENT_COUNTS = [2, 3, 4, 6];
const getSchoolCompliance = async (schoolId, params = {}) => {
  if (!schoolId) throw new Error("A school must be in scope to read plan compliance.");
  try {
    const { data } = await api.get(`/payment-plans/school/${schoolId}/compliance`, {
      params,
      timeout: 2e4
    });
    return {
      summary: data?.data?.summary || null,
      plans: Array.isArray(data?.data?.plans) ? data.data.plans : [],
      meta: data?.meta || null
    };
  } catch (error) {
    throw toApiError(error, "Plan compliance could not be loaded.");
  }
};
const getStudentPlan = async (studentId) => {
  try {
    const { data } = await api.get(`/payment-plans/${encodeURIComponent(studentId)}`);
    return data?.data || null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw toApiError(error, "That student’s payment plan could not be loaded.");
  }
};
const createPaymentPlan = async (studentId, payload) => {
  try {
    const { data } = await api.post(`/payment-plans/create/${encodeURIComponent(studentId)}`, payload, {
      timeout: 2e4
    });
    return { plan: data?.data || null, sms: data?.meta?.sms || null };
  } catch (error) {
    throw toApiError(error, "The payment plan could not be created.");
  }
};
const cancelPaymentPlan = async (planId, reason = "") => {
  try {
    const { data } = await api.delete(`/payment-plans/${encodeURIComponent(planId)}`, {
      data: { reason },
      timeout: 2e4
    });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The payment plan could not be cancelled.");
  }
};
const updateInstallment = async (planId, installmentNumber, payload) => {
  try {
    const { data } = await api.put(
      `/payment-plans/${encodeURIComponent(planId)}/installment/${installmentNumber}`,
      payload,
      { timeout: 2e4 }
    );
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "That installment could not be updated.");
  }
};
const splitAmount = (totalAmount, count) => {
  const n = Number(count);
  if (!n || n < 1) return [];
  const base = Math.floor(totalAmount / n);
  const amounts = Array.from({ length: n }, () => base);
  amounts[n - 1] = totalAmount - base * (n - 1);
  return amounts;
};
const addInterval = (date, interval, steps = 1) => {
  const base = new Date(date);
  const n = Number(steps) || 0;
  if (interval === "weekly") {
    return new Date(base.getTime() + n * 7 * 864e5);
  }
  if (interval === "biweekly") {
    return new Date(base.getTime() + n * 14 * 864e5);
  }
  const dayOfMonth = base.getUTCDate();
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + n,
      1,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
      base.getUTCMilliseconds()
    )
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(dayOfMonth, lastDay));
  return target;
};
const toDateInputValue = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0")
  ].join("-");
};
const endOfThisMonth = () => {
  const now = /* @__PURE__ */ new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
};
const firstOfNextMonth = () => {
  const now = /* @__PURE__ */ new Date();
  return toDateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
};
const today = () => toDateInputValue(/* @__PURE__ */ new Date());
const projectSchedule = ({ totalAmount, numberOfInstallments, startDate, interval }) => {
  const anchor = /* @__PURE__ */ new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime()) || !totalAmount) return [];
  return splitAmount(totalAmount, numberOfInstallments).map((amount, index) => ({
    installmentNumber: index + 1,
    amount,
    dueDate: addInterval(anchor, interval, index)
  }));
};
const STATUS_META = {
  pending: { label: "Pending", tone: "slate", Icon: Clock },
  partial: { label: "Part paid", tone: "blue", Icon: CircleDollarSign },
  paid: { label: "Paid", tone: "green", Icon: CheckCircle2 },
  overdue: { label: "Overdue", tone: "red", Icon: AlertCircle },
  waived: { label: "Waived", tone: "slate", Icon: Ban }
};
const ordinal$1 = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
};
const TrancheRow = ({ installment, plan, onActed, busy }) => {
  const meta = STATUS_META[installment.status] || STATUS_META.pending;
  const { Icon } = meta;
  const outstanding = Math.max((installment.amount || 0) - (installment.amountPaid || 0), 0);
  const due = new Date(installment.dueDate);
  const locked = ["completed", "cancelled", "expired"].includes(plan.planStatus);
  return /* @__PURE__ */ jsxs("li", { className: "relative flex gap-3 pb-5 last:pb-0", children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        "aria-hidden": "true",
        className: "absolute left-[15px] top-8 h-full w-0.5 bg-slate-100"
      }
    ),
    /* @__PURE__ */ jsx(
      "span",
      {
        className: `relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${installment.status === "paid" ? "bg-emerald-100 text-emerald-700" : installment.status === "overdue" ? "bg-red-100 text-red-600" : installment.status === "waived" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600"}`,
        children: /* @__PURE__ */ jsx(Icon, { className: "h-4 w-4" })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-ink", children: [
          ordinal$1(installment.installmentNumber),
          " Installment",
          installment.installmentNumber === plan.numberOfInstallments && " (Final)"
        ] }),
        /* @__PURE__ */ jsx("span", { className: "text-[14px] font-extrabold tabular-nums text-ink", children: formatCedi(installment.amount) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          "Due:",
          " ",
          Number.isNaN(due.getTime()) ? "—" : due.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
          })
        ] }),
        /* @__PURE__ */ jsx(Badge, { tone: meta.tone, children: meta.label }),
        outstanding > 0 && installment.status !== "paid" && /* @__PURE__ */ jsxs("span", { className: "text-red-600", children: [
          formatCedi(outstanding),
          " outstanding"
        ] })
      ] }),
      installment.notes && /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-medium italic text-slate-500", children: installment.notes }),
      !locked && /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-1.5", children: [
        installment.status === "paid" || installment.status === "waived" ? /* @__PURE__ */ jsx(
          ActionButton,
          {
            onClick: () => onActed(plan._id, installment.installmentNumber, { action: "mark_unpaid" }),
            disabled: busy,
            label: "Reopen as unpaid"
          }
        ) : /* @__PURE__ */ jsx(
          ActionButton,
          {
            primary: true,
            onClick: () => onActed(plan._id, installment.installmentNumber, { action: "mark_paid" }),
            disabled: busy,
            label: "Mark paid at desk",
            icon: HandCoins
          }
        ),
        installment.status !== "waived" && /* @__PURE__ */ jsx(
          ActionButton,
          {
            onClick: () => onActed(plan._id, installment.installmentNumber, { action: "waive" }),
            disabled: busy,
            label: "Waive"
          }
        )
      ] })
    ] })
  ] });
};
const ActionButton = ({ primary, icon: Icon, label, onClick, disabled }) => /* @__PURE__ */ jsxs(
  "button",
  {
    type: "button",
    onClick,
    disabled,
    className: `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors disabled:opacity-50 ${primary ? "bg-brand-700 text-white hover:bg-brand-800" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`,
    children: [
      Icon && /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
      label
    ]
  }
);
const PlanScheduleDrawer = ({ plan, open, onClose, onChanged }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  if (!plan) return null;
  const student = plan.student || {};
  const installments = [...plan.installments || []].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );
  const paidCount = installments.filter(
    (installment) => installment.status === "paid" || installment.status === "waived"
  ).length;
  const cancellable = ["active", "pending_acceptance"].includes(plan.planStatus);
  const act = async (planId, installmentNumber, payload) => {
    setBusy(true);
    try {
      const updated = await updateInstallment(planId, installmentNumber, payload);
      toast.success(
        payload.action === "mark_paid" ? "Tranche marked paid. No payment record was created — record it in Payments for the collections total." : "Tranche updated."
      );
      onChanged(updated);
    } catch (error) {
      toast.error(error?.message || "That tranche could not be updated.");
    } finally {
      setBusy(false);
    }
  };
  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelPaymentPlan(plan._id, cancelReason.trim());
      toast.success("Plan cancelled. The record stays readable for the family’s history.");
      setCancelling(false);
      setCancelReason("");
      onClose();
      onChanged(null);
    } catch (error) {
      toast.error(error?.message || "The plan could not be cancelled.");
      setCancelling(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open,
        onClose,
        size: "lg",
        title: plan.planName,
        description: `${student.studentName || "Student"} · ${student.studentClass || "—"} · ${student.studentId || ""}`,
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          cancellable && /* @__PURE__ */ jsx(
            Button,
            {
              variant: "danger",
              onClick: () => setCancelling(true),
              disabled: busy,
              className: "mr-auto",
              children: "Cancel plan"
            }
          ),
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: "Close" })
        ] }),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsx(Figure, { label: "Plan total", value: formatCedi(plan.totalAmount), icon: Wallet }),
            /* @__PURE__ */ jsx(
              Figure,
              {
                label: "Outstanding",
                value: formatCedis(plan.outstandingAmount ?? plan.totalRemaining ?? 0),
                icon: CircleDollarSign,
                tone: (plan.outstandingAmount ?? 0) > 0 ? "text-red-600" : "text-emerald-600"
              }
            ),
            /* @__PURE__ */ jsx(
              Figure,
              {
                label: "Tranches settled",
                value: `${formatCount(paidCount)} of ${formatCount(installments.length)}`,
                icon: CheckCircle2
              }
            )
          ] }),
          plan.adminNotes && /* @__PURE__ */ jsx("p", { className: "mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-medium italic text-slate-600", children: plan.adminNotes }),
          /* @__PURE__ */ jsx("p", { className: "mt-5 mb-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Installment timeline" }),
          /* @__PURE__ */ jsx("ul", { children: installments.map((installment) => /* @__PURE__ */ jsx(
            TrancheRow,
            {
              installment,
              plan,
              busy,
              onActed: act
            },
            installment.installmentNumber
          )) }),
          /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-600", children: [
            /* @__PURE__ */ jsx(Send, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400", "aria-hidden": "true" }),
            "Marking a tranche paid settles it against the plan only. It does not create a payment, so the school’s collections total is unchanged — record the money in Payments as well if it was taken at the desk."
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: cancelling,
        onClose: () => setCancelling(false),
        title: "Cancel this payment plan?",
        description: "The schedule stops. Payments already made are not affected.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => setCancelling(false), children: "Keep the plan" }),
          /* @__PURE__ */ jsx(Button, { variant: "danger", onClick: confirmCancel, children: "Cancel the plan" })
        ] }),
        children: [
          /* @__PURE__ */ jsxs("p", { className: "mb-3 text-[13px] font-medium leading-relaxed text-slate-600", children: [
            student.studentName || "This student",
            " will be told the plan has stopped by SMS. The record stays readable so the family can be told why their schedule ended."
          ] }),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Reason (shared with the family)",
              value: cancelReason,
              onChange: (event) => setCancelReason(event.target.value),
              placeholder: "Parent requested a single payment instead"
            }
          )
        ]
      }
    )
  ] });
};
const Figure = ({ label, value, icon: Icon, tone = "text-ink" }) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
  /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: [
    /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
    label
  ] }),
  /* @__PURE__ */ jsx("p", { className: `mt-1 text-[15px] font-extrabold ${tone}`, children: value })
] });
const BroadcastAtRiskModal = ({ open, onClose, onSent }) => {
  const [horizon, setHorizon] = useState(5);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const BODY = "Dear {parentName}, a payment plan installment for {studentName} at {schoolName} is now due. GHC {balance} is outstanding. Please pay securely via MTN MoMo, Telecel Cash or AirtelTigo: {payLink}";
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setSent(null);
      setError(null);
      return void 0;
    }
    let active = true;
    setLoading(true);
    setError(null);
    previewAudience({ type: "at_risk", minBalance: 1, dueSoonDays: horizon }).then((result) => {
      if (active) setPreview(result);
    }).catch((err) => {
      if (active) setError(err);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, horizon]);
  const run = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendBulkSms({
        audience: { type: "at_risk", minBalance: 1, dueSoonDays: horizon },
        body: BODY,
        category: "final_warning"
      });
      setSent(result);
      onSent?.(result);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  const count = preview?.matchCount ?? 0;
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose,
      size: "lg",
      title: sent ? "Chaser queued" : "Chase the at-risk families",
      description: sent ? void 0 : "One SMS to every family with a slipped or imminent installment. This cannot be unsent.",
      footer: sent ? /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: onClose, children: "Done" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "primary",
            onClick: run,
            disabled: sending || loading || count === 0,
            children: sending ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Loader2, { className: "mr-1.5 h-4 w-4 animate-spin", "aria-hidden": "true" }),
              "Queueing…"
            ] }) : `Send to ${formatCount(count)} parents`
          }
        )
      ] }),
      children: sent ? /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-medium leading-relaxed text-slate-600", children: [
          formatCount(sent.job?.recipients ?? 0),
          " reminders queued for",
          " ",
          formatCediShort(sent.job?.creditsCharged ?? 0),
          " of SMS credit.",
          " ",
          formatCount(sent.job?.balanceAfter ?? 0),
          " SMS left."
        ] }),
        /* @__PURE__ */ jsx("p", { className: "rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-600", children: "Track delivery on the SMS Reminders module — the History tab shows each message’s status and refunds any credit the carrier could not deliver." })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        error && /* @__PURE__ */ jsx("p", { role: "alert", className: "mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700", children: error.message }),
        /* @__PURE__ */ jsx("dl", { className: "space-y-2.5 text-[13px]", children: [
          {
            label: "Audience",
            value: "Slipped a tranche, or one is due inside the window"
          },
          { label: "Recipients", value: loading ? "Sizing…" : `${formatCount(count)} parents` },
          { label: "Message", value: "Final Warning (platform preset)" },
          { label: "Arrears in scope", value: formatCediShort(preview?.totalBalance ?? 0) }
        ].map((row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
          /* @__PURE__ */ jsx("dt", { className: "font-medium text-slate-500", children: row.label }),
          /* @__PURE__ */ jsx("dd", { className: "text-right font-extrabold text-ink", children: row.value })
        ] }, row.label)) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
          /* @__PURE__ */ jsx(
            "label",
            {
              className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500",
              htmlFor: "at-risk-horizon",
              children: "Treat a tranche as imminent when due within"
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5", children: [3, 5, 7, 14].map((days) => /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setHorizon(days),
              "aria-pressed": horizon === days,
              className: `rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition-colors ${horizon === days ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`,
              children: [
                days,
                " days"
              ]
            },
            days
          )) })
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-600", children: [
          /* @__PURE__ */ jsx(BellRing, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400", "aria-hidden": "true" }),
          "Parents who paid in the last 48 hours are excluded automatically, so a family that settled this morning is not told it is behind."
        ] }),
        preview?.skipped?.invalid_number > 0 && /* @__PURE__ */ jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700", children: [
          /* @__PURE__ */ jsx(Megaphone, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
          formatCount(preview.skipped.invalid_number),
          " matched famil",
          preview.skipped.invalid_number === 1 ? "y has" : "ies have",
          " a number that will not normalise and will not be reached."
        ] }),
        !loading && count === 0 && /* @__PURE__ */ jsx("p", { className: "mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-800", children: "Nothing is at risk right now — no family has a slipped or imminent installment. That is the good outcome." })
      ] })
    }
  );
};
const SummaryTile = ({ label, value, tone = "text-ink", icon: Icon, note, noteTone = "text-slate-500" }) => /* @__PURE__ */ jsxs("div", { className: "flex-1 rounded-xl bg-slate-50 p-3.5", children: [
  /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: label }),
  /* @__PURE__ */ jsx("p", { className: `mt-1.5 text-[20px] font-extrabold leading-none tracking-tight ${tone}`, children: value }),
  note && /* @__PURE__ */ jsxs("p", { className: `mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${noteTone}`, children: [
    /* @__PURE__ */ jsx(Icon, { className: "h-3 w-3 shrink-0", "aria-hidden": "true" }),
    note
  ] })
] });
const CountPicker = ({ value, onChange, totalCedis }) => /* @__PURE__ */ jsxs("div", { children: [
  /* @__PURE__ */ jsxs("div", { className: "mb-1.5 flex flex-wrap items-center justify-between gap-2", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Number of Installments (Tranches)" }),
    /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
      "Split GH₵ ",
      formatCedis(totalCedis),
      " evenly"
    ] })
  ] }),
  /* @__PURE__ */ jsx(
    "div",
    {
      role: "radiogroup",
      "aria-label": "Number of installments",
      className: "grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-4",
      children: INSTALLMENT_COUNTS.map((count) => {
        const active = value === count;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": active,
            onClick: () => onChange(count),
            className: `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12px] font-extrabold transition-colors ${active ? "bg-brand-700 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-100"}`,
            children: [
              count,
              " Tranches",
              active && /* @__PURE__ */ jsx(Circle, { className: "h-2 w-2 fill-current", "aria-hidden": "true" })
            ]
          },
          count
        );
      })
    }
  )
] });
const IntervalPicker = ({ value, onChange }) => {
  const current = INTERVALS.find((entry) => entry.value === value);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("p", { className: "mb-1.5 text-[13px] font-extrabold text-ink", children: "Payment Frequency / Interval" }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        "select",
        {
          value,
          onChange: (event) => onChange(event.target.value),
          "aria-label": "Payment frequency",
          className: "w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30",
          children: INTERVALS.map((interval) => /* @__PURE__ */ jsxs("option", { value: interval.value, children: [
            interval.label,
            interval.value === "monthly" ? " (Recommended for salary workers)" : ""
          ] }, interval.value))
        }
      ),
      /* @__PURE__ */ jsx(
        ChevronDown,
        {
          className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
          "aria-hidden": "true"
        }
      )
    ] }),
    current && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-slate-500", children: current.hint })
  ] });
};
const StartDatePicker = ({ value, onChange, onPreset }) => /* @__PURE__ */ jsxs("div", { children: [
  /* @__PURE__ */ jsxs("div", { className: "mb-1.5 flex flex-wrap items-center justify-between gap-2", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "First Tranche Due Date" }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: [
      { label: "End of Month", target: "endOfMonth" },
      { label: "Next Payday (1st)", target: "firstOfNextMonth" }
    ].map((preset) => /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => onPreset(preset.target),
        className: "rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
        children: preset.label
      },
      preset.target
    )) })
  ] }),
  /* @__PURE__ */ jsx(
    "input",
    {
      type: "date",
      value,
      onChange: (event) => onChange(event.target.value),
      "aria-label": "First tranche due date",
      className: "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
    }
  ),
  /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-medium text-slate-500", children: "Subsequent installments will calculate sequentially on the same day interval." })
] });
const ReminderControls = ({
  autoCollect,
  setAutoCollect,
  reminderDays,
  setReminderDays,
  reminderTime,
  setReminderTime
}) => /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600", children: /* @__PURE__ */ jsx(CreditCard, { className: "h-4 w-4", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Automatic MoMo Collection Trigger" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px] font-medium leading-snug text-slate-500", children: "Send an automated USSD payment prompt to the parent’s phone on the due date at 8:00 AM. The family authorises the payment on their handset." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "relative inline-flex shrink-0 cursor-pointer items-center", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: autoCollect,
          onChange: (event) => setAutoCollect(event.target.checked),
          className: "peer sr-only"
        }
      ),
      /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          className: `h-6 w-11 rounded-full transition-colors ${autoCollect ? "bg-brand-700" : "bg-slate-200"} peer-focus-visible:ring-2 peer-focus-visible:ring-brand-700/40 peer-focus-visible:ring-offset-2`
        }
      ),
      /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          className: `absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoCollect ? "translate-x-5" : "translate-x-0"}`
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Send an automated MoMo payment prompt on each due date" })
    ] })
  ] }),
  autoCollect && /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3", children: [
    /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 pb-2 text-[12px] font-semibold text-slate-600", children: [
      /* @__PURE__ */ jsx(CreditCard, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" }),
      "Send SMS Reminder Notice"
    ] }),
    /* @__PURE__ */ jsx("label", { className: "text-[11px] font-semibold text-slate-700", children: /* @__PURE__ */ jsx(
      "select",
      {
        value: reminderDays,
        onChange: (event) => setReminderDays(Number(event.target.value)),
        "aria-label": "Days before the due date to send the reminder",
        className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-ink focus:border-brand-700 focus:outline-none",
        children: [1, 2, 3, 5, 7].map((days) => /* @__PURE__ */ jsxs("option", { value: days, children: [
          days,
          " day",
          days === 1 ? "" : "s",
          " before"
        ] }, days))
      }
    ) }),
    /* @__PURE__ */ jsxs("label", { className: "text-[11px] font-semibold text-slate-700", children: [
      /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Reminder time of day" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "time",
          value: reminderTime,
          onChange: (event) => setReminderTime(event.target.value),
          "aria-label": "Reminder time of day",
          className: "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-ink focus:border-brand-700 focus:outline-none"
        }
      )
    ] })
  ] })
] });
const CreatePlanForm = ({
  figures,
  guardian,
  numberOfInstallments,
  setNumberOfInstallments,
  interval,
  setInterval: setInterval2,
  startDate,
  setStartDate,
  onStartDatePreset,
  planName,
  setPlanName,
  adminNotes,
  setAdminNotes,
  autoCollect,
  setAutoCollect,
  reminderDays,
  setReminderDays,
  reminderTime,
  setReminderTime
}) => /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row", children: [
    /* @__PURE__ */ jsx(
      SummaryTile,
      {
        label: "Total Term Fee",
        value: `GH₵ ${formatCedis(figures.totalOwed)}`,
        icon: Wallet,
        note: "Locked at plan creation"
      }
    ),
    /* @__PURE__ */ jsx(
      SummaryTile,
      {
        label: "Paid Deposit",
        value: `GH₵ ${formatCedis(figures.paidDeposit)}`,
        tone: "text-emerald-600",
        icon: CreditCard,
        note: "Verified via MoMo",
        noteTone: "text-emerald-600"
      }
    ),
    /* @__PURE__ */ jsx(
      SummaryTile,
      {
        label: "Balance to Structure",
        value: `GH₵ ${formatCedis(figures.balanceToStructure)}`,
        tone: "text-amber-600",
        icon: Sparkles,
        note: "Deferred Balance",
        noteTone: "text-amber-600"
      }
    )
  ] }),
  /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "space-y-5", children: [
    /* @__PURE__ */ jsx(
      CountPicker,
      {
        value: numberOfInstallments,
        onChange: setNumberOfInstallments,
        totalCedis: figures.balanceToStructure / 100
      }
    ),
    /* @__PURE__ */ jsx(IntervalPicker, { value: interval, onChange: setInterval2 }),
    /* @__PURE__ */ jsx(
      StartDatePicker,
      {
        value: startDate,
        onChange: setStartDate,
        onPreset: onStartDatePreset
      }
    ),
    /* @__PURE__ */ jsx(
      ReminderControls,
      {
        autoCollect,
        setAutoCollect,
        reminderDays,
        setReminderDays,
        reminderTime,
        setReminderTime
      }
    ),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(
        "label",
        {
          className: "mb-1.5 block text-[13px] font-extrabold text-ink",
          htmlFor: "plan-admin-notes",
          children: "Bursar Plan Notes (Internal)"
        }
      ),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          id: "plan-admin-notes",
          value: adminNotes,
          onChange: (event) => setAdminNotes(event.target.value),
          rows: 3,
          placeholder: "E.g., Parent requested alignment with civil service end-of-month payroll schedule.",
          className: "w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-slate-500", children: "Internal only. The family does not see this." })
    ] })
  ] }),
  guardian && /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "flex items-start gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-extrabold text-amber-800", children: (guardian.parentName || "?").slice(0, 2).toUpperCase() }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-ink", children: [
        "Guardian: ",
        guardian.parentName
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
        guardian.phone,
        " (",
        guardian.relationship || "guardian",
        ")"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-[11px] font-semibold leading-relaxed text-slate-500", children: [
        "The family will receive an instant SMS contract notification to approve the installment schedule. They reply ",
        /* @__PURE__ */ jsx("code", { className: "font-extrabold", children: "ACCEPT" }),
        " ",
        "with the 6-character code to activate the plan."
      ] })
    ] })
  ] })
] });
const ORDINALS = ["", "st", "nd", "rd", "th", "th"];
const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${ORDINALS[n % 10] || "th"}`;
};
const formatDue = (date) => Number.isNaN(new Date(date).getTime()) ? "—" : new Date(date).toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
});
const Tranche = ({ tranche, total }) => {
  const isFinal = tranche.installmentNumber === total;
  const Icon = isFinal ? Flag : tranche.installmentNumber === 1 ? CalendarDays : CheckCircle2;
  return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3", children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        className: `flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isFinal ? "bg-ink text-white" : "bg-slate-100 text-slate-500"}`,
        children: /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-extrabold text-ink", children: [
        ordinal(tranche.installmentNumber),
        " Installment",
        isFinal && " (Final)"
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsx(CalendarDays, { className: "h-3 w-3", "aria-hidden": "true" }),
        "Due: ",
        formatDue(tranche.dueDate)
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "shrink-0 text-right", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[14px] font-extrabold tabular-nums text-ink", children: [
        "GH₵ ",
        formatCedis(tranche.amount)
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-semibold text-slate-400", children: [
        "Tranche ",
        tranche.installmentNumber,
        "/",
        total
      ] })
    ] })
  ] });
};
const DepositSplit = ({ figures }) => {
  const total = figures.totalOwed || 0;
  const depositShare = total ? figures.paidDeposit / total * 100 : 0;
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3.5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex h-2.5 w-full overflow-hidden rounded-full bg-white", children: [
      depositShare > 0 && /* @__PURE__ */ jsx("span", { className: "bg-emerald-500", style: { width: `${depositShare}%` } }),
      depositShare < 100 && /* @__PURE__ */ jsx("span", { className: "flex-1 bg-slate-300", style: { width: `${100 - depositShare}%` } })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-bold text-slate-600", children: [
      Math.round(depositShare),
      "% Initial Deposit Settled"
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-extrabold text-ink", children: [
      Math.round(100 - depositShare),
      "% Structured"
    ] })
  ] });
};
const PlanProjection = ({
  projection,
  figures,
  loading,
  planName,
  term,
  academicYear,
  schoolName,
  guardian
}) => {
  const total = projection.length;
  const projected = projection.reduce((sum, tranche) => sum + tranche.amount, 0);
  const balances = projected === figures.balanceToStructure;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("h2", { className: "text-[15px] font-extrabold tracking-tight text-ink", children: "Generated Plan Preview" })
        ] }),
        /* @__PURE__ */ jsx(Badge, { tone: "green", children: "Live Projection" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-xl bg-slate-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "Total To Recover" }),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[26px] font-extrabold leading-none tracking-tight text-ink", children: [
            "GH₵ ",
            formatCedis(figures.balanceToStructure)
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-extrabold text-ink", children: [
            total,
            " Tranche",
            total === 1 ? "" : "s"
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "100% principal" })
        ] })
      ] }) }),
      loading && /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-center gap-2 text-[12px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
        "Loading the student’s balance…"
      ] }),
      !loading && !total && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800", children: "There is no outstanding balance to structure. A plan is written against what a family still owes, not against the full term fee." }),
      total > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-4 space-y-2", children: projection.map((tranche) => /* @__PURE__ */ jsx(Tranche, { tranche, total }, tranche.installmentNumber)) }),
      total > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DepositSplit, { figures }),
        !balances && /* @__PURE__ */ jsxs("p", { className: "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold text-red-700", children: [
          "The tranches add to GH₵ ",
          formatCedis(projected),
          " but the balance is GH₵",
          " ",
          formatCedis(figures.balanceToStructure),
          ". The server will refuse this plan."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600", children: /* @__PURE__ */ jsx(ShieldCheck, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Bank of Ghana & GhIPSS Compliant" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px] font-medium leading-relaxed text-slate-500", children: [
          "Protected escrow clearing guarantees zero reconciliation leakage between MTN MoMo, Telecel Cash, and school accounts.",
          term && academicYear ? ` Applies to ${term} (${academicYear}) at ${schoolName}.` : ""
        ] })
      ] })
    ] }),
    planName && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
      "The plan will be saved as",
      " ",
      /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: planName }),
      "."
    ] })
  ] });
};
const StudentPicker = ({ selected, loading, onSelect, className = "" }) => {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    setFetching(true);
    setError(null);
    listStudents({ feeStatus: "owing", search: search.trim(), perPage: 20 }).then((result) => {
      if (active) setRows(result.rows || []);
    }).catch((err) => {
      if (active) {
        setRows([]);
        setError(err);
      }
    }).finally(() => {
      if (active) setFetching(false);
    });
    return () => {
      active = false;
    };
  }, [search]);
  const owing = useMemo(() => rows.filter((row) => (row.balance || 0) > 0), [rows]);
  if (selected) {
    return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: `flex items-start gap-3 ${className}`, children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-700", children: (selected.studentName || "?").slice(0, 2).toUpperCase() }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[14px] font-extrabold text-ink", children: selected.studentName }),
        /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
          selected.studentClass,
          " · ",
          selected.studentId
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[12px] font-extrabold text-ink", children: [
          "Balance to structure: GH₵ ",
          formatCedis(selected.balance)
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => onSelect(null),
          className: "shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
          children: "Change"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className, children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4 text-slate-400", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Who is this plan for?" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px] font-medium text-slate-500", children: "Only students with an outstanding balance appear. A plan is written against what a family still owes." }),
    /* @__PURE__ */ jsxs("div", { className: "relative mt-3", children: [
      /* @__PURE__ */ jsx(
        Search,
        {
          className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "search",
          value: search,
          onChange: (event) => setSearch(event.target.value),
          placeholder: "Search by student name or ID…",
          "aria-label": "Search students who owe a balance",
          className: "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        }
      )
    ] }),
    fetching && /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-center gap-2 text-[12px] font-semibold text-slate-500", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
      "Searching the roster…"
    ] }),
    !fetching && error && /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700", children: [
      /* @__PURE__ */ jsx(AlertCircle, { className: "h-4 w-4", "aria-hidden": "true" }),
      error.message
    ] }),
    !fetching && !error && !owing.length && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-500", children: search ? "No student matching that name owes a balance." : "Every student is settled. There is nothing to structure." }),
    owing.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-3 max-h-[280px] divide-y divide-slate-100 overflow-y-auto", children: owing.map((row) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => onSelect(row._id),
        className: "flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-slate-50",
        children: [
          /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: row.studentName }),
            /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
              row.studentClass,
              " · ",
              row.studentId
            ] })
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "shrink-0 text-right", children: [
            /* @__PURE__ */ jsxs("span", { className: "block text-[13px] font-extrabold text-ink", children: [
              "GH₵ ",
              formatCedis(row.balance)
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
              "of GH₵ ",
              formatCedis(row.totalOwed)
            ] })
          ] })
        ]
      }
    ) }, row._id)) }),
    /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] font-semibold text-slate-400", children: [
      formatCount(owing.length),
      " student",
      owing.length === 1 ? "" : "s",
      " shown."
    ] })
  ] });
};
const useInstallmentPlans = (reloadKey = 0) => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bump, setBump] = useState(0);
  const fetchKey = reloadKey + bump;
  const filters = useMemo(
    () => ({
      status: searchParams.get("status") || "all",
      class: searchParams.get("class") || "",
      term: searchParams.get("term") || "",
      search: searchParams.get("q") || "",
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 20,
      sortBy: searchParams.get("sortBy") || "endDate",
      sortOrder: searchParams.get("sortOrder") || "asc"
    }),
    [searchParams]
  );
  const hasFilters = filters.status !== "all" || Boolean(filters.class) || Boolean(filters.term) || Boolean(filters.search);
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    ["status", "class", "term", "q", "page"].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return void 0;
    }
    let active = true;
    setLoading(true);
    const params = {
      status: filters.status,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };
    if (filters.class) params.class = filters.class;
    if (filters.term) params.term = filters.term;
    if (filters.search) params.search = filters.search;
    getSchoolCompliance(schoolId, params).then((result) => {
      if (!active) return;
      setSummary(result.summary);
      setRows(result.plans);
      setMeta(result.meta);
      setError(null);
    }).catch((err) => {
      if (!active) return;
      setSummary(null);
      setRows([]);
      setMeta(null);
      setError(err);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [schoolId, filters, fetchKey]);
  return {
    schoolId,
    rows,
    summary,
    meta,
    loading,
    error,
    filters,
    hasFilters,
    setFilter,
    clearFilters,
    /**
     * Re-reads the compliance data.
     *
     * Used after anything that changes a plan's state — a tranche marked paid, a
     * plan cancelled. The reason it forces a refetch rather than patching a row
     * locally: the *summary* also moves, and the summary is the part a bursar
     * trusts. A locally-adjusted row count next to a server-owned compliance rate
     * is how a dashboard ends up showing 79% over a list that says 84%.
     */
    reload: useCallback(() => setBump((key) => key + 1), [])
  };
};
const DEFAULT_REMINDER_DAYS = 3;
const DEFAULT_REMINDER_TIME = "09:00";
const usePlanBuilder = (studentId) => {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [existingPlan, setExistingPlan] = useState(null);
  const [loading, setLoading] = useState(Boolean(studentId));
  const [loadError, setLoadError] = useState(null);
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [interval, setInterval2] = useState("monthly");
  const [startDate, setStartDate] = useState(today);
  const [planName, setPlanName] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [autoCollect, setAutoCollect] = useState(true);
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setExistingPlan(null);
      setLoading(false);
      return void 0;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([getStudentPlan(studentId), getStudent(studentId)]).then(([plan, roster]) => {
      if (!active) return;
      setStudent(roster);
      setExistingPlan(plan?.plan || null);
    }).catch((error) => {
      if (!active) return;
      setStudent(null);
      setLoadError(error);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [studentId]);
  const figures = useMemo(() => {
    const totalOwed = student?.totalOwed ?? 0;
    const balance = student?.balance ?? 0;
    return {
      totalOwed,
      paidDeposit: Math.max(totalOwed - balance, 0),
      balanceToStructure: balance
    };
  }, [student]);
  const projection = useMemo(
    () => projectSchedule({
      totalAmount: figures.balanceToStructure,
      numberOfInstallments,
      startDate,
      interval
    }),
    [figures.balanceToStructure, numberOfInstallments, startDate, interval]
  );
  const totalProjected = useMemo(
    () => projection.reduce((sum, tranche) => sum + tranche.amount, 0),
    [projection]
  );
  const guardian = useMemo(() => {
    const parents = student?.parents || [];
    return parents.find((parent) => parent.isPrimary) || parents[0] || null;
  }, [student]);
  const blocker = useMemo(() => {
    if (!student) return "Pick a student to structure a plan for.";
    if (!figures.balanceToStructure) return "This student has no outstanding balance to structure.";
    if (existingPlan) {
      return `This student already has a ${existingPlan.planStatus?.replace(/_/g, " ")} plan. Cancel it before creating another.`;
    }
    if (!startDate) return "Choose the first tranche due date.";
    if (/* @__PURE__ */ new Date(`${startDate}T00:00:00Z`) < /* @__PURE__ */ new Date(`${today()}T00:00:00Z`)) {
      return "A plan cannot start in the past.";
    }
    if (totalProjected !== figures.balanceToStructure) {
      return "The tranches do not add up to the outstanding balance.";
    }
    return null;
  }, [student, figures.balanceToStructure, existingPlan, startDate, totalProjected]);
  const canSubmit = blocker === null;
  const save = useCallback(async () => {
    if (!studentId) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createPaymentPlan(studentId, {
        numberOfInstallments,
        interval,
        startDate,
        planName: planName.trim() || `${numberOfInstallments}-Month Plan`,
        adminNotes: adminNotes.trim()
      });
      setResult(created);
      toast.success(
        `Plan created for ${student?.studentName || "the student"}. ${created.plan?.numberOfInstallments} tranches scheduled.`
      );
      return created;
    } catch (error) {
      setSaveError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [
    studentId,
    numberOfInstallments,
    interval,
    startDate,
    planName,
    adminNotes,
    student,
    toast
  ]);
  const reset = useCallback(() => {
    setNumberOfInstallments(3);
    setInterval2("monthly");
    setStartDate(today);
    setPlanName("");
    setAdminNotes("");
    setAutoCollect(true);
    setReminderDays(DEFAULT_REMINDER_DAYS);
    setReminderTime(DEFAULT_REMINDER_TIME);
    setSaveError(null);
    setResult(null);
  }, []);
  return {
    // Data
    student,
    guardian,
    existingPlan,
    loading,
    loadError,
    schoolId: student?.schoolId || null,
    // Form
    numberOfInstallments,
    setNumberOfInstallments,
    interval,
    setInterval: setInterval2,
    startDate,
    setStartDate,
    planName,
    setPlanName,
    adminNotes,
    setAdminNotes,
    autoCollect,
    setAutoCollect,
    reminderDays,
    setReminderDays,
    reminderTime,
    setReminderTime,
    // Derived
    figures,
    projection,
    totalProjected,
    blocker,
    canSubmit,
    // Actions
    save,
    saving,
    saveError,
    result,
    reset
  };
};
const TABS$1 = [
  { value: "compliance", label: "Compliance" },
  { value: "create", label: "Create Plan" }
];
const pageWindow = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
};
const InstallmentPlans = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "create" ? "create" : "compliance";
  const setTab = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === "compliance") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };
  const planningFor = searchParams.get("student") || null;
  const plans = useInstallmentPlans();
  const builder = usePlanBuilder(planningFor);
  const [school, setSchool] = useState(null);
  const [view, setView] = useState("table");
  const [drawerPlan, setDrawerPlan] = useState(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!user?.schoolId) return void 0;
    let active = true;
    getSchool(user.schoolId).then((result) => {
      if (active) setSchool(result);
    }).catch(() => {
      if (active) setSchool(null);
    });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);
  const rowsWithParent = plans.rows;
  const classes = useMemo(() => {
    const list = school?.academic?.classes || school?.classes || [];
    return Array.isArray(list) ? list : [];
  }, [school]);
  const terms = useMemo(
    () => [school?.academic?.currentTerm, ...(school?.academic?.termHistory || []).map((t) => t.term)].filter(Boolean).map((term) => typeof term === "string" ? term : term.term).filter((term, index, all) => all.indexOf(term) === index),
    [school]
  );
  const onSort = (key) => {
    const sameColumn = plans.filters.sortBy === key;
    plans.setFilter({
      sortBy: key,
      // Toggling rather than always descending: a bursar who sorted by amount to
      // see the biggest debts clicks again to see the smallest, and a column that
      // only ever sorts one way makes the second click feel broken.
      sortOrder: sameColumn ? plans.filters.sortOrder === "asc" ? "desc" : "asc" : "desc"
    });
  };
  const exportCsv = () => {
    setExporting(true);
    try {
      const header = [
        "Student",
        "Class",
        "Student ID",
        "Parent",
        "Plan",
        "Tranches",
        "Paid",
        "Next Due",
        "Tranche Amount (GHS)",
        "Outstanding (GHS)",
        "Compliance"
      ];
      const lines = rowsWithParent.map((plan) => {
        const student = plan.student || {};
        const next = plan.nextInstallment;
        const paid = (plan.installments || []).filter(
          (installment) => installment.status === "paid" || installment.status === "waived"
        ).length;
        return [
          student.studentName,
          student.studentClass,
          student.studentId,
          student.parentName,
          plan.planName,
          (plan.installments || []).length,
          paid,
          // ISO, not the design's "30 Oct 2026": a CSV is opened in a
          // spreadsheet, where a localised date is a date the spreadsheet will
          // silently re-interpret in its own locale. ISO is unambiguous and sorts
          // lexicographically, which is what a date column should do.
          next ? new Date(next.dueDate).toISOString().slice(0, 10) : "",
          next ? ((next.amount - (next.amountPaid || 0)) / 100).toFixed(2) : "",
          ((plan.outstandingAmount ?? 0) / 100).toFixed(2),
          plan.complianceStatus
        ].map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");
      });
      const csv = [header.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `installment-compliance-page-${plans.filters.page}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.warning(
        `Exported the ${formatCount(lines.length)} plan${lines.length === 1 ? "" : "s"} on this page. A whole-school export is a server job — ask support for one.`
      );
    } finally {
      setExporting(false);
    }
  };
  const atRisk = plans.summary?.atRiskPlans ?? 0;
  if (tab === "create") {
    const nextParam = (value) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "create");
      if (value) next.set("student", value);
      else next.delete("student");
      setSearchParams(next, { replace: true });
    };
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        PageHeader,
        {
          eyebrow: /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Link, { to: ROUTES.DASHBOARD_PLANS, children: "Installment Plans" }),
            /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "›" }),
            "New Plan Setup"
          ] }),
          title: builder.student ? `Create Payment Plan — ${builder.student.studentName}` : "Create Payment Plan",
          description: builder.student ? `Class: ${builder.student.studentClass} • Student ID: ${builder.student.studentId} • Total Fee Owed: GH₵ ${formatCedis(builder.figures.totalOwed)}` : "Structure an outstanding balance into dated installments for one student.",
          actions: /* @__PURE__ */ jsxs(
            Link,
            {
              to: ROUTES.DASHBOARD_PLANS,
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsx(ChevronLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Back to compliance"
              ]
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(
            StudentPicker,
            {
              selected: builder.student,
              loading: builder.loading,
              onSelect: (id) => nextParam(id)
            }
          ),
          builder.student && /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(
            CreatePlanForm,
            {
              figures: builder.figures,
              guardian: builder.guardian,
              numberOfInstallments: builder.numberOfInstallments,
              setNumberOfInstallments: builder.setNumberOfInstallments,
              interval: builder.interval,
              setInterval: builder.setInterval,
              startDate: builder.startDate,
              setStartDate: builder.setStartDate,
              onStartDatePreset: (target) => builder.setStartDate(
                // The presets are computed here rather than in the hook so the
                // hook stays a state machine and the two "end of this month"
                // definitions cannot drift apart.
                target === "endOfMonth" ? endOfThisMonth() : firstOfNextMonth()
              ),
              planName: builder.planName,
              setPlanName: builder.setPlanName,
              adminNotes: builder.adminNotes,
              setAdminNotes: builder.setAdminNotes,
              autoCollect: builder.autoCollect,
              setAutoCollect: builder.setAutoCollect,
              reminderDays: builder.reminderDays,
              setReminderDays: builder.setReminderDays,
              reminderTime: builder.reminderTime,
              setReminderTime: builder.setReminderTime
            }
          ) })
        ] }),
        /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
          PlanProjection,
          {
            projection: builder.projection,
            figures: builder.figures,
            loading: builder.loading,
            planName: builder.planName || `${builder.numberOfInstallments}-Month Plan`,
            term: school?.academic?.currentTerm,
            academicYear: school?.academic?.currentYear,
            schoolName: user?.schoolName || school?.name,
            guardian: builder.guardian
          }
        ) })
      ] }),
      builder.student && /* @__PURE__ */ jsx("div", { className: "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("p", { className: "min-w-0 flex-1 text-[12px] font-semibold text-slate-600", children: builder.blocker ? /* @__PURE__ */ jsx("span", { className: "text-amber-700", children: builder.blocker }) : builder.guardian ? /* @__PURE__ */ jsxs(Fragment, { children: [
          "Plan notification ready for dispatch to",
          " ",
          /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-ink", children: [
            builder.guardian.parentName,
            " (",
            builder.guardian.phone,
            ")"
          ] })
        ] }) : /* @__PURE__ */ jsx(Fragment, { children: "No guardian on record — the plan will be created, but nobody will be told about it." }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => nextParam(null), children: "Cancel" }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "secondary",
              onClick: () => {
                builder.save().catch(() => {
                });
                toast.info("Draft kept in this browser. Nothing has been sent.");
              },
              children: "Save Draft"
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "primary",
              onClick: async () => {
                try {
                  await builder.save();
                  navigate(ROUTES.DASHBOARD_PLANS);
                } catch (error) {
                  toast.error(error?.message || "The plan could not be created.");
                }
              },
              disabled: !builder.canSubmit || builder.saving,
              children: "Generate Plan & Send to Parent"
            }
          )
        ] })
      ] }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Overview / Installment Plans / Compliance",
        title: "Installment Compliance Dashboard",
        description: `Real-time monitoring of structured parent payment plans for ${user?.schoolName || school?.name || "your school"}${school?.academic?.currentTerm ? ` • ${school.academic.currentTerm}` : ""}${school?.academic?.currentYear ? ` (${school.academic.currentYear})` : ""}`,
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: exportCsv,
              disabled: exporting || !rowsWithParent.length,
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Export this page (CSV)"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setTab("create"),
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2.5 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-800",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Create New Plan"
              ]
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(ModuleTabs, { items: TABS$1, value: tab, onChange: setTab, ariaLabel: "Installment plan sections" }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
      /* @__PURE__ */ jsx(ComplianceKpiRow, { summary: plans.summary, loading: plans.loading }),
      /* @__PURE__ */ jsx(
        PlanHealthBar,
        {
          summary: plans.summary,
          loading: plans.loading,
          activeFilter: plans.filters.status,
          onFilter: (status) => plans.setFilter({ status })
        }
      ),
      /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsx(
        ComplianceFilterBar,
        {
          filters: plans.filters,
          onFilter: plans.setFilter,
          onClear: plans.clearFilters,
          hasFilters: plans.hasFilters,
          onRefresh: plans.reload,
          refreshing: plans.loading,
          classes,
          terms,
          resultCount: plans.meta?.total ?? null,
          view,
          onViewChange: setView
        }
      ) }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
        view === "table" ? /* @__PURE__ */ jsx(
          ComplianceTable,
          {
            rows: rowsWithParent,
            loading: plans.loading,
            error: plans.error,
            hasFilters: plans.hasFilters,
            busyPlanId: drawerPlan?._id,
            onViewSchedule: setDrawerPlan,
            onChase: () => setBroadcastOpen(true),
            onSort,
            sortBy: plans.filters.sortBy,
            sortOrder: plans.filters.sortOrder
          }
        ) : /* @__PURE__ */ jsx(
          ComplianceCardGrid,
          {
            rows: rowsWithParent,
            loading: plans.loading,
            hasFilters: plans.hasFilters,
            onViewSchedule: setDrawerPlan,
            onChase: () => setBroadcastOpen(true)
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: plans.loading ? "Loading…" : plans.meta?.total ? `Showing ${formatCount((plans.filters.page - 1) * plans.filters.perPage + 1)} to ${formatCount(
            Math.min(plans.filters.page * plans.filters.perPage, plans.meta.total)
          )} of ${formatCount(plans.meta.total)} plan records` : "No plan records" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => setBroadcastOpen(true),
                disabled: atRisk === 0,
                className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[12px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
                children: [
                  /* @__PURE__ */ jsx(BellRing, { className: "h-4 w-4", "aria-hidden": "true" }),
                  "Broadcast SMS to all ",
                  formatCount(atRisk),
                  " At-Risk & Approving Parents"
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              Pagination,
              {
                page: plans.filters.page,
                totalPages: plans.meta?.totalPages || 1,
                onChange: (page) => plans.setFilter({ page }, { resetPage: false })
              }
            )
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      PlanScheduleDrawer,
      {
        plan: drawerPlan,
        open: Boolean(drawerPlan),
        onClose: () => setDrawerPlan(null),
        onChanged: (updated) => {
          if (updated) setDrawerPlan({ ...drawerPlan, ...updated });
          plans.reload();
        }
      }
    ),
    /* @__PURE__ */ jsx(
      BroadcastAtRiskModal,
      {
        open: broadcastOpen,
        onClose: () => setBroadcastOpen(false),
        onSent: () => toast.success("Chaser queued. Track delivery on the SMS Reminders module.")
      }
    )
  ] });
};
const ComplianceCardGrid = ({ rows, loading, hasFilters, onViewSchedule, onChase }) => {
  if (loading) {
    return /* @__PURE__ */ jsx("p", { className: "flex items-center justify-center gap-2 px-4 py-12 text-[12px] font-semibold text-slate-500", children: "Loading plan compliance…" });
  }
  if (!rows.length) {
    return /* @__PURE__ */ jsx("p", { className: "px-4 py-12 text-center text-[12px] font-semibold text-slate-500", children: hasFilters ? "No plans match these filters." : "No payment plans yet. Create one from a student with an outstanding balance." });
  }
  return /* @__PURE__ */ jsx("div", { className: "grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3", children: rows.map((plan) => {
    const student = plan.student || {};
    const next = plan.nextInstallment;
    const isOverdue = plan.complianceStatus === "overdue";
    return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "flex flex-col", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: student.studentName }),
      /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
        student.studentClass,
        " · ",
        student.studentId
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-[12px] font-extrabold text-ink", children: plan.planName }),
      /* @__PURE__ */ jsxs(
        "p",
        {
          className: `mt-0.5 text-[15px] font-extrabold ${isOverdue ? "text-red-600" : "text-ink"}`,
          children: [
            "GH₵ ",
            formatCedis(next ? Math.max(next.amount - (next.amountPaid || 0), 0) : 0)
          ]
        }
      ),
      next && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
        "Next due ",
        new Date(next.dueDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          timeZone: "UTC"
        })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-auto flex items-center gap-2 pt-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onChase(plan),
            className: "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50",
            children: "Chase"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onViewSchedule(plan),
            className: "rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-ink hover:bg-slate-200",
            children: "View Schedule"
          }
        )
      ] })
    ] }, plan._id);
  }) });
};
const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  return /* @__PURE__ */ jsxs("nav", { "aria-label": "Plan compliance pages", className: "flex items-center gap-1", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => onChange(page - 1),
        disabled: page <= 1,
        "aria-label": "Previous page",
        className: "rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40",
        children: /* @__PURE__ */ jsx(ChevronLeft, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
      }
    ),
    pageWindow(page, totalPages).map(
      (entry, index) => entry === "…" ? /* @__PURE__ */ jsx("span", { className: "px-1 text-[12px] font-bold text-slate-400", children: "…" }, `gap-${index}`) : /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => onChange(entry),
          "aria-current": entry === page ? "page" : void 0,
          className: `h-8 min-w-8 rounded-lg px-2 text-[12px] font-extrabold transition-colors ${entry === page ? "bg-brand-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`,
          children: entry
        },
        entry
      )
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => onChange(page + 1),
        disabled: page >= totalPages,
        "aria-label": "Next page",
        className: "rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40",
        children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
      }
    )
  ] });
};
const MAX_SELECTION = 500;
const StudentMultiSelect = ({ selectedIds, onChange }) => {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const selected = selectedIds || [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setFetching(true);
      setError(null);
      listStudents({ search: search.trim(), perPage: 20 }).then((result) => {
        if (active) setRows(result?.rows || []);
      }).catch((err) => {
        if (!active) return;
        setRows([]);
        setError(err);
      }).finally(() => {
        if (active) setFetching(false);
      });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  const toggle = useCallback(
    (id) => {
      onChange?.(
        selectedSet.has(id) ? selected.filter((existing) => existing !== id) : [...selected, id]
      );
    },
    [onChange, selected, selectedSet]
  );
  const atCap = selected.length >= MAX_SELECTION;
  return /* @__PURE__ */ jsxs("div", { className: "mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3", children: [
    selected.length ? /* @__PURE__ */ jsxs("div", { className: "mb-2.5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-500", children: "Chosen" }),
        /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-bold text-slate-500 tabular-nums", children: [
          formatCount(selected.length),
          atCap ? " · limit reached" : ` of ${MAX_SELECTION}`
        ] })
      ] }),
      /* @__PURE__ */ jsxs("ul", { className: "mb-2 flex flex-wrap gap-1.5", children: [
        selected.slice(0, 12).map((id) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => toggle(id),
            className: "inline-flex max-w-[14rem] items-center gap-1 rounded-lg bg-brand-700 py-1 pl-2 pr-1.5 text-[11px] font-bold text-white transition-colors hover:bg-brand-800",
            children: [
              /* @__PURE__ */ jsx("span", { className: "truncate", children: nameFor(id, rows) }),
              /* @__PURE__ */ jsx(X, { className: "h-3 w-3 shrink-0", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxs("span", { className: "sr-only", children: [
                "Remove ",
                nameFor(id, rows)
              ] })
            ]
          }
        ) }, id)),
        selected.length > 12 ? /* @__PURE__ */ jsxs("li", { className: "inline-flex items-center rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600", children: [
          "+",
          formatCount(selected.length - 12),
          " more"
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => onChange?.([]),
          className: "min-h-[32px] text-[11px] font-bold text-slate-500 underline underline-offset-2 hover:text-slate-700",
          children: "Clear all"
        }
      )
    ] }) : null,
    /* @__PURE__ */ jsx("label", { className: "sr-only", htmlFor: "sms-student-search", children: "Search students by name or ID" }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        Search,
        {
          className: "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400",
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          id: "sms-student-search",
          type: "search",
          value: search,
          onChange: (event) => setSearch(event.target.value),
          placeholder: "Search by student name or ID…",
          className: "w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[12px] font-semibold text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        }
      )
    ] }),
    error ? /* @__PURE__ */ jsxs("p", { className: "mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-red-700", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-px h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
      error?.message || "The roster could not be read."
    ] }) : null,
    /* @__PURE__ */ jsx("div", { className: "mt-2 max-h-56 overflow-y-auto overscroll-contain", children: fetching && !rows.length ? /* @__PURE__ */ jsxs("p", { className: "flex items-center justify-center gap-2 py-4 text-[12px] font-semibold text-slate-400", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }),
      "Loading students…"
    ] }) : rows.length ? /* @__PURE__ */ jsx("ul", { className: "space-y-1", children: rows.map((row) => {
      const checked = selectedSet.has(row.id ?? row._id);
      const id = row.id ?? row._id;
      return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
        "label",
        {
          className: `flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white px-2.5 py-2 transition-colors ${checked ? "border-brand-700 bg-brand-50/40" : "border-slate-200 hover:border-slate-300"}`,
          children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                checked,
                onChange: () => toggle(id),
                disabled: !checked && atCap,
                className: "h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
              }
            ),
            /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[12px] font-extrabold text-ink", children: row.studentName }),
              /* @__PURE__ */ jsxs("span", { className: "block truncate text-[11px] font-semibold text-slate-500", children: [
                row.studentClass,
                " · ",
                row.studentId
              ] })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "shrink-0 text-[11px] font-extrabold tabular-nums text-slate-600", children: [
              "GH₵ ",
              formatCedis(row.balance)
            ] })
          ]
        }
      ) }, id);
    }) }) : search.trim() ? /* @__PURE__ */ jsxs("p", { className: "py-4 text-center text-[12px] font-semibold text-slate-400", children: [
      "Nobody on the roster matches “",
      search.trim(),
      "”."
    ] }) : null }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] leading-relaxed text-slate-500", children: selected.length ? "Shown above, so this is the audience the preview and the send will use." : "Pick at least one student — an empty selection cannot be previewed or sent." })
  ] });
};
const nameFor = (id, rows) => {
  const match = rows.find((row) => (row.id ?? row._id) === id);
  return match ? match.studentName : `…${String(id).slice(-6)}`;
};
const NETWORKS$1 = [
  { key: "mtn", label: "MTN", dot: "mtn" },
  { key: "telecel", label: "Telecel", dot: "telecel" },
  { key: "airteltigo", label: "AT Money", dot: "at" }
];
const NetworkSplit = ({ split, total, loading }) => {
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "h-2 w-full animate-pulse rounded-full bg-slate-100", "aria-hidden": "true" });
  }
  if (!total) return null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "flex h-2 w-full overflow-hidden rounded-full bg-slate-100",
        role: "img",
        "aria-label": NETWORKS$1.map((n) => `${n.label} ${Math.round((split?.[n.key] || 0) / total * 100)}%`).join(", "),
        children: NETWORKS$1.map((network) => {
          const count = split?.[network.key] || 0;
          if (!count) return null;
          return /* @__PURE__ */ jsx(
            "span",
            {
              className: NETWORK_DOTS[network.dot],
              style: { width: `${count / total * 100}%` }
            },
            network.key
          );
        })
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-x-4 gap-y-1", children: NETWORKS$1.map((network) => {
      const count = split?.[network.key] || 0;
      return /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[10px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsx("span", { className: `h-2 w-2 rounded-full ${NETWORK_DOTS[network.dot]}`, "aria-hidden": "true" }),
        network.label,
        " (",
        Math.round(count / total * 100),
        "%)"
      ] }, network.key);
    }) })
  ] });
};
const AudienceCard = ({ rule, selected, count, value, valueLabel, badge, onSelect, children }) => /* @__PURE__ */ jsx(
  "label",
  {
    className: `block cursor-pointer rounded-2xl border-2 bg-white p-4 transition-colors ${selected ? "border-brand-700" : "border-slate-200 hover:border-slate-300"}`,
    children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "radio",
          name: "sms-audience",
          className: "mt-0.5 h-4 w-4 shrink-0 accent-brand-700",
          checked: selected,
          onChange: onSelect
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: rule.title }),
          badge && /* @__PURE__ */ jsx(Badge, { tone: "red", children: badge })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px] font-medium leading-snug text-slate-500", children: rule.description }),
        children,
        /* @__PURE__ */ jsx("div", { className: "mt-2.5 flex items-end justify-between gap-3", children: selected && count !== null ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-slate-400", children: valueLabel }),
            /* @__PURE__ */ jsx("p", { className: "text-[12px] font-extrabold text-ink", children: value })
          ] }),
          /* @__PURE__ */ jsxs(Badge, { tone: count > 0 ? "brand" : "slate", children: [
            formatCount(count),
            " parent",
            count === 1 ? "" : "s"
          ] })
        ] }) : count !== null && count > 0 ? /* @__PURE__ */ jsxs(Badge, { tone: "slate", children: [
          formatCount(count),
          " parents"
        ] }) : null })
      ] })
    ] })
  }
);
const AudiencePanel = ({
  audienceType,
  setAudienceType,
  audienceRules,
  classFilter,
  setClassFilter,
  classes,
  studentIds,
  setStudentIds,
  preview,
  loading,
  error,
  excludeRecentPayers,
  setExcludeRecentPayers,
  recentPaymentWindowHours,
  setRecentPaymentWindowHours,
  dueSoonDays,
  setDueSoonDays,
  gracePeriodDays,
  setGracePeriodDays,
  minBalance,
  setMinBalance
}) => {
  const countFor = (type) => audienceType === type && preview ? preview.matchCount : null;
  const valueFor = (type) => {
    if (audienceType === type && type === "students") {
      return studentIds?.length ? `${formatCount(studentIds.length)} student${studentIds.length === 1 ? "" : "s"} chosen` : "None chosen yet";
    }
    if (audienceType !== type || !preview) return "—";
    if (type === "class") return "In the selected class";
    if (type === "all") return "Every active student";
    if (type === "installment_due_soon") return `Due within ${dueSoonDays} day${dueSoonDays === 1 ? "" : "s"}`;
    if (type === "overdue") return "Immediate arrears";
    return "Total school debt";
  };
  return /* @__PURE__ */ jsxs("section", { "aria-label": "Select audience", className: "space-y-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("h2", { className: "flex items-center gap-2 text-sm font-extrabold text-ink", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white", children: "1" }),
        "Select Audience"
      ] }),
      /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "Term 1 (2025/26)" })
    ] }),
    error && /* @__PURE__ */ jsxs(
      "div",
      {
        role: "alert",
        className: "flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5",
        children: [
          /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-600", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-red-700", children: error.message })
        ]
      }
    ),
    audienceRules.map((rule) => /* @__PURE__ */ jsxs(
      AudienceCard,
      {
        rule,
        badge: rule.badge,
        selected: audienceType === rule.value,
        count: countFor(rule.value),
        value: valueFor(rule.value),
        valueLabel: rule.value === "all" ? "Includes settled" : rule.value === "class" || rule.value === "students" ? "Scope" : "Outstanding",
        onSelect: () => setAudienceType(rule.value),
        children: [
          audienceType === rule.value && rule.value === "class" && /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
            /* @__PURE__ */ jsx("label", { className: "mb-1 block text-[11px] font-semibold text-slate-700", htmlFor: "sms-class", children: "Class" }),
            /* @__PURE__ */ jsxs("div", { className: "relative", children: [
              /* @__PURE__ */ jsxs(
                "select",
                {
                  id: "sms-class",
                  value: classFilter,
                  onChange: (event) => setClassFilter(event.target.value),
                  className: "w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "", children: "Select a class…" }),
                    classes.map((name) => /* @__PURE__ */ jsx("option", { value: name, children: name }, name))
                  ]
                }
              ),
              /* @__PURE__ */ jsx(
                ChevronDown,
                {
                  className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400",
                  "aria-hidden": "true"
                }
              )
            ] }),
            !classFilter && /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-amber-700", children: "Pick a class to size this audience." })
          ] }),
          audienceType === rule.value && rule.value === "students" && /* @__PURE__ */ jsx(StudentMultiSelect, { selectedIds: studentIds, onChange: setStudentIds }),
          audienceType === rule.value && rule.value === "overdue" && /* @__PURE__ */ jsxs("div", { className: "mt-3 grid grid-cols-2 gap-2", children: [
            /* @__PURE__ */ jsxs("label", { className: "text-[11px] font-semibold text-slate-700", children: [
              "Grace period (days)",
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: "0",
                  max: "180",
                  value: gracePeriodDays,
                  onChange: (event) => setGracePeriodDays(event.target.value),
                  className: "mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "text-[11px] font-semibold text-slate-700", children: [
              "Minimum balance (GH₵)",
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: "0",
                  step: "0.01",
                  value: (minBalance / 100).toFixed(2),
                  onChange: (event) => setMinBalance(Math.round((Number(event.target.value) || 0) * 100)),
                  className: "mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                }
              )
            ] })
          ] }),
          audienceType === rule.value && rule.value === "installment_due_soon" && /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsxs("label", { className: "text-[11px] font-semibold text-slate-700", htmlFor: "sms-due-soon", children: [
            "Tranche due within (days)",
            /* @__PURE__ */ jsx(
              "input",
              {
                id: "sms-due-soon",
                type: "number",
                min: "1",
                max: "90",
                value: dueSoonDays,
                onChange: (event) => setDueSoonDays(event.target.value),
                className: "mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
              }
            )
          ] }) }),
          audienceType === rule.value && preview && /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-semibold text-slate-500", children: [
            rule.value === "all" ? "Includes settled students" : "Outstanding",
            ":",
            " ",
            /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCediShort(preview.totalBalance) })
          ] })
        ]
      },
      rule.value
    )),
    /* @__PURE__ */ jsx("div", { className: "space-y-2 rounded-2xl border border-slate-200 bg-white p-4", children: /* @__PURE__ */ jsxs("label", { className: "flex cursor-pointer items-start gap-3", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: excludeRecentPayers,
          onChange: (event) => setExcludeRecentPayers(event.target.checked),
          className: "mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Exclude recent payers" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px] font-medium leading-snug text-slate-500", children: [
          "Skips parents who completed any partial or full MoMo payment in the last",
          " ",
          excludeRecentPayers ? /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: "1",
              max: "720",
              value: recentPaymentWindowHours,
              onChange: (event) => setRecentPaymentWindowHours(event.target.value),
              className: "mx-1 w-16 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-extrabold text-ink focus:border-brand-700 focus:outline-none",
              "aria-label": "Recent payment window in hours"
            }
          ) : 48,
          " ",
          "hours to avoid duplicate complaints."
        ] })
      ] })
    ] }) }),
    preview && preview.matchCount > 0 && /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-ink", children: [
        formatCount(preview.matchCount),
        " recipient",
        preview.matchCount === 1 ? "" : "s",
        " selected"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx(NetworkSplit, { split: preview.networkSplit, total: preview.matchCount, loading }) }),
      preview.skipped?.invalid_number > 0 && /* @__PURE__ */ jsxs("p", { className: "mt-3 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700", children: [
        /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        formatCount(preview.skipped.invalid_number),
        " parent",
        preview.skipped.invalid_number === 1 ? "" : "s",
        " matched but",
        " ",
        preview.skipped.invalid_number === 1 ? "has" : "have",
        " a number that will not normalise. Fix those in the roster to reach them."
      ] }),
      loading && /* @__PURE__ */ jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400", children: [
        /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }),
        "Sizing audience…"
      ] })
    ] })
  ] });
};
const densityTone = (length, perSegment) => {
  if (length > perSegment * 10) return "red";
  if (length > perSegment) return "amber";
  return "brand";
};
const DENSITY_FILL = {
  brand: "bg-brand-700",
  amber: "bg-amber-500",
  red: "bg-red-600"
};
const ComposerPanel = ({
  body,
  setBody,
  category,
  setCategory,
  tokens,
  tokensInBody,
  unknownTokens,
  rendered,
  segments,
  perSegmentLimit,
  overSegmentLimit,
  estimatedCost,
  affordable,
  balance,
  balanceAfter,
  ratePes,
  matchCount,
  presets,
  applyTemplate,
  templates,
  templateId,
  onDeleteTemplate,
  senderId,
  creditsLoading
}) => {
  const textareaRef = useRef(null);
  const insertToken = (token) => {
    const field = textareaRef.current;
    const snippet = `{${token}}`;
    if (!field) {
      setBody(`${body}${snippet}`);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${snippet}${body.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + snippet.length;
      field.setSelectionRange(caret, caret);
    });
  };
  const density = densityTone(rendered.length, perSegmentLimit);
  const usedTokens = new Set(tokensInBody);
  const savedTemplates = (templates || []).filter((template) => !template.isPreset);
  return /* @__PURE__ */ jsxs("section", { "aria-label": "Compose SMS message", className: "space-y-3", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("h2", { className: "flex items-center gap-2 text-sm font-extrabold text-ink", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white", children: "2" }),
        "Compose SMS Message"
      ] }),
      /* @__PURE__ */ jsx(Badge, { tone: "green", icon: BadgeCheck, children: "Instant Delivery" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5", children: [
      /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-600", children: "Sender ID:" }),
      /* @__PURE__ */ jsx("span", { className: "text-[12px] font-extrabold text-brand-700", children: senderId || "SukuuPay" }),
      /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-500", children: "Registered with NCA Ghana" }),
      /* @__PURE__ */ jsx(Info, { className: "ml-auto h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Dynamic Student Tokens" }),
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold text-slate-400", children: "Click to append to cursor" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", children: tokens.map((entry) => {
        const used = usedTokens.has(entry.token);
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => insertToken(entry.token),
            title: entry.label,
            className: `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors ${used ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-700 hover:text-brand-700"}`,
            children: [
              used ? /* @__PURE__ */ jsx(CircleAlert, { className: "h-3 w-3", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Plus, { className: "h-3 w-3", "aria-hidden": "true" }),
              "{",
              entry.token,
              "}"
            ]
          },
          entry.token
        );
      }) })
    ] }),
    unknownTokens.length > 0 && /* @__PURE__ */ jsxs("div", { role: "alert", className: "flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-600", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-red-700", children: [
        unknownTokens.map((token) => `{${token}}`).join(", "),
        " ",
        unknownTokens.length === 1 ? "is not a token" : "are not tokens",
        " this platform can fill. It would be sent to parents as written."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4", children: [
      /* @__PURE__ */ jsx("label", { className: "mb-1.5 block text-[11px] font-semibold text-slate-700", htmlFor: "sms-body", children: "Message body" }),
      /* @__PURE__ */ jsx(
        "textarea",
        {
          id: "sms-body",
          ref: textareaRef,
          value: body,
          onChange: (event) => setBody(event.target.value),
          rows: 7,
          placeholder: "Dear {parentName}, {studentName} owes GHC {balance}…",
          className: "w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium leading-relaxed text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 text-[11px] font-extrabold", children: [
          /* @__PURE__ */ jsx("span", { className: "text-slate-600", children: "Character Density" }),
          /* @__PURE__ */ jsxs(
            "span",
            {
              className: density === "red" ? "text-red-600" : density === "amber" ? "text-amber-600" : "text-slate-600",
              children: [
                formatCount(rendered.length),
                " / ",
                formatCount(perSegmentLimit),
                " characters"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100", children: /* @__PURE__ */ jsx(
          "div",
          {
            className: `h-full rounded-full transition-all ${DENSITY_FILL[density]}`,
            style: { width: `${Math.min(rendered.length / perSegmentLimit * 100, 100)}%` }
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            segments,
            " SMS Part",
            segments === 1 ? "" : "s"
          ] }),
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "·" }),
          /* @__PURE__ */ jsx("span", { children: perSegmentLimit === 160 ? "GSM-7 standard encoding" : "UCS-2 extended encoding" }),
          matchCount > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "·" }),
            /* @__PURE__ */ jsxs("span", { children: [
              "Total Credits: ",
              formatCount(segments * matchCount),
              " SMS"
            ] })
          ] })
        ] }),
        perSegmentLimit === 70 && /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-semibold text-amber-700", children: "This message contains a character outside GSM-7, so it costs roughly twice as much per segment. The typographic apostrophe and the em dash are the usual culprits." }),
        overSegmentLimit && /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-[11px] font-semibold text-red-600", children: [
          segments,
          " parts is over the 10-part limit. A send will be refused — shorten the message to ",
          formatCount(perSegmentLimit * 10),
          " characters."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600", children: /* @__PURE__ */ jsx(CircleDollarSign, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-slate-700", children: "Estimated Broadcast Cost" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-[22px] font-extrabold leading-none tracking-tight text-ink", children: estimatedCost === null ? /* @__PURE__ */ jsx("span", { className: "text-[13px] font-semibold text-slate-400", children: "Choose an audience to cost this" }) : creditsLoading ? /* @__PURE__ */ jsx("span", { className: "text-[13px] font-semibold text-slate-400", children: "Reading balance…" }) : formatCediShort(estimatedCost * ratePes) }),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-semibold text-slate-500", children: estimatedCost === null ? `${segments} part${segments === 1 ? "" : "s"} per parent` : `Fixed rate GH₵ ${(ratePes / 100).toFixed(2)} per delivered SMS` })
        ] })
      ] }),
      estimatedCost !== null && !creditsLoading && /* @__PURE__ */ jsxs("div", { className: "mt-3 border-t border-slate-100 pt-3", children: [
        affordable ? /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          "Balance after:",
          " ",
          /* @__PURE__ */ jsxs("span", { className: "font-extrabold text-ink", children: [
            formatCount(Math.max(balance - estimatedCost, 0)),
            " SMS"
          ] })
        ] }) : /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-1.5 text-[11px] font-semibold text-red-600", children: [
          /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
          "This costs ",
          formatCount(estimatedCost),
          " SMS and the school has",
          " ",
          formatCount(balance),
          ". Narrow the audience or add credit first."
        ] }),
        balanceAfter !== null && balanceAfter !== void 0 && /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[11px] font-semibold text-slate-400", children: [
          "Last broadcast left ",
          formatCount(balanceAfter),
          " SMS."
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Preset Templates" }),
      /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: presets.map((preset) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => applyTemplate(preset),
          className: "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 transition-colors hover:border-brand-700 hover:text-brand-700",
          children: preset.name
        },
        preset.key
      )) }),
      savedTemplates.length > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-3 border-t border-slate-100 pt-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-400", children: "Your saved templates" }),
        /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: savedTemplates.map((template) => /* @__PURE__ */ jsxs(
          "span",
          {
            className: `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${String(templateId) === String(template._id) ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"}`,
            children: [
              /* @__PURE__ */ jsx("button", { type: "button", onClick: () => applyTemplate(template), className: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40", children: template.name }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => onDeleteTemplate?.(template._id),
                  "aria-label": `Delete ${template.name}`,
                  className: "text-slate-400 hover:text-red-600",
                  children: /* @__PURE__ */ jsx(X, { className: "h-3 w-3", "aria-hidden": "true" })
                }
              )
            ]
          },
          template._id
        )) })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] font-semibold leading-relaxed text-slate-500", children: "Applying a template replaces the body. Your draft is kept until you send or reset, so nothing is lost by looking at a preset." })
    ] })
  ] });
};
const PayLinkCard = ({ payLink, amount, schoolName }) => {
  if (!payLink) return null;
  return /* @__PURE__ */ jsxs("div", { className: "mt-2 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/80", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-emerald-100 px-3 py-2", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-md bg-brand-700 text-white", children: /* @__PURE__ */ jsx(Check, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-extrabold text-ink", children: "SukuuPay Instant Pay" }),
        /* @__PURE__ */ jsxs("p", { className: "truncate text-[10px] font-semibold text-slate-500", children: [
          schoolName,
          " · secure link"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-3 py-2.5", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-slate-500", children: "Amount Due" }),
        /* @__PURE__ */ jsx("p", { className: "text-[15px] font-extrabold leading-tight text-ink", children: amount })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-700 px-2.5 py-1.5 text-[11px] font-extrabold text-white", children: [
        "Pay Now",
        /* @__PURE__ */ jsx(ChevronRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "break-all border-t border-emerald-100 px-3 py-1.5 text-[9px] font-semibold text-slate-400", children: payLink })
  ] });
};
const PhonePreview = ({ rendered, payLink, amount, schoolName, senderName, sending }) => /* @__PURE__ */ jsxs("div", { className: "lg:sticky lg:top-6", children: [
  /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
    /* @__PURE__ */ jsxs("h2", { className: "flex items-center gap-2 text-sm font-extrabold text-ink", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white", children: "3" }),
      "Live Phone Preview"
    ] }),
    /* @__PURE__ */ jsx(Badge, { tone: "green", dot: "mtn", children: "Parent View" })
  ] }),
  /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-[300px] rounded-[2.25rem] border-8 border-ink bg-white shadow-lift", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-4 pb-1 pt-2 text-[10px] font-bold text-ink", children: [
      /* @__PURE__ */ jsx("span", { children: "9:41" }),
      /* @__PURE__ */ jsx("span", { className: "absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-ink" }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(Signal, { className: "h-3 w-3", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx(Wifi, { className: "h-3 w-3", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx(BatteryMedium, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 px-3 pb-2 pt-3 text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold text-ink", children: "SukuuPay" }),
      /* @__PURE__ */ jsx("p", { className: "text-[9px] font-semibold uppercase tracking-wider text-slate-400", children: "Official SMS" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-slate-100 px-3 py-2", children: [
      /* @__PURE__ */ jsx(ArrowLeft, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("span", { className: "flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-extrabold text-slate-600", children: "SK" }),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-[10px] font-extrabold text-ink", children: senderName || "SukuuPay" }),
        /* @__PURE__ */ jsx("p", { className: "text-[9px] font-semibold text-slate-400", children: "NOTICE" })
      ] }),
      /* @__PURE__ */ jsx(MoreVertical, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "min-h-[320px] space-y-2 bg-slate-50 px-3 py-3", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-center text-[9px] font-semibold text-slate-400", children: [
        "Today · ",
        sending ? "Sending…" : "09:41 AM"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 shadow-sm", children: [
        /* @__PURE__ */ jsx("p", { className: "whitespace-pre-wrap break-words text-[11px] font-medium leading-relaxed text-ink", children: rendered || /* @__PURE__ */ jsx("span", { className: "italic text-slate-400", children: "Your message will appear here as you type." }) }),
        /* @__PURE__ */ jsx(PayLinkCard, { payLink, amount, schoolName })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "px-1 text-[9px] font-semibold leading-relaxed text-slate-400", children: "Sent via SukuuPay Gateway · Just now" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-t border-slate-100 px-3 py-2.5", children: [
      /* @__PURE__ */ jsx("span", { className: "flex-1 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-400", children: "Text message" }),
      /* @__PURE__ */ jsx("span", { className: "flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-white", children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" }) })
    ] })
  ] }),
  /* @__PURE__ */ jsx("p", { className: "mx-auto mt-3 max-w-[300px] text-center text-[11px] font-semibold leading-relaxed text-slate-500", children: "This is how the reminder will appear on a parent’s handset. The bubble wraps at the width a real phone uses, so copy that overflows here overflows there." })
] });
const SchedulePicker = ({ value, onChange }) => /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
  /* @__PURE__ */ jsxs("label", { className: "mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: [
    /* @__PURE__ */ jsx(CalendarClock, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
    "Send later (optional)"
  ] }),
  /* @__PURE__ */ jsx(
    "input",
    {
      type: "datetime-local",
      value,
      onChange: (event) => onChange(event.target.value),
      className: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
    }
  ),
  /* @__PURE__ */ jsx("p", { className: "mt-1 text-[10px] font-semibold text-slate-400", children: "Credit is reserved now and refunded if the run fails." })
] });
const SendBar = ({
  matchCount,
  segments,
  estimatedCost,
  ratePes,
  balance,
  canQueue,
  readyToConfirm,
  confirmed,
  setConfirmed,
  sending,
  onSend,
  scheduledAt,
  setScheduledAt,
  onReset,
  blocker,
  canSend,
  gateway,
  audienceType
}) => {
  const recipientLabel = matchCount ? `${formatCount(matchCount)} SMS Prompt${matchCount === 1 ? "" : "s"}` : "SMS Prompts";
  return /* @__PURE__ */ jsxs("div", { className: "sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-end", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-[14px] font-extrabold leading-tight text-ink", children: [
          recipientLabel,
          " to Send"
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: estimatedCost === null ? "Pick an audience to see the cost." : /* @__PURE__ */ jsxs(Fragment, { children: [
          "Total Fee:",
          " ",
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCediShort(estimatedCost * ratePes) }),
          " ",
          "(from ",
          formatCount(balance),
          " available credits)"
        ] }) }),
        canSend === false && /* @__PURE__ */ jsxs("p", { className: "mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700", children: [
          /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
          "No SMS gateway is configured on this server",
          gateway?.senderIdIssue ? `: ${gateway.senderIdIssue}` : ".",
          " Sending will fail until it is."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onReset,
            className: "rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
            children: "Reset"
          }
        ),
        /* @__PURE__ */ jsx(SchedulePicker, { value: scheduledAt, onChange: setScheduledAt })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "lg:pb-0", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            disabled: !canQueue || sending,
            onClick: onSend,
            className: "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto",
            children: [
              sending ? /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Send, { className: "h-4 w-4", "aria-hidden": "true" }),
              scheduledAt ? `Schedule ${recipientLabel}` : `Send ${recipientLabel} (${estimatedCost === null ? "—" : formatCediShort(estimatedCost * ratePes)})`
            ]
          }
        ),
        readyToConfirm && !confirmed && /* @__PURE__ */ jsxs("label", { className: "mt-2 flex cursor-pointer items-start gap-2 text-[11px] font-semibold text-slate-600", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "checkbox",
              checked: confirmed,
              onChange: (event) => setConfirmed(event.target.checked),
              className: "mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-700"
            }
          ),
          /* @__PURE__ */ jsx("span", { children: audienceType === "all" ? `Send to every active student, including the ${formatCount(matchCount)} who have nothing outstanding?` : `Send ${segments} SMS part${segments === 1 ? "" : "s"} to ${formatCount(matchCount)} parent${matchCount === 1 ? "" : "s"} now? This cannot be unsent.` })
        ] }),
        blocker && !readyToConfirm && /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-semibold text-slate-500", children: blocker })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400", children: [
      /* @__PURE__ */ jsx(ShieldCheck, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
      "End-to-end encrypted · Audit log enabled"
    ] })
  ] });
};
const CATEGORY_TONES = {
  fee_reminder: "blue",
  overdue: "amber",
  final_warning: "red",
  installment_due: "brand",
  payment_receipt: "green",
  announcement: "slate",
  pta: "brand",
  custom: "slate"
};
const CATEGORY_LABELS$1 = {
  fee_reminder: "Fee Reminder",
  overdue: "Overdue",
  final_warning: "Final Warning",
  installment_due: "Installment Due",
  payment_receipt: "Payment Receipt",
  announcement: "Announcement",
  pta: "PTA",
  custom: "Custom"
};
const CATEGORIES = Object.keys(CATEGORY_LABELS$1);
const EditTemplateModal = ({ open, template, onClose, onSave, saving }) => {
  const [name, setName] = useState(template?.name || "");
  const [body, setBody] = useState(template?.body || "");
  const [category, setCategory] = useState(template?.category || "custom");
  const [error, setError] = useState(null);
  const [seededFor, setSeededFor] = useState(null);
  if (open && seededFor !== (template?._id || "new")) {
    setName(template?.name || "");
    setBody(template?.body || "");
    setCategory(template?.category || "custom");
    setSeededFor(template?._id || "new");
  }
  const unknown = extractTokens(body).filter(
    (token) => !SMS_TOKENS.some((entry) => entry.token === token)
  );
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the template a name.");
      return;
    }
    if (unknown.length) {
      setError(`Remove or fix: ${unknown.map((t) => `{${t}}`).join(", ")}`);
      return;
    }
    setError(null);
    try {
      await onSave({ name: name.trim(), body, category });
      onClose();
    } catch (err) {
      setError(err?.message || "The template could not be saved.");
    }
  };
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose,
      title: template?._id ? "Edit template" : "Save as a template",
      description: "Tokens in braces are filled per parent at send time.",
      size: "lg",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: submit, disabled: saving, children: saving ? "Saving…" : "Save template" })
      ] }),
      children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-3", children: [
        error && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: error }),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Name",
            required: true,
            value: name,
            onChange: (event) => setName(event.target.value),
            placeholder: "Term 1 Reminder"
          }
        ),
        /* @__PURE__ */ jsx(
          SelectField,
          {
            label: "Category",
            value: category,
            onChange: (event) => setCategory(event.target.value),
            children: CATEGORIES.map((key) => /* @__PURE__ */ jsx("option", { value: key, children: CATEGORY_LABELS$1[key] }, key))
          }
        ),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700", htmlFor: "tpl-body", children: [
            "Message body ",
            /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "*" })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              id: "tpl-body",
              value: body,
              onChange: (event) => setBody(event.target.value),
              rows: 6,
              className: "w-full rounded-lg border border-slate-200 bg-white p-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            }
          ),
          /* @__PURE__ */ jsxs("p", { className: "mt-1 text-[10px]/[14px] font-medium text-slate-500", children: [
            formatCount(body.length),
            " characters · ",
            countSegments(body),
            " SMS part",
            countSegments(body) === 1 ? "" : "s"
          ] })
        ] })
      ] })
    }
  );
};
const TemplateCard = ({ template, own, onUse, onEdit, onDelete, busy }) => {
  const segments = countSegments(template.body);
  return /* @__PURE__ */ jsxs(Card, { padding: "p-4", className: "flex flex-col", children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-start justify-between gap-3", children: /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-[13px] font-extrabold text-ink", children: template.name }),
      /* @__PURE__ */ jsxs("div", { className: "mt-1.5 flex flex-wrap items-center gap-1.5", children: [
        /* @__PURE__ */ jsx(Badge, { tone: CATEGORY_TONES[template.category] || "slate", children: CATEGORY_LABELS$1[template.category] || template.category }),
        template.isPreset && /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "Platform preset" }),
        /* @__PURE__ */ jsxs(Badge, { tone: segments > 1 ? "amber" : "green", children: [
          segments,
          " part",
          segments === 1 ? "" : "s"
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("p", { className: "mt-3 line-clamp-3 flex-1 text-[12px] font-medium leading-relaxed text-slate-600", children: template.body }),
    /* @__PURE__ */ jsxs("div", { className: "mt-3 flex items-center gap-2 border-t border-slate-100 pt-3", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onUse,
          className: "rounded-lg bg-brand-700 px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-brand-800",
          children: "Use in composer"
        }
      ),
      own ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onEdit,
            className: "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
            children: "Edit"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onDelete,
            disabled: busy,
            "aria-label": `Delete ${template.name}`,
            className: "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50",
            children: /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
          }
        )
      ] }) : /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: onEdit,
          className: "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
          children: "Edit a copy"
        }
      )
    ] })
  ] });
};
const TemplatesTab = ({
  templates,
  presets,
  loading,
  onUse,
  onSave,
  onDelete
}) => {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const own = (templates || []).filter((template) => !template.isPreset);
  const save = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(payload, editing);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id) => {
    setBusyId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err?.message || "The template could not be deleted.");
    } finally {
      setBusyId(null);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
    error && /* @__PURE__ */ jsxs("div", { role: "alert", className: "flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-600", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-red-700", children: error })
    ] }),
    /* @__PURE__ */ jsxs("section", { "aria-label": "Your templates", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-extrabold text-ink", children: "Your templates" }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setEditing({ name: "", body: "", category: "custom" }),
            className: "inline-flex items-center gap-1.5 rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50",
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
              "New template"
            ]
          }
        )
      ] }),
      loading && /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-2 text-[12px] font-semibold text-slate-500", children: [
        /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
        "Loading templates…"
      ] }),
      !loading && !own.length && /* @__PURE__ */ jsx("p", { className: "rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[12px] font-semibold text-slate-500", children: "You have not saved any templates yet. Compose a reminder and save it, or start from one of the presets below." }),
      own.length > 0 && /* @__PURE__ */ jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: own.map((template) => /* @__PURE__ */ jsx(
        TemplateCard,
        {
          template,
          own: true,
          busy: busyId === template._id,
          onUse: () => onUse(template),
          onEdit: () => setEditing(template),
          onDelete: () => remove(template._id)
        },
        template._id
      )) })
    ] }),
    /* @__PURE__ */ jsxs("section", { "aria-label": "Platform presets", children: [
      /* @__PURE__ */ jsx("h2", { className: "mb-1 text-sm font-extrabold text-ink", children: "Platform presets" }),
      /* @__PURE__ */ jsx("p", { className: "mb-3 text-[12px] font-medium text-slate-500", children: "These four ship with SukuuPay and are the same for every school. “Edit a copy” saves your version without changing the original." }),
      /* @__PURE__ */ jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: presets.map((preset) => /* @__PURE__ */ jsx(
        TemplateCard,
        {
          template: preset,
          onUse: () => onUse(preset),
          onEdit: () => setEditing({
            name: `${preset.name} (copy)`,
            body: preset.body,
            category: preset.category
          })
        },
        preset.key
      )) })
    ] }),
    /* @__PURE__ */ jsx(
      EditTemplateModal,
      {
        open: Boolean(editing),
        template: editing,
        onClose: () => setEditing(null),
        onSave: save,
        saving
      }
    )
  ] });
};
const STATUS_TONES = {
  queued: "slate",
  submitted: "blue",
  sent: "blue",
  delivered: "green",
  failed: "red",
  failed_dlr: "red",
  rejected: "rose",
  unknown: "slate"
};
const STATUS_LABELS = {
  queued: "Queued",
  submitted: "Submitted",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed to send",
  failed_dlr: "Dropped by carrier",
  rejected: "Rejected",
  unknown: "Unknown"
};
const JOB_TONES = {
  queued: "slate",
  scheduled: "blue",
  processing: "amber",
  cancelling: "amber",
  cancelled: "slate",
  completed: "green",
  failed: "red"
};
const CATEGORY_LABELS = {
  fee_reminder: "Fee Reminder",
  overdue: "Overdue",
  final_warning: "Final Warning",
  installment_due: "Installment Due",
  payment_receipt: "Receipt",
  announcement: "Announcement",
  pta: "PTA",
  custom: "Custom"
};
const formatWhen = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};
const JobRow = ({ job, onCancel, busy }) => {
  const result = job.result || {};
  const settled = (result.sent || 0) + (result.delivered || 0);
  const cancellable = ["queued", "scheduled"].includes(job.status);
  return /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 last:border-0", children: [
    /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[12px] font-extrabold text-ink", children: CATEGORY_LABELS[job.category] || job.category }),
      /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
        formatCount(job.recipientsResolved),
        " recipient",
        job.recipientsResolved === 1 ? "" : "s",
        " ·",
        " ",
        job.audienceType?.replace(/_/g, " ")
      ] })
    ] }),
    /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
      /* @__PURE__ */ jsx(Badge, { tone: JOB_TONES[job.status] || "slate", children: job.status }),
      job.status === "processing" && /* @__PURE__ */ jsx("div", { className: "mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-slate-100", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: "h-full rounded-full bg-brand-700 transition-all",
          style: { width: `${job.progressPercent || 0}%` }
        }
      ) }),
      job.failureReason && /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-[24ch] truncate text-[10px] font-semibold text-red-600", children: job.failureReason })
    ] }),
    /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-[12px] font-semibold text-slate-600", children: settled ? /* @__PURE__ */ jsxs(Fragment, { children: [
      formatCount(result.delivered || 0),
      " delivered",
      result.failed ? `, ${formatCount(result.failed)} failed` : ""
    ] }) : "—" }),
    /* @__PURE__ */ jsxs("td", { className: "px-4 py-3 text-[12px] font-extrabold text-ink", children: [
      formatCediShort(job.creditsCharged || 0),
      job.creditsRefunded > 0 && /* @__PURE__ */ jsxs("span", { className: "block text-[10px] font-semibold text-emerald-600", children: [
        formatCediShort(job.creditsRefunded),
        " refunded"
      ] })
    ] }),
    /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-[11px] font-semibold text-slate-500", children: job.status === "scheduled" && job.scheduledAt ? `Sends ${formatWhen(job.scheduledAt)}` : formatWhen(job.createdAt) }),
    /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-right", children: cancellable && /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: onCancel,
        disabled: busy,
        className: "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50",
        children: [
          /* @__PURE__ */ jsx(Ban, { className: "h-3 w-3", "aria-hidden": "true" }),
          "Cancel"
        ]
      }
    ) })
  ] });
};
const MessageRow = ({ message }) => {
  const student = message.studentId || {};
  return /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 last:border-0", children: [
    /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
      /* @__PURE__ */ jsx("p", { className: "text-[12px] font-extrabold text-ink", children: student.studentName || "Unknown student" }),
      /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
        student.studentClass || "—",
        " · ",
        message.toMasked || message.to
      ] })
    ] }),
    /* @__PURE__ */ jsxs("td", { className: "max-w-[28ch] px-4 py-3", children: [
      /* @__PURE__ */ jsx("p", { className: "line-clamp-2 text-[11px] font-medium leading-snug text-slate-600", children: message.message }),
      message.segments > 1 && /* @__PURE__ */ jsxs("span", { className: "mt-0.5 inline-block text-[10px] font-bold text-amber-700", children: [
        message.segments,
        " parts"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
      /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES[message.status] || "slate", children: STATUS_LABELS[message.status] || message.status }),
      message.network && /* @__PURE__ */ jsx("span", { className: "mt-1 block text-[10px] font-semibold uppercase text-slate-400", children: message.network }),
      message.failureReason && /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-[22ch] truncate text-[10px] font-semibold text-red-600", children: message.failureReason })
    ] }),
    /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-[11px] font-semibold text-slate-500", children: formatWhen(message.sentAt || message.createdAt) })
  ] });
};
const EmptyRow = ({ colSpan, children }) => /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan, className: "px-4 py-10 text-center text-[12px] font-semibold text-slate-500", children }) });
const HistoryTab = ({
  jobs,
  jobsMeta,
  messages,
  messagesMeta,
  loading,
  error,
  filters,
  setFilter,
  clearFilters,
  credits,
  deliveryRate,
  usage,
  balance,
  ratePes,
  onCancelJob,
  busyJobId
}) => {
  const { warning, error: errorToast } = useToast();
  const [pendingCancel, setPendingCancel] = useState(null);
  const runCancel = async () => {
    const id = pendingCancel;
    setPendingCancel(null);
    try {
      await onCancelJob(id);
      warning("The broadcast was cancelled and its credit returned.");
    } catch (err) {
      errorToast(err?.message || "The broadcast could not be cancelled.");
    }
  };
  const hasFilters = filters.status !== "all" || filters.category !== "all" || filters.search;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Delivery Rate",
          icon: TrendingUp,
          value: deliveryRate === null ? "—" : formatPercent(deliveryRate),
          valueTone: deliveryRate === null ? "text-slate-400" : deliveryRate >= 90 ? "text-emerald-600" : "text-amber-600",
          footer: /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "Of messages the carrier has ruled on" })
        }
      ),
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Messages Sent",
          icon: Send,
          value: formatCount((usage?.sent || 0) + (usage?.delivered || 0)),
          footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            formatCount(usage?.failed || 0),
            " failed"
          ] })
        }
      ),
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Credit Used",
          icon: CircleDollarSign,
          value: formatCedi((usage?.netCharged || 0) * ratePes),
          footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            formatCount(usage?.netCharged || 0),
            " SMS",
            usage?.refunded ? `, ${formatCount(usage.refunded)} refunded` : ""
          ] })
        }
      ),
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Balance",
          icon: Wallet,
          badge: /* @__PURE__ */ jsxs(Badge, { tone: "amber", children: [
            formatCount(balance ?? 0),
            " SMS"
          ] }),
          value: formatCedi((balance ?? 0) * ratePes),
          footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
            formatCount(balance ?? 0),
            " messages remaining"
          ] })
        }
      )
    ] }),
    error && /* @__PURE__ */ jsxs("div", { role: "alert", className: "flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-600", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-red-700", children: error.message })
    ] }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Broadcasts" }),
        jobsMeta?.total > 0 && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          formatCount(jobsMeta.total),
          " total"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[720px] border-collapse", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "border-b border-slate-100 text-left", children: ["Broadcast", "Status", "Outcome", "Cost", "When", ""].map((heading) => /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            className: "px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400",
            children: heading
          },
          heading
        )) }) }),
        /* @__PURE__ */ jsxs("tbody", { children: [
          loading && /* @__PURE__ */ jsx(EmptyRow, { colSpan: 6, children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
            "Loading broadcasts…"
          ] }) }),
          !loading && !jobs.length && /* @__PURE__ */ jsx(EmptyRow, { colSpan: 6, children: "No broadcasts yet. Compose one and it will appear here with its cost and delivery outcome." }),
          !loading && jobs.map((job) => /* @__PURE__ */ jsx(
            JobRow,
            {
              job,
              busy: busyJobId === job._id,
              onCancel: () => setPendingCancel(job)
            },
            job._id
          ))
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Messages" }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-2", children: [
          /* @__PURE__ */ jsxs(
            SelectField,
            {
              label: "Status",
              className: "w-40",
              value: filters.status,
              onChange: (event) => setFilter({ status: event.target.value }),
              children: [
                /* @__PURE__ */ jsx("option", { value: "all", children: "All statuses" }),
                Object.entries(STATUS_LABELS).map(([value, label]) => /* @__PURE__ */ jsx("option", { value, children: label }, value))
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            SelectField,
            {
              label: "Category",
              className: "w-40",
              value: filters.category,
              onChange: (event) => setFilter({ category: event.target.value }),
              children: [
                /* @__PURE__ */ jsx("option", { value: "all", children: "All categories" }),
                Object.entries(CATEGORY_LABELS).map(([value, label]) => /* @__PURE__ */ jsx("option", { value, children: label }, value))
              ]
            }
          ),
          hasFilters && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: clearFilters,
              className: "mb-0.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50",
              children: "Clear"
            }
          )
        ] })
      ] }),
      messagesMeta?.statusCounts && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5", children: [
        /* @__PURE__ */ jsx(CheckCheck, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" }),
        Object.entries(messagesMeta.statusCounts).map(([status, count]) => /* @__PURE__ */ jsxs(Badge, { tone: STATUS_TONES[status] || "slate", children: [
          formatCount(count),
          " ",
          STATUS_LABELS[status]?.toLowerCase() || status
        ] }, status))
      ] }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[640px] border-collapse", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { className: "border-b border-slate-100 text-left", children: ["Recipient", "Message", "Status", "Sent"].map((heading) => /* @__PURE__ */ jsx(
          "th",
          {
            scope: "col",
            className: "px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400",
            children: heading
          },
          heading
        )) }) }),
        /* @__PURE__ */ jsxs("tbody", { children: [
          loading && /* @__PURE__ */ jsx(EmptyRow, { colSpan: 4, children: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": "true" }),
            "Loading messages…"
          ] }) }),
          !loading && !messages.length && /* @__PURE__ */ jsx(EmptyRow, { colSpan: 4, children: hasFilters ? "No messages match these filters." : "No messages yet. Every SMS this school sends is recorded here with its delivery status." }),
          !loading && messages.map((message) => /* @__PURE__ */ jsx(MessageRow, { message }, message._id))
        ] })
      ] }) }),
      messagesMeta?.totalPages > 1 && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          "Page ",
          messagesMeta.page,
          " of ",
          messagesMeta.totalPages
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-1.5", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: messagesMeta.page <= 1,
              onClick: () => setFilter({ page: messagesMeta.page - 1 }, { resetPage: false }),
              className: "rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 disabled:opacity-40",
              children: "Previous"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: messagesMeta.page >= messagesMeta.totalPages,
              onClick: () => setFilter({ page: messagesMeta.page + 1 }, { resetPage: false }),
              className: "rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 disabled:opacity-40",
              children: "Next"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        open: Boolean(pendingCancel),
        onClose: () => setPendingCancel(null),
        title: "Cancel this broadcast?",
        description: pendingCancel ? `${formatCount(pendingCancel.recipientsResolved)} parents were queued. Cancelling returns the full ${formatCediShort(pendingCancel.creditsCharged || 0)} in credit and nothing is sent.` : "",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => setPendingCancel(null), children: "Keep it queued" }),
          /* @__PURE__ */ jsx(Button, { variant: "danger", onClick: runCancel, children: "Cancel and refund" })
        ] }),
        children: /* @__PURE__ */ jsx("p", { className: "text-[13px] font-medium leading-relaxed text-slate-600", children: "A broadcast that has already started sending cannot be cancelled — messages the gateway has accepted are on their way. This one has not started." })
      }
    )
  ] });
};
const TABS = [
  { value: "compose", label: "Compose" },
  { value: "templates", label: "Templates" },
  { value: "history", label: "History" }
];
const SmsReminders = () => {
  const { user } = useAuth();
  const { success, warning, error: errorToast } = useToast();
  const [school, setSchool] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpUnits, setTopUpUnits] = useState(1e3);
  const sms = useSmsReminders();
  useEffect(() => {
    if (!user?.schoolId) return void 0;
    let active = true;
    getSchool(user.schoolId).then((result) => {
      if (active) setSchool(result);
    }).catch(() => {
      if (active) setSchool(null);
    });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);
  const classes = school?.academic?.classes || school?.classes || [];
  const handleSend = async () => {
    try {
      const result = await sms.send();
      const job = result?.job;
      if (job?.scheduledAt) {
        success(
          `Scheduled ${formatCount(job.recipients)} reminders for ${new Date(job.scheduledAt).toLocaleString("en-GB")}.`
        );
      } else {
        success(
          `Queued ${formatCount(job?.recipients || 0)} reminders. ${formatCount(job?.balanceAfter ?? 0)} SMS left.`
        );
      }
    } catch (err) {
      errorToast(err?.message || "The reminders could not be queued.");
    }
  };
  const handleSaveTemplate = async (payload, editing) => {
    try {
      await sms.saveTemplate({ ...payload, id: editing?._id });
      success("Template saved.");
    } catch (err) {
      errorToast(err?.message || "The template could not be saved.");
      throw err;
    }
  };
  const handleTopUp = async () => {
    try {
      const units = Number(topUpUnits) || 0;
      const result = await topUpSmsCredits({ schoolId: sms.schoolId, units });
      setTopUpOpen(false);
      success(
        `Added ${formatCount(result.topUp?.units ?? units)} SMS. Balance is now ${formatCount(result.balance)}.`
      );
      await sms.refreshCredits();
    } catch (err) {
      errorToast(err?.message || "The credit could not be added.");
    }
  };
  const handleDeleteTemplate = async (id) => {
    await sms.removeTemplate(id);
    success("Template deleted.");
  };
  const blocker = (() => {
    if (sms.canSend === false) return "No SMS gateway is configured on this server.";
    if (!sms.body.trim()) return "Write a message first.";
    if (sms.unknownTokens.length) return "Fix the unknown tokens in your message.";
    if (sms.overSegmentLimit) return "The message is over the 10-part limit.";
    if (sms.audienceType === "class" && !sms.classFilter) return "Pick a class.";
    if (sms.audienceType === "students" && !sms.studentIds.length) {
      return "Pick at least one student to message.";
    }
    if (sms.audienceLoading) return "Sizing the audience…";
    if (!sms.audiencePreview) return "Choose an audience to see the cost.";
    if (!sms.audiencePreview.matchCount) return "Nobody matches this audience yet.";
    if (sms.affordable === false) return "Not enough SMS credit for this audience.";
    if (!sms.confirmed) return "Confirm the recipient count to send.";
    return null;
  })();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "SMS Reminders",
        title: "Fee Reminder SMS Broadcast",
        description: "Automate and send one-click mobile money payment links directly to parents' mobile phones across Ghana.",
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          sms.credits && /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setTopUpOpen(true),
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsx(Wallet, { className: "h-4 w-4 text-slate-500", "aria-hidden": "true" }),
                formatCount(sms.credits.balance),
                " SMS left"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            Link,
            {
              to: ROUTES.DASHBOARD_PAYMENTS,
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4 text-slate-500", "aria-hidden": "true" }),
                "New Payment"
              ]
            }
          )
        ] }),
        meta: sms.credits && /* @__PURE__ */ jsxs("div", { className: "inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5", children: [
          /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-4 w-4", "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-amber-700", children: "SMS Balance" }),
            /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-ink", children: [
              formatCount(sms.credits.balance),
              " ",
              /* @__PURE__ */ jsxs("span", { className: "font-semibold text-slate-500", children: [
                "(",
                sms.credits.balanceCedis,
                ")"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setTopUpOpen(true),
              className: "ml-1 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-amber-100",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "h-3 w-3", "aria-hidden": "true" }),
                "Top Up"
              ]
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(ModuleTabs, { items: TABS, value: sms.tab, onChange: sms.setTab, ariaLabel: "SMS sections" }),
    sms.sendResult && /* @__PURE__ */ jsxs("div", { className: "mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-brand-900", children: [
        /* @__PURE__ */ jsxs("span", { className: "font-extrabold", children: [
          formatCount(sms.sendResult.job?.recipients || 0),
          " reminders queued"
        ] }),
        " ",
        "for ",
        formatCediShort(sms.sendResult.job?.creditsCharged || 0),
        " of credit.",
        " ",
        formatCount(sms.sendResult.job?.balanceAfter ?? 0),
        " SMS left. They will send",
        sms.sendResult.job?.scheduledAt ? ` on ${new Date(sms.sendResult.job.scheduledAt).toLocaleString("en-GB")}` : " shortly",
        ". Watch the outcome on the History tab."
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => sms.setTab("history"),
          className: "rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-100",
          children: "View history"
        }
      )
    ] }),
    sms.sendError && /* @__PURE__ */ jsxs("div", { role: "alert", className: "mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3", children: [
      /* @__PURE__ */ jsx(CircleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-red-600", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("p", { className: "flex-1 text-[13px] font-semibold text-red-800", children: [
        /* @__PURE__ */ jsx("span", { className: "font-extrabold", children: "The reminders were not queued." }),
        " ",
        sms.sendError.message
      ] })
    ] }),
    sms.tab === "compose" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_320px]", children: [
        /* @__PURE__ */ jsx(
          AudiencePanel,
          {
            audienceType: sms.audienceType,
            setAudienceType: sms.setAudienceType,
            audienceRules: sms.audienceRules,
            classFilter: sms.classFilter,
            setClassFilter: sms.setClassFilter,
            studentIds: sms.studentIds,
            setStudentIds: sms.setStudentIds,
            classes,
            preview: sms.audiencePreview,
            loading: sms.audienceLoading,
            error: sms.audienceError,
            excludeRecentPayers: sms.excludeRecentPayers,
            setExcludeRecentPayers: sms.setExcludeRecentPayers,
            recentPaymentWindowHours: sms.recentPaymentWindowHours,
            setRecentPaymentWindowHours: sms.setRecentPaymentWindowHours,
            dueSoonDays: sms.dueSoonDays,
            setDueSoonDays: sms.setDueSoonDays,
            gracePeriodDays: sms.gracePeriodDays,
            setGracePeriodDays: sms.setGracePeriodDays,
            minBalance: sms.minBalance,
            setMinBalance: sms.setMinBalance
          }
        ),
        /* @__PURE__ */ jsx(
          ComposerPanel,
          {
            body: sms.body,
            setBody: sms.setBody,
            category: sms.category,
            setCategory: sms.setCategory,
            tokens: sms.tokens,
            tokensInBody: sms.tokensInBody,
            unknownTokens: sms.unknownTokens,
            rendered: sms.rendered,
            segments: sms.segments,
            perSegmentLimit: sms.perSegmentLimit,
            overSegmentLimit: sms.overSegmentLimit,
            estimatedCost: sms.estimatedCost,
            affordable: sms.affordable,
            balance: sms.balance ?? 0,
            balanceAfter: sms.sendResult?.job?.balanceAfter,
            ratePes: sms.credits?.ratePes ?? 12,
            matchCount: sms.audiencePreview?.matchCount || 0,
            presets: sms.presets,
            applyTemplate: sms.applyTemplate,
            templates: sms.templates,
            templateId: sms.templateId,
            onDeleteTemplate: sms.removeTemplate,
            senderId: sms.credits?.senderId,
            creditsLoading: sms.creditsLoading
          }
        ),
        /* @__PURE__ */ jsx(
          PhonePreview,
          {
            rendered: sms.rendered,
            payLink: sms.audiencePreview?.sample?.payLink,
            amount: sms.audiencePreview?.sample?.balanceDisplay || "GHC 0.00",
            schoolName: user?.schoolName || school?.name,
            senderName: sms.credits?.senderId,
            sending: sms.sending
          }
        )
      ] }),
      /* @__PURE__ */ jsx(
        SendBar,
        {
          matchCount: sms.audiencePreview?.matchCount || 0,
          segments: sms.segments,
          estimatedCost: sms.estimatedCost,
          ratePes: sms.credits?.ratePes ?? 12,
          balance: sms.balance ?? 0,
          canQueue: sms.canQueue,
          readyToConfirm: sms.readyToConfirm,
          confirmed: sms.confirmed,
          setConfirmed: sms.setConfirmed,
          sending: sms.sending,
          onSend: handleSend,
          scheduledAt: sms.scheduledAt,
          setScheduledAt: sms.setScheduledAt,
          onReset: sms.resetComposer,
          blocker,
          canSend: sms.canSend,
          gateway: sms.gateway,
          audienceType: sms.audienceType
        }
      )
    ] }),
    sms.tab === "templates" && /* @__PURE__ */ jsx(
      TemplatesTab,
      {
        templates: sms.templates,
        presets: sms.presets,
        loading: sms.templatesLoading,
        onUse: (template) => {
          sms.applyTemplate(template);
          sms.setTab("compose");
          success(`"${template.name}" loaded into the composer.`);
        },
        onSave: handleSaveTemplate,
        onDelete: handleDeleteTemplate
      }
    ),
    sms.tab === "history" && /* @__PURE__ */ jsx(
      HistoryTab,
      {
        jobs: sms.jobs,
        jobsMeta: sms.jobsMeta,
        messages: sms.messages,
        messagesMeta: sms.messagesMeta,
        loading: sms.historyLoading,
        error: sms.historyError,
        filters: sms.historyFilters,
        setFilter: sms.setHistoryFilter,
        clearFilters: sms.clearHistoryFilters,
        credits: sms.credits,
        deliveryRate: sms.deliveryRate,
        usage: sms.usage,
        balance: sms.balance ?? 0,
        ratePes: sms.credits?.ratePes ?? 12,
        onCancelJob: sms.cancelJob,
        busyJobId: sms.busyJobId
      }
    ),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: topUpOpen,
        onClose: () => setTopUpOpen(false),
        title: "Add SMS credit",
        description: "Credit is metered in SMS. One SMS costs what the rate on your account says.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => setTopUpOpen(false), children: "Cancel" }),
          /* @__PURE__ */ jsxs(Button, { variant: "primary", onClick: handleTopUp, children: [
            "Add ",
            formatCount(Number(topUpUnits) || 0),
            " SMS"
          ] })
        ] }),
        children: [
          /* @__PURE__ */ jsxs("label", { className: "text-[11px] font-semibold text-slate-700", children: [
            "SMS credits to add",
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: "1",
                step: "100",
                value: topUpUnits,
                onChange: (event) => setTopUpUnits(event.target.value),
                className: "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-[12px] font-medium leading-relaxed text-slate-500", children: "This records credit against the school. Payment for it happens in the Payments module — the reference you pass links the two, so a bursar can reconcile what they bought against what they sent." })
        ]
      }
    )
  ] });
};
const Rate = ({ value, expected, className = "" }) => {
  if (!expected) {
    return /* @__PURE__ */ jsx("span", { className: `text-slate-400 ${className}`, title: "Nothing was billed, so there is no rate to calculate", children: "—" });
  }
  return /* @__PURE__ */ jsx("span", { className, children: formatPercent(value) });
};
const formatDate = (value) => {
  if (!value) return "—";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "—";
  return when.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const SECTIONS$1 = {
  daily: "Daily collections",
  term: "Term summary",
  outstanding: "Outstanding balances",
  overdue: "Overdue installments",
  "payment-methods": "Payment methods",
  "class-collections": "Class collections",
  compliance: "Installment compliance",
  "headmaster-monthly": "Headteacher summary",
  "parent-contacts": "Parent contacts"
};
const ReportBody = ({ report, data }) => {
  const s = data.summary || {};
  if (report === "headmaster-monthly") {
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
        { label: "Collected this month", value: s.collectedDisplay },
        { label: "Collected last month", value: formatCedi(s.previousCollected) },
        {
          label: "Change",
          value: formatCedi(s.monthOnMonthChange),
          tone: s.monthOnMonthChange < 0 ? "text-red-600" : "text-emerald-700"
        },
        { label: "Outstanding", value: s.totalOutstandingDisplay }
      ].map((tile) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: `mt-1 text-[15px] font-extrabold ${tile.tone || "text-ink"}`, children: tile.value ?? "—" })
      ] }, tile.label)) }),
      /* @__PURE__ */ jsx("dl", { className: "divide-y divide-slate-100", children: data.rows.map((row) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4 py-2", children: [
        /* @__PURE__ */ jsx("dt", { className: "text-[13px] font-semibold text-slate-600", children: row.metric }),
        /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-ink", children: row.display })
      ] }, row.metric)) }),
      /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
        /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx("span", { children: "“Collected this month” is one calendar month. “Total expected” and “Total collected to date” are lifetime figures across every enrolled student, so the collection rate below is a lifetime rate — not this month’s." })
      ] })
    ] });
  }
  if (report === "payment-methods") {
    const max = Math.max(...(data.rows || []).map((r) => r.amount), 0);
    return /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "mb-3 text-[12px] font-semibold text-slate-500", children: `${formatCount(s.transactionCount)} completed payments · ${formatCedi(s.totalCollected)}` }),
      /* @__PURE__ */ jsx("div", { className: "space-y-2.5", children: (data.rows || []).map((row) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between gap-3 text-[12px]", children: [
          /* @__PURE__ */ jsx("span", { className: "font-bold text-ink", children: row.label }),
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-slate-600", children: formatCedis(row.amount) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "h-2 flex-1 overflow-hidden rounded-full bg-slate-100", children: /* @__PURE__ */ jsx(
            "div",
            {
              className: "h-full rounded-full bg-brand-700",
              style: { width: `${max ? row.amount / max * 100 : 0}%` }
            }
          ) }),
          /* @__PURE__ */ jsx("span", { className: "w-11 shrink-0 text-right text-[11px] font-bold text-slate-500", children: formatPercent(row.percentage) })
        ] })
      ] }, row.label)) }),
      data.period?.groupBy === "term" && /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] font-medium text-slate-500", children: "Grouped by calendar quarter, which is not the school’s academic term. Use the Term Collection report for terms." })
    ] });
  }
  if (report === "class-collections" || report === "term") {
    const rows2 = data.rows || [];
    const windowed = report === "class-collections" && Boolean(data.period?.startDate || data.period?.endDate);
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
        { label: report === "term" ? "Students" : "Classes", value: formatCount(report === "term" ? s.studentCount : s.classCount) },
        { label: "Expected", value: report === "term" ? s.expectedDisplay : s.totalExpectedDisplay },
        { label: "Collected", value: report === "term" ? s.collectedToDateDisplay : s.totalCollectedDisplay },
        { label: "Outstanding", value: report === "term" ? s.outstandingDisplay : s.totalBalanceDisplay }
      ].map((tile) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: tile.value ?? "—" })
      ] }, tile.label)) }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-[12px]", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500", children: [
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Class" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Students" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Expected" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: windowed ? "Collected in window" : "Collected" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Balance" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Rate" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-slate-100", children: rows2.map((row) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "py-2 font-bold text-ink", children: row.className }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCount(row.studentCount) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCediWhole(row.expected) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCediWhole(row.collected) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-bold text-ink", children: formatCediWhole(row.balance) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right", children: /* @__PURE__ */ jsx(Rate, { value: row.collectionRate, expected: row.expected, className: "font-bold text-slate-600" }) })
        ] }, row.className)) })
      ] }) }),
      windowed && /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px]/[16px] font-medium text-amber-700", children: [
        /* @__PURE__ */ jsx(AlertTriangle, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx("span", { children: "A date window is applied, so “collected in window” counts payments inside those dates while “expected” is still the lifetime total. The rate is therefore a window rate against a lifetime denominator and is not a true collection rate." })
      ] })
    ] });
  }
  if (report === "outstanding") {
    const rows2 = data.rows || [];
    const aged = rows2.some((row) => row.oldestDueDate);
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
        { label: "Debtors", value: formatCount(s.studentCount) },
        { label: "Total outstanding", value: s.totalOutstandingDisplay },
        { label: "Nothing paid", value: formatCount(s.fullyUnpaidCount) },
        { label: "Part paid", value: formatCount(s.partiallyPaidCount) }
      ].map((tile) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: tile.value ?? "—" })
      ] }, tile.label)) }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-[12px]", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500", children: [
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Student" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Class" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Billed" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Paid" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Balance" }),
          aged && /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Oldest due" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Guardian" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-slate-100", children: rows2.map((row) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "py-2 font-bold text-ink", children: row.studentName }),
          /* @__PURE__ */ jsx("td", { className: "py-2 font-semibold text-slate-500", children: row.studentClass || "—" }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCediWhole(row.totalOwed) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCediWhole(row.totalPaid) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-extrabold text-ink", children: formatCediWhole(row.balance) }),
          aged && /* @__PURE__ */ jsxs("td", { className: "py-2 text-right font-bold text-slate-600", children: [
            row.oldestDueDate ? formatDate(row.oldestDueDate) : "—",
            row.daysOutstanding != null && /* @__PURE__ */ jsxs("span", { className: "ml-1 text-[10px] text-slate-400", children: [
              row.daysOutstanding,
              "d"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("td", { className: "py-2 font-semibold text-slate-500", children: [
            row.primaryParentName || "—",
            row.primaryParentPhone && /* @__PURE__ */ jsx("span", { className: "ml-1 font-mono text-[10px] text-slate-400", children: row.primaryParentPhone })
          ] })
        ] }, row._id)) })
      ] }) })
    ] });
  }
  if (report === "overdue") {
    const rows2 = data.rows || [];
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
        { label: "Students overdue", value: formatCount(s.totalOverdue), tone: "text-ink" },
        { label: "Amount overdue", value: s.totalOverdueAmountDisplay, tone: "text-ink" },
        { label: "Critical (14d+)", value: formatCount(s.criticalCount), tone: "text-red-600" },
        { label: "Average days", value: s.avgDaysOverdue, tone: "text-amber-600" }
      ].map((tile) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: `mt-1 text-[15px] font-extrabold ${tile.tone}`, children: tile.value ?? "—" })
      ] }, tile.label)) }),
      /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: rows2.map((row) => /* @__PURE__ */ jsxs("li", { className: "py-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-ink", children: [
            row.studentName,
            /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-[11px] font-semibold text-slate-400", children: row.studentClass || "Unassigned" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxs(Badge, { tone: row.severity === "critical" ? "red" : "amber", children: [
              formatCount(row.daysOverdue),
              " days overdue"
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-[13px] font-extrabold text-ink", children: formatCedi(row.totalOverdueAmount) })
          ] })
        ] }),
        row.installments?.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-2 space-y-1", children: row.installments.map((inst) => /* @__PURE__ */ jsxs(
          "li",
          {
            className: "flex flex-wrap items-center gap-x-3 text-[11px] font-medium text-slate-500",
            children: [
              /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-600", children: `Tranche ${inst.installmentNumber}` }),
              /* @__PURE__ */ jsxs("span", { children: [
                "due ",
                formatDate(inst.dueDate)
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                formatCedi(inst.outstanding),
                " outstanding"
              ] }),
              inst.amountPaid > 0 && /* @__PURE__ */ jsxs("span", { className: "text-emerald-700", children: [
                formatCedi(inst.amountPaid),
                " paid"
              ] })
            ]
          },
          inst.installmentNumber
        )) })
      ] }, `${row.studentId}-${row.planId ?? row.planName}`)) })
    ] });
  }
  if (report === "compliance") {
    const buckets = [
      { key: "completed", label: "Completed", tone: "green" },
      { key: "onTrack", label: "On track", tone: "green" },
      { key: "approachingDue", label: "Approaching due", tone: "amber" },
      { key: "overdue", label: "Overdue", tone: "red" },
      { key: "defaulted", label: "Defaulted", tone: "rose" },
      { key: "pendingAcceptance", label: "Pending acceptance", tone: "slate" }
    ];
    const total = s.totalPlans || 0;
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "On-time tranche execution" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1.5 flex items-baseline gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-2xl font-extrabold text-ink", children: /* @__PURE__ */ jsx(Rate, { value: s.overallComplianceRate, expected: s.totalInstallments }) }),
          /* @__PURE__ */ jsx("span", { className: "text-[12px] font-semibold text-slate-500", children: `${formatCount(s.paidOnTime)} of ${formatCount(s.totalInstallments)} tranches` })
        ] })
      ] }),
      total > 0 && /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100", children: buckets.map(({ key, tone }) => {
          const value = s[key] || 0;
          if (!value) return null;
          const colour = {
            green: "bg-emerald-500",
            amber: "bg-amber-500",
            red: "bg-red-500",
            rose: "bg-rose-500",
            slate: "bg-slate-400"
          }[tone];
          return /* @__PURE__ */ jsx(
            "div",
            {
              className: colour,
              style: { width: `${value / total * 100}%` },
              title: `${key}: ${value}`
            },
            key
          );
        }) }),
        /* @__PURE__ */ jsx("div", { className: "mt-2.5 flex flex-wrap gap-x-4 gap-y-1", children: buckets.map(({ key, label, tone }) => /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[11px] font-bold text-slate-600", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: `h-2 w-2 rounded-full ${{ green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", rose: "bg-rose-500", slate: "bg-slate-400" }[tone]}`
            }
          ),
          label,
          /* @__PURE__ */ jsx("span", { className: "text-slate-400", children: formatCount(s[key] || 0) })
        ] }, key)) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-[12px]", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500", children: [
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Plan" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Student" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Tranches" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "On time" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Rate" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-slate-100", children: (data.rows || []).map((row) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { className: "py-2 font-bold text-ink", children: row.planName }),
          /* @__PURE__ */ jsxs("td", { className: "py-2 font-semibold text-slate-500", children: [
            row.studentName,
            row.studentClass ? ` · ${row.studentClass}` : ""
          ] }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCount(row.totalInstallments) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-semibold text-slate-600", children: formatCount(row.installmentsPaidOnTime) }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right", children: /* @__PURE__ */ jsx(Rate, { value: row.complianceRate, expected: row.totalInstallments, className: "font-bold text-slate-600" }) })
        ] }, row.planId)) })
      ] }) }),
      /* @__PURE__ */ jsx("p", { className: "text-[11px]/[16px] font-medium text-slate-500", children: "A plan is bucketed as overdue if any tranche is overdue, and as approaching due if its next pending tranche falls within three days. The bucket therefore changes between fetches without anything being edited." })
    ] });
  }
  if (report === "parent-contacts") {
    const rows2 = data.rows || [];
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
        { label: "Students", value: formatCount(s.studentCount) },
        { label: "Contacts", value: formatCount(s.contactCount) },
        { label: "Unique numbers", value: formatCount(s.uniquePhoneCount) },
        { label: "Students owing", value: formatCount(s.studentsOwing) }
      ].map((tile) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: tile.value ?? "—" })
      ] }, tile.label)) }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-[12px]", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500", children: [
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Student" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Guardian" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Phone" }),
          /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Balance" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-slate-100", children: rows2.map((row, index) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsxs("td", { className: "py-2 font-bold text-ink", children: [
            row.studentName,
            /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-[11px] font-semibold text-slate-400", children: row.studentClass || "Unassigned" })
          ] }),
          /* @__PURE__ */ jsxs("td", { className: "py-2 font-semibold text-slate-600", children: [
            row.parentName,
            /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-[11px] font-normal capitalize text-slate-400", children: row.relationship }),
            row.isPrimary && /* @__PURE__ */ jsx(Badge, { tone: "blue", className: "ml-1.5", children: "Primary" })
          ] }),
          /* @__PURE__ */ jsx("td", { className: "py-2 font-mono text-[11px] text-slate-500", children: row.phone }),
          /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-extrabold text-ink", children: formatCediWhole(row.balance) })
        ] }, `${row.studentRef}-${row.parentName}-${index}`)) })
      ] }) }),
      /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
        /* @__PURE__ */ jsx(ShieldCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx("span", { children: "Numbers are masked by the server and there is no endpoint that returns them unmasked, so this directory cannot be used to contact a guardian from here. Export it and use your own channel of record." })
      ] })
    ] });
  }
  const rows = data.rows || [];
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Collected" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: s.totalCollectedDisplay })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Transactions on this page" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: formatCount(s.transactionCount) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 p-3", children: [
        /* @__PURE__ */ jsx("p", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-500", children: "Average payment" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-[15px] font-extrabold text-ink", children: formatCedi(s.averagePayment) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "text-[12px] font-semibold text-slate-500", children: `${formatCount(data.meta?.total ?? rows.length)} transactions matched this day` }),
    /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-[12px]", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500", children: [
        /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Receipt" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Student" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 font-extrabold", children: "Method" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 text-right font-extrabold", children: "Amount" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-slate-100", children: rows.map((row) => /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("td", { className: "py-2 font-mono text-[11px] text-slate-500", children: row.receiptNumber || "—" }),
        /* @__PURE__ */ jsxs("td", { className: "py-2 font-bold text-ink", children: [
          row.studentName,
          row.studentClass ? /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-[11px] font-semibold text-slate-400", children: row.studentClass }) : null
        ] }),
        /* @__PURE__ */ jsx("td", { className: "py-2 font-semibold capitalize text-slate-500", children: row.paymentMethod?.replace("_", " ") }),
        /* @__PURE__ */ jsx("td", { className: "py-2 text-right font-extrabold text-ink", children: formatCedi(row.amount) })
      ] }, row._id)) })
    ] }) }),
    data.byMethod?.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: data.byMethod.map((m) => /* @__PURE__ */ jsx(Badge, { tone: "slate", children: `${m.paymentMethod} · ${m.count} · ${formatCedis(m.amount)}` }, m.paymentMethod)) })
  ] });
};
const Reports = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const setCategory = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete("category");
    else next.set("category", key);
    setSearchParams(next, { replace: true });
  };
  const setQuery = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };
  const buildParams = useCallback(
    (report) => {
      const params = {};
      const silent = new Set(report.silentParams || []);
      if (report.supports.includes("date")) {
        params.date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      }
      if (report.supports.includes("academicYear") && !silent.has("academicYear")) {
        params.academicYear = user?.school?.academic?.currentYear || "";
      }
      if (report.supports.includes("term") && !silent.has("term")) {
        params.term = user?.school?.academic?.currentTerm || "";
      }
      if (report.ageingNeedsMinAgeDays) {
        params.minAgeDays = 1;
      }
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });
      return params;
    },
    [user]
  );
  const generate = useCallback(
    async (report) => {
      if (!schoolId || busy) return;
      setBusy(report.key);
      setOpenReport(report.key);
      try {
        const data = await runReport({
          schoolId,
          endpoint: report.endpoint,
          params: buildParams(report)
        });
        setResults((current) => ({ ...current, [report.key]: data }));
        if (openReport !== report.key) setOpenReport(report.key);
      } catch (error) {
        toast.error(error.message);
        setResults((current) => ({ ...current, [report.key]: { error: error.message } }));
      } finally {
        setBusy(null);
      }
    },
    [schoolId, busy, buildParams, openReport, toast]
  );
  const download = useCallback(
    async (report, format) => {
      setDownloading(`${report.key}:${format}`);
      try {
        const result = await downloadReport({
          schoolId,
          endpoint: report.endpoint,
          format,
          params: buildParams(report)
        });
        toast.success(`Downloaded ${result.filename}`);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setDownloading(null);
      }
    },
    [schoolId, buildParams, toast]
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return REPORTS.filter((report) => {
      if (category !== "all" && report.category !== category) return false;
      if (!term) return true;
      return [report.name, report.blurb, report.cadence].filter(Boolean).some((value) => value.toLowerCase().includes(term));
    });
  }, [category, query]);
  const counts = useMemo(() => {
    const byCategory = { collections: 0, arrears: 0, institutional: 0 };
    REPORTS.forEach((report) => {
      byCategory[report.category] += 1;
    });
    return { total: REPORTS.length, byCategory };
  }, []);
  const activeResult = openReport ? results[openReport] : null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Administration",
        title: "Reports & Financial Auditing",
        description: "Generate, schedule and export accredited school fee collections, reconciliation and audit reports.",
        actions: /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600", children: [
          /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-brand-700", "aria-hidden": "true" }),
          counts.total,
          " reports available"
        ] })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "mb-5 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5", role: "tablist", "aria-label": "Report categories", children: REPORT_CATEGORIES.map((item) => {
        const isActive = item.key === category;
        const count = item.key === "all" ? counts.total : counts.byCategory[item.key];
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": isActive,
            onClick: () => setCategory(item.key),
            className: `rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors ${isActive ? "bg-brand-700 text-white shadow-lift" : "bg-white text-slate-600 hover:bg-slate-50"}`,
            children: [
              item.label,
              /* @__PURE__ */ jsx("span", { className: isActive ? "ml-1.5 text-white/70" : "ml-1.5 text-slate-400", children: count })
            ]
          },
          item.key
        );
      }) }),
      /* @__PURE__ */ jsxs("div", { className: "relative ml-auto min-w-[200px] max-w-xs flex-1", children: [
        /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400", children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4", "aria-hidden": "true" }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "search",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: "Search reports…",
            "aria-label": "Search reports",
            className: "w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
          }
        )
      ] })
    ] }),
    visible.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-base font-extrabold text-ink", children: [
        "No reports match “",
        query,
        "”"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-medium text-slate-500", children: "Try a different term, or clear the category filter." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", children: visible.map((report) => {
      const result = results[report.key];
      const isOpen = openReport === report.key;
      const isBusy = busy === report.key;
      return /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "flex flex-col", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-1 flex-col p-5", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700", children: report.category === "arrears" ? /* @__PURE__ */ jsx(AlertTriangle, { className: "h-4 w-4", "aria-hidden": "true" }) : report.category === "collections" ? /* @__PURE__ */ jsx(TrendingUp, { className: "h-4 w-4", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Users, { className: "h-4 w-4", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsx(Badge, { tone: isOpen ? "brand" : "slate", children: report.cadence })
          ] }),
          /* @__PURE__ */ jsx("h3", { className: "mt-3.5 text-[15px] font-extrabold leading-snug text-ink", children: report.name }),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 flex-1 text-[12px]/[18px] font-medium text-slate-500", children: report.blurb }),
          result && !result.error && /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [
            result.meta?.generatedAt && /* @__PURE__ */ jsx(Badge, { tone: "slate", icon: Clock, children: new Date(result.meta.generatedAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit"
            }) }),
            result.summary?.totalCollectedDisplay && /* @__PURE__ */ jsx(Badge, { tone: "green", children: result.summary.totalCollectedDisplay }),
            result.summary?.totalOutstandingDisplay && /* @__PURE__ */ jsx(Badge, { tone: "amber", children: result.summary.totalOutstandingDisplay })
          ] }),
          result?.error && /* @__PURE__ */ jsx("p", { className: "mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700", children: result.error })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-t border-slate-100 p-4", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => generate(report),
              disabled: isBusy || !schoolId,
              className: "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 text-[12px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:opacity-50",
              children: [
                isBusy ? /* @__PURE__ */ jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": "true" }) : /* @__PURE__ */ jsx(BarChart3, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                isBusy ? "Generating…" : "Generate now"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => download(report, "csv"),
              disabled: downloading?.startsWith(report.key) || !schoolId,
              "aria-label": `Download ${report.name} as CSV`,
              title: "Download CSV",
              className: "rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink disabled:opacity-50",
              children: /* @__PURE__ */ jsx(Receipt, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => download(report, "excel"),
              disabled: downloading?.startsWith(report.key) || !schoolId,
              "aria-label": `Download ${report.name} as Excel`,
              title: "Download Excel",
              className: "rounded-xl border border-slate-200 px-2.5 py-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink disabled:opacity-50",
              children: /* @__PURE__ */ jsx(FileSpreadsheet, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
            }
          )
        ] })
      ] }, report.key);
    }) }),
    openReport && activeResult && !activeResult.error && /* @__PURE__ */ jsxs(Card, { className: "mt-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: REPORTS.find((r) => r.key === openReport)?.name }),
          /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px]/[18px] font-medium text-slate-500", children: [
            activeResult.school?.name,
            activeResult.period?.month ? ` · ${activeResult.period.month}` : "",
            activeResult.period?.academicYear ? ` · ${activeResult.period.academicYear}` : "",
            activeResult.period?.class ? ` · ${activeResult.period.class}` : "",
            ` · ${SECTIONS$1[activeResult.report] || ""}`
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setOpenReport(null),
            "aria-label": "Close report",
            className: "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink",
            children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4", "aria-hidden": "true" })
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(ReportBody, { report: activeResult.report, data: activeResult }) })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-5 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
      /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxs("span", { children: [
        "Reports are generated from live school data on demand — nothing is pre-computed and nothing is scheduled. PDF export is not available yet; CSV and Excel are. Figures are whole pesewas on the wire and are formatted to cedis here, so GH₵ 425,000 is 42,500,000 pesewas. Every figure is traceable in the",
        " ",
        /* @__PURE__ */ jsx(Link, { to: ROUTES.DASHBOARD_ACTIVITY, className: "font-bold text-brand-700 hover:underline", children: "audit trail" }),
        "."
      ] })
    ] })
  ] });
};
const listAuditLogs = async ({ schoolId, ...params } = {}) => {
  try {
    const { data } = await api.get(`/audit-logs/${schoolId}`, { params });
    return {
      entries: data.data || [],
      meta: data.meta || { page: 1, perPage: 20, total: 0, totalPages: 0 }
    };
  } catch (error) {
    throw toApiError(error, "Failed to load the audit trail.");
  }
};
const exportAuditLogsCsv = async ({ schoolId, ...filters } = {}) => {
  try {
    const response = await api.get(`/audit-logs/${schoolId}/export`, {
      params: filters,
      responseType: "blob"
    });
    const disposition = response.headers?.["content-disposition"] || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    const filename = match ? match[1] : `audit-log-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
    const href = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    return { filename };
  } catch (error) {
    throw toApiError(error, "Could not export the audit trail.");
  }
};
const AUDIT_ACTIONS = [
  "student.create",
  "student.update",
  "student.delete",
  "payment.success",
  "payment.failed",
  "plan.create",
  "plan.accept",
  "plan.cancel",
  "sms.send",
  "school.update",
  "user.login",
  "user.invite",
  "settings.update",
  "markup.update",
  "gateway_mode.update",
  "whatsapp.send",
  "whatsapp.bulk_send",
  "whatsapp.template_create",
  "webhook.received",
  "sms.dlr_update",
  "sms.bulk_send",
  "sms.job_cancel",
  "sms.template_create",
  "sms.template_update",
  "sms.template_delete",
  "sms.credit_topup",
  "sms.test_send",
  "report.viewed"
];
const AUDIT_CATEGORY = {
  finance: "Finance",
  messaging: "Messaging",
  academic: "Academic",
  security: "Security"
};
const auditCategoryOf = (action = "") => {
  const [domain, verb] = action.split(".");
  if (action.startsWith("payment.") || action.startsWith("plan.") || action.startsWith("markup.")) {
    return "finance";
  }
  if (action.startsWith("sms.") || action.startsWith("whatsapp.") || action.startsWith("webhook.")) {
    return "messaging";
  }
  if (action.startsWith("student.")) return "academic";
  if (domain === "user" || domain === "school" || domain === "settings" || domain === "gateway_mode") {
    return "security";
  }
  return null;
};
const onlySet = (params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value != null));
const useAuditLogs = ({ schoolId, reloadKey = 0 } = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      userId: searchParams.get("userId") || "",
      action: searchParams.get("action") || "",
      entity: searchParams.get("entity") || "",
      entityId: searchParams.get("entityId") || "",
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      page: Number(searchParams.get("page")) || 1,
      perPage: 50
    }),
    [searchParams]
  );
  const [state, setState] = useState({ entries: [], meta: null, loading: true, error: null });
  useEffect(() => {
    if (!schoolId) {
      setState({ entries: [], meta: null, loading: false, error: null });
      return void 0;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listAuditLogs({ schoolId, ...onlySet(filters) }).then((result) => {
      if (!active) return;
      setState({ entries: result.entries, meta: result.meta, loading: false, error: null });
    }).catch((error) => {
      if (!active) return;
      setState({ entries: [], meta: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [schoolId, filters, reloadKey]);
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);
  const hasFilters = Boolean(
    filters.userId || filters.action || filters.entity || filters.entityId || filters.from || filters.to
  );
  return { ...state, filters, setFilter, clearFilters, hasFilters };
};
const useAuditStats = (entries, meta) => useMemo(() => {
  const counts = { finance: 0, messaging: 0, academic: 0, security: 0 };
  entries.forEach((entry) => {
    const category = auditCategoryOf(entry.action);
    if (category) counts[category] += 1;
  });
  return {
    totalOnRecord: meta?.total ?? 0,
    onThisPage: entries.length,
    byCategory: counts
  };
}, [entries, meta]);
const useAuditExport = ({ schoolId, filters }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const runExport = useCallback(async () => {
    if (!schoolId || exporting) return null;
    setExporting(true);
    setError(null);
    try {
      const { page, perPage, ...rest } = filters;
      return await exportAuditLogsCsv({ schoolId, ...onlySet(rest) });
    } catch (exportError) {
      setError(exportError);
      return null;
    } finally {
      setExporting(false);
    }
  }, [schoolId, exporting, filters]);
  return { runExport, exporting, error };
};
const humaniseAction = (action = "") => {
  const [, verb] = action.split(".");
  const phrase = (verb || action).replace(/_/g, " ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};
const CATEGORY_STYLE = {
  finance: { dot: "bg-emerald-500", label: AUDIT_CATEGORY.finance },
  messaging: { dot: "bg-amber-500", label: AUDIT_CATEGORY.messaging },
  academic: { dot: "bg-blue-500", label: AUDIT_CATEGORY.academic },
  security: { dot: "bg-rose-500", label: AUDIT_CATEGORY.security }
};
const formatStamp = (value) => {
  if (!value) return "—";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "—";
  const today2 = /* @__PURE__ */ new Date();
  const sameDay = when.getFullYear() === today2.getFullYear() && when.getMonth() === today2.getMonth() && when.getDate() === today2.getDate();
  const time = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today · ${time}` : `${when.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${time}`;
};
const MetaChips = ({ meta }) => {
  const chips = [];
  if (!meta || typeof meta !== "object") return null;
  if (meta.description) chips.push({ tone: "slate", text: String(meta.description) });
  if (meta.emailSent === false) {
    chips.push({ tone: "red", text: `Email not delivered${meta.failureReason ? ` — ${meta.failureReason}` : ""}` });
  }
  if (meta.isResend) chips.push({ tone: "amber", text: "Re-sent" });
  if (meta.recipients) chips.push({ tone: "slate", text: `${meta.recipients} recipients` });
  if (meta.delivered) chips.push({ tone: "slate", text: `${meta.delivered} delivered` });
  const described = new Set(chips.flatMap((chip) => chip.text.split(/[:—]/).map((s) => s.trim())));
  Object.entries(meta).filter(([key, value]) => {
    if (["description", "failureReason", "emailSent", "isResend"].includes(key)) return false;
    if (value === null || value === void 0 || typeof value === "object") return false;
    return !described.has(String(value));
  }).slice(0, 4).forEach(([key, value]) => chips.push({ tone: "slate", text: `${key}: ${value}` }));
  if (!chips.length) return null;
  return /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: chips.map((chip) => /* @__PURE__ */ jsx(Badge, { tone: chip.tone, children: chip.text }, chip.text)) });
};
const ActivityLog = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;
  const [reloadKey, setReloadKey] = useState(0);
  const { entries, meta, loading, error, filters, setFilter, clearFilters, hasFilters } = useAuditLogs({
    schoolId,
    reloadKey
  });
  const stats = useAuditStats(entries, meta);
  const { runExport, exporting } = useAuditExport({ schoolId, filters });
  const reload = () => setReloadKey((key) => key + 1);
  const handleExport = async () => {
    const result = await runExport();
    if (result) toast.success(`Exported ${result.filename}`);
    else toast.error("Could not export the audit trail. Check the filters and try again.");
  };
  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? 1;
  const tiles = useMemo(
    () => [
      {
        label: "Audited events on record",
        value: stats.totalOnRecord,
        detail: "Whole log, unpaginated",
        icon: ScrollText,
        tone: "text-ink"
      },
      {
        label: "Security & permissions",
        value: stats.byCategory.security || 0,
        detail: `of the ${stats.onThisPage} on this page`,
        icon: ShieldCheck,
        tone: "text-rose-600"
      },
      {
        label: "Messaging events",
        value: stats.byCategory.messaging || 0,
        detail: `of the ${stats.onThisPage} on this page`,
        icon: Clock,
        tone: "text-amber-600"
      },
      {
        label: "Flagged",
        value: null,
        detail: "No tamper-evidence model",
        icon: AlertTriangle,
        tone: "text-slate-400"
      }
    ],
    [stats]
  );
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Administration",
        title: "Activity Log & Audit Trail",
        description: "Immutable, timestamped record of every financial transaction, student modification and administrative action.",
        actions: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: reload,
              disabled: loading,
              className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(RefreshCw, { className: `h-4 w-4 ${loading ? "animate-spin" : ""}`, "aria-hidden": "true" }),
                "Refresh"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: handleExport,
              disabled: exporting || !schoolId,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": "true" }),
                exporting ? "Exporting…" : "Export CSV"
              ]
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4", children: tiles.map((tile) => /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: `mt-1.5 text-2xl font-extrabold tracking-tight ${tile.tone}`, children: loading ? "—" : tile.value === null ? "—" : tile.value }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 truncate text-[10px] font-semibold text-slate-400", children: tile.detail })
      ] }),
      /* @__PURE__ */ jsx(tile.icon, { className: "h-5 w-5 shrink-0 text-slate-300", "aria-hidden": "true" })
    ] }) }, tile.label)) }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-slate-100 p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative min-w-[180px] flex-1", children: [
          /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400", children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4", "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: filters.entity,
              onChange: (event) => setFilter({ entity: event.target.value }),
              placeholder: "Filter by record type (Student, Payment, User…)",
              "aria-label": "Filter by record type",
              className: "w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filters.action,
            onChange: (event) => setFilter({ action: event.target.value }),
            "aria-label": "Filter by action",
            className: "cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All actions" }),
              AUDIT_ACTIONS.map((action) => /* @__PURE__ */ jsx("option", { value: action, children: action }, action))
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "audit-from", className: "text-[11px] font-bold text-slate-500", children: "From" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: "audit-from",
              type: "date",
              value: filters.from ? filters.from.slice(0, 10) : "",
              onChange: (event) => setFilter({ from: event.target.value }),
              className: "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink focus:border-brand-700 focus:outline-none"
            }
          ),
          /* @__PURE__ */ jsx("label", { htmlFor: "audit-to", className: "text-[11px] font-bold text-slate-500", children: "to" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: "audit-to",
              type: "date",
              value: filters.to ? filters.to.slice(0, 10) : "",
              onChange: (event) => setFilter({ to: event.target.value }),
              className: "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-medium text-ink focus:border-brand-700 focus:outline-none"
            }
          )
        ] }),
        hasFilters && /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: clearFilters,
            className: "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink",
            children: [
              /* @__PURE__ */ jsx(Filter, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
              "Clear"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-2", children: [
        /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Ledger stream" }),
        Object.entries(CATEGORY_STYLE).map(([key, style]) => /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[11px] font-bold text-slate-600", children: [
          /* @__PURE__ */ jsx("span", { className: `h-2 w-2 rounded-full ${style.dot}`, "aria-hidden": "true" }),
          style.label
        ] }, key)),
        /* @__PURE__ */ jsxs("span", { className: "ml-auto text-[11px] font-medium text-slate-500", children: [
          "Newest first · ",
          meta?.total ?? 0,
          " entries"
        ] })
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700", children: error.message }),
      loading && /* @__PURE__ */ jsx("div", { className: "px-4 py-16 text-center text-sm font-semibold text-slate-500", children: "Loading the ledger…" }),
      !loading && !error && entries.length === 0 && /* @__PURE__ */ jsx("div", { className: "p-6", children: /* @__PURE__ */ jsx(
        EmptyState,
        {
          icon: ScrollText,
          title: hasFilters ? "No entries match these filters" : "No activity recorded yet",
          description: hasFilters ? "Widen the date range or clear the filters. The export button applies the same filters, so it would return the same empty set." : "Every payment, student record change and administrative action will appear here as it happens.",
          action: hasFilters ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: clearFilters,
              className: "rounded-lg px-3 py-2 text-[13px] font-bold text-brand-700 transition-colors hover:bg-brand-50",
              children: "Clear filters"
            }
          ) : null
        }
      ) }),
      !loading && !error && entries.length > 0 && /* @__PURE__ */ jsx("ul", { className: "divide-y divide-slate-100", children: entries.map((entry) => {
        const category = auditCategoryOf(entry.action);
        const style = CATEGORY_STYLE[category];
        const actor = entry.userId;
        return /* @__PURE__ */ jsxs("li", { className: "flex gap-3 px-4 py-3.5 hover:bg-slate-50/50", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: `mt-1.5 h-2 w-2 shrink-0 rounded-full ${style ? style.dot : "bg-slate-300"}`,
              "aria-label": style ? style.label : "Uncategorised",
              title: style ? style.label : "Uncategorised"
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-baseline gap-x-2 gap-y-1", children: [
              /* @__PURE__ */ jsx("span", { className: "text-[13px] font-extrabold text-ink", children: humaniseAction(entry.action) }),
              /* @__PURE__ */ jsx("span", { className: "rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600", children: entry.action }),
              /* @__PURE__ */ jsx("span", { className: "text-[11px] font-medium text-slate-400", children: formatStamp(entry.createdAt) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600", children: [
              /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5", children: [
                /* @__PURE__ */ jsx(User, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" }),
                actor?.name || "System",
                actor?.role ? /* @__PURE__ */ jsxs("span", { className: "text-slate-400", children: [
                  "(",
                  actor.role,
                  ")"
                ] }) : null
              ] }),
              entry.entity && /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1", children: [
                /* @__PURE__ */ jsx(ArrowRight, { className: "h-3 w-3 text-slate-300", "aria-hidden": "true" }),
                entry.entity,
                entry.entityId ? /* @__PURE__ */ jsx("span", { className: "font-mono text-[10px] text-slate-400", children: String(entry.entityId).slice(-8) }) : null
              ] }),
              entry.ip && /* @__PURE__ */ jsx("span", { className: "font-mono text-[11px] text-slate-400", children: entry.ip })
            ] }),
            /* @__PURE__ */ jsx(MetaChips, { meta: entry.meta })
          ] })
        ] }, entry._id);
      }) }),
      meta && meta.total > 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-medium text-slate-500", children: [
          "Showing ",
          (meta.page - 1) * meta.perPage + 1,
          "–",
          Math.min(meta.page * meta.perPage, meta.total),
          " of ",
          meta.total
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setFilter({ page: currentPage - 1 }, { resetPage: false }),
              disabled: currentPage <= 1 || loading,
              className: "rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40",
              children: "Previous"
            }
          ),
          /* @__PURE__ */ jsxs("span", { className: "text-[12px] font-bold text-slate-700", children: [
            "Page ",
            currentPage,
            " of ",
            totalPages
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setFilter({ page: currentPage + 1 }, { resetPage: false }),
              disabled: currentPage >= totalPages || loading,
              className: "rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40",
              children: "Next"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
      /* @__PURE__ */ jsx(ShieldCheck, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
      /* @__PURE__ */ jsx("span", { children: "Read-only by design. This module has no create, update or delete endpoint — a log its own product can edit is not evidence of anything. Entries are timestamped on write and are never edited afterwards, but the system does not yet compute a tamper-evident chain, so there is no integrity certificate to verify against." })
    ] })
  ] });
};
const InviteTeamMemberDialog = ({ open, onClose, onInvite, busy = false, schoolName }) => {
  const [form, setForm] = useState({ name: "", email: "", role: "teacher", position: "", phone: "" });
  const [customPosition, setCustomPosition] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const roleOptions = SIGNUP_ROLES;
  const update = (field) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: void 0 }));
  };
  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter their full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;
    const result = await onInvite({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      // `OTHER_POSITION` is a sentinel that is never stored; the free text beside
      // it is what gets persisted, matching `User.position`'s unconstrained shape.
      position: form.position === OTHER_POSITION ? customPosition.trim() : form.position,
      phone: form.phone.trim() || void 0
    });
    if (!result?.ok) {
      setServerError(result?.error?.message || "Could not send that invitation.");
      return;
    }
    onClose();
  };
  const handleClose = () => {
    setForm({ name: "", email: "", role: "teacher", position: "", phone: "" });
    setCustomPosition("");
    setErrors({});
    setServerError(null);
    onClose();
  };
  const ready = form.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open,
      onClose: handleClose,
      title: "Invite a team member",
      description: schoolName ? `They will be added to ${schoolName}.` : "They will be added to your school.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: handleClose,
            disabled: busy,
            className: "rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "submit",
            form: "invite-team-member-form",
            disabled: busy || !ready,
            className: "inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
            children: [
              /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4", "aria-hidden": "true" }),
              busy ? "Sending…" : "Send invitation"
            ]
          }
        )
      ] }),
      children: /* @__PURE__ */ jsxs("form", { id: "invite-team-member-form", onSubmit: handleSubmit, noValidate: true, className: "space-y-4", children: [
        serverError && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: serverError }),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Full name",
            required: true,
            icon: UserRound,
            autoComplete: "off",
            placeholder: "e.g. Rev. B. Quaye",
            value: form.name,
            onChange: update("name"),
            error: errors.name
          }
        ),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Email address",
            required: true,
            type: "email",
            icon: AtSign,
            autoComplete: "off",
            placeholder: "e.g. b.quaye@prampramschool.edu.gh",
            hint: "Where the credentials are sent",
            value: form.email,
            onChange: update("email"),
            error: errors.email
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsx(SelectField, { label: "Role", value: form.role, onChange: update("role"), children: roleOptions.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value)) }),
          /* @__PURE__ */ jsxs(
            SelectField,
            {
              label: "Position",
              value: form.position,
              onChange: update("position"),
              hint: "Optional",
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "Not specified" }),
                POSITIONS.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
              ]
            }
          )
        ] }),
        form.position === OTHER_POSITION ? /* @__PURE__ */ jsx(
          Field,
          {
            label: "Job title",
            autoComplete: "off",
            placeholder: "e.g. Assistant Bursar",
            value: customPosition,
            onChange: (event) => setCustomPosition(event.target.value)
          }
        ) : /* @__PURE__ */ jsx(
          Field,
          {
            label: "Phone number",
            type: "tel",
            autoComplete: "off",
            placeholder: "+233 24 000 0000",
            hint: "Optional",
            value: form.phone,
            onChange: update("phone")
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-brand-200 bg-brand-50/60 p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700", children: /* @__PURE__ */ jsx(KeyRound, { className: "h-4 w-4", "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-brand-900", children: "What happens next" }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-[12px]/[17px] font-medium leading-relaxed text-brand-800", children: "We create their account and generate a temporary password from your school ID, then email both to the address above — along with your name, so they know who invited them. They change the password after signing in." })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
          /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx("span", { children: "Only you and the recipient will ever see the temporary password. If the email does not arrive, re-send it from the team list — re-sending replaces the password." })
        ] })
      ] })
    }
  );
};
const useUsers = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => ({
      role: searchParams.get("role") || "",
      status: searchParams.get("status") || "",
      page: Number(searchParams.get("page")) || 1,
      limit: 50
    }),
    [searchParams]
  );
  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listUsers({ page: filters.page, limit: filters.limit, role: filters.role, status: filters.status }).then((result) => {
      if (!active) return;
      setState({
        rows: result.users,
        pagination: result.pagination,
        loading: false,
        error: null
      });
    }).catch((error) => {
      if (!active) return;
      setState({ rows: [], pagination: null, loading: false, error });
    });
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === "" || value === null || value === void 0) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete("page");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);
  const hasFilters = Boolean(filters.role || filters.status);
  return { ...state, filters, setFilter, clearFilters, hasFilters };
};
const useFilteredUsers = (rows, search) => {
  const term = search.trim().toLowerCase();
  return useMemo(() => {
    if (!term) return rows;
    return rows.filter(
      (row) => [row.name, row.email, row.position].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rows, term]);
};
const useUserActions = ({ onDone } = {}) => {
  const [busyKey, setBusyKey] = useState(null);
  const run = useCallback(
    async (key, operation) => {
      setBusyKey(key);
      try {
        const result = await operation();
        onDone?.();
        return { ok: true, ...result };
      } catch (error) {
        return { ok: false, error };
      } finally {
        setBusyKey(null);
      }
    },
    [onDone]
  );
  const invite = useCallback(
    (payload) => run("invite", () => inviteUser(payload)),
    [run]
  );
  const resend = useCallback((userId) => run(`resend:${userId}`, () => resendUserInvite(userId)), [run]);
  const changeRole = useCallback(
    (userId, role) => run(`role:${userId}`, () => updateUserRole(userId, role).then((user) => ({ user }))),
    [run]
  );
  const remove = useCallback((userId) => run(`remove:${userId}`, () => removeUser(userId)), [run]);
  return {
    invite,
    resend,
    changeRole,
    remove,
    busyKey,
    /** True while the matching operation for `key` is in flight. */
    isBusy: (key) => busyKey === key
  };
};
const STATUS_BADGE = {
  active: { tone: "green", label: "Active", icon: CheckCircle2 },
  invited: { tone: "amber", label: "Awaiting sign-in", icon: Clock },
  suspended: { tone: "red", label: "Suspended", icon: AlertTriangle },
  deactivated: { tone: "slate", label: "Deactivated", icon: AlertTriangle }
};
const ROLE_LABEL = Object.fromEntries(SIGNUP_ROLES.map((r) => [r.value, r.label]));
const initialsOf = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
const relativeTime = (value) => {
  if (!value) return "—";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "—";
  const seconds = Math.round((Date.now() - then.getTime()) / 1e3);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const UserManagement = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const { rows, loading, error, filters, setFilter, hasFilters } = useUsers(reloadKey);
  const visibleUsers = useFilteredUsers(rows, search);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const actions = useUserActions({ onDone: refresh });
  const counts = useMemo(
    () => ({
      total: rows.length,
      invited: rows.filter((row) => row.status === "invited").length,
      active: rows.filter((row) => row.status === "active").length,
      // An account still running on a password its administrator knows. Worth
      // surfacing because it is the one access risk this module can see.
      mustChange: rows.filter((row) => row.mustChangePassword).length
    }),
    [rows]
  );
  const handleInvite = async (payload) => {
    const result = await actions.invite(payload);
    if (!result.ok) return result;
    if (result.emailSent) {
      toast.success(`Invitation sent to ${payload.email}`);
    } else {
      toast.warning(
        `${payload.name} was added, but the invitation email could not be sent. Re-send it from the list.`
      );
    }
    return result;
  };
  const handleResend = async (row) => {
    const result = await actions.resend(row._id);
    if (!result.ok) {
      toast.error(result.error?.message || "Could not re-send that invitation.");
      return;
    }
    if (result.emailSent) {
      toast.success(`Invitation re-sent to ${row.email}. The previous password no longer works.`);
    } else {
      toast.warning("The invitation still could not be sent. Check the address and try again.");
    }
  };
  const handleRoleChange = async (row, role) => {
    if (role === row.role) return;
    const result = await actions.changeRole(row._id, role);
    if (result.ok) toast.success(`${row.name} is now a ${ROLE_LABEL[role] || role}.`);
    else toast.error(result.error?.message || "Could not change that role.");
  };
  const handleRemove = async () => {
    const row = pendingRemoval;
    if (!row) return;
    const result = await actions.remove(row._id);
    setPendingRemoval(null);
    if (result.ok) toast.success(`${row.name} was removed from the team.`);
    else toast.error(result.error?.message || "Could not remove that user.");
  };
  const isSelf = (row) => String(row._id) === String(user?._id);
  const tiles = [
    { label: "Team members", value: counts.total, icon: Users, tone: "text-ink" },
    { label: "Active", value: counts.active, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Awaiting sign-in", value: counts.invited, icon: Clock, tone: "text-amber-600" },
    {
      label: "Still on default password",
      value: counts.mustChange,
      icon: ShieldCheck,
      tone: "text-brand-700"
    }
  ];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Administration",
        title: "User Management",
        description: "Invite colleagues, manage what each person can do, and see who has actually signed in.",
        actions: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setInviteOpen(true),
            className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
            children: [
              /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Invite team member"
            ]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4", children: tiles.map((tile) => /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: tile.label }),
        /* @__PURE__ */ jsx("p", { className: `mt-1.5 text-2xl font-extrabold tracking-tight ${tile.tone}`, children: loading ? "—" : tile.value })
      ] }),
      /* @__PURE__ */ jsx(tile.icon, { className: "h-5 w-5 shrink-0 text-slate-300", "aria-hidden": "true" })
    ] }) }, tile.label)) }),
    /* @__PURE__ */ jsxs(Card, { padding: "p-0", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b border-slate-100 p-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "relative min-w-[200px] flex-1", children: [
          /* @__PURE__ */ jsx("span", { className: "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400", children: /* @__PURE__ */ jsx(Search, { className: "h-4 w-4", "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "search",
              value: search,
              onChange: (event) => setSearch(event.target.value),
              placeholder: "Search by name, email or position…",
              "aria-label": "Search team members",
              className: "w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filters.role,
            onChange: (event) => setFilter({ role: event.target.value }),
            "aria-label": "Filter by role",
            className: "cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All roles" }),
              USER_ROLES.filter((role) => role !== "super_admin").map((role) => /* @__PURE__ */ jsx("option", { value: role, children: ROLE_LABEL[role] || role }, role))
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: filters.status,
            onChange: (event) => setFilter({ status: event.target.value }),
            "aria-label": "Filter by status",
            className: "cursor-pointer rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-[13px]/[18px] font-medium text-ink focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All statuses" }),
              /* @__PURE__ */ jsx("option", { value: "active", children: "Active" }),
              /* @__PURE__ */ jsx("option", { value: "invited", children: "Awaiting sign-in" }),
              /* @__PURE__ */ jsx("option", { value: "suspended", children: "Suspended" })
            ]
          }
        ),
        (hasFilters || search) && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              setSearch("");
              setFilter({ role: "", status: "" });
            },
            className: "rounded-lg px-3 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink",
            children: "Clear"
          }
        )
      ] }),
      error && /* @__PURE__ */ jsx("div", { className: "m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700", children: error.message }),
      loading && /* @__PURE__ */ jsx("div", { className: "px-4 py-16 text-center text-sm font-semibold text-slate-500", children: "Loading your team…" }),
      !loading && !error && rows.length === 0 && /* @__PURE__ */ jsx("div", { className: "p-6", children: /* @__PURE__ */ jsx(
        EmptyState,
        {
          icon: UserCog,
          title: "No team members yet",
          description: "You are the only account on this school. Invite a bursar, a teacher or a headteacher to give them access.",
          action: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setInviteOpen(true),
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
              children: [
                /* @__PURE__ */ jsx(UserPlus, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Invite team member"
              ]
            }
          )
        }
      ) }),
      !loading && !error && rows.length > 0 && visibleUsers.length === 0 && /* @__PURE__ */ jsxs("div", { className: "px-4 py-16 text-center text-sm font-semibold text-slate-500", children: [
        "No team members match “",
        search,
        "”."
      ] }),
      !loading && !error && visibleUsers.length > 0 && /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full border-collapse text-left", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 bg-slate-50/60", children: [
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Member" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Role" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Status" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Last active" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: visibleUsers.map((row) => {
          const status = STATUS_BADGE[row.status] || STATUS_BADGE.deactivated;
          const StatusIcon = status.icon;
          return /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 last:border-0 hover:bg-slate-50/50", children: [
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-extrabold text-white", children: initialsOf(row.name) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("p", { className: "flex items-center gap-1.5 truncate text-[13px] font-extrabold text-ink", children: [
                  row.name,
                  isSelf(row) && /* @__PURE__ */ jsx("span", { className: "shrink-0 text-[10px] font-bold text-slate-400", children: "You" })
                ] }),
                /* @__PURE__ */ jsxs("p", { className: "truncate text-[12px] font-medium text-slate-500", children: [
                  row.email,
                  row.position ? ` · ${row.position}` : ""
                ] })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(
              "select",
              {
                value: row.role,
                onChange: (event) => handleRoleChange(row, event.target.value),
                disabled: actions.isBusy(`role:${row._id}`) || isSelf(row),
                "aria-label": `Role for ${row.name}`,
                className: "cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-bold text-ink focus:border-brand-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                children: USER_ROLES.filter((role) => role !== "super_admin").map((role) => /* @__PURE__ */ jsx("option", { value: role, children: ROLE_LABEL[role] || role }, role))
              }
            ) }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-start gap-1", children: [
              /* @__PURE__ */ jsx(Badge, { tone: status.tone, icon: StatusIcon, children: status.label }),
              row.mustChangePassword && row.status === "active" && /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-brand-700", children: "Default password" }),
              row.status === "invited" && !row.inviteEmailSentAt && /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-red-600", children: "Email not delivered" })
            ] }) }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-[12px] font-medium text-slate-500", children: relativeTime(row.lastLoginAt) }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1", children: [
              row.status === "invited" && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => handleResend(row),
                  disabled: actions.isBusy(`resend:${row._id}`),
                  title: "Re-send the invitation and replace the password",
                  "aria-label": `Re-send invitation to ${row.name}`,
                  className: "rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink disabled:opacity-50",
                  children: /* @__PURE__ */ jsx(
                    RefreshCw,
                    {
                      className: `h-4 w-4 ${actions.isBusy(`resend:${row._id}`) ? "animate-spin" : ""}`,
                      "aria-hidden": "true"
                    }
                  )
                }
              ),
              !isSelf(row) && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setPendingRemoval(row),
                  "aria-label": `Remove ${row.name}`,
                  title: "Remove from team",
                  className: "rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600",
                  children: /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4", "aria-hidden": "true" })
                }
              )
            ] }) })
          ] }, row._id);
        }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx(
      InviteTeamMemberDialog,
      {
        open: inviteOpen,
        onClose: () => setInviteOpen(false),
        onInvite: handleInvite,
        busy: actions.isBusy("invite")
      }
    ),
    pendingRemoval && /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[90] flex items-center justify-center p-4", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "absolute inset-0 bg-ink/55 backdrop-blur-sm",
          onClick: () => setPendingRemoval(null),
          "aria-hidden": "true"
        }
      ),
      /* @__PURE__ */ jsxs(
        "div",
        {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Confirm removal",
          className: "relative w-full max-w-md rounded-2xl bg-white p-6 shadow-soft",
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600", children: /* @__PURE__ */ jsx(AlertTriangle, { className: "h-5 w-5", "aria-hidden": "true" }) }),
              /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxs("h2", { className: "text-base font-extrabold text-ink", children: [
                  "Remove ",
                  pendingRemoval.name,
                  "?"
                ] }),
                /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[13px]/[19px] font-medium text-slate-600", children: "They will lose access immediately and cannot sign in again. Their history is kept for the audit trail, but the email address stays reserved — so re-inviting them needs a restore rather than a new invitation." })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setPendingRemoval(null),
                  disabled: actions.isBusy(`remove:${pendingRemoval._id}`),
                  className: "rounded-lg px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50",
                  children: "Cancel"
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: handleRemove,
                  disabled: actions.isBusy(`remove:${pendingRemoval._id}`),
                  className: "inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-red-700 disabled:opacity-50",
                  children: [
                    /* @__PURE__ */ jsx(Trash2, { className: "h-4 w-4", "aria-hidden": "true" }),
                    actions.isBusy(`remove:${pendingRemoval._id}`) ? "Removing…" : "Remove member"
                  ]
                }
              )
            ] })
          ]
        }
      )
    ] })
  ] });
};
const getSettings = async (schoolId) => {
  try {
    const { data } = await api.get(`/settings/${schoolId}`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Could not load your school settings.");
  }
};
const updateProfile = async (schoolId, patch) => {
  try {
    const { data } = await api.put(`/schools/${schoolId}`, patch);
    return data.data || data.school || {};
  } catch (error) {
    throw toApiError(error, "Could not save the school profile.");
  }
};
const updateGeneral = async (schoolId, patch) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}`, patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Could not save those settings.");
  }
};
const updateAcademicYear = async (schoolId, payload) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}/academic-year`, payload);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Could not set the academic year and term.");
  }
};
const updateNotifications = async (schoolId, prefs) => {
  try {
    const { data } = await api.put(`/settings/${schoolId}/notifications`, prefs);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Could not save notification preferences.");
  }
};
const getBilling = async (schoolId) => {
  try {
    const { data } = await api.get(`/settings/${schoolId}/billing`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Could not load billing information.");
  }
};
const SCHOOL_TYPES = [
  { value: "public", label: "Public Basic & JHS" },
  { value: "private", label: "Private Basic & JHS (Co-educational)" },
  { value: "international", label: "International" },
  { value: "mission", label: "Mission / Church-based" },
  { value: "charter", label: "Charter" }
];
const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North"
];
const ACADEMIC_TERMS = ["Term 1", "Term 2", "Term 3"];
const GRADING_SYSTEMS = ["WAEC", "IB", "Cambridge", "Custom"];
const SECTIONS = [
  {
    id: "profile",
    label: "School Profile",
    blurb: "Legal name, classification, address and branding.",
    icon: Building2,
    writable: true
  },
  {
    id: "payment",
    label: "Payment Gateway",
    blurb: "MoMo collection mode, platform markup and enabled networks.",
    icon: CreditCard,
    writable: false,
    reason: "Read-only. The gateway mode, platform markup and network switches are returned by the API but no endpoint writes them yet — they are platform-level configuration, not school-level."
  },
  {
    id: "sms",
    label: "SMS & Sender ID",
    blurb: "Messaging provider, registered sender ID and credit balance.",
    icon: Smartphone,
    writable: false,
    reason: "Read-only. Provider and sender ID are served by the API but nothing writes them from Settings; the balance changes as messages are sent."
  },
  {
    id: "academic",
    label: "Academic Calendar",
    blurb: "Current year, active term, class list and grading system.",
    icon: CalendarClock,
    writable: true
  },
  {
    id: "notifications",
    label: "Notification Preferences",
    blurb: "What the school is told about, and over which channel.",
    icon: Bell,
    writable: true
  },
  {
    id: "billing",
    label: "Fees & Billing Structure",
    blurb: "Subscription plan, usage this period and the next invoice.",
    icon: Receipt,
    writable: false,
    reason: "Read-only. Subscription changes are made through billing, not from Settings. Invoices are not yet issued by this system — the API returns an empty list."
  },
  {
    id: "security",
    label: "Security & Compliance",
    blurb: "Who can sign in, and what has been done.",
    icon: ShieldCheck,
    writable: false,
    reason: "Nothing to configure here. Roles and access live in their own module, and the record of who did what lives in the Activity Log."
  }
];
const ReadOnlyNotice = ({ reason }) => /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3", children: [
  /* @__PURE__ */ jsx(Lock, { className: "mt-0.5 h-4 w-4 shrink-0 text-slate-400", "aria-hidden": "true" }),
  /* @__PURE__ */ jsxs("p", { className: "text-[12px]/[18px] font-medium text-slate-600", children: [
    /* @__PURE__ */ jsx("span", { className: "font-extrabold text-slate-700", children: "Read-only." }),
    " ",
    reason
  ] })
] });
const DetailRow = ({ label, children, hint }) => /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 py-2.5 last:border-0", children: [
  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-500", children: label }),
  /* @__PURE__ */ jsx("div", { className: "mt-1 text-[13px]/[19px] font-semibold text-ink", children }),
  hint && /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-medium text-slate-400", children: hint })
] });
const Settings = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get("section") || "profile";
  const [settings, setSettings] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0];
  const [profile, setProfile] = useState({});
  const [academic, setAcademic] = useState({});
  const [notifications, setNotifications] = useState({});
  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setLoadError(
        new Error("Your account is not linked to a school yet, so there are no settings to show.")
      );
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [nextSettings, nextBilling] = await Promise.all([
        getSettings(schoolId),
        getBilling(schoolId).catch(() => null)
      ]);
      setSettings(nextSettings);
      setBilling(nextBilling);
      setProfile({
        name: nextSettings.profile?.name || "",
        type: nextSettings.profile?.type || "",
        motto: nextSettings.profile?.motto || "",
        yearFounded: nextSettings.profile?.yearFounded ?? "",
        phone: nextSettings.profile?.phone || "",
        email: nextSettings.profile?.email || "",
        website: nextSettings.profile?.website || "",
        address: nextSettings.profile?.address || "",
        city: nextSettings.profile?.city || "",
        region: nextSettings.profile?.region || "",
        gpsAddress: nextSettings.profile?.gpsAddress || ""
      });
      setAcademic({
        currentYear: nextSettings.academic?.currentYear || "",
        currentTerm: nextSettings.academic?.currentTerm || "",
        termsPerYear: nextSettings.academic?.termsPerYear ?? 3,
        classes: (nextSettings.academic?.classes || []).join(", "),
        gradingSystem: nextSettings.academic?.gradingSystem || "WAEC"
      });
      setNotifications({
        email: nextSettings.notifications?.email !== false,
        sms: nextSettings.notifications?.sms !== false,
        inApp: nextSettings.notifications?.inApp !== false
      });
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);
  useEffect(() => {
    load();
  }, [load]);
  const selectSection = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id === "profile") next.delete("section");
    else next.set("section", id);
    setSearchParams(next, { replace: true });
    setErrors({});
    setFormError(null);
  };
  const diff = (current, original) => {
    const patch = {};
    Object.entries(current).forEach(([key, value]) => {
      if (value !== original[key]) patch[key] = value;
    });
    return patch;
  };
  const saveProfile = async () => {
    const original = {
      name: settings?.profile?.name || "",
      type: settings?.profile?.type || "",
      motto: settings?.profile?.motto || "",
      yearFounded: settings?.profile?.yearFounded ?? "",
      phone: settings?.profile?.phone || "",
      email: settings?.profile?.email || "",
      website: settings?.profile?.website || "",
      address: settings?.profile?.address || "",
      city: settings?.profile?.city || "",
      region: settings?.profile?.region || "",
      gpsAddress: settings?.profile?.gpsAddress || ""
    };
    const nextErrors = {};
    if (profile.name.trim().length < 2) nextErrors.name = "Enter the school’s legal name.";
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const patch = diff(profile, original);
    if (!Object.keys(patch).length) {
      toast.info("Nothing to save — no changes were made.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateProfile(schoolId, patch);
      toast.success("School profile saved.");
      await load();
    } catch (error) {
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const saveAcademic = async () => {
    const nextErrors = {};
    if (!/^\d{4}\/\d{4}$/.test(academic.currentYear)) {
      nextErrors.currentYear = "Use the form 2025/2026 — the second year must be the first plus one.";
    } else {
      const [start] = academic.currentYear.split("/");
      if (Number(academic.currentYear.split("/")[1]) !== Number(start) + 1) {
        nextErrors.currentYear = "The two years must be consecutive, e.g. 2025/2026.";
      }
    }
    if (!ACADEMIC_TERMS.includes(academic.currentTerm)) {
      nextErrors.currentTerm = "Choose Term 1, 2 or 3.";
    }
    if (!academic.classes.trim()) {
      nextErrors.classes = "List at least one class — the roster and every report filter read this.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const confirmed = window.confirm(
      `Set the school to ${academic.currentYear}, ${academic.currentTerm}?

Every report, payment plan and fee deadline is measured against this. Bills already issued for the previous term are not moved by this change.`
    );
    if (!confirmed) return;
    const classes = academic.classes.split(",").map((value) => value.trim()).filter(Boolean);
    setSaving(true);
    setFormError(null);
    try {
      await updateAcademicYear(schoolId, {
        currentYear: academic.currentYear,
        currentTerm: academic.currentTerm,
        termsPerYear: Number(academic.termsPerYear) || 3
      });
      await updateGeneral(schoolId, {
        classes,
        gradingSystem: academic.gradingSystem,
        termsPerYear: Number(academic.termsPerYear) || 3
      });
      toast.success("Academic calendar saved.");
      await load();
    } catch (error) {
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const saveNotifications = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await updateNotifications(schoolId, notifications);
      toast.success("Notification preferences saved.");
      await load();
    } catch (error) {
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const lastModified = useMemo(() => {
    if (!settings?.profile) return null;
    return null;
  }, [settings]);
  if (loading) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(PageHeader, { eyebrow: "Administration", title: "Settings & Institution Profile" }),
      /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-slate-100 bg-white p-6", children: /* @__PURE__ */ jsxs("div", { className: "animate-pulse space-y-4", children: [
        /* @__PURE__ */ jsx("div", { className: "h-6 w-1/3 rounded bg-slate-200/70" }),
        /* @__PURE__ */ jsx("div", { className: "h-4 w-2/3 rounded bg-slate-200/70" }),
        /* @__PURE__ */ jsx("div", { className: "h-32 rounded bg-slate-200/70" })
      ] }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Administration",
        title: "Settings & Institution Profile",
        description: "Manage school credentials, the academic calendar, notification preferences and subscription."
      }
    ),
    loadError && /* @__PURE__ */ jsx("div", { className: "mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800", children: loadError.message }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-5 lg:flex-row", children: [
      /* @__PURE__ */ jsx(
        "nav",
        {
          "aria-label": "Settings sections",
          className: "shrink-0 lg:w-[260px]",
          children: /* @__PURE__ */ jsx("ul", { className: "flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0", children: SECTIONS.map((item) => {
            const isActive = item.id === section.id;
            return /* @__PURE__ */ jsx("li", { className: "shrink-0 lg:shrink", children: /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => selectSection(item.id),
                "aria-current": isActive ? "page" : void 0,
                className: `flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition-colors ${isActive ? "bg-brand-700 text-white shadow-lift" : "bg-white text-slate-600 hover:bg-slate-50"}`,
                children: [
                  /* @__PURE__ */ jsx(item.icon, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsx("span", { className: "min-w-0 flex-1 truncate", children: item.label }),
                  !item.writable && /* @__PURE__ */ jsx(
                    Lock,
                    {
                      className: `h-3 w-3 shrink-0 ${isActive ? "text-white/70" : "text-slate-300"}`,
                      "aria-label": "Read-only section"
                    }
                  )
                ]
              }
            ) }, item.id);
          }) })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 space-y-5", children: [
        !section.writable && /* @__PURE__ */ jsx(ReadOnlyNotice, { reason: section.reason }),
        formError && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: formError }),
        section.id === "profile" && settings && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap items-center gap-5 rounded-xl bg-slate-50 p-4", children: [
            settings.profile.logo ? /* @__PURE__ */ jsx(
              "img",
              {
                src: settings.profile.logo,
                alt: "School logo",
                className: "h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-1"
              }
            ) : /* @__PURE__ */ jsx("span", { className: "flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-300", children: /* @__PURE__ */ jsx(School, { className: "h-7 w-7", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Logo & digital stamp" }),
              /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px]/[17px] font-medium text-slate-500", children: [
                "Printed on parent payment receipts and SMS headers.",
                settings.profile.stamp ? " A digital stamp is on file." : " No digital stamp is on file."
              ] })
            ] }),
            user?.role === "super_admin" ? /* @__PURE__ */ jsx(Badge, { tone: "blue", children: "Uploads require platform admin" }) : /* @__PURE__ */ jsx(Badge, { tone: "slate", children: "Read-only for school admins" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "School legal name",
                required: true,
                value: profile.name,
                onChange: (e) => setProfile({ ...profile, name: e.target.value }),
                error: errors.name
              }
            ),
            /* @__PURE__ */ jsx(
              SelectField,
              {
                label: "School type / tier",
                value: profile.type,
                onChange: (e) => setProfile({ ...profile, type: e.target.value }),
                children: SCHOOL_TYPES.map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Official institutional email",
                type: "email",
                value: profile.email,
                onChange: (e) => setProfile({ ...profile, email: e.target.value }),
                error: errors.email
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Institutional phone number",
                type: "tel",
                value: profile.phone,
                onChange: (e) => setProfile({ ...profile, phone: e.target.value }),
                hint: "Ghana format — 024xxxxxxx or 23324xxxxxxx"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: /* @__PURE__ */ jsx(
              Field,
              {
                label: "Physical campus address",
                value: profile.address,
                onChange: (e) => setProfile({ ...profile, address: e.target.value })
              }
            ) }),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "City",
                value: profile.city,
                onChange: (e) => setProfile({ ...profile, city: e.target.value })
              }
            ),
            /* @__PURE__ */ jsxs(
              SelectField,
              {
                label: "Region",
                value: profile.region,
                onChange: (e) => setProfile({ ...profile, region: e.target.value }),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "Select a region" }),
                  GHANA_REGIONS.map((region) => /* @__PURE__ */ jsx("option", { value: region, children: region }, region))
                ]
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Digital address (GhanaPost GPS)",
                value: profile.gpsAddress,
                onChange: (e) => setProfile({ ...profile, gpsAddress: e.target.value }),
                hint: "Geo-verified code, e.g. GA-492-1082"
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Website URL",
                type: "url",
                value: profile.website,
                onChange: (e) => setProfile({ ...profile, website: e.target.value }),
                hint: "Optional"
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "sm:col-span-2", children: /* @__PURE__ */ jsx(
              Field,
              {
                label: "School motto",
                value: profile.motto,
                onChange: (e) => setProfile({ ...profile, motto: e.target.value }),
                hint: "Optional"
              }
            ) }),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Year founded",
                type: "number",
                value: profile.yearFounded,
                onChange: (e) => setProfile({ ...profile, yearFounded: e.target.value }),
                hint: "Optional"
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 flex justify-end", children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: saveProfile,
              disabled: saving,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4", "aria-hidden": "true" }),
                saving ? "Saving…" : "Save profile"
              ]
            }
          ) })
        ] }) }),
        section.id === "payment" && settings && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
            /* @__PURE__ */ jsx(DetailRow, { label: "Collection gateway", children: settings.payment?.gatewayMode || "hubtel" }),
            /* @__PURE__ */ jsxs(DetailRow, { label: "Platform markup", children: [
              `${settings.payment?.platformMarkupPercent ?? 0}%`,
              /* @__PURE__ */ jsx("span", { className: "ml-1 text-[11px] font-medium text-slate-400", children: "on each collection" })
            ] }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Networks enabled", children: /* @__PURE__ */ jsx("span", { className: "flex flex-wrap gap-1.5", children: Object.entries(settings.payment?.networksEnabled || {}).map(([network, enabled]) => /* @__PURE__ */ jsxs(Badge, { tone: enabled ? "green" : "slate", children: [
              network,
              enabled ? "" : " (off)"
            ] }, network)) }) })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-4 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
            /* @__PURE__ */ jsx(Lock, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { children: "Paystack credentials are never returned by this endpoint and are never shown in a form field. They are write-only: a school sets them through the credential flow, and from then on only a masked confirmation is visible." })
          ] })
        ] }),
        section.id === "sms" && settings && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
            /* @__PURE__ */ jsx(DetailRow, { label: "Provider", children: settings.sms?.provider || "hubtel" }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Registered sender ID", children: settings.sms?.senderId ? /* @__PURE__ */ jsx("span", { className: "font-mono", children: settings.sms.senderId }) : /* @__PURE__ */ jsx("span", { className: "text-slate-400", children: "Not registered" }) }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Credit balance", children: `${(settings.sms?.balance ?? 0).toLocaleString("en-GB")} credits` })
          ] })
        ] }),
        section.id === "academic" && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1", children: [
            /* @__PURE__ */ jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-amber-700", "aria-hidden": "true" }),
            /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-extrabold text-amber-800", children: [
              academic.currentYear || "No year set",
              " · ",
              academic.currentTerm || "No term set"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3", children: [
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Current academic year",
                required: true,
                placeholder: "2025/2026",
                value: academic.currentYear,
                onChange: (e) => setAcademic({ ...academic, currentYear: e.target.value }),
                error: errors.currentYear,
                hint: "Two consecutive years"
              }
            ),
            /* @__PURE__ */ jsx(
              SelectField,
              {
                label: "Active academic term",
                required: true,
                value: academic.currentTerm,
                onChange: (e) => setAcademic({ ...academic, currentTerm: e.target.value }),
                error: errors.currentTerm,
                children: ACADEMIC_TERMS.map((term) => /* @__PURE__ */ jsx("option", { value: term, children: term }, term))
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Terms per year",
                type: "number",
                min: "1",
                max: "4",
                value: academic.termsPerYear,
                onChange: (e) => setAcademic({ ...academic, termsPerYear: e.target.value })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Classes",
                required: true,
                value: academic.classes,
                onChange: (e) => setAcademic({ ...academic, classes: e.target.value }),
                error: errors.classes,
                hint: "Comma-separated. The roster and every report filter read this list."
              }
            ),
            /* @__PURE__ */ jsx(
              SelectField,
              {
                label: "Grading system",
                value: academic.gradingSystem,
                onChange: (e) => setAcademic({ ...academic, gradingSystem: e.target.value }),
                children: GRADING_SYSTEMS.map((system) => /* @__PURE__ */ jsx("option", { value: system, children: system }, system))
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3", children: [
            /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-600", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("p", { className: "text-[12px]/[18px] font-medium text-amber-900", children: "Changing the term re-bases every report, payment plan and fee deadline in the system. Bills already issued for the previous term are not moved. You will be asked to confirm." })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 flex justify-end", children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: saveAcademic,
              disabled: saving,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4", "aria-hidden": "true" }),
                saving ? "Saving…" : "Save academic calendar"
              ]
            }
          ) })
        ] }),
        section.id === "notifications" && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 space-y-3", children: [
            { key: "email", label: "Email notifications", hint: "Collections, arrears and system notices." },
            { key: "sms", label: "SMS notifications", hint: "Charged against your credit balance." },
            { key: "inApp", label: "In-app notifications", hint: "The bell in the dashboard header." }
          ].map((pref) => /* @__PURE__ */ jsxs(
            "label",
            {
              className: "flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50",
              children: [
                /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: pref.label }),
                  /* @__PURE__ */ jsx("span", { className: "mt-0.5 block text-[12px]/[17px] font-medium text-slate-500", children: pref.hint })
                ] }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: notifications[pref.key],
                    onChange: (event) => setNotifications({ ...notifications, [pref.key]: event.target.checked }),
                    className: "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700"
                  }
                )
              ]
            },
            pref.key
          )) }),
          /* @__PURE__ */ jsx("div", { className: "mt-5 flex justify-end", children: /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: saveNotifications,
              disabled: saving,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4", "aria-hidden": "true" }),
                saving ? "Saving…" : "Save preferences"
              ]
            }
          ) })
        ] }),
        section.id === "billing" && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          !billing ? /* @__PURE__ */ jsx("p", { className: "mt-4 text-[13px] font-medium text-slate-500", children: "Billing is unavailable." }) : /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
            /* @__PURE__ */ jsxs(DetailRow, { label: "Plan", children: [
              /* @__PURE__ */ jsx("span", { className: "capitalize", children: billing.subscription?.plan }),
              /* @__PURE__ */ jsx(Badge, { tone: billing.subscription?.status === "active" ? "green" : "amber", className: "ml-2", children: billing.subscription?.status })
            ] }),
            /* @__PURE__ */ jsxs(DetailRow, { label: "Monthly fee", children: [
              billing.subscription?.monthlyFee ?? 0,
              " pesewas"
            ] }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Current period", children: billing.subscription?.currentPeriodStart ? `${new Date(billing.subscription.currentPeriodStart).toLocaleDateString("en-GB")} – ${new Date(
              billing.subscription.currentPeriodEnd
            ).toLocaleDateString("en-GB")}` : "Not set" }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Enrolled students", children: billing.usage?.studentsThisTerm ?? 0 }),
            /* @__PURE__ */ jsx(DetailRow, { label: "SMS sent this month", children: `${(billing.usage?.smsSentThisMonth ?? 0).toLocaleString("en-GB")} of ${(billing.usage?.smsCreditsRemaining ?? 0).toLocaleString("en-GB")} credits remaining` }),
            /* @__PURE__ */ jsx(DetailRow, { label: "Next invoice", children: billing.nextInvoice?.dueDate ? `${billing.nextInvoice.amount} pesewas, due ${new Date(
              billing.nextInvoice.dueDate
            ).toLocaleDateString("en-GB")}` : "No invoice scheduled" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3", children: /* @__PURE__ */ jsxs("p", { className: "text-[12px]/[18px] font-medium text-slate-500", children: [
            /* @__PURE__ */ jsx("span", { className: "font-extrabold text-slate-700", children: "Invoice history is not available." }),
            " ",
            "This system does not issue invoices yet — the API returns an empty list, so there is nothing to show. Storage usage is likewise reported as zero because no figure is collected."
          ] }) })
        ] }),
        section.id === "security" && /* @__PURE__ */ jsxs(Card, { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-base font-extrabold text-ink", children: section.label }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-slate-500", children: section.blurb }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(
              Link,
              {
                to: ROUTES.DASHBOARD_USERS,
                className: "rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40",
                children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                  /* @__PURE__ */ jsx(ShieldCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Team & permissions" }),
                    /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px]/[17px] font-medium text-slate-500", children: "Who can sign in to this school, what each role can do, and who is still on a default password." })
                  ] })
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              Link,
              {
                to: ROUTES.DASHBOARD_ACTIVITY,
                className: "rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40",
                children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
                  /* @__PURE__ */ jsx(CheckCircle2, { className: "mt-0.5 h-4 w-4 shrink-0 text-brand-700", "aria-hidden": "true" }),
                  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
                    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Audit trail" }),
                    /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[12px]/[17px] font-medium text-slate-500", children: "Every administrative action taken on this school, filterable by actor, action and date, and exportable as CSV." })
                  ] })
                ] })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "mt-5 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500", children: [
            /* @__PURE__ */ jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
            /* @__PURE__ */ jsx("span", { children: "Session and password controls live on each person’s own account, and password resets are done by request rather than by an administrator — so no administrator can read or set a colleague’s current password." })
          ] })
        ] }),
        lastModified && /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-medium text-slate-400", children: [
          "Last modified ",
          lastModified
        ] })
      ] })
    ] })
  ] });
};
const BalanceCard = ({ student }) => {
  const balance = student.balance || 0;
  const settled = balance <= 0;
  const deadlineNote = () => {
    if (!student.deadline) return null;
    const deadline = new Date(student.deadline);
    if (Number.isNaN(deadline.getTime())) return null;
    const days = Math.ceil((deadline.getTime() - Date.now()) / 864e5);
    if (settled) return "Fees fully paid";
    if (days < 0) {
      return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
    }
    if (days === 0) return "Due today";
    return `${days} day${days === 1 ? "" : "s"} left to pay`;
  };
  const note = deadlineNote();
  const overdue = note?.startsWith("Overdue");
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: settled ? "border-emerald-200" : overdue ? "border-red-200" : "", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("h2", { className: "truncate text-lg font-extrabold tracking-tight text-ink", children: student.studentName }),
        /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[12px] font-semibold text-slate-500", children: [
          student.studentClass,
          " · ",
          student.studentId
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${settled ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"}`,
          children: settled ? "Paid in full" : "Balance due"
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      "p",
      {
        className: `mt-5 text-4xl font-extrabold leading-none tracking-tight ${settled ? "text-emerald-600" : "text-red-600"}`,
        children: formatCedi(balance)
      }
    ),
    /* @__PURE__ */ jsxs("dl", { className: "mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: "Total fees" }),
        /* @__PURE__ */ jsx("dd", { className: "mt-0.5 text-sm font-extrabold tabular-nums text-ink", children: formatCedi(student.totalOwed || 0) })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-extrabold uppercase tracking-wide text-slate-400", children: "Paid so far" }),
        /* @__PURE__ */ jsx("dd", { className: "mt-0.5 text-sm font-extrabold tabular-nums text-brand-700", children: formatCedi(student.totalPaid || 0) })
      ] })
    ] }),
    note && /* @__PURE__ */ jsxs(
      "p",
      {
        className: `mt-4 flex items-center gap-2 text-[13px] font-extrabold ${settled ? "text-emerald-700" : overdue ? "text-red-600" : "text-slate-600"}`,
        children: [
          /* @__PURE__ */ jsx(CalendarClock, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }),
          note,
          deadlineLabel(student.deadline)
        ]
      }
    )
  ] });
};
const deadlineLabel = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return /* @__PURE__ */ jsxs("span", { className: "font-semibold text-slate-400", children: [
    "· ",
    d.toLocaleDateString("en-GB")
  ] });
};
const NETWORKS = [
  { value: "MTN", label: "MTN MoMo" },
  { value: "VODAFONE", label: "Vodafone Cash" },
  { value: "AIRTELTELIGO", label: "AirtelTigo Money" }
];
const MomoForm = ({ student, onSubmit, submitting, error }) => {
  const balance = student.balance || 0;
  const [amount, setAmount] = useState(balance > 0 ? balance : null);
  const [network, setNetwork] = useState("MTN");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const phoneValid = isValidGhanaPhone(phone);
  const tooMuch = amount !== null && amount > balance;
  const canSubmit = !submitting && amount !== null && amount > 0 && phoneValid && !tooMuch;
  const error_ = error || (touched && phone && !phoneValid ? "Enter a valid Ghana number, e.g. 0241234567" : null);
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-4 w-4", "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: "Pay with Mobile Money" })
    ] }),
    error_ && /* @__PURE__ */ jsx(FormAlert, { children: error_ }),
    /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx(
        MoneyInput,
        {
          label: "Amount to pay",
          hint: `cedis · ${formatCedi(balance)} outstanding`,
          required: true,
          value: amount,
          error: tooMuch ? "That is more than the balance due" : void 0,
          onChange: setAmount
        }
      ),
      /* @__PURE__ */ jsx(SelectField, { label: "Your network", value: network, onChange: (e) => setNetwork(e.target.value), children: NETWORKS.map((n) => /* @__PURE__ */ jsx("option", { value: n.value, children: n.label }, n.value)) }),
      /* @__PURE__ */ jsx(
        PhoneInput,
        {
          label: "Mobile Money number",
          hint: "the number that will receive the prompt",
          required: true,
          value: phone,
          error: touched && phone && !phoneValid ? "Enter a valid Ghana number" : void 0,
          onChange: setPhone
        }
      ),
      /* @__PURE__ */ jsxs(
        Button,
        {
          type: "button",
          variant: "primary",
          className: "w-full",
          disabled: !canSubmit,
          onClick: () => {
            setTouched(true);
            if (!canSubmit) return;
            onSubmit({ amount, momoNetwork: network, phoneNumber: phone });
          },
          children: [
            /* @__PURE__ */ jsx(Smartphone, { className: "mr-2 h-4 w-4", "aria-hidden": "true" }),
            submitting ? "Waiting for your network…" : `Pay ${amount !== null ? formatCedi(amount) : ""}`.trim()
          ]
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "text-center text-[11px] font-semibold leading-relaxed text-slate-400", children: "You will get a prompt on your phone. Approve it to complete the payment — this page will tell you when the money arrives." })
    ] })
  ] });
};
const PayHeader = ({ school }) => /* @__PURE__ */ jsx("header", { className: "border-b border-slate-200 bg-white", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6", children: [
  /* @__PURE__ */ jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white", children: /* @__PURE__ */ jsx(GraduationCap, { className: "h-6 w-6", "aria-hidden": "true" }) }),
  /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
    /* @__PURE__ */ jsx("h1", { className: "truncate text-base font-extrabold leading-tight tracking-tight text-ink sm:text-lg", children: school?.name || "School fees" }),
    /* @__PURE__ */ jsxs("p", { className: "truncate text-[12px] font-semibold text-slate-500", children: [
      school?.schoolCode ? `${school.schoolCode} · ` : "",
      "Secure fee payment"
    ] })
  ] }),
  /* @__PURE__ */ jsx(LogoMark, { className: "h-9 w-9 shrink-0" })
] }) });
const PAY_STUDENT = {
  id: "65f1c2a4e8b9d0123456789a",
  studentId: "SCH-DEMO-01-2026-8054",
  studentName: "Ama Serwaa Boateng",
  studentClass: "JHS 2A",
  totalOwed: 85e3,
  totalPaid: 1e4,
  balance: 75e3,
  deadline: new Date(Date.now() + 21 * 864e5).toISOString(),
  school: { _id: "65f1c2a4e8b9d0123456789b", schoolCode: "SCH-DEMO-01", name: "Prampram Basic School" }
};
const PayPageHarness = ({ loading = false }) => loading ? /* @__PURE__ */ jsx("div", { className: "animate-pulse", children: /* @__PURE__ */ jsx("div", { className: "h-48 rounded-2xl bg-slate-200/70" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
  /* @__PURE__ */ jsx(PayHeader, { school: PAY_STUDENT.school }),
  /* @__PURE__ */ jsx(BalanceCard, { student: PAY_STUDENT }),
  /* @__PURE__ */ jsx(MomoForm, { student: PAY_STUDENT, onSubmit: () => {
  }, submitting: false })
] });
let pass = 0;
let fail = 0;
const check = async (name, fn) => {
  try {
    const detail = await fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};
const at = (path) => /* @__PURE__ */ jsx(MemoryRouter, { initialEntries: [path], children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(ToastProvider, { children: /* @__PURE__ */ jsx(Routes, { children: /* @__PURE__ */ jsxs(Route, { path: "/dashboard", element: /* @__PURE__ */ jsx(DashboardLayout, {}), children: [
  /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(Overview, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "students", element: /* @__PURE__ */ jsx(Students, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "payments", element: /* @__PURE__ */ jsx(Payments, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "installment-plans", element: /* @__PURE__ */ jsx(InstallmentPlans, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "sms-reminders", element: /* @__PURE__ */ jsx(SmsReminders, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "reports", element: /* @__PURE__ */ jsx(Reports, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "activity-log", element: /* @__PURE__ */ jsx(ActivityLog, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "user-management", element: /* @__PURE__ */ jsx(UserManagement, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "settings", element: /* @__PURE__ */ jsx(Settings, {}) })
] }) }) }) }) });
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
  "Dashboard",
  "Students",
  "Payments",
  "Installment Plans",
  "SMS Reminders",
  "Reports",
  "Activity Log",
  "User Management",
  "Settings"
];
const currentInRail = (html) => {
  const railStart = html.indexOf('aria-label="Dashboard modules"');
  if (railStart === -1) return { count: 0, label: null };
  const railEnd = html.indexOf("</nav>", railStart);
  const rail = railEnd === -1 ? html.slice(railStart) : html.slice(railStart, railEnd);
  const count = countOf(rail, 'aria-current="page"');
  if (count === 0) return { count, label: null };
  const at_ = rail.indexOf('aria-current="page"');
  const close = rail.indexOf("</a>", at_);
  const anchor = rail.slice(at_, close === -1 ? at_ + 4e3 : close);
  return { count, label: MODULES.find((label) => anchor.includes(`>${label}<`)) || "(unreadable)" };
};
await check("the shell mounts at /dashboard", () => {
  const html = renderRoute("/dashboard");
  if (!has(html, "Skip to content")) throw new Error("no skip link");
  if (!has(html, 'aria-label="Dashboard modules"')) throw new Error("the module rail is missing");
  return "skip link and rail present";
});
await check("all nine modules are in the rail", () => {
  const html = renderRoute("/dashboard");
  const missing = MODULES.filter((label) => !has(html, `>${label}<`));
  if (missing.length) throw new Error(`missing from the rail: ${missing.join(", ")}`);
  return "9 of 9";
});
await check("the shell replaces the marketing chrome", () => {
  const html = renderRoute("/dashboard");
  ["How It Works", "For Schools", "Get Started Free"].forEach((link) => {
    if (has(html, link)) throw new Error(`the marketing navbar leaked in: "${link}"`);
  });
  if (!has(html, "Back to website")) throw new Error("no route back to the public site");
  return "no marketing links, footer escape preserved";
});
await check("the header scopes school, term and search", () => {
  const html = renderRoute("/dashboard");
  ["Your school", "Current term", "Search students", "New Payment"].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the header is missing "${needle}"`);
  });
  return "unloaded placeholders, search and New Payment all present";
});
await check("exactly one rail entry is marked current, on every route", () => {
  const routes = [
    ["/dashboard", "Dashboard"],
    ["/dashboard/students", "Students"],
    ["/dashboard/payments", "Payments"],
    ["/dashboard/installment-plans", "Installment Plans"],
    ["/dashboard/sms-reminders", "SMS Reminders"],
    ["/dashboard/reports", "Reports"],
    ["/dashboard/activity-log", "Activity Log"],
    ["/dashboard/user-management", "User Management"],
    ["/dashboard/settings", "Settings"]
  ];
  routes.forEach(([path, expected]) => {
    const html = renderRoute(path);
    const { count, label } = currentInRail(html);
    if (count !== 1) throw new Error(`${path} marked ${count} rail entries current, expected 1`);
    if (label !== expected) throw new Error(`${path} marked "${label}" current, expected "${expected}"`);
  });
  return "9 routes, one correct entry each";
});
await check("every module page renders its own content", () => {
  const pages = [
    // `/dashboard` is absent: the Overview is legitimately *loading* during SSR
    // (effects do not run, and it starts `loading: true` on purpose so a live
    // school never sees a flash of fixture figures). It has its own check below.
    ["/dashboard/students", "Select all students on this page"],
    // The needle is a control the built page always renders, not the old
    // scaffold's "Refunds" placeholder — same reasoning as the SMS entry below.
    // `Record manual / cash payment` is in the page header, so it is present in
    // the server render regardless of which state the data layer is in.
    ["/dashboard/payments", "Record manual / cash payment"],
    ["/dashboard/installment-plans", "Installment Compliance Dashboard"],
    // The needle is the audience stepper, not the old honest-failure banner. That
    // banner ("No school-facing SMS send endpoint") is gone because the route
    // exists now, and a mockcheck that keeps asserting its presence would go green
    // only while the module was broken. `Select Audience` is rendered on the
    // server — it is the default tab's first control — so it is the honest thing
    // to assert.
    ["/dashboard/sms-reminders", "Select Audience"],
    // `&amp;`, not `&`: `renderToString` escapes the ampersand, so a needle
    // written as prose fails against correct markup. This also changed from the
    // scaffold's lowercase section title to the real card's name.
    ["/dashboard/reports", "Outstanding Balances &amp; Arrears Ledger"],
    ["/dashboard/activity-log", "Read-only by design"],
    // The needle is the roster's own primary action. Asserting the module's title
    // would pass even if the table never rendered, which is the failure a route
    // check is supposed to catch.
    ["/dashboard/user-management", "Invite team member"]
  ];
  pages.forEach(([path, needle]) => {
    const html = renderRoute(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });
  return "8 module pages rendered";
});
await check("Settings and User Management are hidden from non-admin roles in the rail", () => {
  const teacher = visibleDashboardNav("teacher").flatMap((g) => g.items.map((i) => i.label));
  const admin = visibleDashboardNav("school_admin").flatMap((g) => g.items.map((i) => i.label));
  for (const hidden of ["Settings", "User Management"]) {
    if (teacher.includes(hidden)) throw new Error(`a teacher can see ${hidden}`);
    if (!admin.includes(hidden)) throw new Error(`a school admin cannot see ${hidden}`);
  }
  if (teacher.length !== 7) throw new Error(`teacher rail has ${teacher.length} entries, expected 7`);
  if (admin.length !== 12) throw new Error(`admin rail has ${admin.length} entries, expected 12`);
  return "teacher 7, school admin 12";
});
await check("the money and school-data modules are not in a teacher rail", () => {
  const teacher = visibleDashboardNav("teacher").flatMap((g) => g.items.map((i) => i.label));
  const accountant = visibleDashboardNav("accountant").flatMap((g) => g.items.map((i) => i.label));
  const guarded = ["Parent Messages", "Buy SMS Credit", "Advertisements"];
  for (const hidden of guarded) {
    if (teacher.includes(hidden)) {
      throw new Error(`a teacher can see ${hidden} — that is not a teacher surface`);
    }
    if (!accountant.includes(hidden)) {
      throw new Error(`an accountant cannot see ${hidden}, but is allowed to use it`);
    }
  }
  return `all ${guarded.length} hidden from teachers, all shown to accountants`;
});
await check("the Payments KPI band aggregates the summary, never the visible rows", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(
      PaymentKpiRow,
      {
        summary: {
          totalInflow: 318e5,
          totalTransactions: 342,
          previousTotalInflow: 2784e4,
          trendPercent: 14.2,
          networks: [
            { network: "MTN", label: "MTN MoMo", amount: 21624e3, count: 232, sharePercent: 68, wallets: 232 },
            { network: "VODAFONE", label: "Vodafone Cash", amount: 7e6, count: 60, sharePercent: 22, wallets: 58 },
            { network: "AIRTELTELIGO", label: "AT Money", amount: 3176e3, count: 50, sharePercent: 10, wallets: 49 }
          ],
          awaitingConfirmation: { amount: 1485e3, count: 3 }
        },
        loading: false
      }
    )
  );
  ["318,000", "successful transaction", "216,240", "distinct mobile wallet"].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the KPI band is missing "${needle}"`);
    }
  );
  if (!has(html, "Total inflow")) throw new Error("the band has no total-inflow tile");
  if (!has(html, "Awaiting confirmation"))
    throw new Error("the band has no awaiting-confirmation tile");
  if (has(html, "Escrow")) throw new Error("the KPI band is claiming an escrow state");
  if (has(html, "sweep")) throw new Error("the KPI band is claiming a bank sweep");
  return "cedis formatted, 342 from the aggregate, no invented settlement figures";
});
await check("the settlement band states that no sweep runs", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(MemoryRouter, { children: /* @__PURE__ */ jsx(
      SettlementBand,
      {
        school: {
          payment: {
            gatewayMode: "hubtel",
            bankAccount: {
              accountName: "Prampram Basic School",
              accountNumber: "0123456789",
              bankName: "GCB Bank",
              branch: "Prampram"
            }
          }
        }
      }
    ) })
  );
  if (!has(html, "No automated sweep"))
    throw new Error("the band does not disclose that no sweep is automated");
  if (!has(html, "6789")) throw new Error("the masked account number is not rendered");
  if (has(html, "0123456789")) throw new Error("the full account number is rendered");
  if (!has(html, "Hubtel")) throw new Error("the configured gateway is not named");
  return "gateway named, account masked to last four, sweep disclosed as absent";
});
await check("the Overview renders its headline and KPI band", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(
      KpiRow,
      {
        kpis: {
          totalStudents: { value: 1e3 },
          expectedOwed: { amount: 425e5 },
          collected: { amount: 318e5, ratePercent: 74.8, rateLabel: "Collection Rate" },
          overdue: { students: 87, amount: 412e4 }
        }
      }
    )
  );
  [
    "Total Students",
    "Total Expected Owed",
    "Total Collected",
    "Overdue Students",
    "Collection Rate",
    "Immediate Attention"
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the KPI band is missing "${needle}"`);
  });
  if (!has(html, "318,000")) {
    throw new Error(`the collected figure did not render as 318,000 (${formatCediShort(318e5)})`);
  }
  if (!has(html, "GH₵")) throw new Error("no cedi symbol on the figure");
  if (has(html, "31800000")) throw new Error("a raw pesewa count is on screen");
  return "4 KPI tiles, figures in cedis";
});
await check("no fabricated identity or figure survives on the Overview", () => {
  const html = renderRoute("/dashboard");
  [
    "Prampram Basic School",
    "Basic & JHS Campus",
    "Academic Term 1",
    "2025/2026",
    "Re-opening week",
    "Target Term Threshold",
    "Enrolled in MoMo direct billing",
    "vs L/T",
    "on Installment grace",
    "Overdue MoMo Prompt"
  ].forEach((needle) => {
    if (has(html, needle)) {
      throw new Error(`the Overview still renders the fixture string "${needle}"`);
    }
  });
  return "no fixture identity, term, target or KPI note is rendered";
});
await check("the Overview renders every visualisation region", () => {
  const html = renderToString(
    /* @__PURE__ */ jsxs(MemoryRouter, { children: [
      /* @__PURE__ */ jsx(CollectionsCard, { term: EMPTY_OVERVIEW.term, seriesFor: () => EMPTY_OVERVIEW.weeklyInflow.map((row) => ({ label: row.week, value: row.total })) }),
      /* @__PURE__ */ jsx(RecentTransactionsCard, { transactions: EMPTY_OVERVIEW.transactions, totalCount: EMPTY_OVERVIEW.transactionCount }),
      /* @__PURE__ */ jsx(PaymentChannelsCard, { channels: EMPTY_OVERVIEW.channels }),
      /* @__PURE__ */ jsx(UpcomingInstallmentsCard, { upcoming: EMPTY_OVERVIEW.upcomingInstallments })
    ] })
  );
  [
    "Collections This Term (Weekly)",
    "Payment Channels",
    "Recent MoMo Transactions",
    "Upcoming Installments"
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  });
  return "all four region cards render their headings";
});
await check("regions with no endpoint say so instead of drawing figures", () => {
  const html = renderToString(
    /* @__PURE__ */ jsxs(MemoryRouter, { children: [
      /* @__PURE__ */ jsx(CollectionsCard, { term: EMPTY_OVERVIEW.term, seriesFor: () => EMPTY_OVERVIEW.weeklyInflow.map((row) => ({ label: row.week, value: row.total })) }),
      /* @__PURE__ */ jsx(UpcomingInstallmentsCard, { upcoming: EMPTY_OVERVIEW.upcomingInstallments }),
      /* @__PURE__ */ jsx(PaymentChannelsCard, { channels: EMPTY_OVERVIEW.channels })
    ] })
  );
  ["No weekly breakdown yet", "not available yet", "No completed payments in this period yet"].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the empty state is missing "${needle}"`);
    }
  );
  ["Cumulative Net Inflow", "Scheduled Tranches", "Expected Inflow"].forEach((needle) => {
    if (has(html, needle)) {
      throw new Error(`"${needle}" rendered with no data behind it`);
    }
  });
  return "three empty states, no headline figures";
});
await check("the channels card renders real payment-method rows", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(MemoryRouter, { children: /* @__PURE__ */ jsx(
      PaymentChannelsCard,
      {
        channels: [
          { key: "momo", label: "momo", amount: 21624e3, transactionCount: 680, sharePercent: 68 },
          { key: "card", label: "card", amount: 6996e3, transactionCount: 220, sharePercent: 22 }
        ]
      }
    ) })
  );
  ["momo", "card", "680", "220", "Share", "Payments"].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the channels card is missing "${needle}"`);
  });
  if (has(html, "Auth rate")) {
    throw new Error("an authorisation rate is rendered, but no endpoint returns one");
  }
  return "methods, share and transaction counts from the real shape";
});
await check("the Overview shows a skeleton, not a flash of figures", () => {
  const html = renderRoute("/dashboard");
  if (!has(html, "animate-pulse")) throw new Error("no loading skeleton on the first paint");
  return "skeleton on the first paint, no figures";
});
await check("the cedi formatter never abbreviates a six-figure total", () => {
  const rendered = formatCediShort(425e5);
  if (has(rendered, "K") || has(rendered, "M")) throw new Error(`"${rendered}" was abbreviated`);
  if (rendered !== "GH₵ 425,000") throw new Error(`unexpected rendering: "${rendered}"`);
  if (formatCediWhole(69e4) !== "6,900") {
    throw new Error("formatCediWhole did not drop the decimals");
  }
  return "GH₵ 425,000 and 6,900";
});
await check("the roster sub-components render on their own", () => {
  renderToString(
    /* @__PURE__ */ jsx(
      RosterKpiRow,
      {
        stats: {
          totalRoster: 1e3,
          fullyCleared: 737,
          clearedPercent: 73.7,
          activePlans: 176,
          activePlanStudents: 150,
          overdueStudents: 87,
          overdueAmount: 412e4,
          totalOwed: 425e5,
          totalPaid: 318e5,
          outstanding: 107e5
        }
      }
    )
  );
  const band = renderToString(
    /* @__PURE__ */ jsx(
      RosterKpiRow,
      {
        stats: {
          totalRoster: 1e3,
          fullyCleared: 737,
          clearedPercent: 73.7,
          activePlans: 176,
          activePlanStudents: 150,
          overdueStudents: 87,
          overdueAmount: 412e4,
          totalOwed: 425e5,
          totalPaid: 318e5,
          outstanding: 107e5
        }
      }
    )
  );
  ["Total Roster", "Fully Cleared", "Installment Pledges", "Overdue Balances"].forEach((label) => {
    if (!has(band, label)) throw new Error(`the KPI band is missing "${label}"`);
  });
  if (!has(band, "73.7%")) throw new Error("the cleared percentage is not rendered");
  renderToString(
    /* @__PURE__ */ jsx(
      RosterFilterBar$1,
      {
        filters: { search: "", class: "", feeStatus: "", planStatus: "", gender: "", status: "active" },
        setFilter: () => {
        },
        clearFilters: () => {
        },
        hasFilters: false,
        classes: ["JHS 1", "JHS 2A"]
      }
    )
  );
  renderToString(
    /* @__PURE__ */ jsx(
      StudentTable,
      {
        rows: [],
        loading: false,
        error: null,
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
        filters: { sortBy: "createdAt", sortOrder: "desc" },
        hasFilters: false,
        selection: {
          allVisibleSelected: false,
          selected: /* @__PURE__ */ new Set(),
          toggleAllVisible: () => {
          },
          toggleRow: () => {
          }
        },
        onSort: () => {
        },
        onPageChange: () => {
        },
        onPerPageChange: () => {
        },
        onOpenProfile: () => {
        },
        onEdit: () => {
        },
        onClearFilters: () => {
        },
        onMessage: () => {
        },
        onRegeneratePayLink: () => {
        }
      }
    )
  );
  return "KPI band, filter bar and table all render";
});
await check("the roster renders its own regions", () => {
  const html = renderRoute("/dashboard/students");
  [
    // `&amp;`, not `&`: `renderToString` escapes the ampersand in the title, and
    // a needle written as prose fails against correct markup.
    "Students &amp; Fee Roster",
    "Fee Status",
    "Plan Status",
    "Export Roster",
    "Add New Student",
    "Select all students on this page"
  ].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the roster is missing "${needle}"`);
  });
  return "header, KPI band, filters, table and actions";
});
await check("Add New Student is enabled, not a dead button", () => {
  const html = renderRoute("/dashboard/students");
  const labelAt = html.indexOf("Add New Student");
  if (labelAt === -1) throw new Error("the Add New Student action did not render");
  const open = html.lastIndexOf("<button", labelAt);
  if (open === -1) throw new Error("the Add New Student label is not inside a button");
  const tag = html.slice(open, html.indexOf(">", open));
  if (/\sdisabled(\s|=|$)/.test(tag)) {
    throw new Error(
      `the Add New Student button renders disabled: ${tag}
It must open the class list when the school has no classes, not sit inert.`
    );
  }
  return "the action is live even with no class list loaded";
});
await check("a school with no classes is given a way to add some", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(
      ClassListEditor,
      {
        open: true,
        schoolId: "6abb954124ad2e6613e7d90c",
        classes: [],
        onClose: () => {
        },
        onSaved: () => {
        }
      }
    )
  );
  ["Save classes", "Add a class", "Basic + JHS"].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the class editor is missing "${needle}"`);
  });
  if (!has(html, "No classes yet")) {
    throw new Error("the empty state does not explain that nothing is configured yet");
  }
  return "the dialog renders templates, an add field and a save action";
});
await check("the module tab bar marks exactly one section", () => {
  const html = renderRoute("/dashboard/students");
  const navStart = html.indexOf('aria-label="Students sections"');
  if (navStart === -1) throw new Error("the section tabs did not render");
  const tabs = html.slice(navStart, html.indexOf("</nav>", navStart));
  const count = countOf(tabs, 'aria-current="page"');
  if (count !== 1) throw new Error(`${count} tabs marked current, expected 1`);
  if (!has(tabs, ">Roster<")) throw new Error("the roster section should be the current one");
  return "exactly one section current";
});
await check("FormField is only ever imported by name", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../../src/", import.meta.url).pathname.replace(/^\//, "");
  const offenders = [];
  const walk = (dir) => {
    readdirSync(dir).forEach((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      if (!full.endsWith(".jsx")) return;
      const source = readFileSync(full, "utf8");
      if (/^import\s+SelectField\s+from/m.test(source)) {
        offenders.push(full.replace(root, "src/"));
      }
    });
  };
  walk(root);
  if (offenders.length) {
    throw new Error(`default-imported SelectField (which is Field) in: ${offenders.join(", ")}`);
  }
  return "no default imports of SelectField";
});
await check("Settings shows a skeleton on the server, not a flash of empty fields", () => {
  const html = renderRoute("/dashboard/settings");
  if (!has(html, "animate-pulse")) {
    throw new Error("Settings did not render a loading skeleton on its first frame");
  }
  if (has(html, "Save profile")) {
    throw new Error("Settings rendered its save controls before any settings had loaded");
  }
  return "skeleton on the first paint, no editable fields";
});
await check("every Settings section declares whether it is writable", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/pages/dashboard/Settings.jsx", import.meta.url),
    "utf8"
  );
  for (const label of [
    "School Profile",
    "Payment Gateway",
    "SMS & Sender ID",
    "Academic Calendar",
    "Notification Preferences",
    "Fees & Billing Structure",
    "Security & Compliance"
  ]) {
    if (!source.includes(`label: '${label}'`)) {
      throw new Error(`the Settings rail is missing the "${label}" section`);
    }
  }
  const readOnly = source.match(/writable: false,\s*\n\s*reason:/g) || [];
  if (readOnly.length < 3) {
    throw new Error(`${readOnly.length} read-only sections carry a reason; expected at least 3`);
  }
  return "7 sections, 3 read-only and each with a stated reason";
});
await check("the Reports catalogue never offers PDF", async () => {
  const { REPORTS: REPORTS2 } = await import("./assets/reports-BcS3xgcI.js").then((n) => n.c);
  if (REPORTS2.length !== 9) throw new Error(`expected 9 reports, the catalogue has ${REPORTS2.length}`);
  const withPdf = REPORTS2.filter((r) => (r.formats || []).includes("pdf"));
  if (withPdf.length) {
    throw new Error(`PDF offered on: ${withPdf.map((r) => r.key).join(", ")}`);
  }
  const withoutExport = REPORTS2.filter((r) => !(r.formats || []).length);
  if (withoutExport.length) {
    throw new Error(`no export format on: ${withoutExport.map((r) => r.key).join(", ")}`);
  }
  return `9 reports, ${REPORTS2.length} with CSV/XLSX, none with PDF`;
});
await check("the Reports grid renders its catalogue", () => {
  const html = renderRoute("/dashboard/reports");
  ["All Reports", "Collections &amp; Revenue", "Compliance &amp; Arrears"].forEach((needle) => {
    if (!has(html, needle)) throw new Error(`the Reports grid is missing the "${needle}" tab`);
  });
  if (!has(html, "Daily Collection Summary")) {
    throw new Error("the Reports grid did not render a report card");
  }
  return "category tabs and report cards";
});
await check("the invite dialog explains what the recipient gets", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/components/user-management/InviteTeamMemberDialog.jsx", import.meta.url),
    "utf8"
  );
  for (const needle of ["Full name", "Email address"]) {
    if (!source.includes(needle)) throw new Error(`the invite dialog has no "${needle}" field`);
  }
  if (!source.includes("What happens next")) {
    throw new Error("the dialog does not explain what the recipient will be emailed");
  }
  for (const needle of ["temporary password", "your name, so they know who invited"]) {
    if (!source.includes(needle)) {
      throw new Error(`the dialog does not mention "${needle}"`);
    }
  }
  if (/name=["']password["']|type=["']password["']/.test(source)) {
    throw new Error("the invite dialog offers a password field; the password is server-generated");
  }
  return "two required fields, and the delivery explained up front";
});
await check("a school_admin sees User Management in the rail of the page itself", () => {
  const html = renderRoute("/dashboard/user-management");
  if (!has(html, 'aria-current="page"')) {
    throw new Error("no rail entry is marked current on /dashboard/user-management");
  }
  if (!has(html, "Search by name, email or position")) {
    throw new Error("the roster did not render its search box");
  }
  return "route and rail agree";
});
await check("the dialog pins its header and footer outside the scroll area", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/components/common/Modal.jsx", import.meta.url),
    "utf8"
  );
  if (/max-h-\[\d+vh\][^"']*overflow-y-auto/.test(source)) {
    throw new Error("Modal scrolls the whole panel again — the footer will scroll out of reach");
  }
  if (!/flex max-h-\[\d+vh\][^"']*flex-col/.test(source)) {
    throw new Error("the Modal panel is not a flex column");
  }
  if (!/flex-1 overflow-y-auto/.test(source)) {
    throw new Error("the Modal body is not the scroll container");
  }
  const shrinkZero = (source.match(/shrink-0/g) || []).length;
  if (shrinkZero < 2) {
    throw new Error(`only ${shrinkZero} shrink-0 elements; the header and footer both need one`);
  }
  return "header and footer pinned, body scrolls";
});
await check("the Manual Payment dialog truncates its student identity lines", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/components/dashboard/RecordManualPaymentDialog.jsx", import.meta.url),
    "utf8"
  );
  const identityLines = source.match(/(?:student|s)\.studentId\} · \{(?:student|s)\.studentClass\}/g) || [];
  if (identityLines.length !== 2) {
    throw new Error(`expected 2 student-identity lines, found ${identityLines.length}`);
  }
  const untruncated = source.match(
    /<p(?![^>]*truncate)[^>]*>\s*\{(?:student|s)\.studentId\}/g
  );
  if (untruncated) {
    throw new Error(`student-identity line is not truncated: ${untruncated[0]}`);
  }
  if (!/block truncate text-\[11px\][^"]*"[^>]*>\s*\{s\.studentId\}/s.test(source)) {
    throw new Error("the search-result identity line lost its truncate");
  }
  return "both identity lines truncate";
});
await check("the Overview header actions do not pin themselves against wrapping", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(
    new URL("../../src/pages/dashboard/Overview.jsx", import.meta.url),
    "utf8"
  );
  if (/shrink-0[^"']*flex-wrap/.test(source) || /flex-wrap[^"']*shrink-0/.test(source)) {
    throw new Error("the action row keeps both flex-wrap and shrink-0");
  }
  if (!/w-full flex-col gap-2 sm:w-auto sm:flex-row/.test(source)) {
    throw new Error("the action row does not go full width on mobile");
  }
  return "stacked full width below sm, inline above";
});
await check("the pay page renders its own shell, not the marketing chrome", () => {
  const html = renderToString(/* @__PURE__ */ jsx(PayPageHarness, {}));
  if (!has(html, "Secure fee payment")) throw new Error("the pay header did not render");
  ["How It Works", "For Schools", "Get Started Free", "Sign in"].forEach((link) => {
    if (has(html, link)) throw new Error(`the marketing chrome leaked into the pay page: ${link}`);
  });
  return "own header, no navbar or footer links";
});
await check("the pay route is registered outside AppChrome", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  const payRoute = source.match(/<Route\s+path="\/pay"\s+element=\{\{?<(ParentLayout)\s*\/>\}?\s*>/);
  if (!payRoute) {
    throw new Error('no <Route path="/pay" element={<ParentLayout />}> is registered');
  }
  if (payRoute[1] !== "ParentLayout") {
    throw new Error(`/pay renders under ${payRoute[1]}, not ParentLayout`);
  }
  for (const child of [":token", ":token/history", ":token/plan/request", ":token/support"]) {
    if (!source.includes(`<Route path="${child}"`)) {
      throw new Error(`/pay/${child} is not registered`);
    }
  }
  const appChromeOpen = source.indexOf("<Route element={<AppChrome />}>");
  const appChromeClose = source.indexOf("</Route>", appChromeOpen);
  const payIndex = source.indexOf('<Route path="/pay"');
  if (appChromeOpen === -1 || appChromeClose === -1) {
    throw new Error("could not locate the AppChrome block");
  }
  if (payIndex < appChromeClose) {
    throw new Error("/pay is nested inside AppChrome");
  }
  return "registered as a sibling of AppChrome, under ParentLayout";
});
await check("a loading pay page shows a skeleton, not an empty screen", () => {
  const html = renderToString(/* @__PURE__ */ jsx(PayPageHarness, { loading: true }));
  if (!has(html, "animate-pulse")) throw new Error("no loading skeleton");
  return "skeleton while the pay view is fetched";
});
await check("the pay form shows the real balance, in cedis", () => {
  const html = renderToString(/* @__PURE__ */ jsx(PayPageHarness, {}));
  if (!has(html, formatCedi(PAY_STUDENT.balance))) {
    throw new Error(`the balance did not render as ${formatCedi(PAY_STUDENT.balance)}`);
  }
  if (has(html, "75000.00")) throw new Error("a raw pesewa count is on screen");
  ["Ama Serwaa Boateng", "JHS 2A", "MTN MoMo", "Vodafone Cash", "AirtelTigo Money"].forEach(
    (needle) => {
      if (!has(html, needle)) throw new Error(`the pay view is missing "${needle}"`);
    }
  );
  return `${formatCedi(PAY_STUDENT.balance)}, all three networks offered`;
});
await check("every JSX component is imported or declared locally", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../../src/", import.meta.url).pathname.replace(/^\//, "");
  const GLOBALS = /* @__PURE__ */ new Set(["Fragment"]);
  const offenders = [];
  const walk = (dir) => {
    readdirSync(dir).forEach((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      if (!/\.jsx?$/.test(name)) return;
      const source = readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      if (!/<[A-Z]/.test(source)) return;
      const known = new Set(GLOBALS);
      for (const m of source.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) {
        known.add(m[1]);
      }
      for (const m of source.matchAll(/\bimport\b[^;'"]*?\{([^}]*)\}\s*from/g)) {
        m[1].split(",").forEach((part) => {
          const name2 = part.trim().split(/\s+as\s+/).pop().trim();
          if (name2) known.add(name2);
        });
      }
      for (const m of source.matchAll(/import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from/g)) {
        known.add(m[1]);
      }
      for (const m of source.matchAll(/\(\s*\{([^{}]*)\}\s*\)\s*=>/g)) {
        m[1].split(",").forEach((part) => {
          const name2 = part.trim().split(/[:=]/)[0].trim();
          if (name2) known.add(name2);
        });
      }
      for (const m of source.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([A-Z][\w$]*)/g)) {
        known.add(m[2]);
      }
      for (const m of source.matchAll(/(?:const|let|var|function|class)\s+([A-Z][\w$]*)/g)) {
        known.add(m[1]);
      }
      for (const m of source.matchAll(/<([A-Z][\w$]*)(?=[\s/>])/g)) {
        if (!known.has(m[1])) {
          offenders.push(`${full.replace(root, "src/")}: <${m[1]}>`);
        }
      }
    });
  };
  walk(root);
  if (offenders.length) {
    throw new Error(
      `${offenders.length} component(s) used but never imported or declared — the build will pass and the route will throw at runtime:
        ${offenders.join("\n        ")}`
    );
  }
  return "no unresolved JSX components";
});
await check("all six Students tabs render", () => {
  const expected = {
    roster: "Select all students on this page",
    import: "Upload a roster",
    alumni: "Graduation year",
    cohorts: "cohort"
    // the empty state, before any data arrives
  };
  Object.entries(expected).forEach(([tab, needle]) => {
    const html = renderRoute(`/dashboard/students?tab=${tab}`);
    if (!has(html, needle)) {
      throw new Error(`the "${tab}" tab did not render "${needle}"`);
    }
  });
  const promotions = renderRoute("/dashboard/students?tab=promotions");
  if (!has(promotions, "Promotions &amp; Graduation")) {
    throw new Error("the promotions tab did not render its heading");
  }
  if (has(promotions, "This school has no classes yet")) {
    throw new Error(
      "the promotions tab claimed the school has no classes before the school loaded"
    );
  }
  const idCards = renderRoute("/dashboard/students?tab=id-cards");
  if (!has(idCards, "Print batch")) {
    throw new Error("the ID card tab did not render its batch panel");
  }
  if (!has(idCards, "A4 sheets needed")) {
    throw new Error("the ID card tab did not render its sheet arithmetic");
  }
  return "roster, id-cards, promotions, import, alumni and cohorts all render";
});
console.log(`
${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
