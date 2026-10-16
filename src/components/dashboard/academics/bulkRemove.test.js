import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * Bulk removal on the Teacher Assignment panel.
 *
 * This was written in the *backend* suite first, and moving it here is the fix.
 * Those assertions read `frontend/src/**` to check prop names and interpolated
 * strings — implementation details of a React component, not a contract between
 * the two apps. Running them from `Backend/tests` meant a rename of
 * `classMediatedCount` broke `npm test` in a directory whose own code had not
 * changed.
 *
 * The contract checks stay where a contract check belongs: `avatar.test.js`
 * still reads the backend's multer limits because the two sides must agree on a
 * number; `teacherAssignment.test.js` still reads its own service.
 *
 * What is asserted here is the specific regression: **bulk remove was
 * impossible for a class's children.** Two bugs composed to make it so.
 */
const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

/**
 * Relative to this file, three levels under `src/`
 * (`components/dashboard/academics/`), so `../../../` is `src/` — the same
 * off-by-one `hookImports.test.js` hit.
 */
const relative = {
  hook: '../../../hooks/admin/useTeacherAssignments.js',
  page: '../../../pages/dashboard/academics/TeacherAssignment.jsx',
  panel: './TeacherAssignmentPanel.jsx',
  bar: './BulkAssignBar.jsx',
};

describe('bulk removal', () => {
  it('passes the ids it was given, not a stale selection', async () => {
    // Bug one. `BulkAssignBar` and the per-row Remove both passed a list; the
    // hook read its own `selected` state instead. Per-row Remove therefore
    // removed whatever happened to be ticked — nothing, usually, which answered
    // "Pick at least one student" — and the row the admin clicked was discarded.
    const hook = await read(relative.hook);
    const body = hook.slice(hook.indexOf('const unassign = useCallback'));

    assert.ok(body.includes('studentIds'), 'the hook does not accept an explicit list of ids');
    assert.ok(
      /\(studentIds && studentIds\.length \? studentIds : \[\.\.\.selected\]\)/.test(body),
      'explicit ids are not honoured ahead of the selection'
    );
    assert.ok(
      body.includes('unassignTeacherStudents(selectedTeacherId, ids'),
      'the resolved list is not the one sent to the server'
    );
  });

  it('threads the ids and the force flag through page and panel', async () => {
    const page = await read(relative.page);
    assert.ok(
      page.includes('unassign({ studentIds: ids'),
      'the page is not passing the ids through'
    );
    assert.ok(page.includes('...options'), 'the page is not forwarding the force flag');

    // The per-row button belongs to the panel, which owns that row.
    const panel = await read(relative.panel);
    assert.ok(
      panel.includes('onRemove={(id) => onUnassign([id], { force: false })}'),
      'per-row Remove is not passing that row\u2019s own id'
    );
  });

  it('counts the class-mediated rows the confirmation has to describe', async () => {
    // Every child of a class assignment is class-mediated, so this number is
    // the whole story on the reported page: twenty of twenty.
    const panel = await read(relative.panel);
    assert.ok(
      /classMediatedSelected/.test(panel),
      'the panel does not tell the bar how many rows are class-mediated'
    );
    assert.ok(
      panel.includes('classMediatedCount={classMediatedSelected}'),
      'the bar is not given the count'
    );
  });

  it('offers both removal branches, each labelled with what it takes', async () => {
    // Bug two, and the one that made a class unremovable: the server refuses
    // class-mediated rows without `force`, so a bulk Remove over twenty
    // class-assigned children removed zero. The bar must name both branches.
    const bar = await read(relative.bar);

    assert.ok(bar.includes('forceRemove'), 'the bar has no force branch');
    assert.ok(bar.includes('{ force: true }'), 'the force branch does not ask the server to force');
    assert.ok(
      bar.includes('Remove ${selectedIds.length - classMediatedCount}'),
      'the plain Remove does not name how many rows it will actually take'
    );
    assert.ok(
      bar.includes('Remove all {selectedIds.length}'),
      'the destructive branch is not labelled with what it takes'
    );
  });

  it('says why the two branches differ, rather than silently skipping rows', async () => {
    // The sentence that turns a confusing no-op into an understandable choice.
    const bar = await read(relative.bar);
    // Collapsed, because the sentence is wrapped across JSX lines and a phrase
    // split over two lines is not a contiguous substring — the same trap the
    // shell-parity test hit with its token strings.
    const flat = bar.replace(/\s+/g, ' ');

    assert.ok(
      flat.includes('were assigned through a class'),
      'the confirmation does not explain what the class rows are'
    );
    assert.ok(
      flat.includes('leaves the rest in place'),
      'the confirmation does not say what the plain branch leaves behind'
    );
    assert.ok(
      flat.includes('Use it when'),
      'the destructive branch carries no guidance on when it is right'
    );
  });

  it('keeps the rows the server refused', async () => {
    // A plain Remove that reports "2 skipped" must leave those two ticked,
    // otherwise the admin cannot see what is still assigned and why.
    const hook = await read(relative.hook);
    const body = hook.slice(hook.indexOf('const unassign = useCallback'));

    assert.ok(
      body.includes('removedIds'),
      'the hook does not read back which rows the server actually removed'
    );
    assert.ok(
      /filter\(\(id\) => !removed\.has\(id\)\)/.test(body),
      'the selection is not reduced to what was actually removed'
    );
  });
});
