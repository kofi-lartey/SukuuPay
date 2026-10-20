// Run with `npm test` from `frontend/`, on `node --test`.
//
// The parent pay sheet reads two things out of an initiate response: the
// **reference** it polls on, and the **hosted-checkout URL** it offers when a
// USSD prompt never arrives.
//
// Both are read out of a nested shape, and that shape is the trap. The API
// answers with `{ payment, provider, <gateway block>, payLink }` — the
// reference is on the *payment record* and in the *gateway's own block*, not
// at the top level. Reading `response.reference` returns `undefined` for every
// MoMo gateway, and the sheet then sits on a spinner it can never resolve:
// the parent sees "Waiting for you to approve" forever, while their money may
// already have moved.
//
// The checkout URL matters for the opposite reason: a USSD push that never
// arrives is a dead end for a parent whose phone is off or out of credit. If
// the URL is not surfaced, there is no way to pay at all.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolvePaymentReference } from './parentPayResponse.js';

describe('the reference the portal polls on', () => {
  test('it is read from the payment record', () => {
    assert.equal(
      resolvePaymentReference({ payment: { reference: 'SUK-1-ABCDEF' } }),
      'SUK-1-ABCDEF'
    );
  });

  test('it is read from the gateway block', () => {
    assert.equal(
      resolvePaymentReference({ moolre: { reference: 'SUK-1-ABCDEF' } }),
      'SUK-1-ABCDEF'
    );
    assert.equal(
      resolvePaymentReference({ mtn: { referenceId: 'SUK-1-ABCDEF' } }),
      'SUK-1-ABCDEF'
    );
  });

  test('a top-level reference is still honoured', () => {
    assert.equal(resolvePaymentReference({ reference: 'SUK-1-ABCDEF' }), 'SUK-1-ABCDEF');
  });

  test('a response with no reference resolves to null rather than undefined', () => {
    // The sheet tests this value for truthiness, so `null` and `undefined` both
    // work — but `null` says "there is none" rather than "we did not look".
    assert.equal(resolvePaymentReference({ payment: {} }), null);
    assert.equal(resolvePaymentReference({}), null);
    assert.equal(resolvePaymentReference(null), null);
  });
});
