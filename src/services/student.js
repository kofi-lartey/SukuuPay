import api from './api';

export const getStudentOverview = () => api.get('/student/overview');
export const getStudentAttendance = (params = {}) => api.get('/student/attendance', { params });
export const getStudentGrades = (params = {}) => api.get('/student/grades', { params });
export const getStudentTimetable = () => api.get('/student/timetable');
export const getStudentFees = (params = {}) => api.get('/student/fees', { params });
export const getStudentTeachers = () => api.get('/student/teachers');
export const getStudentTeacherMessages = (teacherId) =>
  api.get(`/student/teachers/${encodeURIComponent(teacherId)}/messages`);
export const sendStudentTeacherMessage = (teacherId, { text, audio, file }) => {
  const form = new FormData();
  if (text) form.append('text', text);
  if (audio) form.append('audio', audio);
  if (file) form.append('file', file);
  return api.post(`/student/teachers/${encodeURIComponent(teacherId)}/messages`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const markStudentTeacherMessageRead = (messageId) =>
  api.put(`/student/messages/${encodeURIComponent(messageId)}/read`);
export const editStudentTeacherMessage = (messageId, text) =>
  api.put(`/student/messages/${encodeURIComponent(messageId)}`, { text });
export const deleteStudentTeacherMessage = (messageId) =>
  api.delete(`/student/messages/${encodeURIComponent(messageId)}`);
export const getStudentLms = () => api.get('/student/lms');
export const startStudentLmsAssessment = (assessmentId) =>
  api.post(`/student/lms/assessments/${assessmentId}/start`, {});
export const submitStudentLmsAssessment = (assessmentId, answers) =>
  api.post(`/student/lms/assessments/${assessmentId}/submit`, { answers });