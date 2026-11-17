# SukuuPay Frontend

**React 18 + Vite SPA** for the SukuuPay school management platform.

## System Architecture Overview

SukuuPay is a multi-tenant school management platform serving Ghanaian schools. The frontend is a single-page application delivering **four distinct user experiences** within one codebase:

| Surface | Route Prefix | Layout Component | Authentication |
|---------|--------------|------------------|----------------|
| **Marketing** | `/`, `/features`, `/pricing`, `/contact` | `AppChrome` (navbar + footer) | None |
| **Auth** | `/login`, `/signup`, `/verify-email`, `/reset-password` | `AuthShell` (centered card) | None (public) |
| **Onboarding** | `/onboarding/*` | `OnboardingLayout` (stepper) | `AuthProvider` + email-verified |
| **Admin Console** | `/dashboard/*` | `DashboardLayout` (sidebar rail + topbar) | `AuthProvider` + `AdminGuard` + `OnboardingGuard` |
| **Parent Portal** | `/parent/*` | `ParentLayout` (bottom nav + topbar) | Token in URL (`/pay/:token/...`) |
| **Teacher Portal** | `/teacher/*` | `TeacherLayout` (sidebar + topbar) | `AuthProvider` + `TeacherGuard` |
| **Student Community** | `/community` (or `/student/community`) | `StudentLayout` (sidebar + bottom nav) | `AuthProvider` + `StudentGuard` + `CommunityGuard` |

### Core Design Principles
1. **Route-level layout isolation**: Each portal owns its shell — no shared chrome between portals.
2. **Context-driven state**: Three global contexts (`AuthContext`, `CommunityContext`, `ToastContext`) — no Redux, no external state library.
3. **Server-driven onboarding**: Server returns `{ linked, completed, highestStep, nextRoute, flow }`; client never infers school linkage from `schoolId === null`.
4. **TanStack Query for server state**: All async data via `useQuery`/`useMutation` with aggressive caching (`refetchOnWindowFocus: false`, `retry: 1`).
5. **Optimistic UI for mutations**: Create/update/delete mutate local cache first, then sync; rollback on error.
6. **Mock mode for development**: `VITE_USE_MOCKS=true` swaps entire `api` instance for MSW handler — no service changes required.

## Technology Stack
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

## Directory Structure
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

## Application Bootstrap (`main.jsx`)

### Provider Hierarchy
```jsx
<QueryClientProvider client={queryClient}>
  <LoadingScreenProvider variant="pulse" minDisplayTime={1000} ...>
    <App />
    {mockPanel}          // Only when VITE_USE_MOCKS=true
  </LoadingScreenProvider>
</QueryClientProvider>
```

### Mock Mode Initialization (Critical Order)
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
- **`preinstallMockApi()`** registers ServiceWorker *before* `services/api.js` evaluates — otherwise a cached `auth_token` would fire `getCurrentUser()` against real backend before MSW intercepts.

### TanStack Query Defaults
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

## Backend Integration

The frontend communicates with the **SukuuPay Backend** (`../Backend`) via:

### REST API
- **Base URL**: `VITE_API_BASE_URL` (default `https://sukuupay-backend.onrender.com/api`)
- **Auth**: Bearer token in `Authorization` header (stored in `localStorage`, fallback `sessionStorage`)
- **Token refresh**: Automatic via Axios interceptor (`services/api.js` + `services/tokenRefresh.js`)
- **Error handling**: Normalized via `services/toApiError.js`; frontend branches on `error.response.data.code`

### Real-time (Socket.io)
- **Namespace**: `/community` (same origin as REST API)
- **Auth**: Token in handshake `auth.token`
- **Rooms**: `school:{schoolId}`, `club:{clubId}`
- **Events**: `post:new`, `club:updated`, `chat:message`, `reaction:added`
- **Client**: `utils/socket.js` (auto-reconnect, token refresh on reconnect)

### Portal ↔ Backend Route Mapping
| Frontend Portal | Backend Routes | Auth Style |
|-----------------|----------------|------------|
| Admin Console | `/api/*` | JWT + role gates |
| Parent Portal | `/api/pay/:token/*` | Token in URL |
| Teacher Portal | `/api/teacher/*` | JWT + `requireTeacher` |
| Student Community | `/api/community/*` | JWT + `communityAuth` |

## Key Feature Modules

### Student Community (`pages/student/Community.jsx`)
- **5 tabs**: Feed, Clubs, Events, Chat, Saved (`activeSpace` state)
- **Feed**: Infinite scroll (`useCommunityFeed`), `PostCard` + `PostComposer`
- **Clubs**: Grid of `ClubDetail` cards, `CreateClubDialog` (create + edit modes)
- **Events**: List with RSVP, `CreateEventDialog`
- **Chat**: Club selector → `ClubChat` (real-time via Socket.io)
- **Password dialog**: `ClubPasswordDialog` triggered by `CLUB_PASSWORD_REQUIRED` code

### Create Club Dialog (`components/community/CreateClubDialog.jsx`)
- **Shared modal** for create + edit (`club` prop toggles mode)
- **3 sections**: 01 Identity (name, description), 02 Classification (category radio grid, privacy radios), 03 Access (permission mode + role grid)
- **Client validation** mirrors `createClubSchema` (Joi)
- **FormAlert** renders validation errors inline

### Club Detail Card (`components/community/ClubDetail.jsx`)
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

### Admin Console (`pages/dashboard/*`)
- **Overview**: 9 independent cards, each wrapped in `ErrorBoundary` (one failure ≠ whole page)
- **Students**: Roster with filters, bulk actions, parent management, status transitions
- **Payments**: Collection rate chart, transaction table, manual cash recording
- **Reports**: Alumni, cohorts, collection analytics
- **Settings**: School profile, gateway config, ID card templates

### Parent Portal (`pages/parent/*`)
- **Token auth**: `:token` in URL → `services/parentPortal.js` validates + fetches student
- **Fees**: Balance card, installment breakdown, Moolre checkout button
- **Attendance**: Calendar view, term filter
- **Records**: Report cards, transcripts
- **Messages**: Threaded conversation with school

### ID Card System (`pages/idCards/*`, `components/idCards/*`, `components/students/idcards/*`)
- **Template designer**: Drag-drop canvas (text, image, barcode, QR, fields)
- **Preview**: Live render with student data
- **Bulk print**: `@react-pdf/renderer` generates multi-page PDF (A4, 10 cards/page)
- **Batch print**: Filter by class, status, custom selection

## Component Patterns

### Form Primitives (`components/common/FormField.jsx`)
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

### Modal (`components/common/Modal.jsx`)
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

### Error Boundary (`components/common/ErrorBoundary.jsx`)
- Class component (only way to catch render errors)
- `getDerivedStateFromError` → shows fallback UI
- `componentDidCatch` → logs to console with `componentStack`
- **Reset on route change**: `<ErrorBoundary key={pathname}>` in layouts

## Styling & Theming

### Tailwind Configuration
- **No `tailwind.config.js`** — uses defaults + custom utilities in `index.css`
- **Color palette**: `brand` (teal), `ink` (near-black), `slate` (grays), semantic `red/amber/green`
- **Dark mode**: Not implemented (school admin context doesn't need it)

### Global Utilities (`index.css`)
```css
.scrollbar-none {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.scrollbar-none::-webkit-scrollbar { display: none; }
```
Used on `Modal` body and `CreateClubDialog` scroll areas.

## Mock Mode (Development)

### Structure
```
frontend/src/mocks/
├── handlers.js       # MSW handlers for every endpoint
├── preinstall.js     # ServiceWorker registration (before api.js)
├── adapter.js        # MSW setup (setupWorker + start)
└── MockControlPanel.jsx # Floating dev banner
```

### Caveats
- `.mockcheck/` is **gitignored** — not in repo
- `test:render` and `check:*` scripts fail without it (environment gap)
- Mocks only work in browser (ServiceWorker); Node tests use real backend

## Getting Started

### Prerequisites
- Node.js 22+
- Backend running (local or deployed)
- `VITE_API_BASE_URL` pointing to backend

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend origin (default: `https://sukuupay-backend.onrender.com/api`) |
| `VITE_USE_MOCKS` | `true` → enables MSW mock mode |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth web client ID |

### Development
```bash
cd frontend
npm install
npm run dev          # Vite dev server (port 5173)
# Or with mocks:
VITE_USE_MOCKS=true npm run dev
```

### Production Build
```bash
npm run build        # Outputs to dist/
```

### Deploy Target
- **Netlify** (static SPA)
- Redirects: `/* /index.html 200` (SPA fallback)
- Headers: `Cache-Control` for assets, `X-Frame-Options: DENY`

## Testing
```bash
npm run test:render  # Requires .mockcheck/ (gitignored — environment gap)
npx eslint ...       # Lints only community components + Avatar.jsx (intentional narrow scope)
```

## Documentation
- [Frontend Architecture Details](docs/frontend-architecture.md) — Comprehensive technical reference
- [Backend Architecture](docs/backend-architecture.md) — Server-side architecture

## License
Proprietary — SukuuPay Platform