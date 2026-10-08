import { useState, useCallback } from 'react';
import {
  fetchIdCardTemplates,
  createIdCardTemplate,
  updateIdCardTemplate,
  deleteIdCardTemplate,
  duplicateIdCardTemplate,
  setDefaultIdCardTemplate,
} from '../services/idCardTemplates';
import { useToast } from './useToast';

export const useIdCardTemplates = (schoolId) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { success, error: errorToast } = useToast();

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIdCardTemplates(schoolId);
      setTemplates(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const create = useCallback(async (template) => {
    try {
      const data = await createIdCardTemplate(schoolId, template);
      setTemplates((prev) => [data, ...prev]);
      success('Template created successfully.');
      return data;
    } catch (err) {
      errorToast(err.message);
      throw err;
    }
  }, [schoolId, success, errorToast]);

  const update = useCallback(async (templateId, updates) => {
    try {
      const data = await updateIdCardTemplate(templateId, updates);
      setTemplates((prev) =>
        prev.map((t) => (t._id === templateId ? data : t))
      );
      success('Template updated successfully.');
      return data;
    } catch (err) {
      errorToast(err.message);
      throw err;
    }
  }, [success, errorToast]);

  const remove = useCallback(async (templateId) => {
    try {
      await deleteIdCardTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t._id !== templateId));
      success('Template deleted successfully.');
    } catch (err) {
      errorToast(err.message);
      throw err;
    }
  }, [success, errorToast]);

  const duplicate = useCallback(async (templateId, name) => {
    try {
      const data = await duplicateIdCardTemplate(templateId, name);
      setTemplates((prev) => [data, ...prev]);
      success('Template duplicated successfully.');
      return data;
    } catch (err) {
      errorToast(err.message);
      throw err;
    }
  }, [success, errorToast]);

  const setDefault = useCallback(async (templateId) => {
    try {
      const data = await setDefaultIdCardTemplate(templateId);
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          isDefault: t._id === templateId && data.isDefault,
        }))
      );
      success('Default template updated.');
      return data;
    } catch (err) {
      errorToast(err.message);
      throw err;
    }
  }, [success, errorToast]);

  return {
    templates,
    loading,
    error,
    load,
    create,
    update,
    remove,
    duplicate,
    setDefault,
  };
};

export default useIdCardTemplates;
