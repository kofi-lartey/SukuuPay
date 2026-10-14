/**
 * The greeting on the teacher's dashboard, and when it changes.
 *
 * ## Why Accra and not the browser's clock
 *
 * Ghana is UTC+0 with no daylight saving, so one timezone answers for every
 * teacher in the school. The browser's does not: a laptop set to US Eastern
 * reads 03:00 for a 12:30 Accra lunchtime, and the dashboard used to greet that
 * teacher with "Good morning" while they were marking the afternoon's papers. The
 * words were a property of the device, not of the school day.
 *
 * The server already computes this (`greetingForHour` in
 * `Backend/src/services/teacher/dashboard.service.js`), and its answer is the one
 * rendered. This module is the same rule on the client, for the two windows where
 * the server's answer is not available: the first paint before
 * `GET /teacher/dashboard` resolves, and the moment the clock crosses a boundary
 * while the tab has been open since this morning.
 *
 * ## Why boundaries rather than an interval
 *
 * A `setInterval` of a second would re-render the whole dashboard sixty times a
 * minute to change one word. `msUntilNextBoundary` returns the exact distance to
 * the next change, so one timer fires once per boundary and nothing renders in
 * between. A dashboard open from 07:00 to 19:00 schedules two wake-ups.
 */
export const GHANA_TIME_ZONE = "Africa/Accra";

/** The hours at which the greeting changes, as a sorted list. */
export const GREETING_BOUNDARIES = [0, 12, 17];

/**
 * `0-23` → "Good morning" / "Good afternoon" / "Good evening".
 *
 * The same table the server uses, deliberately: the two are asserted against each
 * other in `greeting.test.js`, so a change to one without the other fails a test
 * rather than showing a teacher two different greetings on two surfaces.
 */
export const greetingForHour = (hour) => {
  const h = Number(hour);
  if (!Number.isFinite(h)) return "Good morning";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

/**
 * The current hour in Ghana, from any clock.
 *
 * `Intl` with an explicit zone rather than `getHours()`, for the reason above. The
 * hour cycle is pinned to `h23` so a locale that prefers 12-hour formatting
 * (en-US) cannot return "13" for 1pm or "01" for 1am.
 */
export const accraHour = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GHANA_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return Number.isFinite(hour) ? hour : 0;
};

/**
 * The greeting as of right now, in Ghana.
 *
 * @param {Date} [date] injectable for tests; defaults to now
 * @returns {string} "Good morning" | "Good afternoon" | "Good evening"
 */
export const greetingNow = (date = new Date()) => greetingForHour(accraHour(date));

/**
 * Milliseconds from `date` to the next greeting boundary, measured in Accra.
 *
 * Computed from Accra's wall clock rather than from the browser's UTC offset, so
 * the timer is correct on a handset set to the wrong zone — which is exactly the
 * device this matters on.
 *
 * @param {Date} [date] injectable for tests
 * @returns {number} milliseconds until the greeting changes, always > 0
 */
export const msUntilNextBoundary = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GHANA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) map[part.type] = part.value;

  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  // The next boundary strictly after this hour; past the last one of the day the
  // next change is midnight, which belongs to tomorrow but is 24 hours from this
  // hour anyway.
  const nextHour = GREETING_BOUNDARIES.find((boundary) => boundary > hour) ?? 24;

  const msFromMidnight = ((nextHour - hour) * 3600 - minute * 60 - second) * 1000;
  // Never zero: a timer at 0 would still be a new render, and 1s is the cheapest
  // honest answer for "already past the boundary".
  return msFromMidnight > 0 ? msFromMidnight : 1000;
};

export default { greetingForHour, greetingNow, msUntilNextBoundary, accraHour };
