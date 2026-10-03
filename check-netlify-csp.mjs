import { readFileSync } from 'node:fs';

/**
 * Validate the Netlify header block, because a malformed `netlify.toml` fails at
 * **deploy** time and takes the whole site with it.
 *
 * There is no TOML parser in this project's dependencies, so this is a targeted
 * check on the one directive that matters rather than a general TOML parse: every
 * `Content-Security-Policy` value is a semicolon-separated directive list, and a
 * stray quote or unbalanced table header is the realistic failure mode for a
 * hand-edited file.
 */
const src = readFileSync('netlify.toml', 'utf8');

const cspValues = [...src.matchAll(/Content-Security-Policy\s*=\s*"([^"]+)"/g)].map((m) => m[1]);

console.log('CSP entries found:', cspValues.length);

let failures = 0;

for (const csp of cspValues) {
  const directives = csp
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  const malformed = directives.filter((d) => !/^[a-z0-9-]+\s+\S/.test(d));
  console.log('  directives:', directives.length, malformed.length ? `MALFORMED: ${malformed.join(' | ')}` : 'all well-formed');
  if (malformed.length) failures += 1;

  for (const name of ['default-src', 'script-src', 'frame-src', 'connect-src', 'style-src', 'img-src']) {
    const directive = directives.find((d) => d.startsWith(`${name} `));
    if (!directive) {
      console.log(`   ${name.padEnd(12)} ABSENT`);
      failures += 1;
    }
  }

  for (const name of ['script-src', 'frame-src', 'connect-src']) {
    const directive = directives.find((d) => d.startsWith(`${name} `)) || '';
    const ok = directive.includes('accounts.google.com');
    console.log(`   ${name.padEnd(12)} ${ok ? 'has accounts.google.com' : 'MISSING accounts.google.com'}`);
    if (!ok) failures += 1;
  }

  // `'unsafe-inline'` in script-src is the thing this file went out of its way to
  // avoid, and it must not creep back in via an edit that fixes one violation by
  // opening everything.
  const scriptSrc = directives.find((d) => d.startsWith('script-src ')) || '';
  if (scriptSrc.includes("'unsafe-inline'")) {
    console.log("   !! script-src contains 'unsafe-inline' — that defeats the policy");
    failures += 1;
  }
}

/**
 * Structural check.
 *
 * Two corrections to earlier attempts, both of which reported problems that did not
 * exist:
 *
 *   - counting `[[` against `]]` "closers" — TOML array-of-tables are delimited by
 *     the *next header*, not by a closing bracket, so there is nothing to balance;
 *   - anchoring `[headers.values]` at column 0 — leading whitespace before a table
 *     header is legal, and this file indents it.
 *
 * The real requirement is that every `[[headers]]` block is followed by a
 * `[headers.values]` sub-table. Without it Netlify rejects the whole file at deploy
 * time, taking the site with it — which is why this is checked at all.
 */
const blocks = src.split(/^\[\[/m).slice(1);

/*
 * Only `headers` blocks are checked — an earlier version applied the rule to every
 * array-of-tables and failed on `[[redirects]]`, which correctly has no
 * `[headers.values]` and never should.
 */
const headerBlocks = blocks.filter((block) => block.startsWith('headers'));
const withoutValues = headerBlocks.filter(
  (block) => !/^\s*\[headers\.values\]/m.test(block)
);

console.log(
  '[[headers]] blocks:',
  headerBlocks.length,
  withoutValues.length ? 'MISSING [headers.values]' : 'all have values'
);
if (withoutValues.length) failures += 1;

console.log(failures ? `\n${failures} problem(s)` : '\nnetlify.toml header block is sound');
process.exit(failures ? 1 : 0);