import React, { useState } from "react";
import { Plus, X, Calendar, Clock, Target, BookOpen, ArrowLeft } from "lucide-react";

export default function StudyPlanCreator({ onSave, onBack }) {
  const [plan, setPlan] = useState({ title: "", goal: "", durationWeeks: 4, hoursPerWeek: 5, subjects: [] });
  const [subject, setSubject] = useState({ name: "", topics: [""] });

  const addTopic = () => setSubject({ ...subject, topics: [...subject.topics, ""] });
  const updateTopic = (i, v) => { const t = [...subject.topics]; t[i] = v; setSubject({ ...subject, topics: t }); };
  const removeTopic = (i) => setSubject({ ...subject, topics: subject.topics.filter((_, idx) => idx !== i) });
  const addSubject = () => { if (!subject.name.trim()) return; setPlan({ ...plan, subjects: [...plan.subjects, { ...subject }] }); setSubject({ name: "", topics: [""] }); };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /><span>Back</span></button>
          <h1 className="text-xl font-bold text-gray-900">Create Study Plan</h1>
          <div></div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Plan Title</label>
            <input value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="e.g., Exam Prep Plan" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Goal</label>
            <textarea value={plan.goal} onChange={(e) => setPlan({ ...plan, goal: e.target.value })} rows={3} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" placeholder="What do you want to achieve?" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center space-x-1"><Calendar className="w-3.5 h-3.5" /><span>Duration (weeks)</span></label>
              <input type="number" value={plan.durationWeeks} onChange={(e) => setPlan({ ...plan, durationWeeks: Number(e.target.value) })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center space-x-1"><Clock className="w-3.5 h-3.5" /><span>Hours/Week</span></label>
              <input type="number" value={plan.hoursPerWeek} onChange={(e) => setPlan({ ...plan, hoursPerWeek: Number(e.target.value) })} className="w-full mt-1 p-3 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900 flex items-center space-x-2"><BookOpen className="w-5 h-5 text-emerald-700" /><span>Add Subjects & Topics</span></h2>
          <div className="space-y-3">
            <input value={subject.name} onChange={(e) => setSubject({ ...subject, name: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl text-sm" placeholder="Subject name (e.g., Mathematics)" />
            {subject.topics.map((t, i) => (
              <div key={i} className="flex items-center space-x-2">
                <input value={t} onChange={(e) => updateTopic(i, e.target.value)} className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm" placeholder={`Topic ${i + 1}`} />
                {subject.topics.length > 1 && <button onClick={() => removeTopic(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" /></button>}
              </div>
            ))}
            <div className="flex items-center space-x-2">
              <button onClick={addTopic} className="text-sm text-emerald-700 font-semibold flex items-center space-x-1"><Plus className="w-4 h-4" /><span>Add Topic</span></button>
              <button onClick={addSubject} className="px-4 py-2 bg-[#006837] text-white rounded-lg text-sm font-semibold">Add Subject</button>
            </div>
          </div>

          {plan.subjects.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-700">Your Plan</h3>
              {plan.subjects.map((s, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  <ul className="mt-1 space-y-1">
                    {s.topics.filter(Boolean).map((t, j) => <li key={j} className="text-xs text-gray-600">• {t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave && onSave(plan)} className="px-6 py-2.5 bg-[#006837] text-white rounded-xl text-sm font-semibold hover:bg-emerald-900 flex items-center space-x-2"><Target className="w-4 h-4" /><span>Save Study Plan</span></button>
        </div>
      </div>
    </div>
  );
}