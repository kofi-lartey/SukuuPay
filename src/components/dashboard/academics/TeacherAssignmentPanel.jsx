import React, { useMemo, useState, useEffect } from 'react';
import {
  CheckSquare,
  Users,
  Clock,
  UserCheck,
  Trash2,
  Link2,
  Check,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  Search,
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
  classroomOptions,
  onPageChange,
}) => {
  const [showClassAssignments, setShowClassAssignments] = useState(true);
  const [showRoleUI, setShowRoleUI] = useState(true);
  const [role, setRole] = useState('subject');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [showSubjects, setShowSubjects] = useState(false);
  const [attendance, setAttendance] = useState(true);

  const allSubjects = ALL_SUBJECTS;

  const classroomOptionList = (Array.isArray(classroomOptions) ? classroomOptions : [])
    .map((item) => (typeof item === 'string' ? item.trim() : String(item?.className || item?.name || '').trim()))
    .filter(Boolean);

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

  const [searchTerm, setSearchTerm] = useState((filters?.search || filters?.q || ''));
  useEffect(() => {
    setSearchTerm(filters?.search || filters?.q || '');
  }, [filters?.search, filters?.q]);

  const filteredRows = useMemo(() => {
    let result = [...(page || [])];
    const term = (filters?.search || filters?.q || '').toLowerCase();
    if (term) {
      result = result.filter(
        (row) =>
          row.name?.toLowerCase().includes(term) ||
          row.studentId?.toLowerCase().includes(term) ||
          row.parentPhone?.toLowerCase().includes(term)
      );
    }
    if (filters?.class) {
      result = result.filter((row) => row.studentClass === filters.class);
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter((row) => row.status === filters.status);
    }
    if (filters?.gender) {
      result = result.filter((row) => row.gender === filters.gender);
    }
    if (filters?.tag) {
      if (filters.tag === 'unassigned') {
        result = result.filter((row) => !row.assignedToTeacher);
      } else if (filters.tag === 'assigned') {
        result = result.filter((row) => row.assignedToTeacher);
      } else {
        result = result.filter((row) => row.tag === filters.tag);
      }
    }
    return result;
  }, [page, filters]);

  const classMediatedSelected = filteredRows.filter((row) => selected.has(String(row._id)) && row.classMediated).length;
  const assignedCount = (page || []).filter((row) => row.assignedToTeacher).length;

  const classMediatedCount = (page || []).filter((row) => row.classMediated && row.assignedToTeacher).length;

  const currentPage = pagination?.page || filters?.page || 1;
  const totalPages = pagination?.pages || pagination?.totalPages || 1;

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
                   if (entry.canMarkAttendance || !entry.subject) acc[key].attendance = true;
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
                    {!entry.isClassTeacher && entry.subjects.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onAssignClass(entry.className, {
                            role: 'subject',
                            subjects: entry.subjects,
                            canMarkAttendance: !entry.attendance,
                          })
                        }
                        disabled={busy !== null}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        {entry.attendance ? 'Revoke attendance' : 'Reassign attendance'}
                      </button>
                    )}
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
                  <>
                    <button
                      type="button"
                      onClick={() => onAssignClass(filters.class, { role, subjects: selectedSubjects, canMarkAttendance: false })}
                      disabled={busy !== null}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Revoke attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => onAssignClass(filters.class, { role, subjects: selectedSubjects, canMarkAttendance: true })}
                      disabled={busy !== null || (role === 'subject' && selectedSubjects.length === 0)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Reassign attendance
                    </button>
                  </>
                )}
              </>
            ) : (
              <span className="text-[12px] text-slate-500">Select a class above to assign.</span>
            )}
          </>
        )}
      </div>

      <div className="border-b border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="relative lg:max-w-xs lg:flex-1">
            <label htmlFor="teacher-assignment-search" className="mb-0.5 block text-[11px] font-semibold text-slate-700">
              Search
            </label>
            <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              id="teacher-assignment-search"
              type="search"
              value={searchTerm}
              onChange={(event) => {
                const value = event.target.value;
                setSearchTerm(value);
                onFilterChange?.({ q: value, page: 1 });
              }}
              placeholder="Student name, ID, or parent phone…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <SelectField
            label="Class"
            value={filters?.class || ''}
            onChange={(event) => onFilterChange?.({ class: event.target.value, page: 1 })}
            className="lg:w-44"
          >
            <option value="">All Classes</option>
            {classroomOptionList.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Assignment"
            value={filters?.tag || ''}
            onChange={(event) => onFilterChange?.({ tag: event.target.value, page: 1 })}
            className="lg:w-44"
          >
            <option value="">All</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
            <option value="CT">Class teacher (CT)</option>
            <option value="ST">Subject teacher (ST)</option>
          </SelectField>

          <SelectField
            label="Record status"
            value={filters?.status || 'active'}
            onChange={(event) => onFilterChange?.({ status: event.target.value, page: 1 })}
            className="lg:w-40"
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="graduated">Graduated</option>
            <option value="transferred">Transferred</option>
            <option value="archived">Archived</option>
            <option value="all">All Records</option>
          </SelectField>

          <SelectField
            label="Gender"
            value={filters?.gender || ''}
            onChange={(event) => onFilterChange?.({ gender: event.target.value, page: 1 })}
            className="lg:w-36"
          >
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>
        </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-[12px] font-medium text-slate-500">
          Page {currentPage} of {totalPages}
          {pagination?.total ? ` · ${pagination.total} students` : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = currentPage - 1;
              if (onPageChange) onPageChange(next);
              else onFilterChange?.({ page: next });
            }}
            disabled={currentPage <= 1 || loading}
            aria-label="Previous page"
            className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              const next = currentPage + 1;
              if (onPageChange) onPageChange(next);
              else onFilterChange?.({ page: next });
            }}
            disabled={currentPage >= totalPages || loading}
            aria-label="Next page"
            className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
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
