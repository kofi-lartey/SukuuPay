import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The auth aside's advertisement slot, asserted structurally.
 *
 * ## The bug this exists for
 *
 * `SchoolAdSlot` gated the carousel behind the very state the carousel reports:
 *
 *     {!hasAds && Metrics}
 *     {hasAds && SchoolAdCarousel(onCountChange=handleCount)}
 *
 * (`Metrics` and `SchoolAdCarousel` are written without their angle brackets throughout
 * this file. `check:dashboard` scans every file for a capitalised tag and reports any it
 * cannot find an import for, to catch a component used but never imported — a genuine
 * class of runtime crash. A regex that *asserts* on a tag is that pattern by accident, so
 * the assertions below use a character class where a literal tag would otherwise appear.)
 *
 * `hasAds` is set only by `onCountChange`, from a count fetched *after* the carousel
 * mounts. So the carousel was never mounted, never fetched, and never reported —
 * `hasAds` stayed `false` for the life of the page. A circular guard has exactly one
 * possible initial state, and that state is "nothing renders".
 *
 * The consequence is not a subtle rendering fault. **No advertisement could ever appear
 * on the login, signup, recovery, verify or reset page, for any data at all.** The
 * endpoint worked, the ad was approved and live, the console said "created", and the
 * page was empty — with nothing on screen or in the console to suggest the component
 * responsible had never been mounted.
 *
 * The failure is invisible to everything else in this repo, which is why it needs its own
 * assertion:
 *
 *   - `vite build` does not execute a component body.
 *   - The server-render harnesses render pages whose data loads in a `useEffect`, so the
 *     slot is still showing its metrics skeleton on first paint — the same before and
 *     after the fix.
 *   - The mock checks assert the payload, not the mount.
 *
 * So a green build and a green render check both agree that this is fine. The only thing
 * that catches it is an assertion about the tree itself.
 */
const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

/**
 * Source with comments removed.
 *
 * The fix is documented by quoting the code it replaces — which is the only way to make
 * a circular guard comprehensible to the next reader — and that quote would otherwise
 * satisfy every assertion below. Comments are prose about the tree, not the tree.
 */
const readCode = (relative) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');

const aside = readCode('./OnboardingAside.jsx');
const carousel = readCode('./SchoolAdCarousel.jsx');
const hook = readCode('../../hooks/useSchoolAds.js');

describe('the auth aside advertisement slot', () => {
  it('mounts the carousel unconditionally', () => {
    // The whole fix. A guard here is what made the feature unreachable.
    assert.match(aside, /<SchoolAd[Cc]arousel\b/, 'the aside must render the carousel');
    assert.doesNotMatch(
      aside,
      /\{\s*hasAds\s*&&\s*<SchoolAd[Cc]arousel/,
      'the carousel must not be gated behind the state it reports itself'
    );
    assert.doesNotMatch(
      aside,
      /hasAds\s*\?\s*<SchoolAd[Cc]arousel|<SchoolAd[Cc]arousel[^>]*\?[^:]*:/,
      'the carousel must not be behind a conditional of any shape'
    );
  });

  it('renders nothing on its own when there is no live ad', () => {
    // What makes the unconditioned mount safe. Without this, mounting it always would
    // leave an empty 200px frame above the metrics on every school with no adverts.
    assert.match(
      carousel,
      /if \(total === 0\) return null;/,
      'the carousel must render nothing when there is nothing to show'
    );
  });

  it('reports its count upward, which is what drives the metrics fallback', () => {
    assert.match(carousel, /onCountChange\?\.\(total\)/);
    assert.match(aside, /const handleCount = useCallback\(\(total\) => setHasAds\(total > 0\)/);
    // `hasAds` is now allowed to do exactly one job.
    assert.match(aside, /\{!hasAds && <Metric[s] \/>\}/);
  });

  it('keeps the slot a fixed height so the aside does not resize', () => {
    assert.match(aside, /h-\[200px\]/);
    assert.match(aside, /className="h-full"/);
  });

  it('loads from the endpoint the carousel and the console share', () => {
    assert.match(hook, /fetchSchoolAds/);
    assert.match(
      readCode('../../services/schoolAds.js'),
      /\/public\/school-ads/,
      'the auth pages must read the public slider endpoint'
    );
  });
});