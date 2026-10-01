import React, { useState } from 'react';
import { CircleAlert, Loader2, Save, Trash2 } from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import Button from '../common/Button';
import Card from '../dashboard/ui/Card';
import Modal from '../common/Modal';
import { Field, SelectField, FormAlert } from '../common/FormField';
import { renderBodyLocally, countSegments, extractTokens } from '../../services/sms';
import { SMS_TOKENS } from '../../hooks/useSmsReminders';
import { formatCount } from '../../utils/format';

/**
 * The Templates tab: the school's own reminder bodies, plus the four presets.
 *
 * Split in two because they are not the same thing and conflating them was the
 * trap. The presets belong to the platform — editable in the sense that a school
 * can *derive* from them, never in the sense that editing one changes it for
 * everybody. The server refuses that (`PRESET_TEMPLATE_IMMUTABLE`); showing them
 * in the same list with a delete button would be a lie the server has to correct
 * with a 403.
 *
 * So the presets are read-only reference cards with an "Edit a copy" action, and
 * the school's own templates are the ones with a pencil and a bin.
 */

const CATEGORY_TONES = {
  fee_reminder: 'blue',
  overdue: 'amber',
  final_warning: 'red',
  installment_due: 'brand',
  payment_receipt: 'green',
  announcement: 'slate',
  pta: 'brand',
  custom: 'slate',
};

const CATEGORY_LABELS = {
  fee_reminder: 'Fee Reminder',
  overdue: 'Overdue',
  final_warning: 'Final Warning',
  installment_due: 'Installment Due',
  payment_receipt: 'Payment Receipt',
  announcement: 'Announcement',
  pta: 'PTA',
  custom: 'Custom',
};

/** The categories a school may file a template under. */
const CATEGORIES = Object.keys(CATEGORY_LABELS);

const EditTemplateModal = ({ open, template, onClose, onSave, saving }) => {
  const [name, setName] = useState(template?.name || '');
  const [body, setBody] = useState(template?.body || '');
  const [category, setCategory] = useState(template?.category || 'custom');
  const [error, setError] = useState(null);

  // Re-seed when the modal opens on a different template. Without this, closing
  // a template and opening another leaves the previous one's text in the form —
  // and saving then overwrites the wrong template.
  const [seededFor, setSeededFor] = useState(null);
  if (open && seededFor !== (template?._id || 'new')) {
    setName(template?.name || '');
    setBody(template?.body || '');
    setCategory(template?.category || 'custom');
    setSeededFor(template?._id || 'new');
  }

  // Checked here as well as server-side, so a typo is caught while the modal is
  // open rather than on a later send. The list is the same `SMS_TOKENS` the
  // composer's token row is built from, so the two cannot disagree about what is
  // a token.
  const unknown = extractTokens(body).filter(
    (token) => !SMS_TOKENS.some((entry) => entry.token === token)
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Give the template a name.');
      return;
    }
    if (unknown.length) {
      setError(`Remove or fix: ${unknown.map((t) => `{${t}}`).join(', ')}`);
      return;
    }
    setError(null);
    try {
      await onSave({ name: name.trim(), body, category });
      onClose();
    } catch (err) {
      setError(err?.message || 'The template could not be saved.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template?._id ? 'Edit template' : 'Save as a template'}
      description="Tokens in braces are filled per parent at send time."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <Field
          label="Name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Term 1 Reminder"
        />

        <SelectField
          label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABELS[key]}
            </option>
          ))}
        </SelectField>

        <div>
          <label className="mb-0.5 block text-[11px]/[15px] font-semibold text-slate-700" htmlFor="tpl-body">
            Message body <span className="text-red-600">*</span>
          </label>
          <textarea
            id="tpl-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-[13px]/[18px] font-medium text-ink placeholder:font-normal placeholder:text-slate-500 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
          />
          <p className="mt-1 text-[10px]/[14px] font-medium text-slate-500">
            {formatCount(body.length)} characters &middot; {countSegments(body)} SMS part
            {countSegments(body) === 1 ? '' : 's'}
          </p>
        </div>
      </form>
    </Modal>
  );
};

const TemplateCard = ({ template, own, onUse, onEdit, onDelete, busy }) => {
  const segments = countSegments(template.body);

  return (
    <Card padding="p-4" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-extrabold text-ink">{template.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={CATEGORY_TONES[template.category] || 'slate'}>
              {CATEGORY_LABELS[template.category] || template.category}
            </Badge>
            {template.isPreset && <Badge tone="slate">Platform preset</Badge>}
            <Badge tone={segments > 1 ? 'amber' : 'green'}>
              {segments} part{segments === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-[12px] font-medium leading-relaxed text-slate-600">
        {template.body}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onUse}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-brand-800"
        >
          Use in composer
        </button>

        {own ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label={`Delete ${template.name}`}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Edit a copy
          </button>
        )}
      </div>
    </Card>
  );
};

const TemplatesTab = ({
  templates,
  presets,
  loading,
  onUse,
  onSave,
  onDelete,
}) => {  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  // The server's saved templates, with the platform presets the client also
  // knows about filtered out — `?own=true` is the composer's "Saved" list, and
  // the presets are appended below it as reference cards.
  const own = (templates || []).filter((template) => !template.isPreset);

  const save = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(payload, editing);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setBusyId(id);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err?.message || 'The template could not be deleted.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-red-700">{error}</p>
        </div>
      )}

      <section aria-label="Your templates">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-ink">Your templates</h2>
          <button
            type="button"
            onClick={() => setEditing({ name: '', body: '', category: 'custom' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-50"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            New template
          </button>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading templates…
          </p>
        )}

        {!loading && !own.length && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
            You have not saved any templates yet. Compose a reminder and save it, or
            start from one of the presets below.
          </p>
        )}

        {own.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {own.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                own
                busy={busyId === template._id}
                onUse={() => onUse(template)}
                onEdit={() => setEditing(template)}
                onDelete={() => remove(template._id)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Platform presets">
        <h2 className="mb-1 text-sm font-extrabold text-ink">Platform presets</h2>
        <p className="mb-3 text-[12px] font-medium text-slate-500">
          These four ship with SukuuPay and are the same for every school.
          &ldquo;Edit a copy&rdquo; saves your version without changing the original.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((preset) => (
            <TemplateCard
              key={preset.key}
              template={preset}
              onUse={() => onUse(preset)}
              // "Edit a copy" opens the blank-ish editor seeded with the preset,
              // saving as a new template rather than patching the original.
              onEdit={() =>
                setEditing({
                  name: `${preset.name} (copy)`,
                  body: preset.body,
                  category: preset.category,
                })
              }
            />
          ))}
        </div>
      </section>

      <EditTemplateModal
        open={Boolean(editing)}
        template={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        saving={saving}
      />
    </div>
  );
};

export default TemplatesTab;
