import React, { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  LoaderCircle,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import Modal from '../common/Modal';
import Card from '../dashboard/ui/Card';
import Badge from '../dashboard/ui/Badge';
import { useToast } from '../../hooks/useToast';
import { useJoinRequests, useJoinRequestActions } from '../../hooks/useJoinRequests';
import { ROLE_LABELS } from '../../utils/constants';
import { formatRelative } from '../../utils/dates';
import { initialsOf } from '../../utils/parentFormat';

/**
 * The approval module: who is waiting to be let in, and the two buttons that
 * decide it.
 *
 * This is the admin half of the join flow. An accountant, a teacher or a viewer
 * who signs up is asked for one thing — a school code — and then parks as
 * `pending` (`POST /schools/join`). This component is where that wait ends: a
 * `school_admin` sees the request, decides, and the applicant is linked to the
 * school in the same server-side transaction that flips the status. Approving
 * here is what grants full access; nothing else in the product does.
 *
 * Why it sits inside User Management rather than on its own route: it is the
 * same question asked from the other side — "who can act in this school?" — and
 * an admin who has just approved a teacher immediately wants to see them in the
 * roster. That is why `onChanged` exists: the parent re-reads the team list so
 * the new member appears without a page reload.
 *
 * The component renders nothing at all when there is no request, decided or
 * pending, for this school. An empty panel that says "no requests" is furniture;
 * one that appears only when there is something to decide is an alert.
 */
const PendingApprovals = ({ onChanged }) => {
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const { pending, decided, loading, error } = useJoinRequests(reloadKey);

  // The row mid-decision, and the optional note that travels with it. Kept in
  // state rather than per-row state so only one decision can be in flight at a
  // time — two admins on one desk, or one admin double-clicking, cannot both
  // think they approved the same person.
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [showDecided, setShowDecided] = useState(false);

  // No `onDone`: the decision handler below calls `refresh()` itself, once the
  // toast has been decided, so a rejected decision and an approved one refresh
  // the queue at the same point instead of at two different ones.
  const actions = useJoinRequestActions();

  const refresh = useCallback(() => {
    setReloadKey((key) => key + 1);
    onChanged?.();
  }, [onChanged]);

  const openDecision = (request, action) => {
    setDecision({ request, action });
    setNote('');
  };

  const closeDecision = () => {
    if (decision && actions.isBusy(`approve:${decision.request._id}`)) return;
    if (decision && actions.isBusy(`reject:${decision.request._id}`)) return;
    setDecision(null);
  };

  const confirmDecision = async () => {
    if (!decision) return;
    const { request, action } = decision;

    const result =
      action === 'approve'
        ? await actions.approve(request._id, note.trim())
        : await actions.reject(request._id, note.trim());

    if (!result.ok) {
      // `409 ALREADY_DECIDED` is not a failure of this admin's action: another
      // admin, in another tab, got there first. The queue is simply stale, so
      // say that and re-read it rather than showing a red banner about a
      // decision that was, in fact, recorded.
      if (result.error?.status === 409) {
        toast.info('Somebody else has already decided that request.');
        setDecision(null);
        refresh();
        return;
      }
      toast.error(result.error?.message || 'We could not record that decision.');
      return;
    }

    toast.success(
      action === 'approve'
        ? `${request.userId?.name || 'They'} now has access to your school.`
        : `${request.userId?.name || 'They'} was not added to your school.`
    );
    setDecision(null);
    refresh();
  };

  if (error) {
    return (
      <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
        {error.message}
      </div>
    );
  }

  if (!loading && pending.length === 0 && decided.length === 0) {
    return null;
  }

  return (
    <Card padding="p-0" className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-[13px] font-extrabold tracking-tight text-ink">
              Pending approvals
              {pending.length > 0 && (
                <Badge tone="amber" icon={Clock}>
                  {pending.length}
                </Badge>
              )}
            </h2>
            <p className="text-[12px] font-medium text-slate-500">
              People who asked to join your school with a school code and are waiting for you.
            </p>
          </div>
        </div>

        {decided.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDecided((open) => !open)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-500 transition-colors hover:bg-white hover:text-ink"
          >
            {showDecided ? 'Hide decided' : `${decided.length} decided`}
          </button>
        )}
      </div>

      {loading && (
        <div className="px-4 py-8 text-center text-[13px] font-semibold text-slate-500">
          <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
          Loading access requests…
        </div>
      )}

      {!loading && pending.length === 0 && decided.length > 0 && (
        <p className="px-4 py-4 text-[13px] font-medium text-slate-500">
          Nobody is waiting. Everyone who asked has been answered.
        </p>
      )}

      {!loading && pending.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {pending.map((request) => {
            const applicant = request.userId || {};
            const role = ROLE_LABELS[applicant.role] || applicant.role || 'Staff member';

            return (
              <li
                key={request._id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[12px] font-extrabold text-white">
                  {initialsOf(applicant.name || request.applicantName)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink">
                    {applicant.name || request.applicantName || 'Unknown applicant'}
                    <Badge tone="slate">{role}</Badge>
                  </p>
                  <p className="truncate text-[12px] font-medium text-slate-500">
                    {applicant.email || 'No email on the account'}
                    {request.applicantPosition || applicant.position
                      ? ` · ${request.applicantPosition || applicant.position}`
                      : ''}
                  </p>
                </div>

                <span className="text-[11px] font-semibold text-slate-400">
                  asked {formatRelative(request.createdAt)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openDecision(request, 'reject')}
                    disabled={actions.isBusy(`reject:${request._id}`) || actions.isBusy(`approve:${request._id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => openDecision(request, 'approve')}
                    disabled={actions.isBusy(`reject:${request._id}`) || actions.isBusy(`approve:${request._id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-extrabold text-white shadow-lift transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actions.isBusy(`approve:${request._id}`) ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Approve
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showDecided && decided.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40">
          {decided.map((request) => {
            const applicant = request.userId || {};
            const approved = request.status === 'approved';

            return (
              <li key={request._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Badge tone={approved ? 'green' : 'slate'} icon={approved ? CheckCircle2 : X}>
                  {approved ? 'Approved' : 'Declined'}
                </Badge>
                <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-600">
                  {applicant.name || request.applicantName || 'Unknown applicant'}
                  {applicant.email ? ` · ${applicant.email}` : ''}
                </p>
                <span className="text-[11px] font-semibold text-slate-400">
                  {approved ? 'approved' : 'declined'} {formatRelative(request.decidedAt || request.updatedAt)}
                  {request.decidedNote ? ` — “${request.decidedNote}”` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        The decision, behind a confirmation.

        Approving grants full access to a school's bursary, students and
        payments, and a mis-click on a name is not distinguishable from a
        deliberate approval after the fact. So the row's action opens this
        instead of firing immediately — and names the person, for the same
        reason the removal modal in this module does.

        The note is optional and shared by both outcomes: it is the only place
        an admin can say *why*, and the one thing they will want to have written
        down six months later.
      */}
      {decision && (
        <Modal
          open
          onClose={closeDecision}
          title={decision.action === 'approve' ? 'Approve access?' : 'Decline request?'}
          description={
            decision.action === 'approve'
              ? 'They will be able to sign in and use everything in your school straight away.'
              : 'They will not be able to sign in to your school. They can ask again with a code.'
          }
          footer={
            <>
              <button
                type="button"
                onClick={closeDecision}
                disabled={
                  actions.isBusy(`approve:${decision.request._id}`) ||
                  actions.isBusy(`reject:${decision.request._id}`)
                }
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDecision}
                disabled={
                  actions.isBusy(`approve:${decision.request._id}`) ||
                  actions.isBusy(`reject:${decision.request._id}`)
                }
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-50 ${
                  decision.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(actions.isBusy(`approve:${decision.request._id}`) ||
                  actions.isBusy(`reject:${decision.request._id}`)) && (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                {decision.action === 'approve' ? (
                  <>
                    <UserCheck className="h-4 w-4" aria-hidden="true" />
                    Approve access
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Decline request
                  </>
                )}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <p className="text-[12px] leading-relaxed text-amber-800">
                A school code identifies a school; it does not prove who somebody is. Approve only
                people you recognise —{' '}
                <span className="font-bold">
                  {decision.request.userId?.name || decision.request.applicantName}
                </span>{' '}
                ({decision.request.userId?.email || 'no email'}).
              </p>
            </div>

            <label className="block">
              <span className="mb-0.5 block text-[11px] font-semibold text-slate-700">
                Note (optional)
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={300}
                placeholder={
                  decision.action === 'approve'
                    ? 'e.g. Confirmed by phone — our new JHS 2 mathematics teacher.'
                    : 'e.g. We already have a bursar; ask them for an invitation instead.'
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
              />
            </label>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default PendingApprovals;
