import apiClient from './apiClient';

export const fetchTeacherStudents = () =>
  apiClient.get('/teacher/students');

export const fetchTeacherStudentMessages = (studentId) =>
  apiClient.get(`/teacher/students/${encodeURIComponent(studentId)}/messages`);

export const sendTeacherStudentMessage = (studentId, { text, audio, file }) => {
  const form = new FormData();
  if (text) form.append('text', text);
  if (audio) form.append('audio', audio);
  if (file) form.append('file', file);
  return apiClient.post(`/teacher/students/${encodeURIComponent(studentId)}/messages`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const markTeacherStudentMessageRead = (messageId) =>
  apiClient.put(`/teacher/messages/${encodeURIComponent(messageId)}/read`);

export const editTeacherStudentMessage = (messageId, text) =>
  apiClient.put(`/teacher/messages/${encodeURIComponent(messageId)}`, { text });

export const deleteTeacherStudentMessage = (messageId) =>
  apiClient.delete(`/teacher/messages/${encodeURIComponent(messageId)}`);
