import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The Overview cards against the payloads the server actually sends.
 *
 * `HealthCard` called `.map` on `data.dependencies`, which is an **object**
 * (`{ mongodb, cloudinary, payments, sms, cron }`) — so the platform Overview threw
 * `dependencies.map is not a function` the moment `/admin/health` answered, taking the
 * whole page with it. `EconomicsRow` and `HealthCard` also read five key names that
 * do not exist (`monthlyRecurringRevenue`, `annualRecurringRevenue`, `churnRate`,
 * `newSchools`, `uptimeSeconds`), which made those regions silently render nothing.
 *
 * Every one of those is invisible to `vite build`, because a build never executes a
 * component body — and invisible to a server-render harness, because the cards render
 * a loading skeleton and the crash happens in the `.then` after the response lands.
 * A green build and a green render check agreed that everything was fine.
 *
 * So these assertions are about the **key names**, checked against the payload
 * contracts documented in `Backend/src/services/admin/{analytics,health}.service.js`.
 * They cannot run the components (no DOM, no test runner); they can assert the thing
 * that actually broke, which is that the client and the server named the same field.
 */

/*
 * Five levels up from `src/pages/admin/overview/` lands on the repository root.
 * `import.meta.url` is relative to this file, so a path that is off by one resolves to
 * a real-looking directory that does not exist — and a test that throws ENOENT is
 * telling you nothing about the thing it exists to check. Asserted below rather than
 * assumed, for the same reason.
 */
const REPO_ROOT = new URL('../../../../../', import.meta.url);

const read = (path) => readFileSync(new URL(path, REPO_ROOT), 'utf8');

const analyticsService = read('Backend/src/services/admin/analytics.service.js');
const healthService = read('Backend/src/services/admin/health.service.js');
const healthCard = read('frontend/src/pages/admin/overview/HealthCard.jsx');
const economicsRow = read('frontend/src/pages/admin/overview/EconomicsRow.jsx');

if (!analyticsService.includes('getPlatformOverview')) {
  throw new Error('REPO_ROOT is wrong — analytics.service.js did not resolve to the real file');
}

describe('the Overview cards read keys the server actually sends', () => {
  /**
   * `dependencies` is an object literal, not an array. This is the assertion that
   * would have caught the crash, and it is a source assertion rather than a runtime
   * one on purpose: the crash was "array method called on an object", and the cheapest
   * reliable guard against that is checking the shape at both ends.
   */
  it('does not call an array method on the health dependencies object', () => {
    // The conversion has to exist somewhere in the dependency assignment. Asserted as
    // "the file converts with Object.values" rather than against one exact expression,
    // because a ternary, a helper call or a reformatted line are all the same fix and
    // pinning the syntax would make this test fail on a correct edit.
    assert.ok(
      /Object\.values\(/.test(healthCard),
      'HealthCard must convert data.dependencies with Object.values before iterating'
    );
    assert.ok(
      !/data\.dependencies\s*\|\|\s*data\.checks\s*\|\|\s*\[\]/.test(healthCard),
      'data.dependencies is an object keyed by name; the `|| []` form yields an object and .map throws'
    );
    assert.ok(
      /dependencies\s*\.\s*map\s*\(/.test(healthCard),
      'the card still iterates `dependencies`, so the conversion above is load-bearing'
    );

    // And the server side, so the two cannot drift apart silently.
    assert.ok(
      /const\s+dependencies\s*=\s*{\s*mongodb:/.test(healthService),
      'the server returns dependencies as an object keyed by dependency name'
    );
    assert.ok(
      /summary:\s*all\.map\(/.test(healthService),
      'the server also returns summary as an array — the preferred shape for a UI'
    );
  });

  it('reads the economics figures from the nested paths the server sends', () => {
    // What the server actually returns.
    assert.ok(/\bmrr,\s*$/.test(analyticsService) || /\bmrr,/.test(analyticsService), 'revenue.mrr');
    assert.ok(/arr:\s*mrr \* 12/.test(analyticsService), 'revenue.arr');
    assert.ok(/churnRatePercent:/.test(analyticsService), 'churn.churnRatePercent');
    assert.ok(/newThisMonth:/.test(analyticsService), 'schools.newThisMonth');

    // And that the client reads those, tolerating the flat spelling.
    for (const read of ['data.revenue?.mrr', 'data.revenue?.arr', 'data.churn?.churnRatePercent', 'data.schools?.newThisMonth']) {
      assert.ok(
        economicsRow.includes(read),
        `EconomicsRow must read ${read} — the server nests it there`
      );
    }
  });

  it('reads uptime from the nested path the server sends', () => {
    assert.ok(/uptime:\s*{\s*seconds:/.test(healthService), 'the server returns uptime.seconds');
    assert.ok(
      healthCard.includes('data.uptime?.seconds'),
      'HealthCard must read uptime.seconds; uptimeSeconds does not exist'
    );
  });

  /**
   * The general rule these three bugs broke: every `data.x.y` the Overview cards read
   * must correspond to a real field in the service that produces it.
   *
   * Enumerated rather than inferred, so adding a card that reads an invented key is a
   * failed assertion instead of a page that throws once the response arrives.
   */
  it('has no invented top-level keys left in the cards', () => {
    // Flat names that were invented on the client and never existed.
    const invented = ['monthlyRecurringRevenue', 'annualRecurringRevenue', 'uptimeSeconds'];

    for (const card of [healthCard, economicsRow]) {
      for (const key of invented) {
        // Allowed only as a *fallback* after the real path (`?? data.inventedName`),
        // which is the documented tolerance for a future flattening.
        const occurrences = card.split(key).length - 1;
        if (occurrences === 0) continue;

        assert.ok(
          card.includes(`?? data.${key}`),
          `"${key}" appears ${occurrences}× without the real nested path being read first — it does not exist on the server`
        );
      }
    }
  });
});