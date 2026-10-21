// Run with `npm test` from `frontend/`, on `node --test`.
//
// The payment sheet closes itself once the money has arrived — and only then.
//
// A parent who has just paid, and has been told the money arrived, should not
// then be asked for one more tap. But a sheet that closes itself on a *failed*
// payment takes away the two choices that matter: "try again" and "contact
// the school". A payment that did not go through must not disappear and leave
// the family looking at the fee page as if nothing had happened.
//
// The rule is in its own module so it can be tested directly — there is no DOM
// harness in this project, and a source-text assertion would not pin the rule,
// only the spelling of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { SUCCESS_LINGER_MS, shouldAutoClose } from './parentPayAutoClose.js';

describe('the payment sheet closing itself', () => {
  test('a successful payment closes the sheet', () => {
    assert.equal(shouldAutoClose('success'), true);
  });

  test('a failed payment holds the sheet open', () => {
    // The parent still has to choose: try again, or contact the school.
    assert.equal(shouldAutoClose('failed'), false);
  });

  test('a sheet waiting for approval holds open', () => {
    // A prompt is out on the parent's phone. Closing the sheet would hide the
    // fact that something is still in flight.
    assert.equal(shouldAutoClose('pending'), false);
  });

  test('the form and the code screen hold open', () => {
    assert.equal(shouldAutoClose('form'), false);
    assert.equal(shouldAutoClose('otp'), false);
  });

  test('the success screen stays up long enough to be read', () => {
    // Long enough for the receipt number and the balance, short enough that a
    // parent is not left staring at a sheet that has already said everything.
    assert.ok(SUCCESS_LINGER_MS >= 3000, 'long enough to read the receipt');
    assert.ok(SUCCESS_LINGER_MS <= 10000, 'short enough not to be a wait');
  });
});
