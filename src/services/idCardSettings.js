import api from './api';
import { toApiError } from './toApiError';
import { DEFAULT_ID_CARD_SETTINGS } from '../components/students/idcards/cardContract';

export const getIdCardSettings = async (schoolId) => {
  try {
    const { data } = await api.get(
      `/settings/${encodeURIComponent(schoolId)}/id-cards`,
      { timeout: 15000 }
    );
    return { ...DEFAULT_ID_CARD_SETTINGS, ...data?.data };
  } catch (error) {
    throw toApiError(error, 'Could not load ID card settings.');
  }
};

export const saveIdCardSettings = async (schoolId, settings) => {
  try {
    const { data } = await api.put(
      `/settings/${encodeURIComponent(schoolId)}/id-cards`,
      settings,
      { timeout: 15000 }
    );
    return data?.data;
  } catch (error) {
    throw toApiError(error, 'Could not save ID card settings.');
  }
};

export const getDefaultSettings = () => ({ ...DEFAULT_ID_CARD_SETTINGS });

export default {
  getIdCardSettings,
  saveIdCardSettings,
  getDefaultSettings,
};
