import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  GREETING_BOUNDARIES,
  GHANA_TIME_ZONE,
  accraHour,
  greetingForHour,
  greetingNow,
  msUntilNextBoundary,
} from './greeting.js';

/**
 * The greeting, and when it changes.
 *
 * Three things are worth a test here, and the third is the one that matters:
 *
 *   1. the hour table (the words, and the boundaries),
 *   2. the timezone — Ghana, not the browser's — which is the bug this module
 *      was written for,
 *   3. the boundary timer, which is what makes the greeting *update* rather than
 *      being frozen at render time.
 */
describe('greetingForHour', () => {
  it('maps the school day onto three greetings', () => {
    assert.equal(greetingForHour(0), 'Good morning');
    assert.equal(greetingForHour(7), 'Good morning');
    assert.equal(greetingForHour(11), 'Good morning');
    assert.equal(greetingForHour(12), 'Good afternoon');
    assert.equal(greetingForHour(16), 'Good afternoon');
    assert.equal(greetingForHour(17), 'Good evening');
    assert.equal(greetingForHour(23), 'Good evening');
  });

  it('treats the boundaries as inclusive-to-the-later-greeting', () => {
    // 11:59 is morning, 12:00 is afternoon. An off-by-one here shows a teacher
    // the wrong words for the whole of their lunch hour.
    assert.equal(greetingForHour(11), 'Good morning');
    assert.equal(greetingForHour(12), 'Good afternoon');
    assert.equal(greetingForHour(16), 'Good afternoon');
    assert.equal(greetingForHour(17), 'Good evening');
  });

  it('degrades to morning rather than throwing on bad input', () => {
    for (const bad of [undefined, null, NaN, 'noon', {}, []]) {
      assert.equal(greetingForHour(bad), 'Good morning');
    }
  });

  it('publishes the boundaries the timer uses', () => {
    // The timer and the table are separate code paths; if they disagree the
    // greeting updates at the wrong moment.
    assert.deepEqual(GREETING_BOUNDARIES, [0, 12, 17]);
  });
});

describe('the timezone is Ghana, not the browser', () => {
  it('reads the same hour for any wall clock', () => {
    // 12:30 UTC *is* 12:30 in Accra (UTC+0, no DST).
    const noon = new Date('2026-10-14T12:30:00Z');
    assert.equal(accraHour(noon), 12);
    assert.equal(greetingNow(noon), 'Good afternoon');
  });

  it('does not follow a browser set to another zone', () => {
    // The bug this module exists for: 21:00 in Accra is 17:00 in New York
    // (UTC-4), so a US laptop would have greated "Good afternoon" — and the
    // server, reading Africa/Accra, would have said "Good evening".
    const lateEvening = new Date('2026-10-14T21:00:00Z');
    assert.equal(accraHour(lateEvening), 21);
    assert.equal(greetingNow(lateEvening), 'Good evening');
  });

  it('is unaffected by the process timezone', () => {
    // Set deliberately, to prove the assertion is not passing because Node
    // happens to run in UTC.
    const previous = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const morning = new Date('2026-10-14T08:00:00Z');
      assert.equal(accraHour(morning), 8);
      assert.equal(greetingNow(morning), 'Good morning');
    } finally {
      process.env.TZ = previous;
    }
  });

  it('names the zone it reads', () => {
    assert.equal(GHANA_TIME_ZONE, 'Africa/Accra');
  });
});

describe('msUntilNextBoundary', () => {
  it('measures to the next boundary, not the next tick', () => {
    // 09:00:00 → noon is three hours.
    const morning = new Date('2026-10-14T09:00:00Z');
    assert.equal(msUntilNextBoundary(morning), 3 * 3600 * 1000);
  });

  it('subtracts the minutes and seconds already elapsed', () => {
    const almostNoon = new Date('2026-10-14T10:30:30Z');
    // 10:30:30 → 12:00:00 is 1h29m30s.
    assert.equal(msUntilNextBoundary(almostNoon), (3600 + 29 * 60 + 30) * 1000);
  });

  it('measures to 17:00 from the afternoon', () => {
    const afternoon = new Date('2026-10-14T14:00:00Z');
    assert.equal(msUntilNextBoundary(afternoon), 3 * 3600 * 1000);
  });

  it('measures to midnight from the evening', () => {
    // Past the last boundary of the day, the next change is 00:00.
    const night = new Date('2026-10-14T22:00:00Z');
    assert.equal(msUntilNextBoundary(night), 2 * 3600 * 1000);
  });

  it('never returns zero, which would schedule a render for now', () => {
    // A boundary exactly on the hour: 12:00:00 has already passed, so the next
    // is 17:00 — but a rounding bug returning 0 would fire immediately and loop.
    const exactlyNoon = new Date('2026-10-14T12:00:00Z');
    assert.ok(msUntilNextBoundary(exactlyNoon) > 0, 'a boundary must never schedule zero');
    assert.equal(msUntilNextBoundary(exactlyNoon), 5 * 3600 * 1000);
  });

  it('agrees with the words it is meant to change', () => {
    // The property that makes the whole thing work: at any instant, waiting the
    // computed distance produces a *different* greeting.
    for (const raw of [
      '2026-10-14T06:00:00Z',
      '2026-10-14T11:59:59Z',
      '2026-10-14T12:00:00Z',
      '2026-10-14T16:59:59Z',
      '2026-10-14T17:00:00Z',
      '2026-10-14T23:59:59Z',
    ]) {
      const start = new Date(raw);
      const before = greetingNow(start);
      const later = new Date(start.getTime() + msUntilNextBoundary(start));
      const after = greetingNow(later);
      assert.notEqual(
        after,
        before,
        `waiting from ${raw} still reads "${before}" — the timer and the table disagree`
      );
    }
  });
});

// ── The client and the server must agree ────────────────────────────────────
describe('the client greeting agrees with the server', () => {
  const readServer = async () => {
    const { readFile } = await import('node:fs/promises');
    return readFile(
      new URL('../../../Backend/src/services/teacher/dashboard.service.js', import.meta.url)
        .pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      'utf8'
    );
  };

  it('uses the same boundaries as greetingForHour on the server', async () => {
    const source = await readServer();
    const body = source.slice(source.indexOf('export const greetingForHour'));
    const block = body.slice(0, body.indexOf('\n};'));

    // Every boundary the client publishes must appear in the server's table, and
    // the server's comparisons must be the same two.
    assert.ok(/h < 12/.test(block), 'the server lost its noon boundary');
    assert.ok(/h < 17/.test(block), 'the server lost its 17:00 boundary');
    for (const boundary of GREETING_BOUNDARIES.filter((b) => b > 0)) {
      assert.ok(new RegExp(`h < ${boundary}`).test(block), `the server lacks the ${boundary} boundary`);
    }
  });

  it('reads the hour in Africa/Accra on the server too', async () => {
    const source = await readServer();
    assert.ok(source.includes('Africa/Accra'), 'the server stopped reading Ghana time');
    assert.ok(
      source.includes('greetingForHour'),
      'the server no longer derives the greeting from the shared rule'
    );
  });
});
