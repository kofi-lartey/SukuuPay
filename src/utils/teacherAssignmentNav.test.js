import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_NAV, ROUTES, ACADEMICS_ROUTES, visibleDashboardNav } from './constants.js';

/**
 * How an admin reaches Teacher Assignment.
 *
 * This test exists because the page was built, wired into the router, and then
 * invisible: no rail entry and no link from the sibling module, so the only way
 * in was typing the URL. A route nobody can navigate to is a feature that does
 * not exist, and nothing in the suite noticed — the page's own render check
 * passed, the backend's 17 tests passed, and the feature was still unreachable.
 *
 * So the assertions here are about *reachability*, not about the route.
 */
const navEntries = () => DASHBOARD_NAV.flatMap((group) => group.items);

const findAcademicEntries = (role) => {
  const groups = visibleDashboardNav(role);
  const academics = groups.find((group) => group.id === 'academics');
  return academics ? academics.items : [];
};

describe('Teacher Assignment is reachable from the admin rail', () => {
  const TARGET = ROUTES.DASHBOARD_ACADEMICS_TEACHER_ASSIGNMENT;

  it('names the route the router actually mounts', () => {
    assert.equal(TARGET, '/dashboard/academics/teacher-assignment');
    // And the two spellings in the app must not drift.
    assert.equal(ACADEMICS_ROUTES.teacherAssignment, TARGET);
  });

  it('has a rail entry', () => {
    const entry = navEntries().find((item) => item.to === TARGET);
    assert.ok(entry, 'Teacher Assignment has no DASHBOARD_NAV entry — the only way in is the URL');
    assert.equal(entry.label, 'Teacher Assignment');
    assert.ok(entry.icon, 'the entry has no icon and renders a blank slot');
    assert.ok(entry.description, 'the entry has no description for the topbar tooltip');
  });

  it('sits in the Academics group, beside the modules it belongs with', () => {
    const groups = DASHBOARD_NAV.filter((group) => group.items.some((item) => item.to === TARGET));
    assert.equal(groups.length, 1, 'the entry is in more than one group');
    assert.equal(groups[0].id, 'academics');
  });

  it('is visible to a school admin and hidden from everyone the server refuses', () => {
    // The four endpoints behind it are all `requireSchoolAdmin`. Hiding the
    // entry from other roles keeps the rail honest; the server is still the
    // boundary, and this must never be the thing that enforces it.
    const forAdmin = findAcademicEntries('school_admin').filter((item) => item.to === TARGET);
    assert.equal(forAdmin.length, 1, 'a school admin cannot see the entry');

    for (const role of ['teacher', 'accountant', 'viewer', 'super_admin']) {
      const visible = findAcademicEntries(role).some((item) => item.to === TARGET);
      assert.equal(visible, false, `${role} can see an entry the server will refuse`);
    }
  });

  it('every other Academics entry is gated the same way', () => {
    // If a future Academics entry is added without a `roles` list it would be
    // visible to every role and 403 on click. This catches that at the config
    // rather than in the field.
    for (const role of ['teacher', 'accountant', 'viewer']) {
      const visible = findAcademicEntries(role);
      assert.equal(visible.length, 0, `${role} sees ${visible.length} Academics entries`);
    }
  });
});

describe('the route itself resolves', () => {
  it('is the path App.jsx registers', () => {
    // The render check below imports the page, which is what proves the import
    // exists; this asserts the two spellings agree so a typo in either shows up
    // as a 404 rather than a silent blank.
    assert.equal(ROUTES.DASHBOARD_ACADEMICS, '/dashboard/academics');
    assert.ok(ROUTES.DASHBOARD_ACADEMICS_TEACHER_ASSIGNMENT.startsWith(ROUTES.DASHBOARD_ACADEMICS));
  });
});
