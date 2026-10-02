import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { impersonationScope, isSchoolPage } from './impersonationScope.js';

const SCHOOL = '0123456789abcdef01234567';
const OTHER = '0123456789abcdef01234568';
const THIRD = '0123456789abcdef01234569';

/**
 * Run with `npm test` from `frontend/`, on `node --test` — the same runner the
 * backend uses, and deliberately not a new one.
 *
 * These cover `src/utils/impersonationScope.js`, which is plain ESM with no React in
 * it precisely so it can be tested here. It was previously a function inside
 * `components/admin/ImpersonationBanner.jsx`, where testing it meant rendering the
 * component and the frontend had no runner to do that with.
 *
 * The classifier is worth this: it is the only thing that tells an operator whether
 * the records on screen are the school they are impersonating, someone else's, or
 * everybody's. Getting it wrong is silent — a wrong label renders perfectly.
 */
describe('fixtures', () => {
  test('are valid ObjectIds', () => {
    // A 23-character fixture fails the id shape for the wrong reason and looks like a
    // classifier bug. It has already happened once while writing these tests.
    for (const id of [SCHOOL, OTHER, THIRD]) {
      assert.match(id, /^[0-9a-fA-F]{24}$/, `fixture ${id} is not a 24-char hex id`);
    }
  });
});

describe('isSchoolPage', () => {
  test('covers the impersonated school and every tab of it', () => {
    assert.equal(isSchoolPage(SCHOOL, `/admin/schools/${SCHOOL}`), true);
    assert.equal(isSchoolPage(SCHOOL, `/admin/schools/${SCHOOL}/payments`), true);
    assert.equal(isSchoolPage(SCHOOL, `/admin/schools/${SCHOOL}/team/notes`), true, 'nested tabs count');
  });

  test('respects the path-segment boundary', () => {
    // Without the trailing-slash requirement this matches, so a route merely *starting*
    // with the school's id would be labelled as being inside the school.
    assert.equal(isSchoolPage(SCHOOL, `/admin/schools/${SCHOOL}extra`), false);
  });

  test('is false with no session', () => {
    assert.equal(isSchoolPage(null, `/admin/schools/${SCHOOL}`), false);
  });
});

describe('impersonationScope', () => {
  const cases = [
    // [pathname, expected, why it matters]
    [`/admin/schools/${SCHOOL}`, 'school', 'the impersonated school itself'],
    [`/admin/schools/${SCHOOL}/payments`, 'school', 'a tab of that school'],
    [`/admin/schools/${SCHOOL}/team/notes`, 'school', 'a nested tab'],

    [`/admin/schools/${OTHER}`, 'other', "a different school's page"],
    [`/admin/schools/${OTHER}/payments`, 'other', "another school's tab"],

    ['/admin/schools', 'platform', 'the list covers every school'],
    ['/admin/schools/', 'platform', 'a trailing slash on the list'],

    // The three real misclassifications. Each was found by *running* these cases; none
    // was obvious from reading the code, which is the argument for having them here.
    ['/admin/schools/new', 'platform', '`new` is a literal segment sitting where an id goes'],
    ['/admin/schools/not-an-id', 'platform', 'a non-id segment is not a school'],
    [`/admin/schools/${SCHOOL}extra`, 'platform', 'a typo is not a school'],
    [`/admin/impersonation/${THIRD}`, 'platform', 'a session id is an id, but not a school id'],
    [`/admin/audit-logs/${THIRD}`, 'platform', 'an audit id is not a school id'],
    [`/admin/users/${THIRD}`, 'platform', 'a user id is not a school id'],

    ['/admin', 'platform', 'the overview'],
    ['/admin/finance', 'platform', 'finance'],
    ['/admin/finance/ledger', 'platform', 'a finance sub-page'],
    ['/admin/analytics/revenue', 'platform', 'analytics'],
    ['/', 'platform', 'outside the console entirely'],
  ];

  for (const [pathname, expected, why] of cases) {
    test(`${pathname} → ${expected} (${why})`, () => {
      assert.equal(impersonationScope(SCHOOL, pathname), expected);
    });
  }

  /**
   * The `other` state exists only because removing the client-side route block made
   * another school's page reachable during a session. That is legitimate — a super
   * admin may view any school — but it is not the school being impersonated, and
   * labelling it `platform` would be wrong in the other direction: the page obviously
   * shows somebody's school, so calling it platform-wide says the console cannot tell
   * two tenants apart.
   */
  test('separates the impersonated school from any other one', () => {
    assert.notEqual(
      impersonationScope(SCHOOL, `/admin/schools/${SCHOOL}`),
      impersonationScope(SCHOOL, `/admin/schools/${OTHER}`)
    );
  });
});

describe('the banner names all three states', () => {
  /*
   * Scanned as source, but with comments stripped first.
   *
   * The intent is "no `403` appears in what the operator reads", and the banner's
   * comments legitimately mention `403 IMPERSONATION_READ_ONLY` while explaining that
   * the server is the thing refusing writes. Asserting on raw source therefore fails
   * on the explanation of the very thing the assertion is about — which is the test
   * being wrong about its own subject, not the banner being wrong.
   *
   * This is the boundary the codebase's comment style makes necessary: `403` is a
   * fact that has to be written down next to the code, in a file whose comments are
   * the documentation. Stripping them keeps both.
   */
  const rendered = readFileSync(
    new URL('../components/admin/ImpersonationBanner.jsx', import.meta.url),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  for (const phrase of ['Viewing as', 'Another school', 'Platform data', 'Exit impersonation']) {
    test(`renders "${phrase}"`, () => {
      assert.ok(rendered.includes(phrase), `the banner must render "${phrase}"`);
    });
  }

  test('cannot be mistaken for a permission refusal', () => {
    // A `403` in the rendered copy would claim the server refused the request. It did
    // not — it served it and recorded the read. Telling the operator they are forbidden
    // is the same lie as blocking them, only slower.
    assert.ok(
      !/\b403\b/.test(rendered),
      'the banner must not claim a 403; the server allows and records these reads'
    );
  });
});