import { Card, Amount, Stat, ProgressBar, Pill } from './primitives';
import { deadlinePhrase, paidPercent } from '../../utils/parentFormat';

/**
 * What is owed, what has been paid, and by when.
 *
 * The most-watched element on the page, so three decisions are deliberate:
 *
 * ## The hero figure is the *balance*, not the total bill
 *
 * A parent opening this link has already been told the bill somewhere — the SMS, the
 * notice in the bag. What they do not know offhand is how much of it is left. Lead
 * with `totalOwed` and the page answers a question they already had; lead with the
 * balance and it answers the one they came for. The total is still on the page, one
 * row below.
 *
 * ## Colour follows meaning, not decoration
 *
 * Red appears when the account is genuinely overdue, and nowhere else. An accent
 * colour used for emphasis trains a reader to stop reading it, and this page has one
 * job — tell the truth about a debt — so the one red thing on it has to be the true
 * thing.
 *
 * ## "Due in 5 days" leads, the date follows
 *
 * The countdown answers the question being asked. The date is there for a parent who
 * needs to write it on something, or read it to someone who is not looking at this
 * screen.
 */
const BalanceCard = ({ student }) => {
  if (!student) return null;

  const { balance = 0, totalOwed = 0, totalPaid = 0, deadline, isOverdue = false } = student;
  const settled = balance <= 0;
  const percent = paidPercent(totalPaid, totalOwed);
  const phrase = deadlinePhrase(deadline);

  // Progress colour: red once overdue, amber in the last week, brand otherwise.
  // "The last week" rather than "the last 30%", because a term's balance can be
  // cleared in the last month without anyone having been at risk, and a red bar on a
  // bill that is in fact nearly settled costs more trust than it conveys urgency.
  const tone = isOverdue ? 'red' : phrase === 'Due today' || phrase === 'Due tomorrow' ? 'amber' : 'brand';

  return (
    <Card className="overflow-hidden">
      {settled ? (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="mt-4 text-[20px] font-extrabold text-slate-900">All paid up</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
            {student.studentName}&rsquo;s fees are fully settled. Thank you.
          </p>
          {totalPaid > 0 ? (
            <p className="mt-3 text-[13px] text-slate-400">
              Total paid:{' '}
              <Amount pesewas={totalPaid} size="sm" className="inline font-bold" />
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Remaining to pay
                </p>
                <div className="mt-1.5">
                  <Amount
                    pesewas={balance}
                    size="hero"
                    className={isOverdue ? 'text-red-600' : 'text-[#0A5C36]'}
                  />
                </div>
              </div>

              {isOverdue ? (
                <Pill tone="red" className="shrink-0">
                  {phrase}
                </Pill>
              ) : null}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5">
              <Stat label="Total bill">
                <Amount pesewas={totalOwed} size="sm" className="font-bold" />
              </Stat>
              <Stat label="Paid so far" tone="green">
                <Amount pesewas={totalPaid} size="sm" className="font-bold" />
              </Stat>
              <Stat label="Deadline" tone={isOverdue ? 'red' : 'default'}>
                {deadline ? phrase || '—' : 'No deadline set'}
              </Stat>
              <Stat label="Date" tone={isOverdue ? 'red' : 'default'}>
                {deadline ? new Date(deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}
              </Stat>
            </dl>

            <div className="mt-5">
              <ProgressBar paid={totalPaid} owed={totalOwed} tone={tone} />
              <p className="mt-2 text-[12px] font-semibold text-slate-500">
                {percent}% of this bill is settled
              </p>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default BalanceCard;