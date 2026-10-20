import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Info,
  RotateCcw,
  Save,
  ServerCog,
  ShieldAlert,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import Modal from '../../../components/common/Modal';
import MoneyInput from '../../../components/common/MoneyInput';
import { Field, SelectField, FormAlert } from '../../../components/common/FormField';
import { useToast } from '../../../hooks/useToast';
import {
  setPlatformSettingsCache,
  usePlatformSettingsControls,
} from '../../../hooks/usePlatformSettings';
import {
  getDashboardKpis,
  getPlatformSmsBalance,
  updateCommission,
  updateDisbursementSettings,
  updatePlatformSettings,
} from '../../../services/admin';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * Platform settings: five sections, five buttons, five different decisions.
 *
 * **The hook's own `save()` is deliberately not called, and that is the most important
 * structural decision on this page.**
 *
 * `usePlatformSettingsControls` is built around one whole-document write: its `save()`
 * posts the entire draft to `PUT /admin/settings` and adopts the response as the new
 * `lastSaved`. That is correct for a page whose every field goes to the same endpoint, and
 * it is wrong here for two of the five sections, because commission and disbursement have
 * their own endpoints (`PUT /admin/settings/commission` and
 * `/admin/settings/disbursement`) and their own semantics.
 *
 * If this page used `save()`, the sequence "change the markup, save; approve a schedule,
 * save" would put the *old* markup back on the disbursement save, because the draft is a
 * single document and two of its branches are owned by other endpoints. `autoApprove` would
 * survive by luck and the markup would not. So the page keeps its own pristine snapshot,
 * builds a patch per section, and writes each section through the endpoint that owns it.
 * It still uses the hook for the read, the draft, the setter and the loading/error state —
 * and `src/hooks/usePlatformSettings.js` is the only place settings are fetched.
 *
 * **Why separate buttons, given the endpoint already separates them.** "Save settings" and
 * "change what we earn" are different decisions, and a single button over a page holding
 * five of them would let one press commit four unrelated changes — including a percentage
 * the operator did not mean to touch. The server makes them separate for the same reason
 * (`admin.validation.js:119-144`), and the buttons follow the endpoints rather than
 * flattening them.
 *
 * Three of the five need a confirmed dialog, and each names what it actually does:
 *
 *   - **`disbursement.autoApprove`.** The most consequential boolean in this product. It is
 *     the difference between a payout run needing one human click and money leaving the
 *     platform unattended, it defaults off
 *     (`Backend/src/models/PlatformSettings.js:108-131`), and turning it on is an explicit
 *     act by the owner. It therefore is not a checkbox next to a Save button; it is a
 *     switch that opens a dialog saying that sentence, with the word "unattended" in it.
 *
 *   - **`maintenance.mode`.** Three states, not degrees of one thing — `off`, `readonly`
 *     (every page loads, every write is refused) and `on` (reads refused too). A generic
 *     "are you sure?" treats them alike, so the dialog quotes the chosen mode's own
 *     description instead of asking generically.
 *
 *   - **Commission.** Not because either percentage is dangerous in isolation but because
 *     it is money *in*: it decides what SukuuPay takes from every school provisioned from
 *     now on. Existing schools keep their own rate, which the dialog says, so nobody reads
 *     it as a retroactive repricing.
 *
 * `maintenance` appears on this page **and** on the Health screen, deliberately. The
 * operator who is looking at settings should not have to know that another screen holds the
 * switch; the duplication is two entry points to one stored value, not two sources of
 * truth. The Health screen's version posts `POST /admin/health/maintenance-mode`, which
 * cannot reach `on` at all — that path maps `enabled: true` onto `readonly`
 * (`health.service.js:942-949`) because a kill switch should not be one click away from a
 * thumb during a deploy. This page's version writes `maintenance.mode` directly and can
 * therefore set `on`, deliberately, having said what that does. That asymmetry is the
 * point of having both, and it is why the dialogs here name the state instead of saying
 * "turn maintenance on".
 */

const MAINTENANCE_MODES = [
  {
    value: 'off',
    label: 'Off',
    blurb: 'Everything works normally. Reads and writes both answer.',
  },
  {
    value: 'readonly',
    label: 'Read-only',
    blurb:
      'Every page still loads; every write is refused — payments, imports, roster changes and settings. This is the safe state for a schema migration.',
  },
  {
    value: 'on',
    label: 'Fully down',
    blurb:
      'The API refuses reads as well as writes. Nobody can sign in, including you. Only for a release that must not serve traffic at all.',
  },
];

const DISBURSEMENT_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
];

/** `dayOfWeek` is `Date#getDay`: 0 = Sunday … 6 = Saturday (`PlatformSettings.js:120-130`). */
const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const Toggle = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? 'bg-brand-700' : 'bg-slate-300'
    }`}
  >
    <span
      aria-hidden="true"
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const Row = ({ label, hint, value }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-50 py-3 last:border-0">
    <div className="min-w-0">
      <p className="text-[13px] font-extrabold text-ink">{label}</p>
      {hint && <p className="text-[11px] font-semibold text-slate-400">{hint}</p>}
    </div>
    <p className="shrink-0 text-[13px] font-extrabold tabular-nums text-ink">{value}</p>
  </div>
);

/**
 * The confirmation dialog shared by the three consequential writes.
 *
 * `onConfirm` returns `{ ok, error }` and never throws, so a failure leaves this open with
 * the operator's typed input intact — the console's convention, and the reason a failed
 * `autoApprove` does not close over the switch that was left on.
 */
const ConfirmDialog = ({ open, title, description, bullets = [], confirmLabel, tone = 'brand', onClose, onConfirm }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSaving(false);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await onConfirm();
    setSaving(false);
    if (result?.ok) {
      onClose();
      return;
    }
    setError(result?.error || 'That change could not be saved.');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-700/40'
                : tone === 'amber'
                  ? 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-700/40'
                  : 'bg-brand-700 hover:bg-brand-800'
            }`}
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      {bullets.length > 0 && (
        <ul className="space-y-2">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-[12px]/[19px] font-semibold text-slate-600"
            >
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

/** The Save button a section owns. Disabled until that section differs from the server. */
const SectionSave = ({ dirty, saving, onClick, label, pending }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!dirty || saving}
    title={dirty ? undefined : 'Nothing in this section has changed'}
    className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
  >
    <Save className="h-4 w-4" aria-hidden="true" />
    {pending ? 'Saving…' : label}
  </button>
);

const PlatformSettings = () => {
  const toast = useToast();
  const { draft, set, loading, error } = usePlatformSettingsControls();

  /*
    The pristine snapshot.

    The hook keeps its own `lastSaved`, but it is only reachable through `save()` — which
    this page does not call, for the reason in the module comment — and through `reset()`,
    which would also discard the operator's edits. So the last-known-good document is held
    here and replaced after every successful write. Every section's "is this dirty" is
    computed against it, which is what makes a field the operator changed and changed back
    report clean rather than leaving a permanently-enabled Save button.
  */
  const savedRef = useRef(null);

  const [pending, setPending] = useState(null);
  const [sectionError, setSectionError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [standing, setStanding] = useState({ kpis: null, sms: null });

  // Seeded once, and never again mid-edit. Re-seeding from a background refetch would
  // silently discard whatever the operator had typed — the failure mode where a settings
  // page appears to "forget" an edit.
  useEffect(() => {
    if (draft && !savedRef.current) savedRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let active = true;
    // Two calls, not a `Promise.all`: the standing figures are context on this page and a
    // failure of theirs must not blank the settings form, which is why anybody came here.
    getDashboardKpis()
      .then((kpis) => active && setStanding((current) => ({ ...current, kpis })))
      .catch(() => active && setStanding((current) => ({ ...current, kpis: null })));
    getPlatformSmsBalance()
      .then((sms) => active && setStanding((current) => ({ ...current, sms })))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const saved = savedRef.current;

  /** Has anything in `section` of the draft moved away from the server's copy? */
  const dirtyFor = useCallback(
    (section, pick) => {
      if (!draft || !saved) return false;
      return JSON.stringify(pick(draft)) !== JSON.stringify(pick(saved));
    },
    [draft, saved]
  );

  /**
   * One section write, shared by the three endpoints.
   *
   * On success it does three things in order, and the order matters:
   * `savedRef` is updated first (so this section immediately reports clean), then the
   * hook's draft is replaced (so a later section's patch is built from the new truth), then
   * the shared cache is published (so any other console screen reading `support.phone`
   * re-renders with the new value instead of showing the old one until a reload).
   *
   * Returns `{ ok, error }` and never throws, so every caller can keep its dialog open
   * with the operator's input intact.
   */
  const commit = useCallback(
    async (section, call) => {
      setPending(section);
      setSectionError(null);
      try {
        const result = await call();
        const merged = { ...draft, ...result };
        savedRef.current = merged;
        set(() => merged);
        setPlatformSettingsCache(merged);
        return { ok: true, result };
      } catch (writeError) {
        const message = writeError?.message || 'Those settings could not be saved.';
        setSectionError({ section, message });
        return { ok: false, error: message };
      } finally {
        setPending(null);
      }
    },
    [draft]
  );

  const saveDefaults = useCallback(
    () =>
      commit('defaults', () =>
        updatePlatformSettings({
          defaultMonthlyFee: draft.defaultMonthlyFee,
          features: {
            adsEnabled: draft.features?.adsEnabled,
            selfSignupEnabled: draft.features?.selfSignupEnabled,
            trialDays: draft.features?.trialDays,
          },
        })
      ),
    [commit, draft]
  );

  const saveCommission = useCallback(
    () =>
      commit('commission', () =>
        updateCommission({
          defaultMarkupPercent: Number(draft.defaultMarkupPercent),
          defaultPlatformFeePercent: Number(draft.defaultPlatformFeePercent),
        })
      ),
    [commit, draft]
  );

  const saveSms = useCallback(
    () =>
      commit('sms', () =>
        updatePlatformSettings({
          sms: { provider: draft.sms?.provider, ratePesewas: Number(draft.sms?.ratePesewas) },
        })
      ),
    [commit, draft]
  );

  const saveSupport = useCallback(
    () =>
      commit('support', () =>
        updatePlatformSettings({
          support: { phone: draft.support?.phone, email: draft.support?.email },
        })
      ),
    [commit, draft]
  );

  const saveMaintenance = useCallback(
    () =>
      commit('maintenance', () =>
        updatePlatformSettings({
          maintenance: {
            mode: draft.maintenance?.mode,
            message: draft.maintenance?.message || '',
          },
        })
      ),
    [commit, draft]
  );

  const saveDisbursement = useCallback(
    () =>
      commit('disbursement', () =>
        updateDisbursementSettings({
          frequency: draft.disbursement?.frequency,
          dayOfWeek: Number(draft.disbursement?.dayOfWeek),
          autoApprove: Boolean(draft.disbursement?.autoApprove),
        })
      ),
    [commit, draft]
  );

  const defaultsDirty = dirtyFor('defaults', (d) => ({
    defaultMonthlyFee: d.defaultMonthlyFee,
    features: d.features,
  }));
  const commissionDirty = dirtyFor('commission', (d) => ({
    defaultMarkupPercent: d.defaultMarkupPercent,
    defaultPlatformFeePercent: d.defaultPlatformFeePercent,
  }));
  const smsDirty = dirtyFor('sms', (d) => d.sms);
  const supportDirty = dirtyFor('support', (d) => d.support);
  const maintenanceDirty = dirtyFor('maintenance', (d) => d.maintenance);
  const disbursementDirty = dirtyFor('disbursement', (d) => d.disbursement);

  const anyDirty =
    defaultsDirty || commissionDirty || smsDirty || supportDirty || maintenanceDirty || disbursementDirty;

  const autoApproveNext = Boolean(draft?.disbursement?.autoApprove);
  const maintenanceMode = draft?.maintenance?.mode || 'off';
  const maintenanceModeInfo = MAINTENANCE_MODES.find((mode) => mode.value === maintenanceMode);

  const schools = standing.kpis?.schools || {};
  const payments = standing.kpis?.payments || {};
  const smsBalance = standing.sms || {};

  const commissionDiff = useMemo(() => {
    if (!draft || !saved) return [];
    return [
      { label: 'defaultMarkupPercent', before: saved.defaultMarkupPercent, next: draft.defaultMarkupPercent },
      {
        label: 'defaultPlatformFeePercent',
        before: saved.defaultPlatformFeePercent,
        next: draft.defaultPlatformFeePercent,
      },
    ];
  }, [draft, saved]);

  const maintenanceDiff = useMemo(() => {
    if (!draft || !saved) return null;
    return {
      from: saved.maintenance?.mode || 'off',
      to: draft.maintenance?.mode || 'off',
      message: draft.maintenance?.message || '',
    };
  }, [draft, saved]);

  if (loading && !draft) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Settings" />
        <div className="space-y-4">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </>
    );
  }

  if (error && !draft) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Settings" />
        <EmptyState
          icon={ServerCog}
          title="Platform settings could not be loaded"
          description={
            error.message ||
            'The request did not complete. A page that cannot read its own defaults is not a page anybody should submit from, so nothing is editable here.'
          }
        />
      </>
    );
  }

  if (!draft) return null;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Settings"
        description="Configuration for SukuuPay itself — not for any one school. Every change is recorded in the audit log."
        actions={
          anyDirty ? (
            <Badge tone="amber" icon={TriangleAlert}>
              Unsaved changes in{' '}
              {
                [
                  defaultsDirty && 'defaults',
                  commissionDirty && 'commission',
                  disbursementDirty && 'disbursement',
                  smsDirty && 'SMS',
                  supportDirty && 'support',
                  maintenanceDirty && 'maintenance',
                ]
                  .filter(Boolean)
                  .join(', ')
              }
            </Badge>
          ) : null
        }
      />

      {sectionError && (
        <div className="mb-4">
          <FormAlert tone="error">
            {`${sectionError.section}: ${sectionError.message}`}
          </FormAlert>
        </div>
      )}

      {/* ── Defaults ── */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Defaults for a new school</h2>
            <p className="mt-0.5 text-[11px]/[17px] font-semibold text-slate-500">
              What a newly provisioned school is given. Existing schools keep the rate and
              fee they already have — this never rewrites a live school.
            </p>
          </div>
          <SectionSave
            dirty={defaultsDirty}
            saving={pending === 'defaults'}
            onClick={saveDefaults}
            label="Save defaults"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Trial length"
            type="number"
            min={0}
            max={365}
            value={draft.features?.trialDays ?? 30}
            onChange={(event) =>
              set((current) => ({
                ...current,
                features: { ...current.features, trialDays: Number(event.target.value) },
              }))
            }
            hint="days"
          />
          <MoneyInput
            label="Monthly subscription fee"
            value={draft.defaultMonthlyFee ?? 15000}
            onChange={(value) => set((current) => ({ ...current, defaultMonthlyFee: value ?? 0 }))}
            hint="integer pesewas"
          />

          <div className="space-y-3 sm:col-span-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-ink">Public creative slider</p>
                <p className="text-[11px]/[16px] font-semibold text-slate-500">
                  Schools&rsquo; creatives on the sign-in and sign-up pages.
                </p>
              </div>
              <Toggle
                label="Public creative slider"
                checked={draft.features?.adsEnabled !== false}
                onChange={(adsEnabled) =>
                  set((current) => ({ ...current, features: { ...current.features, adsEnabled } }))
                }
              />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-ink">Self-signup</p>
                <p className="text-[11px]/[16px] font-semibold text-slate-500">
                  Whether an account can be created without an invitation.
                </p>
              </div>
              <Toggle
                label="Self-signup"
                checked={draft.features?.selfSignupEnabled !== false}
                onChange={(selfSignupEnabled) =>
                  set((current) => ({
                    ...current,
                    features: { ...current.features, selfSignupEnabled },
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/*
          Commission, inside Defaults and saved on its own.

          Markup and platform fee decide what SukuuPay *takes*, which is a different kind of
          decision from "how long is a trial" — it is money in, it applies to every school
          provisioned from now on, and the server gave it its own endpoint for exactly that
          reason (`admin.validation.js:119-130`). Putting it here keeps the two percentages
          next to the defaults a reader is comparing them against, while the separate button
          and the confirmation keep them from being committed by accident alongside a trial
          length.
        */}
        <div className="mt-5 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13px] font-extrabold text-ink">What SukuuPay takes</h3>
              <p className="mt-0.5 max-w-xl text-[11px]/[17px] font-semibold text-slate-500">
                Saved through its own endpoint and confirmed separately, because changing
                what the platform earns is a different decision from saving a default. A school
                already on the platform keeps the rate it has.
              </p>
            </div>
            <SectionSave
              dirty={commissionDirty}
              saving={pending === 'commission'}
              onClick={() => setConfirming('commission')}
              label="Save commission"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Default platform markup"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.defaultMarkupPercent ?? 5}
              onChange={(event) =>
                set((current) => ({ ...current, defaultMarkupPercent: Number(event.target.value) }))
              }
              hint="percent of one payment"
            />
            <Field
              label="Default platform fee"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={draft.defaultPlatformFeePercent ?? 0.5}
              onChange={(event) =>
                set((current) => ({
                  ...current,
                  defaultPlatformFeePercent: Number(event.target.value),
                }))
              }
              hint="percent of a school’s own volume, max 5"
            />
          </div>
        </div>
      </Card>

      {/* ── Disbursement ── */}
      <Card padding="p-5" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
              <Wallet className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Disbursement
            </h2>
            <p className="mt-0.5 max-w-2xl text-[11px]/[17px] font-semibold text-slate-500">
              When payout runs happen, and whether a person signs one off. These are one
              decision — a frequency with no day cannot be scheduled at all — so they are one
              saved section.
            </p>
          </div>
          <SectionSave
            dirty={disbursementDirty}
            saving={pending === 'disbursement'}
            onClick={() => (autoApproveNext !== Boolean(saved?.disbursement?.autoApprove) ? setConfirming('autoApprove') : saveDisbursement())}
            label="Save disbursement"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Frequency"
            value={draft.disbursement?.frequency || 'weekly'}
            onChange={(event) =>
              set((current) => ({
                ...current,
                disbursement: { ...current.disbursement, frequency: event.target.value },
              }))
            }
          >
            {DISBURSEMENT_FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Day of week"
            hint="weekly and every-two-weeks only"
            value={String(draft.disbursement?.dayOfWeek ?? 1)}
            onChange={(event) =>
              set((current) => ({
                ...current,
                disbursement: { ...current.disbursement, dayOfWeek: Number(event.target.value) },
              }))
            }
          >
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </SelectField>
        </div>

        {/*
          `autoApprove` gets a switch, a warning band and a confirmation dialog, and no
          amount of styling makes it a plain checkbox next to a Save button. It is the
          difference between a payout run needing one human click and money leaving the
          platform with nobody watching, it is off by default on purpose, and the only
          record that it was ever on is the audit entry an accidental save would write as
          easily as a deliberate one.
        */}
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-ink">Approve payouts automatically</p>
              <p className="mt-0.5 max-w-xl text-[11px]/[17px] font-semibold text-slate-600">
                With this on, a scheduled payout run approves itself and money leaves the
                platform with nobody watching. With it off, every run needs one human click.
                It is off by default, and turning it on is an explicit act by the owner.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge tone={autoApproveNext ? 'red' : 'green'}>
                {autoApproveNext ? 'Unattended' : 'One human click'}
              </Badge>
              <Toggle
                label="Approve payouts automatically"
                checked={autoApproveNext}
                onChange={(next) => {
                  // Set it, then open the dialog rather than saving from here. The switch
                  // is a statement of intent; the dialog is the decision.
                  set((current) => ({
                    ...current,
                    disbursement: { ...current.disbursement, autoApprove: next },
                  }));
                  if (next !== Boolean(saved?.disbursement?.autoApprove)) setConfirming('autoApprove');
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── SMS ── */}
      <Card padding="p-5" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Platform SMS</h2>
            <p className="mt-0.5 max-w-2xl text-[11px]/[17px] font-semibold text-slate-500">
              The platform&rsquo;s own messaging account — receipts, payout confirmations and
              notices to school administrators. A school&rsquo;s own gateway and key are
              separate and are not configured here.
            </p>
          </div>
          <SectionSave
            dirty={smsDirty}
            saving={pending === 'sms'}
            onClick={saveSms}
            label="Save SMS"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Provider"
            value={draft.sms?.provider || 'arke'}
            onChange={(event) =>
              set((current) => ({
                ...current,
                sms: { ...current.sms, provider: event.target.value },
              }))
            }
          >
            <option value="arke">Arkesel</option>
            <option value="moolre">Moolre</option>
          </SelectField>

          <MoneyInput
            label="Cost per SMS"
            value={draft.sms?.ratePesewas ?? 25}
            onChange={(value) =>
              set((current) => ({
                ...current,
                sms: { ...current.sms, ratePesewas: value ?? 0 },
              }))
            }
            hint="pesewas, e.g. 25 = GH₵ 0.25"
          />
        </div>
      </Card>

      {/* ── Support ── */}
      <Card padding="p-5" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Support</h2>
            <p className="mt-0.5 max-w-2xl text-[11px]/[17px] font-semibold text-slate-500">
              Where a school is told to contact us. These render into emails, SMS and the
              public site, so a number that changes has to be changeable here without a
              redeploy.
            </p>
          </div>
          <SectionSave
            dirty={supportDirty}
            saving={pending === 'support'}
            onClick={saveSupport}
            label="Save support"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Support phone"
            type="tel"
            value={draft.support?.phone || ''}
            onChange={(event) =>
              set((current) => ({
                ...current,
                support: { ...current.support, phone: event.target.value },
              }))
            }
            placeholder="+233 …"
          />
          <Field
            label="Support email"
            type="email"
            value={draft.support?.email || ''}
            onChange={(event) =>
              set((current) => ({
                ...current,
                support: { ...current.support, email: event.target.value },
              }))
            }
            placeholder="support@sukuupay.com"
          />
        </div>

        {/*
          Blank is allowed by the schema and blank means absent. The site footer and the
          contact page hide a blank support line rather than rendering an empty link, which
          is the honest behaviour — an unassigned number is a worse thing to publish than no
          number at all.
        */}
        {!draft.support?.phone && !draft.support?.email && (
          <p className="mt-3 flex items-start gap-2 text-[11px]/[17px] font-semibold text-amber-700">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Both are empty. Anything that renders a support contact — the site footer, the
              contact page, a password-reset email — will hide the link rather than show a
              blank one.
            </span>
          </p>
        )}
      </Card>

      {/* ── Maintenance ── */}
      <Card padding="p-5" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Maintenance</h2>
            <p className="mt-0.5 max-w-2xl text-[11px]/[17px] font-semibold text-slate-500">
              The only way to take SukuuPay quiet. The same three states are on the Health
              screen, deliberately: two entry points to one stored value, so the operator who
              is looking at settings does not have to go somewhere else to find it.
            </p>
          </div>
          <SectionSave
            dirty={maintenanceDirty}
            saving={pending === 'maintenance'}
            onClick={() => setConfirming('maintenance')}
            label="Save maintenance"
          />
        </div>

        <div className="mt-4 space-y-2">
          {MAINTENANCE_MODES.map((mode) => (
            <label
              key={mode.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 ${
                mode.value === 'on' ? 'border-red-200' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="maintenance-mode"
                value={mode.value}
                checked={maintenanceMode === mode.value}
                onChange={() =>
                  set((current) => ({
                    ...current,
                    maintenance: { ...current.maintenance, mode: mode.value },
                  }))
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-extrabold text-ink">{mode.label}</span>
                <span className="block text-[11px]/[17px] font-semibold text-slate-500">
                  {mode.blurb}
                </span>
              </span>
            </label>
          ))}
        </div>

        {maintenanceMode !== 'off' && (
          <div className="mt-4">
            <Field
              label="Message shown to users"
              value={draft.maintenance?.message || ''}
              maxLength={500}
              onChange={(event) =>
                set((current) => ({
                  ...current,
                  maintenance: { ...current.maintenance, message: event.target.value },
                }))
              }
              placeholder="We are upgrading SukuuPay and will be back shortly."
              hint={`${(draft.maintenance?.message || '').length}/500`}
            />
            <p className="mt-1.5 text-[11px]/[17px] font-semibold text-slate-400">
              Shown to every user while this mode is on. The Health screen&rsquo;s toggle
              requires one; nothing here does, and a maintenance screen with nothing to say is
              a support call waiting to happen.
            </p>
          </div>
        )}
      </Card>

      {/* ── Standing ── */}
      <Card padding="p-5" className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-ink">Platform standing</h2>
            <p className="mt-0.5 text-[11px]/[17px] font-semibold text-slate-500">
              Live figures, from the same endpoints the Overview reads. Context for the
              percentages above, not an input to them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              getDashboardKpis()
                .then((kpis) => setStanding((current) => ({ ...current, kpis })))
                .catch(() => {});
              getPlatformSmsBalance()
                .then((sms) => setStanding((current) => ({ ...current, sms })))
                .catch(() => {});
            }}
            aria-label="Refresh the standing figures"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-3">
          <Row label="Schools registered" hint="All lifecycle states combined" value={formatCount(schools.total)} />
          <Row label="Active" value={formatCount(schools.active)} />
          <Row label="On trial" value={formatCount(schools.onTrial)} />
          <Row label="Suspended" value={formatCount(schools.suspended)} />
          <Row label="Archived" value={formatCount(schools.archived)} />
          <Row label="Accounts" hint="Staff and parents" value={formatCount(standing.kpis?.users?.total)} />
          <Row label="Platform markup earned" value={formatCedi(payments.platformMarkup)} />
          <Row label="Pending payouts" value={formatCedi(payments.pendingPayouts)} />
          <Row
            label="SMS credit"
            hint={
              smsBalance.totalSchools
                ? `Master balance across ${formatCount(smsBalance.totalSchools)} active schools`
                : 'Master balance, all schools'
            }
            value={formatCount(smsBalance.totalBalance)}
          />
        </div>
      </Card>

      <Card padding="p-5" className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-extrabold text-ink">Last saved</h2>
            <p className="mt-0.5 text-[11px]/[17px] font-semibold text-slate-500">
              {saved?.updatedAt
                ? new Date(saved.updatedAt).toLocaleString('en-GB')
                : 'These are the defaults. Nothing has been saved yet.'}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <Check className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        </div>
      </Card>

      {/* ── The three confirmations ── */}

      <ConfirmDialog
        open={confirming === 'commission'}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          const result = await saveCommission();
          if (result.ok) {
            toast.success(
              `New schools will be given a ${draft.defaultMarkupPercent}% markup and a ${draft.defaultPlatformFeePercent}% platform fee.`
            );
          }
          return result;
        }}
        title="Change what SukuuPay takes?"
        description="This decides the commission charged to every school provisioned from now on."
        confirmLabel="Save commission"
        bullets={[
          'Schools already on the platform keep the rate they have today. Nothing is repriced retroactively.',
          ...commissionDiff.map(
            (line) => `${line.label}: ${line.before ?? '—'} → ${line.next ?? '—'}`
          ),
          'The write is recorded in the audit log with both values.',
        ]}
      />

      <ConfirmDialog
        open={confirming === 'autoApprove'}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          const result = await saveDisbursement();
          if (result.ok) {
            toast.success(
              autoApproveNext
                ? 'Payout runs now approve themselves. Money leaves the platform unattended.'
                : 'Payout runs need one human click again.'
            );
          }
          return result;
        }}
        title={autoApproveNext ? 'Let money leave without a person?' : 'Require a human click again?'}
        description={
          autoApproveNext
            ? 'Auto-approval is the most consequential switch on this page. Read what changes before you confirm.'
            : 'Every scheduled payout run will need someone to approve it before money moves.'
        }
        confirmLabel={autoApproveNext ? 'Approve payouts unattended' : 'Require approval'}
        tone={autoApproveNext ? 'danger' : 'brand'}
        bullets={
          autoApproveNext
            ? [
                'A payout run will approve itself and money will leave the platform with nobody watching.',
                'There is no per-run human check left anywhere in the flow — that is the entire effect of the switch.',
                'A wrong batch is discovered after the money has moved, not before.',
                'It is off by default, and it is recorded in the audit log with whoever turned it on.',
              ]
            : [
                'Every payout run stops at "approved" until a person releases it.',
                'That person can read the batch before it settles.',
              ]
        }
      />

      <ConfirmDialog
        open={confirming === 'maintenance'}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          const result = await saveMaintenance();
          if (result.ok) {
            toast.success(
              maintenanceMode === 'off'
                ? 'Maintenance mode is off. Reads and writes both work again.'
                : `Maintenance mode is "${maintenanceMode}".`
            );
          }
          return result;
        }}
        title={maintenanceMode === 'off' ? 'Bring SukuuPay back?' : 'Change the maintenance state?'}
        description={maintenanceModeInfo?.blurb}
        confirmLabel={maintenanceMode === 'off' ? 'Leave maintenance' : 'Apply this mode'}
        tone={maintenanceMode === 'on' ? 'danger' : maintenanceMode === 'off' ? 'brand' : 'amber'}
        bullets={[
          `From ${maintenanceDiff?.from} to ${maintenanceDiff?.to}.`,
          ...(maintenanceMode === 'off'
            ? ['Reads and writes both work again immediately.']
            : maintenanceMode === 'readonly'
              ? [
                  'Every page still loads. Every write is refused — payments, imports, roster changes and settings.',
                  'Nobody is signed out, and nobody sees a 503 wondering whether to retry.',
                ]
              : [
                  'The API refuses reads as well as writes. Nobody can sign in, including you.',
                  'The only way out is this same screen — which means signing in again on another device.',
                ]),
          ...(maintenanceDiff?.message
            ? [`Users will be shown: “${maintenanceDiff.message}”`]
            : maintenanceMode === 'off'
              ? []
              : ['No message is set, so the platform will show a generic notice to everyone.']),
        ]}
      />

      {/*
        The duplication explained where a reader meets it, rather than in a comment they
        have to find. The Health screen has the same three states; it is the same stored
        value, and neither screen is the source of truth — the document is.
      */}
      <p className="mt-4 flex items-start gap-2 text-[11px]/[17px] font-medium text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Maintenance also appears on the Health screen. That is deliberate: an operator
          checking whether the platform is healthy should not have to leave that screen to
          find the switch. Both write the same stored mode, so the two can never disagree —
          and the Health screen&rsquo;s toggle cannot reach <code className="font-mono">on</code>
          at all, because that path deliberately maps &ldquo;enabled&rdquo; onto{' '}
          <code className="font-mono">readonly</code>. Only this page can put the platform
          fully down, and it says what that does first.
        </span>
      </p>
    </>
  );
};

export default PlatformSettings;
