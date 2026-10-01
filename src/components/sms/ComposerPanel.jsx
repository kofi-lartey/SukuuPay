import React, { useRef } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  CircleDollarSign,
  Info,
  Plus,
  X,
} from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import { formatCediShort, formatCount } from '../../utils/format';

/**
 * Step 2: what it says, and what it costs.
 *
 * The three things a bursar must be able to answer before pressing Send, in one
 * panel, without scrolling: *who* is it going to, *what* will it say, and *how
 * much* will it cost. Everything here serves one of those.
 *
 * **The character counter is the important control.** SMS is billed per segment,
 * not per message: 161 characters is two segments and twice the cost, and the
 * boundary lands in the middle of a sentence. The counter turns amber on the
 * last segment and red past ten, because past ten the send is refused and a
 * user who discovers that at the Send button has already written the message.
 *
 * **The token row appends at the cursor**, not at the end. A bursar writing
 * "Dear {parentName}, {studentName} owes {balance} and must clear it by
 * {dueDate}" needs `dueDate` in the middle, and a composer that only appends
 * forces them to rewrite the sentence around the button.
 */

/** Green under the limit, amber on the last segment, red past the cap. */
const densityTone = (length, perSegment) => {
  if (length > perSegment * 10) return 'red';
  if (length > perSegment) return 'amber';
  return 'brand';
};

const DENSITY_FILL = {
  brand: 'bg-brand-700',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

const ComposerPanel = ({
  body,
  setBody,
  category,
  setCategory,
  tokens,
  tokensInBody,
  unknownTokens,
  rendered,
  segments,
  perSegmentLimit,
  overSegmentLimit,
  estimatedCost,
  affordable,
  balance,
  balanceAfter,
  ratePes,
  matchCount,
  presets,
  applyTemplate,
  templates,
  templateId,
  onDeleteTemplate,
  senderId,
  creditsLoading,
}) => {
  const textareaRef = useRef(null);

  /**
   * Inserts a token where the caret is, not at the end.
   *
   * Saves and restores the selection so the caret does not jump to the end of the
   * textarea after each insert — without that, adding three tokens in a row means
   * the third lands at the bottom and the message has to be rewritten.
   */
  const insertToken = (token) => {
    const field = textareaRef.current;
    const snippet = `{${token}}`;
    if (!field) {
      setBody(`${body}${snippet}`);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${snippet}${body.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + snippet.length;
      field.setSelectionRange(caret, caret);
    });
  };

  const density = densityTone(rendered.length, perSegmentLimit);
  const usedTokens = new Set(tokensInBody);
  // The server's template list carries the four platform presets as well as the
  // school's own. They already have a row of their own above, so the "saved"
  // row is what the school actually wrote.
  const savedTemplates = (templates || []).filter((template) => !template.isPreset);

  return (
    <section aria-label="Compose SMS message" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white">
            2
          </span>
          Compose SMS Message
        </h2>
        <Badge tone="green" icon={BadgeCheck}>
          Instant Delivery
        </Badge>
      </div>

      {/* Sender ID. Shown, not assumed: a bad sender ID is dropped by MTN at the
          handset with no delivery report, so the school is billed for messages
          nobody received. A bursar who can see the ID can spot it is wrong. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-[12px] font-semibold text-slate-600">Sender ID:</span>
        <span className="text-[12px] font-extrabold text-brand-700">
          {senderId || 'SukuuPay'}
        </span>
        <span className="text-[11px] font-semibold text-slate-500">Registered with NCA Ghana</span>
        <Info className="ml-auto h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </div>

      {/* Token row. */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Dynamic Student Tokens
          </p>
          <p className="text-[10px] font-semibold text-slate-400">Click to append to cursor</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tokens.map((entry) => {
            const used = usedTokens.has(entry.token);
            return (
              <button
                key={entry.token}
                type="button"
                onClick={() => insertToken(entry.token)}
                title={entry.label}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition-colors ${
                  used
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-700 hover:text-brand-700'
                }`}
              >
                {used ? <CircleAlert className="h-3 w-3" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                {'{'}
                {entry.token}
                {'}'}
              </button>
            );
          })}
        </div>
      </div>

      {/* An unknown token is a 400 at send time, caught here instead. */}
      {unknownTokens.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-red-700">
            {unknownTokens.map((token) => `{${token}}`).join(', ')}{' '}
            {unknownTokens.length === 1 ? 'is not a token' : 'are not tokens'} this platform
            can fill. It would be sent to parents as written.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-700" htmlFor="sms-body">
          Message body
        </label>
        <textarea
          id="sms-body"
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          placeholder="Dear {parentName}, {studentName} owes GHC {balance}…"
          className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[13px] font-medium leading-relaxed text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
        />

        <div className="mt-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold">
            <span className="text-slate-600">Character Density</span>
            <span
              className={
                density === 'red'
                  ? 'text-red-600'
                  : density === 'amber'
                    ? 'text-amber-600'
                    : 'text-slate-600'
              }
            >
              {formatCount(rendered.length)} / {formatCount(perSegmentLimit)} characters
            </span>
          </div>

          {/* The bar is scaled to a *whole* SMS, not to the character count, so
              it visibly fills at 160 and then keeps going — which is the moment
              the cost doubles. A bar scaled to 1600 would look half-empty at the
              moment that matters. */}
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${DENSITY_FILL[density]}`}
              style={{ width: `${Math.min((rendered.length / perSegmentLimit) * 100, 100)}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
            <span>
              {segments} SMS Part{segments === 1 ? '' : 's'}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>
              {perSegmentLimit === 160 ? 'GSM-7 standard encoding' : 'UCS-2 extended encoding'}
            </span>
            {matchCount > 0 && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>Total Credits: {formatCount(segments * matchCount)} SMS</span>
              </>
            )}
          </div>

          {perSegmentLimit === 70 && (
            <p className="mt-1.5 text-[11px] font-semibold text-amber-700">
              This message contains a character outside GSM-7, so it costs roughly
              twice as much per segment. The typographic apostrophe and the em dash
              are the usual culprits.
            </p>
          )}
          {overSegmentLimit && (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600">
              {segments} parts is over the 10-part limit. A send will be refused — shorten
              the message to {formatCount(perSegmentLimit * 10)} characters.
            </p>
          )}
        </div>
      </div>

      {/* Cost. The one card on this page that spends money, so it leads with the
          figure and the balance that has to cover it. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <CircleDollarSign className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-slate-700">Estimated Broadcast Cost</p>
            <p className="mt-1 text-[22px] font-extrabold leading-none tracking-tight text-ink">
              {estimatedCost === null ? (
                <span className="text-[13px] font-semibold text-slate-400">
                  Choose an audience to cost this
                </span>
              ) : creditsLoading ? (
                <span className="text-[13px] font-semibold text-slate-400">Reading balance…</span>
              ) : (
                formatCediShort(estimatedCost * ratePes)
              )}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
              {estimatedCost === null
                ? `${segments} part${segments === 1 ? '' : 's'} per parent`
                : `Fixed rate GH₵ ${(ratePes / 100).toFixed(2)} per delivered SMS`}
            </p>
          </div>
        </div>

        {estimatedCost !== null && !creditsLoading && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            {affordable ? (
              <p className="text-[11px] font-semibold text-slate-500">
                Balance after:{' '}
                <span className="font-extrabold text-ink">
                  {formatCount(Math.max(balance - estimatedCost, 0))} SMS
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-[11px] font-semibold text-red-600">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                This costs {formatCount(estimatedCost)} SMS and the school has{' '}
                {formatCount(balance)}. Narrow the audience or add credit first.
              </p>
            )}

            {balanceAfter !== null && balanceAfter !== undefined && (
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Last broadcast left {formatCount(balanceAfter)} SMS.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Presets. Applying one replaces the body rather than opening an editor,
          because the composer's textarea *is* the editor — a modal on top of it
          would be two places to type the same message. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          Preset Templates
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyTemplate(preset)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 transition-colors hover:border-brand-700 hover:text-brand-700"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* The school's own saved templates, listed separately so a preset is
            never confused with something they wrote. `templates` is the server
            list, which already includes the four platform presets — they are
            filtered out here or they would appear twice, once above and once
            below, for the same school. */}
        {savedTemplates.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Your saved templates
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {savedTemplates.map((template) => (
                <span
                  key={template._id}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${
                    String(templateId) === String(template._id)
                      ? 'border-brand-700 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <button type="button" onClick={() => applyTemplate(template)} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40">
                    {template.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate?.(template._id)}
                    aria-label={`Delete ${template.name}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500">
          Applying a template replaces the body. Your draft is kept until you send
          or reset, so nothing is lost by looking at a preset.
        </p>
      </div>
    </section>
  );
};

export default ComposerPanel;
