import React, { useState } from 'react';
import {
  Archive,
  Ban,
  CirclePlay,
  Link,
  PencilLine,
  RotateCcw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Field, FormAlert, SelectField } from '../common/FormField';
import MoneyInput from '../common/MoneyInput';
import { formatCount } from '../../utils/format';

/**
 * The bulk action bar.
 *
 * Appears only when something is selected, and states the scope in words before
 * any action runs: "20 students on this page" versus "every student matching
 * your filters". The two are genuinely different operations — one sends ids, the
 * other sends a filter — and a bursar who believes "select all" archived a
 * thousand people when it archived twenty has to restore them one by one.
 *
 * Every action previews first. `dryRun` runs the server's own code path and
 * returns what *would* change, so the confirm dialog shows the real matched
 * count and any refusals rather than an optimistic guess.
 */
const BulkActionBar = ({ selection, onDone, onError }) => {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  // Bulk update
  const [update, setUpdate] = useState({ field: 'totalOwed', totalOwed: null, deadline: '' });
  // Bulk archive
  const [reason, setReason] = useState('');
  // Bulk status
  const [status, setStatus] = useState('suspended');
  const [statusReason, setStatusReason] = useState('');

  if (!selection.hasSelection) return null;

  const scopeLabel = selection.allMatching
    ? 'every student matching your filters'
    : `${formatCount(selection.selected.size)} selected student${selection.selected.size === 1 ? '' : 's'}`;

  const close = () => {
    setDialog(null);
    setPreview(null);
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      const result = await fn();
      onDone(result);
      close();
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Sticky, so it stays reachable with a long roster scrolled away. */}
      <div className="sticky bottom-4 z-20 mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lift sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={selection.clear}
            aria-label="Clear selection"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="min-w-0 text-[13px] font-bold text-slate-600">
            <span className="font-extrabold text-ink">
              {selection.allMatching ? 'All filtered students' : `${formatCount(selection.selected.size)} selected`}
            </span>
            {selection.allMatching && (
              <span className="ml-2 text-[12px] font-semibold text-amber-700">
                includes students not visible on this page
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BulkButton icon={PencilLine} onClick={() => setDialog('update')}>
            Update
          </BulkButton>
          <BulkButton icon={Ban} onClick={() => setDialog('status')}>
            Suspend / Reactivate
          </BulkButton>
          <BulkButton icon={Link} onClick={() => setDialog('paylinks')}>
            Pay links
          </BulkButton>
          <BulkButton icon={Archive} danger onClick={() => setDialog('archive')}>
            Archive
          </BulkButton>
        </div>
      </div>

      {/* ── Bulk update ── */}
      <Modal
        open={dialog === 'update'}
        onClose={close}
        title={`Update ${scopeLabel}?`}
        description="This writes the same value to every selected student."
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || (update.field === 'totalOwed' && update.totalOwed === null) || (update.field === 'deadline' && !update.deadline)}
              onClick={async () => {
                setBusy(true);
                try {
                  const payload =
                    update.field === 'totalOwed'
                      ? { totalOwed: update.totalOwed }
                      : { deadline: update.deadline };
                  const result = await onDone.previewBulkUpdate(selection.target, payload);
                  setPreview(result);
                } catch (err) {
                  onError(err);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Preview change
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {update.field === 'totalOwed' && (
            <MoneyInput
              label="New total owed"
              hint="Enter cedis"
              required
              value={update.totalOwed}
              onChange={(value) => setUpdate((u) => ({ ...u, totalOwed: value }))}
            />
          )}
          {update.field === 'deadline' && (
            <Field
              label="New deadline"
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={update.deadline}
              onChange={(event) => setUpdate({ ...update, deadline: event.target.value })}
            />
          )}

          {preview ? (
            <FormAlert tone="info">
              <span className="font-extrabold">{formatCount(preview.matched)} students</span> match your
              selection and will be updated. {formatCount(preview.unchanged || 0)} already have this
              value and will not change.
            </FormAlert>
          ) : (
            <FormAlert tone="warning">
              <TriangleAlert className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
              You are about to change {update.field} on {scopeLabel}.
            </FormAlert>
          )}
        </div>

        {preview && (
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Change value
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  onDone.bulkUpdate(selection.target, {
                    [update.field]:
                      update.field === 'totalOwed' ? update.totalOwed : update.deadline,
                  })
                )
              }
            >
              Update {formatCount(preview.matched)} students
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Bulk archive ── */}
      <Modal
        open={dialog === 'archive'}
        onClose={close}
        title={`Archive ${scopeLabel}?`}
        description="They leave the roster. Payment history is kept, and this can be undone."
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => run(() => onDone.bulkArchive(selection.target, { reason }))}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Archive {selection.allMatching ? 'all filtered' : `${formatCount(selection.selected.size)} students`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Reason"
            hint="optional, but useful later"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Transferred to another school"
          />
          <FormAlert tone="warning">
            Students with an outstanding balance are refused rather than archived, because
            archiving someone who still owes a term&apos;s fees is how a school loses track of
            who to chase. The response will list them.
          </FormAlert>
        </div>
      </Modal>

      {/* ── Bulk status ── */}
      <Modal
        open={dialog === 'status'}
        onClose={close}
        title={`Change status for ${scopeLabel}?`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => onDone.bulkStatus(selection.target, status, { reason: statusReason }))}
            >
              <CirclePlay className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Apply to{' '}
              {selection.allMatching ? 'all filtered' : `${formatCount(selection.selected.size)} students`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="New status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="suspended">Suspended</option>
            <option value="active">Active (reactivate)</option>
          </SelectField>

          {status === 'suspended' && (
            <Field
              label="Reason"
              hint="required for a suspension"
              required
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="e.g. Fees unpaid for two terms"
            />
          )}

          <FormAlert tone="info">
            Only students currently in a state that allows this change are affected. Archived
            students must be restored instead, and the response lists anyone skipped.
          </FormAlert>
        </div>
      </Modal>

      {/* ── Bulk pay links ── */}
      <Modal
        open={dialog === 'paylinks'}
        onClose={close}
        title={`Regenerate pay links for ${scopeLabel}?`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => onDone.bulkPayLinks(selection.target))}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Regenerate
            </Button>
          </>
        }
      >
        <p className="text-sm font-semibold text-slate-600">
          Every existing link for these students stops working immediately. Use this when a link
          has been shared outside the school, not as a routine action.
        </p>
      </Modal>
    </>
  );
};

const BulkButton = ({ icon: Icon, children, danger, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-extrabold transition-colors ${
      danger
        ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`}
  >
    <Icon className="h-4 w-4" aria-hidden="true" />
    {children}
  </button>
);

export default BulkActionBar;
