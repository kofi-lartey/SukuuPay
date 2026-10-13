import apiClient from './apiClient';

/**
 * Terminal report card for one student in one term.
 *
 * Returns: overall average, position, grade, subject grades, teacher and
 * headteacher remarks, conduct, and the number of days present out of
 * total. The report card PDF URL is included when the school has published
 * the term.
 */
export const fetchRecords = (token, { term } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/records`, {
    params: term ? { term } : undefined,
  });

/**
 * Streams the report card PDF for the given term. Returns a Blob; the
 * caller triggers the download so a page can decide whether to save or
 * preview.
 */
export const downloadReportCardPdf = async (token, { term }) => {
  const response = await apiClient.get(
    `/pay/${encodeURIComponent(token)}/records.pdf`,
    {
      params: { term },
      responseType: 'blob',
    }
  );
  return response;
};
