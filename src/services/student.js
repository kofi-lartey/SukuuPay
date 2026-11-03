import api from './api';

export const getStudentOverview = () => api.get('/student/overview');
export const getStudentAttendance = (params = {}) => api.get('/student/attendance', { params });
export const getStudentGrades = (params = {}) => api.get('/student/grades', { params });
export const getStudentTimetable = () => api.get('/student/timetable');
export const getStudentFees = (params = {}) => api.get('/student/fees', { params });
export const getStudentMessages = () => api.get('/student/messages');
export const getStudentLms = () => api.get('/student/lms');
export const startStudentLmsAssessment = (assessmentId) =>
  api.post(`/student/lms/assessments/${assessmentId}/start`, {});
export const submitStudentLmsAssessment = (assessmentId, answers) =>
  api.post(`/student/lms/assessments/${assessmentId}/submit`, { answers });