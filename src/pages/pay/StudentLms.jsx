import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { BookOpen, FileText, Clock } from "lucide-react";
import StudyPlanCreator from "../../components/lms/StudyPlanCreator";
import AssessmentPreview from "../../components/lms/AssessmentPreview";

export default function StudentLms() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState("home"); // home | createPlan | preview | taking
  const [taking, setTaking] = useState(null);
  const [previewAssessment, setPreviewAssessment] = useState(null);

  const load = () => {
    api.get(`/pay/${encodeURIComponent(token)}/lms`)
      .then((r) => setData(r.data.data))
      .catch(() => setError("Could not load LMS"));
  };
  useEffect(load, [token]);

  if (error) return <div className="p-6 text-sm text-gray-500">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (view === "createPlan") return <StudyPlanCreator onBack={() => setView("home")} onSave={() => setView("home")} />;
  if (view === "preview" && previewAssessment) return <AssessmentPreview assessment={previewAssessment} onBack={() => { setView("home"); setPreviewAssessment(null); }} onStart={(a) => { setTaking(a); setView("taking"); }} />;
  if (view === "taking" && taking) return <StudentQuizView assessment={taking} token={token} onDone={() => { setTaking(null); setView("home"); load(); }} />;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">My Learning</h1>
          <p className="text-sm text-gray-500">Welcome back, {data.student.name}.</p>
        </div>
        <button onClick={() => setView("createPlan")} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold">Create Study Plan</button>
      </div>

      <section>
        <h2 className="font-bold mb-2 flex items-center gap-2 text-gray-900"><BookOpen className="h-5 w-5 text-emerald-700" /> Study Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data.studyPlans || []).map((sp) => (
            <div key={sp._id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-2">
              <h3 className="font-extrabold text-gray-900">{sp.title}</h3>
              <p className="text-xs text-gray-500">{sp.className} · {sp.subject}</p>
              <p className="text-sm text-gray-600">{sp.description}</p>
              <ul className="mt-2 space-y-1">
                {(sp.lessons || []).map((l, i) => (
                  <li key={i} className="text-sm text-gray-700">
                    {l.title}
                    {(l.resourceLinks || []).map((r, j) => (
                      <a key={j} href={r.url} target="_blank" rel="noreferrer" className="block text-emerald-700 text-xs">{r.title || r.url}</a>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2 flex items-center gap-2 text-gray-900"><FileText className="h-5 w-5 text-amber-700" /> Assessments</h2>
        <div className="space-y-3">
          {(data.assessments || []).map((a) => (
            <div key={a._id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-gray-900">{a.title}</h3>
                <p className="text-xs text-gray-500">{a.className} · {a.subject} · Due {a.dueDate ? new Date(a.dueDate).toLocaleString() : "-"}</p>
                {a.submission && <p className="text-sm text-emerald-700 mt-1">Score: {a.submission.totalScore} · {a.submission.status}</p>}
              </div>
              {!a.submission ? (
                <button onClick={() => { setPreviewAssessment(a); setView("preview"); }} className="px-4 py-2 bg-[#006837] text-white rounded-xl font-semibold">Preview</button>
              ) : (
                <span className="text-xs font-bold text-gray-400">{a.submission.status}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}