/**
 * Renders the auth pages the way the app does, with react-dom/server, so a
 * runtime error like `params is not defined` fails here instead of in a
 * browser console.
 *
 * A production build cannot catch this class of bug: `params is not defined` is
 * a reference error that only fires when the component actually executes, and
 * `vite build` never executes a component body. That is exactly how the
 * recovery screen shipped broken while still building cleanly.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';
import VerifyEmail from '../src/pages/auth/VerifyEmail.jsx';
import Signup from '../src/pages/auth/Signup.jsx';
import Login from '../src/pages/auth/Login.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';

let pass = 0;
let fail = 0;

const check = (name, fn) => {
  try {
    const detail = fn();
    pass += 1;
    console.log(`  OK   ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    fail += 1;
    console.log(`  FAIL ${name}: ${error.message}`);
  }
};

const at = (path) => (
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </AuthProvider>
  </MemoryRouter>
);

const has = (html, needle) => html.includes(needle);

// The recovery screen: the state a failed verification email routes to.
await check('verify-email recovery screen renders', () => {
  const html = renderToString(
    at('/verify-email?email=head%40school.edu.gh&reason=email-failed')
  );
  if (!has(html, 'We couldn')) throw new Error('missing the recovery title');
  if (!has(html, 'Resend code')) throw new Error('missing the resend CTA');
  if (has(html, 'Resend in')) {
    throw new Error('cooldown was NOT seeded to 0 on the recovery screen');
  }
  if (has(html, 'Verification code')) {
    throw new Error('the OTP input should be withheld until a resend succeeds');
  }
  return 'title, resend CTA, cooldown at 0, no OTP field';
});

await check('verify-email recovery screen shows the registered address', () => {
  const html = renderToString(
    at('/verify-email?email=head%40school.edu.gh&reason=email-failed')
  );
  if (!has(html, 'head@school.edu.gh')) throw new Error('the address was not pre-filled');
  return 'email field pre-filled from the query string';
});

await check('verify-email recovery screen reassures about the account', () => {
  const html = renderToString(
    at('/verify-email?email=head%40school.edu.gh&reason=email-failed')
  );
  if (!has(html, 'Your account is ready')) throw new Error('missing the reassurance notice');
  return 'account-is-fine notice present';
});

// The normal path must be unchanged: OTP first, resend secondary, cooldown on.
await check('the ordinary verify-email screen is unchanged', () => {
  const html = renderToString(at('/verify-email?email=head%40school.edu.gh'));
  if (!has(html, 'Enter your verification code')) throw new Error('wrong title');
  if (!has(html, 'Verification code')) throw new Error('the OTP field is missing');
  if (!has(html, 'Resend in 60s')) throw new Error('cooldown should start at 60s here');
  if (has(html, 'We couldn')) throw new Error('recovery copy leaked into the normal path');
  return 'OTP first, 60s cooldown, no recovery copy';
});

await check('verify-email with no query string still renders', () => {
  const html = renderToString(at('/verify-email'));
  if (!has(html, 'Enter your verification code')) throw new Error('wrong title');
  return 'no email in the query string';
});

await check('verify-email from an emailed link auto-renders', () => {
  const html = renderToString(at('/verify-email/123456'));
  if (!has(html, 'Enter your verification code')) throw new Error('wrong title');
  return 'path-token route renders';
});

await check('signup renders', () => {
  const html = renderToString(at('/signup'));
  if (!has(html, 'Create your school account')) throw new Error('wrong title');
  return 'signup form renders';
});

await check('login renders', () => {
  const html = renderToString(at('/login'));
  if (!has(html, 'Sign in')) throw new Error('wrong title');
  return 'login form renders';
});

await check('the public pages assert no invented track record', () => {
  // Every one of these was a fabricated number or attribution shown to an
  // unauthenticated visitor, and they did not agree with each other: the asides
  // claimed "140+ Schools" and "GH₵ 42M+ Disbursed" while the how-it-works strip
  // claimed "180+ Partner Schools" and the pricing page claimed "GH₵ 34.2M Fees
  // collected in 2024". The 99.8% appeared as both a "MoMo SLA uptime guarantee"
  // and a "MoMo success rate". There is no aggregate over the schools or payments
  // collections that produces any of them, and the database has one school on it.
  //
  // A five-star testimonial from "Mrs. Cynthia Osei-Tutu, Head Bursar, Morning
  // Star Preparatory" went the same way — a named person, a named school and a
  // reconciliation-time claim, none of which existed.
  const routes = ['/', '/login', '/signup', '/pricing', '/how-it-works', '/for-schools', '/contact'];
  const forbidden = [
    'GH₵ 42M',
    'GH₵ 34.2M',
    '99.8%',
    '98.4%',
    '140+ Partner',
    '140+ Schools',
    '180+',
    'Cynthia Osei-Tutu',
    'Morning Star Preparatory,',
    '1,200+ student payments',
    '12,480',
    '233 24 000 0000',
    '+233 24 456 7890',
  ];
  for (const route of routes) {
    const html = renderToString(at(route));
    for (const needle of forbidden) {
      if (has(html, needle)) {
        throw new Error(`[${route}] renders the invented claim "${needle}"`);
      }
    }
  }
  return `${routes.length} public routes, no fabricated metric or attribution`;
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
