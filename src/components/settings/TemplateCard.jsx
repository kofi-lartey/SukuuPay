import React from 'react';
import { Copy, Edit, Tag, Trash2, Star } from 'lucide-react';
import { IdCardFront } from '../../components/students/idcards/IdCardPreview';
import { PLACEHOLDER_CARDS } from '../../components/settings/IdCardLivePreview';

const AUDIENCE_COLORS = {
  student: 'bg-blue-100 text-blue-800',
  staff: 'bg-purple-100 text-purple-800',
  prefect: 'bg-amber-100 text-amber-800',
  visitor: 'bg-green-100 text-green-800',
  custom: 'bg-slate-100 text-slate-800',
};

const FIELD_ICONS = {
  showPhoto: '📷',
  showQr: '📱',
  showStamp: '🔖',
  showEmergency: '🚑',
  showGuardian: '👨‍👩‍👧',
  showClass: '🏫',
  showStudentId: '🆔',
};

const TemplateCard = ({ template, onEdit, onDuplicate, onDelete, onSetDefault }) => {
  const audienceColor = AUDIENCE_COLORS[template.audience] || AUDIENCE_COLORS.custom;

  const layoutLabel = template.layout?.sheetLayout === '9up_a4_landscape'
    ? '9 per sheet'
    : '6 per sheet';
  const sidesLabel = template.layout?.sides === 'front_back'
    ? 'Front+Back'
    : 'Front Only';

  const activeFields = Object.entries(template.fields || {})
    .filter(([_, v]) => v)
    .map(([k]) => FIELD_ICONS[k])
    .join(' ');

  const previewCard = {
    ...PLACEHOLDER_CARDS[0],
    studentImage: null,
    qrCodeUrl: null,
    schoolStamp: null,
  };

  const schoolData = {
    name: 'Preview School',
    motto: 'Knowledge is Light',
    logo: null,
  };

  return (
    <div
      className={`relative rounded-xl border-2 bg-white p-4 shadow-sm transition-all ${
        template.isDefault
          ? 'border-brand-700 ring-1 ring-brand-700/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-ink">{template.name}</h3>
            {template.isSystem && (
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                System
              </span>
            )}
            {template.isDefault && (
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded ${audienceColor}`}>
                DEFAULT
              </span>
            )}
          </div>
          <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded ${audienceColor}`}>
            {template.audience}
          </span>
        </div>

        <div className="flex gap-1">
          {!template.isSystem && (
            <>
              <button
                onClick={() => onEdit(template)}
                title="Edit template"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-ink"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDuplicate(template)}
                title="Duplicate template"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-ink"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(template)}
                title="Delete template"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-ink hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          {!template.isSystem && !template.isDefault && (
            <button
              onClick={() => onSetDefault(template)}
              title="Set as default"
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
            >
              <Star className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mini preview */}
      <div className="mb-3 flex justify-center">
        <div className="w-32">
          <IdCardFront
            values={previewCard}
            school={schoolData}
            showPhoto={template.fields?.showPhoto !== false}
            showQr={template.fields?.showQr !== false}
            showStamp={template.fields?.showStamp !== false}
          />
        </div>
      </div>

      {/* Field summary */}
      <div className="mb-3 flex flex-wrap gap-1 text-sm">
        {activeFields ? (
          <span className="text-xs">{activeFields}</span>
        ) : (
          <span className="text-xs text-slate-400">No fields visible</span>
        )}
      </div>

      {/* Layout badge */}
      <div className="flex gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {layoutLabel} · {sidesLabel}
        </span>
        {template.fields?.showPhoto && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            Photo
          </span>
        )}
      </div>
    </div>
  );
};

export default TemplateCard;
