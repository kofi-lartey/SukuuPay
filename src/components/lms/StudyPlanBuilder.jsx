import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, X, BookOpen, Upload, ChevronRight } from "lucide-react";
import api from "../../services/api";
import LmsBulkToolbar from "./LmsBulkToolbar";
import RichTextEditor from "../common/RichTextEditor";

export default function StudyPlanBuilder({ onBack, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", className: "", subject: "", term: "", academicYear: "" });
  const [lessons, setLessons] = useState([]);
  const [draft, setDraft] = useState({ title: "", content: "", url: "" });
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

  const selectedClass = classes.find((c) => c.className === form.className);
  const subjectOptions = selectedClass?.subjects && selectedClass.subjects.length ? selectedClass.subjects : null;

  const addLesson = () => {
    if (!draft.title.trim()) return;
    const rl = draft.url.trim() ? [{ title: "Resource", url: draft.url.trim() }] : [];
    setLessons((p) => [...p, { title: draft.title, content: draft.content, resourceLinks: rl, order: p.length + 1 }]);
    setDraft({ title: "", content: "", url: "" });
  };
  const removeLesson = (i) => setLessons((p) => p.filter((_, idx) => idx !== i));

  const save = async (status) => {
    if (!form.title.trim()) return;
    await api.post("/teacher/lms/studyplans", { ...form, lessons, status });
    if (onSaved) onSaved();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
          <h1 className="text-xl font-bold text-gray-900">Study Plan Builder</h1>
          <div className="flex items-center space-x-2">
            <LmsBulkToolbar kind="studyplans" />
            <button onClick={() => save("draft")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">Save Draft</button>
            <button onClick={() => save("published")} className="px-5 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold hover:bg-emerald-900 flex items-center space-x-2"><Upload className="w-4 h-4" /><span>Publish</span></button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Plan Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="e.g., Week 1: Introduction to Algebra" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Brief overview..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Class</label>
              <select value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value, subject: "" })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm">
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
              {subjectOptions ? (
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm">
                  <option value="">Select subject</option>
                  {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Subject" />
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Term</label>
              <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Term 1" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Academic Year</label>
              <input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="2026/2027" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center space-x-2"><BookOpen className="w-5 h-5 text-emerald-700" /><span>Lessons</span></h3>
                <span className="text-xs text-gray-500">{lessons.length} total</span>
              </div>
              <div className="space-y-1">
                {lessons.map((l, i) => (
                  <div key={i} className="p-2.5 rounded-lg text-sm flex items-center justify-between bg-gray-50 text-gray-700">
                    <span className="truncate">{l.title}</span>
                    <button onClick={() => removeLesson(i)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {lessons.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No lessons yet</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Add Lesson</h3>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Lesson Title</label>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="e.g., Linear Equations" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Content</label>
                <RichTextEditor value={draft.content} onChange={(html) => setDraft({ ...draft, content: html })} placeholder="Write lesson content..." />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Resource URL</label>
                <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="https://..." />
              </div>
              <button onClick={addLesson} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold flex items-center space-x-2"><Plus className="w-4 h-4" /><span>Add Lesson</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}