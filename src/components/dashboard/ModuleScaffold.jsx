import React from 'react';
import { Construction } from 'lucide-react';
import PageHeader from './PageHeader';
import Card from './ui/Card';

/**
 * The frame every not-yet-built module renders into.
 *
 * A module under construction is the one place where a placeholder is the honest
 * answer, and this makes that a single reusable component rather than eight
 * bespoke "coming soon" pages that each say something different about the
 * product's state.
 *
 * The important part is `sections`. An empty screen tells an admin nothing; a
 * named list of what the module will contain and which endpoint backs each part
 * tells them the product is being built, and gives whoever picks it up next the
 * wiring without re-deriving it. That is the difference between a placeholder and
 * a specification.
 *
 * `action` is rendered as a disabled control, never a link. A button that looks
 * live and goes nowhere is worse than one that admits it is not.
 */
const ModuleScaffold = ({
  eyebrow,
  title,
  description,
  action,
  sections = [],
  notes = [],
  children,
}) => (
  <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />

    {/*
      The module's primary action, disabled and visibly so. Kept above the
      state notice rather than inside it so the page still answers "what will
      this page let me do" before it answers "it does not work yet".
    */}
    {action && (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          title="Not available yet"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-500"
        >
          {action}
        </span>
      </div>
    )}

    <Card padding="p-4" className="mb-5 border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Construction className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold text-amber-900">This module is being built</p>
          <p className="mt-0.5 text-[13px] font-medium text-amber-800">
            The layout below is final; the data behind it is not wired yet. Nothing here
            is placeable.
          </p>
        </div>
      </div>
    </Card>

    {children}

    {sections.length > 0 && (
      <div className="mt-5">
        <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          What this module will hold
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} padding="p-4" className="shadow-none">
              <div className="flex items-start gap-3">
                {section.icon ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <section.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{section.title}</p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-500">
                    {section.description}
                  </p>
                  {section.endpoint && (
                    <code className="mt-2 inline-block rounded-md bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold text-slate-500">
                      {section.endpoint}
                    </code>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )}

    {notes.length > 0 && (
      <ul className="mt-5 space-y-2">
        {notes.map((note) => (
          <li
            key={note}
            className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-slate-600"
          >
            {note}
          </li>
        ))}
      </ul>
    )}
  </>
);

export default ModuleScaffold;
