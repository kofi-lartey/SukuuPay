import React from 'react';
import { Check, Link2 } from 'lucide-react';
import Badge from '../ui/Badge';

/**
 * One student in the assignment browser, with the checkbox that selects them.
 *
 * Two pills, and they say different things:
 *
 *   - **Assigned** — this teacher is already linked to this student. It is what
 *     makes the page's main failure mode visible: an admin who cannot tell whether a
 *     tick is adding or re-showing.
 *   - **With a class** — the link came from assigning the class, not from picking
 *     this student individually. Which is the warning that removing it will
 *     silently take the child out of the class's roster if forced through.
 *
 * The label is the whole row rather than just the box, so the tap target is the
 * row and not a 16px square. A phone in a staff room corridor is the target
 * device, and the alternative is a mis-tap that assigns somebody's child to the
 * wrong teacher.
 */
const StudentAssignmentRow = ({
  student,
  selected,
  disabled = false,
  onToggle,
  onRemove,
}) => {
  const id = String(student._id);
  const { tag } = student || {};

  const tagColor = tag === 'CT' ? 'green' : tag === 'ST' ? 'blue' : null;

  return (
    <tr className={disabled ? 'opacity-60' : 'hover:bg-slate-50/60'}>
      <td className="w-10 px-4 py-2.5">
        <label className="flex cursor-pointer items-center justify-center">
          <span className="sr-only">
            {student.name}
            {student.assignedToTeacher ? ' (already assigned)' : ''}
          </span>
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled || (tag === 'CT' && !student.assignedToTeacher)}
            onChange={() => onToggle(id)}
            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-2 focus:ring-brand-700/30 disabled:opacity-50"
          />
        </label>
      </td>

      <td className="px-4 py-2.5">
        <span className="block text-[13px] font-extrabold text-ink">{student.name}</span>
        <span className="block text-[11.5px] font-semibold text-slate-400">
          {student.studentId || '—'}
        </span>
      </td>

      <td className="px-4 py-2.5 text-[12.5px] font-bold text-slate-600">
        {student.studentClass || '—'}
      </td>

      <td className="px-4 py-2.5 text-[12.5px] font-medium text-slate-500">
        {student.parentPhone || '—'}
      </td>

      <td className="px-4 py-2.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {Array.isArray(student.teacherInitials) && student.teacherInitials.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {student.teacherInitials.map((initials, index) => (
                <Badge key={`t-${initials}-${index}`} tone="blue">
                  {initials}
                </Badge>
              ))}
            </span>
          )}
          {Array.isArray(student.subjectInitials) && student.subjectInitials.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {student.subjectInitials.map((initial, index) => (
                <Badge key={`s-${initial}-${index}`} tone="amber">
                  {initial}
                </Badge>
              ))}
            </span>
          )}

          {student.classMediated && student.assignedToTeacher && (
            <Badge tone="slate" icon={Link2}>
              With a class
            </Badge>
          )}
          {tag && (
            <Badge tone={tagColor || 'emerald'}>
              {tag}
            </Badge>
          )}
          {!student.assignedToTeacher && !tag && !student.teacherInitials?.length && (
            <span className="text-[11.5px] font-semibold text-slate-300">Not assigned</span>
          )}
        </span>
      </td>

      <td className="px-4 py-2.5 text-right">
        {student.assignedToTeacher && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            disabled={disabled}
            className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-extrabold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
};

export default StudentAssignmentRow;
