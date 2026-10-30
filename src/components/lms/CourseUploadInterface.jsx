import React, { useEffect, useState } from "react";
import { ArrowLeft, Upload, FileText, Folder, Plus, Trash2, Image, Video, File } from "lucide-react";
import api from "../../services/api";
import LmsBulkToolbar from "./LmsBulkToolbar";

export default function CourseUploadInterface({ onBack, onUpload }) {
  const [course, setCourse] = useState({ title: "", className: "", subject: "", description: "", term: "", academicYear: "" });
  const [lessons, setLessons] = useState([{ title: "", content: "", resources: [] }]);
  const [activeLesson, setActiveLesson] = useState(0);
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

  const selectedClass = classes.find((c) => c.className === course.className);
  const subjectOptions = selectedClass?.subjects && selectedClass.subjects.length ? selectedClass.subjects : null;

  const addLesson = () => {
    setLessons((p) => [...p, { title: "", content: "", resources: [] }]);
    setActiveLesson(lessons.length);
  };
  const updateLesson = (i, patch) => setLessons((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLesson = (i) => {
    if (lessons.length === 1) return;
    setLessons((p) => p.filter((_, idx) => idx !== i));
    setActiveLesson(Math.max(0, activeLesson - (i === activeLesson ? 1 : 0)));
  };
  const addResource = (i) => updateLesson(i, { resources: [...lessons[i].resources, { title: "", url: "" }] });
  const updateResource = (li, ri, patch) => {
    const res = [...lessons[li].resources];
    res[ri] = { ...res[ri], ...patch };
    updateLesson(li, { resources: res });
  };
  const removeResource = (li, ri) => {
    const res = lessons[li].resources.filter((_, idx) => idx !== ri);
    updateLesson(li, { resources: res });
  };

  const save = async () => {
    await api.post("/teacher/lms/studyplans", { title: course.title, description: course.description, className: course.className, subject: course.subject, term: course.term, academicYear: course.academicYear, lessons, status: "published" });
    if (onUpload) onUpload();
  };

  const current = lessons[activeLesson];

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
          <h1 className="text-xl font-bold text-gray-900">Upload Course Materials</h1>
          <button onClick={save} className="px-5 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold hover:bg-emerald-900 flex items-center space-x-2"><Upload className="w-4 h-4" /><span>Publish Course</span></button>
          <LmsBulkToolbar kind="studyplans" onImported={() => {}} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900">Course Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Course Title</label>
              <input value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="e.g., Introduction to Algebra" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Class</label>
              <select value={course.className} onChange={(e) => setCourse({ ...course, className: e.target.value, subject: "" })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm">
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.className} value={c.className}>{c.className}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
              {subjectOptions ? (
                <select value={course.subject} onChange={(e) => setCourse({ ...course, subject: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm">
                  <option value="">Select subject</option>
                  {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input value={course.subject} onChange={(e) => setCourse({ ...course, subject: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Subject" />
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Term & Year</label>
              <div className="flex space-x-2 mt-1">
                <input value={course.term} onChange={(e) => setCourse({ ...course, term: e.target.value })} className="flex-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Term 1" />
                <input value={course.academicYear} onChange={(e) => setCourse({ ...course, academicYear: e.target.value })} className="flex-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="2026/2027" />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
            <textarea value={course.description} onChange={(e) => setCourse({ ...course, description: e.target.value })} rows={3} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Brief course description..." />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center space-x-2"><Folder className="w-5 h-5 text-emerald-700" /><span>Lesson Structure</span></h3>
                <button onClick={addLesson} className="text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1">
                {lessons.map((l, i) => (
                  <button key={i} onClick={() => setActiveLesson(i)} className={`w-full text-left p-2.5 rounded-lg text-sm flex items-center justify-between ${activeLesson === i ? "bg-emerald-50 text-emerald-900 font-semibold" : "hover:bg-gray-50 text-gray-700"}`}>
                    <span className="truncate">{l.title || `Lesson ${i + 1}`}</span>
                    {lessons.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeLesson(i); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-gray-900">Lesson Content</h3>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Lesson Title</label>
                <input value={current.title} onChange={(e) => updateLesson(activeLesson, { title: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="Enter lesson title" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Lesson Content</label>
                <textarea value={current.content} onChange={(e) => updateLesson(activeLesson, { content: e.target.value })} rows={10} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm font-mono" placeholder="Write lesson content here..." />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center space-x-2"><FileText className="w-5 h-5 text-emerald-700" /><span>Resource Links</span></h3>
                <button onClick={() => addResource(activeLesson)} className="text-sm text-emerald-700 font-semibold flex items-center space-x-1"><Plus className="w-4 h-4" /><span>Add Resource</span></button>
              </div>
              {(current.resources || []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No resources added yet</p>}
              <div className="space-y-2">
                {(current.resources || []).map((r, ri) => (
                  <div key={ri} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                    <input value={r.title} onChange={(e) => updateResource(activeLesson, ri, { title: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm" placeholder="Resource title" />
                    <input value={r.url} onChange={(e) => updateResource(activeLesson, ri, { url: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm" placeholder="URL" />
                    <button onClick={() => removeResource(activeLesson, ri)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
                <span className="flex items-center space-x-1"><Image className="w-3.5 h-3.5" /><span>Images</span></span>
                <span className="flex items-center space-x-1"><Video className="w-3.5 h-3.5" /><span>Videos</span></span>
                <span className="flex items-center space-x-1"><File className="w-3.5 h-3.5" /><span>Documents</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}