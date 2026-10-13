import { Users } from 'lucide-react';

/**
 * Which class am I working on.
 *
 * A horizontal scroller rather than a `<select>`, because the count is small
 * (a teacher has two to six) and a teacher switching between three classes
 * while marking attendance is doing the same gesture thirty times. A dropdown
 * costs two taps and hides the student counts — the number that says whether
 * this is a class of 12 or a class of 40.
 *
 * `overflow-x-auto` is what keeps it honest at 320px: six chips will not fit,
 * and they scroll rather than wrap. Wrapping would be worse — it makes the
 * picker taller on some classes than others, and the roster underneath jumps
 * down by a row when the teacher switches.
 */
const ClassPicker = ({ classes, value, onChange, className = '' }) => (
  <div className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
    {classes.map((c) => {
      const active = c.className === value;
      return (
        <button
          key={c.className}
          type="button"
          onClick={() => onChange(c.className)}
          className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors ${
            active
              ? 'bg-sky-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {c.className}
          <span
            className={`text-[10.5px] font-bold ${
              active ? 'text-sky-100' : 'text-slate-400'
            }`}
          >
            {c.studentCount}
          </span>
        </button>
      );
    })}
  </div>
);

export default ClassPicker;
