import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { useLocation, Link, useNavigate, Outlet, useSearchParams, MemoryRouter, Routes, Route } from "react-router-dom";
import React, { createContext, useState, useEffect, useCallback, useContext, useRef, useMemo, useId } from "react";
import axios from "axios";
import { Info, TriangleAlert, CircleAlert, CircleCheck, X, Settings as Settings$1, ScrollText, ChartColumn, MessageSquare, CalendarClock, CreditCard, Users, LayoutDashboard, Building2, ChevronUp, Menu, GraduationCap, ChevronDown, Search, Plus, Bell, User, LogOut, TrendingUp, ChevronRight, Send, Download, Receipt, HandCoins, SlidersHorizontal, Hourglass, ChevronLeft, ArrowUp, ArrowDown, PencilLine, Ban, Link as Link$1, Archive, Trash2, CirclePlay, RotateCcw, Wallet, History, Star, ShieldCheck, UploadCloud, FileSpreadsheet, UserPlus, Construction, Banknote, CheckCircle2, MessageSquareText, BarChart3, PieChart, Printer, Filter, Save, Smartphone } from "lucide-react";
import { createPortal } from "react-dom";
const API_BASE_URL = "https://sukuupay-backend.onrender.com/api";
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
  DASHBOARD_SETTINGS: "/dashboard/settings"
};
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
const visibleDashboardNav = (role) => DASHBOARD_NAV.map((group) => ({
  ...group,
  items: group.items.filter((item) => canAccessNavItem(role, item))
})).filter((group) => group.items.length > 0);
const isNavItemActive = (pathname, item) => item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
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
  ChartColumn,
  ScrollText,
  Settings: Settings$1
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
const ROLE_LABELS = {
  super_admin: "Platform admin",
  school_admin: "School Admin",
  accountant: "School Bursar",
  teacher: "Teacher",
  viewer: "Viewer"
};
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
  const roleLabel = ROLE_LABELS[user?.role] || "Signed in";
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
          /* @__PURE__ */ jsx(LogoMark, { className: "h-9 w-9", markClassName: "text-base" }),
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
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled: true,
          title: "Notifications arrive with the SMS Reminders module",
          "aria-label": "Notifications (coming soon)",
          className: "hidden h-10 w-10 cursor-not-allowed items-center justify-center rounded-xl text-slate-300 sm:flex",
          children: /* @__PURE__ */ jsx(Bell, { className: "h-5 w-5" })
        }
      ),
      /* @__PURE__ */ jsx(
        Popover,
        {
          align: "right",
          className: "max-w-[13rem]",
          panel: /* @__PURE__ */ jsxs("div", { className: "py-1.5", children: [
            /* @__PURE__ */ jsxs("div", { className: "border-b border-slate-100 px-3.5 py-2.5", children: [
              /* @__PURE__ */ jsx("p", { className: "truncate text-sm font-extrabold text-ink", children: displayName }),
              /* @__PURE__ */ jsx("p", { className: "truncate text-[11px] font-semibold text-slate-500", children: roleLabel })
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
              /* @__PURE__ */ jsx("span", { className: "block truncate text-[11px] font-semibold leading-tight text-slate-500", children: roleLabel })
            ] }),
            /* @__PURE__ */ jsx(ChevronDown, { className: "hidden h-4 w-4 shrink-0 text-slate-400 lg:block", "aria-hidden": "true" })
          ] })
        }
      )
    ] })
  ] }) });
};
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
        next.transactions = payments.value.rows.map((p) => ({
          ...p,
          studentName: p.studentName || p.studentId || "Payment",
          studentId: p.studentId,
          network: String(p.momoNetwork || "UNKNOWN").toLowerCase().slice(0, 8),
          networkLabel: p.momoNetwork || p.paymentMethod?.toUpperCase() || "Manual",
          reference: p.reference || p.mtnReferenceId || p.paymentId,
          dateLabel: new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          timeLabel: new Date(p.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        }));
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
  const smsCredit = null;
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
        /* @__PURE__ */ jsx("main", { id: "dashboard-main", tabIndex: -1, className: "min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-7xl", children: /* @__PURE__ */ jsx(Outlet, {}) }) })
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
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
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
          className: `relative w-full ${widths[size]} max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-soft outline-none sm:rounded-2xl`,
          children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6", children: [
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
            /* @__PURE__ */ jsx("div", { className: "px-5 py-5 sm:px-6", children }),
            footer && /* @__PURE__ */ jsx("div", { className: "flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6", children: footer })
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
const recordManualPayment = async (payload) => {
  try {
    const { data } = await api.post("/payments/record", payload, { timeout: 2e4 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, "The payment could not be recorded.");
  }
};
const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" }
];
const DEBOUNCE_MS$1 = 300;
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
    }, DEBOUNCE_MS$1);
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
              /* @__PURE__ */ jsxs("p", { className: "text-[12px] font-semibold text-slate-500", children: [
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
                  /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
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
const FILTERS = [
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
  const activeFilter = FILTERS.find((f) => f.key === channel);
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
          children: FILTERS.map((filter) => {
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
const initials$1 = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
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
    /* @__PURE__ */ jsx("tbody", { children: transactions.map((txn, index) => /* @__PURE__ */ jsxs(
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
    )) })
  ] }) }),
  isDemo && /* @__PURE__ */ jsx("p", { className: "border-t border-slate-100 px-5 py-3 text-[11px] font-semibold text-slate-400", children: "Demo data. Backed by GET /payments once wired." })
] });
const sendBulk = async (schoolId, filters, message) => {
  try {
    const { data } = await api.post(`/sms/bulk/${schoolId}`, { ...filters, message }, {
      timeout: 6e4
    });
    return data.data || data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 405) {
      const notSupported = new Error(
        "Bulk SMS sending is not available on the API yet. Reminders are queued server-side once the roster is imported."
      );
      notSupported.status = status;
      notSupported.code = "SMS_SEND_NOT_SUPPORTED";
      throw notSupported;
    }
    throw toApiError(error, "The reminders could not be sent.");
  }
};
const BroadcastSmsCard = ({ broadcast }) => {
  const { user } = useAuth();
  const { warning, error: errorToast, success } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const recipientCount = broadcast?.recipientCount ?? 0;
  const nothingSent = recipientCount === 0;
  const runSend = async () => {
    setConfirming(false);
    if (!user?.schoolId) {
      warning("This account is not linked to a school yet, so there is nobody to notify.");
      return;
    }
    setSending(true);
    try {
      await sendBulk(user.schoolId, { overdueOnly: true });
      success(`Reminder queued for ${formatCount(recipientCount)} parents.`);
    } catch (err) {
      if (err?.code === "SMS_SEND_NOT_SUPPORTED") {
        warning(err.message);
      } else {
        errorToast(err?.message || "The reminders could not be sent.");
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
      nothingSent ? /* @__PURE__ */ jsx("p", { className: "mt-4 text-[13px] font-semibold leading-relaxed text-slate-600", children: "No student currently owes a fee, so there is nobody to remind. This card appears once a balance is outstanding." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("p", { className: "mt-4 text-[13px] font-extrabold text-red-600", children: [
          formatCount(recipientCount),
          " Overdue Students detected"
        ] }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-3 space-y-1.5 rounded-xl bg-white/70 p-3 text-[12px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Outstanding total" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCediShort(broadcast.totalOutstanding) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Paid nothing yet" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCount(broadcast.fullyUnpaidCount) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "font-semibold text-slate-500", children: "Paid something" }),
            /* @__PURE__ */ jsx("dd", { className: "font-extrabold text-ink", children: formatCount(broadcast.partiallyPaidCount) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: () => setConfirming(true),
            disabled: sending,
            className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60",
            children: [
              /* @__PURE__ */ jsx(Send, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Send Overdue Fee SMS Prompt"
            ]
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
          /* @__PURE__ */ jsxs(Button, { variant: "primary", onClick: runSend, children: [
            "Send to ",
            formatCount(recipientCount),
            " parents"
          ] })
        ] }),
        children: /* @__PURE__ */ jsx("dl", { className: "space-y-2.5 text-sm", children: [
          { label: "Recipients", value: `${formatCount(recipientCount)} parents` },
          { label: "Messages used", value: formatCount(recipientCount) },
          { label: "Outstanding total", value: formatCediShort(broadcast.totalOutstanding) }
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
      /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            onClick: onExport,
            disabled: isFallback,
            title: isFallback ? "Available once the dashboard can reach the API" : "Export this term’s figures",
            className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300",
            children: [
              /* @__PURE__ */ jsx(Download, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Export Financial Report (CSV/PDF)"
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
            className: "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none",
            children: [
              /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4", "aria-hidden": "true" }),
              "Record Manual Payment"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(KpiRow, { kpis }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 xl:col-span-2", children: [
        /* @__PURE__ */ jsx(CollectionsCard, { term, seriesFor }),
        /* @__PURE__ */ jsx(
          RecentTransactionsCard,
          {
            transactions,
            totalCount: transactionCount,
            isDemo: isFallback
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsx(PaymentChannelsCard, { channels }),
        /* @__PURE__ */ jsx(BroadcastSmsCard, { broadcast: smsBroadcast }),
        /* @__PURE__ */ jsx(UpcomingInstallmentsCard, { upcoming: upcomingInstallments })
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
const DEBOUNCE_MS = 300;
const RosterFilterBar = ({ filters, setFilter, clearFilters, hasFilters, classes = [] }) => {
  const [term, setTerm] = useState(filters.search);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setTerm(filters.search), [filters.search]);
  useEffect(() => {
    if (term === filters.search) return void 0;
    const timer = setTimeout(() => setFilter({ q: term }), DEBOUNCE_MS);
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
const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700"
];
const initials = (name) => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
const COLUMNS = [
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
  onRegeneratePayLink
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
        COLUMNS.map((column) => /* @__PURE__ */ jsx(
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
      /* @__PURE__ */ jsx("tbody", { children: loading ? Array.from({ length: 6 }).map((_, index) => /* @__PURE__ */ jsx("tr", { className: "border-t border-slate-100", children: /* @__PURE__ */ jsx("td", { colSpan: COLUMNS.length + 2, className: "px-4 py-4", children: /* @__PURE__ */ jsx("div", { className: "h-6 animate-pulse rounded bg-slate-100" }) }) }, `skeleton-${index}`)) : rows.map((student, index) => {
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
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${AVATAR_TONES[index % AVATAR_TONES.length]}`,
                        "aria-hidden": "true",
                        children: initials(student.studentName)
                      }
                    ),
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
      Pagination,
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
const TABS$1 = [
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
  const primaryGuardian = (data?.guardians || []).find((g) => g.isPrimary) || data?.guardians?.[0];
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
            student && /* @__PURE__ */ jsx("nav", { "aria-label": "Profile sections", className: "mt-4 -mb-4 flex gap-5 overflow-x-auto", children: TABS$1.map((t) => /* @__PURE__ */ jsx(
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
                /* @__PURE__ */ jsx(Figure, { label: "Total owed", value: formatCediShort(student.totalOwed) }),
                /* @__PURE__ */ jsx(Figure, { label: "Paid", value: formatCediShort(student.totalPaid), tone: "text-brand-700" }),
                /* @__PURE__ */ jsx(
                  Figure,
                  {
                    label: "Balance",
                    value: formatCediShort(student.balance),
                    tone: student.balance > 0 ? "text-red-600" : "text-emerald-600"
                  }
                ),
                /* @__PURE__ */ jsx(Figure, { label: "Fee status", value: /* @__PURE__ */ jsx(FeeStatusBadge, { student }) })
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
                    value: primaryGuardian ? `${primaryGuardian.parentName}${primaryGuardian.phone ? ` · ${formatGhanaPhone(primaryGuardian.phone)}` : ""}` : "—"
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
const Figure = ({ label, value, tone = "text-ink" }) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-white p-4 shadow-soft", children: [
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
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
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
      onSaved(saved, isEdit);
      onClose();
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
            /* @__PURE__ */ jsxs("th", { scope: "row", className: "px-5 py-3 font-normal", children: [
              /* @__PURE__ */ jsx("span", { className: "block text-[13px] font-extrabold text-ink", children: alumnus.studentName }),
              /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                alumnus.studentId,
                guardian?.phone ? ` · ${formatGhanaPhone(guardian.phone)}` : ""
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
                /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsx("span", { className: "block truncate text-[13px] font-extrabold text-ink", children: student.studentName }),
                  /* @__PURE__ */ jsxs("span", { className: "block text-[11px] font-semibold text-slate-500", children: [
                    student.studentId,
                    " · ",
                    student.studentClass
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
const TABS = [
  { value: "roster", label: "Roster" },
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
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
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
      /* @__PURE__ */ jsx(ModuleTabs, { items: TABS, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
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
    /* @__PURE__ */ jsx(ModuleTabs, { items: TABS, value: tab, onChange: setTab, ariaLabel: "Students sections" }),
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
        onRegeneratePayLink
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
    )
  ] });
};
const ModuleScaffold = ({
  eyebrow,
  title,
  description,
  action,
  sections = [],
  notes = [],
  children
}) => /* @__PURE__ */ jsxs(Fragment, { children: [
  /* @__PURE__ */ jsx(PageHeader, { eyebrow, title, description }),
  action && /* @__PURE__ */ jsx("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: /* @__PURE__ */ jsx(
    "span",
    {
      title: "Not available yet",
      className: "inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-500",
      children: action
    }
  ) }),
  /* @__PURE__ */ jsx(Card, { padding: "p-4", className: "mb-5 border-amber-200 bg-amber-50", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700", children: /* @__PURE__ */ jsx(Construction, { className: "h-[18px] w-[18px]", "aria-hidden": "true" }) }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm font-extrabold text-amber-900", children: "This module is being built" }),
      /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium text-amber-800", children: "The layout below is final; the data behind it is not wired yet. Nothing here is placeable." })
    ] })
  ] }) }),
  children,
  sections.length > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-5", children: [
    /* @__PURE__ */ jsx("h2", { className: "mb-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400", children: "What this module will hold" }),
    /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children: sections.map((section) => /* @__PURE__ */ jsx(Card, { padding: "p-4", className: "shadow-none", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
      section.icon ? /* @__PURE__ */ jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500", children: /* @__PURE__ */ jsx(section.icon, { className: "h-4 w-4", "aria-hidden": "true" }) }) : null,
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx("p", { className: "text-sm font-extrabold text-ink", children: section.title }),
        /* @__PURE__ */ jsx("p", { className: "mt-0.5 text-[13px] font-medium leading-snug text-slate-500", children: section.description }),
        section.endpoint && /* @__PURE__ */ jsx("code", { className: "mt-2 inline-block rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold text-slate-500", children: section.endpoint })
      ] })
    ] }) }, section.title)) })
  ] }),
  notes.length > 0 && /* @__PURE__ */ jsx("ul", { className: "mt-5 space-y-2", children: notes.map((note) => /* @__PURE__ */ jsx(
    "li",
    {
      className: "rounded-xl border border-slate-100 bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-slate-600",
      children: note
    },
    note
  )) })
] });
const Payments = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "Payments",
    description: "Every Mobile Money payment your school has received, with its receipt.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Search, { className: "h-4 w-4" }),
      "Find a payment"
    ] }),
    sections: [
      {
        title: "Transaction list",
        description: "Filter by student, class, method, date range or status.",
        endpoint: "GET /payments",
        icon: Banknote
      },
      {
        title: "Payment detail",
        description: "One payment in full, including the MoMo transaction reference.",
        endpoint: "GET /payments/:paymentId",
        icon: Receipt
      },
      {
        title: "Receipts",
        description: "Download or share the PDF a parent already paid against.",
        endpoint: "GET /payments/:paymentId/receipt",
        icon: Receipt
      },
      {
        title: "Refunds",
        description: "Reverse a payment against the student’s balance. Admins only.",
        endpoint: "POST /payments/:paymentId/refund",
        icon: RotateCcw
      }
    ],
    notes: [
      "The parent-facing payment page (/pay/:token) is deliberately outside this module: it is a public, unauthenticated surface, and a bursar never needs to see it while reconciling.",
      "Payment status is driven by the Hubtel webhook, so a row can sit unconfirmed for a moment after the parent paid. That state needs its own visible badge, not a blank value."
    ]
  }
);
const InstallmentPlans = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "Installment Plans",
    description: "Split a student’s bill into dated installments and track each one.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4" }),
      "Create a plan"
    ] }),
    sections: [
      {
        title: "Plan timeline",
        description: "One row per installment: due date, amount, and paid or overdue. The default view.",
        endpoint: "GET /payment-plans/:studentId",
        icon: CalendarClock
      },
      {
        title: "Create a plan",
        description: "Split an existing balance across dated installments for one student.",
        endpoint: "POST /payment-plans/create/:studentId",
        icon: Plus
      },
      {
        title: "Prepay an installment",
        description: "Record money paid against a specific future installment.",
        endpoint: "POST /payment-plans/:planId/prepay",
        icon: CheckCircle2
      },
      {
        title: "Mark an installment paid",
        description: "Settle one installment by hand, for a cash payment at the bursar’s desk.",
        endpoint: "PUT /payment-plans/:planId/installment/:num",
        icon: CheckCircle2
      },
      {
        title: "Plan compliance",
        description: "How many families are current against the school-wide schedule.",
        endpoint: "GET /payment-plans/school/:schoolId/compliance",
        icon: TrendingUp
      },
      {
        title: "Edit and cancel",
        description: "Reschedule a plan, or cancel it without deleting the history behind it.",
        endpoint: "PUT /payment-plans/:planId",
        icon: CalendarClock
      }
    ],
    notes: [
      "Cancellation is a soft cancel (DELETE /payment-plans/:planId). The plan stays readable, because a school needs to explain to a parent why a schedule stopped.",
      "A parent accepts and prepays against a plan from their own page using the SMS token. This module is the school’s view of that, not a second place to take the money."
    ]
  }
);
const SmsReminders = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "SMS Reminders",
    description: "Tell a parent what is owed, when it is due, and how to pay it.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Send, { className: "h-4 w-4" }),
      "Send reminders"
    ] }),
    sections: [
      {
        title: "Reminder templates",
        description: "The standing messages a school sends: due soon, overdue, plan accepted, payment received.",
        endpoint: "Scheduled server-side",
        icon: MessageSquareText
      },
      {
        title: "Target selection",
        description: "Everyone behind, one class, or one named student — the same audience the reports use.",
        endpoint: "GET /reports/overdue/:schoolId",
        icon: Users
      },
      {
        title: "Schedule",
        description: "Automatic nudges before and after a due date, so the bursar is not writing them by hand.",
        endpoint: "installmentReminder cron",
        icon: CalendarClock
      },
      {
        title: "Delivery log",
        description: "What was sent, to which parent, and whether the gateway accepted it.",
        endpoint: "GET /webhooks/sms",
        icon: MessageSquare
      }
    ],
    notes: [
      "No school-facing SMS send endpoint exists today. The button above is disabled on purpose — a live-looking control here would report success for messages that were never sent.",
      "WhatsApp is the sendable channel that does exist today (POST /whatsapp/send-bulk/:schoolId, with a template catalogue). If reminders need to be manual and immediate, that is the path available now.",
      "Message bodies must respect SMS_SEGMENT_LENGTH. Longer copy splits into multiple billed segments, which matters for cost estimates shown to the school."
    ]
  }
);
const Reports = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "Reports",
    description: "Where the money came from, who has not paid, and how the term is tracking.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Download, { className: "h-4 w-4" }),
      "Export"
    ] }),
    sections: [
      {
        title: "Daily collections",
        description: "What came in today, by method.",
        endpoint: "GET /reports/daily/:schoolId",
        icon: TrendingUp
      },
      {
        title: "Term summary",
        description: "Expected against collected for a whole term.",
        endpoint: "GET /reports/term/:schoolId",
        icon: BarChart3
      },
      {
        title: "Outstanding balances",
        description: "Who still owes, and by how much. The report that drives reminders.",
        endpoint: "GET /reports/outstanding/:schoolId",
        icon: PieChart
      },
      {
        title: "Overdue only",
        description: "The same list filtered to past the due date.",
        endpoint: "GET /reports/overdue/:schoolId",
        icon: TrendingUp
      },
      {
        title: "Payment methods",
        description: "The split across MTN, Telecel and AirtelTigo.",
        endpoint: "GET /reports/payment-methods/:schoolId",
        icon: PieChart
      },
      {
        title: "Class collections",
        description: "Collection rate per class, for a headteacher’s review.",
        endpoint: "GET /reports/class-collections/:schoolId",
        icon: BarChart3
      },
      {
        title: "Installment compliance",
        description: "How many families are current against the agreed schedule.",
        endpoint: "GET /reports/compliance/:schoolId",
        icon: TrendingUp
      },
      {
        title: "Headteacher monthly",
        description: "The month-end summary a school signs off internally.",
        endpoint: "GET /reports/headmaster-monthly/:schoolId",
        icon: Printer
      },
      {
        title: "Parent contacts",
        description: "Exportable contact list, for the school’s own records.",
        endpoint: "GET /reports/parent-contacts/:schoolId",
        icon: Download
      }
    ],
    notes: [
      "Every report takes an academic year and term, which live in Settings. Reports are therefore scoped by the school’s current setting unless the caller overrides it.",
      "Amounts are pesewas integers on the wire. Formatting to cedis belongs in one shared helper, or the same figure will read GH₵ 0.01 and GH₵ 100 in two reports."
    ]
  }
);
const ActivityLog = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "Activity Log",
    description: "Who changed what, in your school, and when they did it.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Filter, { className: "h-4 w-4" }),
      "Filter"
    ] }),
    sections: [
      {
        title: "School activity",
        description: "Every change across the school, newest first, with filters on actor and date.",
        endpoint: "GET /audit-logs/:schoolId",
        icon: ScrollText
      },
      {
        title: "One user’s activity",
        description: "Everything a single member of staff has done.",
        endpoint: "GET /audit-logs/user/:userId",
        icon: User
      },
      {
        title: "Export",
        description: "The filtered list as CSV, for an external review.",
        endpoint: "GET /audit-logs/:schoolId/export",
        icon: Download
      }
    ],
    notes: [
      "Read-only by design. This module gets no create, update or delete; a log the product can edit is not evidence of anything.",
      "The export must honour the filters on screen. An export that silently returns the unfiltered log is worse than no export, because it looks like a complete answer.",
      "Entries reference a user and an entity, so the log is the natural place to link back to the student or payment it concerns — as a route into that record, not a copy of its details."
    ]
  }
);
const Settings = () => /* @__PURE__ */ jsx(
  ModuleScaffold,
  {
    title: "Settings",
    description: "Your school, your academic year, your paystack and your subscription.",
    action: /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Save, { className: "h-4 w-4" }),
      "Save changes"
    ] }),
    sections: [
      {
        title: "School profile",
        description: "Name, classification, region, logo and contact details.",
        endpoint: "GET /settings/:schoolId",
        icon: Building2
      },
      {
        title: "Academic year and term",
        description: "Sets the period every report, plan and deadline is measured against.",
        endpoint: "PUT /settings/:schoolId/academic-year",
        icon: CalendarClock
      },
      {
        title: "Notification preferences",
        description: "What the school is told about, and how often.",
        endpoint: "PUT /settings/:schoolId/notifications",
        icon: Bell
      },
      {
        title: "Paystack",
        description: "The MoMo account or merchant credentials payments are collected into.",
        endpoint: "PUT /settings/:schoolId",
        icon: CreditCard
      },
      {
        title: "Subscription and billing",
        description: "Current plan and what it costs. Read-only; changed through billing.",
        endpoint: "GET /settings/:schoolId/billing",
        icon: Receipt
      }
    ],
    notes: [
      "Credentials must never be echoed back into a form field. Read them masked, and write only when the school actually changes them.",
      "Changing the academic year re-bases every report and due date in the system, so it needs confirming rather than a quiet save.",
      "This is the module that owns the staff list and roles, so invitations and permission changes belong here as their own section."
    ]
  }
);
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
  /* @__PURE__ */ jsx(LogoMark, { className: "h-8 w-8 shrink-0", markClassName: "text-xs" })
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
await check("all eight modules are in the rail", () => {
  const html = renderRoute("/dashboard");
  const missing = MODULES.filter((label) => !has(html, `>${label}<`));
  if (missing.length) throw new Error(`missing from the rail: ${missing.join(", ")}`);
  return "8 of 8";
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
    ["/dashboard/settings", "Settings"]
  ];
  routes.forEach(([path, expected]) => {
    const html = renderRoute(path);
    const { count, label } = currentInRail(html);
    if (count !== 1) throw new Error(`${path} marked ${count} rail entries current, expected 1`);
    if (label !== expected) throw new Error(`${path} marked "${label}" current, expected "${expected}"`);
  });
  return "8 routes, one correct entry each";
});
await check("every module page renders its own content", () => {
  const pages = [
    // `/dashboard` is absent: the Overview is legitimately *loading* during SSR
    // (effects do not run, and it starts `loading: true` on purpose so a live
    // school never sees a flash of fixture figures). It has its own check below.
    ["/dashboard/students", "Select all students on this page"],
    ["/dashboard/payments", "Refunds"],
    ["/dashboard/installment-plans", "Plan timeline"],
    ["/dashboard/sms-reminders", "No school-facing SMS send endpoint"],
    ["/dashboard/reports", "Outstanding balances"],
    ["/dashboard/activity-log", "Read-only by design"],
    ["/dashboard/settings", "Academic year and term"]
  ];
  pages.forEach(([path, needle]) => {
    const html = renderRoute(path);
    if (!has(html, needle)) throw new Error(`${path} did not render "${needle}"`);
  });
  return "7 module pages rendered";
});
await check("Settings is hidden from non-admin roles in the rail", () => {
  const teacher = visibleDashboardNav("teacher").flatMap((g) => g.items.map((i) => i.label));
  const admin = visibleDashboardNav("school_admin").flatMap((g) => g.items.map((i) => i.label));
  if (teacher.includes("Settings")) throw new Error("a teacher can see Settings");
  if (!admin.includes("Settings")) throw new Error("a school admin cannot see Settings");
  return "teacher 7, school admin 8";
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
  if (!/path="\/pay\/:token"/.test(source)) {
    throw new Error("/pay/:token is not registered");
  }
  const appChrome = source.indexOf("AppChrome");
  const payRoute = source.indexOf('path="/pay/:token"');
  const appChromeClose = source.indexOf("</Route>", appChrome);
  if (payRoute < appChromeClose) {
    throw new Error("/pay/:token is nested inside AppChrome");
  }
  return "registered as a sibling of AppChrome";
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
await check("all four Students tabs render", () => {
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
  return "roster, import, alumni and cohorts all render";
});
console.log(`
${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
