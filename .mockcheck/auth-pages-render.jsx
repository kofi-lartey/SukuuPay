/**
 * Renders the auth pages the way the app mounts them.
 *
 * `vite build` never executes a component body, so a missing import or an undefined
 * reference on the login page surfaces only in a browser. This is the same argument
 * as the other harnesses in `.mockcheck/`, applied to auth.
 *
 * Both auth pages are rendered because `Login.jsx` gained a third-party dependency
 * (`googleIdentity`) and a new async config read on mount — the two things most likely
 * to break a page that previously had neither.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import Login from '../src/pages/auth/Login.jsx';
import Signup from '../src/pages/auth/Signup.jsx';
import NewPassword from '../src/pages/auth/NewPassword.jsx';
import ResetPassword from '../src/pages/auth/ResetPassword.jsx';
import VerifyEmail from '../src/pages/auth/VerifyEmail.jsx';

const PAGES = [
  ['/login', Login],
  ['/signup', Signup],
  ['/new-password', NewPassword],
  ['/reset-password', ResetPassword],
  ['/verify-email', VerifyEmail],
];

let failures = 0;

const wrap = (children) => (
  <AuthProvider>
    <ToastProvider>{children}</ToastProvider>
  </AuthProvider>
);

for (const [path, Page] of PAGES) {
  const label = `auth: ${path}`;

  try {
    const html = renderToString(
      wrap(
        <MemoryRouter initialEntries={[path]}>
          <Page />
        </MemoryRouter>
      )
    );

    const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      failures += 1;
      console.log(`EMPTY  ${label}`);
      continue;
    }

    console.log(`ok     ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`THREW  ${label}`);
    console.log(`       ${error.message.split('\n')[0]}`);
    if (error.stack) console.log(`       ${error.stack.split('\n').slice(1, 4).join('\n       ')}`);
  }
}

/**
 * The login page must still be a working password form.
 *
 * Asserted because the Google button replaced a stub that was itself a `<button>` —
 * and a mistake in that replacement (a stray closing tag, a form wrapper left open)
 * would still render a page, just not a usable one. These are the strings the page is
 * for.
 */
try {
  const html = renderToString(
    wrap(
      <MemoryRouter initialEntries={['/login']}>
        <Login />
      </MemoryRouter>
    )
  );
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  for (const phrase of ['Work email', 'Password', 'Sign in', 'Forgot password?', 'Create a school account']) {
    if (!text.includes(phrase)) {
      failures += 1;
      console.log(`MISSING login page — expected "${phrase}"`);
    }
  }

  console.log('ok     login page still has its password form');
} catch (error) {
  failures += 1;
  console.log(`THREW  login page assertion — ${error.message.split('\n')[0]}`);
}

console.log(failures ? `\n${failures} failure(s)` : `\nall ${PAGES.length + 1} checks passed`);
process.exit(failures ? 1 : 0);