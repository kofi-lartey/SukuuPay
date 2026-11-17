# Frontend Architecture — SukuuPay

## 1. High-Level Overview

### 1.1 Purpose & Scope
The SukuuPay frontend is a **React 18 + Vite** single-page application serving four distinct user experiences within one codebase:

| Surface | Route Prefix | Layout | Auth |
|---------|--------------|--------|------|
| **Marketing** | `/`, `/features`, `/pricing`, `/contact` | `AppChrome` (navbar + footer) | None |
| **Auth** | `/login`, `/signup`, `/verify-email`, `/reset-password` | `AuthShell` (centered card) | None (public) |
| **Onboarding** | `/onboarding/*` | `OnboardingLayout` (stepper) | `AuthProvider` + email-verified |
| **Admin Console** | `/dashboard/*` | `DashboardLayout` (sidebar rail + topbar) | `AuthProvider` + `AdminGuard` + `OnboardingGuard` |
| **Parent Portal** | `/parent/*` | `ParentLayout` (bottom nav + topbar) | Token in URL (`/pay/:token/...`) |
| **Teacher Portal** | `/teacher/*` | `TeacherLayout` (sidebar + topbar) | `AuthProvider` + `TeacherGuard` |
| **Student Community** | `/community` (or `/student/community`) | `StudentLayout` (sidebar + bottom nav) | `AuthProvider` + `StudentGuard` + `CommunityGuard` |

### 1.2 Core Design Principles
1. **Route-level layout isolation**: Each portal owns its shell (`AppChrome`, `DashboardLayout`, `ParentLayout`, etc.) — no shared chrome between portals.
2. **Context-driven state**: Three global contexts (`AuthContext`, `CommunityContext`, `ToastContext`) — no Redux, no external state library.
3. **Server-driven onboarding**: The server returns `{ linked, completed, highestStep, nextRoute, flow }`; the client never infers school linkage from `schoolId === null`.
4. **TanStack Query for server state**: All async data fetched via `useQuery`/`useMutation` with aggressive caching (`refetchOnWindowFocus: false`, `retry: 1`).
5. **Optimistic UI for mutations**: Create/update/delete mutate local cache first, then sync; rollback on error.
6. **Mock mode for development**: `VITE_USE_MOCKS=true` swaps the entire `api` instance for an MSW handler — no service changes required.

### 1.3 Technology Stack
- **Framework**: React 18.3 (functional components, hooks only)
- **Build**: Vite 5 (ES modules, HMR, code-splitting)
- **Routing**: React Router 6 (nested routes, `Outlet`, route guards)
- **State**: React Context (`AuthContext`, `CommunityContext`, `ToastContext`)
- **Server State**: TanStack Query v5 (`@tanstack/react-query`)
- **HTTP**: Axios (single instance with interceptors for auth + refresh)
- **Styling**: Tailwind CSS (utility-first, no CSS-in-JS)
- **Forms**: Uncontrolled inputs + custom `Field`/`SelectField`/`TextareaField` primitives (`FormField.jsx`)
- **Icons**: Lucide React (tree-shaken)
- **Charts**: Chart.js v4 (dashboard analytics)
- **PDF**: `@react-pdf/renderer` (ID card generation)
- **Testing**: Vitest + React Testing Library (unit), MSW (integration mocks)
- **Mocks**: `.mockcheck/` harness (gitignored, not in repo)

---

## 2. Directory Structure & Module Responsibilities

```
frontend/src/
├── App.jsx                    # Root route composition, all portal routes
├── main.jsx                   # Entry: QueryClient, LoadingScreen, Mock bootstrap
├── index.css                  # Tailwind imports + global utilities (.scrollbar-none)
├── components/
│   ├── admin/                 # Platform console (schools, users, finance, SMS, analytics)
│   ├── ads/                   # Public ad slider + school ad requests
│   ├── auth/                  # Login, signup, password reset, email verify
│   ├── common/                # Cross-cutting: Modal, ErrorBoundary, FormField, LegalLinks, ScrollToTop
│   ├── community/             # Student community: ClubDetail, CreateClubDialog, ClubChat, PostCard, FeedContainer
│   ├── dashboard/             # Admin console modules: Overview, Students, Payments, Reports, etc.
│   ├── home/                  # Marketing landing sections
│   ├── idCards/               # ID card designer, preview, bulk print
│   ├── layout/                # AppChrome (marketing shell), ErrorBoundary wrappers
│   ├── lms/                   # Learning management (teacher + student)
│   ├── loading/               # LoadingScreenProvider (pulse/spinner variants)
│   ├── onboarding/            # 4-step wizard (school profile, payment, import, pricing)
│   ├── parent/                # Parent portal: portal shell, fee cards, attendance, records
│   ├── payments/              # Payment plan UI, installment cards
│   ├── plans/                 # Subscription plans (admin)
│   ├── settings/              # Settings pages (admin, school, ID card)
│   ├── sms/                   # SMS credit purchase, logs
│   ├── student/               # Student community shell (sidebar, topbar, bottom nav)
│   ├── students/              # Student roster components (idcards, promotions)
│   ├── teacher/               # Teacher portal shell + modules
│   └── user-management/       # InviteTeamMemberDialog, role chips
├── context/
│   ├── AuthContext.jsx        # User, tokens, onboarding state, school linkage
│   ├── CommunityContext.jsx   # Clubs, posts, events, chat, realtime socket
│   └── ToastContext.jsx       # Global toast notifications (success/error/warning/info)
├── data/
│   └── parent/                # Static parent portal config (empty states, labels)
├── hooks/
│   ├── useAuth.js             # Re-export of useAuth (convenience)
│   ├── useCommunity.js        # useCommunityFeed, useClubChat, useStudyRoom
│   ├── useDashboardOverview.js # School + term selectors, overview data
│   ├── useEntitlements.js     # Feature flags from PlatformSettings
│   ├── admin/                 # Admin-specific hooks
│   ├── parent/                # Parent portal hooks
│   └── teacher/               # Teacher portal hooks
├── layouts/
│   ├── AdminLayout.jsx        # (Unused — DashboardLayout is the admin shell)
│   ├── DashboardLayout.jsx    # Admin console shell (rail + topbar + error boundary)
│   ├── OnboardingLayout.jsx   # Stepper shell
│   ├── ParentLayout.jsx       # Parent portal shell (bottom nav + topbar)
│   ├── StudentLayout.jsx      # Student community shell (sidebar + bottom nav)
│   └── TeacherLayout.jsx      # Teacher portal shell (sidebar + topbar)
├── mocks/
│   ├── handlers.js            # MSW request handlers (all endpoints)
│   ├── preinstall.js          # Installs ServiceWorker before api.js evaluates
│   └── adapter.js             # MSW setup
├── pages/
│   ├── admin/                 # Platform console pages (overview, schools, users, finance, analytics)
│   ├── auth/                  # Login, signup, verify, reset pages
│   ├── dashboard/             # Admin console modules (overview, students, payments, reports)
│   ├── idCards/               # Bulk print, batch print, settings, templates
│   ├── lms/                   # LMS pages (teacher + student)
│   ├── onboarding/            # Wizard steps
│   ├── parent/                # Parent portal pages (fees, attendance, records, messages)
│   ├── pay/                   # Student LMS under parent token
│   ├── settings/              # ID card settings, templates
│   ├── student/               # Community page (feed, clubs, events, chat, bookmarks)
│   └── teacher/               # Teacher portal pages
├── routes/
│   ├── AdminGuard.jsx         # requireAdmin + OnboardingGuard composition
│   ├── CommunityGuard.jsx     # Excludes parent role
│   ├── OnboardingGuard.jsx    # Redirects incomplete onboarding
│   ├── RoleLanding.jsx        # Multi-role redirect (super_admin → admin, teacher → teacher, etc.)
│   ├── StudentGuard.jsx       # Requires student role
│   └── TeacherGuard.jsx       # Requires teacher role
├── services/
│   ├── api.js                 # Axios instance (baseURL, auth interceptor, refresh, FormData fix)
│   ├── auth.js                # Login, signup, OTP, password reset, Google OAuth
│   ├── community.js           # Clubs, posts, comments, reactions, events, chat
│   ├── dashboard.js           # Overview, school, terms
│   ├── tokenRefresh.js        # Shared refresh logic (used by api.js + teacher portal)
│   ├── upload.js              # Cloudinary signed upload
│   └── [domain].js            # One file per API domain (payments, sms, admin, etc.)
├── styles/                    # (Empty — Tailwind via index.css)
├── utils/
│   ├── constants.js           # Route maps, role arrays, category/privacy enums
│   ├── ghanaPostGps.js        # Digital address autocomplete
│   ├── mentions.js            # @mention parsing for community
│   └── [domain].js            # Pure helpers (date, currency, validation)
└── index.html                 # Vite entry HTML
```

---

## 3. Application Bootstrap (`main.jsx`)

### 3.1 Provider Hierarchy
```jsx
<QueryClientProvider client={queryClient}>
  <LoadingScreenProvider variant="pulse" minDisplayTime={1000} ...>
    <App />
    {mockPanel}          // Only when VITE_USE_MOCKS=true
  </LoadingScreenProvider>
</QueryClientProvider>
```

### 3.2 Mock Mode Initialization (Critical Order)
```js
if (useMocks) {
  import('./mocks/preinstall')
    .then(({ preinstallMockApi }) => preinstallMockApi())  // 1. Register SW
    .then(() => import('./mocks'))
    .then(({ installMockApi, MockControlPanel }) => {
      installMockApi();                                     // 2. Start MSW
      renderApp(<MockControlPanel />);                      // 3. Render app
    });
}
```
- **`preinstallMockApi()`** registers the ServiceWorker *before* `services/api.js` is evaluated — otherwise a cached `auth_token` in `localStorage` would fire `getCurrentUser()` against the real backend before MSW intercepts.
- `MockControlPanel` renders a floating amber banner with "Reset mocks" / "Seed data" controls.

### 3.3 TanStack Query Defaults
```js
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Parent on 3G must not reload on tab switch
      retry: 1,                     // One retry only — second is usually same dead connection
    },
  },
});
```

---

## 4. Routing Architecture (`App.jsx`)

### 4.1 Portal Separation via Layout Components
Each portal is a **layout route** that wraps its children with a persistent shell:

```jsx
// Marketing (no auth)
<Route element={<AppChrome />}>           // Navbar + footer
  <Route path="/" element={<Home />} />
  <Route path="features" element={<Features />} />
  ...
</Route>

// Auth (public)
<Route element={<AuthShell />}>
  <Route path="login" element={<Login />} />
  <Route path="signup" element={<Signup />} />
  ...
</Route>

// Onboarding (auth + email verified)
<Route element={<OnboardingGuard />}>
  <Route element={<OnboardingLayout />}>
    <Route path="onboarding/school-profile" element={<Step1SchoolProfile />} />
    ...
  </Route>
</Route>

// Admin Console (auth + onboarding complete + admin role)
<Route element={<AdminGuard />}>
  <Route element={<DashboardLayout />}>
    <Route path="dashboard" element={<RoleLanding />} />
    <Route path="dashboard/students" element={<Students />} />
    <Route path="dashboard/payments" element={<Payments />} />
    ...
    <Route path="admin" element={<AdminContent />} />  // Platform console (super_admin)
  </Route>
</Route>

// Parent Portal (token in URL)
<Route element={<ParentLayout />}>
  <Route path="parent/fees/:token" element={<ParentFees />} />
  <Route path="parent/attendance/:token" element={<ParentAttendance />} />
  ...
</Route>

// Teacher Portal
<Route element={<TeacherGuard />}>
  <Route element={<TeacherLayout />}>
    <Route path="teacher/dashboard" element={<TeacherDashboard />} />
    ...
  </Route>
</Route>

// Student Community
<Route element={<StudentGuard />}>
  <Route element={<StudentLayout />}>
    <Route path="community" element={
      <CommunityGuard>
        <CommunityProvider>
          <StudentCommunity />
        </CommunityProvider>
      </CommunityGuard>
    } />
    ...
  </Route>
</Route>
```

### 4.2 Guard Composition
| Guard | Checks | Redirect |
|-------|--------|----------|
| `AuthGuard` (implicit via `AuthProvider`) | `loading` → spinner, `!user` → `/login` | `/login` |
| `OnboardingGuard` | `onboarding.completed` | `onboarding.nextRoute` (Step 1–4) |
| `AdminGuard` | `role ∈ [super_admin, school_admin, accountant, teacher]` | `/login` |
| `TeacherGuard` | `role === 'teacher'` | `/login` |
| `StudentGuard` | `role === 'student'` | `/login` |
| `CommunityGuard` | `role ∈ [student, teacher, school_admin, super_admin, accountant]` (excludes parent) | `/login` or `Forbidden` |
| `RoleLanding` | Multi-role redirect based on `user.role` | Role-specific dashboard |

---

## 5. Global Contexts

### 5.1 `AuthContext` (`context/AuthContext.jsx`)
**State**:
- `user` — authenticated principal (from `/auth/me`)
- `loading` — initial boot + token refresh
- `onboarding` — `{ linked, reason, schoolId, completed, highestStep, nextRoute, flow, joinRequested, joinRequest }`
- `school` — school document (populated by `useDashboardOverview`)

**Key Functions**:
```js
login(email, password)           // → apiLogin, applySession
studentLogin(studentId, password) // → apiStudentLogin, applySession
signup(payload)                  // → apiSignup
signOut()                        // → clearTokens, setUser(null)
refreshUser()                    // → getCurrentUser, applySession
updateProfile(payload)           // → updateMe, setUser
```

**`applySession(userData, linkState)`** — single source of truth for user + onboarding state. Called by:
- Initial boot (`getCurrentUser`)
- `onAuthChange` subscription (refresh token rotation)
- Login / signup / Google OAuth
- Impersonation end (reload)

**Onboarding Flag Backstop**: `localStorage['sukuupay_onboarding_completed_<userId>']` survives the window between wizard completion and server PATCH.

### 5.2 `CommunityContext` (`context/CommunityContext.jsx`)
**State**:
- `feedPosts`, `clubs`, `events` — paginated lists
- `activeSpace` — `'feed' | 'clubs' | 'events' | 'chat' | 'bookmarks'`
- `user` — current user (from `useAuth`)

**Key Functions** (all re-throw so dialogs can render server errors):
```js
fetchFeed(page, reset)         // Infinite scroll
fetchClubs()                   // Refetch after join/leave/create
handleNewPost(payload)         // createPost → unshift feed
handleCreateClub(payload)      // createClub → fetchClubs
handleUpdateClub(clubId, payload) // updateClub → fetchClubs
handleToggleClub(clubId, password) // toggleClubMembership → fetchClubs
handleCreateEvent(payload)     // createEvent → fetchEvents
handleRsvpEvent(eventId)       // rsvpEvent → fetchEvents
```

**Realtime**: Initializes Socket.io on `user.schoolId` change; listens for `post:new`, `club:updated`, `chat:message` and updates local state.

### 5.3 `ToastContext` (`context/ToastContext.jsx`)
```js
const { toast, success, error, warning, info, dismiss } = useToast();
```
- Single global toast stack (top-right)
- Auto-dismiss (5s), manual dismiss, action buttons
- Mounted in `App.jsx` inside `BrowserRouter` but above routes.

---

## 6. Layout Components (Portal Shells)

### 6.1 `DashboardLayout` (Admin Console)
- **Two-column grid**: `lg:grid-cols-[15.25rem_minmax(0,1fr)]`
- **Rail** (`DashboardSidebar`): 8 module entries, sticky, never unmounts
- **Topbar** (`DashboardTopbar`): School selector, term selector, user menu, impersonation banner
- **ErrorBoundary** keyed on `pathname` — clears on route change
- **Outlet context**: `{ user }` passed to children

### 6.2 `ParentLayout` (Parent Portal)
- **Token-authenticated**: Reads `:token` from URL, validates via `services/parentPortal.js`
- **Bottom nav** (`ParentBottomNav`): 5 tabs (Fees, Attendance, Records, Timetable, Messages)
- **Topbar** (`ParentTopbar`): School name, student avatar, logout
- No sidebar — mobile-first, single column

### 6.3 `StudentLayout` (Student Community)
- **Sidebar** (`StudentSidebar`): 5 tabs (Feed, Clubs, Events, Chat, Saved)
- **Bottom nav** (`StudentBottomNav`): Same 5 tabs (mobile)
- **Topbar** (`StudentTopbar`): School name, drawer toggle
- **ErrorBoundary** keyed on `pathname`

### 6.4 `TeacherLayout` (Teacher Portal)
- **Sidebar** (`TeacherSidebar`): Dashboard, Attendance, Timetable, LMS, Messages
- **Topbar** (`TeacherTopbar`): School, term, class selector, impersonation banner
- Similar to `DashboardLayout` but teacher-scoped modules

### 6.5 `OnboardingLayout` (Wizard)
- **Stepper** (4 steps): progress bar, step titles, next/back
- Each step is a page component; validation on `next`

### 6.6 `AppChrome` (Marketing)
- **Navbar**: Logo, Features/Pricing/Contact links, Login/Signup buttons
- **Footer**: Legal links, social icons
- No auth, no sidebars

---

## 7. Server State Management (TanStack Query)

### 7.1 Query Keys (Structured)
```js
// Services export key factories
export const clubKeys = {
  all: ['clubs'] as const,
  list: (schoolId) => [...clubKeys.all, 'list', schoolId] as const,
  detail: (id) => [...clubKeys.all, 'detail', id] as const,
};
```

### 7.2 Mutation Patterns
```js
// Optimistic update pattern (useCommunityFeed)
const mutation = useMutation({
  mutationFn: createPost,
  onMutate: async (newPost) => {
    await queryClient.cancelQueries({ queryKey: feedKeys.list() });
    const previous = queryClient.getQueryData(feedKeys.list());
    queryClient.setQueryData(feedKeys.list(), (old) => [newPost, ...old]);
    return { previous };
  },
  onError: (err, _vars, context) => {
    queryClient.setQueryData(feedKeys.list(), context.previous);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: feedKeys.list() }),
});
```

### 7.3 Cache Invalidation Strategy
- **List queries**: `invalidateQueries({ queryKey: ['clubs'] })` after create/update/delete
- **Detail queries**: Updated directly via `setQueryData` in mutation `onSuccess`
- **No refetchOnWindowFocus** — parent portal on 3G must not reload on tab switch

---

## 8. HTTP Layer (`services/api.js`)

### 8.1 Axios Instance
```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
});
```

### 8.2 Request Interceptor
- Adds `Authorization: Bearer <token>` from `localStorage` (fallback `sessionStorage`)
- **Deletes `Content-Type` for `FormData`** — critical fix:
  - Default `application/json` header causes `transformRequest` to `JSON.stringify(FormData)` → `{"file":{}}`
  - Deleting lets browser set correct `multipart/form-data; boundary=...`

### 8.3 Response Interceptor
- **401 + not retried** → `refreshAccessToken()` (shared with teacher portal via `services/tokenRefresh.js`)
- **Impersonation ended** (`impersonationEnded: true`) → clears session, hard reloads to `/login`
- **409 `SCHOOL_NOT_LINKED`** → hard redirect to `/onboarding/school-profile` (guarded against loops)

### 8.4 Error Normalization (`services/toApiError.js`)
```js
export const toApiError = (error) => ({
  message: error.response?.data?.message || error.message,
  code: error.response?.data?.code,
  status: error.response?.status,
});
```
All service calls wrap in `try/catch` and throw normalized error.

---

## 9. Service Layer (Domain-Specific)

Each domain has a `services/{domain}.js` file exporting typed functions:

| Service | Endpoints | Notes |
|---------|-----------|-------|
| `auth.js` | `/auth/*` | Login, signup, OTP, reset, Google |
| `community.js` | `/community/*` | Clubs, posts, comments, reactions, events, chat |
| `dashboard.js` | `/dashboard/*` | Overview, school, terms |
| `payments.js` | `/pay/*` | Moolre checkout, webhooks, manual |
| `paymentPlans.js` | `/payment-plans/*` | Installments, reminders |
| `students.js` | `/students/*` | Roster, parents, status, promotion |
| `parentPortal.js` | `/pay/:token/*` | Token validation, fees, attendance |
| `teacher.js` | `/teacher/*` | Attendance, timetable, marks |
| `admin.js` | `/admin/*` | Platform console (schools, users, finance) |
| `sms.js` | `/sms/*` | Send, logs, credit purchase |
| `idCards.js` | `/id-cards/*` | Templates, bulk PDF |
| `reports.js` | `/reports/*` | Collection rate, alumni, cohorts |
| `settings.js` | `/settings/*` | School, ID card, platform |
| `notifications.js` | `/notifications/*` | In-app + push |
| `school.js` | `/schools/*` | Provisioning, logo, gateway |
| `user.js` | `/users/*` | Profile, invites, impersonation |

**Convention**: Every function returns `response.data` (unwrapped), throws normalized error with `code`.

---

## 10. Component Patterns

### 10.1 Form Primitives (`components/common/FormField.jsx`)
```jsx
<Field
  label="Club name"
  name="name"
  value={form.name}
  onChange={handleChange}
  error={errors.name}
  required
  maxLength={100}
  autoFocus
/>
<SelectField
  label="Category"
  name="category"
  value={form.category}
  onChange={handleChange}
  options={CATEGORY_OPTIONS}
  placeholder="Select category"
/>
<TextareaField
  label="Description"
  name="description"
  value={form.description}
  onChange={handleChange}
  rows={4}
  maxLength={2000}
  counter
/>
<FormAlert errors={errors} />  // Renders first error or all
```
- Uncontrolled inputs (ref-based focus, no `onChange` for every keystroke)
- `Field` handles label, error, required asterisk, character counter
- `SelectField` wraps native `<select>` with consistent styling

### 10.2 Modal (`components/common/Modal.jsx`)
```jsx
<Modal
  open={isOpen}
  onClose={onClose}
  title="Create Club"
  description="Fill in the details below"
  size="lg"              // sm | md | lg | xl → max-w-md/lg/2xl/4xl
  bodyClassName="scrollbar-none"
  footer={<ModalFooter />}
>
  <form id="create-club-form">...</form>
</Modal>
```
- Focuses panel on open via `requestAnimationFrame`
- **No autoFocus on first input** — races with focus trap
- Footer submit works via `form="create-club-form"` attribute
- `bodyClassName` applied to scroll container

### 10.3 Error Boundary (`components/common/ErrorBoundary.jsx`)
- Class component (only way to catch render errors)
- `getDerivedStateFromError` → shows fallback UI
- `componentDidCatch` → logs to console with `componentStack`
- **Reset on route change**: `<ErrorBoundary key={pathname}>` in layouts
- Label prop: `<ErrorBoundary label="This page">` → "This page could not be displayed"

### 10.4 Radio Card Grid (`components/community/CreateClubDialog.jsx`)
```jsx
<fieldset>
  <legend>Category</legend>
  <div className="grid grid-cols-2 gap-3">
    {CATEGORIES.map((c) => (
      <label key={c.value} className="relative">
        <input type="radio" name="category" value={c.value} className="sr-only" />
        <div className={cn(
          'p-3 rounded-xl border-2 transition',
          form.category === c.value
            ? 'border-brand-600 bg-brand-50'
            : 'border-slate-200 hover:border-slate-300'
        )}>
          <c.icon className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-bold">{c.label}</span>
        </div>
      </label>
    ))}
  </div>
</fieldset>
```
- Real radio inputs (accessible) + custom styled labels
- No `!important` Tailwind overrides

---

## 11. Key Feature Modules

### 11.1 Student Community (`pages/student/Community.jsx`)
- **5 tabs**: Feed, Clubs, Events, Chat, Saved (`activeSpace` state)
- **Feed**: Infinite scroll (`useCommunityFeed`), `PostCard` + `PostComposer`
- **Clubs**: Grid of `ClubDetail` cards, `CreateClubDialog` (create + edit modes)
- **Events**: List with RSVP, `CreateEventDialog`
- **Chat**: Club selector → `ClubChat` (real-time via Socket.io)
- **Password dialog**: `ClubPasswordDialog` triggered by `CLUB_PASSWORD_REQUIRED` code

### 11.2 Create Club Dialog (`components/community/CreateClubDialog.jsx`)
- **Shared modal** for create + edit (`club` prop toggles mode)
- **3 sections**: 01 Identity (name, description), 02 Classification (category radio grid, privacy radios), 03 Access (permission mode + role grid)
- **Client validation** mirrors `createClubSchema` (Joi)
- **FormAlert** renders validation errors inline
- **Success** → `toast.success`, close dialog, `fetchClubs()`

### 11.3 Club Detail Card (`components/community/ClubDetail.jsx`)
```jsx
<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <header>Name + privacy pill</header>
  <p>Description</p>
  <footer className="flex items-center gap-2">
    <button>Join / Leave</button>
    {isMember && <button>Chat</button>}
    {isCreator && <button className="ml-auto">✎ Edit</button>}
  </footer>
</div>
```
- `isCreator = String(club.createdBy) === String(currentUserId)` (both `User` and `Student` IDs)
- Edit button **absent** (not disabled) for non-creators — server enforces `CLUB_NOT_CREATOR`

### 11.4 Admin Console (`pages/dashboard/*`)
- **Overview**: 9 independent cards, each wrapped in `ErrorBoundary` (one failure ≠ whole page)
- **Students**: Roster with filters, bulk actions, parent management, status transitions
- **Payments**: Collection rate chart, transaction table, manual cash recording
- **Reports**: Alumni, cohorts, collection analytics
- **Settings**: School profile, gateway config, ID card templates

### 11.5 Parent Portal (`pages/parent/*`)
- **Token auth**: `:token` in URL → `services/parentPortal.js` validates + fetches student
- **Fees**: Balance card, installment breakdown, Moolre checkout button
- **Attendance**: Calendar view, term filter
- **Records**: Report cards, transcripts
- **Messages**: Threaded conversation with school

### 11.6 ID Card System (`pages/idCards/*`, `components/idCards/*`, `components/students/idcards/*`)
- **Template designer**: Drag-drop canvas (text, image, barcode, QR, fields)
- **Preview**: Live render with student data
- **Bulk print**: `@react-pdf/renderer` generates multi-page PDF (A4, 10 cards/page)
- **Batch print**: Filter by class, status, custom selection

---

## 12. Styling & Theming

### 12.1 Tailwind Configuration
- **No `tailwind.config.js`** — uses defaults + custom utilities in `index.css`
- **Color palette**: `brand` (teal), `ink` (near-black), `slate` (grays), semantic `red/amber/green`
- **Dark mode**: Not implemented (school admin context doesn't need it)

### 12.2 Global Utilities (`index.css`)
```css
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar { display: none; }
```
Used on `Modal` body and `CreateClubDialog` scroll areas.

### 12.3 Component Styling Patterns
- **Utility-first**: No CSS modules, no styled-components
- **`cn()` helper** (clsx) for conditional classes
- **Consistent spacing**: `gap-2`, `gap-3`, `gap-4` scale
- **Focus rings**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40`
- **Transitions**: `transition-colors` on interactive elements

---

## 13. Real-Time (Socket.io Client)

### 13.1 Connection (`utils/socket.js`)
```js
export const initializeSocket = async (authToken) => {
  io = io(API_BASE_URL.replace('/api', ''), {
    path: '/socket.io',
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  // Join school room
  io.emit('join-school', user.schoolId);
};
```

### 13.2 Events (Client → Server)
| Event | Payload | Purpose |
|-------|---------|---------|
| `join-school` | `schoolId` | Subscribe to school-wide events |
| `join-club` | `clubId` | Subscribe to club chat |
| `leave-club` | `clubId` | Unsubscribe |
| `chat:send` | `{ clubId, body, media }` | Send message |

### 13.3 Events (Server → Client)
| Event | Payload | Handler |
|-------|---------|---------|
| `post:new` | `Post` | Prepend to feed |
| `post:updated` | `Post` | Replace in feed |
| `club:updated` | `Club` | Update club card |
| `club:deleted` | `clubId` | Remove club card |
| `chat:message` | `Comment` | Append to chat |
| `reaction:added` | `{ targetId, targetType, reaction }` | Update counts |

### 13.3 Reconnection
- Auto-reconnect with exponential backoff
- On reconnect, re-emit `join-school` + active `join-club`
- Token refresh updates `io.auth.token` via `io.io.opts.auth`

---

## 14. Mock Mode (Development)

### 14.1 Structure
```
frontend/src/mocks/
├── handlers.js       # MSW handlers for every endpoint
├── preinstall.js     # ServiceWorker registration (before api.js)
├── adapter.js        # MSW setup (setupWorker + start)
└── MockControlPanel.jsx # Floating dev banner
```

### 14.2 Handler Patterns
```js
// handlers.js
rest.post('/api/auth/login', async (req, res, ctx) => {
  const { email, password } = await req.json();
  const user = mockUsers.find(u => u.email === email);
  if (!user || user.password !== password) {
    return res(ctx.status(401), ctx.json({ success: false, message: 'Invalid credentials' }));
  }
  return res(ctx.json({ success: true, data: { user, accessToken: 'mock-token' } }));
});
```

### 14.3 Seeding
- `MockControlPanel` → "Seed data" populates `localStorage` with demo users, clubs, posts
- "Reset mocks" clears storage + reloads

### 14.4 Caveats
- `.mockcheck/` is **gitignored** — not in repo
- `test:render` and `check:*` scripts fail without it (environment gap)
- Mocks only work in browser (ServiceWorker); Node tests use real backend

---

## 15. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest + React Testing Library | Components, hooks, utils |
| Integration | MSW + Vitest | Service calls, auth flows |
| E2E | (Not configured) | — |
| Lint | ESLint (flat config) | `src/components/community/**`, `Avatar.jsx` only |

**ESLint config** (`eslint.config.js`) intentionally narrow — scopes only community components and `Avatar.jsx`. Other files report "File ignored because no matching configuration was supplied" (not an error).

**Pre-existing lint noise** (unrelated to current work):
- `usePlatformOverview.js`: `react-hooks/exhaustive-deps` rule not found
- `mocks/adapter.js`, `mocks/handlers.js`, `utils/mentions.js`: unused `eslint-disable` directives

---

## 16. Build & Deployment

### 16.1 Vite Config (Implicit)
- **Code splitting**: Automatic via dynamic imports (`lazy` not used — routes imported statically)
- **Chunk size warning**: 500 kB (main bundle ~2.8 MB gzipped → 694 kB)
- **Assets**: Cloudinary for images, static assets in `public/`

### 16.2 Environment Variables
| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend origin (default: `https://sukuupay-backend.onrender.com/api`) |
| `VITE_USE_MOCKS` | `true` → enables MSW mock mode |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth web client ID |

### 16.3 Deploy Target
- **Netlify** (static SPA)
- Redirects: `/* /index.html 200` (SPA fallback)
- Headers: `Cache-Control` for assets, `X-Frame-Options: DENY`

---

## 17. Architectural Decision Records (Implicit)

| Decision | Rationale |
|----------|-----------|
| **No Redux/Zustand** | Three global contexts cover all cross-cutting state; server state in TanStack Query |
| **Portal-specific layouts** | Admin, parent, teacher, student have fundamentally different chrome & auth |
| **Server-driven onboarding** | Client cannot know `super_admin` has no school, or `schoolId` points to archived school |
| **Token in URL for parents** | Parents don't have accounts; tokenised links are the credential |
| **Socket.io on same origin** | No CORS, no extra port; upgrade path only |
| **Uncontrolled forms** | Less re-render churn; `Field` primitives handle validation |
| **Partial unique indexes mirrored in UI** | Club creator edit button absent (not disabled) — server is source of truth |
| **Mock mode via ServiceWorker** | Zero service changes; intercepts before `api.js` evaluates |
| **Error boundary per module** | One card failure shouldn't blank the entire dashboard |
| **`refetchOnWindowFocus: false`** | Parent on 3G — balance that moves while reading is worse than stale |

---

## 18. Extending the Frontend

### Adding a New Admin Module
1. Create `pages/dashboard/NewModule.jsx`
2. Add route in `App.jsx` inside `DashboardLayout` outlet
3. Add sidebar entry in `components/dashboard/DashboardSidebar.jsx`
4. Create service calls in `services/dashboard.js` or new `services/newModule.js`

### Adding a New Portal
1. Create `layouts/NewLayout.jsx` (shell + nav)
2. Create guard `routes/NewGuard.jsx`
3. Mount in `App.jsx` with its own route tree
4. Add auth logic to `AuthContext` if new role

### Adding a New Real-Time Feature
1. Add server event in `sockets/communityGateway.js`
2. Listen in `CommunityContext` `useEffect` (socket.on)
3. Update local state (clubs, feed, chat)
4. Components re-render automatically via context

---

*Generated from codebase inspection — reflects the actual implementation as of the current commit.*