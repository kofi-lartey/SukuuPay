import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParentPay } from '../../layouts/ParentLayout';
import { requestPaymentPlan } from '../../services/parentPay';
import { Card, Pill, PrimaryButton, Amount, SectionHeading } from '../../components/parent/primitives';
import { PARENT_ROUTES } from '../../utils/constants';
import { formatDate } from '../../utils/parentFormat';
import { isValidGhanaPhone, normalise } from '../../components/common/PhoneInput';

/** What a parent may choose, and why these are the options. */
const INTERVALS = [
  { id: 'monthly', label: 'Monthly', detail: 'Once a month' },
  { id: 'biweekly', label: 'Every 2 weeks', detail: 'Twice a month' },
  { id: 'weekly', label: 'Weekly', detail: 'Every week' },
];

/**
 * `1 → "1st"`, `2 → "2nd"`, `3 → "3rd"`, `11 → "11th"`.
 *
 * A real ordinal rule rather than `${n}th`, which would render a parent a payment
 * plan that says "2th" on the row that matters most. Written out because plan counts
 * are 2–6, so the teens and twenties branches below can never be reached — but they
 * are two lines each and the naive version is the bug.
 */
const ordinal = (n) => {
  const teens = [11, 12, 13];
  if (teens.includes(n % 100)) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  return `${n}${suffix}`;
};

const INSTALLMENT_CHOICES = [2, 3, 4, 6];

/**
 * Today, as `YYYY-MM-DD`, in Ghana's day.
 *
 * `toISOString().slice(0, 10)` is the wrong tool here: it renders in UTC, so a
 * parent in Accra picking tomorrow morning at 00:30 gets *today's* date as the
 * minimum, and the day they can actually choose disappears.
 */
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

/**
 * The schedule this form would produce.
 *
 * **A preview, computed the same way the backend computes it.** It uses the same
 * floor-with-remainder-on-the-last-tranche rule, because that is what the school
 * will actually be asked to approve — and a preview that showed GH₵ 183.33 four
 * times where the backend produces 183.33, 183.33, 183.33, 183.35 is worse than no
 * preview, because a parent who notices the discrepancy stops trusting the form.
 *
 * The remainder goes on the *last* installment. A parent reading four rows wants the
 * rows to add up to the figure above them; absorbing the odd pesewa into the first
 * tranche instead would make the first payment a penny different from every later one
 * and look like a mistake.
 */
const previewSchedule = (balance, count, startDate, intervalDays) => {
  const total = Number(balance) || 0;
  if (total <= 0 || !count || !startDate) return [];

  const per = Math.floor(total / count);
  const remainder = total - per * count;
  const start = new Date(`${startDate}T00:00:00Z`);

  return Array.from({ length: count }, (_, index) => {
    const due = new Date(start);
    due.setUTCDate(due.getUTCDate() + intervalDays * index);

    const amount = index === count - 1 ? per + remainder : per;
    return {
      installmentNumber: index + 1,
      amount,
      dueDate: due.toISOString(),
    };
  });
};

const intervalDaysFor = (interval) =>
  ({ weekly: 7, biweekly: 14, monthly: 30 }[interval] ?? 30);

/**
 * "Ask the school to split this bill."
 *
 * ## Why this form does not produce a plan
 *
 * It produces a *request*. The school approves it, and until then nothing changes
 * about what is owed or when. That is the whole design: the fee schedule is the
 * school's decision, and a form that let a parent write their own repayment terms
 * into force would be a form any parent could use to set a lower one. So the copy
 * never says "your plan is set" — it says the school will review it.
 *
 * ## Why the preview is worth the arithmetic
 *
 * A parent who is asking to split GH₵ 550 into three is asking because GH₵ 183 is
 * what they can manage this month. Showing the three dates and the three figures is
 * what turns "can you help me" into a specific, approvable proposal — and it is the
 * difference between a bursar reading a request and negotiating one.
 */
const RequestPlan = () => {
  const { token, student, school, plan } = useParentPay();

  const balance = student?.balance ?? 0;

  const [count, setCount] = useState(3);
  const [interval, setInterval] = useState('monthly');
  const [startDate, setStartDate] = useState(() => {
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
    return inTwoWeeks.toISOString().slice(0, 10);
  });
  const [parentName, setParentName] = useState(student?.primaryParent?.parentName || '');
  const [parentPhone, setParentPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const schedule = useMemo(
    () => previewSchedule(balance, count, startDate, intervalDaysFor(interval)),
    [balance, count, startDate, interval]
  );

  // The smallest tranche has to be worth collecting — a one-pesewa installment is a
  // network fee and an SMS for nothing. Caught here so the parent is told before
  // submitting, rather than the server refusing after they have written their notes.
  const smallest = schedule.length ? Math.min(...schedule.map((i) => i.amount)) : 0;
  const tooSmallToSplit = smallest < 1;

  const nameError = parentName.trim().length > 0 && parentName.trim().length < 2;
  const phoneError = parentPhone ? !isValidGhanaPhone(parentPhone) : false;

  const canSubmit =
    !submitting &&
    !tooSmallToSplit &&
    parentName.trim().length >= 2 &&
    schedule.length > 0 &&
    !phoneError;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await requestPaymentPlan(token, {
        numberOfInstallments: count,
        interval,
        startDate,
        parentName: parentName.trim(),
        parentPhone: parentPhone ? normalise(parentPhone) : undefined,
        notes: notes.trim() || undefined,
      });

      setDone(response);
    } catch (caught) {
      setError(caught?.message || 'We could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Sent ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="mt-4 text-[21px] font-extrabold tracking-tight text-slate-900">
            Request sent
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">
            {school?.name || 'The school'} has your request and will review it. You will get an
            SMS when it is approved.
          </p>

          <p className="mt-4 rounded-xl bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-600">
            Your fees stay due as they are until the school approves. If the deadline passes while
            you are waiting, contact the bursar&rsquo;s office and mention this request.
          </p>

          <Link
            to={PARENT_ROUTES.portal(token)}
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0A5C36] px-5 text-[15px] font-bold text-white"
          >
            Back to the fee page
          </Link>
        </Card>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-4">
      <Link
        to={PARENT_ROUTES.portal(token)}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-[#0A5C36]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Fee page
      </Link>

      <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">
        Request a payment plan
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
        Can&rsquo;t pay it all at once? Tell us how you would like to split it, and the school
        will review your request.
      </p>

      {/* A plan already in flight makes this whole form wrong to show. */}
      {plan ? (
        <Card className="mt-4 p-5">
          <Pill tone="amber">
            {plan.planStatus === 'active' ? 'You have an active plan' : 'You already have a request'}
          </Pill>
          <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
            {plan.planStatus === 'active'
              ? 'Your fees are already being collected in instalments. You can see the schedule on your fee page.'
              : 'The school has your request and has not confirmed it yet. Please wait — sending another will not speed it up.'}
          </p>
          <Link
            to={PARENT_ROUTES.portal(token)}
            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0A5C36] px-4 text-[14px] font-bold text-white"
          >
            View the schedule
          </Link>
        </Card>
      ) : balance <= 0 ? (
        <Card className="mt-4 p-5 text-center">
          <p className="text-[15px] font-bold text-slate-900">Nothing to split</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
            {student?.studentName}&rsquo;s fees are fully paid. There is nothing left to arrange.
          </p>
        </Card>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          {/* What is being split */}
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Amount to split
            </p>
            <div className="mt-1">
              <Amount pesewas={balance} size="lg" className="text-[#0A5C36]" />
            </div>
            {student?.totalPaid > 0 ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                <Amount
                  pesewas={student.totalPaid}
                  size="sm"
                  className="inline text-[12px] font-bold"
                />{' '}
                of the {student.totalOwed / 100} GHS bill has already been paid. This request
                covers what is left.
              </p>
            ) : null}
          </Card>

          {/* How many */}
          <div>
            <h2 className="mb-2 text-[13px] font-bold text-slate-700">
              How many payments?
            </h2>
            <div role="radiogroup" aria-label="Number of instalments" className="grid grid-cols-4 gap-2">
              {INSTALLMENT_CHOICES.map((choice) => {
                const selected = count === choice;
                return (
                  <label
                    key={choice}
                    className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 text-center transition-colors ${
                      selected
                        ? 'border-[#0A5C36] bg-emerald-50 text-[#0A5C36]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="installments"
                      value={choice}
                      checked={selected}
                      onChange={() => setCount(choice)}
                      className="sr-only"
                    />
                    <span className="text-[19px] font-extrabold tabular-nums leading-none">
                      {choice}
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Payments
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* How often */}
          <div>
            <label htmlFor="plan-interval" className="mb-2 block text-[13px] font-bold text-slate-700">
              How often?
            </label>
            <div className="grid gap-2">
              {INTERVALS.map((option) => {
                const selected = interval === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 transition-colors ${
                      selected ? 'border-[#0A5C36] bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="interval"
                      value={option.id}
                      checked={selected}
                      onChange={() => setInterval(option.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-[#0A5C36]' : 'border-slate-300'
                      }`}
                    >
                      {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#0A5C36]" /> : null}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-bold text-slate-900">{option.label}</span>
                      <span className="block text-[12px] text-slate-500">{option.detail}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* From when */}
          <div>
            <label htmlFor="plan-start" className="block text-[13px] font-bold text-slate-700">
              First payment on
            </label>
            <input
              id="plan-start"
              type="date"
              min={todayISO()}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1.5 min-h-[52px] w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 text-[16px] font-bold text-slate-900 focus:border-[#0A5C36] focus:outline-none"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              The school can move this when they review the request.
            </p>
          </div>

          {/* Preview */}
          <div>
            <SectionHeading>What this would look like</SectionHeading>
            <Card className="overflow-hidden">
              {tooSmallToSplit ? (
                <p className="px-4 py-5 text-center text-[14px] leading-relaxed text-slate-500">
                  {formatCedi(balance)} cannot be split into {count} separate payments that are
                  each worth collecting. Choose fewer payments.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {schedule.map((row) => (
                      <li key={row.installmentNumber} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="text-[14px] font-semibold text-slate-700">
                          {ordinal(row.installmentNumber)}{' '}
                          <span className="font-normal text-slate-500">
                            · {formatDate(row.dueDate)}
                          </span>
                        </span>
                        <Amount pesewas={row.amount} size="sm" className="shrink-0 font-bold" />
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-[13px] font-bold text-slate-700">Total</span>
                    <Amount pesewas={balance} size="sm" className="font-extrabold" />
                  </div>
                </>
              )}
            </Card>
            <p className="mt-2 px-1 text-[12px] leading-relaxed text-slate-500">
              This is only a preview. The school sets the final schedule when they approve.
            </p>
          </div>

          {/* Who is asking */}
          <Card className="space-y-4 p-4">
            <div>
              <label htmlFor="plan-name" className="block text-[13px] font-bold text-slate-700">
                Your name
              </label>
              <input
                id="plan-name"
                type="text"
                value={parentName}
                onChange={(event) => setParentName(event.target.value)}
                autoComplete="name"
                placeholder="e.g. Mrs. Akosua Mensah"
                aria-invalid={Boolean(nameError)}
                className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] text-slate-900 focus:outline-none ${
                  nameError ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              {nameError ? (
                <p className="mt-1 text-[12px] font-semibold text-red-600">Please enter your name</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="plan-phone" className="block text-[13px] font-bold text-slate-700">
                Phone to reach you on
              </label>
              <input
                id="plan-phone"
                type="tel"
                inputMode="tel"
                value={parentPhone}
                onChange={(event) => setParentPhone(normalise(event.target.value))}
                autoComplete="tel-national"
                placeholder="024 XXX XXXX"
                aria-invalid={Boolean(phoneError)}
                className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] font-bold tabular-nums text-slate-900 focus:outline-none ${
                  phoneError ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              {phoneError ? (
                <p className="mt-1 text-[12px] font-semibold text-red-600">
                  Check this mobile number
                </p>
              ) : (
                <p className="mt-1 text-[12px] text-slate-500">
                  Optional, but it is how the school will tell you the outcome.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="plan-notes" className="block text-[13px] font-bold text-slate-700">
                Anything the school should know?{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="plan-notes"
                rows={3}
                value={notes}
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. I sell provision at the market; I can pay in the mornings."
                className="mt-1.5 w-full rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-slate-900 focus:border-[#0A5C36] focus:outline-none"
              />
              <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">
                {notes.length}/500
              </p>
            </div>
          </Card>

          {error ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-[13px] font-semibold leading-relaxed text-red-800 ring-1 ring-inset ring-red-200"
            >
              {error}
            </div>
          ) : null}

          <PrimaryButton type="submit" full disabled={!canSubmit}>
            {submitting ? 'Sending…' : 'Send this request to the school'}
          </PrimaryButton>

          <p className="-mt-1 text-center text-[12px] leading-relaxed text-slate-500">
            Your fees are not changed until the school approves. You will get an SMS either way.
          </p>
        </form>
      )}
    </div>
  );
};

export default RequestPlan;