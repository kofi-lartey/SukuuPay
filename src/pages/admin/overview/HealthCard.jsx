import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, CircleAlert, Clock, Wallet } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { ROUTES } from '../../../utils/constants';

/**
 * A status pill for one dependency.
 *
 * **Three states, and `degraded` is not a softer `down`.** Only a *required*
 * dependency going down makes the platform `down`; a platform out of SMS credit is
 * `degraded`, because parents can still pay and the outage would be self-inflicted
 * by the operator treating it as one. Rendered amber rather than a paler red for
 * that reason — an operator who sees red here learns to ignore red here, and then
 * ignores it on the day the database is actually gone.
 */
const STATUS = {
  ok: { tone: 'green', Icon: CheckCircle2, label: 'OK' },
  degraded: { tone: 'amber', Icon: CircleAlert, label: 'Degraded' },
  down: { tone: 'red', Icon: CircleAlert, label: 'Down' },
};

/**
 * The platform's vital signs, in one panel.
 *
 * Deliberately a summary with a link to the full Health screen rather than a second
 * health screen. The Overview's job is "is anything wrong enough that I should stop
 * what I am doing", and one line per dependency answers that; the dependency
 * screen answers the different question "why", and duplicating its detail here would
 * give two places for it to be stale.
 *
 * Each probe is a separate field on the response, so one unavailable dependency
 * cannot blank the others — the server builds them independently and this renders
 * each independently. A panel that shows one red row is more useful than a panel
 * that shows an error page.
 */
const HealthCard = ({ state }) => {
  const data = state?.data || {};

  /*
   * `dependencies` is an **object keyed by name** (`{ mongodb, cloudinary, payments,
   * sms, cron }`), not an array — see `services/admin/health.service.js:755`. Calling
   * `.map` on it throws, and it threw on the Overview of the whole platform console
   * the moment `/admin/health` answered.
   *
   * That is why it looked intermittent: the card renders a loading skeleton first, so
   * the page was fine until the response arrived, and then it went. The build stayed
   * green throughout, because `vite build` never executes a component body.
   *
   * `summary` is the array the server already derives from that object, so it is
   * preferred: same data, shaped once server-side, and this card never has to know the
   * dependency names. `Object.values` is the fallback so a response without `summary`
   * still renders rather than throwing.
   */
  const dependencies = Array.isArray(data.summary)
    ? data.summary
    : Object.values(data.dependencies || data.checks || {});

  const overall = STATUS[data.status] || STATUS.ok;

  /*
   * The server nests it as `uptime.seconds`. The flat `uptimeSeconds` this originally
   * read does not exist, so the uptime line never rendered — a small wrongness next to
   * the crash above, and the same cause: key names invented on the client and never
   * checked against the response. Both spellings accepted.
   */
  const uptimeSeconds = Number(data.uptime?.seconds ?? data.uptimeSeconds) || 0;

  /*
   * Formatted in JS rather than as `{hours}h {minutes}m` in the markup.
   *
   * JSX collapses those to `2 h 0 m` once the elements are separated by whitespace,
   * and "Up 2 h 0 m" reads like a stray variable rather than a duration. Built as one
   * string so the units stay attached to their numbers — and so a zero-hours case
   * reads "42m" instead of "0h 42m", which is what an uptime under an hour actually is.
   */
  const uptimeLabel = uptimeSeconds
    ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`.replace(
        /^0h\s*/,
        ''
      )
    : '';

  return (
    <Card padding="p-5" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Platform health</h2>
          <p className="mt-1 text-[12px] font-medium leading-snug text-slate-500">
            Databases, gateways and scheduled jobs.
          </p>
        </div>
        <Badge tone={overall.tone} icon={overall.Icon}>
          {overall.label}
        </Badge>
      </div>

      <div className="mt-4 flex-1">
        {state?.loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-9 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : state?.error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-bold leading-snug text-red-700">
            {state.error.message || 'Health could not be checked.'}
          </p>
        ) : dependencies.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold leading-snug text-slate-500">
            No dependency checks were reported by this deployment.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {dependencies.map((dependency) => {
              const status = STATUS[dependency.status] || STATUS.ok;
              return (
                <li
                  key={dependency.name}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <status.Icon
                      className={`h-4 w-4 shrink-0 ${
                        dependency.status === 'ok'
                          ? 'text-emerald-500'
                          : dependency.status === 'degraded'
                            ? 'text-amber-500'
                            : 'text-red-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[13px] font-bold text-slate-700">
                      {dependency.label || dependency.name}
                    </span>
                  </span>
                  {status.tone === 'green' ? (
                    <span className="shrink-0 text-[11px] font-extrabold text-slate-400">OK</span>
                  ) : (
                    <Badge tone={status.tone}>{status.label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
        Uptime only when the server reported it. A "—" is honest; a fabricated
        "99.9%" next to a database that is down is the kind of small lie that
        teaches an operator not to read this panel.
      */}
      {uptimeLabel ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Up {uptimeLabel}
        </p>
      ) : null}

      <Link
        to={ROUTES.ADMIN_HEALTH}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Full health report
      </Link>
    </Card>
  );
};

export default HealthCard;