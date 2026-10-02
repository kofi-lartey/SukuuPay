/**
 * Renders `ImpersonationBanner` with a live impersonation in storage.
 *
 * The whole-console harness renders the banner as `null` — `useImpersonation` finds
 * nothing in `localStorage` and returns early — which means the part of the component
 * that was most recently rewritten never executes. A render check that always hits
 * an early return is not a render check.
 *
 * All three states are covered, because the wording, the icon and the exit button all
 * change between them and a crash in any one of them would white-screen the console.
 */
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import ImpersonationBanner from '../src/components/admin/ImpersonationBanner.jsx';
import AdminSidebar from '../src/components/admin/AdminSidebar.jsx';

const SCHOOL = '0123456789abcdef01234567';
const OTHER = '0123456789abcdef01234568';

const TOKEN_KEY = 'admin_impersonation_token';
const META_KEY = `${TOKEN_KEY}_meta`;

const seed = (schoolId, schoolName) => {
  localStorage.setItem(TOKEN_KEY, 'impersonation.jwt.token');
  localStorage.setItem(
    META_KEY,
    JSON.stringify({
      sessionId: '0123456789abcdef012345aa',
      schoolId,
      schoolName,
      schoolCode: 'PRAM-01',
      region: 'Greater Accra',
      reason: 'Parent reports a failed payment for Student 4412',
      startedAt: new Date().toISOString(),
    })
  );
};

const clear = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(META_KEY);
};

const CASES = [
  ['the impersonated school', `/admin/schools/${SCHOOL}`],
  ['a tab of that school', `/admin/schools/${SCHOOL}/payments`],
  ['a different school', `/admin/schools/${OTHER}`],
  ['a platform-wide page', '/admin/finance'],
  ['the overview', '/admin'],
  ['the create form', '/admin/schools/new'],
];

let failures = 0;

const attempt = (label, fn) => {
  try {
    const html = fn();
    const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (!text) {
      failures += 1;
      console.log(`EMPTY  ${label} — rendered nothing`);
      return;
    }

    const expectations = {
      'the impersonated school': ['Viewing as', 'Prampram Basic School', 'Exit impersonation'],
      'a tab of that school': ['Viewing as', 'Prampram Basic School'],
      'a different school': ['Another school', 'Prampram Basic School', 'a different school'],
      'a platform-wide page': ['Platform data', 'not Prampram Basic School', 'recorded'],
      'the overview': ['Platform data'],
      'the create form': ['Platform data'],
    };

    for (const phrase of expectations[label] || []) {
      if (!text.includes(phrase)) {
        failures += 1;
        console.log(`MISSING ${label} — expected to read "${phrase}"`);
        console.log(`        got: ${text.slice(0, 240)}`);
        break;
      }
    }

    console.log(`ok     ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`THREW  ${label}`);
    console.log(`       ${error.message.split('\n')[0]}`);
    if (error.stack) console.log(`       ${error.stack.split('\n').slice(1, 4).join('\n       ')}`);
  }
};

for (const [label, path] of CASES) {
  seed(SCHOOL, 'Prampram Basic School');

  attempt(`banner: ${label}`, () =>
    renderToString(
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <ImpersonationBanner />
        </MemoryRouter>
      </ToastProvider>
    )
  );

  attempt(`sidebar: ${label}`, () =>
    renderToString(
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AdminSidebar />
        </MemoryRouter>
      </ToastProvider>
    )
  );
}

// And with no session at all — the overwhelmingly common case, and the one that must
// render nothing rather than a half-built banner.
clear();

attempt('banner: no session (renders nothing)', () => {
  const html = renderToString(
    <ToastProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <ImpersonationBanner />
      </MemoryRouter>
    </ToastProvider>
  );

  /*
   * Asserted on the *banner's own* words, not on the tree being empty. `ToastProvider`
   * renders a live notification region whether or not anything is in it, so an
   * emptiness assertion would be testing the harness rather than the component — and
   * would have failed here for a reason that has nothing to do with impersonation.
   */
  const text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const phrase of ['Viewing as', 'Another school', 'Platform data', 'Exit impersonation']) {
    if (text.includes(phrase)) {
      throw new Error(`the banner rendered "${phrase}" with no impersonation open`);
    }
  }
  return html;
});

console.log(failures ? `\n${failures} failure(s)` : `\nall ${CASES.length * 2 + 1} checks passed`);
process.exit(failures ? 1 : 0);