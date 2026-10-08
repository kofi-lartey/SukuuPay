import api from './api';
import { toApiError } from './toApiError';

export const fetchIdCardTemplates = async (schoolId) => {
  try {
    const { data } = await api.get(
      `/id-card-templates/${encodeURIComponent(schoolId)}`,
      { timeout: 15000 }
    );
    return data?.data || [];
  } catch (error) {
    throw toApiError(error, 'Could not load ID card templates.');
  }
};

export const fetchIdCardTemplate = async (templateId) => {
  try {
    const { data } = await api.get(
      `/id-card-templates/template/${encodeURIComponent(templateId)}`,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not load template.');
  }
};

export const createIdCardTemplate = async (schoolId, template) => {
  try {
    const { data } = await api.post(
      `/id-card-templates/${encodeURIComponent(schoolId)}`,
      template,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not create template.');
  }
};

export const updateIdCardTemplate = async (templateId, updates) => {
  try {
    const { data } = await api.put(
      `/id-card-templates/template/${encodeURIComponent(templateId)}`,
      updates,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not update template.');
  }
};

export const deleteIdCardTemplate = async (templateId) => {
  try {
    const { data } = await api.delete(
      `/id-card-templates/template/${encodeURIComponent(templateId)}`,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not delete template.');
  }
};

export const duplicateIdCardTemplate = async (templateId, name) => {
  try {
    const { data } = await api.post(
      `/id-card-templates/template/${encodeURIComponent(templateId)}/duplicate`,
      name ? { name } : {},
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not duplicate template.');
  }
};

export const setDefaultIdCardTemplate = async (templateId) => {
  try {
    const { data } = await api.put(
      `/id-card-templates/template/${encodeURIComponent(templateId)}/set-default`,
      {},
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not set template as default.');
  }
};

export default {
  fetchIdCardTemplates,
  fetchIdCardTemplate,
  createIdCardTemplate,
  updateIdCardTemplate,
  deleteIdCardTemplate,
  duplicateIdCardTemplate,
  setDefaultIdCardTemplate,
};
