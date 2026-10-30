import React, { useState } from "react";
import { Clock, Bookmark, ChevronRight, ArrowLeft } from "lucide-react";
import api from "../../services/api";

export default function StudentQuizView({ assessment, token, onDone }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const questions = assessment.questions || [];
  const q = questions[idx];
  const progress = questions.length ? ((idx + 1) / questions.length) * 100 : 0;

  const submit = async () => {
    const ans = questions.map((qq) => ({ questionId: qq._id, studentAnswer: answers[qq._id] || "" }));
    await api.post(`/pay/${encodeURIComponent(token)}/lms/assessments/${assessment._id}/submit`, { answers: ans });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Submitted</h1>
        <p className="text-sm text-gray-500">Your responses have been submitted.</p>
        <button onClick={onDone} className="px-5 py-2 bg-[#006837] text-white rounded-xl font-semibold">Back to LMS</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          <span className="text-gray-400">{assessment.className} • </span>
          <span className="font-semibold text-emerald-800">{assessment.subject}</span>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">{assessment.title}</h1>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>--:--</span>
          </div>
          <button className="p-2 border border-gray-200 bg-white rounded-full text-gray-400 hover:text-gray-700"><Bookmark className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="h-1 bg-gray-200 w-full rounded-full overflow-hidden">
        <div className="h-full bg-[#006837]" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 font-medium">Question {idx + 1} of {questions.length} • {q.type === "essay" ? "Essay" : "Multiple Choice"}</span>
          <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">{q.points || 1} Points</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-gray-900">{q.questionText}</h2>
        </div>
        {q.type === "multiple_choice" ? (
          <div className="space-y-3">
            {(q.options || []).map((opt, i) => (
              <div key={i} onClick={() => setAnswers((p) => ({ ...p, [q._id]: opt }))} className={`flex items-center space-x-4 p-4 rounded-2xl border text-sm cursor-pointer transition-all ${answers[q._id] === opt ? "bg-emerald-50/70 border-emerald-600 text-emerald-950 font-semibold shadow-sm" : "bg-gray-50 border-transparent hover:bg-gray-100 text-gray-700"}`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${answers[q._id] === opt ? "border-[#006837] bg-[#006837]" : "border-gray-300"}`}>
                  {answers[q._id] === opt && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <span className="font-bold text-gray-400">{String.fromCharCode(65 + i)}</span>
                <span className="flex-grow">{opt}</span>
              </div>
            ))}
          </div>
        ) : (
          <textarea value={answers[q._id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [q._id]: e.target.value }))} rows={8} className="w-full p-4 border border-gray-200 rounded-2xl text-sm" placeholder="Write your answer..." />
        )}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
          <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="text-gray-400 font-medium hover:text-gray-600 disabled:opacity-50 flex items-center space-x-1"><ArrowLeft className="w-3.5 h-3.5" /><span>Previous</span></button>
          {idx < questions.length - 1 ? (
            <button onClick={() => setIdx((i) => i + 1)} className="bg-[#006837] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-900 flex items-center space-x-1.5"><span>Next Question</span><ChevronRight className="w-4 h-4" /></button>
          ) : (
            <button onClick={submit} className="bg-[#006837] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-900 flex items-center space-x-1.5"><span>Submit</span><ChevronRight className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}