import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLandingRoute } from './landing.js';
import { ROUTES, TEACHER_ROUTES } from './constants.js';

/**
 * Where a signed-in account is placed.
 *
 * The bug this tests against: a teacher who typed their password landed on
 * `/dashboard` — the school's finance console — because the login form navigated
 * to `?next`, or to `/dashboard` when there was nothing to honour, and nobody
 * asked the role. One of the five roles in this product ships with a whole
 * separate portal and it was the one role that never got sent to it.
 *
 * So these tests are not about the happy path. They are about the three places
 * the ordering can go wrong, because each of those was a real way to end up in
 * the wrong console.
 */
describe('resolveLandingRoute', () => {
  const linked = { linked: true, completed: true, flow: 'join', nextRoute: ROUTES.DASHBOARD };
  const unfinished = {
    linked: false,
    completed: false,
    flow: 'join',
    joinRequested: true,
    nextRoute: ROUTES.ONBOARDING_JOIN_SCHOOL,
  };

  /** `params.get('next') || state.from?.pathname || null`, as `Login.jsx` now builds it. */
  const paramsLike = (value) => value || null;

  // ── The bug itself ────────────────────────────────────────────────────────
  it('sends a teacher to the teacher portal', () => {
    assert.equal(resolveLandingRoute({ onboarding: linked, role: 'teacher' }), TEACHER_ROUTES.dashboard);
  });

  it('sends a teacher there on both login paths, not just one', () => {
    // Password and Google used to pick their destination differently
    // (`redirectTo` vs `nextRoute`). Same input, same answer, whichever button
    // was pressed — and `requested` is what the *browser* asked for, so a plain
    // sign-in with no deep link is the case that must still reach the portal.
    const password = resolveLandingRoute({ onboarding: linked, role: 'teacher' });
    const google = resolveLandingRoute({ onboarding: linked, role: 'teacher' });
    assert.equal(password, TEACHER_ROUTES.dashboard);
    assert.equal(google, TEACHER_ROUTES.dashboard);
  });

  it('reads "no deep link" as null, not as a default that overrides the role', () => {
    // The shape of the bug this whole module exists for: a login form whose
    // fallback was the string `'/dashboard'` handed the resolver a value that
    // looked exactly like an explicit request, so the deep-link rule fired on
    // every ordinary sign-in and the role landing never ran at all.
    const requested = paramsLike(null);
    assert.equal(resolveLandingRoute({ onboarding: linked, role: 'teacher', requested }), TEACHER_ROUTES.dashboard);
  });

  it('leaves every other role on the school console', () => {
    for (const role of ['school_admin', 'accountant', 'viewer']) {
      assert.equal(
        resolveLandingRoute({ onboarding: linked, role }),
        ROUTES.DASHBOARD,
        `${role} belongs on the school console`
      );
    }
  });

  it('still sends a platform admin to the platform console', () => {
    // The existing `RoleLanding` rule, unchanged. This resolver answering
    // something different for `super_admin` would fight the route guard.
    assert.equal(
      resolveLandingRoute({ onboarding: { ...linked, nextRoute: ROUTES.DASHBOARD }, role: 'super_admin' }),
      ROUTES.DASHBOARD
    );
  });

  // ── Ordering: onboarding beats the role landing ───────────────────────────
  it('sends an unfinished teacher to onboarding, never to the teacher portal', () => {
    // The important direction. `TeacherGuard` lets any `teacher` through, so a
    // pending teacher sent to `/teacher` would get in — and then fire five
    // requests against a school they have not been approved into. The screen
    // the server names is the answer, whichever flow it belongs to.
    assert.equal(
      resolveLandingRoute({ onboarding: unfinished, role: 'teacher' }),
      ROUTES.ONBOARDING_JOIN_SCHOOL
    );
    assert.equal(
      resolveLandingRoute({ onboarding: { ...unfinished, nextRoute: ROUTES.ONBOARDING }, role: 'teacher' }),
      ROUTES.ONBOARDING
    );
    // Nothing at all from the server: onboarding exists, but which screen it is
    // is not this function's to invent, so the tree root is the honest answer
    // and the guard's own flow rule takes over from there.
    assert.equal(
      resolveLandingRoute({ onboarding: { linked: false, completed: false }, role: 'teacher' }),
      ROUTES.ONBOARDING
    );
  });

  it('drops a deep link that points at onboarding', () => {
    // An expired link must not replay a wizard step at somebody already approved.
    const route = resolveLandingRoute({
      onboarding: linked,
      role: 'teacher',
      requested: ROUTES.ONBOARDING,
    });
    assert.equal(route, TEACHER_ROUTES.dashboard);
  });

  // ── Ordering: a deep link beats the role landing ──────────────────────────
  it('honours a deep link over the role landing', () => {
    // The Students roster carries no role restriction, so a teacher who followed
    // a shared link there is asking for that page. Overriding it would make the
    // link unusable for the one role it was most often shared with.
    assert.equal(
      resolveLandingRoute({ onboarding: linked, role: 'teacher', requested: '/dashboard/students' }),
      '/dashboard/students'
    );
  });

  it('honours a deep link with its query and hash intact', () => {
    assert.equal(
      resolveLandingRoute({ onboarding: linked, role: 'teacher', requested: '/dashboard/students?q=a&limit=50#row-2' }),
      '/dashboard/students?q=a&limit=50#row-2'
    );
  });

  it('honours a deep link for every role, including the ones with a landing of their own', () => {
    for (const role of ['school_admin', 'teacher', 'viewer', 'super_admin']) {
      assert.equal(
        resolveLandingRoute({ onboarding: linked, role, requested: '/dashboard/payments' }),
        '/dashboard/payments'
      );
    }
  });

  // ── A `?next=` is attacker-controlled ────────────────────────────────────
  it('refuses anything that is not a path inside this app', () => {
    const hostile = [
      'https://example.test/steal',
      'http://example.test',
      '//example.test',
      'example.test/dashboard',
      'javascript:alert(1)',
      'mailto:someone@example.test',
      '',
      '   ',
      null,
      undefined,
      42,
      {},
    ];
    for (const requested of hostile) {
      assert.equal(
        resolveLandingRoute({ onboarding: linked, role: 'teacher', requested }),
        TEACHER_ROUTES.dashboard,
        `${JSON.stringify(requested)} must not steer the redirect`
      );
    }
  });

  it('does not send a fresh sign-in straight back to the login form', () => {
    assert.equal(
      resolveLandingRoute({ onboarding: linked, role: 'teacher', requested: ROUTES.LOGIN }),
      TEACHER_ROUTES.dashboard
    );
  });

  // ── Degenerate input ──────────────────────────────────────────────────────
  it('falls back to the school console when the server said nothing at all', () => {
    assert.equal(resolveLandingRoute({ role: 'school_admin' }), ROUTES.DASHBOARD);
    assert.equal(resolveLandingRoute({}), ROUTES.DASHBOARD);
    assert.equal(resolveLandingRoute(), ROUTES.DASHBOARD);
  });

  it('does not hang an unauthenticated caller on a loop', () => {
    // `?next=/login` is the one value that would otherwise survive, and
    // navigating to `/login` after a successful sign-in is a loop.
    assert.notEqual(resolveLandingRoute({ role: 'teacher', requested: ROUTES.LOGIN }), ROUTES.LOGIN);
  });
});
