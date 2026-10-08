import { useState, useCallback } from 'react';
import { getIdCardSettings, saveIdCardSettings, getDefaultSettings } from '../services/idCardSettings';
import { useToast } from './useToast';

export const useIdCardSettings = (schoolId) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { success, error: errorToast } = useToast();

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getIdCardSettings(schoolId);
      setSettings(data);
    } catch (error) {
      setLoadError(error);
      // Fall back to defaults for rendering.
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const save = useCallback(async (updates) => {
    if (!schoolId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await saveIdCardSettings(schoolId, updates);
      setSettings(data);
      success('ID card settings saved.');
    } catch (error) {
      setSaveError(error);
      errorToast(error.message);
    } finally {
      setSaving(false);
    }
  }, [schoolId, success, errorToast]);

  const reset = useCallback(() => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
  }, []);

  return {
    settings,
    loading,
    loadError,
    saving,
    saveError,
    load,
    save,
    reset,
  };
};

export default useIdCardSettings;
