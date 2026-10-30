import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { Plus, Send, Trash2, ArrowLeft } from "lucide-react";
import api from "../../services/api";
import LmsBulkToolbar from "./LmsBulkToolbar";

export default function AssessmentAuthoringView({ assessment, onDone, onBack }) {
  const [form, setForm] = useState({ title: "", className: "", subject: "", dueDate: "", instructions: "" });
  const [questions, setQuestions] = useState([]);
  const [importedPreview, setImportedPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    api.get("/teacher/classes").then((r) => {
      let cls = r.data.data?.classes || [];
      if (!cls.length) {
        api.get("/teacher/classes/available").then((r2) => setClasses((r2.data.data?.classes || []).map((c) => ({ className: c.className, subjects: [] })))).catch(() => {});
      } else {
        setClasses(cls);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (assessment) {
      setForm({
        title: assessment.title || "",
        className: assessment.className || "",
        subject: assessment.subject || "",
        dueDate: assessment.dueDate ? new Date(assessment.dueDate).toISOString().slice(0, 16) : "",
        instructions: assessment.instructions || "",
      });
      setQuestions(assessment.questions || []);
    }
  }, [assessment]);

  const selectedClass = classes.find((c) => c.className === form.className);
  const subjectOptions = selectedClass?.subjects && selectedClass.subjects.length ? selectedClass.subjects : null;

  const addQuestion = (type) => {
    setQuestions((p) => [...p, { type, questionText: "", options: ["", "", "", ""], correctAnswer: "", points: type === "essay" ? 10 : 5 }]);
  };
  const updateQuestion = (i, patch) => setQuestions((p) => p.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQuestion = (i) => setQuestions((p) => p.filter((_, idx) => idx !== i));

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = Papa.parse(ev.target.result, { header: true, skipEmptyLines: true });
      const rows = (parsed.data || []).filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
      const qs = rows.map((row) => {
        const typeRaw = String(row.Type || row.type || "Multiple Choice").trim();
        const type = typeRaw.toLowerCase().includes("essay") ? "essay" : "multiple_choice";
        const opts = [row.Option_A, row.Option_B, row.Option_C, row.Option_D].filter((o) => o && String(o).trim() !== "" && String(o).trim().toUpperCase() !== "N/A");
        const key = String(row.Correct_Answer_Key || row.correctAnswer || "").trim().toUpperCase();
        let correctAnswer = key;
        if (["A", "B", "C", "D"].includes(key) && opts.length) {
          const idx = "ABCD".indexOf(key);
          if (idx >= 0 && opts[idx]) correctAnswer = opts[idx];
        }
        return {
          type,
          questionText: row.Stem_Prompt || row.prompt || row.questionText || "",
          points: Number(row.Points || row.points) || 5,
          options: type === "multiple_choice" ? opts : [],
          correctAnswer: type === "multiple_choice" ? correctAnswer : "",
          syllabusRef: row.Syllabus_Ref || "",
          rubricStandard: row.Rubric_Standard || "",
        };
      });
      setImportedPreview(qs);
    };
    reader.readAsText(file);
  };

  const confirmImportQuestions = () => {
    if (!importedPreview) return;
    setQuestions((p) => [...p, ...importedPreview]);
    setImportedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const saveDraft = async () => {
    try {
      if (assessment?._id) {
        await api.put(`/teacher/lms/assessments/${assessment._id}`, { ...form, questions, status: "draft" });
      } else {
        await api.post("/teacher/lms/assessments", { ...form, questions, status: "draft" });
      }
      alert("Draft saved");
      if (onDone) onDone();
    } catch (e) {
      alert("Save draft failed: " + (e?.response?.data?.message || e.message));
    }
  };
  const publish = async () => {
    try {
      if (assessment?._id) {
        await api.put(`/teacher/lms/assessments/${assessment._id}`, { ...form, questions, status: "published" });
      } else {
        await api.post("/teacher/lms/assessments", { ...form, questions, status: "published" });
      }
      alert("Published");
      if (onDone) onDone();
    } catch (e) {
      alert("Publish failed: " + (e?.response?.data?.message || e.message));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium">✓ Draft auto-saved</span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Assessment Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} type="text" className="w-full text-2xl font-bold text-gray-900 border-b border-gray-200 focus:border-[#006837] outline-none py-1" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Target Class</label>
            <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value, subject: "" })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-medium">
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Subject Area</label>
            {subjectOptions ? (
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-medium">
                <option value="">Select subject</option>
                {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-medium" placeholder="Subject" />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Submission Deadline</label>
            <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-medium" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Instructions</label>
          <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-medium" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Import Questions (CSV)</div>
            <label className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center space-x-1.5 cursor-pointer">
              <span>Choose CSV</span>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
            </label>
          </div>

          {importedPreview && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Preview ({importedPreview.length} questions)</h3>
                <div className="flex items-center space-x-2">
                  <button onClick={() => { setImportedPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700">Cancel</button>
                  <button onClick={confirmImportQuestions} className="px-3 py-1.5 bg-[#006837] text-white rounded-lg text-xs font-semibold">Confirm Import</button>
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {importedPreview.map((q, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-gray-900">Q{i + 1}. {q.questionText || "(no prompt)"}</p>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{q.type === "essay" ? "Essay" : "Multiple Choice"} · {q.points} pts</span>
                    </div>
                    {q.type === "multiple_choice" && (
                      <ul className="space-y-0.5 text-gray-600">
                        {(q.options || []).map((o, oi) => (
                          <li key={oi} className={o === q.correctAnswer ? "text-emerald-700 font-semibold" : ""}>• {o} {o === q.correctAnswer ? "✓" : ""}</li>
                        ))}
                      </ul>
                    )}
                    {q.syllabusRef && <p className="text-[10px] text-gray-400">Syllabus: {q.syllabusRef}</p>}
                    {q.rubricStandard && <p className="text-[10px] text-gray-400">Rubric: {q.rubricStandard}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${q.type === "essay" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    Question {index + 1} • {q.type === "essay" ? "Essay Question" : "Multiple Choice"}
                  </span>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>Points:</span>
                    <input type="number" value={q.points} onChange={(e) => updateQuestion(index, { points: Number(e.target.value) })} className="w-12 p-1 border rounded text-center text-xs" />
                    <button onClick={() => removeQuestion(index)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Stem / Prompt</label>
                  <input value={q.questionText} onChange={(e) => updateQuestion(index, { questionText: e.target.value })} type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                </div>
                {q.type === "multiple_choice" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 block">Answer Options</label>
                    {(q.options || []).map((opt, j) => (
                      <div key={j} className={`flex items-center space-x-3 p-2.5 rounded-xl border text-xs ${q.correctAnswer === opt && opt ? "bg-emerald-50/60 border-emerald-300" : "bg-gray-50 border-gray-200"}`}>
                        <input type="radio" checked={q.correctAnswer === opt} onChange={() => updateQuestion(index, { correctAnswer: opt })} className="accent-[#006837]" />
                        <span className="font-bold text-gray-700">{String.fromCharCode(65 + j)}</span>
                        <input value={opt} onChange={(e) => { const opts = [...q.options]; opts[j] = e.target.value; updateQuestion(index, { options: opts }); }} className="bg-transparent flex-grow outline-none text-xs" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => addQuestion("multiple_choice")} className="px-4 py-2 border-2 border-dashed border-brand-300 text-brand-700 font-bold rounded-xl hover:bg-brand-50 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Multiple Choice
            </button>
            <button onClick={() => addQuestion("essay")} className="px-4 py-2 border-2 border-dashed border-amber-300 text-amber-700 font-bold rounded-xl hover:bg-amber-50 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Essay
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 sticky top-4">
            <h3 className="text-sm font-bold text-gray-900">Actions</h3>
            <button onClick={saveDraft} className="w-full px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Save Draft</button>
            <button onClick={publish} className="w-full px-5 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold hover:bg-emerald-900 transition-all flex items-center justify-center space-x-1.5">
              <span>Publish to Students</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}