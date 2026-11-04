import React, { useState, useEffect } from "react";
import { BookOpen, ClipboardList, ChevronRight, Eye, Pencil, Trash2, X, Video } from "lucide-react";
import { Upload } from "lucide-react";
import AssessmentAuthoringView from "../../components/lms/AssessmentAuthoringView";
import GradingInterfaceView from "../../components/lms/GradingInterfaceView";
import CourseUploadInterface from "../../components/lms/CourseUploadInterface";
import ResourcePreview from "../../components/lms/ResourcePreview";
import BulkLmsManager from "../../components/lms/BulkLmsManager";
import api from "../../services/api";

export default function TeacherLms() {
  const [view, setView] = useState("hub");
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [studyPlans, setStudyPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);
  const [previewPlan, setPreviewPlan] = useState(null);
  const [meetingClass, setMeetingClass] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [meetingRoom, setMeetingRoom] = useState(null);
  const [gradebook, setGradebook] = useState([]);
  const [loadingGradebook, setLoadingGradebook] = useState(false);

  useEffect(() => {
    api.get("/teacher/classes").then((r) => {
      let cls = r.data.data?.classes || [];
      if (!cls.length) {
        api.get("/teacher/classes/available").then((r2) => {
          const c = (r2.data.data?.classes || []).map((x) => ({ className: x.className }));
          setTeacherClasses(c);
          if (c.length) setMeetingClass(c[0].className);
        }).catch(() => {});
      } else {
        setTeacherClasses(cls);
        if (cls.length) setMeetingClass(cls[0].className);
      }
    }).catch(() => {});
  }, []);
  const loadAssessments = async () => {
    const r = await api.get("/teacher/lms/assessments");
    setAssessments(r.data.data || []);
  };

  const loadStudyPlans = async () => {
    setLoadingPlans(true);
    try {
      const r = await api.get("/teacher/lms/studyplans");
      setStudyPlans(r.data.data || []);
    } finally {
      setLoadingPlans(false);
    }
  };

  const loadGradebook = async () => {
    setLoadingGradebook(true);
    try {
      const r = await api.get("/teacher/lms/gradebook");
      setGradebook(r.data.data || []);
    } finally {
      setLoadingGradebook(false);
    }
  };
  const openGrading = async (a) => {
    setSelectedAssessment(a);
    const r = await api.get(`/teacher/lms/assessments/${a._id}/submissions`);
    setSubmissions(r.data.data || []);
    setView("gradingList");
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Delete "${plan.title}"?`)) return;
    try {
      await api.delete(`/teacher/lms/studyplans/${plan._id}`);
      setStudyPlans((p) => p.filter((x) => x._id !== plan._id));
    } catch (e) {
      alert(e?.response?.data?.message || "Delete failed");
    }
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
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => { loadAssessments(); setView("assessments"); }}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-50 text-amber-700 rounded-xl group-hover:bg-amber-100"><ClipboardList className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-amber-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Assessments</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Create quizzes, assign them to students, and grade essays.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => { loadStudyPlans(); setView("courses"); }}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl group-hover:bg-emerald-100"><BookOpen className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">My Courses</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">View, preview and edit all uploaded courses.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => setView("courseUpload")}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-100"><BookOpen className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Course Upload</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Upload materials, manage curriculum, organize lessons.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => { setMeetingRoom("SukuuPay-Meeting"); setView("meeting"); }}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-teal-50 text-teal-700 rounded-xl group-hover:bg-teal-100"><Video className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-teal-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Meetings</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Start a live video class (WebRTC).</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition-colors cursor-pointer group" onClick={() => { loadGradebook(); setView("gradebook"); }}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl group-hover:bg-indigo-100"><ClipboardList className="h-6 w-6" /></div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900">Gradebook</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">Tabular view of student grades per assessment.</p>
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


      {view === "gradingList" && (
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{selectedAssessment?.title} — Submissions</h1>
            <button onClick={() => setView("assessments")} className="text-xs text-gray-500">← Back</button>
          </div>
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s._id} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm">{s.studentId?.studentName} — <span className="text-xs text-gray-500">{s.status}{s.status === 'graded' ? ` · ${s.totalScore} / ${(selectedAssessment?.questions || []).reduce((sum, q) => sum + (q.points || 0), 0)}` : ''}</span></span>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedSubmission(s._id); setView("grading"); }} className="text-xs text-emerald-700 font-semibold">{s.status === 'graded' ? 'Edit' : 'Open'}</button>
                  <button onClick={async () => { try { await api.post(`/teacher/lms/submissions/${s._id}/reset`); openGrading(selectedAssessment); } catch (e) { alert("Reassign failed"); } }} className="text-xs text-amber-700 font-semibold">Reassign</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "grading" && <GradingInterfaceView submissionId={selectedSubmission} onBack={() => setView("gradingList")} onNext={() => setView("gradingList")} />}
      {view === "courseUpload" && <CourseUploadInterface onBack={() => setView("hub")} onUpload={() => { loadStudyPlans(); setView("courses"); }} />}

      {view === "courseEdit" && <CourseUploadInterface plan={editingPlan} onBack={() => { setEditingPlan(null); setView("courses"); }} onUpload={() => { setEditingPlan(null); loadStudyPlans(); setView("courses"); }} />}

      {view === "courses" && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">My Courses</h1>
            <button onClick={() => setView("courseUpload")} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-xs font-semibold">+ New Course</button>
          </div>
          {loadingPlans ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : studyPlans.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-sm text-gray-500">No courses uploaded yet.</div>
          ) : (
            <ul className="space-y-3">
              {studyPlans.map((p) => (
                <li key={p._id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.coverImage && <img src={p.coverImage} alt={p.title} className="h-12 w-16 object-cover rounded-lg" />}
                    <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{p.title}</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{p.className}</span>
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${p.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{p.subject} · {p.term} {p.academicYear} · {(p.lessons || []).length} lessons · Updated {new Date(p.updatedAt).toLocaleDateString()}</p>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setPreviewPlan(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"><Eye className="w-3.5 h-3.5" />View as student</button>
                    <button onClick={() => { setEditingPlan(p); setView("courseEdit"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"><Pencil className="w-3.5 h-3.5" />Edit</button>
                    <button onClick={() => deletePlan(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setView("hub")} className="text-xs text-gray-500">← Back</button>
        </div>
      )}

      {previewPlan && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPreviewPlan(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{previewPlan.title}</h2>
              <button onClick={() => setPreviewPlan(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500">{previewPlan.className} · {previewPlan.subject} · {previewPlan.term} {previewPlan.academicYear}</p>
            <p className="text-sm text-gray-700">{previewPlan.description}</p>
            <div className="space-y-2">
              {(previewPlan.lessons || []).map((l, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3">
                  <p className="text-sm font-semibold text-gray-900">{i + 1}. {l.title || l.content?.slice(0, 40)}</p>
                  {l.content && <div className="text-xs text-gray-600 mt-1 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: l.content }} />}
                  {(l.resourceLinks || []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase">Resources</p>
                      {(l.resourceLinks || []).map((r, j) => (
                        <ResourcePreview key={j} resource={r} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {view === "meeting" && (
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Live Meeting (WebRTC)</h1>
            <button onClick={() => { setMeetingRoom(null); setView("hub"); }} className="text-xs text-gray-500">← Back</button>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={meetingClass} onChange={(e) => setMeetingClass(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Select class</option>
                {teacherClasses.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
              </select>
              <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Meeting title" className="p-2 border border-gray-200 rounded-lg text-sm" />
              <button onClick={async () => {
                try {
                  const r = await api.post("/teacher/lms/meetings", { className: meetingClass, title: meetingTitle || "Live class" });
                  setMeetingRoom(r.data.data.roomName);
                  setMeetings((p) => [r.data.data, ...p]);
                } catch (e) { alert(e?.response?.data?.message || "Failed"); }
              }} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold">Create & Start</button>
            </div>
          </div>
          {meetingRoom && (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-gray-200 bg-black">
              <iframe src={`https://meet.jit.si/${encodeURIComponent(meetingRoom)}`} className="w-full h-full" allow="camera; microphone; fullscreen; display-capture" />
            </div>
          )}
          {meetings.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <h2 className="text-sm font-bold mb-2">Active meetings</h2>
              <ul className="space-y-1 text-xs">
                {meetings.map((m) => (
                  <li key={m._id} className="flex justify-between">
                    <span>{m.title} · {m.className}</span>
                    <button onClick={() => setMeetingRoom(m.roomName)} className="text-teal-700 font-semibold">Open</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {view === "gradebook" && (
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setView("hub")} className="text-xs text-gray-500">← Back</button>
          </div>
          {loadingGradebook ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : gradebook.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-sm text-gray-500">No data.</div>
          ) : (
            gradebook.map((cls) => (
              <div key={cls.className} className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
                <h2 className="text-lg font-bold mb-3">{cls.className}</h2>
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-2 font-bold">Student</th>
                      {cls.assessments.map((a) => (
                        <th key={a._id} className="text-center p-2 font-bold">{a.title}<br /><span className="text-[10px] text-gray-400">/{a.totalPoints}</span></th>
                      ))}
                      <th className="text-center p-2 font-bold">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.rows.map((r) => (
                      <tr key={r.studentId} className="border-b border-gray-100">
                        <td className="p-2 font-semibold">{r.studentName}</td>
                        {cls.assessments.map((a) => {
                          const g = r.grades[String(a._id)];
                          return (
                            <td key={a._id} className="text-center p-2">
                              {g && g.score != null ? `${g.score}/${g.total}` : (g?.status === 'not_taken' ? '—' : '...')}
                            </td>
                          );
                        })}
                        <td className="text-center p-2 font-bold">{r.cumulative != null ? `${r.cumulative}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}