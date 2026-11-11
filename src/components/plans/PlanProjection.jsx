import React from 'react';
import { CalendarDays, CheckCircle2, Flag, Loader2, ShieldCheck } from 'lucide-react';
import Card from '../dashboard/ui/Card';
import Badge from '../dashboard/ui/Badge';
import { formatCedis } from '../../utils/format';

/**
 * The live schedule projection.
 *
 * **Why this is computed in the browser.** A round trip per keystroke and per
 * segmented-control click would make the rail flicker and would freeze the whole
 * form behind the network, on a screen a bursar is expected to use on a phone in a
 * corridor. The maths is four lines, and `services/paymentPlans.js` mirrors the
 * server's `splitAmount` and `addInterval` exactly — including the two behaviours
 * that are easy to get subtly wrong and are the whole reason the mirror is
 * commented: the **last** tranche absorbs the remainder, and a month step **clamps**
 * the day. 31 October + 1 month is 30 November on both sides.
 *
 * The `.mockcheck` assertion "the client and the server agree on the schedule" is
 * what keeps the mirror honest. Without it the two would drift on the first change
 * to either, and the drift would show up as a plan the bursar previewed at
 * GH₵ 550.00 being rejected as a plan for GH₵ 549.99.
 */

const ORDINALS = ['', 'st', 'nd', 'rd', 'th', 'th'];
const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${ORDINALS[n % 10] || 'th'}`;
};

const formatDue = (date) =>
  Number.isNaN(new Date(date).getTime())
    ? '—'
    : new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });

const Tranche = ({ tranche, total }) => {
  const isFinal = tranche.installmentNumber === total;
  const Icon = isFinal ? Flag : tranche.installmentNumber === 1 ? CalendarDays : CheckCircle2;

  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isFinal ? 'bg-ink text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold text-ink">
          {ordinal(tranche.installmentNumber)} Installment
          {isFinal && ' (Final)'}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          Due: {formatDue(tranche.dueDate)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[14px] font-extrabold tabular-nums text-ink">
          GH₵ {formatCedis(tranche.amount)}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">
          Tranche {tranche.installmentNumber}/{total}
        </p>
      </div>
    </li>
  );
};

/**
 * The deposit/structured split bar.
 *
 * Two segments that must add to the term fee. Rendered as a proportion of the
 * *fee*, not of the balance, because that is the relationship being explained: a
 * third of what this child owes has already been banked and two thirds is being
 * spread.
 */
const DepositSplit = ({ figures }) => {
  const total = figures.totalOwed || 0;
  const depositShare = total ? (figures.paidDeposit / total) * 100 : 0;

  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white">
        {depositShare > 0 && (
          <span className="bg-emerald-500" style={{ width: `${depositShare}%` }} />
        )}
        {depositShare < 100 && (
          <span className="flex-1 bg-slate-300" style={{ width: `${100 - depositShare}%` }} />
        )}
      </div>
      <p className="mt-2 text-[11px] font-bold text-slate-600">
        {Math.round(depositShare)}% Initial Deposit Settled
      </p>
      <p className="text-[11px] font-extrabold text-ink">
        {Math.round(100 - depositShare)}% Structured
      </p>
    </div>
  );
};

const PlanProjection = ({
  projection,
  figures,
  loading,
  planName,
  term,
  academicYear,
  schoolName,
  guardian,
}) => {
  const total = projection.length;
  const projected = projection.reduce((sum, tranche) => sum + tranche.amount, 0);

  // The one number that must be right. A mismatch here means the client and the
  // server will disagree, and the server's is the one that counts — so it is
  // surfaced rather than hidden behind a disabled submit.
  const balances = projected === figures.balanceToStructure;

  return (
    <div className="space-y-4">
      <Card padding="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
            <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
              Generated Plan Preview
            </h2>
          </div>
          <Badge tone="green">Live Projection</Badge>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">Total To Recover</p>
              <p className="mt-1 text-[26px] font-extrabold leading-none tracking-tight text-ink">
                GH₵ {formatCedis(figures.balanceToStructure)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-extrabold text-ink">
                {total} Tranche{total === 1 ? '' : 's'}
              </p>
              <p className="text-[11px] font-semibold text-slate-500">100% principal</p>
            </div>
          </div>
        </div>

        {loading && (
          <p className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading the student&rsquo;s balance…
          </p>
        )}

        {!loading && !total && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800">
            There is no outstanding balance to structure. A plan is written against what a
            family still owes, not against the full term fee.
          </p>
        )}

        {total > 0 && (
          <ul className="mt-4 space-y-2">
            {projection.map((tranche) => (
              <Tranche key={tranche.installmentNumber} tranche={tranche} total={total} />
            ))}
          </ul>
        )}

        {total > 0 && (
          <>
            <DepositSplit figures={figures} />

            {!balances && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold text-red-700">
                The tranches add to GH₵ {formatCedis(projected)} but the balance is GH₵{' '}
                {formatCedis(figures.balanceToStructure)}. The server will refuse this plan.
              </p>
            )}
          </>
        )}
      </Card>

      {/* The terms, stated plainly. A school structuring a family's fees over six
          months is making a promise, and the promise belongs somewhere more durable
          than a modal — so it is on screen, next to the numbers, in the language a
          regulator and a parent would both understand. */}
      <Card padding="p-4" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
<div>
          <p className="text-[13px] font-extrabold text-ink">SukuuPay Compliant</p>
          <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-slate-500">
            Collections reconcile against student balances with zero leakage between
            MTN MoMo, Telecel Cash, and school accounts.
            {term && academicYear ? ` Applies to ${term} (${academicYear}) at ${schoolName}.` : ''}
          </p>
        </div>
      </Card>

      {planName && (
        <p className="text-[11px] font-semibold text-slate-500">
          The plan will be saved as{' '}
          <span className="font-extrabold text-ink">{planName}</span>.
        </p>
      )}
    </div>
  );
};

export default PlanProjection;
