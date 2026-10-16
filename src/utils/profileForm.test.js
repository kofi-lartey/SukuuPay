import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateNameField, validatePhoneField, validatePositionField, validateProfilePatch } from './profileForm.js';

/**
 * The rules a teacher's own details are checked against, before any PATCH.
 *
 * These are transcribed from `updateUserSchema` in the backend, so the numbers
 * in these tests are the server's numbers. What is really being asserted is the
 * *shape* of the contract: the client must not be looser than the server (a
 * teacher fills in a 150-character name, presses save, and gets a toast), and
 * it must not be tighter (a form that refuses a phone number the API accepts is
 * a form the user learns to distrust).
 */
describe('validateNameField', () => {
  it('requires a name, and says so plainly', () => {
    assert.match(validateNameField(''), /required/);
    assert.match(validateNameField('   '), /required/);
    assert.match(validateNameField(null), /required/);
  });

  it('mirrors the server min of 2', () => {
    assert.equal(validateNameField('A'), 'Use at least 2 characters.');
    assert.equal(validateNameField('Ab'), null);
  });

  it('mirrors the server max of 100', () => {
    assert.equal(validateNameField('a'.repeat(100)), null);
    assert.equal(validateNameField('a'.repeat(101)), 'Use at most 100 characters.');
  });

  it('ignores surrounding whitespace', () => {
    assert.equal(validateNameField('  Ama Mensah  '), null);
  });
});

describe('validatePositionField', () => {
  it('is optional, and blank means none', () => {
    assert.equal(validatePositionField(''), null);
    assert.equal(validatePositionField(undefined), null);
  });

  it('mirrors the server max of 80', () => {
    assert.equal(validatePositionField('a'.repeat(80)), null);
    assert.equal(validatePositionField('a'.repeat(81)), 'Use at most 80 characters.');
  });
});

describe('validatePhoneField', () => {
  it('is optional', () => {
    assert.equal(validatePhoneField(''), null);
    assert.equal(validatePhoneField(null), null);
  });

  it('mirrors the server min of 7 and max of 20', () => {
    assert.equal(validatePhoneField('0241234'), null);
    assert.match(validatePhoneField('02412'), /too short/);
    assert.match(validatePhoneField('0'.repeat(21)), /too long/);
  });

  it('accepts a number the way it is actually written', () => {
    // Ghanaian numbers carry spaces, a country code and brackets. A form that
    // rejects `+233 24 123 4567` is a form that is wrong.
    for (const phone of ['0244 123 4567', '+233 24 123 4567', '(0244) 123-4567']) {
      assert.equal(validatePhoneField(phone), null, `${phone} must be accepted`);
    }
  });

  it('refuses a number with letters in it', () => {
    assert.match(validatePhoneField('0244 CALL ME'), /digits, spaces/);
  });
});

describe('validateProfilePatch', () => {
  it('is saveable with a name alone', () => {
    assert.deepEqual(validateProfilePatch({ name: 'Ama Mensah' }), {});
  });

  it('is saveable when everything is filled in', () => {
    const patch = {
      name: 'Ama Mensah',
      position: 'JHS 2 form teacher',
      phone: '0244 123 4567',
    };
    assert.deepEqual(validateProfilePatch(patch), {});
  });

  it('reports every bad field at once, keyed by field', () => {
    // Keyed rather than a single message: the caller renders the error next to
    // the line that is wrong, which is the difference between a fix and a guess.
    const errors = validateProfilePatch({ name: '', position: 'x'.repeat(81), phone: 'abc' });

    assert.deepEqual(Object.keys(errors).sort(), ['name', 'phone', 'position']);
    assert.ok(errors.name && errors.position && errors.phone);
  });

  it('treats a missing patch as a missing name, not as valid', () => {
    // An empty submission must not save: the server's `.min(1)` would reject it
    // too, and saving nothing while showing success is worse than refusing.
    assert.deepEqual(Object.keys(validateProfilePatch({})), ['name']);
    assert.deepEqual(Object.keys(validateProfilePatch()), ['name']);
  });
});
