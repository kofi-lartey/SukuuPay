import React from 'react';
import { BellRing, CheckCircle2, Eye, Loader2, Send } from 'lucide-react';

const PlanRowActions = ({ plan, busy, onView, onChase, onAccept }) => {
  const status = plan.complianceStatus || plan.planStatus;

  const isSettled = ['completed', 'cancelled', 'expired'].includes(status) || plan.planStatus === 'completed';
  const isOverdue = status === 'overdue' || status === 'defaulted';
  const isDueSoon = status === 'approaching_due';
  const isAwaiting = status === 'pending_acceptance';

  if (busy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Working…
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isOverdue ? (
        <button
          type="button"
          onClick={onChase}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-red-700"
        >
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          Push MoMo Chaser
        </button>
      ) : isAwaiting ? (
        <>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Accept
          </button>
          <button
            type="button"
            onClick={onChase}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-amber-600"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Send MoMo Prompt
          </button>
        </>
      ) : isDueSoon ? (
        <button
          type="button"
          onClick={onChase}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-amber-600"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          Send MoMo Prompt
        </button>
      ) : null}

      <button
        type="button"
        onClick={onView}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${
          isSettled
            ? 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            : 'border border-slate-300 bg-slate-100 text-ink hover:bg-slate-200'
        }`}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        View Schedule
      </button>
    </div>
  );
};

export default PlanRowActions;
