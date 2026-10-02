import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Cpu,
  Info,
  OctagonAlert,
  RefreshCw,
  ServerCrash,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import EmptyState from '../../../components/dashboard/EmptyState';
import MaintenanceModeDialog from './MaintenanceModeDialog';
import { getJobRuns, getRecentErrors, getSystemHealth, setMaintenanceMode } from '../../../services/admin';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { useToast } from '../../../hooks/useToast';
import { formatCount } from '../../../utils/format';

/**
 * What is broken, and what is merely unhappy.
 *
 * Four independent reads — `GET /admin/health`, `/health/jobs`, `/health/errors` and the
 * platform settings singleton for the maintenance state — each with its own error, because
 * a scheduler probe failing must not blank the dependency cards and the panel an operator
 * opened this screen for is whichever one they were worried about.
 *
 * **The colour rule is the whole screen, so it is stated once here and applied everywhere.**
 *
 *   - **Green (`ok`)** — the dependency answered.
 *   - **Amber (`degraded`)** — the dependency answered, but something about it is wrong:
 *     an optional provider is unreachable, the SMS balance is exhausted, a probe timed
 *     out on a socket that may still work.
 *   - **Red (`down`)** — the dependency is unusable, or it is *required* and unusable.
 *
 * Only a **required** dependency going `down` makes the platform `down`, and MongoDB is the
 * only required one (`health.service.js:733-747`). The roll-up is: any required `down` →
 * `down`; otherwise anything not `ok` → `degraded`; otherwise `ok`. The second clause is
 * the one that matters: a single optional dependency being down produces `degraded`, not
 * `ok`, because "everything is fine" has to mean everything.
 *
 * **An empty SMS balance is amber, never red.** Parents can still pay — the schools' own
 * mobile-money rails do not touch the platform's SMS provider — so it costs receipts and
 * reminders, not collections. An operator shown a red panel for it will escalate it, and an
 * operator shown a red panel instead of an amber one learns to ignore red panels. Red is
 * reserved for "this cannot serve requests", and the dependency cards name which is which
 * by printing `required` on the card.
 *
 * Two panels carry a caveat because their absence would be read as a claim about the
 * platform when it is a claim about one process:
 *
 *   - **The job table has no history and says so.** `getJobRuns()` returns
 *     `historyAvailable: false` and four live scheduler fields — expression, last tick,
 *     next tick, running flag (`health.service.js:837-844`). There is no `JobRun` model in
 *     this codebase. Rendering an empty history column would read as "no jobs have ever
 *     run", which is a materially different claim from "nothing records that they did".
 *     Durations and success counts are not estimated, for the same reason:
 *     `lastExecution` is stamped when the timer *fires*, before the handler finishes, so
 *     `now - lastExecution` is not a duration.
 *
 *   - **The error panel is one process's ring buffer.** `utils/errorBuffer.js` holds the
 *     last 500 5xx on the instance that served the request; nothing is persisted anywhere
 *     (`middleware/errorHandler.js` ends at a `console.error`). So "no recent errors" means
 *     "no recent errors on this process since it started" and nothing else — after a
 *     restart, or on a sibling behind the load balancer, this panel is empty regardless of
 *     what happened. The caveat is rendered above the list, not in a footnote, because a
 *     footnote under an empty list is read after the empty list has already been believed.
 *
 *     The server sends its own caveat in the envelope's `meta` (`scope`, `durable`,
 *     `limitations[]`), but `admin.js`'s `getRecentErrors` reads `data.data` only and
 *     discards it, so the wording below is the console's own. Reported to the coordinator
 *     as a one-line service fix.
 */
const STATUS_STYLE = {
  ok: {
    label: 'OK',
    card: 'border-emerald-200 bg-emerald-50/60',
    dot: 'bg-emerald-500',
    badge: 'green',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    card: 'border-amber-200 bg-amber-50/70',
    dot: 'bg-amber-500',
    badge: 'amber',
    icon: TriangleAlert,
  },
  down: {
    label: 'Down',
    card: 'border-red-200 bg-red-50/70',
    dot: 'bg-red-500',
    badge: 'red',
    icon: OctagonAlert,
  },
};

const statusStyle = (status) =>
  STATUS_STYLE[status] || { label: String(status || 'unknown'), card: 'border-slate-200', dot: 'bg-slate-300', badge: 'slate', icon: CircleDot };

const stamp = (value) => {
  if (!value) return '—';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '—';
  return when.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const SystemHealth = () => {
  const toast = useToast();
  const { settings } = usePlatformSettings();
  const [reloadKey, setReloadKey] = useState(0);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const [health, setHealth] = useState({ data: null, loading: true, error: null });
  const [jobs, setJobs] = useState({ data: null, loading: true, error: null });
  const [errors, setErrors] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setHealth((current) => ({ ...current, loading: true, error: null }));
    getSystemHealth()
      .then((data) => active && setHealth({ data, loading: false, error: null }))
      .catch((error) => active && setHealth({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setJobs((current) => ({ ...current, loading: true, error: null }));
    getJobRuns()
      .then((data) => active && setJobs({ data, loading: false, error: null }))
      .catch((error) => active && setJobs({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setErrors((current) => ({ ...current, loading: true, error: null }));
    getRecentErrors({ limit: 50 })
      .then((data) => active && setErrors({ data, loading: false, error: null }))
      .catch((error) => active && setErrors({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * The maintenance write, returning `{ ok, error }` and never throwing.
   *
   * `enabled: true` becomes `readonly` server-side; the dialog says so. A failure here is
   * reported through the same dialog's own error slot rather than a toast, so the message
   * the operator typed survives the failed attempt — a platform-wide switch is not
   * something to retry blind from a screen that has forgotten what it was going to say.
   */
  const applyMaintenance = useCallback(
    async ({ enabled, message }) => {
      try {
        const result = await setMaintenanceMode({ enabled, message });
        toast.success(
          enabled
            ? `Maintenance mode is now "${result.mode || 'readonly'}". Every write on the platform is refused until it is turned off.`
            : 'Maintenance mode is off. Reads and writes both work again.'
        );
        refresh();
        return { ok: true, result };
      } catch (error) {
        return { ok: false, error: error.message || 'Maintenance mode could not be changed.' };
      }
    },
    [refresh, toast]
  );

  const data = health.data || {};
  const overall = statusStyle(data.status);
  const dependencies = Array.isArray(data.summary) ? data.summary : [];
  const currentMode = settings?.maintenance?.mode || 'off';
  const currentMessage = settings?.maintenance?.message || '';

  const jobRows = Array.isArray(jobs.data?.jobs) ? jobs.data.jobs : [];
  const errorRows = Array.isArray(errors.data) ? errors.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="System health"
        description="Every dependency the platform needs, one at a time, so a red panel can tell you which one."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data.status && (
              <Badge tone={overall.badge} icon={overall.icon}>
                Platform {overall.label.toLowerCase()}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => setMaintenanceOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-extrabold shadow-lift transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40 ${
                currentMode === 'off'
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <Wrench className="h-4 w-4" aria-hidden="true" />
              {currentMode === 'off' ? 'Maintenance mode' : `Maintenance: ${currentMode}`}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={health.loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RefreshCw className={`h-4 w-4 ${health.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      {/*
        The overall banner, and the sentence that makes the three colours mean different
        things. An operator who has seen "amber" and "red" mean the same thing once will
        not read either of them again.
      */}
      {data.status && (
        <div
          className={`rounded-2xl border px-5 py-4 ${overall.card}`}
          role="status"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-ink">
                {data.status === 'ok'
                  ? 'Everything this platform depends on answered.'
                  : data.status === 'down'
                    ? 'A required dependency is down. The platform cannot serve requests.'
                    : 'Something is wrong, but the platform can still serve requests.'}
              </p>
              <p className="mt-1 max-w-3xl text-[12px]/[19px] font-semibold text-slate-600">
                {`Only a required dependency going down makes the platform down — today that is MongoDB and nothing else. An optional dependency being down or degraded makes the platform degraded, because parents can still pay over a school's own rail when the platform's SMS credit runs out. Required dependencies: ${(
                    data.requiredDependencies || ['mongodb']
                  ).join(', ') || 'none reported'}.`}
              </p>
            </div>
            <p className="shrink-0 text-[11px] font-semibold text-slate-500">
              {`Checked ${stamp(data.timestamp)}`}
              {data.totalMs !== undefined ? ` in ${formatCount(data.totalMs)}ms` : ''}
            </p>
          </div>
        </div>
      )}

      {health.error ? (
        <div className="mt-4">
          <EmptyState
            icon={ServerCrash}
            title="System health could not be loaded"
            description={
              health.error.message ||
              'The endpoint always answers 200 with a per-dependency status; a rejection here means the request itself failed, so nothing is known.'
            }
            action={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
              >
                Try again
              </button>
            }
          />
        </div>
      ) : health.loading && dependencies.length === 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <div key={card} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dependencies.map((dependency) => {
            const style = statusStyle(dependency.status);
            return (
              <div key={dependency.name} className={`rounded-2xl border p-5 ${style.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] font-extrabold capitalize text-ink">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                      {dependency.name === 'mongodb' ? 'MongoDB' : dependency.name}
                    </p>
                    {/*
                      `required` printed on every card, not only the required ones. It is
                      the only thing on this screen that explains why one red card and
                      another red card deserve different urgency, and an operator who cannot
                      see it is left guessing.
                    */}
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {dependency.required
                        ? 'Required — if this is down, the platform is down'
                        : 'Optional — if this is down, the platform is degraded, not down'}
                    </p>
                  </div>
                  <Badge tone={style.badge} icon={style.icon}>
                    {style.label}
                  </Badge>
                </div>

                <p className="mt-3 text-[12px]/[18px] font-semibold text-slate-600">
                  {dependency.detail || 'No detail reported.'}
                </p>

                {dependency.latencyMs !== undefined && (
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {`Probe took ${formatCount(dependency.latencyMs)}ms`}
                  </p>
                )}

                {/*
                  Per-dependency extras, shown only when the probe reported them.

                  `networkProbe: false` on Hubtel is the important one and is called out in
                  words: there is no Hubtel client anywhere in this codebase, and Hubtel
                  credentials are per school on `school.payment.*` with `select: false`. So
                  the health payload can report how many schools carry a complete credential
                  set and nothing more — it cannot reach Hubtel. A green "Hubtel OK" drawn
                  from a credential count would be a reachability claim the server never
                  made, and an operator would act on it.
                */}
                {dependency.networkProbe === false && (
                  <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-[11px]/[16px] font-semibold text-slate-600">
                    This is a configuration count, not a probe. There is no platform-level
                    credential and no client to call the provider with, so nothing here says
                    Hubtel is reachable.
                    {dependency.credentialsConfigured !== undefined && (
                      <>
                        {' '}
                        {`${formatCount(dependency.credentialsConfigured)} schools carry a complete credential set.`}
                      </>
                    )}
                  </p>
                )}

                {dependency.balance !== undefined && (
                  <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-[11px]/[16px] font-semibold text-slate-600">
                    {`SMS balance: ${formatCount(dependency.balance)} credits. Parents can still pay — this costs receipts and reminders, not collections.`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Cron ── */}
      <Card padding="p-0" className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-[13px] font-extrabold text-ink">Scheduled jobs</h2>
            <p className="mt-0.5 text-[11px]/[16px] font-semibold text-slate-500">
              What the scheduler knows right now: its expression, its last tick and its next one.
            </p>
          </div>
          <Badge tone="slate" icon={Clock}>
            {formatCount(jobRows.length)} jobs
          </Badge>
        </div>

        {/*
          Stated above the table, and it is a sentence rather than a disabled column.
          `historyAvailable: false` is the server's own word for this
          (`health.service.js:841`): nothing in this codebase persists a cron run, so
          "last run" is a tick timestamp and "how long did it take" would be `now` minus the
          moment the timer fired — before the handler finished. A column of plausible wrong
          numbers is worse than no column, so there is no column.
        */}
        {jobs.data && jobs.data.historyAvailable === false && (
          <p className="flex items-start gap-2 border-b border-slate-100 bg-amber-50/70 px-4 py-2.5 text-[11px]/[17px] font-semibold text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-extrabold">Run history is not persisted on this deployment.</strong>{' '}
              Nothing here records that a job ran, how long it took or whether it succeeded, so
              this table shows only live scheduler state. An empty row below means the job has
              not ticked yet on this instance — not that it has never run.
            </span>
          </p>
        )}

        {jobs.error ? (
          <div className="p-5">
            <EmptyState
              icon={ServerCrash}
              title="Scheduled jobs could not be loaded"
              description={jobs.error.message || 'The request did not complete.'}
            />
          </div>
        ) : jobs.loading && jobRows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : jobRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Clock}
              title="No scheduled jobs are registered"
              description="The scheduler reported no jobs at all, which is different from jobs that have not run."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Scheduled jobs, their schedule and their next tick</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Job
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Schedule
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Last run
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Next run
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobRows.map((job) => {
                  const style = statusStyle(job.status);
                  return (
                    <tr key={job.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <span className="block text-[13px] font-extrabold text-ink">{job.name}</span>
                        <span className="block text-[11px] font-semibold text-slate-400">
                          {job.description}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="font-mono text-[11px] font-bold text-slate-600">
                          {job.expression || '—'}
                        </code>
                        {job.timezone && (
                          <span className="block text-[10px] font-semibold text-slate-400">
                            {job.timezone}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                        {job.lastRunAt ? stamp(job.lastRunAt) : 'Has not ticked yet'}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                        {job.nextRunAt ? stamp(job.nextRunAt) : 'Not scheduled'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={style.badge}>{style.label}</Badge>
                        {job.detail && (
                          <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                            {job.detail}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {jobs.data?.note && (
          <p className="flex items-start gap-2 border-t border-slate-100 px-4 py-3 text-[11px]/[17px] font-medium text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{jobs.data.note}</span>
          </p>
        )}
      </Card>

      {/* ── Errors ── */}
      <Card padding="p-0" className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-[13px] font-extrabold text-ink">Recent errors</h2>
            <p className="mt-0.5 text-[11px]/[16px] font-semibold text-slate-500">
              The last few 5xx responses this instance handled.
            </p>
          </div>
          <Badge tone="slate">{formatCount(errorRows.length)} shown</Badge>
        </div>

        {/*
          The caveat, above the list, in a form that cannot be read after the empty list has
          already been believed.

          This is a bounded in-process ring buffer — `utils/errorBuffer.js`, 500 entries —
          fed from the error pipeline. Nothing is persisted: `middleware/errorHandler.js`
          ends at a `console.error`, and there is no error collection in `src/models/`. So
          this panel holds what happened on *this* process since it started and nothing from
          a restart, a deploy, or a sibling behind the load balancer.

          The consequence is the sentence that matters: "no recent errors" is a claim about
          one process, not about the platform. Presented without that, an empty panel during
          an incident is the kind of blank that hides one.
        */}
        <p className="flex items-start gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px]/[17px] font-semibold text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            <strong className="font-extrabold">This is one process&rsquo;s in-memory buffer,
            not an error log.</strong> It is lost on restart, is empty on a sibling instance
            behind the load balancer, and holds nothing from before this process started.
            An empty list below means no 5xx happened here recently — not that the platform
            had none. Nothing in this codebase persists errors.
          </span>
        </p>

        {errors.error ? (
          <div className="p-5">
            <EmptyState
              icon={ServerCrash}
              title="Recent errors could not be loaded"
              description={errors.error.message || 'The request did not complete.'}
            />
          </div>
        ) : errors.loading && errorRows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : errorRows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CheckCircle2}
              title="No errors recorded on this instance"
              description="This process has handled no 5xx since it started. It says nothing about any other instance, and nothing about the period before this one started."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {errorRows.map((entry, index) => (
              <li key={entry.id || `${entry.at}-${index}`} className="px-4 py-3.5 hover:bg-slate-50/50">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <Badge tone="red">{entry.status || entry.statusCode || 'Error'}</Badge>
                  <span className="text-[13px] font-extrabold text-ink">
                    {entry.message || entry.error || 'No message recorded'}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{stamp(entry.at)}</span>
                </div>
                {entry.path && (
                  <p className="mt-1 font-mono text-[11px] font-semibold text-slate-500">
                    {`${entry.method || 'REQ'} ${entry.path}`}
                  </p>
                )}
                {entry.ip && (
                  <p className="mt-0.5 font-mono text-[10px] font-semibold text-slate-400">
                    {entry.ip}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Runtime ── */}
      {data.runtime && (
        <Card padding="p-5" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-extrabold text-ink">This instance</h2>
            <Badge tone="slate" icon={Cpu}>
              pid {formatCount(data.uptime?.pid)}
            </Badge>
          </div>
          {/*
            Process uptime, deliberately labelled as such. On a multi-instance deploy each
            instance reports its own, and the spread between them is the signal — an
            instance restarted by a crash loop reports a young uptime while its siblings
            report an old one. Calling this "platform uptime" would be a claim about
            something the number does not describe.
          */}
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Process uptime', value: `${formatCount(Math.floor((data.uptime?.seconds || 0) / 3600))}h ${formatCount(Math.floor(((data.uptime?.seconds || 0) % 3600) / 60))}m` },
              { label: 'Memory (RSS)', value: `${formatCount(data.memory?.rssMb)} MB` },
              { label: 'Heap used', value: `${formatCount(data.memory?.heapUsedMb)} MB` },
              { label: 'Runtime', value: `${data.runtime.node} · ${data.runtime.environment}` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {item.label}
                </dt>
                <dd className="mt-1 text-[13px] font-extrabold text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
          {data.runtime.commitSource && (
            <p className="mt-2 text-[11px] font-semibold text-slate-400">
              Build commit: {data.runtime.commit || data.runtime.commitSource}
            </p>
          )}
        </Card>
      )}

      <MaintenanceModeDialog
        open={maintenanceOpen}
        currentMode={currentMode}
        currentMessage={currentMessage}
        onClose={() => setMaintenanceOpen(false)}
        onConfirm={applyMaintenance}
      />
    </>
  );
};

export default SystemHealth;
