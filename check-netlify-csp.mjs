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

  /*
    * Every origin Sign-In With Google needs, per directive.

    * Enumerated rather than a single "mentions accounts.google.com" check, because the
    * four were added one at a time as each violation appeared in a browser console,
    * and the fourth (`style-src`, for `accounts.google.com/gsi/style`) surfaced only
    * once the script could finally load. A list is what stops that being a sequence of
    * deploy-and-check cycles.
    */
  const REQUIRED = [
    ['script-src', 'the GIS script'],
    ['frame-src', 'the button iframe'],
    ['connect-src', "GIS's token endpoint"],
    ['style-src', 'the GIS stylesheet'],
    ['img-src', 'Google avatars'],
  ];

  for (const [name, why] of REQUIRED) {
    const directive = directives.find((d) => d.startsWith(`${name} `)) || '';
    const ok = directive.includes('accounts.google.com') || directive.includes('lh3.googleusercontent.com');
    console.log(`   ${name.padEnd(12)} ${ok ? 'ok' : `MISSING (${why})`}`);
    if (!ok) failures += 1;
  }

  /*
    * The inline-script hash, and the rule around it.

    * GIS executes an inline script of its own and refuses to work without it. A
    * **hash** permits exactly that script and nothing else, so our own inline code
    * stays blocked — which is why this check exists: the tempting fix for a broken
    * Sign-In button is `'unsafe-inline'`, and that would re-open inline execution for
    * the whole application to accommodate a third party.
    *
    * So: a hash must be present, and `'unsafe-inline'` must not be.
    */
  const scriptSrc = directives.find((d) => d.startsWith('script-src ')) || '';

  if (!/'sha256-[A-Za-z0-9+/=]+'/.test(scriptSrc)) {
    console.log('   script-src    MISSING a sha256 hash for the GIS inline script');
    failures += 1;
  } else {
    console.log('   script-src    has a sha256 hash for the GIS inline script');
  }

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