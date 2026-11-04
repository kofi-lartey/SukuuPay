import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { BookOpen, ClipboardList, Clock, Sparkles, CheckCircle2, PlayCircle } from "lucide-react";
import StudyPlanCreator from "../../components/lms/StudyPlanCreator";
import AssessmentPreview from "../../components/lms/AssessmentPreview";
import ResourcePreview from "../../components/lms/ResourcePreview";

const isNew = (date) => {
  if (!date) return false;
  const created = new Date(date).getTime();
  return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
};

export default function StudentLms() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState("home");
  const [tab, setTab] = useState("plans");
  const [taking, setTaking] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const load = () => {
    api.get(`/pay/${encodeURIComponent(token)}/lms`)
      .then((r) => setData(r.data.data))
      .catch(() => setError("Could not load LMS"));
  };
  useEffect(load, [token]);

  const studyPlans = data?.studyPlans || [];
  const assessments = data?.assessments || [];
  const newPlans = useMemo(() => studyPlans.filter((p) => isNew(p.createdAt)).length, [studyPlans]);
  const newAssessments = useMemo(() => assessments.filter((a) => isNew(a.createdAt) && !a.submission).length, [assessments]);

  if (error) return <div className="p-6 text-sm text-gray-500">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (view === "createPlan") return <StudyPlanCreator onBack={() => setView("home")} onSave={() => { setView("home"); load(); }} />;
  if (view === "preview" && previewAssessment) return <AssessmentPreview assessment={previewAssessment} onBack={() => { setView("home"); setPreviewAssessment(null); }} onStart={async (a) => {
    try {
      const r = await api.post(`/pay/${encodeURIComponent(token)}/lms/assessments/${a._id}/start`, {});
      const payload = r?.data?.data || r?.data;
      if (payload?.locked) { alert("This assessment has already been submitted."); setView("home"); setPreviewAssessment(null); load(); return; }
      setTaking(a); setExpiresAt(payload?.expiresAt || null); setView("taking");
    } catch (e) { alert(e?.response?.data?.message || "Could not start"); }
  }} />;
  if (view === "taking" && taking) return <StudentQuizView assessment={taking} token={token} expiresAt={expiresAt} onDone={() => { setTaking(null); setExpiresAt(null); setView("home"); load(); }} />;

  if (selectedCourse) {
    const c = selectedCourse;
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <button onClick={() => setSelectedCourse(null)} className="text-sm text-gray-600 hover:text-gray-900">← Back</button>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-xl font-extrabold text-gray-900">{c.title}</h2>
          <p className="text-xs text-gray-500">{c.className} · {c.subject} · {c.term} {c.academicYear}</p>
          <p className="text-sm text-gray-600">{c.description}</p>
          <div className="space-y-4">
            {(() => {
              const lessons = c.lessons || [];
              let canAccess = true;
              return lessons.map((l, i) => {
                const linkedAssessment = l.assessmentId ? (assessments || []).find((a) => String(a._id) === String(l.assessmentId)) : null;
                const isLocked = !canAccess;
                const sub = linkedAssessment?.submission;
                const totalPts = linkedAssessment ? (linkedAssessment.questions || []).reduce((s, q) => s + (q.points || 0), 0) : 0;
                const passed = !linkedAssessment || (!!sub && totalPts > 0 && (sub.totalScore || 0) >= 0.5 * totalPts);
                if (linkedAssessment && !passed) canAccess = false;
                return (
                  <div key={i} className={`rounded-2xl border p-4 space-y-2 ${isLocked ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-gray-900">{i + 1}. {l.title}</p>
                      {isLocked && <span className="text-[10px] font-bold text-gray-500">Locked</span>}
                    </div>
                    {isLocked ? (
                      <p className="text-xs text-gray-500">Complete the previous assessment with at least 50% to unlock.</p>
                    ) : (
                      <>
                        {l.content && <div className="text-xs text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: l.content }} />}
                        {(l.resourceLinks || []).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-bold text-gray-500 uppercase">Resources</p>
                            {(l.resourceLinks || []).map((r, j) => (
                              <ResourcePreview key={j} resource={r} />
                            ))}
                          </div>
                        )}
                        {linkedAssessment && (
                          <div className="pt-2 border-t border-gray-100 space-y-2">
                            {sub ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[11.5px] font-bold px-2 py-1 rounded-full ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {passed ? 'Passed' : 'Failed'}: {sub.totalScore ?? 0}/{totalPts} ({totalPts ? Math.round(((sub.totalScore || 0) / totalPts) * 100) : 0}%)
                                </span>
                                {!passed && (
                                  <button onClick={() => { setPreviewAssessment(linkedAssessment); setView("preview"); }} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold text-sm">Retake assessment</button>
                                )}
                                {sub.status === 'graded' && (
                                  <button onClick={() => { setPreviewAssessment(linkedAssessment); setView("preview"); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm">View feedback</button>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => { setPreviewAssessment(linkedAssessment); setView("preview"); }} className="px-4 py-2 bg-[#006837] text-white rounded-xl font-semibold text-sm">Take assessment: {linkedAssessment.title}</button>
                            )}
                            {!passed && sub && <p className="text-xs text-rose-600">You need at least 50% to pass and unlock the next lesson.</p>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">My Learning</h1>
          <p className="text-sm text-gray-500">Welcome back, {data.student.name}.</p>
        </div>
        <button onClick={() => setView("createPlan")} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold">Create Study Plan</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setTab("plans")} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${tab === "plans" ? "bg-[#006837] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          <BookOpen className="h-4 w-4" /> Courses
          {newPlans > 0 && <span className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${tab === "plans" ? "bg-white text-[#006837]" : "bg-rose-500 text-white"}`}>{newPlans}</span>}
        </button>
        <button type="button" onClick={() => setTab("assessments")} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${tab === "assessments" ? "bg-[#006837] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
          <ClipboardList className="h-4 w-4" /> Assessments
          {newAssessments > 0 && <span className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${tab === "assessments" ? "bg-white text-[#006837]" : "bg-rose-500 text-white"}`}>{newAssessments}</span>}
        </button>
      </div>

      {tab === "plans" && (
        <section className="space-y-3">
          {studyPlans.length === 0 && <p className="text-sm text-gray-500">No courses yet.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studyPlans.map((sp) => (
              <div key={sp._id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden space-y-2">
                {sp.coverImage && <img src={sp.coverImage} alt={sp.title} className="h-32 w-full object-cover" />}
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-gray-900">{sp.title}</h3>
                    {isNew(sp.createdAt) && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md"><Sparkles className="h-3 w-3" />New</span>}
                  </div>
                  <p className="text-xs text-gray-500">{sp.className} · {sp.subject}</p>
                  <p className="text-sm text-gray-600">{sp.description}</p>
                  <p className="text-xs text-gray-400">{(sp.lessons || []).length} lessons</p>
                  <button onClick={() => setSelectedCourse(sp)} className="px-4 py-2 bg-[#006837] text-white rounded-xl font-semibold text-sm">Open course</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "assessments" && (
        <section className="space-y-3">
          {assessments.filter((a) => !a.attachedToLesson).length === 0 && <p className="text-sm text-gray-500">No assessments yet.</p>}
          {assessments.filter((a) => !a.attachedToLesson).map((a) => (
            <div key={a._id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-gray-900 truncate">{a.title}</h3>
                  {isNew(a.createdAt) && !a.submission && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md"><Sparkles className="h-3 w-3" />New</span>}
                </div>
                <p className="text-xs text-gray-500">{a.className} · {a.subject} · Due {a.dueDate ? new Date(a.dueDate).toLocaleString() : "-"}</p>
                {a.submission && (a.submission.resultsReleased ? (
                  <p className="text-sm text-emerald-700 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Score: {a.submission.totalScore} · {a.submission.status}</p>
                ) : (
                  <p className="text-sm text-amber-700 mt-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Grading in progress</p>
                ))}
              </div>
              {!a.submission ? (
                <button onClick={() => { setPreviewAssessment(a); setView("preview"); }} className="px-4 py-2 bg-[#006837] text-white rounded-xl font-semibold shrink-0">Preview</button>
              ) : (
                <span className="text-xs font-bold text-gray-400 shrink-0">{a.submission.status}</span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}