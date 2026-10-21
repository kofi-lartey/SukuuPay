/**
 * What the attendance screens open on.
 *
 * The parent portal's attendance page and the teacher's register both answer the
 * same question on load — *which day of which term am I looking at?* — and both
 * used to answer it with a constant. The parent page opened on "Term 1" and the
 * teacher page opened on the browser's own calendar day.
 *
 * Both constants are wrong in the same way: they are right by coincidence, for
 * the schools that happen to be in the first term of the year, and wrong for
 * everybody else. A school in Term 2 whose teachers take a register in January
 * gets a parent portal showing September–December, and every mark the teachers
 * made falls outside the window the page asked for. The page loads, the calendar
 * renders, the rate is 0%, and nothing in the interface says the marks are
 * missing — they are simply not in the term being shown.
 *
 * So the defaults come from the school instead:
 *
 *  - **the term** is `school.academic.currentTerm`, the same value the school's
 *    Settings screen writes and the same one the server resolves every read
 *    against (`resolveTerm` on the backend). When the school has not set one,
 *    the platform's documented default of Term 1 is used, which is also what the
 *    server falls back to — so the client and the server never disagree.
 *
 *  - **the date** is the *school's* day, not the browser's. Ghana is on UTC+0
 *    permanently, so the school's day is the UTC day — the same day the server
 *    stores the register against and the same day it rings in the parent's
 *    calendar. A handset set to another timezone must not open the register on
 *    a day the school is not in.
 *
 *  - **the month** is the month the current day falls in, because that is the
 *    month a parent opens the page to look at. A term spans two or three
 *    calendar months and the page lists them newest-first, so "the first one" is
 *    the *future* end of the term — an empty month of days that have not
 *    happened yet.
 */

import { ACADEMIC_TERMS } from './constants.js';

/** The term a school is in when it has not said. Matches the server's fallback. */
export const DEFAULT_TERM = 'Term 1';

/**
 * The school's active term.
 *
 * `school.academic.currentTerm` is the school's own statement of which term it
 * is in, written by the Settings screen. Anything that is not one of the three
 * terms the platform knows — an empty string on a school that has never opened
 * that screen, a stale value from a school that renumbered — falls back to the
 * same default the server uses, so the two never resolve differently.
 *
 * @param {object|null} school the portal payload's `school`
 * @returns {string} one of `Term 1`, `Term 2`, `Term 3`
 */
export const defaultTermForSchool = (school) => {
  const term = String(school?.academic?.currentTerm || '').trim();
  return ACADEMIC_TERMS.includes(term) ? term : DEFAULT_TERM;
};

/**
 * The month's identity — `2026-10`.
 *
 * Read off the month's key when the server sent one, and off its first day when
 * it did not, so the helper works against a payload that predates the key
 * without special-casing the caller.
 */
export const monthKeyOf = (month) => {
  const key = String(month?.key || '').trim();
  if (key) return key;
  const firstDay = String(month?.days?.[0]?.date || '');
  return /^\d{4}-\d{2}/.test(firstDay) ? firstDay.slice(0, 7) : '';
};

/**
 * The month the current day falls in — `2026-10`, or `null` when there is no
 * current day to place.
 */
export const currentMonthKey = (today) => {
  const iso = String(today || '').trim();
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null;
};

/**
 * Which month is open.
 *
 * `expandedMonth` is the parent's own choice and is `null` until they make one:
 *
 *  - `null` — follow the current month. This is the state the page opens in.
 *  - `''` — nothing is open; the parent collapsed the month.
 *  - `'2026-10'` — that month is open.
 *
 * A month the parent opened by hand survives a term change only while it is
 * still in the term: switching from Term 2 to Term 1 while October is open
 * falls back to the current month rather than leaving the page with nothing
 * expanded and no sign of why.
 *
 * @param {string|null} expandedMonth the parent's choice
 * @param {Array} months the term's months, newest first
 * @param {string|null} today the school's current day
 * @returns {string} a month key, or `''` for nothing open
 */
export const resolveExpandedMonth = (expandedMonth, months = [], today = null) => {
  const list = Array.isArray(months) ? months : [];
  const keys = list.map(monthKeyOf).filter(Boolean);

  if (expandedMonth !== null && expandedMonth !== undefined) {
    if (expandedMonth === '' || keys.includes(expandedMonth)) return expandedMonth;
  }

  const key = currentMonthKey(today);
  if (key && keys.includes(key)) return key;

  // Today is outside this term — a term being read during the break, or a
  // school's current term that does not cover today. The newest month is the
  // one most likely to hold the marks, and it is what the page used to open on.
  return keys[0] || '';
};

/**
 * The state to store when a month header is tapped.
 *
 * Tapping the open month closes it; tapping any other month opens that one.
 */
export const toggleExpandedMonth = (expandedMonth, key, months = [], today = null) => {
  const active = resolveExpandedMonth(expandedMonth, months, today);
  return active === key ? '' : key;
};
