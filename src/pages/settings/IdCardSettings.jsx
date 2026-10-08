import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, RotateCcw, Eye, Loader2 } from 'lucide-react';
import Card from '../../components/dashboard/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { useIdCardSettings } from '../../hooks/useIdCardSettings';
import { getLatestBatch } from '../../services/idCards';
import SheetLayoutPicker from '../../components/settings/SheetLayoutPicker';
import SidesPicker from '../../components/settings/SidesPicker';
import IdCardLivePreview from '../../components/settings/IdCardLivePreview';
import { DEFAULT_ID_CARD_SETTINGS } from '../../components/students/idcards/cardContract';

const IdCardSettings = () => {
  const { user } = useAuth();
  const { success, error: errorToast } = useToast();
  const schoolId = user?.schoolId;

  const { settings: savedSettings, loading, loadError, saving, saveError, load, save, reset } =
    useIdCardSettings(schoolId);

  const [form, setForm] = useState({ ...DEFAULT_ID_CARD_SETTINGS });
  const [hasChanges, setHasChanges] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedSettings || DEFAULT_ID_CARD_SETTINGS);

  // Load saved settings on mount
  useEffect(() => {
    load();
  }, [load]);

  // Sync form when saved settings load
  useEffect(() => {
    if (savedSettings && !hasChanges) {
      setForm(savedSettings);
    }
  }, [savedSettings, hasChanges]);

  // Handle change
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Load latest batch for preview data
  const loadPreviewData = useCallback(async () => {
    if (!schoolId) return;
    setLoadingPreview(true);
    try {
      const data = await getLatestBatch(schoolId);
      setPreviewData(data);
    } catch (err) {
      // Use placeholder data if no batches exist
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadPreviewData();
  }, [loadPreviewData]);

  const handleSave = async () => {
    await save(form);
    setHasChanges(false);
  };

  const handleReset = () => {
    if (window.confirm('Reset all ID card settings to defaults?')) {
      setForm({ ...DEFAULT_ID_CARD_SETTINGS });
      setHasChanges(true);
    }
  };

  const previewCards = previewData?.cards || [];
  const previewSchool = previewData?.school;

  if (loading && !savedSettings) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-slate-200" />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="h-96 rounded bg-slate-200" />
              <div className="h-96 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl bg-red-50 p-4">
            <p className="font-semibold text-red-900">{loadError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-extrabold text-ink">ID Card Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure layout, print sides, and field visibility with a live preview.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left column — Config panel */}
          <div className="space-y-5">
            <Card padding="p-5">
              <SheetLayoutPicker
                value={form.sheetLayout}
                onChange={(v) => handleChange('sheetLayout', v)}
              />
            </Card>

            <Card padding="p-5">
              <SidesPicker
                value={form.sides}
                onChange={(v) => handleChange('sides', v)}
              />
            </Card>

            <Card padding="p-5">
              <h3 className="mb-3 text-sm font-extrabold text-ink">Card Options</h3>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Show QR code on front</span>
                  <input
                    type="checkbox"
                    checked={form.showQr}
                    onChange={(e) => handleChange('showQr', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Show student photo on front</span>
                  <input
                    type="checkbox"
                    checked={form.showPhoto}
                    onChange={(e) => handleChange('showPhoto', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Show school stamp on front</span>
                  <input
                    type="checkbox"
                    checked={form.showStamp}
                    onChange={(e) => handleChange('showStamp', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">Include cut guides in PDF</span>
                  <input
                    type="checkbox"
                    checked={form.includeCutGuides}
                    onChange={(e) => handleChange('includeCutGuides', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700/30"
                  />
                </label>
              </div>
            </Card>

            <Card padding="p-5">
              <h3 className="mb-3 text-sm font-extrabold text-ink">Actions</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Settings
                </button>

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Defaults
                </button>

                <button
                  onClick={() => {
                    if (previewData?.batch) {
                      window.open(`/id-cards/batch/${previewData.batch._id}/print`, '_blank');
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  Preview Batch Print
                </button>
              </div>
            </Card>

            {saveError && (
              <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-900">
                {saveError.message}
              </div>
            )}
          </div>

          {/* Right column — Live preview */}
          <div>
            <Card padding="p-4">
              <IdCardLivePreview
                settings={form}
                school={previewSchool}
                cards={previewCards}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdCardSettings;
