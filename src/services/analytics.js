import api from './api';
import { toApiError } from './toApiError';

export const getCashflow = async (schoolId, params = {}) => {
  if (!schoolId) throw new Error('A school must be in scope to read cash flow.');
  try {
    const { data } = await api.get(`/analytics/cashflow/${schoolId}`, { params, timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Cash flow forecast could not be loaded.');
  }
};

export const getCashflowVelocity = async (schoolId, params = {}) => {
  if (!schoolId) throw new Error('A school must be in scope to read cash flow velocity.');
  try {
    const { data } = await api.get(`/analytics/cashflow/${schoolId}/velocity`, { params, timeout: 20000 });
    return data?.data || null;
  } catch (error) {
    throw toApiError(error, 'Cash flow velocity could not be loaded.');
  }
};

const analytics = { getCashflow, getCashflowVelocity };
export default analytics;
