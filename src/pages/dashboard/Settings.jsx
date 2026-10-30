import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Info,
  KeyRound,
  Lock,
  Receipt,
  Save,
  School,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import { Field, SelectField, FormAlert } from '../../components/common/FormField';
import { useAuth } from '../../context/AuthContext';
import { changePassword } from '../../services/auth';
import { useToast } from '../../hooks/useToast';
import {
  getSettings,
  updateProfile,
  updateGeneral,
  updateAcademicYear,
  updateNotifications,
  getBilling,
  SCHOOL_TYPES,
  GHANA_REGIONS,
  ACADEMIC_TERMS,
  GRADING_SYSTEMS,
  } from '../../services/settings';
import { ROUTES } from '../../utils/constants';

/** Human-readable labels for the payment gateway modes. */
const GATEWAY_LABELS = {
  moolre: 'Moolre',
  arke: 'Arkesel (disabled)',
  mnotify: 'Mnotify (disabled)',
  manual: 'Manual',
};

/**
 * The Settings module's sections, in the rail order.
 *
 * The order is by how often a school touches each one, not by how important they
 * are. The identity block is first because it is what every receipt, SMS header
 * and PDF carries, and it is the only section that changes the school's legal
 * appearance on paper. Academic calendar is second because it is the one people
 * come here deliberately to set, once a term.
 *
 * Each section declares `writable`. Three of the seven are not, and the reason
 * is on the section itself — see `services/settings.js` for which endpoints
 * exist. A disabled control with a stated reason is a fact; a disabled control
 * with no reason is a bug report waiting to happen.
 */
const SECTIONS = [
  {
    id: 'profile',
    label: 'School Profile',
    blurb: 'Legal name, classification, address and branding.',
    icon: Building2,
    writable: true,
  },
  {
    id: 'payment',
    label: 'Payment Gateway',
    blurb: 'MoMo collection mode, platform markup and enabled networks.',
    icon: CreditCard,
    writable: false,
    reason:
      'Read-only. The gateway mode, platform markup and network switches are returned by the API but no endpoint writes them yet — they are platform-level configuration, not school-level.',
  },
  {
    id: 'sms',
    label: 'SMS & Sender ID',
    blurb: 'Messaging provider, registered sender ID and credit balance.',
    icon: Smartphone,
    writable: false,
    reason:
      'Read-only. Provider and sender ID are served by the API but nothing writes them from Settings; the balance changes as messages are sent.',
  },
  {
    id: 'academic',
    label: 'Academic Calendar',
    blurb: 'Current year, active term, class list and grading system.',
    icon: CalendarClock,
    writable: true,
  },
  {
    id: 'notifications',
    label: 'Notification Preferences',
    blurb: 'What the school is told about, and over which channel.',
    icon: Bell,
    writable: true,
  },
  {
    id: 'billing',
    label: 'Fees & Billing Structure',
    blurb: 'Subscription plan, usage this period and the next invoice.',
    icon: Receipt,
    writable: false,
    reason:
      'Read-only. Subscription changes are made through billing, not from Settings. Invoices are not yet issued by this system — the API returns an empty list.',
  },
  {
    id: 'security',
    label: 'Security & Compliance',
    blurb: 'Who can sign in, and what has been done.',
    icon: ShieldCheck,
    writable: false,
    reason:
      'Nothing to configure here. Roles and access live in their own module, and the record of who did what lives in the Activity Log.',
  },
  {
    id: 'account',
    label: 'Account',
    blurb: 'Your email and password.',
    icon: KeyRound,
    writable: true,
  },
];
/** The read-only banner. Present on every non-writable section. */
const ReadOnlyNotice = ({ reason }) => (
  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    <p className="text-[12px]/[18px] font-medium text-slate-600">
      <span className="font-extrabold text-slate-700">Read-only.</span> {reason}
    </p>
  </div>
);

/** A label/value row, for the regions with no form control. */
const DetailRow = ({ label, children, hint }) => (
  <div className="border-b border-slate-100 py-2.5 last:border-0">
    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
    <div className="mt-1 text-[13px]/[19px] font-semibold text-ink">{children}</div>
    {hint && <p className="mt-0.5 text-[11px] font-medium text-slate-400">{hint}</p>}
  </div>
);

/**
 * The Settings module.
 *
 * Only the role-gated module in the rail (see `DASHBOARD_NAV`), because it holds
 * the school's academic year and gateway mode. A teacher or a bursar is not
 * offered a page of controls that would 403 — and the server's `authorize` is the
 * boundary regardless; hiding the nav entry is presentation only.
 *
 * The section lives in the query string (`?section=academic`) rather than in
 * component state, for the reason it is a query string everywhere else in this
 * dashboard: a bursar who wants a colleague to look at the term configuration
 * has to be able to send a link that lands on it, and Back has to walk the
 * sections.
 */
const Settings = () => {
  const { user } = useAuth();
  const toast = useToast();
  const schoolId = user?.schoolId;

  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('section') || 'profile';

  const [settings, setSettings] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0];

  const [profile, setProfile] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [academic, setAcademic] = useState({});
  const [notifications, setNotifications] = useState({});

  // ── Load ──
  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setLoadError(
        new Error('Your account is not linked to a school yet, so there are no settings to show.')
      );
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [nextSettings, nextBilling] = await Promise.all([
        getSettings(schoolId),
        getBilling(schoolId).catch(() => null),
      ]);
      setSettings(nextSettings);
      setBilling(nextBilling);
      setProfile({
        name: nextSettings.profile?.name || '',
        type: nextSettings.profile?.type || '',
        motto: nextSettings.profile?.motto || '',
        yearFounded: nextSettings.profile?.yearFounded ?? '',
        phone: nextSettings.profile?.phone || '',
        email: nextSettings.profile?.email || '',
        website: nextSettings.profile?.website || '',
        address: nextSettings.profile?.address || '',
        city: nextSettings.profile?.city || '',
        region: nextSettings.profile?.region || '',
        gpsAddress: nextSettings.profile?.gpsAddress || '',
      });
      setAcademic({
        currentYear: nextSettings.academic?.currentYear || '',
        currentTerm: nextSettings.academic?.currentTerm || '',
        termsPerYear: nextSettings.academic?.termsPerYear ?? 3,
        classes: (nextSettings.academic?.classes || []).join(', '),
        gradingSystem: nextSettings.academic?.gradingSystem || 'WAEC',
      });
      setNotifications({
        email: nextSettings.notifications?.email !== false,
        sms: nextSettings.notifications?.sms !== false,
        inApp: nextSettings.notifications?.inApp !== false,
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
    if (id === 'profile') next.delete('section');
    else next.set('section', id);
    setSearchParams(next, { replace: true });
    setErrors({});
    setFormError(null);
  };

  // ── Saves ──
  /**
   * Only the fields that actually changed go on the wire.
   *
   * Both schemas are `.min(1)` so an empty body is rejected, but sending the
   * whole form regardless would rewrite every field — including ones this
   * section is not even responsible for — on every save. A diff keeps the write
   * to what the admin touched, which is what they expect a Save button to do.
   */
  const diff = (current, original) => {
    const patch = {};
    Object.entries(current).forEach(([key, value]) => {
      if (value !== original[key]) patch[key] = value;
    });
    return patch;
  };

  const saveProfile = async () => {
    const original = {
      name: settings?.profile?.name || '',
      type: settings?.profile?.type || '',
      motto: settings?.profile?.motto || '',
      yearFounded: settings?.profile?.yearFounded ?? '',
      phone: settings?.profile?.phone || '',
      email: settings?.profile?.email || '',
      website: settings?.profile?.website || '',
      address: settings?.profile?.address || '',
      city: settings?.profile?.city || '',
      region: settings?.profile?.region || '',
      gpsAddress: settings?.profile?.gpsAddress || '',
    };

    const nextErrors = {};
    if (profile.name.trim().length < 2) nextErrors.name = 'Enter the school’s legal name.';
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const patch = diff(profile, original);
    if (!Object.keys(patch).length) {
      toast.info('Nothing to save — no changes were made.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await updateProfile(schoolId, patch);
      toast.success('School profile saved.');
      await load();
    } catch (error) {
      setFormError(error.message);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * The academic year, confirmed rather than written quietly.
   *
   * `window.confirm` and not a custom dialog on purpose: this is the one save
   * that re-bases every report, plan and due date in the system, and the native
   * prompt is the one confirmation a user cannot scroll past or mistake for the
   * rest of the page.
   */
  const saveAcademic = async () => {
    const nextErrors = {};
    if (!/^\d{4}\/\d{4}$/.test(academic.currentYear)) {
      nextErrors.currentYear = 'Use the form 2025/2026 — the second year must be the first plus one.';
    } else {
      const [start] = academic.currentYear.split('/');
      if (Number(academic.currentYear.split('/')[1]) !== Number(start) + 1) {
        nextErrors.currentYear = 'The two years must be consecutive, e.g. 2025/2026.';
      }
    }
    if (!ACADEMIC_TERMS.includes(academic.currentTerm)) {
      nextErrors.currentTerm = 'Choose Term 1, 2 or 3.';
    }
    if (!academic.classes.trim()) {
      nextErrors.classes = 'List at least one class — the roster and every report filter read this.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const confirmed = window.confirm(
      `Set the school to ${academic.currentYear}, ${academic.currentTerm}?\n\n` +
        'Every report, payment plan and fee deadline is measured against this. Bills already ' +
        'issued for the previous term are not moved by this change.'
    );
    if (!confirmed) return;

    const classes = academic.classes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    setSaving(true);
    setFormError(null);
    try {
      // Two endpoints, because that is how the backend is split: the year and
      // term have their own schema with both fields required, while the class
      // list and grading system are ordinary "general" settings.
      await updateAcademicYear(schoolId, {
        currentYear: academic.currentYear,
        currentTerm: academic.currentTerm,
        termsPerYear: Number(academic.termsPerYear) || 3,
      });
      await updateGeneral(schoolId, {
        classes,
        gradingSystem: academic.gradingSystem,
        termsPerYear: Number(academic.termsPerYear) || 3,
      });
      toast.success('Academic calendar saved.');
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
      toast.success('Notification preferences saved.');
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
    // The settings GET does not carry an updatedAt, and inventing one from the
    // data's contents would be a worse lie than showing nothing.
    return null;
  }, [settings]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Settings & Institution Profile" />
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-1/3 rounded bg-slate-200/70" />
            <div className="h-4 w-2/3 rounded bg-slate-200/70" />
            <div className="h-32 rounded bg-slate-200/70" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings & Institution Profile"
        description="Manage school credentials, the academic calendar, notification preferences and subscription."
      />

      {loadError && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
          {loadError.message}
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* The section rail. A tab list, so `aria-current` is meaningful and the
            active section is reachable by keyboard. */}
        <nav
          aria-label="Settings sections"
          className="shrink-0 lg:w-[260px]"
        >
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((item) => {
              const isActive = item.id === section.id;
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => selectSection(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition-colors ${
                      isActive
                        ? 'bg-brand-700 text-white shadow-lift'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {!item.writable && (
                      <Lock
                        className={`h-3 w-3 shrink-0 ${isActive ? 'text-white/70' : 'text-slate-300'}`}
                        aria-label="Read-only section"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          {!section.writable && <ReadOnlyNotice reason={section.reason} />}

          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {/* ── School Profile ── */}
           {section.id === 'profile' && settings && (
             <>
               {user?.role === 'accountant' && (
                 <ReadOnlyNotice reason="School profile is managed by the school administrator." />
               )}
               <Card>
                <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
                <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

                {/* The seal and logo. Read-only for anyone who is not a
                    super admin — the stamp upload route is `authorize("super_admin")`,
                    so offering the button to a school admin would guarantee a 403. */}
                <div className="mt-5 flex flex-wrap items-center gap-5 rounded-xl bg-slate-50 p-4">
                  {settings.profile.logo ? (
                    <img
                      src={settings.profile.logo}
                      alt="School logo"
                      className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-contain p-1"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-300">
                      <School className="h-7 w-7" aria-hidden="true" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold text-ink">Logo &amp; digital stamp</p>
                    <p className="mt-0.5 text-[12px]/[17px] font-medium text-slate-500">
                      Printed on parent payment receipts and SMS headers.
                      {settings.profile.stamp ? ' A digital stamp is on file.' : ' No digital stamp is on file.'}
                    </p>
                  </div>

                  {user?.role === 'super_admin' ? (
                    <Badge tone="blue">Uploads require platform admin</Badge>
                  ) : (
                    <Badge tone="slate">Read-only for school admins</Badge>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="School legal name"
                    required
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    error={errors.name}
                  />
                  <SelectField
                    label="School type / tier"
                    value={profile.type}
                    onChange={(e) => setProfile({ ...profile, type: e.target.value })}
                  >
                    {SCHOOL_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>

                  <Field
                    label="Official institutional email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    error={errors.email}
                  />
                  <Field
                    label="Institutional phone number"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    hint="Ghana format — 024xxxxxxx or 23324xxxxxxx"
                  />

                  <div className="sm:col-span-2">
                    <Field
                      label="Physical campus address"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    />
                  </div>

                  <Field
                    label="City"
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  />
                  <SelectField
                    label="Region"
                    value={profile.region}
                    onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                  >
                    <option value="">Select a region</option>
                    {GHANA_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </SelectField>

                  <Field
                    label="Digital address (GhanaPost GPS)"
                    value={profile.gpsAddress}
                    onChange={(e) => setProfile({ ...profile, gpsAddress: e.target.value })}
                    hint="Geo-verified code, e.g. GA-492-1082"
                  />
                  <Field
                    label="Website URL"
                    type="url"
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    hint="Optional"
                  />

                  <div className="sm:col-span-2">
                    <Field
                      label="School motto"
                      value={profile.motto}
                      onChange={(e) => setProfile({ ...profile, motto: e.target.value })}
                      hint="Optional"
                    />
                  </div>

                  <Field
                    label="Year founded"
                    type="number"
                    value={profile.yearFounded}
                    onChange={(e) => setProfile({ ...profile, yearFounded: e.target.value })}
                    hint="Optional"
                  />
                </div>

                {user?.role !== 'accountant' && (
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      {saving ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                )}
              </Card>

              {/*
                Not rendered at all, and the reason is worth stating once: the
                design shows a GES/GAR/EMIS registration code, a GRA TIN and a DPC
                certificate number. None of those are fields on the School model,
                and there is nowhere to store or read them — so a "Verified" badge
                beside an empty box would be a compliance claim the system cannot
                substantiate.
              */}
            </>
          )}

          {/* ── Payment Gateway ── */}
          {section.id === 'payment' && settings && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              <div className="mt-4">
                <DetailRow label="Collection gateway">
                  {GATEWAY_LABELS[settings.payment?.gatewayMode] || settings.payment?.gatewayMode || 'Moolre'}
                </DetailRow>
                <DetailRow label="Platform markup">
                  {`${settings.payment?.platformMarkupPercent ?? 0}%`}
                  <span className="ml-1 text-[11px] font-medium text-slate-400">on each collection</span>
                </DetailRow>
                <DetailRow label="Networks enabled">
                  <span className="flex flex-wrap gap-1.5">
                    {Object.entries(settings.payment?.networksEnabled || {}).map(([network, enabled]) => (
                      <Badge key={network} tone={enabled ? 'green' : 'slate'}>
                        {network}
                        {enabled ? '' : ' (off)'}
                      </Badge>
                    ))}
                  </span>
                </DetailRow>
              </div>

              <p className="mt-4 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Collections run on SukuuPay's own Moolre account, so a school never
                  holds gateway credentials. What a school sets here is the markup
                  SukuuPay adds on each collection and the networks it accepts.
                </span>
              </p>
            </Card>
          )}

          {/* ── SMS & Sender ID ── */}
          {section.id === 'sms' && settings && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              <div className="mt-4">
                <DetailRow label="Provider">{settings.sms?.provider || 'moolre'}</DetailRow>
                <DetailRow label="Registered sender ID">
                  {settings.sms?.senderId ? (
                    <span className="font-mono">{settings.sms.senderId}</span>
                  ) : (
                    <span className="text-slate-400">Not registered</span>
                  )}
                </DetailRow>
                <DetailRow label="Credit balance">
                  {`${(settings.sms?.balance ?? 0).toLocaleString('en-GB')} credits`}
                </DetailRow>
              </div>
            </Card>
          )}

          {/* ── Academic Calendar ── */}
          {section.id === 'academic' && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                <span className="text-[11px] font-extrabold text-amber-800">
                  {academic.currentYear || 'No year set'} · {academic.currentTerm || 'No term set'}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label="Current academic year"
                  required
                  placeholder="2025/2026"
                  value={academic.currentYear}
                  onChange={(e) => setAcademic({ ...academic, currentYear: e.target.value })}
                  error={errors.currentYear}
                  hint="Two consecutive years"
                />
                <SelectField
                  label="Active academic term"
                  required
                  value={academic.currentTerm}
                  onChange={(e) => setAcademic({ ...academic, currentTerm: e.target.value })}
                  error={errors.currentTerm}
                >
                  {ACADEMIC_TERMS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </SelectField>
                <Field
                  label="Terms per year"
                  type="number"
                  min="1"
                  max="4"
                  value={academic.termsPerYear}
                  onChange={(e) => setAcademic({ ...academic, termsPerYear: e.target.value })}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Classes"
                  required
                  value={academic.classes}
                  onChange={(e) => setAcademic({ ...academic, classes: e.target.value })}
                  error={errors.classes}
                  hint="Comma-separated. The roster and every report filter read this list."
                />
                <SelectField
                  label="Grading system"
                  value={academic.gradingSystem}
                  onChange={(e) => setAcademic({ ...academic, gradingSystem: e.target.value })}
                >
                  {GRADING_SYSTEMS.map((system) => (
                    <option key={system} value={system}>
                      {system}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="text-[12px]/[18px] font-medium text-amber-900">
                  Changing the term re-bases every report, payment plan and fee deadline in the
                  system. Bills already issued for the previous term are not moved. You will be
                  asked to confirm.
                </p>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={saveAcademic}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save academic calendar'}
                </button>
              </div>
            </Card>
          )}

          {/* ── Notification Preferences ── */}
          {section.id === 'notifications' && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              <div className="mt-5 space-y-3">
                {[
                  { key: 'email', label: 'Email notifications', hint: 'Collections, arrears and system notices.' },
                  { key: 'sms', label: 'SMS notifications', hint: 'Charged against your credit balance.' },
                  { key: 'inApp', label: 'In-app notifications', hint: 'The bell in the dashboard header.' },
                ].map((pref) => (
                  <label
                    key={pref.key}
                    className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-extrabold text-ink">{pref.label}</span>
                      <span className="mt-0.5 block text-[12px]/[17px] font-medium text-slate-500">
                        {pref.hint}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={notifications[pref.key]}
                      onChange={(event) =>
                        setNotifications({ ...notifications, [pref.key]: event.target.checked })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={saveNotifications}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save preferences'}
                </button>
              </div>
            </Card>
          )}

          {/* ── Fees & Billing ── */}
          {section.id === 'billing' && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              {!billing ? (
                <p className="mt-4 text-[13px] font-medium text-slate-500">Billing is unavailable.</p>
              ) : (
                <div className="mt-4">
                  <DetailRow label="Plan">
                    <span className="capitalize">{billing.subscription?.plan}</span>
                    <Badge tone={billing.subscription?.status === 'active' ? 'green' : 'amber'} className="ml-2">
                      {billing.subscription?.status}
                    </Badge>
                  </DetailRow>
                  <DetailRow label="Monthly fee">{billing.subscription?.monthlyFee ?? 0} pesewas</DetailRow>
                  <DetailRow label="Current period">
                    {billing.subscription?.currentPeriodStart
                      ? `${new Date(billing.subscription.currentPeriodStart).toLocaleDateString('en-GB')} – ${new Date(
                          billing.subscription.currentPeriodEnd
                        ).toLocaleDateString('en-GB')}`
                      : 'Not set'}
                  </DetailRow>
                  <DetailRow label="Enrolled students">{billing.usage?.studentsThisTerm ?? 0}</DetailRow>
                  <DetailRow label="SMS sent this month">
                    {`${(billing.usage?.smsSentThisMonth ?? 0).toLocaleString('en-GB')} of ${
                      (billing.usage?.smsCreditsRemaining ?? 0).toLocaleString('en-GB')
                    } credits remaining`}
                  </DetailRow>
                  <DetailRow label="Next invoice">
                    {billing.nextInvoice?.dueDate
                      ? `${billing.nextInvoice.amount} pesewas, due ${new Date(
                          billing.nextInvoice.dueDate
                        ).toLocaleDateString('en-GB')}`
                      : 'No invoice scheduled'}
                  </DetailRow>
                </div>
              )}

              {/*
                The invoice history is a hard `[]` in the service and storage is a
                hard `0`. Both are shown as explicitly unavailable rather than as
                an empty table, because an empty invoice list reads as "you have
                never been billed" rather than "this system does not issue
                invoices yet".
              */}
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[12px]/[18px] font-medium text-slate-500">
                  <span className="font-extrabold text-slate-700">Invoice history is not available.</span>{' '}
                  This system does not issue invoices yet — the API returns an empty list, so there
                  is nothing to show. Storage usage is likewise reported as zero because no figure
                  is collected.
                </p>
              </div>
            </Card>
          )}

          {/* ── Security & Compliance ── */}
          {section.id === 'security' && (
            <Card>
              <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  to={ROUTES.DASHBOARD_USERS}
                  className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-ink">Team &amp; permissions</p>
                      <p className="mt-0.5 text-[12px]/[17px] font-medium text-slate-500">
                        Who can sign in to this school, what each role can do, and who is still on a
                        default password.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to={ROUTES.DASHBOARD_ACTIVITY}
                  className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-ink">Audit trail</p>
                      <p className="mt-0.5 text-[12px]/[17px] font-medium text-slate-500">
                        Every administrative action taken on this school, filterable by actor, action
                        and date, and exportable as CSV.
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  to={`/reset-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ''}`}
                  className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-ink">Change your password</p>
                      <p className="mt-0.5 text-[12px]/[17px] font-medium text-slate-500">
                        Request a secure reset link by email. All other sessions are signed out when
                        it is used.
                      </p>
                    </div>
                  </div>
                </Link>
              </div>

              <p className="mt-5 flex items-start gap-2 text-[11px]/[16px] font-medium text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  Session and password controls live on each person’s own account, and password
                  resets are done by request rather than by an administrator — so no administrator
                  can read or set a colleague’s current password.
                </span>
              </p>
            </Card>
          )}

           {/* ── Account ── */}
           {section.id === 'account' && (
             <Card>
               <h2 className="text-base font-extrabold text-ink">{section.label}</h2>
               <p className="mt-0.5 text-[13px] font-medium text-slate-500">{section.blurb}</p>
               <div className="mt-4">
                 <DetailRow label="Email">{user?.email || '—'}</DetailRow>
               </div>
               <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                 <Field label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                 <Field label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
               </div>
               <div className="mt-5 flex justify-end">
                 <button
                   type="button"
                   onClick={async () => {
                     if (!newPassword || newPassword !== confirmPassword) {
                       toast.error('Passwords do not match.');
                       return;
                     }
                     try {
                       await changePassword(newPassword);
                       toast.success('Password updated.');
                       setNewPassword('');
                       setConfirmPassword('');
                     } catch (error) {
                       toast.error(error.message);
                     }
                   }}
                   className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:opacity-50"
                 >
                   <Save className="h-4 w-4" aria-hidden="true" />
                   Change password
                 </button>
               </div>
               <p className="mt-3 text-[11px] font-medium text-slate-500">
                 Password change is applied directly without email verification.
               </p>
             </Card>
           )}

           {lastModified && (
            <p className="text-[11px] font-medium text-slate-400">Last modified {lastModified}</p>
          )}
        </div>
      </div>
    </>
  );
};

export default Settings;
