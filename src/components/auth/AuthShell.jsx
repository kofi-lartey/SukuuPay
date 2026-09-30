import React from 'react';
import { ShieldCheck } from 'lucide-react';

const AuthShell = ({ aside, eyebrow, title, description, children }) => (
  <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl shadow-slate-900/5">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Aside — hidden on mobile, 5/12 on desktop */}
        {aside && (
          <aside className="hidden lg:col-span-5 lg:flex lg:flex-col">
            {aside}
          </aside>
        )}

        {/* Form section — full width on mobile, 7/12 on desktop */}
        <section className="flex flex-col justify-between bg-white p-6 sm:p-7 lg:col-span-7 lg:p-9">
          <div>
            <div className="mb-6">
              {eyebrow && (
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
                  {eyebrow}
                </span>
              )}
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-[1.75rem]">
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-lg text-[13px] font-medium leading-relaxed text-slate-600">
                  {description}
                </p>
              )}
            </div>

            {children}
          </div>

          {/* <p className="mt-6 flex items-start gap-1.5 border-t border-slate-100 pt-4 text-[11px] font-medium leading-relaxed text-slate-500">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700" />
            <span>
              Regulated under Bank of Ghana fintech guidelines &bull; GhIPSS Direct Clearing
              &bull; Act 843 Data Protection Compliant
            </span>
          </p> */}
        </section>
      </div>
    </div>
  </div>
);

export default AuthShell;