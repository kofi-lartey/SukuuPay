// Run with `npm test` from `frontend/`, on `node --test`.
//
// The parent's mobile money code has to reach the gateway.
//
// Moolre verifies the payer's phone number before it sends the approval
// prompt. The first request is answered with "a code was sent to you by SMS";
// the parent types that code in; and the code is answered by **repeating the
// same request with it**.
//
// The bug this test exists for: the code was accepted by the service
// function's signature and then **dropped from the request body**, so the
// second request was indistinguishable from the first. Moolre answered "a code
// is required" again, and the parent was told their code had not been
// accepted — every time, no matter how carefully they typed it. The parent's
// money had not moved and the code was correct; the code simply never left
// the browser.
//
// The reference travels with it for the same reason: Moolre verifies a number
// against a transaction, and the transaction is named by the reference.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInitiatePayload } from './parentPayInitiate.js';

describe('the initiation body', () => {
  test('it carries the amount, the number and the network', () => {
    const body = buildInitiatePayload({
      amount: 110000,
      phone: '0557655008',
      network: 'MTN',
      description: 'School fees',
    });

    assert.equal(body.amount, 110000);
    assert.equal(body.phone, '0557655008');
    assert.equal(body.network, 'MTN');
    assert.equal(body.description, 'School fees');
  });

  test('it carries the code the parent typed', () => {
    // The whole point. Without this the code never reaches Moolre.
    const body = buildInitiatePayload({
      amount: 110000,
      phone: '0557655008',
      network: 'MTN',
      otpCode: '123456',
    });

    assert.equal(body.otpCode, '123456');
  });

  test('it carries the reference of the payment in flight', () => {
    // The code is answered against a transaction, and the reference names it.
    const body = buildInitiatePayload({
      amount: 110000,
      phone: '0557655008',
      network: 'MTN',
      otpCode: '123456',
      reference: 'SUK-1792573601108-NIZC2A',
    });

    assert.equal(body.reference, 'SUK-1792573601108-NIZC2A');
  });

  test('a first attempt carries neither a code nor a reference', () => {
    // An empty `otpCode` would be sent as a submitted code, and the backend
    // reads a present code as "this is a verification" — which is not what a
    // first attempt is.
    const body = buildInitiatePayload({
      amount: 110000,
      phone: '0557655008',
      network: 'MTN',
    });

    assert.equal('otpCode' in body, false);
    assert.equal('reference' in body, false);
  });

  test('an empty code is not sent as a code', () => {
    const body = buildInitiatePayload({
      amount: 110000,
      phone: '0557655008',
      network: 'MTN',
      otpCode: '',
      reference: '',
    });

    assert.equal('otpCode' in body, false);
    assert.equal('reference' in body, false);
  });
});
