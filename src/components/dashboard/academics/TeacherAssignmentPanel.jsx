import React, { useMemo, useState } from 'react';
import { CheckSquare, Users, Clock, UserCheck } from 'lucide-react';
import { SelectField } from '../../common/FormField';
import StudentAssignmentRow from './StudentAssignmentRow';
import BulkAssignBar from './BulkAssignBar';
import EmptyState from '../EmptyState';
import { SUBJECTS, OTHER_SUBJECT, CUSTOM_SUBJECTS_KEY } from '../../../utils/constants';

const TeacherAssignmentPanel = ({
  teacher,
  page,
  pagination,
  loading,
  error,
  assignedCount,
  selected,
  onToggleStudent,
  onSelectPage,
  onAssign,
  onUnassign,
  onAssignClass,
  busy,
  lastResult,
  filters,
  onFilterChange,
  onPageChange,
  classroomOptions,
}) => {
  const [role, setRole] = useState('subject');
  const [showRoleUI, setShowRoleUI] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [customSubjects, setCustomSubjects] = useState(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [attendance, setAttendance] = useState(true);
  const [showClassAssignments, setShowClassAssignments] = useState(true);
  const [showSubjects, setShowSubjects] = useState(true);

  const allSubjects = useMemo(() => {
    const base = SUBJECTS.filter((s) => s.value !== OTHER_SUBJECT);
    return base.concat(customSubjects.map((name) => ({ value: name, label: name })));
  }, [customSubjects]);

  const toggleSubject = (value) => {
    setSelectedSubjects((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const addCustomSubject = () => {
    const trimmed = customSubjectName.trim();
    if (!trimmed) return;
    if (customSubjects.includes(trimmed)) {
      if (!selectedSubjects.includes(trimmed)) setSelectedSubjects((prev) => [...prev, trimmed]);
      setCustomSubjectName('');
      return;
    }
    const next = [...customSubjects, trimmed];
    setCustomSubjects(next);
    try {
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(next));
    } catch {}
    setSelectedSubjects((prev) => [...prev, trimmed]);
    setCustomSubjectName('');
  };

  const rows = useMemo(() => page || [], [page]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filters.tag) {
      if (filters.tag === 'unassigned') {
        result = result.filter(r => !r.assignedToTeacher);
      } else {
        result = result.filter(r => r.tag === filters.tag);
      }
    }
    return result;
  }, [rows, filters.tag]);

  const classMediatedSelected = useMemo(
    () => [...selected].filter((id) => filteredRows.find((row) => String(row._id) === id)?.classMediated).length,
    [selected, filteredRows]
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-[13px] font-bold text-red-700">
          {error.message || "That teacher's students could not be loaded."}
        </p>
        {error.offline && (
          <p className="mt-1 text-[12px] font-semibold text-red-600">
            This looks like a connection problem rather than an empty roster.
          </p>
        )}
      </div>
    );
  }

  if (!teacher) {
    return (
      <EmptyState
        icon={Users}
        title="Pick a teacher"
        description="Choose a teacher on the left to see their students and assign new ones."
      />
    );
  }

  const classes = Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : [];

  return (
    // Added min-w-0 here to allow the panel to shrink and prevent horizontal page scroll
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
       <div className="border-b border-slate-200 bg-slate-50/60 p-3">
         {/* Added min-w-0 and truncate to prevent "Hide" button from being cut off */}
         <div className="flex items-center justify-between mb-2 min-w-0">
           <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
             Class assignments
           </h3>
           <button
             type="button"
             onClick={() => setShowClassAssignments((v) => !v)}
             className="shrink-0 text-[11px] font-extrabold text-slate-500 hover:text-slate-700"
           >
             {showClassAssignments ? 'Hide' : 'Show'}
           </button>
         </div>
         {showClassAssignments && (
           <>
             {classes.length === 0 ? (
               <p className="text-[12px] text-slate-500">
                 No classes assigned — use "Select all in a class" or pick students to link.
               </p>
             ) : (
               <div className="grid gap-1.5">
                 {classes.map((entry) => {
                   const isClassTeacher = String(entry.subject || '').trim() === '';
                   return (
                     <div
                       key={`${entry.className}-${entry.subject || ''}`}
                       className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 min-w-0"
                     >
                       <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                         isClassTeacher
                           ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                           : 'bg-slate-50 text-slate-600 border border-slate-200'
                       }`}>
                         {isClassTeacher ? 'Class teacher' : 'Subject teacher'}
                       </span>
                       <span className="flex-1 truncate text-[12px] font-semibold text-ink">
                         {entry.className}
                       </span>
                       {!isClassTeacher && entry.subject && (
                         <span className="truncate text-[12px] font-medium text-slate-600">
                           {entry.subject}
                         </span>
                       )}
                       <span
                         className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                           entry.canMarkAttendance
                             ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                             : 'bg-amber-50 text-amber-700 border border-amber-200'
                         }`}
                       >
                         {isClassTeacher
                           ? 'Attendance: yes'
                           : entry.canMarkAttendance
                             ? 'Attendance: yes'
                             : 'Attendance: no'}
                       </span>
                     </div>
                   );
                 })}
               </div>
             )}
           </>
         )}
      </div>
      <div className="border-b border-slate-200 bg-slate-50/60 p-3">
        {/* Added lg:flex-wrap so filters wrap to the next line instead of overflowing */}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative lg:max-w-xs lg:flex-1">
            <label htmlFor="assignment-search" className="mb-0.5 block text-[11px] font-semibold text-slate-700">
              Search
            </label>
            <Users className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              id="assignment-search"
              type="search"
              value={filters.q || ''}
              onChange={(event) => onFilterChange({ q: event.target.value })}
              placeholder="Student name, ID, or parent phone…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <SelectField
            label="Class"
            value={filters.class || ''}
            onChange={(event) => onFilterChange({ class: event.target.value, page: 1 })}
            className="lg:w-40"
          >
            <option value="">All Classes</option>
            {(classroomOptions || []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status || 'active'}
            onChange={(event) => onFilterChange({ status: event.target.value, page: 1 })}
            className="lg:w-36"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred Out</option>
            <option value="all">All Records</option>
          </SelectField>

                    <SelectField
            label="Gender"
            value={filters.gender || ''}
            onChange={(event) => onFilterChange({ gender: event.target.value, page: 1 })}
            className="lg:w-32"
          >
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>

          <SelectField
            label="Assignment Tag"
            value={filters.tag || ''}
            onChange={(event) => onFilterChange({ tag: event.target.value, page: 1 })}
            className="lg:w-40"
          >
            <option value="">All</option>
            <option value="CT">CT (Class Teacher)</option>
            <option value="ST">ST (Subject Teacher)</option>
            <option value="unassigned">Unassigned</option>
          </SelectField>

           {showRoleUI ? (
             <>
               <div className="flex items-center justify-between w-full">
                 <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Class assignment options</span>
                 <button
                   type="button"
                   onClick={() => setShowRoleUI(false)}
                   className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                   aria-label="Close assignment options"
                 >
                   ✕
                 </button>
               </div>
               <div className="flex flex-col gap-2 lg:flex-row lg:items-end w-full">
                 <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="lg:w-40">
                   <option value="subject">Subject Teacher</option>
                   <option value="class">Class Teacher</option>
                 </SelectField>
                  {role === 'subject' && (
                    <div className="w-full lg:w-72 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Subjects</span>
                        <button
                          type="button"
                          onClick={() => setShowSubjects((v) => !v)}
                          className="text-[11px] font-extrabold text-slate-500 hover:text-slate-700"
                        >
                          {showSubjects ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {showSubjects && (
                        <>
                          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                            {allSubjects.map((s) => (
                              <label key={s.value} className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedSubjects.includes(s.value)}
                                  onChange={() => toggleSubject(s.value)}
                                  className="rounded-md text-brand-600 focus:ring-brand-500"
                                />
                                {s.label}
                              </label>
                            ))}
                          </div>
                          {/* FIX APPLIED HERE: min-w-0 to input, shrink-0 to button */}
                          <div className="mt-1 flex gap-1">
                            <input
                              type="text"
                              value={customSubjectName}
                              onChange={(e) => setCustomSubjectName(e.target.value)}
                              placeholder="Other subject…"
                              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-[12px] text-ink"
                            />
                            <button
                              type="button"
                              onClick={addCustomSubject}
                              className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-extrabold text-slate-700 hover:bg-slate-50"
                            >
                              Add
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                 {role === 'subject' && (
                   <label className="flex items-center gap-2 text-[12px] font-semibold">
                     <input type="checkbox" checked={attendance} onChange={(e) => setAttendance(e.target.checked)} />
                     Assign attendance responsibility
                   </label>
                 )}
               </div>
                {filters.class ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onAssignClass(filters.class, { role, subjects: selectedSubjects, canMarkAttendance: role === 'class' ? true : attendance })}
                      disabled={busy !== null || (role === 'subject' && selectedSubjects.length === 0)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3 text-[12.5px] font-extrabold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
                    >
                      Assign class
                    </button>
                    {role === 'subject' && (
                      <button
                        type="button"
                        onClick={() => onAssignClass(filters.class, { role, subjects: selectedSubjects, canMarkAttendance: false })}
                        disabled={busy !== null}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        Revoke attendance
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[12px] text-slate-500">Select a class above to assign.</span>
                )}

             </>
           ) : (
             <button
               type="button"
               onClick={() => setShowRoleUI(true)}
               className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-extrabold text-slate-700 hover:bg-slate-50"
             >
               Show class assignment options
             </button>
           )}
        </div>
      </div>

      {/* FIX APPLIED HERE: Forced the table to scroll horizontally instead of pushing the page wide */}
      <div className="min-h-0 flex-1 overflow-auto w-full">
        <table className="min-w-[800px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <th className="w-10 px-4 py-2.5">
                <label className="flex cursor-pointer items-center justify-center">
                  <span className="sr-only">Select every student on this page</span>
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((row) => selected.has(String(row._id)))}
                    ref={(node) => {
                      if (node) {
                        const some = filteredRows.some((row) => selected.has(String(row._id)));
                        node.indeterminate = some && !filteredRows.every((row) => selected.has(String(row._id)));
                      }
                    }}
                    onChange={(event) => onSelectPage(event.target.checked)}
                    disabled={busy !== null || !filteredRows.length}
                    className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/30 disabled:opacity-50"
                  />
                </label>
              </th>
              <th className="px-4 py-2.5">Student</th>
              <th className="px-4 py-2.5">Class</th>
              <th className="px-4 py-2.5">Parent phone</th>
              <th className="px-4 py-2.5">Assignment</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5">
                    <span className="block h-4 w-4 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-40 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-16 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block h-3 w-20 animate-pulse rounded bg-slate-100" />
                  </td>
                  <td className="px-4 py-2.5" />
                </tr>
              ))
            ) : !filteredRows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-[13px] font-bold text-ink">No students match these filters.</p>
                  <button
                    type="button"
                                         onClick={() => onFilterChange({ class: '', status: 'active', gender: '', q: '', tag: '' })}
                    className="mt-1 text-[12px] font-extrabold text-brand-700 hover:underline"
                  >
                    Clear the filters
                  </button>
                </td>
              </tr>
            ) : (
              filteredRows.map((student) => (
                <StudentAssignmentRow
                  key={student._id}
                  student={student}
                  selected={selected.has(String(student._id))}
                  disabled={busy !== null}
                  onToggle={onToggleStudent}
                  onRemove={(id) => onUnassign([id], { force: false })}                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5">
          <p className="text-[12px] font-semibold text-slate-500">
            Page {pagination.page} of {pagination.pages} · {pagination.total} students
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || busy !== null}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages || busy !== null}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <BulkAssignBar
        selectedIds={[...selected]}
        busy={busy}
        teacherName={teacher?.name || 'this teacher'}
        assignedCount={assignedCount}
        classMediatedCount={classMediatedSelected}
        onAssign={onAssign}
        onRemove={onUnassign}
      />

      {lastResult?.action === 'unassign' && lastResult.skipped > 0 && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-bold text-amber-900">
          {lastResult.skipped} left alone — {lastResult.skippedReason || 'assigned with a class'}.
        </p>
      )}
    </section>
  );
};

export default TeacherAssignmentPanel;