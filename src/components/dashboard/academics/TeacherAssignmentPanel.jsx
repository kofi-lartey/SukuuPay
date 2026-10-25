import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Users,
  Clock,
  UserCheck,
  Trash2,
  Link2,
  Check,
  LoaderCircle,
} from 'lucide-react';
import { SelectField } from '../../common/FormField';
import StudentAssignmentRow from './StudentAssignmentRow';
import BulkAssignBar from './BulkAssignBar';
import Badge from '../ui/Badge';

const ALL_SUBJECTS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'English Language', label: 'English Language' },
  { value: 'Integrated Science', label: 'Integrated Science' },
  { value: 'Social Studies', label: 'Social Studies' },
  { value: 'ICT (Computing)', label: 'ICT (Computing)' },
  { value: 'French', label: 'French' },
  { value: 'Career Technology', label: 'Career Technology' },
  { value: 'R.M.E.', label: 'R.M.E.' },
  { value: 'Ghanaian Language', label: 'Ghanaian Language' },
  { value: 'Creative Arts', label: 'Creative Arts' },
  { value: 'Physical Education', label: 'Physical Education' },
];

const TeacherAssignmentPanel = ({
  teacher,
  teachers,
  page,
  pagination,
  loading,
  error,
  filters,
  onFilterChange,
  onReload,
  selected,
  onToggleStudent,
  onSelectPage,
  onAssign,
  onUnassign,
  onAssignClass,
  selectedTeacherId,
  onSelectTeacher,
  busy,
  lastResult,
}) => {
  const [showClassAssignments, setShowClassAssignments] = useState(true);
  const [showRoleUI, setShowRoleUI] = useState(true);
  const [role, setRole] = useState('subject');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [showSubjects, setShowSubjects] = useState(false);
  const [attendance, setAttendance] = useState(true);

  const allSubjects = ALL_SUBJECTS;

  const toggleSubject = (value) => {
    setSelectedSubjects((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const addCustomSubject = () => {
    const name = customSubjectName.trim();
    if (!name) return;
    if (!selectedSubjects.includes(name)) setSelectedSubjects((current) => [...current, name]);
    setCustomSubjectName('');
  };

  const filteredRows = useMemo(() => {
    let result = [...(page || [])];
    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(
        (row) =>
          row.name?.toLowerCase().includes(term) ||
          row.studentId?.toLowerCase().includes(term) ||
          row.parentPhone?.toLowerCase().includes(term)
      );
    }
    if (filters.class) {
      result = result.filter((row) => row.studentClass === filters.class);
    }
    if (filters.status) {
      result = result.filter((row) => row.status === filters.status);
    }
    if (filters.gender) {
      result = result.filter((row) => row.gender === filters.gender);
    }
    if (filters.tag) {
      if (filters.tag === 'unassigned') {
        result = result.filter((row) => !row.assignedToTeacher);
      } else {
        result = result.filter((row) => row.tag === filters.tag);
      }
    }
    return result;
  }, [page, filters]);

  const classMediatedSelected = filteredRows.filter((row) => selected.has(String(row._id)) && row.classMediated).length;
  const assignedCount = (page || []).filter((row) => row.assignedToTeacher).length;

  const classMediatedCount = (page || []).filter((row) => row.classMediated && row.assignedToTeacher).length;

  const classes = Array.isArray(teacher?.assignedClasses) ? teacher.assignedClasses : [];

  if (!teacher) {
    return (
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-bold text-slate-500">Pick a teacher to begin.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50/60 p-3">
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
                No classes assigned — use the options below to assign.
              </p>
            ) : (
              <div className="grid gap-1.5">
                {Object.values(classes.reduce((acc, entry) => {
                  const key = entry.className;
                  if (!acc[key]) acc[key] = { className: entry.className, subjects: [], attendance: false, isClassTeacher: false };
                  if (entry.subject) acc[key].subjects.push(entry.subject);
                  if (entry.canMarkAttendance) acc[key].attendance = true;
                  if (!entry.subject) acc[key].isClassTeacher = true;
                  return acc;
                }, {})).map((entry) => (
                  <div
                    key={entry.className}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 min-w-0"
                  >
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${entry.isClassTeacher ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                      {entry.isClassTeacher ? 'Class teacher' : 'Subject teacher'}
                    </span>
                    <span className="flex-1 truncate text-[12px] font-semibold text-ink">
                      {entry.className}
                    </span>
                    {entry.subjects.length > 0 && (
                      <span className="truncate text-[12px] font-medium text-slate-600">
                        {entry.subjects.join(', ')}
                      </span>
                    )}
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${entry.attendance ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {entry.attendance ? 'Attendance: yes' : 'Attendance: no'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between min-w-0 mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
            Class assignment options
          </span>
          <button
            type="button"
            onClick={() => setShowRoleUI((v) => !v)}
            className="shrink-0 text-[11px] font-extrabold text-slate-500 hover:text-slate-700"
          >
            {showRoleUI ? 'Hide' : 'Show'}
          </button>
        </div>
        {showRoleUI && (
          <>
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
        )}
      </div>

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
                    <span className="block h-3 w-12 animate-pulse rounded bg-slate-100" />
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
                    onClick={onReload}
                    className="mt-2 text-[12px] font-extrabold text-brand-700 hover:underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              filteredRows.map((student) => (
                <StudentAssignmentRow
                  key={student._id}
                  student={student}
                  selected={selected.has(String(student._id))}
                  onToggle={onToggleStudent}
                  onRemove={(id) => onUnassign([id], { force: false })}
                  disabled={busy !== null}
                  teacherName={teacher?.name}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <BulkAssignBar
        selectedIds={[...selected]}
        busy={busy}
        onAssign={onAssign}
        onRemove={onUnassign}
        teacherName={teacher?.name || ''}
        assignedCount={assignedCount}
        classMediatedCount={classMediatedSelected}
      />
    </section>
  );
};

export default TeacherAssignmentPanel;
