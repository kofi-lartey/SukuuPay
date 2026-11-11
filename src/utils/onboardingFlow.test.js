import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES, SIGNUP_ROLES, canCreateSchool, joinsSchoolByCode } from './constants.js';

/**
 * Which onboarding flow a role gets.
 *
 * The rule lives on the server (`SCHOOL_JOIN_ROLES` → `onboardingBlock.flow` and
 * `nextRoute`), and this is the client's mirror of it. A test on a one-line
 * helper earns its place for one reason: the two sides have to agree, and a
 * helper that silently answers `true` for `super_admin` would put the platform
 * owner in a join screen they can never be approved out of.
 */
describe('joinsSchoolByCode — the roles that skip the setup wizard', () => {
  it('claims exactly the roles the signup form offers for joining', () => {
    const joining = SIGNUP_ROLES.some((role) => role.value === 'school_admin')
      ? SIGNUP_ROLES.filter((role) => !role.canCreateSchool).map((role) => role.value)
      : [];
    assert.deepEqual(joining.sort(), ['accountant', 'teacher']);
  });

  it('is true for the three joining roles', () => {
    for (const role of ['accountant', 'teacher']) {
      assert.equal(joinsSchoolByCode(role), true, `${role} joins a school by code`);
    }
  });

  it('is false for anyone who provisions or owns no school', () => {
    for (const role of ['school_admin', 'super_admin', 'parent', undefined, null, '', 'ghost_role']) {
      assert.equal(joinsSchoolByCode(role), false, `${String(role)} must not be diverted`);
    }
  });

  it('is the exact complement of canCreateSchool for every signup role', () => {
    for (const role of SIGNUP_ROLES) {
      assert.equal(
        joinsSchoolByCode(role.value),
        role.canCreateSchool === false,
        `${role.value} must be in exactly one of the two flows`
      );
    }
  });

  it('names the route the server sends these accounts to', () => {
    // The server's `onboardingBlock` returns this literal as `nextRoute` for a
    // joining account. If the two ever disagree, the applicant is redirected to
    // a 404 instead of the only screen they can use.
    assert.equal(ROUTES.ONBOARDING_JOIN_SCHOOL, '/onboarding/join-school');
  });
});
