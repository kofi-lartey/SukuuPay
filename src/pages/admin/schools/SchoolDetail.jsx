import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Building2,
  LoaderCircle,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Badge from '../../../components/dashboard/ui/Badge';
import Card from '../../../components/dashboard/ui/Card';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import Modal from '../../../components/common/Modal';
import { Field, SelectField, FormAlert } from '../../../components/common/FormField';
import PhoneInput from '../../../components/common/PhoneInput';
import SuspendSchoolDialog from '../../../components/admin/SuspendSchoolDialog';
import MarkupEditorModal from '../../../components/admin/schools/MarkupEditorModal';
import ImpersonateModal from '../../../components/admin/schools/ImpersonateModal';
import SchoolOverviewTab from '../../../components/admin/schools/SchoolOverviewTab';
import SchoolStudentsTab from '../../../components/admin/schools/SchoolStudentsTab';
import SchoolPaymentsTab from '../../../components/admin/schools/SchoolPaymentsTab';
import SchoolLedgerTab from '../../../components/admin/schools/SchoolLedgerTab';
import SchoolDisbursementsTab from '../../../components/admin/schools/SchoolDisbursementsTab';
import SchoolTeamTab from '../../../components/admin/schools/SchoolTeamTab';
import SchoolSettingsTab from '../../../components/admin/schools/SchoolSettingsTab';
import SchoolNotesTab from '../../../components/admin/schools/SchoolNotesTab';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { useToast } from '../../../hooks/useToast';
import {
  archiveSchool,
  getSchool,
  suspendSchool,
  unsuspendSchool,
  updateSchool,
} from '../../../services/admin';
import { GHANA_REGIONS, GHANA_SCHOOL_TYPES, ROUTES } from '../../../utils/constants';
import { formatPercent } from '../../../utils/format';

/**
 * The tabs, as data.
 *
 * `ModuleTabs` is a *controlled* component keyed on a query parameter — its own
 * comment explains why: a module's sections are `?tab=…` on one path, so `NavLink`
 * would match all of them at once and every tab would render as active. Which means
 * the tab value has to live in the URL here too, not in `useState`, so that an
 * operator can link a colleague straight to "the Ledger tab of Kumasi Basic" and the
 * back button walks the sections.
 *
 * Only the active tab is rendered, below. See the note on the lazy-loading decision
 * in the component body.
 */
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'students', label: 'Students' },
  { value: 'payments', label: 'Payments' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'disbursements', label: 'Disbursements' },
  { value: 'team', label: 'Team' },
  { value: 'settings', label: 'Settings' },
  { value: 'notes', label: 'Notes' },
];

const STATUS_TONES = { active: 'green', suspended: 'red', archived: 'slate' };

/** `PLATFORM_EDITABLE_FIELDS`, restated — see `EditSchoolDialog` for why it is short. */
const EDITABLE = ['name', 'type', 'phone', 'email', 'region', 'city', 'address', 'gpsAddress'];

/**
 * Edit one school's profile from the platform console.
 *
 * **Only eight fields, and that is the server's list, not a shortcut.**
 * `updateSchoolAsPlatform` runs an allowlist and *throws* on anything else with
 * `FIELD_NOT_EDITABLE_HERE` (`Backend/src/services/admin/schools.service.js:534-559`)
 * rather than `$set`-ing whatever survived validation. The complement to a school
 * admin's own narrow edit is genuinely dangerous to over-share, and `status` is on
 * the list of refusals for the sharpest reason of all: a generic field write that
 * could set `status` would be a suspension with no reason, no cascade and the wrong
 * audit entry — three of the four things that make the real one safe.
 *
 * So `website`, `motto` and `yearFounded` are absent from this form even though the
 * brief listed them for creation. Offering them here would be offering a control the
 * server refuses, and the failure arrives as a 400 after the operator has typed the
 * whole thing. Each field's absence is stated in the dialog's own copy so it reads as
 * a boundary rather than an oversight.
 */
const EditSchoolDialog = ({ open, school, onClose, onSaved }) => {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !school) return;
    setDraft({
      name: school.name || '',
      type: school.type || 'private',
      phone: school.phone || '',
      email: school.email || '',
      region: school.region || '',
      city: school.city || '',
      address: school.address || '',
      gpsAddress: school.gpsAddress || '',
    });
    setError(null);
  }, [open, school?._id]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const changed = useMemo(() => {
    if (!school) return false;
    return EDITABLE.some((key) => String(draft[key] ?? '').trim() !== String(school[key] ?? '').trim());
  }, [draft, school]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // Only the changed keys. The endpoint is a patch, and sending the whole form
      // would re-write fields somebody else changed in the meantime — a school
      // correcting its own phone number would have that correction reverted by a
      // platform operator editing the city.
      const patch = {};
      EDITABLE.forEach((key) => {
        const next = (draft[key] ?? '').trim();
        if (String(school[key] ?? '').trim() !== next) patch[key] = next;
      });
      await updateSchool(school._id, patch);
      onSaved?.();
      onClose();
      return { ok: true };
    } catch (caught) {
      setError(caught.message || 'This school could not be updated.');
      return { ok: false, error: caught.message };
    } finally {
      setBusy(false);
    }
  };

  if (!school) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit school details"
      description={`${school.name} · the fields a school administrator cannot change themselves.`}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !changed}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {error && <FormAlert tone="error">{error}</FormAlert>}

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${error ? 'mt-3' : ''}`}>
        <Field
          label="Name"
          required
          className="sm:col-span-2"
          value={draft.name || ''}
          onChange={(event) => set('name', event.target.value)}
        />
        <SelectField
          label="Type"
          value={draft.type || 'private'}
          onChange={(event) => set('type', event.target.value)}
        >
          {GHANA_SCHOOL_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Region"
          value={draft.region || ''}
          onChange={(event) => set('region', event.target.value)}
        >
          {GHANA_REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </SelectField>
        <PhoneInput label="Phone" value={draft.phone || ''} onChange={(value) => set('phone', value)} />
        <Field
          label="Email"
          type="email"
          value={draft.email || ''}
          onChange={(event) => set('email', event.target.value)}
        />
        <Field
          label="City"
          value={draft.city || ''}
          onChange={(event) => set('city', event.target.value)}
        />
        <Field
          label="GPS address"
          value={draft.gpsAddress || ''}
          onChange={(event) => set('gpsAddress', event.target.value)}
          placeholder="Digital address, if the school has one"
        />
        <Field
          label="Address"
          className="sm:col-span-2"
          value={draft.address || ''}
          onChange={(event) => set('address', event.target.value)}
        />
      </div>

      <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
        Not editable from here: website, motto, year founded, branding, academic configuration and
        status. The server refuses those here on purpose — status has its own reason-required,
        audited, cascading endpoint, and a generic field write that could set it would be a
        suspension with no reason and no audit trail.
      </p>
    </Modal>
  );
};

/**
 * Confirm archiving a school.
 *
 * **The copy says this is permanent, because the API says so and nothing in the
 * product reverses it.** `archiveSchool` is a **soft delete** — `status: 'archived'`
 * with `deletedAt` set, students, payments, disbursements and ledger untouched
 * (`services/admin/schools.service.js:1021-1047`) — and there is no un-archive
 * endpoint anywhere in the console. So "Cancel" here does not mean the action can be
 * undone; it means the operator has not asked yet.
 *
 * The three things the archive deliberately does *not* do are listed, because "archive"
 * reads as delete to an operator who has never used one, and a platform owner who
 * believes archiving removed a school's payments will hesitate over an action they
 * should be confident about. Specifically: it does **not** deactivate the school's
 * staff — that is a separate decision with its own endpoint and its own audit entry
 * (`school.service.archiveSchool` does do it; the platform one deliberately does not,
 * so that a reversible-looking action cannot irreversibly lock out a hundred
 * teachers).
 *
 * One more thing worth saying out loud: an archived school is hidden from every
 * platform list but **still readable at this URL** — `getAdminSchoolDetail` passes
 * `includeArchived: true` on purpose, so an archived school can still be looked at.
 * An operator who archives by mistake needs the record to open.
 */
const ArchiveSchoolDialog = ({ open, school, onClose, onArchived }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAcknowledged(false);
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await archiveSchool(school._id);
      onArchived?.(response);
      onClose();
      return { ok: true };
    } catch (caught) {
      setError(caught.message || 'This school could not be archived.');
      return { ok: false, error: caught.message };
    } finally {
      setBusy(false);
    }
  };

  if (!school) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Archive ${school.name}?`}
      description="This is permanent. Nothing in SukuuPay restores an archived school."
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !acknowledged}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Archive className="h-4 w-4" aria-hidden="true" />
            )}
            {busy ? 'Archiving…' : 'Archive permanently'}
          </button>
        </>
      }
    >
      <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
        <p className="text-[13px] font-extrabold text-red-800">
          {school.name} disappears from every platform list
        </p>
        <ul className="mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed text-red-700">
          <li>Its students, payments, disbursements and ledger entries are left completely untouched.</li>
          <li>
            Its staff are <strong>not</strong> signed out — deactivating accounts is a separate,
            separately audited decision.
          </li>
          <li>
            The school&rsquo;s own console keeps working, and this page still opens — an archived
            school can still be looked at.
          </li>
          <li>And it cannot be un-archived from anywhere in this product.</li>
        </ul>
      </div>

      {error && (
        <div className="mt-3">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      {/*
        A required acknowledgement rather than a second confirm dialog. Two dialogs for
        one irreversible action trains people to click through the second one, so this
        asks for one deliberate thing: reading what is about to happen.
      */}
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12px] font-semibold leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-red-600 focus:ring-red-500/30"
        />
        <span>
          I understand this is permanent and that the school&rsquo;s payment history stays where it
          is.
        </span>
      </label>
    </Modal>
  );
};

/**
 * One school, on the platform console, in eight tabs.
 *
 * ── One request on arrival, and one per tab ──
 *
 * The header needs `getSchool` — profile, status, plan, gateway, markup, tags, flags,
 * notes, student count — and that endpoint resolves all of it in a single server-side
 * pass precisely so the header and the tabs cannot disagree about which moment in time
 * they describe.
 *
 * **Everything else is lazy, and that is the decision worth defending.** Opening this
 * page used to mean assembling the school's whole picture: roster, payments, ledger,
 * disbursements, team, settings, notes. That is seven or eight more requests for a page
 * an operator opens most often just to *look* at a school — and the tabs are a
 * navigation between views of one subject, not eight independent screens. Only the
 * active tab mounts, so `?tab=payments` never loads the roster. The consequences are
 * deliberate and both are good: the page is usable the instant the header resolves,
 * and a failure in the ledger has nowhere to hide — it cannot grey out the tabs beside
 * it, so an operator is never looking at a payment total beside a ledger that silently
 * failed to load.
 *
 * ── The header's four actions, and why each is where it is ──
 *
 * `Impersonate`, `Suspend`/`Unsuspend`, `Edit` and `Archive` are in the header because
 * they are decisions *about the school*, not about one tab. But only impersonation and
 * suspension are cheap to undo, and suspension cascades to every account in the school
 * (`MODULES_13_TO_17.md:1585`) — so both still go through a dialog with the blast radius
 * in the words. `Edit` is a form. `Archive` is permanent and gets an acknowledgement.
 *
 * **Markup is not a header action even though it is a header field.** It appears here as
 * a figure because it is one of the three commercial terms, but it is *changed* from
 * the Overview tab, next to the cedi example that explains what the number does. A
 * percentage that changes what every parent pays belongs next to an illustration of a
 * parent's bill, not in a row of navigation buttons above it.
 *
 * ── Read-only while impersonating ──
 *
 * If a session is open on *this* school, the header says so and every mutating
 * control is hidden rather than disabled. Not cosmetic and not the enforcement: the
 * server refuses every write with `403 IMPERSONATION_READ_ONLY`
 * (`Backend/src/middleware/impersonation.js`), and `AdminGuard` has already scoped
 * navigation to this school. A visible-but-dead "Suspend" button is a control that
 * looks like a permission problem and is not one — it is a mode.
 */
const SchoolDetail = () => {
  const { schoolId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isImpersonating, session } = useImpersonation();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const [suspendTarget, setSuspendTarget] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [markupOpen, setMarkupOpen] = useState(false);

  const tab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    if (!schoolId) return undefined;
    let active = true;
    setState({ data: null, loading: true, error: null });

    getSchool(schoolId)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
  }, [schoolId, reloadKey]);

  const setTab = useCallback(
    (next) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (next === 'overview') params.delete('tab');
          else params.set('tab', next);
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const confirmSuspend = useCallback(
    async (target, reason) => {
      try {
        await suspendSchool(target._id, reason);
        toast.success(`${target.name} is suspended. Every account in the school has been signed out.`);
        setSuspendTarget(false);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This school could not be suspended.' };
      }
    },
    [refresh, toast]
  );

  const confirmUnsuspend = useCallback(async () => {
    const school = state.data?.school;
    if (!school) return { ok: false, error: 'This school is not loaded.' };
    try {
      await unsuspendSchool(school._id);
      toast.success(`${school.name} and its staff can sign in again.`);
      refresh();
      return { ok: true };
    } catch (error) {
      toast.error(error.message || 'This school could not be restored.');
      return { ok: false, error: error.message };
    }
  }, [state.data, refresh, toast]);

  const onArchived = useCallback(() => {
    toast.warning(
      `${state.data?.school?.name || 'This school'} is archived. It cannot be restored from SukuuPay.`
    );
    navigate(ROUTES.ADMIN_SCHOOLS, { replace: true });
  }, [navigate, state.data, toast]);

  /**
   * Writes are refused by the server while a session is open, so the controls are
   * hidden rather than disabled — see the note in the component's doc comment.
   */
  const readOnly = isImpersonating && session?.schoolId === schoolId;

  const school = state.data?.school || null;
  const subscription = state.data?.subscription || school?.subscription || {};
  const markup = Number(state.data?.paymentConfig?.platformMarkupPercent) || 0;
  const gatewayMode = state.data?.paymentConfig?.gatewayMode;

  const counts = useMemo(
    () => ({
      staff: (state.data?.teamMembers || []).filter((member) => member.role !== 'student').length,
      students: state.data?.studentCount,
    }),
    [state.data]
  );

  if (state.error) {
    return (
      <>
        <PageHeader
          eyebrow="Platform console"
          title="School"
          actions={
            <Link
              to={ROUTES.ADMIN_SCHOOLS}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All schools
            </Link>
          }
        />
        <EmptyState
          icon={Building2}
          title="This school could not be loaded"
          description={state.error.message}
          action={
            <button
              type="button"
              onClick={refresh}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              Try again
            </button>
          }
        />
      </>
    );
  }

  return (
    <>
      {/*
        The header. Not `PageHeader` with a title prop, because a school's identity is
        a logo, a name, a code and four commercial terms — none of which is a single
        string, and `PageHeader`'s `title` is exactly that. The block below keeps its
        anatomy (eyebrow, actions on the right) so the page still opens the way every
        other module opens.
      */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {school?.logo ? (
            <img
              src={school.logo}
              alt=""
              className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
            >
              <Building2 className="h-6 w-6" />
            </span>
          )}

          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <Link
                to={ROUTES.ADMIN_SCHOOLS}
                className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Schools
              </Link>
            </p>

            {state.loading && !school ? (
              <div className="mt-1.5 h-8 w-64 animate-pulse rounded-lg bg-slate-200/70" />
            ) : (
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {school?.name || 'School'}
              </h1>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {school && (
                <Badge tone={STATUS_TONES[school.status] || 'slate'} dot>
                  {school.status || 'unknown'}
                </Badge>
              )}
              <Badge tone="brand">{subscription.plan || 'no plan'}</Badge>
              <Badge tone="slate">{gatewayMode || 'no rail set'}</Badge>
              <span className="font-mono text-[11px] font-bold text-slate-400">
                {school?.schoolCode || '—'}
              </span>
              <span className="text-[12px] font-semibold text-slate-500">
                {school?.region || '—'}
                {school?.city ? ` · ${school.city}` : ''}
              </span>
              <span className="text-[12px] font-extrabold tabular-nums text-slate-600">
                {formatPercent(markup)} markup
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setImpersonateOpen(true)}
                disabled={!school}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                Impersonate
              </button>

              {school?.status === 'suspended' ? (
                <button
                  type="button"
                  onClick={confirmUnsuspend}
                  disabled={!school}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-extrabold text-ink transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  Unsuspend
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSuspendTarget(true)}
                  disabled={!school}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-extrabold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Suspend
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditOpen(true)}
                disabled={!school}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>

              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                disabled={!school || school.status === 'archived'}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-extrabold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                {school?.status === 'archived' ? 'Archived' : 'Archive'}
              </button>
            </>
          )}
        </div>
      </div>

      {readOnly && (
        <Card padding="p-3" className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-[12px] font-bold leading-relaxed text-amber-800">
            You are viewing this school as an impersonated session. Every write is refused by the
            server while the session is open, so the controls above are hidden rather than
            disabled — exit the session from the banner at the top of the console to make changes.
          </p>
        </Card>
      )}

      <ModuleTabs items={TABS} value={tab} onChange={setTab} ariaLabel="School sections" />

      {/* Only the active tab mounts. See the doc comment. */}
      {tab === 'overview' && (
        <SchoolOverviewTab
          school={school}
          record={state.data}
          onEditMarkup={readOnly ? undefined : () => setMarkupOpen(true)}
        />
      )}
      {tab === 'students' && <SchoolStudentsTab school={school} />}
      {tab === 'payments' && <SchoolPaymentsTab school={school} />}
      {tab === 'ledger' && <SchoolLedgerTab school={school} record={state.data} />}
      {tab === 'disbursements' && <SchoolDisbursementsTab school={school} />}
      {tab === 'team' && <SchoolTeamTab school={school} />}
      {tab === 'settings' && (
        <SchoolSettingsTab school={school} record={state.data} onSaved={refresh} />
      )}
      {tab === 'notes' && <SchoolNotesTab school={school} record={state.data} />}

      {/* ── Dialogs ── */}
      <EditSchoolDialog
        open={editOpen}
        school={school}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
      />

      <ArchiveSchoolDialog
        open={archiveOpen}
        school={school}
        onClose={() => setArchiveOpen(false)}
        onArchived={onArchived}
      />

      <SuspendSchoolDialog
        open={suspendTarget}
        school={school}
        counts={counts}
        onClose={() => setSuspendTarget(false)}
        onConfirm={confirmSuspend}
      />

      <MarkupEditorModal
        open={markupOpen}
        school={school}
        currentPercent={markup}
        onClose={() => setMarkupOpen(false)}
        onConfirmed={refresh}
      />

      <ImpersonateModal
        open={impersonateOpen}
        school={school}
        onClose={() => setImpersonateOpen(false)}
      />
    </>
  );
};

export default SchoolDetail;