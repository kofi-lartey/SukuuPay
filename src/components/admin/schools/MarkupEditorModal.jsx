import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Percent, TriangleAlert } from 'lucide-react';
import Modal from '../../common/Modal';
import { Field, FormAlert } from '../../common/FormField';
import { listAllPayments, updateMarkup } from '../../../services/admin';
import { formatCedi, formatCount } from '../../../utils/format';

/**
 * The server's own bounds on `platformMarkupPercent`, from `updateMarkupSchema`
 * (`Backend/src/validations/admin.schools.validation.js:45`) and the identical
 * re-check in `updateSchoolMarkup` (`services/admin/schools.service.js:626`).
 * Duplicated rather than imported — the frontend cannot import backend modules — and
 * worth stating in two places, because a control that lets somebody type 140 and
 * 422 at submit has made the API's rule look arbitrary.
 */
const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

/**
 * The example amount every markup change is explained against.
 *
 * GH₵ 100 rather than a round 50 or a realistic 250 because it is the one figure
 * a parent-facing explanation already uses, and because at a double-digit rate it
 * produces a round cedis result (GH₵ 100 → GH₵ 112 at 12%) that can be checked in
 * the head. A figure chosen to look impressive makes the skim look impressive.
 */
const EXAMPLE_PESEWAS = 10000;

const toPesewas = (cedis) => Math.round(cedis * 100);

/**
 * Change the platform's cut of every future payment for one school.
 *
 * **This dialog's job is to prevent one specific misreading.** The endpoint returns
 * a warning naming how many payments are in flight, and the obvious reading of "12
 * unsettled payments affected" is "these twelve will be re-priced". They will not be.
 * `updateSchoolMarkup` is prospective by construction: a `completed` payment was
 * already split, receipted and reported to the school at the rate in force when the
 * parent paid, and re-pricing it would be an accounting event rather than a settings
 * change — it would also silently disagree with the `DisbursementBatch` amounts frozen
 * at approval (`schools.service.js:603-624`). Only `pending` and `processing`
 * payments move, because that money has not landed and the rate has not been taken.
 *
 * So the copy says it twice: once in the standing warning above the fields, and once
 * beside the in-flight figure, which is the number the eye actually lands on.
 *
 * **On the ordering of the warning — the one place this dialog does not do what it
 * was asked to do, and why.** The brief was to show the endpoint's `warnings` *before*
 * confirming. They cannot be: `updateSchoolMarkup` computes the in-flight count,
 * writes, `await school.save()`, and only then returns `warnings` in the same payload
 * (`schools.service.js:634-666`). There is no dry-run or preview route, and
 * `src/services/*` is not editable from this screen. So the pre-confirm figure is
 * derived client-side from `listAllPayments({ schoolId, status })`, whose `totals`
 * are a sum over the *matched* set rather than over the loaded page — summed across
 * `pending` and `processing` because those are the two statuses the server counts,
 * and labelled as a client-side estimate. The server's own `warnings` are then shown
 * after the write, in the same dialog, as the authoritative record of what the change
 * actually did. Both numbers appear, each labelled by which one it is, rather than
 * the alternative of showing one and letting the reader assume it is the other.
 */
const MarkupEditorModal = ({ open, school, currentPercent, onClose, onConfirmed }) => {
  const [percent, setPercent] = useState(() => String(currentPercent ?? 0));
  const [inFlight, setInFlight] = useState({ state: 'idle', count: null, amount: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  /*
   * Reset on open, keyed on the school rather than on `open`.
   *
   * Opening the dialog for a different school must show that school's rate and
   * clear the previous outcome, and keying only on `open` would leave the last
   * school's warnings on screen behind the next school's name.
   */
  useEffect(() => {
    if (!open) return;
    setPercent(String(currentPercent ?? 0));
    setError(null);
    setResult(null);
    setInFlight({ state: 'idle', count: null, amount: 0 });
  }, [open, school?._id, currentPercent]);

  /**
   * The pre-confirm in-flight estimate.
   *
   * `perPage: 1` on purpose: `listAllPayments` returns rows *and* `totals`, and the
   * totals are computed over the matched set, so one row is enough to learn how much
   * money is sitting in `pending`. Asking for 20 rows to throw 19 of them away would
   * be a request made fatter for no gain.
   *
   * A failure here degrades to `state: 'error'` and the dialog says the estimate is
   * unavailable. It does not block the save: refusing to change a rate because a
   * counter could not be read would be worse than changing it with less warning,
   * and the server's own `warnings` arrive regardless.
   */
  useEffect(() => {
    if (!open || !school?._id) return undefined;
    let active = true;

    setInFlight({ state: 'loading', count: null, amount: 0 });

    Promise.all([
      listAllPayments({ schoolId: school._id, status: 'pending', page: 1, perPage: 1 }),
      listAllPayments({ schoolId: school._id, status: 'processing', page: 1, perPage: 1 }),
    ])
      .then(([pending, processing]) => {
        if (!active) return;
        setInFlight({
          state: 'ready',
          count: Number(pending.totals?.count || 0) + Number(processing.totals?.count || 0),
          amount: Number(pending.totals?.amount || 0) + Number(processing.totals?.amount || 0),
        });
      })
      .catch(() => {
        if (!active) return;
        setInFlight({ state: 'error', count: null, amount: 0 });
      });

    return () => {
      active = false;
    };
  }, [open, school?._id]);

  const parsed = percent.trim() === '' ? null : Number(percent);
  const valid = parsed !== null && Number.isFinite(parsed) && parsed >= MIN_PERCENT && parsed <= MAX_PERCENT;
  const changed = valid && parsed !== Number(currentPercent);

  const example = useMemo(() => {
    if (!valid) return null;
    return {
      from: EXAMPLE_PESEWAS,
      to: toPesewas((EXAMPLE_PESEWAS / 100) * (1 + parsed / 100)),
    };
  }, [parsed, valid]);

  const submit = async () => {
    if (!valid || !changed) return;

    setBusy(true);
    setError(null);
    try {
      const response = await updateMarkup(school._id, parsed);
      setResult(response || {});
      onConfirmed?.(parsed);
    } catch (caught) {
      // Never thrown out of a confirm handler: the dialog stays open with the number
      // the operator typed, which is the whole point of the `{ ok, error }` contract.
      setError(caught.message || 'The markup could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  if (!school) return null;

  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change the platform markup"
      description={`${school.name} · currently ${Number(currentPercent ?? 0)}% of every payment.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={submit}
              disabled={busy || !valid || !changed}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Percent className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? 'Saving…' : 'Change markup'}
            </button>
          )}
        </>
      }
    >
      {result ? (
        /*
          The post-write record. `updateMarkup` returns `warnings` describing what the
          change actually did, and it is shown here rather than in a toast because a
          toast disappears and this is the sentence an operator needs when the school
          calls to ask why their cedi figure moved.
        */
        <div className="space-y-3">
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3">
            <p className="text-[13px] font-extrabold text-brand-800">
              Markup is now {parsed}% for {school.name}.
            </p>
            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-brand-800/80">
              Payments already collected keep the rate they were charged at. Only new payments are
              affected.
            </p>
          </div>

          {warnings.length === 0 ? (
            <p className="text-[12px] font-semibold text-slate-500">
              The server reported no unsettled payments for this school.
            </p>
          ) : (
            warnings.map((warning, index) => (
              <div
                key={warning.code || index}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3"
              >
                <p className="flex items-start gap-2 text-[12px] font-extrabold text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  What this change touched
                </p>
                <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-amber-800/90">
                  {warning.message}
                </p>
                <p className="mt-1.5 text-[12px] font-bold text-amber-800">
                  In flight: {formatCount(warning.inFlightPaymentCount)} payments worth{' '}
                  {formatCedi(warning.inFlightAmount)} · already collected and unchanged:{' '}
                  {formatCount(warning.collectedPaymentCount)}
                </p>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* The standing warning. Above the fields, not below. */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="text-[13px] font-extrabold text-amber-800">
              Payments already collected keep the rate they were charged at
            </p>
            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-amber-800/90">
              This change is prospective. <strong>Only new payments are affected.</strong> Nothing
              already collected is re-priced, and the school&rsquo;s receipts and reports for past
              payments stay exactly as they were issued.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Current markup"
              value={`${Number(currentPercent ?? 0)}%`}
              readOnly
              hint="set by the platform"
            />
            <Field
              label="New markup"
              required
              type="number"
              min={MIN_PERCENT}
              max={MAX_PERCENT}
              step="0.1"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              placeholder="12"
              hint={`${MIN_PERCENT}–${MAX_PERCENT}%`}
              error={
                percent.trim() !== '' && !valid
                  ? `A markup between ${MIN_PERCENT} and ${MAX_PERCENT} is required`
                  : null
              }
            />
          </div>

          {example && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                What a parent pays
              </p>
              <p className="mt-1.5 text-[15px] font-extrabold tabular-nums text-ink">
                {formatCedi(example.from)} → {formatCedi(example.to)} at {parsed}%
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {formatCedi(example.to - example.from)} of every GH₵ 100 collected goes to SukuuPay.
                The school receives {formatCedi(example.from)}.
              </p>
            </div>
          )}

          {/*
            The in-flight estimate, and its honest label. Two distinct failure states —
            still loading, and unavailable — because "0 in flight" and "we could not
            ask" must not look the same; the first is reassurance and the second is the
            absence of it.
          */}
          <div className="mt-3 rounded-xl border border-slate-200 px-3.5 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Payments still in flight
            </p>

            {inFlight.state === 'loading' && (
              <p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Counting unsettled payments…
              </p>
            )}

            {inFlight.state === 'error' && (
              <p className="mt-1.5 text-[12px] font-semibold text-slate-500">
                This count could not be read from the payments list. The change will still go
                through, and the server reports the same figure back afterwards.
              </p>
            )}

            {inFlight.state === 'ready' && (
              <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-slate-600">
                <strong className="font-extrabold text-ink">
                  {formatCount(inFlight.count)} payment{inFlight.count === 1 ? '' : 's'}
                </strong>{' '}
                worth {formatCedi(inFlight.amount)} have not settled yet. Those are the only payments
                this change moves; everything already collected keeps its original rate.
              </p>
            )}

            <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
              Estimated from the pending and processing payment lists, before saving.
            </p>
          </div>

          {error && (
            <div className="mt-3">
              <FormAlert tone="error">{error}</FormAlert>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default MarkupEditorModal;