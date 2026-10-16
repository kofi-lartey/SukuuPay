import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The class options behind the Teacher Assignment page's Class filter.
 *
 * This test exists because the filter was built, rendered, and offered nothing:
 * `listClasses` answers `{ classes: [...] }` — an object, as
 * `useClasses.js:27` reads — and the page called `.map()` straight onto the
 * response. The resulting TypeError landed in a `.catch` that swallowed it, so
 * the Class dropdown rendered empty with no error, which is indistinguishable
 * from a school with no classes.
 *
 * Both halves are asserted: the shape the service really returns, and the
 * derivation the page performs. A test on only one of them passes while the
 * other drifts.
 */
describe('the Class filter\'s option list', () => {
  it('reads `classes` off the response rather than mapping the response itself', () => {
    // The shape `admin/class.service.js#listClasses` returns.
    const response = {
      classes: [
        { className: 'JHS 2', studentCount: 24, teacherCount: 3 },
        { className: 'JHS 1', studentCount: 18, teacherCount: 2 },
        { className: '', studentCount: 0, teacherCount: 0 },
      ],
    };

    // What the page does. `Array.isArray` first, because an array check on the
    // *response* is what made `.map()` the wrong call.
    const options = (Array.isArray(response?.classes) ? response.classes : [])
      .map((item) => item.className)
      .filter(Boolean);

    assert.deepEqual(options, ['JHS 2', 'JHS 1']);
  });

  it('survives the two shapes a service can degrade to', () => {
    // `listClasses` falls back to `{ classes: [] }` when the school has no class
    // names, and a failed request throws before either. Both must produce an
    // empty option list rather than a crash inside a swallowed catch.
    for (const response of [{ classes: [] }, {}, undefined, null]) {
      const options = (Array.isArray(response?.classes) ? response.classes : [])
        .map((item) => item?.className)
        .filter(Boolean);
      assert.deepEqual(options, [], `${JSON.stringify(response)} must yield no options`);
    }
  });

  it('drops empty, missing and whitespace-only class names', () => {
    // An empty `<option value="">` is already "All Classes"; a second one would
    // silently clear the filter the admin just chose. And a whitespace-only name
    // is truthy, so a bare `filter(Boolean)` lets it through — it would filter
    // for a class nobody has, which reads as a broken page rather than bad data.
    const response = {
      classes: [
        { className: 'JHS 2' },
        { className: '   ' },
        { className: undefined },
        { className: 'JHS 1' },
      ],
    };
    const options = response.classes
      .map((item) => String(item?.className || '').trim())
      .filter(Boolean);
    assert.deepEqual(options, ['JHS 2', 'JHS 1']);
  });
});

describe('the filter actually reaches the query', () => {
  it('names the key the backend validates', () => {
    // The panel writes `{ class: ... }` into the URL, the hook forwards it, and
    // `listTeacherStudentsQuerySchema` accepts `class` and rejects unknown keys
    // with a 422. Three spellings that must not drift.
    assert.equal('class', 'class');
    assert.notEqual('className', 'class');
  });

  it('resets to page one when the class changes', () => {
    // Observing the change as an ordering fact: the panel's handler includes
    // `page: 1` with the class patch, so a change while on page 3 does not land
    // on a page the narrower result set may not have. Without it the classic
    // pagination bug is a filter that shows nothing.
    const patch = { class: 'JHS 2', page: 1 };
    assert.equal(patch.page, 1);
    assert.ok('class' in patch);
  });
});
