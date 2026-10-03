import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Receipt, Sparkles } from 'lucide-react';
import { useStepChrome } from './OnboardingStepContext';
import { listStudents } from '../../services/students';
import { PRICING_PLANS, ROUTES, planForRoster } from '../../utils/constants';

const GHS = (amount) => `GH₵ ${amount.toLocaleString('en-GH')}`;

/**
 * Pricing, inside the setup wizard, between importing the roster and sending the
 * first reminder.
 *
 * ### Why here
 *
 * A plan is quoted by student count, so it can only be said something useful
 * *after* a school has imported the roster that gives the count — which is what
 * makes this the first position where the number means anything. It sits before
 * the reminder rather than after it because the reminder is the first thing the
 * platform does on a school's behalf, and the school should know what it is
 * being charged for before parents are billed and messaged.
 *
 * ### Why this does not let them choose a plan
 *
 * There is no self-service subscription endpoint. The only write is
 * `PUT /admin/schools/:id/subscription`, behind `super_admin`
 * (`Backend/src/routes/admin.routes.js`), and there is no billing integration at
 * all — `subscription.paymentMethod` is an enum with nothing behind it.
 *
 * So a radio group here would be a control that looks like it commits and does
 * not, which is worse than no control: the admin would leave believing their plan
 * had been set. This step therefore **shows** the tiers, sizes them against the
 * roster it just read, and hands the decision to a human. See `PRICING_PLANS` for
 * why the tier names cannot be sent to the server as they stand.
 */
const StepPricing = () => {
  const { register } = useStepChrome();

  const [rosterTotal, setRosterTotal] = useState(null);
  const [loaded, setLoaded] = useState(false);

  /**
   * Roster size, for sizing a tier against.
   *
   * `perPage: 1` because the row is not the point — `meta.total` is. Requesting a
   * hundred students to read a number the server already counted is how a wizard
   * step ends up slow for no visible reason.
   */
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { meta } = await listStudents({ perPage: 1 });
        if (!active) return;
        setRosterTotal(Number(meta?.total) || 0);
      } catch {
        // A roster that cannot be read is not an empty roster, and neither of those
        // is a reason to block setup. Leaving `rosterTotal` null shows the tiers
        // without a recommendation rather than asserting a school has no students.
        if (!active) return;
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Always valid, and never busy: there is nothing on this step to fill in.
   *
   * `onSubmit` resolving `true` is what tells `OnboardingLayout` the step
   * succeeded, so it unlocks the next step and moves on. Returning nothing would
   * read as "did not save" and strand the admin — see `goNext`.
   */
  useEffect(() => {
    register({ valid: true, busy: false, label: 'Continue to reminders', onSubmit: () => true });
  }, [register]);

  const suggested = loaded ? planForRoster(rosterTotal) : null;

  return (
    <div>
      <header className="mb-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 ring-8 ring-brand-50">
          <Receipt className="h-7 w-7 text-brand-700" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          What SukuuPay costs your school
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
          You are on a free trial while you set up. Pick the size that fits your roster when you
          are ready — nothing is charged until you tell us.
        </p>
      </header>

      {/*
        The trial line is stated as a fact about *this* account rather than a
        promise about billing. `school.subscription.plan` defaults to `"trial"` on
        the server and nothing in this wizard changes it, so "you are on a free
        trial" is true; "you will not be charged until X" is not something any code
        here can guarantee.
      */}
      {suggested && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-900">
              {rosterTotal > 0
                ? `With ${rosterTotal.toLocaleString('en-GH')} student${rosterTotal === 1 ? '' : 's'}, ${suggested.name} fits.`
                : `${suggested.name} is the usual starting point.`}
            </p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-brand-800">
              {suggested.capacity} · {GHS(suggested.termly)} per term. Your bursar can change this
              later from Settings.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const isSuggested = suggested?.name === plan.name;

          return (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-soft ${
                isSuggested ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-extrabold text-ink">{plan.name}</h2>
                {isSuggested && (
                  <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-800">
                    Suggested
                  </span>
                )}
              </div>

              <p className="mt-1 text-[12px] font-semibold text-slate-500">{plan.capacity}</p>

              <p className="mt-4 text-2xl font-extrabold text-ink">
                {GHS(plan.termly)}
                <span className="ml-1 text-[12px] font-bold text-slate-500">/ term</span>
              </p>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                or {GHS(plan.monthly)} monthly · {plan.termNote}
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] text-slate-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/*
                Deliberately a link to the public pricing page rather than a
                `<Link>` into the wizard: this is the marketing page's content, and
                the admin can come back — the wizard keeps its progress in
                localStorage and `OnboardingGuard` sends them to the furthest
                unlocked step.
              */}
              <Link
                to={ROUTES.PRICING}
                className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Compare all plans
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[13px] font-medium text-slate-500">
        Not sure which fits?{' '}
        <Link to={ROUTES.CONTACT} className="font-bold text-brand-700 hover:underline">
          Talk to us
        </Link>{' '}
        and we will size it with you.
      </p>
    </div>
  );
};

export default StepPricing;