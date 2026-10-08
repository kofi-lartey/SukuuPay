import React from 'react';
import { PRINT_SIDES } from '../../utils/constants';

const SidesPicker = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-extrabold text-ink">Print Sides</h3>
      <p className="text-xs text-slate-500">Choose whether backs are printed.</p>

      <div className="grid gap-3">
        {PRINT_SIDES.map((side) => (
          <label
            key={side.value}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${
              value === side.value
                ? 'border-brand-700 bg-brand-50/30'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="sides"
              value={side.value}
              checked={value === side.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-extrabold ${
                value === side.value ? 'text-brand-700' : 'text-ink'
              }`}>
                {side.label}
              </p>
              <p className={`text-xs ${
                value === side.value ? 'text-brand-700' : 'text-slate-500'
              }`}>
                {side.description}
              </p>
            </div>
            {value === side.value && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700">
                <span className="text-xs text-white">✓</span>
              </div>
            )}
          </label>
        ))}
      </div>
    </div>
  );
};

export default SidesPicker;
