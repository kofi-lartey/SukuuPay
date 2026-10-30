import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Sparkles, ChevronRight, Mic, Eye } from "lucide-react";
import api from "../../services/api";

export default function GradingInterfaceView({ submissionId, onBack, onNext }) {
  const [submission, setSubmission] = useState(null);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    if (!submissionId) return;
    api.get(`/teacher/lms/submissions/${submissionId}`).then((r) => {
      setSubmission(r.data.data);
      const m = {};
      (r.data.data?.answers || []).forEach((a) => { m[a.questionId] = a.scoreAwarded || 0; });
      setMarks(m);
    });
  }, [submissionId]);

  const grade = async () => {
    if (!submission) return;
    const answers = (submission.answers || []).map((a) => {
      const q = (submission.assessmentId?.questions || []).find((x) => String(x._id) === String(a.questionId));
      if (q?.type !== "essay") return null;
      return { questionId: a.questionId, scoreAwarded: Number(marks[a.questionId] || 0), teacherFeedback: document.getElementById(`fb-${a.questionId}`)?.value || "" };
    }).filter(Boolean);
    const totalScore = answers.reduce((s, a) => s + (a.scoreAwarded || 0), 0);
    await api.post(`/teacher/lms/submissions/${submission._id}/grade`, { totalScore, answers, feedback: "" });
    if (onNext) onNext();
    else if (onBack) onBack();
  };

  if (!submission) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  const assessment = submission.assessmentId;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm gap-3">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-gray-900">{submission.studentId?.studentName || "Student"}</h2>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-medium">{submission.studentId?.studentClass}</span>
            </div>
            <p className="text-xs text-gray-400">{assessment?.title}</p>
          </div>
        </div>
        <div className="flex items-center space-x-6 text-xs">
          <button onClick={grade} className="bg-[#006837] text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-900">Finish Grading</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          {(submission.answers || []).map((a, idx) => {
            const q = (assessment?.questions || []).find((x) => String(x._id) === String(a.questionId));
            return (
              <div key={a.questionId} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${q?.type === "essay" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    Question {idx + 1} • {q?.type === "essay" ? "Essay" : "Multiple Choice"}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Max Score: {q?.points || 0} pts</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{q?.questionText}</p>
                <div className="bg-gray-50 p-4 rounded-xl text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">{a.studentAnswer}</div>
                {q?.type === "multiple_choice" && <p className="text-xs text-gray-500">Correct: {q.correctAnswer} • {a.isCorrect ? "✓ Correct" : "✗ Incorrect"}</p>}
              </div>
            );
          })}

          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-start space-x-3">
            <Sparkles className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-900 leading-relaxed"><strong>AI Grading Insight:</strong> Review essay responses for methodology and clarity.</p>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Award Marks (Essays)</h3>
              </div>
              <div className="space-y-3">
                {(submission.answers || []).map((a) => {
                  const q = (assessment?.questions || []).find((x) => String(x._id) === String(a.questionId));
                  if (q?.type !== "essay") return null;
                  return (
                    <div key={a.questionId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">Question {q.questionText.substring(0, 30)}...</span>
                        <span className="text-xs text-gray-400">/ {q.points}</span>
                      </div>
                      <div className="flex items-baseline space-x-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2">
                        <input type="number" max={q.points} value={marks[a.questionId] || 0} onChange={(e) => setMarks({ ...marks, [a.questionId]: Number(e.target.value) })} className="w-16 text-2xl font-extrabold text-[#006837] bg-transparent outline-none text-center" />
                        <span className="text-gray-400 text-lg font-light">/ {q.points}</span>
                      </div>
                      <textarea id={`fb-${a.questionId}`} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs leading-relaxed outline-none focus:border-[#006837]" placeholder="Teacher Feedback" />
                    </div>
                  );
                })}
              </div>
            </div>
            <button onClick={grade} className="w-full bg-[#006837] hover:bg-emerald-900 text-white font-semibold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/10">
              <span>Save & Next Student</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}