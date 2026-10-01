import React from 'react';
import { ChevronDown, Circle, CreditCard, Sparkles, Wallet } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import { INSTALLMENT_COUNTS, INTERVALS } from '../../services/paymentPlans';
import { formatCedis } from '../../utils/format';

/**
 * The plan builder's left column: the three summary figures, and the controls
 * that shape the schedule.
 *
 * **The three tiles at the top are the whole form's premise.** A bursar is not
 * choosing how to divide GH₵ 850; they are working out how to divide the
 * GH₵ 550 that is still owed, having already collected a GH₵ 300 deposit. The
 * tiles say which of those two numbers is which, because a plan written against
 * the gross total asks the family for the deposit twice — and the arithmetic
 * that follows is perfectly valid, so nothing downstream would catch it.
 */

const SummaryTile = ({ label, value, tone = 'text-ink', icon: Icon, note, noteTone = 'text-slate-500' }) => (
  <div className="flex-1 rounded-xl bg-slate-50 p-3.5">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`mt-1.5 text-[20px] font-extrabold leading-none tracking-tight ${tone}`}>
      {value}
    </p>
    {note && (
      <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${noteTone}`}>
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {note}
      </p>
    )}
  </div>
);

/** The "2 / 3 / 4 / 6 Tranches" segmented control. */
const CountPicker = ({ value, onChange, totalCedis }) => (
  <div>
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[13px] font-extrabold text-ink">Number of Installments (Tranches)</p>
      <p className="text-[11px] font-semibold text-slate-500">
        Split GH₵ {formatCedis(totalCedis)} evenly
      </p>
    </div>

    <div
      role="radiogroup"
      aria-label="Number of installments"
      className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-4"
    >
      {INSTALLMENT_COUNTS.map((count) => {
        const active = value === count;
        return (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(count)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12px] font-extrabold transition-colors ${
              active
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {count} Tranches
            {active && <Circle className="h-2 w-2 fill-current" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  </div>
);

/** Interval, with the recommendation the design makes explicit. */
const IntervalPicker = ({ value, onChange }) => {
  const current = INTERVALS.find((entry) => entry.value === value);

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-extrabold text-ink">Payment Frequency / Interval</p>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Payment frequency"
          className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        >
          {INTERVALS.map((interval) => (
            <option key={interval.value} value={interval.value}>
              {interval.label}
              {interval.value === 'monthly' ? ' (Recommended for salary workers)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
      {current && <p className="mt-1 text-[11px] font-semibold text-slate-500">{current.hint}</p>}
    </div>
  );
};

/** The first due date, with the two presets the design offers. */
const StartDatePicker = ({ value, onChange, onPreset }) => (
  <div>
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[13px] font-extrabold text-ink">First Tranche Due Date</p>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'End of Month', target: 'endOfMonth' },
          { label: 'Next Payday (1st)', target: 'firstOfNextMonth' },
        ].map((preset) => (
          <button
            key={preset.target}
            type="button"
            onClick={() => onPreset(preset.target)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>

    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="First tranche due date"
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
    />

    <p className="mt-1 text-[11px] font-medium text-slate-500">
      Subsequent installments will calculate sequentially on the same day interval.
    </p>
  </div>
);

/**
 * The MoMo reminder controls.
 *
 * **The toggle is honest about what it does not do.** Automatic collection is a
 * *proposed* configuration: the create endpoint accepts no collection field, so
 * turning this on does not by itself make the school pull money from a family on a
 * date. The copy says a push prompt is *sent* — which is exactly the part that
 * exists — rather than promising a debit. A toggle that silently does nothing is
 * worse than no toggle, and one that reads as an authorisation to pull funds when
 * it is a request for permission is worse still.
 */
const ReminderControls = ({
  autoCollect,
  setAutoCollect,
  reminderDays,
  setReminderDays,
  reminderTime,
  setReminderTime,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-ink">
            Automatic MoMo Collection Trigger
          </p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-500">
            Send an automated USSD payment prompt to the parent&rsquo;s phone on the due
            date at 8:00 AM. The family authorises the payment on their handset.
          </p>
        </div>
      </div>

      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={autoCollect}
          onChange={(event) => setAutoCollect(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`h-6 w-11 rounded-full transition-colors ${
            autoCollect ? 'bg-brand-700' : 'bg-slate-200'
          } peer-focus-visible:ring-2 peer-focus-visible:ring-brand-700/40 peer-focus-visible:ring-offset-2`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            autoCollect ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
        <span className="sr-only">Send an automated MoMo payment prompt on each due date</span>
      </label>
    </div>

    {autoCollect && (
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 pb-2 text-[12px] font-semibold text-slate-600">
          <CreditCard className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          Send SMS Reminder Notice
        </span>

        <label className="text-[11px] font-semibold text-slate-700">
          <select
            value={reminderDays}
            onChange={(event) => setReminderDays(Number(event.target.value))}
            aria-label="Days before the due date to send the reminder"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-ink focus:border-brand-700 focus:outline-none"
          >
            {[1, 2, 3, 5, 7].map((days) => (
              <option key={days} value={days}>
                {days} day{days === 1 ? '' : 's'} before
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11px] font-semibold text-slate-700">
          <span className="sr-only">Reminder time of day</span>
          <input
            type="time"
            value={reminderTime}
            onChange={(event) => setReminderTime(event.target.value)}
            aria-label="Reminder time of day"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-ink focus:border-brand-700 focus:outline-none"
          />
        </label>
      </div>
    )}
  </div>
);

const CreatePlanForm = ({
  figures,
  guardian,
  numberOfInstallments,
  setNumberOfInstallments,
  interval,
  setInterval,
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
  setReminderTime,
}) => (
  <div className="space-y-5">
    {/* The three figures. `balanceToStructure` is what the plan is written
        against; the deposit is shown so the gross total is not mistaken for it. */}
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
      <SummaryTile
        label="Total Term Fee"
        value={`GH₵ ${formatCedis(figures.totalOwed)}`}
        icon={Wallet}
        note="Locked at plan creation"
      />
      <SummaryTile
        label="Paid Deposit"
        value={`GH₵ ${formatCedis(figures.paidDeposit)}`}
        tone="text-emerald-600"
        icon={CreditCard}
        note="Verified via MoMo"
        noteTone="text-emerald-600"
      />
      <SummaryTile
        label="Balance to Structure"
        value={`GH₵ ${formatCedis(figures.balanceToStructure)}`}
        tone="text-amber-600"
        icon={Sparkles}
        note="Deferred Balance"
        noteTone="text-amber-600"
      />
    </div>

    <Card padding="p-5" className="space-y-5">
      <CountPicker
        value={numberOfInstallments}
        onChange={setNumberOfInstallments}
        totalCedis={figures.balanceToStructure / 100}
      />

      <IntervalPicker value={interval} onChange={setInterval} />

      <StartDatePicker
        value={startDate}
        onChange={setStartDate}
        onPreset={onStartDatePreset}
      />

      <ReminderControls
        autoCollect={autoCollect}
        setAutoCollect={setAutoCollect}
        reminderDays={reminderDays}
        setReminderDays={setReminderDays}
        reminderTime={reminderTime}
        setReminderTime={setReminderTime}
      />

      <div>
        <label
          className="mb-1.5 block text-[13px] font-extrabold text-ink"
          htmlFor="plan-admin-notes"
        >
          Bursar Plan Notes (Internal)
        </label>
        <textarea
          id="plan-admin-notes"
          value={adminNotes}
          onChange={(event) => setAdminNotes(event.target.value)}
          rows={3}
          placeholder="E.g., Parent requested alignment with civil service end-of-month payroll schedule."
          className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium text-ink placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          Internal only. The family does not see this.
        </p>
      </div>
    </Card>

    {guardian && (
      <Card padding="p-4" className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[13px] font-extrabold text-amber-800">
          {(guardian.parentName || '?').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-ink">
            Guardian: {guardian.parentName}
          </p>
          <p className="text-[12px] font-semibold text-slate-500">
            {guardian.phone} ({guardian.relationship || 'guardian'})
          </p>
          <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-slate-500">
            The family will receive an instant SMS contract notification to approve the
            installment schedule. They reply <code className="font-extrabold">ACCEPT</code>{' '}
            with the 6-character code to activate the plan.
          </p>
        </div>
      </Card>
    )}
  </div>
);

export default CreatePlanForm;
