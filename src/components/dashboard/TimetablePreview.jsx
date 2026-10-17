import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = Number(h);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${m || '00'} ${ampm}`;
};

const TimetablePreview = ({ open, onClose, days = {}, className = '', term = '', academicYear = '' }) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-soft sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              Timetable Preview{className ? ` — ${className}` : ''}
            </h2>
            {(term || academicYear) && (
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                {[term, academicYear].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {DAYS.map((day) => {
              const periods = (days[day] || []).slice().sort((a, b) => (a.period || 0) - (b.period || 0));
              return (
                <div key={day} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                  <h3 className="mb-2 text-[13px] font-extrabold text-ink">{day}</h3>
                  {periods.length === 0 ? (
                    <p className="text-[11.5px] italic text-slate-400">No periods</p>
                  ) : (
                    <div className="space-y-2">
                      {periods.map((p, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-brand-700">
                              {formatTime(p.startTime)} – {formatTime(p.endTime)}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              #{p.period}
                            </span>
                          </div>
                          <p className="mt-1 text-[12.5px] font-bold text-ink leading-tight">
                            {p.subject || '—'}
                          </p>
                          {(p.teacher || p.room) && (
                            <p className="mt-0.5 text-[10.5px] text-slate-500">
                              {[p.teacher, p.room].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TimetablePreview;
