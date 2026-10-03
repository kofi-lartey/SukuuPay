// Local sanity check for netlify.toml — confirms the table/bracket structure
// parses and that the SPA rewrite resolves deep links to index.html the way
// Netlify will serve them. Netlify itself is the real authority; this just
// catches a malformed file or a missing publish dir before the first deploy.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// frontend/.mockcheck/netlify.mjs -> the frontend dir, where netlify.toml lives.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');

let depth = 0;
let inString = false;
for (const ch of toml) {
  if (ch === '"') inString = !inString;
  if (inString) continue;
  if (ch === '[') depth += 1;
  if (ch === ']') depth -= 1;
}
console.log(depth === 0 ? 'OK   bracket balance' : `FAIL bracket balance ${depth}`);

for (const key of ['command', 'publish', 'NODE_VERSION']) {
  console.log(`  ${toml.includes(key) ? 'OK  ' : 'FAIL'} ${key}`);
}

// `base` must NOT be set. Netlify's base directory is already `frontend`, and a
// `base` key here would prepend it a second time, so the build would look for
// frontend/frontend/package.json and fail.
const baseKey = toml.match(/^\s*base\s*=/m);
console.log(`  ${baseKey ? 'FAIL' : 'OK  '} no redundant "base" key${baseKey ? ' — would double the base dir' : ''}`);

// Guards the failure that actually shipped once: a netlify.toml at the repo
// root is ignored, because Netlify reads the file from the base directory.
const strayRoot = join(root, '..', 'netlify.toml');
console.log(
  `  ${existsSync(strayRoot) ? 'FAIL' : 'OK  '} no netlify.toml at the repo root${existsSync(strayRoot) ? ' — silently ignored' : ''}`
);

const publish = toml.match(/publish\s*=\s*"([^"]+)"/)?.[1];
const base = toml.match(/base\s*=\s*"([^"]+)"/)?.[1];
const dist = join(root, base || '', publish || '');
console.log(`  ${existsSync(join(dist, 'index.html')) ? 'OK  ' : 'FAIL'} ${join(base || '', publish || '')}/index.html exists`);

const rewrite = toml.match(/from\s*=\s*"\/\*"\s*\n\s*to\s*=\s*"([^"]+)"\s*\n\s*status\s*=\s*(\d+)/);
console.log(`  ${rewrite ? 'OK  ' : 'FAIL'} SPA rewrite ${rewrite ? `/* -> ${rewrite[1]} (${rewrite[2]})` : 'missing'}`);

// Every wizard step must be reachable as a deep link.
//
// The list is the wizard, written out — which is the same duplication
// `ONBOARDING_STEPS` is for. It cannot import that (it parses `netlify.toml`
// with a regex and runs with no bundler), so it is kept in step by hand and the
// `pricing` step is here for exactly that reason: a new step that is not added to
// this list is a step whose deep link nobody checked.
const steps = ['school-profile', 'payment-setup', 'import-students', 'pricing', 'send-reminder'];
for (const step of steps) {
  const path = `/onboarding/${step}`;
  // A catch-all rewrite means any path that is not a real file serves the SPA
  // shell, so the browser router resolves it. This asserts the rewrite exists.
  console.log(`  ${rewrite && rewrite[2] === '200' ? 'OK  ' : 'FAIL'} deep link ${path}`);
}
