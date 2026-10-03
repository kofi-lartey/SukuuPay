import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import Home from '../src/pages/Home.jsx';

const html = renderToStaticMarkup(
  <AuthProvider>
    <ToastProvider>
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>
    </ToastProvider>
  </AuthProvider>
);

const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('rendered chars:', html.length);
console.log('visible text chars:', text.length);
console.log('\n--- first 600 chars of visible text ---\n');
console.log(text.slice(0, 600));

const probes = [
  ['has <h1>', /<h1[\s>]/.test(html)],
  ['hero heading', html.includes('Collect Every School Fee')],
  ['navbar-ish CTA', html.includes('Get Started')],
  ['feature section', html.includes('Mobile Money') || html.includes('mobile money')],
  ['no literal undefined', !text.includes('undefined')],
  ['no literal NaN', !text.includes('NaN')],
  ['no raw [object Object]', !text.includes('[object Object]')],
  ['no leftover template braces', !html.includes('${')],
  ['no react error boundary text', !text.includes('Something went wrong')],
];
console.log('\n--- probes ---');
for (const [name, ok] of probes) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);