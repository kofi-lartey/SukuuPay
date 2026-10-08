import React from 'react';
import { SHEET_LAYOUTS } from '../../utils/constants';

const LayoutMiniPreview = ({ cols, rows }) => {
  const cellSize = 8;
  const gap = 2;
  const totalWidth = cols * cellSize + (cols - 1) * gap;
  const totalHeight = rows * cellSize + (rows - 1) * gap;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className="flex-shrink-0"
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (cellSize + gap);
        const y = row * (cellSize + gap);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={cellSize}
            height={cellSize}
            fill="#e2e8f0"
            rx={1}
          />
        );
      })}
    </svg>
  );
};

const SheetLayoutPicker = ({ value, onChange }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-extrabold text-ink">Sheet Layout</h3>
      <p className="text-xs text-slate-500">Choose how many cards print per A4 sheet.</p>

      <div className="grid gap-3">
        {SHEET_LAYOUTS.map((layout) => (
          <label
            key={layout.value}
            className={`flex items-start gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${
              value === layout.value
                ? 'border-brand-700 bg-brand-50/30'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="sheetLayout"
              value={layout.value}
              checked={value === layout.value}
              onChange={(e) => onChange(e.target.value)}
              className="sr-only"
            />
            <LayoutMiniPreview cols={layout.cols} rows={layout.rows} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-extrabold ${
                value === layout.value ? 'text-brand-700' : 'text-ink'
              }`}>
                {layout.label}
              </p>
              {layout.recommended && (
                <span className="text-xs font-bold text-brand-700">(Recommended)</span>
              )}
              <p className="text-xs text-slate-500 mt-0.5">{layout.caption}</p>
            </div>
            {layout.recommended && value === layout.value && (
              <span className="text-xs font-bold text-amber-600">Recommended</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
};

export default SheetLayoutPicker;
