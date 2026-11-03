import React, { useState, useEffect, useRef } from "react";
import { Clock, Bookmark, ChevronRight, ArrowLeft } from "lucide-react";
import api from "../../services/api";

export default function StudentQuizView({ assessment, token, submitUrl, expiresAt: expiresAtProp, onDone }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef({});
  const [submitted, setSubmitted] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const storageKey = `lms_answers_${assessment?._id}`;
  const timerRef = useRef(null);

  // load persisted answers
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const parsed = JSON.parse(saved); setAnswers(parsed); answersRef.current = parsed; }
    } catch {}
  }, [storageKey]);

  // persist answers
  useEffect(() => {
    answersRef.current = answers;
    try { localStorage.setItem(storageKey, JSON.stringify(answers)); } catch {}
  }, [answers, storageKey]);

  const expiresAt = expiresAtProp ? new Date(expiresAtProp) : null;

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = expiresAt.getTime() - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        setExpired(true);
        return;
      }
      setRemaining(ms);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  // auto-submit on expiry
  useEffect(() => {
    if (!expired || submitted) return;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const questions = assessment.questions || [];
  const q = questions[idx];
  const progress = questions.length ? ((idx + 1) / questions.length) * 100 : 0;

  const submit = async (final = true) => {
    if (submitted) return;
    let currentAnswers = answersRef.current || {};
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        currentAnswers = { ...parsed, ...currentAnswers };
      }
    } catch {}
    const ans = questions.map((qq) => ({ questionId: qq._id, studentAnswer: currentAnswers[qq._id] || answers[qq._id] || "" }));
    const url = submitUrl || `/pay/${encodeURIComponent(token)}/lms/assessments/${assessment._id}/submit`;
    try { await api.post(url, { answers: ans, final }); } catch (e) { /* ignore */ }
    if (final) {
      setSubmitted(true);
      try { localStorage.removeItem(storageKey); } catch {}
    }
  };

  const formatTime = (ms) => {
    if (ms == null) return "--:--";
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (expired && !submitted) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">Time's up</h1>
        <p className="text-sm text-gray-500">Submitting your responses...</p>
      </div>
    );
  }
    if (submitted) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900">{expired ? "Time's up — Submitted" : "Submitted"}</h1>
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
          {expiresAt && (
            <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-semibold ${remaining !== null && remaining < 60000 ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(remaining)}</span>
            </div>
          )}
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
              <div key={i} onClick={() => setAnswers((p) => { const n = { ...p, [q._id]: opt }; answersRef.current = n; return n; })} className={`flex items-center space-x-4 p-4 rounded-2xl border text-sm cursor-pointer transition-all ${answers[q._id] === opt ? "bg-emerald-50/70 border-emerald-600 text-emerald-950 font-semibold shadow-sm" : "bg-gray-50 border-transparent hover:bg-gray-100 text-gray-700"}`}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${answers[q._id] === opt ? "border-[#006837] bg-[#006837]" : "border-gray-300"}`}>
                  {answers[q._id] === opt && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <span className="font-bold text-gray-400">{String.fromCharCode(65 + i)}</span>
                <span className="flex-grow">{opt}</span>
              </div>
            ))}
          </div>
        ) : (
          <textarea value={answers[q._id] || ""} onChange={(e) => setAnswers((p) => { const n = { ...p, [q._id]: e.target.value }; answersRef.current = n; return n; })} rows={8} className="w-full p-4 border border-gray-200 rounded-2xl text-sm" placeholder="Write your answer..." />
        )}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
          <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="text-gray-400 font-medium hover:text-gray-600 disabled:opacity-50 flex items-center space-x-1"><ArrowLeft className="w-3.5 h-3.5" /><span>Previous</span></button>
          {idx < questions.length - 1 ? (
            <button onClick={async () => { await submit(false); setIdx((i) => i + 1); }} className="bg-[#006837] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-900 flex items-center space-x-1.5"><span>Next Question</span><ChevronRight className="w-4 h-4" /></button>
          ) : (
            <button onClick={() => submit(true)} className="bg-[#006837] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-900 flex items-center space-x-1.5"><span>Submit</span><ChevronRight className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}