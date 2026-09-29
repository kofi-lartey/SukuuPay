import React from 'react';

/**
 * Generic phone frame: notch, status bar and a scrollable screen.
 *
 * Deliberately chrome-free so any content (an SMS thread, a pay page) can be
 * dropped inside without inheriting the marketing mock-up's styling. The
 * marketing `PhoneMockup` stays specialised; this one is the reusable shell the
 * onboarding wizard renders its SMS preview in.
 */
const PhonePreview = ({ children, label = 'Phone preview', footer, className = '' }) => (
  <div
    className={`relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border-[9px] border-slate-900 bg-slate-900 shadow-phone ${className}`}
  >
    <span className="sr-only">{label}</span>

    <div className="relative flex min-h-[520px] flex-col overflow-hidden rounded-[1.9rem] bg-slate-50">
      {/* Notch */}
      <div className="absolute left-1/2 top-1.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-bold text-slate-500">
        <span>9:41</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-2 w-3.5 rounded-[2px] border border-slate-400" />
          <span className="h-2 w-4 rounded-[2px] bg-slate-400" />
        </span>
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>

      {footer && (
        <div className="border-t border-slate-200 bg-white px-4 py-2.5 text-center text-[10px] font-semibold text-slate-400">
          {footer}
        </div>
      )}

      {/* Home indicator */}
      <div className="mx-auto mb-2 mt-2 h-1 w-24 rounded-full bg-slate-300" aria-hidden="true" />
    </div>
  </div>
);

export default PhonePreview;
