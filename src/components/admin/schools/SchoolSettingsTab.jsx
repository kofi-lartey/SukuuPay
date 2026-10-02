import React, { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Settings2, Tags } from 'lucide-react';
import Card from '../../dashboard/ui/Card';
import Badge from '../../dashboard/ui/Badge';
import { Field, SelectField, FormAlert } from '../../common/FormField';
import MoneyInput from '../../common/MoneyInput';
import AddTagModal from './AddTagModal';
import {
  FEATURE_FLAGS,
  GATEWAY_MODES,
  PLANS,
  SUBSCRIPTION_STATUSES,
  updateFeatureFlags,
  updatePlatformFee,
  updateSubscription,
} from '../../../services/admin';
import { formatPercent } from '../../../utils/format';

/**
 * The four `featureFlags`, worded as what a school loses rather than as a switch
 * name. `whatsapp` and `apiAccess` cost real money per conversation and per call, so
 * the consequence is stated next to the box rather than left to the operator to
 * recall it.
 */
const FLAG_COPY = {
  installments: {
    label: 'Installment plans',
    detail: 'Split a student’s bill into dated instalments.',
  },
  idCards: {
    label: 'ID card generation',
    detail: 'Print and generate student ID cards.',
  },
  whatsapp: {
    label: 'WhatsApp reminders',
    detail: 'Off by default. Every conversation is billed per message by the provider.',
  },
  apiAccess: {
    label: 'API access',
    detail: 'Off by default. A third-party integration reads and writes this school’s data.',
  },
};

/** `updatePlatformFeeSchema` caps this at 5 — a commercial ceiling, not arithmetic. */
const MAX_PLATFORM_FEE = 5;

/**
 * One form's own save button.
 *
 * Module-level rather than declared inside the tab, because a component defined in a
 * render body is a *new type* on every render: React unmounts and remounts its
 * subtree each time, which throws away focus on a button an operator is about to
 * press with Space. Four of these, one per form, each with its own `busy` — so one
 * form saving never disables another form's button.
 */
const SaveButton = ({ busy, onClick, label, busyLabel }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={busy}
    className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
  >
    {busy ? (
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
    ) : (
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
    )}
    {busy ? busyLabel : label}
  </button>
);

/**
 * Every platform-owned setting on one school, as four separate confirmed writes.
 *
 * **Four forms, four buttons, four audit entries — deliberately, not for lack of
 * taste.** Each of these has its own endpoint, its own `AUDIT_ACTIONS` entry and its
 * own `before`/`after` pair on the server (`schools.controller.js` — one controller
 * per route, each calling `logRequest` with only its own pair). A single "Save
 * settings" button would have to either call four endpoints in sequence — four audit
 * entries written by one click, so the log could no longer tell what the operator
 * actually did — or call one endpoint that does not exist, which would mean adding a
 * server route that collapses four separately-audited decisions into one
 * indistinguishable event. The separation is the audit trail. So the UI states it
 * rather than hiding it behind a shared form.
 *
 * **The feature-flag boxes default from the server's actual values, never from
 * `true`.** `whatsapp` and `apiAccess` default off server-side and both cost money
 * per unit; `installments` and `idCards` default on. Seeding the draft from a
 * hard-coded "on" because it looks friendlier would pre-tick WhatsApp and API access
 * on a school that never bought them — and because the write is a *true patch*
 * (`schools.service.js:910-934` merges flag by flag so a two-key body cannot reset the
 * other two), a mistaken tick here is written immediately and is not caught by anyone.
 *
 * The same applies to `record.featureFlags` arriving `null`. That is not "no flags
 * set", it is "this school predates the field" — so the draft falls back to the
 * documented server defaults and says so, rather than starting from four unchecked
 * boxes that would switch installments off on the first save.
 */
const SchoolSettingsTab = ({ school, record, onSaved }) => {
  const subscription = record?.subscription || school.subscription || {};
  const serverFlags = record?.featureFlags || null;

  /* ── Subscription ── */
  const [plan, setPlan] = useState(subscription.plan || 'trial');
  const [subStatus, setSubStatus] = useState(subscription.status || 'trial');
  const [monthlyFee, setMonthlyFee] = useState(subscription.monthlyFee ?? 0);
  const [trialEndsAt, setTrialEndsAt] = useState(
    subscription.trialEndsAt ? String(subscription.trialEndsAt).slice(0, 10) : ''
  );
  const [periodStart, setPeriodStart] = useState(
    subscription.currentPeriodStart ? String(subscription.currentPeriodStart).slice(0, 10) : ''
  );
  const [periodEnd, setPeriodEnd] = useState(
    subscription.currentPeriodEnd ? String(subscription.currentPeriodEnd).slice(0, 10) : ''
  );
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState(null);

  /* ── Feature flags ── */
  const [flags, setFlags] = useState(() => ({
    installments: serverFlags?.installments ?? true,
    idCards: serverFlags?.idCards ?? true,
    whatsapp: serverFlags?.whatsapp ?? false,
    apiAccess: serverFlags?.apiAccess ?? false,
  }));
  const [flagsBusy, setFlagsBusy] = useState(false);
  const [flagsError, setFlagsError] = useState(null);

  /* ── Platform fee ── */
  const [platformFee, setPlatformFee] = useState(String(record?.platformFeePercent ?? 0));
  const [feeBusy, setFeeBusy] = useState(false);
  const [feeError, setFeeError] = useState(null);
  const [feeResult, setFeeResult] = useState(null);

  /* ── Tags ── */
  const [tagsOpen, setTagsOpen] = useState(false);
  const tags = Array.isArray(record?.tags) ? record.tags : [];

  /*
   * Re-seed the drafts when the server's answer changes.
   *
   * Keyed on the values, not on the `record` object: after a save, `onSaved` refetches
   * and hands back a brand-new object, and the point of re-seeding is to adopt the
   * server's answer (including the trial end date and period end it *derived* — the
   * service fills both when they are omitted, `schools.service.js:794-858`). A field
   * left on what the operator typed when the server already moved it would show a
   * subscription state that does not exist.
   *
   * The flags draft is deliberately **not** re-seeded here. It is seeded once, from
   * the server's real values, and a save does not need to push the same booleans
   * back — and re-seeding it on a refetch would discard a tick somebody has made in
   * the same tick they saved something else.
   */
  const serverStamp = `${subscription.plan}|${subscription.status}|${subscription.monthlyFee}|${subscription.trialEndsAt}|${subscription.currentPeriodStart}|${subscription.currentPeriodEnd}|${record?.platformFeePercent}`;

  useEffect(() => {
    setPlan(subscription.plan || 'trial');
    setSubStatus(subscription.status || 'trial');
    setMonthlyFee(subscription.monthlyFee ?? 0);
    setTrialEndsAt(subscription.trialEndsAt ? String(subscription.trialEndsAt).slice(0, 10) : '');
    setPeriodStart(
      subscription.currentPeriodStart ? String(subscription.currentPeriodStart).slice(0, 10) : ''
    );
    setPeriodEnd(
      subscription.currentPeriodEnd ? String(subscription.currentPeriodEnd).slice(0, 10) : ''
    );
    setPlatformFee(String(record?.platformFeePercent ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverStamp]);

  /**
   * The subscription payload, omitting anything left blank.
   *
   * A blank date is *absent*, not empty-string. The schema's `trialEndsAt` is
   * `Joi.date().iso()` and `''` is not an ISO date, so sending an empty string is a
   * 422 on a field the operator never touched. Omitting it also restores the server's
   * defaulting: `status: 'trial'` with no `trialEndsAt` becomes
   * `now + features.trialDays`, and an active paid plan with no `currentPeriodEnd`
   * becomes `now + 1 month` — which is what stops a subscription being *set up but
   * not running*.
   */
  const subscriptionPayload = useMemo(() => {
    const payload = { plan, status: subStatus };
    if (monthlyFee !== null && monthlyFee !== undefined) payload.monthlyFee = monthlyFee;
    if (trialEndsAt) payload.trialEndsAt = new Date(`${trialEndsAt}T00:00:00.000Z`).toISOString();
    if (periodStart) payload.currentPeriodStart = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
    if (periodEnd) payload.currentPeriodEnd = new Date(`${periodEnd}T00:00:00.000Z`).toISOString();
    return payload;
  }, [plan, subStatus, monthlyFee, trialEndsAt, periodStart, periodEnd]);

  /** Every mutation here returns `{ ok, error }` rather than throwing. */
  const run = async (setBusy, setError, action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved?.();
      return { ok: true };
    } catch (error) {
      setError(error.message || 'That change could not be saved.');
      return { ok: false, error: error.message };
    } finally {
      setBusy(false);
    }
  };

  const saveSubscription = () =>
    run(setSubBusy, setSubError, () => updateSubscription(school._id, subscriptionPayload));

  const saveFlags = () => run(setFlagsBusy, setFlagsError, () => updateFeatureFlags(school._id, flags));

  const savePlatformFee = async () => {
    const value = Number(platformFee);
    if (!Number.isFinite(value) || value < 0 || value > MAX_PLATFORM_FEE) {
      setFeeError(`A platform fee between 0 and ${MAX_PLATFORM_FEE}% is required.`);
      return { ok: false, error: 'invalid' };
    }
    setFeeResult(null);
    return run(setFeeBusy, setFeeError, async () => {
      const response = await updatePlatformFee(school._id, value);
      setFeeResult(response || {});
    });
  };

  if (!school) return null;

  return (
    <div className="space-y-4">
      {/* ── Subscription ── */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold leading-tight text-ink">
              <Settings2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Subscription
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Plan, monthly fee and billing period. Saved on its own, audited as
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">admin.subscription_update</code>.
            </p>
          </div>
          <Badge tone="slate">{subscription.plan || 'no plan'}</Badge>
        </div>

        {subError && (
          <div className="mt-3">
            <FormAlert tone="error">{subError}</FormAlert>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)}>
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={subStatus}
            onChange={(event) => setSubStatus(event.target.value)}
          >
            {SUBSCRIPTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          {/*
            Integer pesewas, like every money field in the product. `MoneyInput` takes
            and emits pesewas and shows cedis, which is the only place that boundary
            is crossed — a component that multiplied here would be a hundred-fold out
            on every school's bill.
          */}
          <MoneyInput
            label="Monthly fee"
            value={monthlyFee}
            onChange={setMonthlyFee}
            hint="whole pesewas"
          />

          <Field
            label="Trial ends"
            type="date"
            value={trialEndsAt}
            onChange={(event) => setTrialEndsAt(event.target.value)}
            hint="blank = server default"
          />
          <Field
            label="Period start"
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
          />
          <Field
            label="Period end"
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            hint="blank = one month out"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SaveButton
            busy={subBusy}
            onClick={saveSubscription}
            label="Save subscription"
            busyLabel="Saving…"
          />
          <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
            Leave the trial end or period end blank and the server fills them in — a trial with no end
            date never expires, and a paid plan with no period end is never billed.
          </p>
        </div>
      </Card>

      {/* ── Feature flags ── */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-extrabold leading-tight text-ink">Feature flags</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Saved on their own, audited as
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">admin.feature_flags_update</code>.
            </p>
          </div>
          {!serverFlags && <Badge tone="amber">Server reported no flags — showing defaults</Badge>}
        </div>

        {flagsError && (
          <div className="mt-3">
            <FormAlert tone="error">{flagsError}</FormAlert>
          </div>
        )}

        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FEATURE_FLAGS.map((flag) => (
            <li key={flag}>
              <label
                htmlFor={`school-flag-${flag}`}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50"
              >
                <input
                  id={`school-flag-${flag}`}
                  type="checkbox"
                  checked={Boolean(flags[flag])}
                  disabled={flagsBusy}
                  onChange={(event) =>
                    setFlags((current) => ({ ...current, [flag]: event.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-ink">
                    {FLAG_COPY[flag]?.label || flag}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-relaxed text-slate-500">
                    {FLAG_COPY[flag]?.detail}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <SaveButton busy={flagsBusy} onClick={saveFlags} label="Save flags" busyLabel="Saving…" />
        </div>
      </Card>

      {/* ── Platform fee ── */}
      <Card padding="p-5">
        <h2 className="text-[13px] font-extrabold leading-tight text-ink">Platform fee</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
          The monthly percentage a school on its own gateway pays for reaching its parents through
          SukuuPay. Separate from the per-payment markup above it. Saved on its own, audited as
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">admin.platform_fee_update</code>.
        </p>

        {feeError && (
          <div className="mt-3">
            <FormAlert tone="error">{feeError}</FormAlert>
          </div>
        )}

        {feeResult?.before && feeResult?.after && (
          <div className="mt-3">
            <FormAlert tone="success">
              Platform fee changed from {formatPercent(feeResult.before.platformFeePercent)} to{' '}
              {formatPercent(feeResult.after.platformFeePercent)}.
            </FormAlert>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Platform fee"
            type="number"
            min="0"
            max={MAX_PLATFORM_FEE}
            step="0.01"
            value={platformFee}
            onChange={(event) => setPlatformFee(event.target.value)}
            hint={`0–${MAX_PLATFORM_FEE}%`}
            trailing={<span className="text-[11px] font-extrabold">%</span>}
            error={
              platformFee !== '' &&
              (!Number.isFinite(Number(platformFee)) ||
                Number(platformFee) < 0 ||
                Number(platformFee) > MAX_PLATFORM_FEE)
                ? `Between 0 and ${MAX_PLATFORM_FEE}%`
                : null
            }
          />
          <div className="flex items-end">
            <SaveButton
              busy={feeBusy}
              onClick={savePlatformFee}
              label="Save platform fee"
              busyLabel="Saving…"
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
          Capped at {MAX_PLATFORM_FEE}% by the server, which is a commercial decision rather than an
          arithmetic one: it is a percentage of a school&rsquo;s collected volume, not a skim off one
          parent&rsquo;s payment.
        </p>
      </Card>

      {/* ── Tags ── */}
      {/*
        Tags are their own write, for the same reason everything else here is: they have
        their own endpoint and their own `admin.tags_update` audit entry. The editor
        itself is `AddTagModal` — the same dialog the schools list's row menu opens —
        because a tag is edited the same way wherever you reach it from, and two tag
        editors would be two implementations of `normaliseTags`'s rules.
      */}
      <Card padding="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-extrabold leading-tight text-ink">Tags</h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Operator labels. Free text, lowercased, 20 tags of 50 characters each. Invisible to
              the school. Saved on its own, audited as
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">admin.tags_update</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTagsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Tags className="h-3.5 w-3.5" aria-hidden="true" />
            {tags.length ? 'Edit tags' : 'Add a tag'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.length ? (
            tags.map((tag) => (
              <Badge key={tag} tone="brand">
                {tag}
              </Badge>
            ))
          ) : (
            <p className="text-[12px] font-semibold text-slate-400">
              None. Tags are how the schools list is grouped — “pilot”, “needs-integration”, a
              rollout cohort.
            </p>
          )}
        </div>
      </Card>

      {/* ── Gateway mode ── */}
      {/*
        Read-only here. `updateGatewayMode` exists and is a confirmed, audited write —
        but it is refused with a 409 while any disbursement batch is open, because
        money collected on the old rail is still owed on the old rail
        (`schools.service.js:697-717`). A select box on this tab would be offering
        something that fails exactly when an operator most wants it, so the value is
        shown with the reason and the batches that block it named in the failure the
        server produces.
      */}
      <Card padding="p-5">
        <h2 className="text-[13px] font-extrabold leading-tight text-ink">Gateway mode</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
          Which rail this school&rsquo;s money moves on. Not editable from here — see below.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {GATEWAY_MODES.map((mode) => (
            <Badge
              key={mode}
              tone={(record?.paymentConfig?.gatewayMode || school.payment?.gatewayMode) === mode ? 'brand' : 'slate'}
            >
              {mode}
            </Badge>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
          Moving a school between rails is refused with a 409 while any disbursement batch is still
          open — money collected on the old rail is still owed on it. Settle or cancel the open
          batches from the Finance module first, then call
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">updateGatewayMode</code>.
        </p>
      </Card>

      <AddTagModal
        open={tagsOpen}
        school={{ _id: school._id, name: school.name, tags }}
        suggestions={tags}
        onClose={() => setTagsOpen(false)}
        onSaved={onSaved}
      />
    </div>
  );
};

export default SchoolSettingsTab;