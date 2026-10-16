import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

/**
 * A React hook used in a file must be imported into it.
 *
 * This test exists because the bug it catches has happened three times in this
 * project's recent history, and every one of them passed `vite build`:
 *
 *   1. `useState is not defined` in `TeacherDashboard` — the page relies on the
 *      automatic JSX runtime, so it has no `import React` line, and a hook added
 *      to it had no import either.
 *   2. `checkNow is not defined` in the join-school page — a handler referenced by
 *      a button had been removed in a refactor.
 *   3. `m is not defined` in a test — a bracket access mangled by an edit.
 *
 * `vite build` catches none of them: esbuild parses each module in isolation and
 * never resolves the scope of a call it does not recognise, so an undefined
 * identifier ships as JavaScript that works until that line executes. ESLint's
 * `no-undef` would catch them — and `eslint` is not installed in this working
 * copy — so this is the substitute.
 *
 * Scope is deliberately the hooks, not all identifiers. A general scope checker
 * is a compiler; the hooks have one property that makes them checkable — they
 * are a fixed, small, closed set, and every use must come from an import.
 */

const HOOKS = [
  'useState',
  'useEffect',
  'useRef',
  'useCallback',
  'useMemo',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useId',
  'useSyncExternalStore',
];

/** Every `.jsx`/`.js` under a directory, recursively. */
const sourceFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.smoke') continue;
      files.push(...(await sourceFiles(path)));
    } else if (['.js', '.jsx'].includes(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
};

/**
 * Every import statement in a file, as one string.
 *
 * Matched as whole statements rather than line by line, because this codebase
 * writes `import React, { useCallback, useEffect, ... } from 'react'` across
 * seven lines — and the named bindings sit on their own lines, where neither
 * `import` nor `from` appears. A line-based filter sees those lines and sees
 * nothing, which made the first version of this test report
 * `AdvertisementsHub.jsx` as missing five hooks it imports on line 2.
 */
const importsOf = (text) =>
  (text.match(/^\s*import\b[\s\S]*?from\s+['"][^'"]+['"];?/gm) || []).join('\n');

describe('every React hook a file uses is imported into that file', () => {
  it('covers the whole source tree', async () => {
    // This test lives in `src/utils/`, so `../` is `src/` — not `../src`, which
    // would double the segment and read `src/src`.
    const srcDir = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const files = await sourceFiles(srcDir);
    const offenders = [];

    for (const file of files) {
      const text = await readFile(file, 'utf8');
      const imports = importsOf(text);

      for (const hook of HOOKS) {
        // Used as a call, `Foo(` — not as a property (`React.useState(`) and
        // not inside a word.
        const usesHook = new RegExp(`(?<![\\w.])${hook}\\s*\\(`).test(text);
        if (!usesHook) continue;

        // Imported either by name (`{ useState }`) or as a namespace member
        // (`React.useState`), which the usage regex above already excludes.
        const imported =
          new RegExp(`(?<![\\w.])${hook}(?![\\w])`).test(imports) ||
          new RegExp(`\\*\\s+as\\s+\\w+[\\s\\S]{0,200}from\\s+['"]react['"]`).test(imports);

        if (!imported) {
          offenders.push(`${file.replace(/.*[\\/]src[\\/]/, 'src/')}: ${hook}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'these hooks are used but not imported — the page will throw at runtime, and the build will pass'
    );
  });
});
