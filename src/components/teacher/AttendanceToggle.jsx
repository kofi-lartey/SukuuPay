import { Check, Clock, X } from 'lucide-react';

const OPTIONS = [
  { key: 'present', label: 'Present', Icon: Check, tone: 'present' },
  { key: 'late', label: 'Late', Icon: Clock, tone: 'late' },
  { key: 'absent', label: 'Absent', Icon: X, tone: 'absent' },
];

const toneClasses = {
  present: {
    idle: 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600',
    active: 'border-emerald-600 bg-emerald-600 text-white',
  },
  late: {
    idle: 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600',
    active: 'border-amber-500 bg-amber-500 text-white',
  },
  absent: {
    idle: 'border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600',
    active: 'border-red-600 bg-red-600 text-white',
  },
};

/**
 * One student's status: present, late or absent.
 *
 * Three circles, colour-coded, because that is the decision a teacher makes
 * thirty times in a row and it has to be answerable from the corner of the
 * eye — the colour carries the state before the icon is read.
 *
 * `h-11 w-11` (44px) is not decoration: this is the control a teacher taps
 * dozens of times on a phone, and a smaller target on a small handset in a
 * classroom with cold hands is how a present becomes an absent.
 *
 * `role="radio"` on all three, inside a labelled `radiogroup`, because the
 * three are mutually exclusive — a student is exactly one of these. The
 * selected state is announced through `aria-checked` rather than conveyed by
 * colour alone, which a colour-blind teacher cannot read at all.
 */
const AttendanceToggle = ({ value, onChange, disabled }) => (
  <div className="flex gap-1" role="radiogroup" aria-label="Attendance status">
    {OPTIONS.map((opt) => {
      const active = value === opt.key;
      const classes = toneClasses[opt.tone];
      return (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={opt.label}
          title={opt.label}
          disabled={disabled}
          onClick={() => onChange(opt.key)}
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
            active ? classes.active : classes.idle
          }`}
        >
          <opt.Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

export default AttendanceToggle;
