import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { useLocation, Link, Outlet, Navigate, useSearchParams, MemoryRouter, Routes, Route } from "react-router-dom";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef, useMemo, useId } from "react";
import axios from "axios";
import { Info, TriangleAlert, CircleAlert, CircleCheck, X, Settings, Megaphone, Users, Building2, Gauge, Menu, Globe, Search, User, ChevronDown, LogOut, ShieldAlert, ArrowLeft, LoaderCircle, TrendingUp, Banknote, PiggyBank, HandCoins, ArrowUpRight, MessageSquare, UserCog, RotateCcw, ChevronLeft, ChevronRight, Phone, CalendarClock, ShieldCheck, Trash2, Check, Save, ServerCog, Compass, LifeBuoy } from "lucide-react";
import { createPortal } from "react-dom";
const API_BASE_URL = "http://localhost:2345/api";
const clearSession = () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("refresh_token");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
let provisionRedirectIssued = false;
const routeToSchoolProvisioning = () => {
  if (provisionRedirectIssued) return;
  const { pathname } = window.location;
  if (pathname.startsWith("/onboarding")) return;
  provisionRedirectIssued = true;
  window.location.href = "/onboarding/school-profile";
};
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.data?.code === "SCHOOL_NOT_LINKED") {
      routeToSchoolProvisioning();
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.tokens || {};
        if (!accessToken) {
          clearSession();
          return Promise.reject(refreshError);
        }
        localStorage.setItem("auth_token", accessToken);
        if (newRefreshToken) localStorage.setItem("refresh_token", newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError2) {
        clearSession();
        return Promise.reject(refreshError2);
      }
    }
    return Promise.reject(error);
  }
);
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
const toApiError = (error, fallback) => {
  const message = error?.response?.data?.message || (error?.code === "ECONNABORTED" ? "The request timed out. Please try again." : error?.message) || fallback;
  const wrapped = new Error(message);
  wrapped.status = error?.response?.status;
  wrapped.code = error?.response?.data?.code;
  return wrapped;
};
const updateMe = async (userId, patch) => {
  try {
    const { data } = await api.put(`/users/${userId}`, patch);
    return data.user || data.data?.user || data.data || data;
  } catch (error) {
    throw toApiError(error, "Failed to save your profile.");
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
const TONES$1 = {
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
          const { icon: Icon, ring, iconClass } = TONES$1[tone] || TONES$1.info;
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
  DASHBOARD: "/dashboard",
  // Dashboard modules nest under DASHBOARD so the whole management system is one
  // guarded subtree: a single `<Route path="/dashboard">` owns the shell, and
  // the guard's one dashboard check covers every module beneath it.
  DASHBOARD_STUDENTS: "/dashboard/students",
  DASHBOARD_PAYMENTS: "/dashboard/payments",
  DASHBOARD_PLANS: "/dashboard/installment-plans",
  DASHBOARD_SMS: "/dashboard/sms-reminders",
  DASHBOARD_REPORTS: "/dashboard/reports",
  DASHBOARD_ACTIVITY: "/dashboard/activity-log",
  DASHBOARD_USERS: "/dashboard/user-management",
  DASHBOARD_SETTINGS: "/dashboard/settings",
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
  ADMIN_SETTINGS: "/admin/settings"
};
const NAV_LINKS = [
  { label: "Features", to: ROUTES.FEATURES },
  { label: "Pricing", to: ROUTES.PRICING },
  { label: "How It Works", to: ROUTES.HOW_IT_WORKS },
  { label: "For Schools", to: ROUTES.FOR_SCHOOLS, accent: true },
  { label: "Contact", to: ROUTES.CONTACT }
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
const activeNavItem = (nav, pathname, role) => {
  const groups = visibleNav(nav, role);
  for (const group of groups) {
    const match = group.items.find((item) => isNavItemActive(pathname, item));
    if (match) return match;
  }
  return null;
};
const ADMIN_NAV = [
  {
    id: "overview",
    label: null,
    items: [
      {
        to: ROUTES.ADMIN,
        label: "Platform",
        icon: "Gauge",
        exact: true,
        description: "Schools, revenue and the platform SMS balance."
      }
    ]
  },
  {
    id: "tenants",
    label: "Tenants",
    items: [
      {
        to: ROUTES.ADMIN_SCHOOLS,
        label: "Schools",
        icon: "Building2",
        description: "Every school on the platform, and its lifecycle."
      },
      {
        to: ROUTES.ADMIN_USERS,
        label: "Users",
        icon: "Users",
        description: "Every account on the platform, across every school."
      }
    ]
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        to: ROUTES.ADMIN_CONTENT,
        label: "Content",
        icon: "Megaphone",
        description: "Review the creatives shown on the public pages."
      },
      {
        to: ROUTES.ADMIN_SETTINGS,
        label: "Settings",
        icon: "Settings",
        description: "Platform defaults and service health."
      }
    ]
  }
];
const visibleAdminNav = (role) => visibleNav(ADMIN_NAV, role);
const activeAdminItem = (pathname, role) => activeNavItem(ADMIN_NAV, pathname, role);
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
const HELPDESK_PHONE = "";
const USER_ROLES = ["super_admin", "school_admin", "accountant", "teacher", "viewer"];
const ROLE_LABELS = {
  super_admin: "Platform admin",
  school_admin: "School administrator",
  accountant: "School bursar",
  teacher: "Teacher",
  viewer: "Viewer"
};
const roleLabel = (role) => ROLE_LABELS[role] || "Signed in";
const ICONS = {
  Gauge,
  Building2,
  Users,
  Megaphone,
  Settings
};
const AdminSidebar = ({ variant = "fixed", className = "", onClose }) => {
  const { pathname } = useLocation();
  const groups = visibleAdminNav("super_admin");
  const isDrawer = variant === "drawer";
  return /* @__PURE__ */ jsxs(
    "aside",
    {
      className: `flex-col border-slate-200 bg-white ${isDrawer ? "border-r shadow-2xl" : "sticky top-0 h-screen border-r"} ${className}`,
      "aria-label": "Platform console modules",
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
        /* @__PURE__ */ jsx("div", { className: "shrink-0 border-b border-slate-100 px-4 py-3", children: /* @__PURE__ */ jsx("p", { className: "text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-700", children: "Platform console" }) }),
        /* @__PURE__ */ jsx("nav", { className: "min-h-0 flex-1 overflow-y-auto px-3 py-4", children: /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1", children: groups.flatMap((group) => group.items).map((item) => {
          const Icon = ICONS[item.icon] || Gauge;
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
            /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15", children: /* @__PURE__ */ jsx(Gauge, { className: "h-4 w-4", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsxs("span", { className: "min-w-0 flex-1", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight", children: "All schools" }),
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-white/70", children: "Platform-wide view" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            Link,
            {
              to: ROUTES.HOME,
              className: "mt-1.5 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
              children: "Back to website"
            }
          )
        ] })
      ]
    }
  );
};
const LogoMark = ({ className = "w-10 h-10", markClassName = "text-lg" }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: `${className} rounded-xl bg-brand-700 flex items-center justify-center text-white shadow-lift shrink-0`,
    "aria-hidden": "true",
    children: /* @__PURE__ */ jsx("span", { className: `font-extrabold tracking-tight ${markClassName}`, children: "S" })
  }
);
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
const TONES = {
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
    className: `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${TONES[tone] || TONES.slate} ${className}`,
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
const AdminTopbar = ({ user, onOpenNav, navOpen = false, pathname, actions }) => {
  const { logout } = useAuth();
  const displayName = user?.name || "Account";
  const label = roleLabel(user?.role);
  const current = activeAdminItem(pathname, user?.role);
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const shortName = nameParts.length > 2 ? `${nameParts[0][0]}. ${nameParts.slice(1).join(" ")}` : displayName;
  return /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white", children: /* @__PURE__ */ jsxs("div", { className: "flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: onOpenNav,
        "aria-label": "Open navigation",
        "aria-expanded": navOpen,
        "aria-controls": "admin-nav-drawer",
        className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden",
        children: /* @__PURE__ */ jsx(Menu, { className: "h-5 w-5" })
      }
    ),
    /* @__PURE__ */ jsxs(
      Link,
      {
        to: ROUTES.ADMIN,
        className: "flex shrink-0 items-center gap-2.5 pr-1",
        "aria-label": "SukuuPay platform console",
        children: [
          /* @__PURE__ */ jsx(LogoMark, { className: "h-9 w-9", markClassName: "text-base" }),
          /* @__PURE__ */ jsxs("span", { className: "hidden text-lg font-extrabold tracking-tight text-ink sm:block", children: [
            "Sukuu",
            /* @__PURE__ */ jsx("span", { className: "text-brand-700", children: "Pay" })
          ] })
        ]
      }
    ),
    current && /* @__PURE__ */ jsxs("div", { className: "hidden min-w-0 items-center gap-2 sm:flex", children: [
      /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: "text-slate-300", children: "/" }),
      /* @__PURE__ */ jsx("span", { className: "truncate text-sm font-extrabold text-slate-600", children: current.label })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex shrink-0 items-center gap-2", children: [
      /* @__PURE__ */ jsx(Badge, { tone: "ink", icon: Globe, className: "hidden lg:inline-flex", children: "All schools" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled: true,
          title: "There is no platform-wide search yet — use the Schools list to filter",
          "aria-label": "Search (coming soon)",
          className: "hidden h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-300 md:flex",
          children: /* @__PURE__ */ jsx(Search, { className: "h-5 w-5" })
        }
      ),
      actions,
      /* @__PURE__ */ jsx(
        Popover,
        {
          align: "right",
          className: "max-w-[13rem]",
          panel: /* @__PURE__ */ jsxs("div", { className: "py-1.5", children: [
            /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 px-3.5 py-2.5", children: [
              /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-extrabold text-ink", children: displayName }),
              /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-semibold text-slate-500", children: label })
            ] }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.ADMIN_SETTINGS, icon: User, children: "Account settings" }),
            /* @__PURE__ */ jsx(MenuItem, { to: ROUTES.HOME, icon: Globe, children: "Back to website" }),
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
            /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white", children: /* @__PURE__ */ jsx(User, { className: "h-4 w-4", "aria-hidden": "true" }) }),
            /* @__PURE__ */ jsxs("span", { className: "hidden min-w-0 lg:block", children: [
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold leading-tight text-ink", children: shortName }),
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-slate-500", children: label })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { className: "hidden h-4 w-4 shrink-0 text-slate-400 lg:block", "aria-hidden": "true" })
          ] })
        }
      )
    ] })
  ] }) });
};
const AdminLayout = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
        href: "#admin-main",
        className: "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white",
        children: "Skip to content"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]", children: [
      /* @__PURE__ */ jsx(AdminSidebar, { variant: "fixed", className: "hidden lg:flex" }),
      /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col", children: [
        /* @__PURE__ */ jsx(
          AdminTopbar,
          {
            user,
            pathname,
            navOpen: drawerOpen,
            onOpenNav: () => setDrawerOpen(true)
          }
        ),
        /* @__PURE__ */ jsx("main", { id: "admin-main", tabIndex: -1, className: "min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-7xl", children: /* @__PURE__ */ jsx(Outlet, {}) }) })
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
      /* @__PURE__ */ jsx("div", { id: "admin-nav-drawer", children: /* @__PURE__ */ jsx(
        AdminSidebar,
        {
          variant: "drawer",
          onClose: () => setDrawerOpen(false),
          className: "fixed inset-y-0 left-0 z-50 flex w-[15.25rem] max-w-[85vw]"
        }
      ) })
    ] })
  ] });
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
const Forbidden = ({
  requiredRole,
  title,
  description,
  backTo,
  backLabel = "Back to dashboard",
  variant = "standalone",
  role
}) => {
  const isBare = variant === "bare";
  const modules = role ? visibleDashboardNav(role).flatMap((group) => group.items).slice(0, 4) : [];
  const panel = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        className: `mx-auto mb-6 flex items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ${isBare ? "h-14 w-14" : "h-16 w-16"}`,
        children: /* @__PURE__ */ jsx(ShieldAlert, { size: isBare ? 26 : 32, "aria-hidden": "true" })
      }
    ),
    /* @__PURE__ */ jsx(
      "p",
      {
        "aria-hidden": "true",
        className: "text-xs font-extrabold uppercase tracking-[0.2em] text-amber-700",
        children: "403"
      }
    ),
    /* @__PURE__ */ jsx(
      "h1",
      {
        className: `mt-2 font-display font-extrabold tracking-tight text-ink ${isBare ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`,
        children: title || "This area is not open to your role"
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600", children: description || (requiredRole ? `This page is limited to ${roleLabel(requiredRole)} accounts. You are signed in as ${roleLabel(
      role
    )}.` : "Your account does not have access to this page.") }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-3", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: backTo || ROUTES.DASHBOARD,
          className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
            backLabel
          ]
        }
      ),
      modules.map((link) => /* @__PURE__ */ jsx(
        Link,
        {
          to: link.to,
          className: "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: link.label
        },
        link.to
      ))
    ] })
  ] });
  if (isBare) return /* @__PURE__ */ jsx("div", { className: "py-6 text-center", children: panel });
  return /* @__PURE__ */ jsx("div", { className: "bg-slate-50", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx(Card, { padding: "p-8 sm:p-10", className: "text-center", children: panel }) }) });
};
const FullPageSpinner = () => /* @__PURE__ */ jsx("div", { className: "flex min-h-screen items-center justify-center", children: /* @__PURE__ */ jsx(LoaderCircle, { className: "h-10 w-10 animate-spin text-brand-700", "aria-label": "Loading" }) });
const AdminGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return /* @__PURE__ */ jsx(FullPageSpinner, {});
  if (!user) {
    return /* @__PURE__ */ jsx(Navigate, { to: ROUTES.LOGIN, state: { from: location }, replace: true });
  }
  if (user.role !== "super_admin") {
    return /* @__PURE__ */ jsx(
      Forbidden,
      {
        requiredRole: "super_admin",
        role: user.role,
        title: "The platform console is for platform admins",
        description: `This console runs every school on SukuuPay. It is limited to platform admin accounts, and you are signed in as ${user.role === "school_admin" ? "a school administrator" : user.role}. Your school’s records are in your own dashboard.`,
        backTo: ROUTES.DASHBOARD,
        backLabel: "Go to your dashboard"
      }
    );
  }
  return /* @__PURE__ */ jsx(Outlet, {});
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
const EmptyState = ({ icon: Icon, title, description, action }) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center", children: [
  Icon && /* @__PURE__ */ jsx("span", { className: "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700", children: /* @__PURE__ */ jsx(Icon, { className: "h-6 w-6", "aria-hidden": "true" }) }),
  /* @__PURE__ */ jsx("h3", { className: "text-base font-extrabold text-ink", children: title }),
  description && /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-md text-sm font-medium text-slate-500", children: description }),
  action && /* @__PURE__ */ jsx("div", { className: "mt-5", children: action })
] });
const PESEWAS_PER_CEDI = 100;
const nf = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const nfWhole = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });
const formatCedi = (pesewas) => `GH₵ ${nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;
const formatCediShort = (pesewas) => `GH₵ ${nfWhole.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI)}`;
const formatCount = (value) => nfWhole.format(Number(value) || 0);
const formatPercent = (value) => {
  const n = Number(value) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};
const splitCedi = (pesewas) => {
  const [whole, fraction] = nf.format((Number(pesewas) || 0) / PESEWAS_PER_CEDI).split(".");
  return { symbol: "GH₵", whole, fraction };
};
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
const KpiRow = ({ kpis }) => {
  const schools = kpis?.schools || {};
  const payments = kpis?.payments || {};
  const total = Number(schools.total) || 0;
  const conversionBase = (Number(schools.paid) || 0) + (Number(schools.onTrial) || 0);
  const conversionPercent = conversionBase ? (Number(schools.paid) || 0) / conversionBase * 100 : 0;
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6", children: [
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Schools on platform",
        icon: Building2,
        value: formatCount(total),
        footer: /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-500", children: "Trial converted to paid" }),
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: conversionBase ? formatPercent(conversionPercent) : "—" })
          ] }),
          /* @__PURE__ */ jsx(ProgressBar, { value: conversionPercent, label: "Trial schools converted to a paid plan" })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Active schools",
        icon: TrendingUp,
        value: formatCount(schools.active),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(schools.onTrial) }),
          " on trial",
          Number(schools.suspended) ? ` · ${formatCount(schools.suspended)} suspended` : ""
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Revenue this month",
        icon: Banknote,
        accent: true,
        valueTone: "text-brand-700",
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: payments.mtdRevenue, tone: "text-brand-700" }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(payments.mtdCount) }),
          " payments this month"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Revenue year to date",
        icon: TrendingUp,
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: payments.ytdRevenue }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCount(payments.ytdCount) }),
          " payments"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Platform markup",
        icon: PiggyBank,
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: payments.platformMarkup }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          "Earned on ",
          formatCount(payments.totalCompleted),
          " completed payments"
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      Tile,
      {
        label: "Pending payouts",
        icon: HandCoins,
        valueTone: Number(payments.pendingPayouts) ? "text-amber-600" : "text-ink",
        value: /* @__PURE__ */ jsx(CediValue, { pesewas: payments.pendingPayouts, tone: Number(payments.pendingPayouts) ? "text-amber-600" : "text-ink" }),
        footer: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-500", children: [
          "All time ",
          /* @__PURE__ */ jsx("span", { className: "font-extrabold text-ink", children: formatCediShort(payments.totalRevenue) })
        ] })
      }
    )
  ] });
};
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
const REVENUE_PERIODS = [
  { value: "mtd", label: "This month", bucket: "day" },
  { value: "last30", label: "Last 30 days", bucket: "day" },
  { value: "ytd", label: "This year", bucket: "month" },
  { value: "all", label: "All time", bucket: "month" }
];
const axisLabel = (period, bucket) => {
  const [year, month, day] = period.split("-").map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "short" });
  return bucket === "day" ? `${day} ${monthName}` : monthName;
};
const RevenueCard = ({ revenue, series, period, onPeriodChange, loading, seriesLoading, error }) => {
  const summary = revenue?.summary || {};
  const filters = revenue?.filters || {};
  const active = REVENUE_PERIODS.find((option) => option.value === period) || REVENUE_PERIODS[2];
  const bucket = active.bucket;
  const points = useMemo(() => {
    const rows = Array.isArray(series?.series) ? series.series : [];
    return rows.map((row) => ({ label: axisLabel(row.period, bucket), value: Number(row.totalRevenue) || 0 }));
  }, [series, bucket]);
  const peakIndex = useMemo(() => {
    if (points.length === 0) return -1;
    let best = 0;
    points.forEach((point, index) => {
      if (point.value > points[best].value) best = index;
    });
    return best;
  }, [points]);
  const isFlat = points.length > 1 && points.every((point) => point.value === 0);
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold leading-tight text-ink", children: "Platform revenue" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "Aggregated across every school" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-1", role: "group", "aria-label": "Revenue period", children: REVENUE_PERIODS.map((option) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => onPeriodChange(option.value),
          "aria-pressed": period === option.value,
          className: `rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${period === option.value ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`,
          children: option.label
        },
        option.value
      )) })
    ] }),
    error ? /* @__PURE__ */ jsx("p", { className: "mt-6 text-[13px] font-semibold text-red-600", children: error.message || "Platform revenue could not be loaded." }) : loading ? /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-3", children: [
      /* @__PURE__ */ jsx("div", { className: "h-9 w-56 animate-pulse rounded-lg bg-slate-200/70" }),
      /* @__PURE__ */ jsx("div", { className: "h-4 w-40 animate-pulse rounded bg-slate-200/70" })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("p", { className: "mt-5 text-[28px] font-extrabold leading-none tracking-tight text-ink", children: formatCedi(summary.totalRevenue) }),
      /* @__PURE__ */ jsxs("dl", { className: "mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-semibold text-slate-500", children: "Payments" }),
          /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-ink", children: formatCount(summary.totalPayments) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-semibold text-slate-500", children: "Average payment" }),
          /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-ink", children: formatCedi(summary.avgPayment) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-semibold text-slate-500", children: "Markup earned" }),
          /* @__PURE__ */ jsx("dd", { className: "text-[13px] font-extrabold text-brand-700", children: formatCedi(summary.platformMarkupRevenue) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-auto border-t border-slate-100 pt-4", children: seriesLoading && points.length === 0 ? /* @__PURE__ */ jsx("div", { className: "h-[180px] animate-pulse rounded-xl bg-slate-200/50" }) : isFlat ? /* @__PURE__ */ jsxs("p", { className: "flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-slate-400", children: [
        /* @__PURE__ */ jsx(Info, { className: "mt-px h-3.5 w-3.5 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs("span", { children: [
          "No completed payments in this ",
          bucket === "day" ? "window" : "period",
          ". The figures above are the same totals, not a missing reading."
        ] })
      ] }) : points.length > 1 ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: [
            "Collected per ",
            bucket === "day" ? "day" : "month"
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: formatCediShort(series?.totals?.totalRevenue) })
        ] }),
        /* @__PURE__ */ jsx(
          AreaChart,
          {
            series: points,
            formatValue: (value) => formatCedi(value),
            formatAxis: (value) => formatCediShort(value),
            peakIndex
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-[10px] font-semibold text-slate-400", children: "A month or day with no completed payment is shown as zero, not omitted." })
      ] }) : null }),
      filters.period ? /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[10px] font-semibold text-slate-400", children: [
        "Server applied period ",
        /* @__PURE__ */ jsx("code", { className: "font-mono", children: filters.period }),
        ", bucket",
        " ",
        /* @__PURE__ */ jsx("code", { className: "font-mono", children: bucket }),
        "."
      ] }) : null
    ] })
  ] });
};
const STATUS_TONES$3 = {
  active: "green",
  suspended: "red",
  archived: "slate",
  trial: "amber"
};
const RecentSchoolsCard = ({ schools = [], loading, error }) => {
  const rows = Array.isArray(schools) ? schools : [];
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold leading-tight text-ink", children: "Newest schools" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "The five most recently created accounts" })
      ] }),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: ROUTES.ADMIN_SCHOOLS,
          className: "inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: [
            "All schools",
            /* @__PURE__ */ jsx(ArrowUpRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
          ]
        }
      )
    ] }),
    error ? /* @__PURE__ */ jsx("p", { className: "mt-6 text-[13px] font-semibold text-red-600", children: error.message || "The newest schools could not be loaded." }) : loading ? /* @__PURE__ */ jsx("div", { className: "mt-5 space-y-3", children: [0, 1, 2].map((row) => /* @__PURE__ */ jsx("div", { className: "h-10 animate-pulse rounded-lg bg-slate-200/70" }, row)) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Building2,
        title: "No schools yet",
        description: "Schools appear here as soon as an administrator finishes signing up."
      }
    ) }) : /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("div", { className: "mt-4 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[30rem] border-collapse text-left", children: [
      /* @__PURE__ */ jsx("caption", { className: "sr-only", children: "The five most recently created schools" }),
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100", children: [
        /* @__PURE__ */ jsx("th", { scope: "col", className: "pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "School" }),
        /* @__PURE__ */ jsx("th", { scope: "col", className: "pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Code" }),
        /* @__PURE__ */ jsx("th", { scope: "col", className: "pb-2 pr-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Plan" }),
        /* @__PURE__ */ jsx("th", { scope: "col", className: "pb-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Status" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: rows.map((school) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-50 last:border-0", children: [
        /* @__PURE__ */ jsx("td", { className: "py-2.5 pr-3 text-[13px] font-extrabold text-ink", children: /* @__PURE__ */ jsx("span", { className: "block max-w-[16rem] truncate", children: school.name }) }),
        /* @__PURE__ */ jsx("td", { className: "py-2.5 pr-3 font-mono text-[11px] font-bold text-slate-500", children: school.schoolCode || "—" }),
        /* @__PURE__ */ jsx("td", { className: "py-2.5 pr-3 text-[11px] font-bold capitalize text-slate-600", children: school.subscription?.plan || "—" }),
        /* @__PURE__ */ jsx("td", { className: "py-2.5", children: /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES$3[school.status] || "slate", dot: true, children: school.status || "unknown" }) })
      ] }, school._id)) })
    ] }) }) })
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
const PlatformCompositionCard = ({ kpis }) => {
  const schools = kpis?.schools || {};
  const users = kpis?.users || {};
  const totalSchools = Number(schools.total) || 0;
  const totalUsers = Number(users.total) || 0;
  const segments = [
    { key: "active", label: "Active", value: schools.active, className: "bg-brand-600" },
    { key: "onTrial", label: "On trial", value: schools.onTrial, className: "bg-amber-400" },
    { key: "suspended", label: "Suspended", value: schools.suspended, className: "bg-red-500" },
    { key: "archived", label: "Archived", value: schools.archived, className: "bg-slate-300" }
  ];
  const staffShare = totalUsers ? (Number(users.staff) || 0) / totalUsers * 100 : 0;
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold leading-tight text-ink", children: "What the platform is made of" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: [
          formatCount(totalSchools),
          " schools · ",
          formatCount(totalUsers),
          " accounts"
        ] })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500", children: /* @__PURE__ */ jsx(Building2, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) })
    ] }),
    totalSchools === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-6 text-[13px] font-semibold text-slate-500", children: "No schools have registered yet. The first one to finish provisioning appears here." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "mt-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-slate-500", children: "Schools by status" }),
          /* @__PURE__ */ jsx("span", { className: "text-[11px] font-extrabold text-ink", children: formatCount(totalSchools) })
        ] }),
        /* @__PURE__ */ jsx(StackedBar, { segments, className: "mt-2" })
      ] }),
      /* @__PURE__ */ jsx("dl", { className: "mt-4 grid grid-cols-2 gap-x-4 gap-y-2", children: segments.map((segment) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxs("dt", { className: "flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-500", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              "aria-hidden": "true",
              className: `h-2 w-2 shrink-0 rounded-full ${segment.className}`
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "truncate", children: segment.label })
        ] }),
        /* @__PURE__ */ jsxs("dd", { className: "shrink-0 text-[11px] font-extrabold text-ink", children: [
          formatCount(segment.value),
          totalSchools > 0 && /* @__PURE__ */ jsx("span", { className: "ml-1 font-semibold text-slate-400", children: formatPercent((Number(segment.value) || 0) / totalSchools * 100) })
        ] })
      ] }, segment.key)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-auto border-t border-slate-100 pt-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500", children: [
          /* @__PURE__ */ jsx(Users, { className: "h-3.5 w-3.5 text-slate-400", "aria-hidden": "true" }),
          "Staff of all accounts"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-extrabold text-ink", children: [
          formatCount(users.staff),
          /* @__PURE__ */ jsx("span", { className: "ml-1 font-semibold text-slate-400", children: totalUsers ? formatPercent(staffShare) : "" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(ProgressBar, { value: staffShare, label: "Staff as a share of all platform accounts", className: "mt-2" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-semibold text-slate-400", children: [
        formatCount(users.students),
        " parents hold the remaining accounts."
      ] })
    ] })
  ] });
};
const SmsBalanceCard = ({ kpis }) => {
  const balance = kpis?.sms?.totalBalance;
  return /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "flex flex-col", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold leading-tight text-ink", children: "SMS credit" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "Master balance, all schools combined" })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500", children: /* @__PURE__ */ jsx(MessageSquare, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-5 text-[28px] font-extrabold leading-none tracking-tight text-ink", children: formatCount(balance) }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-[11px] font-semibold text-slate-500", children: "messages remaining platform-wide" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-auto pt-4 text-[11px] font-semibold leading-relaxed text-slate-400", children: [
      /* @__PURE__ */ jsx(UserCog, { className: "mr-1 inline h-3.5 w-3.5 align-text-bottom", "aria-hidden": "true" }),
      "When this reaches zero, every school’s reminders stop at once."
    ] })
  ] });
};
const SUBSCRIPTION_PLANS = ["trial", "basic", "standard", "premium", "enterprise"];
const SCHOOL_STATUSES = ["active", "suspended", "archived"];
const AD_PLACEMENTS = ["auth_aside", "home_hero", "dashboard_sidebar"];
const AD_STATUSES = ["draft", "pending", "approved", "rejected", "expired"];
const toPageMeta = (page, perPage, total, pages) => {
  const size = Number(perPage) || 20;
  const count = Number(total) || 0;
  return {
    page: Number(page) || 1,
    perPage: size,
    total: count,
    totalPages: Number(pages) || Math.max(1, Math.ceil(count / size))
  };
};
const getDashboardKpis = async () => {
  try {
    const { data } = await api.get("/admin/dashboard");
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "The platform figures could not be loaded.");
  }
};
const listSchools = async ({
  page = 1,
  perPage = 20,
  status = "",
  region = "",
  plan = "",
  search = "",
  sortBy = "createdAt",
  sortOrder = "desc"
} = {}) => {
  try {
    const { data } = await api.get("/admin/schools", {
      params: { page, perPage, status: status || void 0, region: region || void 0, plan: plan || void 0, search: search || void 0, sortBy, sortOrder }
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages)
    };
  } catch (error) {
    throw toApiError(error, "The schools list could not be loaded.");
  }
};
const getSchoolUsage = async (schoolId) => {
  if (!schoolId) throw new Error("A school id is required.");
  try {
    const { data } = await api.get(`/admin/schools/${schoolId}/usage`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "This school’s usage could not be loaded.");
  }
};
const suspendSchool = async (schoolId, reason) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/suspend`, { reason });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "This school could not be suspended.");
  }
};
const unsuspendSchool = async (schoolId) => {
  try {
    const { data } = await api.put(`/admin/schools/${schoolId}/unsuspend`);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "This school could not be unsuspended.");
  }
};
const getRevenue = async ({ period = "all", startDate, endDate, plan = "", region = "" } = {}) => {
  try {
    const { data } = await api.get("/admin/revenue", {
      params: {
        period,
        startDate: startDate || void 0,
        endDate: endDate || void 0,
        plan: plan || void 0,
        region: region || void 0
      }
    });
    return data.data || { summary: {}, filters: {} };
  } catch (error) {
    throw toApiError(error, "Platform revenue could not be loaded.");
  }
};
const getPlatformSmsBalance = async () => {
  try {
    const { data } = await api.get("/admin/sms-balance");
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "The platform SMS balance could not be loaded.");
  }
};
const listPlatformUsers = async ({ page = 1, perPage = 50, role = "", status = "", schoolId = "" } = {}) => {
  try {
    const { data } = await api.get("/users", {
      params: {
        page,
        limit: perPage,
        role: role || void 0,
        status: status || void 0,
        // Sent as an empty string rather than omitted: `super_admin` reading
        // `schoolId=''` still resolves to `req.user.schoolId` (null), so the
        // behaviour is identical — but sending it makes the scope visible in the
        // network tab instead of implied by its absence.
        schoolId: schoolId || void 0
      }
    });
    const pagination = data?.pagination || {};
    return {
      rows: Array.isArray(data?.users) ? data.users : [],
      meta: toPageMeta(pagination.page, pagination.limit, pagination.total, pagination.pages)
    };
  } catch (error) {
    throw toApiError(error, "The user list could not be loaded.");
  }
};
const listSchoolAds = async ({ page = 1, perPage = 20, status = "", placement = "" } = {}) => {
  try {
    const { data } = await api.get("/admin/school-ads", {
      params: {
        page,
        perPage,
        status: status || void 0,
        placement: placement || void 0
      }
    });
    return {
      rows: Array.isArray(data?.data) ? data.data : [],
      meta: toPageMeta(data?.meta?.page, data?.meta?.perPage, data?.meta?.total, data?.meta?.pages)
    };
  } catch (error) {
    throw toApiError(error, "The content queue could not be loaded.");
  }
};
const reviewSchoolAd = async (adId, { status, rejectedReason = "" } = {}) => {
  try {
    const { data } = await api.put(`/admin/school-ads/${adId}/approve`, { status, rejectedReason });
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "This creative could not be reviewed.");
  }
};
const getRevenueSeries = async ({
  bucket = "month",
  period = "ytd",
  startDate,
  endDate,
  plan = "",
  region = ""
} = {}) => {
  try {
    const { data } = await api.get("/admin/revenue/series", {
      params: {
        bucket,
        period,
        startDate: startDate || void 0,
        endDate: endDate || void 0,
        plan: plan || void 0,
        region: region || void 0
      }
    });
    return data.data || { series: [], filters: {}, totals: {} };
  } catch (error) {
    throw toApiError(error, "The revenue trend could not be loaded.");
  }
};
const getPlatformSettings = async () => {
  try {
    const { data } = await api.get("/admin/settings");
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Platform settings could not be loaded.");
  }
};
const updatePlatformSettings = async (patch) => {
  try {
    const { data } = await api.put("/admin/settings", patch);
    return data.data || {};
  } catch (error) {
    throw toApiError(error, "Platform settings could not be saved.");
  }
};
const bucketForPeriod = (period) => period === "mtd" || period === "last30" ? "day" : "month";
const useAdminDashboard = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get("period") || "ytd";
  const [kpis, setKpis] = useState({ data: null, loading: true, error: null });
  const [revenue, setRevenue] = useState({ data: null, loading: true, error: null });
  const [series, setSeries] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setKpis((current) => ({ ...current, loading: true, error: null }));
    getDashboardKpis().then((data) => active && setKpis({ data, loading: false, error: null })).catch((error) => active && setKpis({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);
  useEffect(() => {
    let active = true;
    setRevenue({ data: null, loading: true, error: null });
    getRevenue({ period }).then((data) => active && setRevenue({ data, loading: false, error: null })).catch((error) => active && setRevenue({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [period, reloadKey]);
  useEffect(() => {
    let active = true;
    setSeries({ data: null, loading: true, error: null });
    getRevenueSeries({ period, bucket: bucketForPeriod(period) }).then((data) => active && setSeries({ data, loading: false, error: null })).catch((error) => active && setSeries({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [period, reloadKey]);
  const setPeriod = useCallback(
    (next) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!next || next === "ytd") params.delete("period");
          else params.set("period", next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  return useMemo(
    () => ({ kpis, revenue, series, period, setPeriod }),
    [kpis, revenue, series, period, setPeriod]
  );
};
const EMPTY_ADMIN_KPIS = {
  schools: {
    total: 0,
    active: 0,
    suspended: 0,
    archived: 0,
    onTrial: 0,
    paid: 0
  },
  users: {
    total: 0,
    students: 0,
    staff: 0
  },
  payments: {
    totalCompleted: 0,
    totalRevenue: 0,
    mtdRevenue: 0,
    mtdCount: 0,
    ytdRevenue: 0,
    ytdCount: 0,
    platformMarkup: 0,
    pendingPayouts: 0
  },
  sms: {
    totalBalance: 0
  },
  recentSchools: []
};
const AdminOverview = () => {
  const { kpis, revenue, series, period, setPeriod } = useAdminDashboard();
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const failed = Boolean(kpis.error);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Platform console",
        title: "Overview",
        description: "Every school on SukuuPay, and what the platform is earning. Figures refresh when you reload.",
        actions: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: refresh,
            disabled: kpis.loading,
            className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
            children: [
              /* @__PURE__ */ jsx(
                RotateCcw,
                {
                  className: `h-4 w-4 ${kpis.loading ? "animate-spin" : ""}`,
                  "aria-hidden": "true"
                }
              ),
              "Refresh"
            ]
          }
        )
      }
    ),
    failed ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: RotateCcw,
        title: "The platform figures could not be loaded",
        description: kpis.error?.message || "The request did not complete. Nothing below is shown rather than shown as zero.",
        action: /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: refresh,
            className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
            children: [
              /* @__PURE__ */ jsx(RotateCcw, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Try again"
            ]
          }
        )
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      kpis.loading ? /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6", children: [0, 1, 2, 3, 4, 5].map((tile) => /* @__PURE__ */ jsx("div", { className: "h-[9.5rem] animate-pulse rounded-2xl bg-slate-200/70" }, tile)) }) : /* @__PURE__ */ jsx(KpiRow, { kpis: kpis.data || EMPTY_ADMIN_KPIS }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [
        /* @__PURE__ */ jsx("div", { className: "lg:col-span-2", children: /* @__PURE__ */ jsx(
          RevenueCard,
          {
            revenue: revenue.data,
            series: series.data,
            period,
            onPeriodChange: setPeriod,
            loading: revenue.loading,
            seriesLoading: series.loading,
            error: revenue.error
          }
        ) }),
        /* @__PURE__ */ jsx(PlatformCompositionCard, { kpis: kpis.data || EMPTY_ADMIN_KPIS })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3", children: [
        /* @__PURE__ */ jsx("div", { className: "lg:col-span-2", children: /* @__PURE__ */ jsx(
          RecentSchoolsCard,
          {
            schools: kpis.data?.recentSchools,
            loading: kpis.loading,
            error: kpis.error
          }
        ) }),
        /* @__PURE__ */ jsx(SmsBalanceCard, { kpis: kpis.data || EMPTY_ADMIN_KPIS })
      ] })
    ] })
  ] });
};
const PER_PAGE_OPTIONS = [8, 20, 50, 100];
const pageWindow = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window2 = /* @__PURE__ */ new Set([1, totalPages, page, page - 1, page + 1]);
  const pages = [...window2].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return pages;
};
const Pagination = ({ meta = {}, onPageChange, onPerPageChange, itemLabel = "students" }) => {
  const { page = 1, perPage = 20, total = 0, totalPages = 0 } = meta;
  if (!total) return null;
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const pages = pageWindow(page, totalPages);
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
const SchoolUsageDrawer = ({ school, onClose, onSuspend, onUnsuspend }) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!school) return void 0;
    let active = true;
    setState({ data: null, loading: true, error: null });
    getSchoolUsage(school._id).then((data) => active && setState({ data, loading: false, error: null })).catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [school]);
  useEffect(() => {
    if (!school) return void 0;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [school, onClose]);
  if (!school) return null;
  const usage = state.data || {};
  const counts = usage.counts || {};
  const payments = usage.payments || {};
  const breakdown = payments.statusBreakdown || {};
  const statusTone = { active: "green", suspended: "red", archived: "slate" };
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 flex justify-end", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "aria-label": "Close school details",
        onClick: onClose,
        className: "absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      }
    ),
    /* @__PURE__ */ jsxs(
      "aside",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": `${school.name} details`,
        className: "relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("h2", { className: "truncate text-[15px] font-extrabold text-ink", children: school.name }),
              /* @__PURE__ */ jsxs("p", { className: "font-mono text-[11px] font-bold text-slate-400", children: [
                school.schoolCode || "—",
                school.city ? ` · ${school.city}` : ""
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: onClose,
                "aria-label": "Close",
                className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink",
                children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex-1 px-5 py-4", children: state.error ? /* @__PURE__ */ jsx("p", { className: "text-[13px] font-semibold text-red-600", children: state.error.message }) : state.loading ? /* @__PURE__ */ jsx("div", { className: "space-y-3", children: [0, 1, 2, 3].map((row) => /* @__PURE__ */ jsx("div", { className: "h-12 animate-pulse rounded-xl bg-slate-200/70" }, row)) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
              /* @__PURE__ */ jsx(Badge, { tone: statusTone[school.status] || "slate", dot: true, children: school.status || "unknown" }),
              /* @__PURE__ */ jsx(Badge, { tone: "slate", children: school.subscription?.plan || "no plan" })
            ] }),
            /* @__PURE__ */ jsx("dl", { className: "mt-4 grid grid-cols-3 gap-3", children: [
              { label: "Students", value: formatCount(counts.students) },
              { label: "Staff", value: formatCount(counts.staff) },
              { label: "Parents", value: formatCount(counts.parents) }
            ].map((stat) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-slate-50 px-3 py-2.5", children: [
              /* @__PURE__ */ jsx("dt", { className: "text-[10px] font-extrabold uppercase tracking-wider text-slate-400", children: stat.label }),
              /* @__PURE__ */ jsx("dd", { className: "mt-0.5 text-[15px] font-extrabold text-ink", children: stat.value })
            ] }, stat.label)) }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Payments collected" }),
              /* @__PURE__ */ jsx("p", { className: "mt-1 text-[20px] font-extrabold leading-none text-ink", children: formatCedi(payments.totalRevenue) }),
              /* @__PURE__ */ jsx(
                StackedBar,
                {
                  className: "mt-3",
                  segments: [
                    {
                      key: "completed",
                      label: "Completed",
                      value: breakdown.completed?.amount,
                      className: "bg-brand-600"
                    },
                    {
                      key: "pending",
                      label: "Pending",
                      value: breakdown.pending?.amount,
                      className: "bg-amber-400"
                    },
                    {
                      key: "failed",
                      label: "Failed",
                      value: breakdown.failed?.amount,
                      className: "bg-red-500"
                    }
                  ]
                }
              ),
              /* @__PURE__ */ jsx("dl", { className: "mt-3 space-y-1.5", children: [
                ["Completed", breakdown.completed, "text-brand-700"],
                ["Pending", breakdown.pending, "text-amber-600"],
                ["Failed", breakdown.failed, "text-red-600"]
              ].map(([label, entry, tone]) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
                /* @__PURE__ */ jsx("dt", { className: "text-[11px] font-semibold text-slate-500", children: label }),
                /* @__PURE__ */ jsxs("dd", { className: "text-[12px] font-extrabold", children: [
                  /* @__PURE__ */ jsx("span", { className: `tabular-nums ${tone}`, children: formatCedi(entry?.amount) }),
                  /* @__PURE__ */ jsxs("span", { className: "ml-2 text-[11px] font-semibold text-slate-400", children: [
                    formatCount(entry?.count),
                    " payments"
                  ] })
                ] })
              ] }, label)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 border-t border-slate-100 pt-4", children: [
              /* @__PURE__ */ jsx("h3", { className: "text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "School" }),
              /* @__PURE__ */ jsx("dl", { className: "mt-2 space-y-2", children: [
                { icon: Phone, label: "Phone", value: school.phone },
                { icon: Users, label: "Region", value: school.region },
                {
                  icon: MessageSquare,
                  label: "SMS balance",
                  value: formatCount(usage.school?.sms?.balance)
                },
                {
                  icon: CalendarClock,
                  label: "Plan renews",
                  value: usage.school?.subscription?.currentPeriodEnd ? new Date(usage.school.subscription.currentPeriodEnd).toLocaleDateString("en-GB") : "—"
                }
              ].map(({ icon: Icon, label, value }) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-[12px]", children: [
                /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5 shrink-0 text-slate-400", "aria-hidden": "true" }),
                /* @__PURE__ */ jsx("dt", { className: "text-slate-500", children: label }),
                /* @__PURE__ */ jsx("dd", { className: "min-w-0 truncate font-bold text-ink", children: value || "—" })
              ] }, label)) })
            ] })
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-4", children: [
            school.status === "suspended" ? /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onUnsuspend(school),
                className: "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-ink transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                children: [
                  /* @__PURE__ */ jsx(ShieldCheck, { className: "h-4 w-4 text-brand-700", "aria-hidden": "true" }),
                  "Restore this school"
                ]
              }
            ) : /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => onSuspend(school),
                className: "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                children: [
                  /* @__PURE__ */ jsx(ShieldAlert, { className: "h-4 w-4", "aria-hidden": "true" }),
                  "Suspend this school"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Link,
              {
                to: `/admin/schools`,
                onClick: onClose,
                className: "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:text-brand-700",
                children: [
                  "All schools",
                  /* @__PURE__ */ jsx(ArrowUpRight, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
                ]
              }
            )
          ] })
        ]
      }
    )
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
const REASON_MIN = 10;
const REASON_MAX = 500;
const SuspendSchoolDialog = ({ school, counts, open, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < REASON_MIN;
  const tooLong = trimmed.length > REASON_MAX;
  const submit = async () => {
    if (trimmed.length < REASON_MIN) {
      setError(`Write at least ${REASON_MIN} characters — this is what the school is told.`);
      return;
    }
    if (tooLong) {
      setError(`Keep it under ${REASON_MAX} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onConfirm(school, trimmed);
    setBusy(false);
    if (result?.ok) {
      setReason("");
      setError(null);
      return;
    }
    setError(result?.error || "This school could not be suspended.");
  };
  if (!school) return null;
  const affected = Number(counts?.staff) || 0;
  const students = Number(counts?.students) || 0;
  return /* @__PURE__ */ jsxs(
    Modal,
    {
      open,
      onClose,
      title: `Suspend ${school.name}?`,
      description: "Nobody in this school will be able to sign in until it is restored.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: onClose,
            disabled: busy,
            className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: submit,
            disabled: busy || trimmed.length < REASON_MIN,
            className: "inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40",
            children: [
              /* @__PURE__ */ jsx(ShieldAlert, { className: "h-4 w-4", "aria-hidden": "true" }),
              busy ? "Suspending…" : `Suspend ${school.name}`
            ]
          }
        )
      ] }),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-red-200 bg-red-50 px-3.5 py-3", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[13px] font-extrabold text-red-800", children: [
            "This signs out ",
            formatCount(affected),
            " staff account",
            affected === 1 ? "" : "s",
            " immediately"
          ] }),
          /* @__PURE__ */ jsxs("ul", { className: "mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed text-red-700", children: [
            /* @__PURE__ */ jsxs("li", { children: [
              "Every account in ",
              school.name,
              " is set to suspended — not just the school’s record. They cannot sign in until it is restored."
            ] }),
            /* @__PURE__ */ jsxs("li", { children: [
              formatCount(students),
              " student records and this school’s payment history stay exactly where they are. Nothing is deleted."
            ] }),
            /* @__PURE__ */ jsx("li", { children: "SMS reminders stop for this school. Parents stop being told what is owed." })
          ] })
        ] }),
        error && /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: error }) }),
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Reason",
            required: true,
            className: "mt-3",
            value: reason,
            maxLength: REASON_MAX,
            onChange: (event) => setReason(event.target.value),
            placeholder: "What is the school being told?",
            hint: `${trimmed.length}/${REASON_MAX}`,
            error: tooShort ? `${REASON_MIN - trimmed.length} more character${REASON_MIN - trimmed.length === 1 ? "" : "s"}` : tooLong ? "Too long" : null
          }
        ),
        /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] font-semibold leading-relaxed text-slate-400", children: [
          "Required by the API at ",
          REASON_MIN,
          "–",
          REASON_MAX,
          " characters, and recorded in the activity log alongside your name."
        ] })
      ]
    }
  );
};
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
const STATUS_TONES$2 = { active: "green", suspended: "red", archived: "slate" };
const STATUS_LABELS = { active: "Active", suspended: "Suspended", archived: "Archived" };
const AdminSchools = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [drilldown, setDrilldown] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const filters = useMemo(
    () => ({
      status: searchParams.get("status") || "",
      region: searchParams.get("region") || "",
      plan: searchParams.get("plan") || "",
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
    listSchools(filters).then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })).catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== "page") params.delete("page");
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const hasFilters = Boolean(filters.status || filters.region || filters.plan);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const confirmSuspend = useCallback(async (school, reason) => {
    try {
      await suspendSchool(school._id, reason);
      toast.success(
        `${school.name} is suspended. Every account in the school has been signed out.`
      );
      setSuspendTarget(null);
      setDrilldown(null);
      refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || "This school could not be suspended." };
    }
  }, [refresh, toast]);
  const confirmUnsuspend = useCallback(
    async (school) => {
      try {
        await unsuspendSchool(school._id);
        toast.success(`${school.name} and its staff can sign in again.`);
        setDrilldown(null);
        refresh();
      } catch (error) {
        toast.error(error.message || "This school could not be restored.");
      }
    },
    [refresh, toast]
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.rows;
    return state.rows.filter(
      (school) => [school.name, school.schoolCode, school.city, school.email].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [state.rows, search]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Platform console",
        title: "Schools",
        description: "Every school registered on SukuuPay, with its size and the volume it has moved."
      }
    ),
    /* @__PURE__ */ jsxs(Card, { padding: "p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", children: [
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Search this page",
            icon: Search,
            value: search,
            onChange: (event) => setSearch(event.target.value),
            placeholder: "Name, code, city or email"
          }
        ),
        /* @__PURE__ */ jsxs(
          SelectField,
          {
            label: "Status",
            value: filters.status,
            onChange: (event) => setFilter("status", event.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All statuses" }),
              SCHOOL_STATUSES.map((status) => /* @__PURE__ */ jsx("option", { value: status, children: STATUS_LABELS[status] || status }, status))
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          SelectField,
          {
            label: "Region",
            value: filters.region,
            onChange: (event) => setFilter("region", event.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All regions" }),
              GHANA_REGIONS.map((region) => /* @__PURE__ */ jsx("option", { value: region, children: region }, region))
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          SelectField,
          {
            label: "Plan",
            value: filters.plan,
            onChange: (event) => setFilter("plan", event.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All plans" }),
              SUBSCRIPTION_PLANS.map((plan) => /* @__PURE__ */ jsx("option", { value: plan, children: plan }, plan))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] font-semibold text-slate-400", children: [
        "Status, region and plan filter the whole platform. The search box filters the",
        " ",
        state.meta?.total ? formatCount(state.meta.total) : "",
        " schools on this page only."
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4", children: state.error ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Building2,
        title: "The schools list could not be loaded",
        description: state.error.message,
        action: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setReloadKey((key) => key + 1),
            className: "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
            children: "Try again"
          }
        )
      }
    ) : state.loading && state.rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "space-y-2", children: [0, 1, 2, 3, 4].map((row) => /* @__PURE__ */ jsx("div", { className: "h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" }, row)) }) : visible.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Building2,
        title: hasFilters || search ? "No schools match these filters" : "No schools on the platform yet",
        description: hasFilters || search ? "Try clearing the search box or a filter." : "A school appears here once an administrator completes registration."
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Card, { padding: "p-0", className: "overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[52rem] border-collapse text-left", children: [
        /* @__PURE__ */ jsx("caption", { className: "sr-only", children: "Schools registered on the platform" }),
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 bg-slate-50/60", children: [
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "School" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Region" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Students" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Staff" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Volume" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Status" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: visible.map((school) => /* @__PURE__ */ jsxs(
          "tr",
          {
            onClick: () => setDrilldown(school),
            className: "cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60",
            children: [
              /* @__PURE__ */ jsxs("td", { className: "px-5 py-3.5", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: (event) => {
                      event.stopPropagation();
                      setDrilldown(school);
                    },
                    className: "block text-left text-[13px] font-extrabold text-ink underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                    children: school.name
                  }
                ),
                /* @__PURE__ */ jsxs("span", { className: "block font-mono text-[11px] font-bold text-slate-400", children: [
                  school.schoolCode || "—",
                  school.city ? ` · ${school.city}` : ""
                ] })
              ] }),
              /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5 text-[13px] font-semibold text-slate-600", children: school.region || "—" }),
              /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600", children: formatCount(school.studentCount) }),
              /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600", children: formatCount(school.staffCount) }),
              /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink", children: formatCediShort(school.paymentVolume) }),
              /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES$2[school.status] || "slate", dot: true, children: STATUS_LABELS[school.status] || school.status || "unknown" }) })
            ]
          },
          school._id
        )) })
      ] }) }) }),
      /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
        Pagination,
        {
          meta: state.meta,
          itemLabel: "schools",
          onPageChange: (page) => setFilter("page", String(page)),
          onPerPageChange: (perPage) => {
            setFilter("perPage", String(perPage));
            setFilter("page", "1");
          }
        }
      ) })
    ] }) }),
    /* @__PURE__ */ jsx(
      SchoolUsageDrawer,
      {
        school: drilldown,
        onClose: () => setDrilldown(null),
        onSuspend: (school) => setSuspendTarget(school),
        onUnsuspend: confirmUnsuspend
      }
    ),
    /* @__PURE__ */ jsx(
      SuspendSchoolDialog,
      {
        open: Boolean(suspendTarget),
        school: suspendTarget,
        counts: suspendTarget ? {
          staff: state.rows.find((row) => row._id === suspendTarget._id)?.staffCount,
          students: state.rows.find((row) => row._id === suspendTarget._id)?.studentCount
        } : null,
        onClose: () => setSuspendTarget(null),
        onConfirm: confirmSuspend
      }
    )
  ] });
};
const ASSIGNABLE_ROLES = USER_ROLES.filter((role) => role !== "super_admin");
const ROLE_TONES = {
  super_admin: "ink",
  school_admin: "brand",
  accountant: "blue",
  teacher: "slate",
  viewer: "slate"
};
const STATUS_TONES$1 = { active: "green", suspended: "red", invited: "amber", deactivated: "slate" };
const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [roleTarget, setRoleTarget] = useState(null);
  const [nextRole, setNextRole] = useState("teacher");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const filters = useMemo(
    () => ({
      role: searchParams.get("role") || "",
      status: searchParams.get("status") || "",
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 50
    }),
    [searchParams]
  );
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listPlatformUsers(filters).then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })).catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== "page") params.delete("page");
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return state.rows;
    return state.rows.filter(
      (user) => [user.name, user.email, user.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }, [state.rows, search]);
  const hasFilters = Boolean(filters.role || filters.status);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const isOwner = (account) => account?.isPlatformOwner === true;
  const openRoleChange = (account) => {
    setRoleTarget(account);
    setNextRole(ASSIGNABLE_ROLES.includes(account.role) ? account.role : "teacher");
    setFormError(null);
  };
  const submitRoleChange = async () => {
    if (!roleTarget || nextRole === roleTarget.role) {
      setRoleTarget(null);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await updateUserRole(roleTarget._id, nextRole);
      setRoleTarget(null);
      refresh();
      toast.success(
        `${roleTarget.name} is now ${roleLabel(nextRole).toLowerCase()} (was ${roleLabel(
          roleTarget.role
        ).toLowerCase()}).`
      );
    } catch (error) {
      setFormError(error.message || "That role could not be assigned.");
    } finally {
      setBusy(false);
    }
  };
  const submitRemove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    setFormError(null);
    try {
      await removeUser(removeTarget._id);
      setRemoveTarget(null);
      refresh();
      toast.warning(
        `${removeTarget.name}’s access was removed and their sessions were signed out. This cannot be undone from here.`
      );
    } catch (error) {
      setFormError(error.message || "That account could not be removed.");
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Platform console",
        title: "Users",
        description: "Every account registered on SukuuPay — school staff, parents and platform staff."
      }
    ),
    /* @__PURE__ */ jsxs(Card, { padding: "p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [
        /* @__PURE__ */ jsx(
          Field,
          {
            label: "Search this page",
            icon: Search,
            value: search,
            onChange: (event) => setSearch(event.target.value),
            placeholder: "Name, email or phone"
          }
        ),
        /* @__PURE__ */ jsxs(
          SelectField,
          {
            label: "Role",
            value: filters.role,
            onChange: (event) => setFilter("role", event.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All roles" }),
              USER_ROLES.map((role) => /* @__PURE__ */ jsx("option", { value: role, children: roleLabel(role) }, role))
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          SelectField,
          {
            label: "Status",
            value: filters.status,
            onChange: (event) => setFilter("status", event.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All statuses" }),
              ["active", "invited", "suspended", "deactivated"].map((status) => /* @__PURE__ */ jsx("option", { value: status, children: status }, status))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-3 text-[11px] font-semibold text-slate-400", children: [
        "Scope: all schools on the platform. Role and status filter every school; the search box filters the ",
        state.meta?.total ? formatCount(state.meta.total) : "",
        " accounts on this page."
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4", children: state.error ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Users,
        title: "The user list could not be loaded",
        description: state.error.message,
        action: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => setReloadKey((key) => key + 1),
            className: "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
            children: "Try again"
          }
        )
      }
    ) : state.loading && state.rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "space-y-2", children: [0, 1, 2, 3, 4].map((row) => /* @__PURE__ */ jsx("div", { className: "h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" }, row)) }) : visible.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Users,
        title: hasFilters || search ? "No accounts match these filters" : "No accounts yet",
        description: hasFilters || search ? "Try clearing the search box or a filter." : "Accounts appear here as soon as somebody registers."
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Card, { padding: "p-0", className: "overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[52rem] border-collapse text-left", children: [
        /* @__PURE__ */ jsx("caption", { className: "sr-only", children: "Every account registered on the platform" }),
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-100 bg-slate-50/60", children: [
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Person" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Phone" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Role" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Status" }),
          /* @__PURE__ */ jsx("th", { scope: "col", className: "px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: visible.map((account) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-slate-50 last:border-0 hover:bg-slate-50/60", children: [
          /* @__PURE__ */ jsxs("td", { className: "px-5 py-3.5", children: [
            /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: account.name }),
            /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-400", children: account.email || "—" })
          ] }),
          /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5 font-mono text-[12px] font-bold text-slate-600", children: account.phone || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: /* @__PURE__ */ jsxs("span", { className: "flex flex-wrap items-center gap-1.5", children: [
            /* @__PURE__ */ jsx(Badge, { tone: ROLE_TONES[account.role] || "slate", children: roleLabel(account.role) }),
            isOwner(account) && /* @__PURE__ */ jsx(Badge, { tone: "ink", icon: ShieldCheck, children: "Platform owner" })
          ] }) }),
          /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES$1[account.status] || "slate", dot: true, children: account.status || "unknown" }) }),
          /* @__PURE__ */ jsx("td", { className: "px-5 py-3.5", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1", children: [
            "` immediately inside the opening parenthesis opens an expression container, so the element after it lands outside any JSX container and the file will not parse. */}",
            isOwner(account) ? /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-400", children: "Managed by the server environment" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => openRoleChange(account),
                  className: "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                  children: [
                    /* @__PURE__ */ jsx(UserCog, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                    "Role"
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setRemoveTarget(account);
                    setFormError(null);
                  },
                  className: "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                  children: [
                    /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                    "Remove"
                  ]
                }
              )
            ] })
          ] }) })
        ] }, account._id)) })
      ] }) }) }),
      /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
        Pagination,
        {
          meta: state.meta,
          itemLabel: "accounts",
          onPageChange: (page) => setFilter("page", String(page)),
          onPerPageChange: (perPage) => {
            setFilter("perPage", String(perPage));
            setFilter("page", "1");
          }
        }
      ) })
    ] }) }),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: Boolean(roleTarget),
        onClose: () => setRoleTarget(null),
        title: "Change this person’s role",
        description: roleTarget ? `${roleTarget.name} · ${roleTarget.email || "no email on file"}. Currently ${roleLabel(
          roleTarget.role
        ).toLowerCase()}.` : "",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setRoleTarget(null),
              disabled: busy,
              className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: submitRoleChange,
              disabled: busy || nextRole === roleTarget?.role,
              className: "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-60",
              children: busy ? "Saving…" : "Change role"
            }
          )
        ] }),
        children: [
          formError && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: formError }),
          /* @__PURE__ */ jsx("div", { className: formError ? "mt-3" : "", children: /* @__PURE__ */ jsx(
            SelectField,
            {
              label: "Role",
              value: nextRole,
              onChange: (event) => setNextRole(event.target.value),
              children: ASSIGNABLE_ROLES.map((role) => /* @__PURE__ */ jsx("option", { value: role, children: roleLabel(role) }, role))
            }
          ) }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500", children: nextRole === "school_admin" ? "A school administrator has full governance of their school’s records and settings." : nextRole === "accountant" ? "A bursar can take payments and read fee records, but cannot change school settings." : nextRole === "teacher" ? "A teacher can record marks and see their own classes’ payments. No school settings, no exports." : nextRole === "viewer" ? "A viewer can read the dashboard and nothing else. Use this for anyone who only needs to see." : "" }),
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-[11px] font-semibold leading-relaxed text-slate-400", children: "Platform admin is not offered: SukuuPay has one, and it is defined by the server’s environment rather than granted here." })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: Boolean(removeTarget),
        onClose: () => setRemoveTarget(null),
        title: "Remove this person’s access",
        description: removeTarget ? `${removeTarget.name} · ${removeTarget.email || "no email on file"}` : "",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setRemoveTarget(null),
              disabled: busy,
              className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: submitRemove,
              disabled: busy,
              className: "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-60",
              children: busy ? "Removing…" : "Remove access"
            }
          )
        ] }),
        children: [
          formError && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: formError }),
          /* @__PURE__ */ jsx("div", { className: formError ? "mt-3" : "", children: /* @__PURE__ */ jsx("p", { className: "text-[13px] leading-relaxed text-slate-600", children: "This signs them out of every device immediately and takes away their access to this school’s records. It is recorded in the activity log, and it cannot be undone from this console — reinstating somebody means creating a new account." }) })
        ]
      }
    )
  ] });
};
const STATUS_TONES = {
  draft: "slate",
  pending: "amber",
  approved: "green",
  rejected: "red",
  expired: "slate"
};
const PLACEMENT_LABELS = {
  auth_aside: "Login & signup aside",
  home_hero: "Homepage hero",
  dashboard_sidebar: "School dashboard sidebar"
};
const AdminContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [review, setReview] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const filters = useMemo(
    () => ({
      status: searchParams.get("status") || "",
      placement: searchParams.get("placement") || "",
      page: Number(searchParams.get("page")) || 1,
      perPage: Number(searchParams.get("perPage")) || 20
    }),
    [searchParams]
  );
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listSchoolAds(filters).then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })).catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);
  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== "page") params.delete("page");
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const openReview = (ad, nextDecision) => {
    setReview(ad);
    setDecision(nextDecision);
    setReason("");
    setFormError(null);
  };
  const submitReview = async () => {
    if (!review) return;
    if (decision === "rejected" && reason.trim().length === 0) {
      setFormError("A rejection needs a reason. It is what the school is told.");
      return;
    }
    if (decision === "rejected" && reason.trim().length > 300) {
      setFormError("Keep the reason under 300 characters.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await reviewSchoolAd(review._id, {
        status: decision,
        rejectedReason: decision === "rejected" ? reason.trim() : ""
      });
      setReview(null);
      refresh();
      toast.success(
        decision === "approved" ? `${review.schoolName}’s creative is now live.` : `${review.schoolName}’s creative was rejected and the reason recorded.`
      );
    } catch (error) {
      setFormError(error.message || "This creative could not be reviewed.");
    } finally {
      setBusy(false);
    }
  };
  const hasFilters = Boolean(filters.status || filters.placement);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Platform console",
        title: "Content",
        description: "The school creatives shown on the public pages. A creative is filed pending and goes live only when you approve it."
      }
    ),
    /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2", children: [
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Status",
          value: filters.status,
          onChange: (event) => setFilter("status", event.target.value),
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All statuses" }),
            AD_STATUSES.map((status) => /* @__PURE__ */ jsx("option", { value: status, children: status }, status))
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        SelectField,
        {
          label: "Placement",
          value: filters.placement,
          onChange: (event) => setFilter("placement", event.target.value),
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All placements" }),
            AD_PLACEMENTS.map((placement) => /* @__PURE__ */ jsx("option", { value: placement, children: PLACEMENT_LABELS[placement] || placement }, placement))
          ]
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "mt-4", children: state.error ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Megaphone,
        title: "The content queue could not be loaded",
        description: state.error.message,
        action: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: refresh,
            className: "rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800",
            children: "Try again"
          }
        )
      }
    ) : state.loading && state.rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "space-y-3", children: [0, 1, 2].map((row) => /* @__PURE__ */ jsx("div", { className: "h-28 animate-pulse rounded-2xl bg-slate-200/70" }, row)) }) : state.rows.length === 0 ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: Megaphone,
        title: hasFilters ? "Nothing in the queue for these filters" : "No creatives submitted yet",
        description: hasFilters ? "Try a different status or placement." : "Schools can submit a creative for the public pages; each one arrives here for review."
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-3", children: state.rows.map((ad) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Card, { padding: "p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 sm:flex-row", children: [
        /* @__PURE__ */ jsx("div", { className: "flex shrink-0 items-start gap-3 sm:w-[15rem]", children: ad.imageUrl ? /* @__PURE__ */ jsx(
          "img",
          {
            src: ad.imageUrl,
            alt: ad.imageAlt || "",
            className: "h-20 w-32 rounded-xl border border-slate-200 object-cover",
            loading: "lazy"
          }
        ) : /* @__PURE__ */ jsx("span", { className: "flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400", children: "No creative" }) }),
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold leading-tight text-ink", children: ad.headline || "Untitled creative" }),
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: ad.schoolName })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
              /* @__PURE__ */ jsx(Badge, { tone: "slate", children: PLACEMENT_LABELS[ad.placement] || ad.placement }),
              /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONES[ad.status] || "slate", dot: true, children: ad.status })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("dl", { className: "mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-[11px]", children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-400", children: "Alt text" }),
              /* @__PURE__ */ jsx("dd", { className: "min-w-0 truncate font-bold text-slate-600", children: ad.imageAlt || "— missing —" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-[11px]", children: [
              /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-400", children: "Ends" }),
              /* @__PURE__ */ jsx("dd", { className: "font-bold text-slate-600", children: ad.endsAt ? new Date(ad.endsAt).toLocaleDateString("en-GB") : "—" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-[11px] sm:col-span-2", children: [
              /* @__PURE__ */ jsx("dt", { className: "shrink-0 font-semibold text-slate-400", children: "Links to" }),
              /* @__PURE__ */ jsx("dd", { className: "min-w-0 truncate font-mono font-bold text-slate-600", children: ad.linkUrl || "—" })
            ] })
          ] }),
          ad.rejectedReason && /* @__PURE__ */ jsxs("p", { className: "mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700", children: [
            "Rejected: ",
            ad.rejectedReason
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: ad.status === "pending" ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => openReview(ad, "approved"),
                className: "inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                children: [
                  /* @__PURE__ */ jsx(Check, { className: "h-4 w-4", "aria-hidden": "true" }),
                  "Approve"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                onClick: () => openReview(ad, "rejected"),
                className: "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
                children: [
                  /* @__PURE__ */ jsx(X, { className: "h-4 w-4", "aria-hidden": "true" }),
                  "Reject"
                ]
              }
            )
          ] }) : /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-semibold text-slate-400", children: [
            "This creative is ",
            ad.status,
            ". Only pending creatives can be reviewed."
          ] }) })
        ] })
      ] }) }) }, ad._id)) }),
      /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
        Pagination,
        {
          meta: state.meta,
          itemLabel: "creatives",
          onPageChange: (page) => setFilter("page", String(page)),
          onPerPageChange: (perPage) => {
            setFilter("perPage", String(perPage));
            setFilter("page", "1");
          }
        }
      ) })
    ] }) }),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: Boolean(review),
        onClose: () => setReview(null),
        title: decision === "approved" ? "Approve this creative" : "Reject this creative",
        description: review ? `${review.schoolName} — “${review.headline}”. ${decision === "approved" ? "It becomes visible on the public pages immediately." : "The school is shown the reason you give."}` : "",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setReview(null),
              disabled: busy,
              className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: submitReview,
              disabled: busy,
              className: `rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 ${decision === "approved" ? "bg-brand-700 hover:bg-brand-800" : "bg-red-600 hover:bg-red-700"}`,
              children: busy ? "Saving…" : decision === "approved" ? "Approve and publish" : "Reject"
            }
          )
        ] }),
        children: [
          formError && /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: formError }),
          decision === "rejected" && /* @__PURE__ */ jsx(
            Field,
            {
              label: "Reason",
              required: true,
              value: reason,
              maxLength: 300,
              onChange: (event) => setReason(event.target.value),
              placeholder: "What has to change before this can run?",
              hint: `${reason.trim().length}/300`,
              className: formError ? "mt-3" : ""
            }
          )
        ]
      }
    )
  ] });
};
const MAINTENANCE_MODES = [
  { value: "off", label: "Off", blurb: "Everything works normally." },
  { value: "readonly", label: "Read-only", blurb: "Every page loads; nothing can be changed. The safe state for a migration." },
  { value: "on", label: "Fully down", blurb: "The API refuses reads as well as writes. Only for a release that must not serve traffic at all." }
];
const Row = ({ label, hint, value }) => /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-50 py-3 last:border-0", children: [
  /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
    /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: label }),
    hint && /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-400", children: hint })
  ] }),
  /* @__PURE__ */ jsx("p", { className: "shrink-0 text-[13px] font-extrabold tabular-nums text-ink", children: value })
] });
const Toggle = ({ checked, onChange, disabled, label }) => /* @__PURE__ */ jsx(
  "button",
  {
    type: "button",
    role: "switch",
    "aria-checked": checked,
    "aria-label": label,
    disabled,
    onClick: () => onChange(!checked),
    className: `relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-brand-700" : "bg-slate-300"}`,
    children: /* @__PURE__ */ jsx(
      "span",
      {
        "aria-hidden": "true",
        className: `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[1.375rem]" : "translate-x-0.5"}`
      }
    )
  }
);
const AdminSettings = () => {
  const toast = useToast();
  const [standing, setStanding] = useState({ kpis: null, sms: null, loading: true, error: null });
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(() => {
    let active = true;
    setStanding((current) => ({ ...current, loading: true, error: null }));
    getDashboardKpis().then((kpis) => active && setStanding((c) => ({ ...c, kpis, loading: false }))).catch(() => active && setStanding((c) => ({ ...c, kpis: null, loading: false })));
    getPlatformSmsBalance().then((sms2) => active && setStanding((c) => ({ ...c, sms: sms2 }))).catch(() => {
    });
    return () => {
      active = false;
    };
  }, []);
  const loadSettings = useCallback(() => {
    let active = true;
    getPlatformSettings().then((data) => {
      if (!active) return;
      setSettings(data);
      setDraft({
        defaultMarkupPercent: data.defaultMarkupPercent ?? 5,
        features: {
          adsEnabled: data.features?.adsEnabled !== false,
          selfSignupEnabled: data.features?.selfSignupEnabled !== false,
          trialDays: data.features?.trialDays ?? 30
        },
        maintenance: {
          mode: data.maintenance?.mode || "off",
          message: data.maintenance?.message || ""
        }
      });
    }).catch((error) => active && setFormError(error));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => load(), [load]);
  useEffect(() => loadSettings(), [loadSettings]);
  const schools = standing.kpis?.schools || {};
  const payments = standing.kpis?.payments || {};
  const sms = standing.sms || {};
  const patch = useMemo(() => {
    if (!settings || !draft) return {};
    const body = {};
    if (draft.defaultMarkupPercent !== settings.defaultMarkupPercent) {
      body.defaultMarkupPercent = draft.defaultMarkupPercent;
    }
    const features = {};
    if (draft.features.adsEnabled !== settings.features?.adsEnabled) features.adsEnabled = draft.features.adsEnabled;
    if (draft.features.selfSignupEnabled !== settings.features?.selfSignupEnabled) {
      features.selfSignupEnabled = draft.features.selfSignupEnabled;
    }
    if (draft.features.trialDays !== settings.features?.trialDays) features.trialDays = draft.features.trialDays;
    if (Object.keys(features).length) body.features = features;
    const maintenance = {};
    if (draft.maintenance.mode !== settings.maintenance?.mode) maintenance.mode = draft.maintenance.mode;
    if (draft.maintenance.message !== (settings.maintenance?.message || "")) {
      maintenance.message = draft.maintenance.message;
    }
    if (Object.keys(maintenance).length) body.maintenance = maintenance;
    return body;
  }, [settings, draft]);
  const isDirty = Object.keys(patch).length > 0;
  const enteringMaintenance = patch.maintenance?.mode && patch.maintenance.mode !== "off";
  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = await updatePlatformSettings(patch);
      const changed = Array.isArray(saved.changed) ? saved.changed : [];
      setSettings(saved);
      setConfirming(false);
      loadSettings();
      toast.success(
        changed.length ? changed.map((entry) => `${entry.path} → ${entry.to}`).join(", ") : "Nothing had changed."
      );
    } catch (error) {
      setFormError(error.message || "Those settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      PageHeader,
      {
        eyebrow: "Platform console",
        title: "Settings",
        description: "Configuration for SukuuPay itself — not for any one school. Every change is recorded in the activity log.",
        actions: /* @__PURE__ */ jsxs(Fragment, { children: [
          isDirty && /* @__PURE__ */ jsx(Badge, { tone: "amber", icon: TriangleAlert, children: "Unsaved" }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => setConfirming(true),
              disabled: !isDirty || saving,
              className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-4 w-4", "aria-hidden": "true" }),
                "Save changes"
              ]
            }
          )
        ] })
      }
    ),
    formError && !draft ? /* @__PURE__ */ jsx(
      EmptyState,
      {
        icon: ServerCog,
        title: "Platform settings could not be loaded",
        description: formError.message || String(formError)
      }
    ) : draft ? /* @__PURE__ */ jsxs(Fragment, { children: [
      formError && /* @__PURE__ */ jsx("div", { className: "mb-4", children: /* @__PURE__ */ jsx(FormAlert, { tone: "error", children: formError.message || String(formError) }) }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Fees" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "What a newly provisioned school is given. Existing schools keep the rate they already have." }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 max-w-xs", children: /* @__PURE__ */ jsx(
          Field,
          {
            label: "Default platform markup",
            type: "number",
            min: 0,
            max: 100,
            step: 0.5,
            value: draft.defaultMarkupPercent,
            onChange: (event) => setDraft((current) => ({
              ...current,
              defaultMarkupPercent: Number(event.target.value)
            })),
            hint: "percent"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "mt-4", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Feature flags" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "Things that were previously hard-coded and needed a redeploy to change." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Public creative slider" }),
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "Schools’ creatives on the login and signup pages. Turn off to hide them platform-wide." })
            ] }),
            /* @__PURE__ */ jsx(
              Toggle,
              {
                label: "Public creative slider",
                checked: draft.features.adsEnabled,
                onChange: (adsEnabled) => setDraft((current) => ({ ...current, features: { ...current.features, adsEnabled } }))
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[13px] font-extrabold text-ink", children: "Self-signup" }),
              /* @__PURE__ */ jsx("p", { className: "text-[11px] font-semibold text-slate-500", children: "Whether a new account can be created without an invitation. Turning this off leaves existing accounts untouched." })
            ] }),
            /* @__PURE__ */ jsx(
              Toggle,
              {
                label: "Self-signup",
                checked: draft.features.selfSignupEnabled,
                onChange: (selfSignupEnabled) => setDraft((current) => ({
                  ...current,
                  features: { ...current.features, selfSignupEnabled }
                }))
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "max-w-xs", children: /* @__PURE__ */ jsx(
            Field,
            {
              label: "Trial length",
              type: "number",
              min: 0,
              max: 365,
              value: draft.features.trialDays,
              onChange: (event) => setDraft((current) => ({
                ...current,
                features: { ...current.features, trialDays: Number(event.target.value) }
              })),
              hint: "days"
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "mt-4", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Maintenance" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "The only way to take SukuuPay quiet. Confirmed separately, because the three modes are not degrees of the same thing." }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-2", children: MAINTENANCE_MODES.map((mode) => /* @__PURE__ */ jsxs(
          "label",
          {
            className: "flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50",
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "radio",
                  name: "maintenance-mode",
                  value: mode.value,
                  checked: draft.maintenance.mode === mode.value,
                  onChange: () => setDraft((current) => ({ ...current, maintenance: { ...current.maintenance, mode: mode.value } })),
                  className: "mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
                }
              ),
              /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: mode.label }),
                /* @__PURE__ */ jsx("span", { className: "block text-[11px] font-semibold text-slate-500", children: mode.blurb })
              ] })
            ]
          },
          mode.value
        )) }),
        draft.maintenance.mode !== "off" && /* @__PURE__ */ jsxs("div", { className: "mt-4", children: [
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Message shown to users",
              value: draft.maintenance.message,
              maxLength: 500,
              onChange: (event) => setDraft((current) => ({
                ...current,
                maintenance: { ...current.maintenance, message: event.target.value }
              })),
              placeholder: "We are upgrading SukuuPay and will be back shortly.",
              hint: `${draft.maintenance.message.length}/500`
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-[11px] font-semibold text-slate-400", children: "Optional. Empty means the platform says nothing about itself." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Card, { padding: "p-5", className: "mt-4", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Platform standing" }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: "Live figures, from the same endpoints the Overview reads." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
          /* @__PURE__ */ jsx(Row, { label: "Schools registered", hint: "All lifecycle states combined", value: formatCount(schools.total) }),
          /* @__PURE__ */ jsx(Row, { label: "Active", value: formatCount(schools.active) }),
          /* @__PURE__ */ jsx(Row, { label: "On trial", value: formatCount(schools.onTrial) }),
          /* @__PURE__ */ jsx(Row, { label: "Suspended", value: formatCount(schools.suspended) }),
          /* @__PURE__ */ jsx(Row, { label: "Archived", value: formatCount(schools.archived) }),
          /* @__PURE__ */ jsx(Row, { label: "Accounts", hint: "Staff and parents", value: formatCount(standing.kpis?.users?.total) }),
          /* @__PURE__ */ jsx(Row, { label: "Platform markup earned", value: formatCedi(payments.platformMarkup) }),
          /* @__PURE__ */ jsx(Row, { label: "Pending payouts", value: formatCedi(payments.pendingPayouts) }),
          /* @__PURE__ */ jsx(
            Row,
            {
              label: "SMS credit",
              hint: sms.totalSchools ? `Master balance across ${formatCount(sms.totalSchools)} active schools` : "Master balance, all schools",
              value: formatCount(sms.totalBalance)
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx(Card, { padding: "p-5", className: "mt-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "text-[13px] font-extrabold text-ink", children: "Last saved" }),
          /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[11px] font-semibold text-slate-500", children: settings?.updatedAt ? new Date(settings.updatedAt).toLocaleString("en-GB") : "These are the defaults. Nothing has been saved yet." })
        ] }),
        /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400", children: /* @__PURE__ */ jsx(Check, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) })
      ] }) })
    ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-4", children: [0, 1, 2].map((card) => /* @__PURE__ */ jsx("div", { className: "h-56 animate-pulse rounded-2xl bg-slate-200/70" }, card)) }),
    /* @__PURE__ */ jsxs(
      Modal,
      {
        open: confirming,
        onClose: () => setConfirming(false),
        title: enteringMaintenance ? "Put SukuuPay into maintenance?" : "Save these settings?",
        description: enteringMaintenance ? MAINTENANCE_MODES.find((mode) => mode.value === draft?.maintenance?.mode)?.blurb : "The change takes effect immediately for every school on the platform.",
        footer: /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setConfirming(false),
              disabled: saving,
              className: "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: save,
              disabled: saving,
              className: `rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 ${enteringMaintenance ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-700 hover:bg-brand-800"}`,
              children: saving ? "Saving…" : enteringMaintenance ? "Enter maintenance" : "Save changes"
            }
          )
        ] }),
        children: [
          /* @__PURE__ */ jsx("ul", { className: "space-y-1.5", children: Object.entries(patch).map(
            ([group, value]) => typeof value === "object" && value !== null ? Object.entries(value).map(([key, next]) => /* @__PURE__ */ jsxs("li", { className: "flex items-baseline justify-between gap-3 text-[12px]", children: [
              /* @__PURE__ */ jsxs("code", { className: "font-mono font-bold text-slate-600", children: [
                group,
                ".",
                key
              ] }),
              /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-extrabold text-ink", children: [
                String(settings?.[group]?.[key] ?? "—"),
                " → ",
                String(next)
              ] })
            ] }, `${group}.${key}`)) : /* @__PURE__ */ jsxs("li", { className: "flex items-baseline justify-between gap-3 text-[12px]", children: [
              /* @__PURE__ */ jsx("code", { className: "font-mono font-bold text-slate-600", children: group }),
              /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-extrabold text-ink", children: [
                String(settings?.[group] ?? "—"),
                " → ",
                String(value)
              ] })
            ] }, group)
          ) }),
          draft?.maintenance?.message?.trim() && /* @__PURE__ */ jsxs("p", { className: "mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500", children: [
            "Users will be shown: “",
            draft.maintenance.message.trim(),
            "”"
          ] })
        ]
      }
    )
  ] });
};
const shortenPath = (pathname) => {
  const value = pathname || "";
  if (value.length <= 64) return value;
  return `${value.slice(0, 40)}…${value.slice(-20)}`;
};
const exitsFor = (variant, role) => {
  if (variant === "admin") {
    return {
      eyebrow: "404",
      heading: "That console module does not exist",
      blurb: "The platform console has five modules. Pick one below, or go back to the platform overview.",
      primary: { to: ROUTES.ADMIN, label: "Platform overview" },
      modules: visibleAdminNav("super_admin").flatMap((group) => group.items)
    };
  }
  if (variant === "app") {
    return {
      eyebrow: "404",
      heading: "We couldn’t find that module",
      blurb: "The module may have been renamed, or the link may be out of date. Your work is not affected.",
      primary: { to: ROUTES.DASHBOARD, label: "Back to dashboard" },
      modules: visibleDashboardNav(role).flatMap((group) => group.items)
    };
  }
  if (variant === "pay") {
    return {
      eyebrow: "Link expired",
      heading: "This fee link is no longer valid",
      blurb: "Payment links are single-use and expire. If you were sent this by SMS, ask the school to send a fresh link — your account is unaffected either way.",
      primary: { to: ROUTES.CONTACT, label: "Contact the school" },
      modules: [],
      variant
    };
  }
  return {
    eyebrow: "404",
    heading: "We couldn’t find that page",
    blurb: "The link may be out of date. The pages below cover everything SukuuPay does.",
    primary: { to: ROUTES.HOME, label: "Back to home" },
    modules: NAV_LINKS,
    variant
  };
};
const NotFound = ({ variant = "marketing" }) => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const config = exitsFor(variant, user?.role);
  const attempted = shortenPath(pathname);
  const inShell = variant === "app" || variant === "admin";
  const panel = /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
    /* @__PURE__ */ jsx(
      "span",
      {
        className: `mx-auto mb-6 flex items-center justify-center rounded-2xl bg-brand-50 text-brand-800 ${inShell ? "h-14 w-14" : "h-16 w-16"}`,
        children: /* @__PURE__ */ jsx(Compass, { size: inShell ? 26 : 32, "aria-hidden": "true" })
      }
    ),
    /* @__PURE__ */ jsx("p", { "aria-hidden": "true", className: "text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700", children: config.eyebrow }),
    /* @__PURE__ */ jsx(
      "h1",
      {
        className: `mt-2 font-display font-extrabold tracking-tight text-ink ${inShell ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`,
        children: config.heading
      }
    ),
    attempted && attempted !== "/" && /* @__PURE__ */ jsxs("p", { className: "mx-auto mt-4 max-w-md text-sm", children: [
      /* @__PURE__ */ jsx("span", { className: "text-slate-600", children: "No page is registered at" }),
      " ",
      /* @__PURE__ */ jsx("code", { className: "break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-[13px] font-bold text-ink", children: attempted })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600", children: config.blurb }),
    config.modules.length > 0 && /* @__PURE__ */ jsx("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-3", children: config.modules.map((link) => /* @__PURE__ */ jsx(
      Link,
      {
        to: link.to,
        className: "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
        children: link.label
      },
      link.to
    )) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3", children: [
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: config.primary.to,
          className: "inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: [
            /* @__PURE__ */ jsx(ArrowLeft, { className: "h-4 w-4", "aria-hidden": "true" }),
            config.primary.label
          ]
        }
      ),
      variant === "marketing" && user && /* @__PURE__ */ jsxs(
        Link,
        {
          to: user.role === "super_admin" ? ROUTES.ADMIN : ROUTES.DASHBOARD,
          className: "inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: [
            user.role === "super_admin" ? "Platform console" : "Your dashboard",
            /* @__PURE__ */ jsx("span", { className: "text-[11px] font-semibold text-slate-400", children: roleLabel(user.role) })
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        Link,
        {
          to: ROUTES.CONTACT,
          className: "inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40",
          children: [
            /* @__PURE__ */ jsx(LifeBuoy, { className: "h-4 w-4", "aria-hidden": "true" }),
            "Report a broken link"
          ]
        }
      )
    ] }),
    HELPDESK_PHONE
  ] });
  if (inShell) {
    return /* @__PURE__ */ jsx("div", { className: "py-10 sm:py-16", children: panel });
  }
  return /* @__PURE__ */ jsx("div", { className: "bg-slate-50", children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8", children: panel }) });
};
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
const at = (path) => /* @__PURE__ */ jsx(MemoryRouter, { initialEntries: [path], children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(ToastProvider, { children: /* @__PURE__ */ jsx(Routes, { children: /* @__PURE__ */ jsxs(Route, { path: "/admin", element: /* @__PURE__ */ jsx(AdminLayout, {}), children: [
  /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(AdminOverview, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "schools", element: /* @__PURE__ */ jsx(AdminSchools, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "users", element: /* @__PURE__ */ jsx(AdminUsers, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "content", element: /* @__PURE__ */ jsx(AdminContent, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "settings", element: /* @__PURE__ */ jsx(AdminSettings, {}) }),
  /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(NotFound, { variant: "admin" }) })
] }) }) }) }) });
const guarded = (path, role = "school_admin") => /* @__PURE__ */ jsx(MemoryRouter, { initialEntries: [path], children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(Routes, { children: /* @__PURE__ */ jsx(Route, { element: /* @__PURE__ */ jsx(AdminGuard, {}), children: /* @__PURE__ */ jsx(Route, { path: "/admin", element: /* @__PURE__ */ jsx(AdminLayout, {}), children: /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(AdminOverview, {}) }) }) }) }) }) });
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
console.log("\nplatform console");
await check("the shell renders its rail, names itself, and drops the marketing chrome", () => {
  const html = at_("/admin");
  for (const needle of ["Platform console", 'aria-label="Platform console modules"']) {
    if (!has(html, needle)) throw new Error(`missing "${needle}"`);
  }
  if (has(html, "Your school")) throw new Error("the platform shell is rendering a school card");
  if (has(html, "For schools")) throw new Error("the marketing footer is present");
  return "rail present, no school card, no footer";
});
await check("every console module renders inside the shell", () => {
  const pages = [
    ["/admin", "Platform revenue"],
    ["/admin/schools", "Schools"],
    ["/admin/users", "Users"],
    ["/admin/content", "Content"],
    ["/admin/settings", "Settings"]
  ];
  pages.forEach(([path, needle]) => {
    const html = at_(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });
  return "5 module pages rendered";
});
await check("exactly one rail entry is marked current, and it is the module being viewed", () => {
  for (const [path, label] of [
    ["/admin", "Platform"],
    ["/admin/schools", "Schools"],
    ["/admin/content", "Content"]
  ]) {
    const html = at_(path);
    const current = countOf(html, 'aria-current="page"');
    if (current !== 1) throw new Error(`${path} marked ${current} entries current, expected 1`);
    const active = visibleAdminNav("super_admin").flatMap((group) => group.items).find((item) => isNavItemActive(path, item));
    if (!active) throw new Error(`${path} matches no nav entry`);
    if (active.label !== label) throw new Error(`${path} resolved to ${active.label}`);
  }
  return "overview, schools and content each light exactly one entry";
});
await check("the rail is the whole console: five modules in three groups", () => {
  const labels = visibleAdminNav("super_admin").flatMap((group) => group.items.map((i) => i.label));
  const expected = ["Platform", "Schools", "Users", "Content", "Settings"];
  for (const label of expected) {
    if (!labels.includes(label)) throw new Error(`the rail is missing ${label}`);
  }
  if (labels.length !== expected.length) {
    throw new Error(`the rail has ${labels.length} entries, expected ${expected.length}`);
  }
  const gated = ADMIN_NAV.flatMap((g) => g.items).filter((item) => item.roles);
  if (gated.length) throw new Error(`${gated.length} console entries carry a roles filter`);
  return `${expected.length} modules, no per-entry role filter`;
});
await check("every console route has an icon the sidebar can resolve", () => {
  const ICONS2 = ["Gauge", "Building2", "Users", "Megaphone", "Settings"];
  const missing = ADMIN_NAV.flatMap((g) => g.items).map((i) => i.icon).filter((icon) => !ICONS2.includes(icon));
  if (missing.length) throw new Error(`no icon for ${[...new Set(missing)].join(", ")}`);
  return `${ICONS2.length} icons cover the tree`;
});
await check("the guard refuses an unauthenticated visitor before the shell mounts", () => {
  const html = renderToString(guarded("/admin"));
  if (has(html, "Platform console modules")) {
    throw new Error("the console shell rendered for a visitor with no session");
  }
  if (!has(html, "animate-spin")) throw new Error("the guard rendered neither a redirect nor a spinner");
  return "no shell, redirect in flight";
});
await check("the guard refuses a non-platform role with a 403, not a redirect", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(MemoryRouter, { initialEntries: ["/admin"], children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(Forbidden, { requiredRole: "super_admin", role: "school_admin" }) }) })
  );
  for (const needle of ["403", roleLabel("super_admin"), roleLabel("school_admin")]) {
    if (!has(html, needle)) throw new Error(`the 403 page is missing "${needle}"`);
  }
  return "names both the required role and the signed-in role";
});
await check("the 403 names the modules the refused role can actually reach", () => {
  const html = renderToString(
    /* @__PURE__ */ jsx(MemoryRouter, { initialEntries: ["/admin"], children: /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(Forbidden, { requiredRole: "school_admin", role: "teacher" }) }) })
  );
  if (has(html, ">Settings<")) throw new Error("the 403 offers a module a teacher cannot open");
  if (!has(html, "Students")) throw new Error("the 403 offers no reachable module");
  return "teacher is sent to modules they can open";
});
await check("a mistyped console path keeps the console shell and names the path", () => {
  const html = at_("/admin/revnu");
  if (!has(html, 'aria-label="Platform console modules"')) {
    throw new Error("the shell was lost on an unmatched console path");
  }
  if (has(html, "For schools")) throw new Error("the marketing footer is present");
  if (!has(html, "/admin/revnu")) throw new Error("the attempted path is not shown");
  if (!has(html, "That console module does not exist")) {
    throw new Error("the console-specific heading is missing");
  }
  return "shell kept, attempted path shown";
});
await check("the 404 offers the console modules as exits, not the marketing links", () => {
  const html = at_("/admin/revnu");
  for (const href of ['href="/admin"', 'href="/admin/schools"', 'href="/admin/users"', 'href="/admin/content"']) {
    if (!has(html, href)) throw new Error(`no exit linking to ${href}`);
  }
  if (has(html, 'href="/how-it-works"')) throw new Error("the 404 offers a marketing link");
  return "console exits only, no marketing links";
});
await check("the KPI band reads pesewas as cedis, never as pesewas", () => {
  const kpis = {
    ...EMPTY_ADMIN_KPIS,
    schools: { ...EMPTY_ADMIN_KPIS.schools, total: 85, active: 72, onTrial: 12, paid: 60 },
    payments: {
      ...EMPTY_ADMIN_KPIS.payments,
      totalRevenue: 31705e4,
      mtdRevenue: 345e5,
      platformMarkup: 15852500
    }
  };
  const band = renderToString(/* @__PURE__ */ jsx(KpiRow, { kpis }));
  if (!has(band, "3,170,500")) throw new Error("the band did not render 317,050,000 pesewas as cedis");
  if (has(band, "31,705,000")) throw new Error("a figure is rendering as pesewas, 100× too large");
  if (!has(band, "345,000")) throw new Error("MTD revenue did not render as cedis");
  if (!has(band, "85")) throw new Error("the school count did not render");
  return "317,050,000 pesewa → GH₵ 3,170,500";
});
await check("the Overview renders inside a router with no figures of its own", () => {
  const html = at_("/admin");
  if (!has(html, "Platform revenue")) throw new Error("the revenue card is missing");
  if (!has(html, "What the platform is made of")) throw new Error("the composition card is missing");
  if (!has(html, "Newest schools")) throw new Error("the recent-schools card is missing");
  return "four cards present";
});
await check("the users page mounts and states its scope", async () => {
  const html = at_("/admin/users");
  assert(has(html, "Scope: all schools on the platform"), "the users page does not state its scope");
  return "scope stated above the list";
});
await check("the role picker never offers the platform admin role", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/pages/admin/AdminUsers.jsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  assert(
    source.includes("USER_ROLES.filter((role) => role !== 'super_admin')"),
    "the assignable list must be USER_ROLES minus super_admin"
  );
  const dialog = source.slice(source.indexOf("Change this person"));
  assert(dialog.length > 0, "the role-change dialog is missing");
  const picker = dialog.slice(dialog.indexOf("<SelectField"), dialog.indexOf("</SelectField>"));
  assert(picker.length > 0, "the role picker is missing");
  assert(picker.includes("ASSIGNABLE_ROLES"), "the role picker must be built from ASSIGNABLE_ROLES");
  assert(!picker.includes("USER_ROLES"), "the role picker must not read the full role list");
  return "picker is built from USER_ROLES minus super_admin";
});
await check("the owner row has no actions and says where it comes from", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/pages/admin/AdminUsers.jsx", "utf8");
  assert(
    source.includes("isPlatformOwner"),
    "the owner must be identified by isPlatformOwner, not by role or by email"
  );
  const ownerArm = source.slice(
    source.indexOf("{isOwner(account) ? ("),
    source.indexOf(") : (", source.indexOf("{isOwner(account) ? ("))
  );
  assert(ownerArm.length > 0, "the owner branch is missing from the actions cell");
  assert(
    ownerArm.includes("Managed by the server environment"),
    "the owner arm must explain where the account comes from"
  );
  assert(!ownerArm.includes("<button"), "the owner arm renders buttons — it must not");
  assert(
    source.includes("defined by the server’s"),
    "the role dialog does not say why the platform admin role is not offered"
  );
  return "owner arm explains and offers no buttons; dialog states why";
});
console.log(`
${pass} passed, ${fail} failed
`);
if (fail) process.exitCode = 1;
