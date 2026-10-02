import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import Modal from '../../../components/common/Modal';
import { Field, FormAlert } from '../../../components/common/FormField';

/**
 * The maintenance-mode dialog.
 *
 * Three things it has to do that a generic confirm cannot, and each of them is a way the
 * platform goes quiet for the wrong reason:
 *
 *   - **Name the state it is actually setting.** `POST /admin/health/maintenance-mode`
 *     adapts `{enabled: true}` server-side onto the three-state `maintenance.mode`, and
 *     `enabled: true` maps to **`readonly`, never `on`** (`health.service.js:942-949`).
 *     That is not a detail of the implementation: `on` refuses every request under `/api`
 *     — reads included — which for a migration is strictly worse than `readonly`, because
 *     under `readonly` every read still answers and nobody is staring at a 503 wondering
 *     whether to retry, while nothing can be half-written. So the dialog's headline names
 *     `readonly` in those words rather than saying "turn maintenance on", which would be
 *     read as the stronger of the two.
 *
 *     It also says the *other* state is reachable only from Settings, which is where
 *     `maintenance.mode` can be set to `on` deliberately
 *     (`health.service.js:930-933`). An operator who needs the harder state should be able
 *     to find it; they just should not reach it by misreading a button.
 *
 *   - **Require a message.** The server refuses to enable without one, with a 400
 *     (`MAINTENANCE_MESSAGE_REQUIRED`, `health.service.js:988-994`), and it is right to:
 *     `maintenanceDecision` falls back to a generic sentence, so a platform-wide lockout
 *     with nothing to say shows every parent, every bursar and every school's staff
 *     "Something went wrong". The field is validated here too rather than only on submit,
 *     so the operator is told before the round trip — but the server's rule is the real one
 *     and this is only the friendly copy.
 *
 *   - **Name the blast radius.** While `readonly` is on, **every write on the platform is
 *     refused**: a bursar recording a payment gets nothing, an import fails, a webhook
 *     cannot settle. That sentence is the reason somebody who did not mean to press this
 *     presses Cancel.
 *
 * `onConfirm` returns `{ ok, error }` and never throws, per the console's mutation
 * convention, so a failure leaves this dialog open with the operator's message intact
 * rather than closing over what they typed.
 */
const MaintenanceModeDialog = ({ open, currentMode, currentMessage, onClose, onConfirm }) => {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Re-seeded whenever the dialog opens, so a previous attempt's text never survives into
  // the next one. `currentMode` decides the *offered* action: a platform already in `on`
  // has nothing for this switch to do except turn it off.
  useEffect(() => {
    if (!open) return;
    setEnabled(currentMode !== 'off');
    setMessage(currentMessage || '');
    setError(null);
    setSaving(false);
  }, [open, currentMode, currentMessage]);

  const trimmed = message.trim();
  const blocked = enabled && !trimmed;
  const noop = enabled ? currentMode !== 'off' : currentMode === 'off';

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await onConfirm({ enabled, message: trimmed });
    setSaving(false);
    if (result?.ok) {
      onClose();
      return;
    }
    // The dialog stays open, with the message intact, and says why.
    setError(result?.error || 'Maintenance mode could not be changed.');
  };

  const targetMode = !enabled ? 'off' : currentMode === 'on' ? 'on' : 'readonly';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={enabled ? 'Put SukuuPay into maintenance?' : 'Take SukuuPay out of maintenance?'}
      description={
        enabled
          ? 'Every page keeps loading. Every write is refused.'
          : 'Reads and writes both work again immediately.'
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || blocked || noop}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
              enabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-700 hover:bg-brand-800'
            }`}
          >
            {saving ? 'Applying…' : enabled ? 'Enter maintenance' : 'Leave maintenance'}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition-colors hover:bg-slate-50 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-extrabold text-ink">Maintenance mode</span>
            <span className="block text-[11px]/[17px] font-semibold text-slate-500">
              Currently{' '}
              <code className="font-mono font-bold text-slate-700">{currentMode || 'off'}</code>.
              This switch sets it to{' '}
              <code className="font-mono font-bold text-slate-700">{targetMode}</code>.
            </span>
          </span>
        </label>

        {enabled && (
          <>
            {/*
              The blast radius, in the words of someone who is about to have a bursar call
              them. This is the sentence that decides whether somebody who opened this
              dialog by accident presses Cancel.
            */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="flex items-start gap-2 text-[12px]/[19px] font-extrabold text-amber-900">
                <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>While this is on, every write on the platform is refused.</span>
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[11px]/[17px] font-semibold text-amber-900/85">
                <li>Payments cannot be recorded, by anyone, in any school.</li>
                <li>Imports, roster changes and settings writes are all rejected.</li>
                <li>Reads keep working, so nobody sees a 503 and retries blindly.</li>
              </ul>
            </div>

            {currentMode === 'on' && (
              <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[11px]/[17px] font-semibold text-red-700">
                This platform is already fully down (<code className="font-mono">on</code>),
                which refuses reads as well as writes. Leaving this on changes nothing;
                uncheck it to bring the platform back.
              </p>
            )}

            <Field
              label="Message shown to users"
              required
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="We are upgrading SukuuPay and will be back shortly."
              hint={`${message.length}/500`}
            />

            {blocked ? (
              <FormAlert tone="warning">
                A message is required. Every bursar, every parent and every school&rsquo;s
                staff sees it, and with nothing to show them the platform tells them
                &ldquo;Something went wrong&rdquo;.
              </FormAlert>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-[11px]/[17px] font-semibold text-slate-500">
                Users will be shown: &ldquo;{trimmed}&rdquo;
              </p>
            )}
          </>
        )}

        {/*
          The honest note about the state this switch cannot reach. `readonly` is the safe
          state for a migration; `on` refuses reads too and buys nothing operationally that
          a load balancer does not already handle, which is why it is deliberately not one
          click away.
        */}
        {enabled && currentMode !== 'on' && (
          <p className="text-[11px]/[17px] font-medium text-slate-500">
            This switch sets <strong className="font-extrabold">read-only</strong>, not{' '}
            <strong className="font-extrabold">fully down</strong>. Fully down also refuses
            every read, which is not what a migration needs. To use that state, set{' '}
            <code className="font-mono">maintenance.mode</code> in Settings, where the choice
            is made deliberately.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default MaintenanceModeDialog;
