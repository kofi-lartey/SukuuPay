import apiClient from './apiClient';

export const fetchConversations = (token, { page = 1, perPage = 30 } = {}) =>
  apiClient.get(`/pay/${encodeURIComponent(token)}/messages`, {
    params: { page, perPage },
  });

export const fetchConversation = (token, threadId) =>
  apiClient.get(
    `/pay/${encodeURIComponent(token)}/messages/${encodeURIComponent(threadId)}`
  );

/**
 * Sends a message, optionally with a voice-note File attached.
 *
 * When `audio` is present — a `{ file, url, seconds, mimeType }` object from
 * `AudioRecorder` — the request is sent as `FormData` so the backend's multer
 * `audio` field receives the File. When there is no audio, a plain JSON body is
 * sent instead, matching the multipart-free path the endpoint also accepts.
 *
 * `threadId` is the student's `studentId`; sent for parity with the route even
 * though the token already scopes the write.
 */
export const sendMessage = (token, { subject, body, threadId, audio }) => {
  const url = `/pay/${encodeURIComponent(token)}/messages`;

  if (audio?.file) {
    const form = new FormData();
    form.append('subject', subject || '');
    form.append('body', body || '');
    if (threadId) form.append('threadId', threadId);
    form.append('audio', audio.file, audio.file.name);
    return apiClient.post(url, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  return apiClient.post(url, { subject, body, threadId });
};

export const markConversationRead = (token, threadId) =>
  apiClient.put(
    `/pay/${encodeURIComponent(token)}/messages/${encodeURIComponent(threadId)}/read`
  );
