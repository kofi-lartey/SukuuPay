import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Info, Save, ServerCog, TriangleAlert } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import Modal from '../../components/common/Modal';
import { Field, FormAlert } from '../../components/common/FormField';
import { useToast } from '../../hooks/useToast';
import { getDashboardKpis, getPlatformSmsBalance, getPlatformSettings, updatePlatformSettings } from '../../services/admin';
import { formatCedi, formatCount } from '../../utils/format';

const MAINTENANCE_MODES = [
  { value: 'off', label: 'Off', blurb: 'Everything works normally.' },
  { value: 'readonly', label: 'Read-only', blurb: 'Every page loads; nothing can be changed. The safe state for a migration.' },
  { value: 'on', label: 'Fully down', blurb: 'The API refuses reads as well as writes. Only for a release that must not serve traffic at all.' },
];

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
 * A switch, as a real `<button>` with `role="switch"` and `aria-checked`.
 *
 * Not a checkbox styled with `appearance-none`, and not a clickable `<div>`: a
 * platform operator toggling "self-signup off" is changing whether strangers can
 * create accounts, and it has to be operable by keyboard and announce its state to a
 * screen reader. `role="switch"` is the honest role — it is on or off, not checked.
 */
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

/**
 * Platform settings — writable, and audited.
 *
 * Backed by `GET`/`PUT /admin/settings`, a singleton enforced by a unique index in
 * the database rather than by convention. Every write records the leaf paths that
 * changed, with both sides of each, so "who set the markup to 12?" has an answer.
 *
 * Three decisions worth naming:
 *
 *   - **Maintenance mode is confirmed, and the mode is named in the dialog.**
 *     `readonly` and `on` are not degrees of the same thing: `readonly` keeps every
 *     page loading and is what a migration wants; `on` refuses reads too and takes
 *     the product down for everyone including the operator. A single "are you sure?"
 *     would treat them alike, so the dialog quotes the blurb for the chosen mode
 *     rather than asking generically.
 *   - **The save button is disabled until something differs.** A settings page that
 *     lets you press Save having changed nothing writes an audit entry for a no-op,
 *     and a log full of no-ops is a log in which the real change is harder to find.
 *     The server also refuses to record one, but the button not inviting it is the
 *     better half of that.
 *   - **Only changed keys are sent.** The endpoint is a patch by design, so writing
 *     back a whole document read from the server cannot blank the fields the
 *     operator was not looking at.
 */
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
    // Two calls, not a `Promise.all`: the standing figures are decoration on this
    // page and a failure of theirs must not blank the settings form, which is the
    // reason anybody came here.
    getDashboardKpis()
      .then((kpis) => active && setStanding((c) => ({ ...c, kpis, loading: false })))
      .catch(() => active && setStanding((c) => ({ ...c, kpis: null, loading: false })));
    getPlatformSmsBalance()
      .then((sms) => active && setStanding((c) => ({ ...c, sms })))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadSettings = useCallback(() => {
    let active = true;
    getPlatformSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setDraft({
          defaultMarkupPercent: data.defaultMarkupPercent ?? 5,
          features: {
            adsEnabled: data.features?.adsEnabled !== false,
            selfSignupEnabled: data.features?.selfSignupEnabled !== false,
            trialDays: data.features?.trialDays ?? 30,
          },
          maintenance: {
            mode: data.maintenance?.mode || 'off',
            message: data.maintenance?.message || '',
          },
        });
      })
      .catch((error) => active && setFormError(error));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => loadSettings(), [loadSettings]);

  const schools = standing.kpis?.schools || {};
  const payments = standing.kpis?.payments || {};
  const sms = standing.sms || {};

  /**
   * The patch: only what differs from what was loaded.
   *
   * Computed rather than sent wholesale, because `PUT /admin/settings` is a patch
   * and sending the whole document would overwrite a change made in another tab
   * between the load and the save.
   */
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
    if (draft.maintenance.message !== (settings.maintenance?.message || '')) {
      maintenance.message = draft.maintenance.message;
    }
    if (Object.keys(maintenance).length) body.maintenance = maintenance;

    return body;
  }, [settings, draft]);

  const isDirty = Object.keys(patch).length > 0;
  const enteringMaintenance = patch.maintenance?.mode && patch.maintenance.mode !== 'off';

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
        changed.length
          ? changed.map((entry) => `${entry.path} → ${entry.to}`).join(', ')
          : 'Nothing had changed.'
      );
    } catch (error) {
      setFormError(error.message || 'Those settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Settings"
        description="Configuration for SukuuPay itself — not for any one school. Every change is recorded in the activity log."
        actions={
          <>
            {isDirty && <Badge tone="amber" icon={TriangleAlert}>Unsaved</Badge>}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save changes
            </button>
          </>
        }
      />

      {formError && !draft ? (
        <EmptyState
          icon={ServerCog}
          title="Platform settings could not be loaded"
          description={formError.message || String(formError)}
        />
      ) : draft ? (
        <>
          {formError && (
            <div className="mb-4">
              <FormAlert tone="error">{formError.message || String(formError)}</FormAlert>
            </div>
          )}

          <Card padding="p-5">
            <h2 className="text-[13px] font-extrabold text-ink">Fees</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              What a newly provisioned school is given. Existing schools keep the rate they already have.
            </p>

            <div className="mt-4 max-w-xs">
              <Field
                label="Default platform markup"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={draft.defaultMarkupPercent}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultMarkupPercent: Number(event.target.value),
                  }))
                }
                hint="percent"
              />
            </div>
          </Card>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[13px] font-extrabold text-ink">Feature flags</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Things that were previously hard-coded and needed a redeploy to change.
            </p>

            <div className="mt-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-ink">Public creative slider</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Schools’ creatives on the login and signup pages. Turn off to hide them platform-wide.
                  </p>
                </div>
                <Toggle
                  label="Public creative slider"
                  checked={draft.features.adsEnabled}
                  onChange={(adsEnabled) =>
                    setDraft((current) => ({ ...current, features: { ...current.features, adsEnabled } }))
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-ink">Self-signup</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Whether a new account can be created without an invitation. Turning this off
                    leaves existing accounts untouched.
                  </p>
                </div>
                <Toggle
                  label="Self-signup"
                  checked={draft.features.selfSignupEnabled}
                  onChange={(selfSignupEnabled) =>
                    setDraft((current) => ({
                      ...current,
                      features: { ...current.features, selfSignupEnabled },
                    }))
                  }
                />
              </div>

              <div className="max-w-xs">
                <Field
                  label="Trial length"
                  type="number"
                  min={0}
                  max={365}
                  value={draft.features.trialDays}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      features: { ...current.features, trialDays: Number(event.target.value) },
                    }))
                  }
                  hint="days"
                />
              </div>
            </div>
          </Card>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[13px] font-extrabold text-ink">Maintenance</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              The only way to take SukuuPay quiet. Confirmed separately, because the three modes are not
              degrees of the same thing.
            </p>

            <div className="mt-4 space-y-2">
              {MAINTENANCE_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"
                >
                  <input
                    type="radio"
                    name="maintenance-mode"
                    value={mode.value}
                    checked={draft.maintenance.mode === mode.value}
                    onChange={() =>
                      setDraft((current) => ({ ...current, maintenance: { ...current.maintenance, mode: mode.value } }))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-extrabold text-ink">{mode.label}</span>
                    <span className="block text-[11px] font-semibold text-slate-500">{mode.blurb}</span>
                  </span>
                </label>
              ))}
            </div>

            {draft.maintenance.mode !== 'off' && (
              <div className="mt-4">
                <Field
                  label="Message shown to users"
                  value={draft.maintenance.message}
                  maxLength={500}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maintenance: { ...current.maintenance, message: event.target.value },
                    }))
                  }
                  placeholder="We are upgrading SukuuPay and will be back shortly."
                  hint={`${draft.maintenance.message.length}/500`}
                />
                <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                  Optional. Empty means the platform says nothing about itself.
                </p>
              </div>
            )}
          </Card>

          <Card padding="p-5" className="mt-4">
            <h2 className="text-[13px] font-extrabold text-ink">Platform standing</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Live figures, from the same endpoints the Overview reads.
            </p>

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
                  sms.totalSchools
                    ? `Master balance across ${formatCount(sms.totalSchools)} active schools`
                    : 'Master balance, all schools'
                }
                value={formatCount(sms.totalBalance)}
              />
            </div>
          </Card>

          <Card padding="p-5" className="mt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-extrabold text-ink">Last saved</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {settings?.updatedAt
                    ? new Date(settings.updatedAt).toLocaleString('en-GB')
                    : 'These are the defaults. Nothing has been saved yet.'}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <Check className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
          </Card>
        </>
      ) : (
        <div className="space-y-4">
          {[0, 1, 2].map((card) => (
            <div key={card} className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      )}

      {/* ── Confirm ── */}
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={enteringMaintenance ? 'Put SukuuPay into maintenance?' : 'Save these settings?'}
        description={
          enteringMaintenance
            ? MAINTENANCE_MODES.find((mode) => mode.value === draft?.maintenance?.mode)?.blurb
            : 'The change takes effect immediately for every school on the platform.'
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 ${
                enteringMaintenance ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-700 hover:bg-brand-800'
              }`}
            >
              {saving ? 'Saving…' : enteringMaintenance ? 'Enter maintenance' : 'Save changes'}
            </button>
          </>
        }
      >
        {/*
          The diff, not a generic "are you sure?".

          An operator confirming a settings write needs to see *which* keys change —
          "features.selfSignupEnabled → false" is checkable, "save your changes" is
          not. This is also the same leaf-path vocabulary the audit entry records, so
          what is confirmed here is what will be in the log.
        */}
        <ul className="space-y-1.5">
          {Object.entries(patch).map(([group, value]) =>
            typeof value === 'object' && value !== null ? (
              Object.entries(value).map(([key, next]) => (
                <li key={`${group}.${key}`} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <code className="font-mono font-bold text-slate-600">
                    {group}.{key}
                  </code>
                  <span className="text-[11px] font-extrabold text-ink">
                    {String(settings?.[group]?.[key] ?? '—')} → {String(next)}
                  </span>
                </li>
              ))
            ) : (
              <li key={group} className="flex items-baseline justify-between gap-3 text-[12px]">
                <code className="font-mono font-bold text-slate-600">{group}</code>
                <span className="text-[11px] font-extrabold text-ink">
                  {String(settings?.[group] ?? '—')} → {String(value)}
                </span>
              </li>
            )
          )}
        </ul>

        {draft?.maintenance?.message?.trim() && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
            Users will be shown: “{draft.maintenance.message.trim()}”
          </p>
        )}
      </Modal>
    </>
  );
};

export default AdminSettings;