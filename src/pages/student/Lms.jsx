import React, { useState } from 'react';
import { BookOpen, ClipboardList, PlayCircle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

const COURSES = [
  {
    id: 1,
    title: 'Mathematics',
    teacher: 'Mr. Boateng',
    progress: 65,
    modules: [
      { id: 1, title: 'Algebra Basics', lessons: ['Introduction', 'Linear Equations', 'Practice Quiz'], done: 2 },
      { id: 2, title: 'Geometry', lessons: ['Shapes', 'Angles'], done: 0 },
    ],
  },
  {
    id: 2,
    title: 'English Language',
    teacher: 'Ms. Adjei',
    progress: 40,
    modules: [
      { id: 1, title: 'Comprehension', lessons: ['Reading Passage', 'Questions'], done: 1 },
    ],
  },
];

const Lms = () => {
  const [selected, setSelected] = useState(COURSES[0]);
  const [openModule, setOpenModule] = useState(COURSES[0].modules[0].id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Learning (LMS)</h1>
          <p className="text-[13px] font-semibold text-slate-500">Courses, lessons and assignments from your teachers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-3">
          {COURSES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setSelected(c); setOpenModule(c.modules[0]?.id); }}
              className={`w-full text-left rounded-2xl border p-4 shadow-sm transition ${selected.id === c.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <p className="text-[13px] font-extrabold text-ink">{c.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{c.teacher}</p>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.progress}%` }} />
              </div>
              <p className="mt-1 text-[10.5px] text-slate-500">{c.progress}% complete</p>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-ink">{selected.title}</h2>
              <span className="text-[11px] text-slate-400">by {selected.teacher}</span>
            </div>
            <div className="mt-4 space-y-3">
              {selected.modules.map((m) => {
                const open = openModule === m.id;
                return (
                  <div key={m.id} className="rounded-xl border border-slate-100">
                    <button
                      type="button"
                      onClick={() => setOpenModule(open ? null : m.id)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <span className="text-[13px] font-bold text-ink">{m.title}</span>
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
                    </button>
                    {open && (
                      <ul className="px-3 pb-3 space-y-2">
                        {m.lessons.map((l, idx) => {
                          const done = idx < m.done;
                          return (
                            <li key={idx} className="flex items-center gap-2 text-[12.5px]">
                              {done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <PlayCircle className="h-4 w-4 text-slate-400" />}
                              <span className={done ? 'text-slate-500 line-through' : 'text-slate-700'}>{l}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-[14px] font-extrabold text-ink mb-3">Upcoming Assignments</h3>
            <ul className="space-y-2">
              <li className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-700">Algebra Quiz</span>
                <span className="inline-flex items-center gap-1 text-amber-600"><Clock className="h-3.5 w-3.5" />Due Nov 5</span>
              </li>
              <li className="flex items-center justify-between text-[12.5px]">
                <span className="text-slate-700">Essay: My Hero</span>
                <span className="inline-flex items-center gap-1 text-amber-600"><Clock className="h-3.5 w-3.5" />Due Nov 12</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lms;
