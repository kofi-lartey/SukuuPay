import React, { useState } from "react";
import { BookOpen, ClipboardList, ChevronRight } from "lucide-react";
import { Upload } from "lucide-react";
import StudyPlanBuilder from "../../components/lms/StudyPlanBuilder";
import AssessmentAuthoringView from "../../components/lms/AssessmentAuthoringView";
import GradingInterfaceView from "../../components/lms/GradingInterfaceView";
import CourseUploadInterface from "../../components/lms/CourseUploadInterface";
import BulkLmsManager from "../../components/lms/BulkLmsManager";
import api from "../../services/api";

export default function TeacherLms() {
  const [view, setView] = useState("hub");
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [editingAssessment, setEditingAssessment] = useState(null);

  const loadAssessments = async () => {
    const r = await api.get("/teacher/lms/assessments");
    setAssessments(r.data.data || []);
  };

  const openGrading = async (a) => {
    setSelectedAssessment(a);
    const r = await api.get(`/teacher/lms/assessments/${a._id}/submissions`);
    setSubmissions(r.data.data || []);
    setView("gradingList");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans p-4 md:p-6">
      {view === "hub" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Learning Materials</h1>
              <p className="text-sm text-gray-500">Manage your lesson plans and assessments.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => setView("studyplans")}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl group-hover:bg-emerald-100"><BookOpen className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Study Plans</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Create lessons, upload links, and build your term curriculum.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => { loadAssessments(); setView("assessments"); }}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl group-hover:bg-amber-100"><ClipboardList className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-amber-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Assessments</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Create quizzes, assign them to students, and grade essays.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => setView("courseUpload")}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-100"><BookOpen className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Course Upload</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Upload materials, manage curriculum, organize lessons.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => setView("bulk")}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 text-purple-700 rounded-xl group-hover:bg-purple-100"><Upload className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Bulk Import/Export</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Import or export lessons, plans, assessments.</p>
            </div>
          </div>
        </div>
      )}

      {view === "assessments" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Assessments</h1>
            <button onClick={() => { setEditingAssessment(null); setView("authoring"); }} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-xs font-semibold">Create New</button>
          </div>
          <ul className="space-y-2">
            {assessments.map((a) => (
              <li key={a._id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-semibold">{a.title} <span className="text-xs text-gray-500">({a.status})</span></span>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingAssessment(a); setView("authoring"); }} className="text-xs text-blue-700 font-semibold">Edit</button>
                  <button onClick={() => openGrading(a)} className="text-xs text-emerald-700 font-semibold">Grade</button>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setView("hub")} className="text-xs text-gray-500">← Back</button>
        </div>
      )}

      {view === "authoring" && <AssessmentAuthoringView assessment={editingAssessment} onBack={() => { setEditingAssessment(null); setView("assessments"); }} onDone={() => { setEditingAssessment(null); loadAssessments(); setView("assessments"); }} />}

      {view === "studyplans" && <StudyPlanBuilder onBack={() => setView("hub")} onSaved={() => setView("hub")} />}
      {view === "gradingList" && (
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{selectedAssessment?.title} — Submissions</h1>
            <button onClick={() => setView("assessments")} className="text-xs text-gray-500">← Back</button>
          </div>
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s._id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">{s.studentId?.studentName} — <span className="text-xs text-gray-500">{s.status}</span></span>
                <button onClick={() => { setSelectedSubmission(s._id); setView("grading"); }} className="text-xs text-emerald-700 font-semibold">Open</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "grading" && <GradingInterfaceView submissionId={selectedSubmission} onBack={() => setView("gradingList")} onNext={() => setView("gradingList")} />}
      {view === "courseUpload" && <CourseUploadInterface onBack={() => setView("hub")} onUpload={() => setView("hub")} />}
      {view === "bulk" && <BulkLmsManager onBack={() => setView("hub")} />}
    </div>
  );
}