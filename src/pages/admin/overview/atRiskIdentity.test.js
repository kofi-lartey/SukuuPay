import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The analytics row identity, asserted against the payloads the server actually sends.
 *
 * ## The bug
 *
 * `GET /admin/analytics/at-risk-schools` projects each row as
 * `{ schoolId: school._id, name, … }` — `schoolId`, deliberately, because a row is an
 * analytics result and not a School document. `AtRiskCard` keyed its `<li>` on
 * `school._id`, which is `undefined` on every row.
 *
 * That produced the React warning *"Each child in a list should have a unique key prop"*
 * — and the warning was the smaller half. The same `school._id` built each row's link,
 * so **every row in "Needs attention" pointed at `/admin/schools/undefined`** on the panel
 * whose entire job is to let an operator open a school and chase it. The list rendered,
 * the badge counted correctly, and every link was dead.
 *
 * A key warning that is really a dead-link bug is worth a test on its own: nothing else
 * in the build or the render checks sees either, because `undefined` is a legal React key
 * (it warns) and a legal string in a path (it navigates).
 *
 * `normaliseSchoolList` is where the fix lives, and it cannot be imported here — it is
 * module-private and the module reaches `import.meta.env`. So these assert the contract
 * from both ends: that the normaliser fills `_id` in, and that the card reads the key the
 * server actually provides.
 */

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const adminService = read('../../../services/admin.js');
const atRiskCard = read('./AtRiskCard.jsx');
const analyticsService = read('../../../../../Backend/src/services/admin/analytics.service.js');

describe('analytics school rows carry a usable identity', () => {
  it('the server sends schoolId, not _id', () => {
    // The premise. If the service ever starts projecting `_id`, the normalisation below
    // becomes harmless and this assertion is the thing to revisit.
    assert.match(
      analyticsService,
      /rows\.push\(\{[\s\S]*?schoolId: school\._id/,
      'the at-risk rows are expected to name the school `schoolId`'
    );
    assert.doesNotMatch(
      analyticsService.slice(analyticsService.indexOf('rows.push({'), analyticsService.indexOf('rows.push({') + 900),
      /_id: school\._id/,
      'the at-risk rows are not expected to project `_id`'
    );
  });

  it('normaliseSchoolList fills _id in from schoolId', () => {
    assert.match(
      adminService,
      /_id: row\.schoolId/,
      'normaliseSchoolList must give every analytics row a `_id`'
    );
  });

  it('the normaliser keeps a row that already has an _id, and never drops a field', () => {
    // `schoolId` must survive alongside `_id`. A consumer reading either spelling is
    // correct, and normalising the identity must not become normalising the payload away.
    assert.match(adminService, /if \(row\._id\) return row;/);
    assert.match(adminService, /if \(!row\.schoolId\) return row;/);
    assert.match(adminService, /return \{ \.\.\.row, _id: row\.schoolId \};/);
  });

  it('AtRiskCard keys and links on the same field', () => {
    // The actual bug. Keying on one field and linking on another is how a list renders
    // perfectly and navigates nowhere.
    // The interpolations are template literals, so the capture runs up to a backtick —
    // `[^}]+` would stop at the brace inside `${school._id}` and never match.
    const keyOn = atRiskCard.match(/<li key=\{([^}]+)\}/);
    const linkTo = atRiskCard.match(/to=\{`\$\{ROUTES\.ADMIN_SCHOOLS\}\/([^`]+)`\}/);

    assert.ok(keyOn, 'the list must key its rows');
    assert.ok(linkTo, 'the list must link each row to its school');

    // The link's capture is the whole interpolation (`${school._id}`); unwrap it so the
    // two sides are compared as field paths rather than as syntax.
    const linkedField = linkTo[1].replace(/^\$\{/, '').replace(/\}$/, '');

    assert.equal(
      keyOn[1],
      linkedField,
      'the key and the link must read the same field, or the warning is masking dead links'
    );
    assert.notEqual(
      keyOn[1].split('.')[1],
      undefined,
      'the row field must exist — an analytics row names its school `schoolId`, not `_id`'
    );
  });

  it('AtRiskCard does not reach for _id on a raw analytics row', () => {
    // Belt and braces on the component side: if a caller ever passes a row that skipped
    // the normaliser, this must not silently produce a dead link.
    assert.doesNotMatch(
      atRiskCard,
      /state\?\.data\?\.\w+\?\.?\[?\d*\]?\.\w+/,
      'the card must read the normalised rows, not reach into the raw payload'
    );
  });
});