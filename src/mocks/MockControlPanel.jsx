import React, { useEffect, useState } from 'react';
import { Bug, Download, RotateCcw, TriangleAlert, X } from 'lucide-react';
import {
  getDb,
  getPersonaId,
  getRequestLog,
  MOCK_PASSWORD,
  onRequestLog,
  PERSONAS,
  resetDb,
  setPersona,
  setScenario,
} from './db';
import { SCENARIOS } from './scenarios';
import { IMPORT_FIXTURES } from './fixtures';

/** Every mock account shares one fixed password; shown so login is one paste. */
const download = (name, content, type = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const useRequestLog = () => {
  const [log, setLog] = useState(getRequestLog());
  useEffect(() => onRequestLog(setLog), []);
  return log;
};

const Section = ({ title, children }) => (
  <div className="border-t border-white/10 px-3 py-2.5">
    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">{title}</p>
    {children}
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="sr-only">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className="w-full cursor-pointer rounded-lg border border-white/15 bg-brand-900/60 px-2.5 py-2 text-[12px] font-bold text-white outline-none focus:border-amber-300"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-brand-900">
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

/**
 * Dev-only control panel.
 *
 * Mounted only when `VITE_USE_MOCKS` is on, and excluded from the production
 * bundle by a dynamic import in `main.jsx`. Its job is to make the two things
 * that make a demo environment frustrating — reproducing a state and resetting
 * to a clean one — a single click.
 */
const MockControlPanel = () => {
  const [open, setOpen] = useState(false);
  const [persona, setPersonaState] = useState(getPersonaId());
  const [scenario, setScenarioState] = useState('healthy');
  const log = useRequestLog();

  const db = getDb();
  const user = db?.users?.[0];
  const school = db?.schools?.[0];

  const switchPersona = (id) => {
    setPersona(id);
    setPersonaState(id);
    // A new persona is a new user id, so any completion flag from the previous
    // one would be meaningless. Clear it rather than leave a stale guard state.
    if (user?._id) localStorage.removeItem(`sukuupay_onboarding_completed_${user._id}`);
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sukuupay_onboarding'))
      .forEach((key) => localStorage.removeItem(key));
  };

  const reset = () => {
    resetDb(persona);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sukuupay_onboarding'))
      .forEach((key) => localStorage.removeItem(key));
    window.location.href = '/login';
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[95] flex items-center gap-2 rounded-full bg-brand-800 px-4 py-2.5 text-[12px] font-extrabold text-white shadow-lift ring-2 ring-amber-300/60 transition-transform hover:scale-105"
      >
        <Bug className="h-4 w-4" aria-hidden="true" />
        Mock API
      </button>
    );
  }

  const stat = {
    students: db?.students?.length ?? 0,
    owing: (db?.students || []).filter((s) => s.balance > 0).length,
    sent: db?.sentSms?.length ?? 0,
    balance: school?.sms?.balance ?? 0,
  };

  return (
    <div className="fixed bottom-4 right-4 z-[95] w-[min(92vw,22rem)] overflow-hidden rounded-2xl bg-brand-900 text-white shadow-phone ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2 bg-brand-800 px-3.5 py-2.5">
        <p className="flex items-center gap-2 text-[13px] font-extrabold">
          <Bug className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Mock API environment
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            aria-label="Reset mock state"
            className="rounded-lg p-1.5 text-emerald-100 transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close mock panel"
            className="rounded-lg p-1.5 text-emerald-100 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        <Section title="Signed in as">
          <p className="font-mono text-[11px] text-emerald-100">{user?.email || 'not signed in'}</p>
          <p className="mt-0.5 text-[11px] text-emerald-200/70">
            Password: <span className="font-mono font-bold text-amber-200">{MOCK_PASSWORD}</span>
          </p>
        </Section>

        <Section title="Persona">
          <Select
            label="Mock persona"
            value={persona}
            onChange={switchPersona}
            options={PERSONAS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-emerald-100/80">
            {PERSONAS.find((p) => p.id === persona)?.description}
          </p>
          <p className="mt-2 text-[11px] text-emerald-200/70">
            {stat.students} students · {stat.owing} owing
          </p>
        </Section>

        <Section title="Scenario">
          <Select
            label="Mock scenario"
            value={scenario}
            onChange={(id) => {
              setScenario(id);
              setScenarioState(id);
            }}
            options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-emerald-100/80">
            {SCENARIOS.find((s) => s.id === scenario)?.description}
          </p>
        </Section>

        <Section title="Download roster fixtures">
          <div className="space-y-1">
            {IMPORT_FIXTURES.map((fixture) => (
              <button
                key={fixture.id}
                type="button"
                onClick={() => download(`sukuupay-${fixture.id}.csv`, fixture.build())}
                className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/10"
              >
                <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[12px] font-bold text-white">{fixture.label}</span>
                  <span className="block text-[10px] leading-snug text-emerald-100/70">
                    {fixture.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={`Request log (${log.length})`}>
          {log.length === 0 ? (
            <p className="text-[11px] text-emerald-200/60">No requests yet.</p>
          ) : (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[10px]">
              {log.slice(0, 25).map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${
                    entry.ok ? 'text-emerald-200' : 'bg-red-500/20 text-red-200'
                  }`}
                >
                  <span className="w-7 shrink-0 font-bold">{entry.status}</span>
                  <span className="w-9 shrink-0 opacity-70">{entry.method}</span>
                  <span className="truncate">{entry.path}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-amber-200/80">
            <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            {stat.sent} SMS sent · balance {stat.balance}
          </p>
        </Section>
      </div>
    </div>
  );
};

export default MockControlPanel;
