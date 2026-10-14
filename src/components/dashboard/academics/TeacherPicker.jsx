import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * The teacher rail: who can be assigned students, and how many they have.
 *
 * A search filter that runs *here* rather than on the server, and that is not a
 * shortcut: a school's whole staff is at most a few dozen accounts, the hook
 * already holds them all for the picker, and a keystroke round-trip per letter on
 * the connection a school office is actually on is a search that feels broken.
 *
 * The counts come from the aggregation, never from the student list — a teacher
 * past page one of the roster would otherwise read as having nobody.
 */
const TeacherPicker = ({
  teachers,
  loading,
  selectedTeacherId,
  onSelect,
  className = '',
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teachers;
    return teachers.filter((teacher) => (teacher.name || '').toLowerCase().includes(needle));
  }, [teachers, query]);

  return (
    <aside className={`flex min-h-0 flex-col ${className}`} aria-label="Teachers">
      <div className="shrink-0 p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a teacher…"
            aria-label="Search teachers"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          // Three skeleton rows rather than a spinner: the panel's width is
          // stable while it loads, so the right column does not jump when the
          // first teacher appears.
          [0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="mb-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2.5">
              <span className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
              <span className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
            </li>
          ))
        ) : !filtered.length ? (
          <li className="px-3 py-6 text-center text-[12.5px] font-semibold text-slate-400">
            {teachers.length ? 'No teacher matches that name.' : 'This school has no teachers yet.'}
          </li>
        ) : (
          filtered.map((teacher) => {
            const isActive = teacher.id === selectedTeacherId;
            return (
              <li key={teacher.id}>
                <button
                  type="button"
                  onClick={() => onSelect(teacher.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-sky-600 text-white' : 'hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                    aria-hidden="true"
                  >
                    {(teacher.name || 'T').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-bold ${isActive ? 'text-white' : 'text-ink'}`}>
                      {teacher.name}
                    </span>
                    <span className={`block truncate text-[11px] font-semibold ${isActive ? 'text-sky-100' : 'text-slate-500'}`}>
                      {teacher.position || teacher.role || 'Teacher'}
                    </span>
                  </span>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {teacher.studentCount}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
};

export default TeacherPicker;
