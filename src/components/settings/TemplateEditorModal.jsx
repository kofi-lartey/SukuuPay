import React, { useState } from 'react';
import { X } from 'lucide-react';
import SheetLayoutPicker from './SheetLayoutPicker';
import SidesPicker from './SidesPicker';
import TemplateFieldToggles from './TemplateFieldToggles';
import IdCardLivePreview from './IdCardLivePreview';
import { PLACEHOLDER_CARDS } from './IdCardLivePreview';
import { ID_CARD_AUDIENCES } from '../../utils/constants';
import { SHEET_LAYOUTS, PRINT_SIDES } from '../../utils/constants';
import { resolveCardData } from '../../components/students/idcards/cardContract';

const DEFAULTS = {
  name: '',
  audience: 'student',
  fields: {
    showPhoto: true,
    showQr: true,
    showStamp: true,
    showEmergency: true,
    showGuardian: true,
    showClass: true,
    showStudentId: true,
  },
  layout: {
    sheetLayout: '6up_a4_landscape',
    sides: 'front_back',
    includeCutGuides: false,
  },
  theme: {
    brandColor: null,
    accentColor: null,
  },
  text: {
    termsOverride: null,
    footerLeft: 'SUKUUPAY',
    footerRight: null,
  },
};

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'fields', label: 'Fields' },
  { id: 'layout', label: 'Layout' },
  { id: 'text', label: 'Text' },
];

/**
 * TemplateEditorModal — full-screen modal for creating/editing templates.
 * Tabs: Basics, Fields, Layout, Text. Live preview on the right.
 */
const TemplateEditorModal = ({
  isOpen,
  onClose,
  onSave,
  audience = 'student',
  initialData = null,
}) => {
  const isEdit = Boolean(initialData);
  const [activeTab, setActiveTab] = useState('basics');
  const [formData, setFormData] = useState(
    initialData
      ? {
          name: initialData.name || '',
          audience: initialData.audience || 'student',
          fields: { ...DEFAULTS.fields, ...initialData.fields },
          layout: { ...DEFAULTS.layout, ...initialData.layout },
          theme: { ...DEFAULTS.theme, ...initialData.theme },
          text: { ...DEFAULTS.text, ...initialData.text },
        }
      : { ...DEFAULTS, audience }
  );

  if (!isOpen) return null;

  const handleFieldToggle = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const handleLayoutChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      layout: { ...prev.layout, [field]: value },
    }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }
    onSave(formData);
  };

  const handleSaveAndNew = () => {
    if (!formData.name.trim()) {
      return;
    }
    onSave(formData);
  };

  // Build a card data object for preview based on template settings
  const previewSettings = {
    sheetLayout: formData.layout.sheetLayout,
    sides: formData.layout.sides,
    showQr: formData.fields.showQr,
    showPhoto: formData.fields.showPhoto,
    showStamp: formData.fields.showStamp,
    includeCutGuides: formData.layout.includeCutGuides,
  };

  // Build preview cards with field visibility applied
  const previewCards = PLACEHOLDER_CARDS.slice(0, 9).map((c) => {
    const base = {
      studentId: formData.fields.showStudentId ? c.studentId : '',
      studentName: c.studentName,
      studentClass: formData.fields.showClass ? c.studentClass : '',
      guardianName: formData.fields.showGuardian ? c.guardianName : '',
      guardianPhone: formData.fields.showGuardian ? c.guardianPhone : '',
      emergencyContact: formData.fields.showEmergency ? c.emergencyContact : '',
      studentImage: formData.fields.showPhoto ? c.studentImage : null,
      qrCodeUrl: formData.fields.showQr ? c.qrCodeUrl : null,
      academicYear: c.academicYear,
    };
    return resolveCardData(
      {
        studentName: c.studentName,
        studentId: c.studentId,
        studentClass: c.studentClass,
        studentImage: c.studentImage,
        parents: [{ parentName: c.guardianName, phone: c.guardianPhone, isPrimary: true }],
        emergencyContacts: [{ contactName: 'Auntie Ama', phone: '024 455 6677' }],
      },
      {
        name: 'Preview School',
        logo: null,
        stamp: null,
        motto: 'Knowledge is Light',
        schoolCode: 'PBS',
        brandColor: '#0A5C36',
        academic: { currentYear: '2025/2026' },
      },
      {},
      { fields: formData.fields }
    );
  });

  const previewSchool = {
    name: 'Preview School',
    logo: null,
    stamp: null,
    motto: 'Knowledge is Light',
    schoolCode: 'PBS',
    brandColor: formData.theme.brandColor || '#0A5C36',
    academic: { currentYear: '2025/2026' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white">
        {/* Header */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink">
              {isEdit ? 'Edit Template' : 'New Template'}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex gap-2 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-2 text-sm font-extrabold transition-all ${
                  activeTab === tab.id
                    ? 'border-brand-700 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left — form */}
            <div>
              {activeTab === 'basics' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                      Template name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g. Student ID"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                      Audience
                    </label>
                    <select
                      value={formData.audience}
                      onChange={(e) =>
                        setFormData({ ...formData, audience: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    >
                      {ID_CARD_AUDIENCES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!isEdit && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={formData.isDefault || false}
                        onChange={(e) =>
                          setFormData({ ...formData, isDefault: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                      />
                      <label htmlFor="isDefault" className="text-sm text-slate-700">
                        Set as default for this audience
                      </label>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'fields' && (
                <TemplateFieldToggles
                  fields={formData.fields}
                  onChange={handleFieldToggle}
                  audience={formData.audience}
                />
              )}

              {activeTab === 'layout' && (
                <div className="space-y-5">
                  <SheetLayoutPicker
                    value={formData.layout.sheetLayout}
                    onChange={(v) =>
                      handleLayoutChange('sheetLayout', v)
                    }
                  />
                  <SidesPicker
                    value={formData.layout.sides}
                    onChange={(v) =>
                      handleLayoutChange('sides', v)
                    }
                  />
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Include cut guides</span>
                    <input
                      type="checkbox"
                      checked={formData.layout.includeCutGuides}
                      onChange={(e) =>
                        handleLayoutChange(
                          'includeCutGuides',
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                    />
                  </label>
                </div>
              )}

              {activeTab === 'text' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                      Terms override (optional)
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Replace the default institutional terms. Leave blank to use the default.
                    </p>
                    <textarea
                      value={formData.text.termsOverride || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          text: { ...formData.text, termsOverride: e.target.value },
                        })
                      }
                      placeholder="Custom terms text..."
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                      Footer — left text
                    </label>
                    <input
                      type="text"
                      value={formData.text.footerLeft}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          text: { ...formData.text, footerLeft: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-extrabold text-slate-600">
                      Footer — right text (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.text.footerRight || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          text: { ...formData.text, footerRight: e.target.value },
                        })
                      }
                      placeholder="Defaults to academic year"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right — live preview */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Live preview — updates as you change settings
              </p>
              <div
                className="overflow-auto rounded-xl bg-white p-4 shadow-lg"
                style={{
                  transform: 'scale(0.45)',
                  transformOrigin: 'top left',
                  width: 'fit-content',
                }}
              >
                <IdCardLivePreview
                  settings={previewSettings}
                  school={previewSchool}
                  cards={previewCards}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex justify-between">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAndNew}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
              >
                Save &amp; new
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim()}
                className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEdit ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateEditorModal;
