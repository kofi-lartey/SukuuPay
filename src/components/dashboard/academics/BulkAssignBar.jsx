import React, { useState } from 'react';
import { LoaderCircle, Trash2, UserCheck } from 'lucide-react';
import Modal from '../../common/Modal';

/**
 * The selection summary and the two actions it offers.
 *
 * Sticky at the bottom of the panel rather than modal. A bulk action that covers
 * the list it acts on hides the list it acts on — the admin needs to see which
 * rows are ticked while deciding whether to press the button.
 *
 * ## The confirmation, and why the wording is not "are you sure"
 *
 * `Assign` confirms because the commonest mistake is not a mis-click, it is a
 * wrong assumption: an admin who thinks a picker *replaces* a teacher's roster
 * will quietly drop a class's children. So the modal says the opposite out loud
 * — this **adds to** what they already have — and names the teacher and the count
 * so it can be checked against the panel behind it.
 *
 * `Remove` confirms because withdrawing a child's teacher is not undoable from
 * this screen, and because the count of what the server will leave alone is worth
 * knowing before the click rather than after it.
 */
const BulkAssignBar = ({
  selectedIds,
  busy,
  onAssign,
  onRemove,
  teacherName,
  assignedCount = 0,
  classMediatedCount = 0,
}) => {
  const [confirming, setConfirming] = useState(null); // 'assign' | 'remove'
  const [force, setForce] = useState(false);
  if (!selectedIds.length) return null;

  const hasClassRows = classMediatedCount > 0;

  const close = () => {
    if (busy) return;
    setConfirming(null);
    setForce(false);
  };

  const confirm = async () => {
    if (confirming === 'assign') await onAssign(selectedIds);
    if (confirming === 'remove') await onRemove(selectedIds, { force });
    setConfirming(null);
    setForce(false);
  };

  /** Re-run with `force`, for the rows a class assignment created. */
  const forceRemove = async () => {
    await onRemove(selectedIds, { force: true });
    setConfirming(null);
    setForce(false);
  };

  return (
    <>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-[13px] font-extrabold text-amber-900">
          {selectedIds.length} student{selectedIds.length === 1 ? '' : 's'} selected
          <span className="ml-1 font-semibold text-amber-700">
            · {teacherName} already has {assignedCount}
          </span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming('remove')}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove{selectedIds.length > 1 ? ` ${selectedIds.length}` : ''}
          </button>

          <button
            type="button"
            onClick={() => setConfirming('assign')}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === 'assign' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Assign {selectedIds.length}
          </button>
        </div>
      </div>

      {confirming && (
        <Modal
          open
          onClose={close}
          size="sm"
          title={confirming === 'assign' ? `Assign to ${teacherName}?` : `Remove from ${teacherName}?`}
          description={
            confirming === 'assign'
              ? `This adds these ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} on top of what ${teacherName} already has.`
              : `These ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} will no longer be assigned to ${teacherName}.`
          }
          footer={
            <>
              <button
                type="button"
                onClick={close}
                disabled={busy !== null}
                className="rounded-lg px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              {/*
                Two buttons for a removal, because the two cases are different
                decisions and the screen has to make both of them possible.

                The plain Remove takes only the individual picks — the server
                refuses the ones a class assignment created, so ticking a whole
                class and pressing Remove would otherwise do nothing and report a
                count of skipped rows the admin cannot act on. That is exactly the
                dead end this page had: a class's twenty children are all
                class-mediated, so bulk remove was impossible.

                "Remove all N" is the destructive branch, named as such, and it is
                the only place the word "force" is implied rather than spelled out
                to the user — `force` is the server's word, not theirs.
              */}
              <button
                type="button"
                onClick={confirm}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'unassign' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {confirming === 'assign'
                  ? 'Assign'
                  : `Remove ${selectedIds.length - classMediatedCount}`}
              </button>

              {confirming === 'remove' && hasClassRows && (
                <button
                  type="button"
                  onClick={forceRemove}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {busy === 'unassign' && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove all {selectedIds.length}
                </button>
              )}
            </>
          }
        >
          {confirming === 'assign' ? (
            <p className="text-[13px] leading-relaxed text-slate-600">
              A teacher can also be given students through a class. Doing it here does not touch
              those.
            </p>
          ) : (
            <div className="space-y-3">
              {hasClassRows ? (
                <p className="text-[13px] leading-relaxed text-slate-600">
                  {classMediatedCount} of these {selectedIds.length} were assigned through a class
                  assignment. The next button takes only the{' '}
                  {selectedIds.length - classMediatedCount} individual{' '}
                  {selectedIds.length - classMediatedCount === 1 ? 'pick' : 'picks'} and leaves the
                  rest in place.
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-slate-600">
                  These were all picked individually, so all of them go.
                </p>
              )}
              {hasClassRows && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                  "Remove all" also takes the class-assigned ones, which drops those children from
                  every screen that reads this teacher's class — including the portal. Use it when
                  the class assignment itself was wrong, not when a single student has left.
                </p>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

export default BulkAssignBar;
