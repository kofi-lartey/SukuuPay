// Run with `npm test` from `frontend/`, on `node --test`.
//
// This file asserts a rule about **source text**, not about behaviour, and that is
// deliberate: the failure it guards against is one that no unit test of the code paths
// would catch, because the code is correct and the transport is wrong.
//
// A multipart body needs `Content-Type: multipart/form-data` **with a boundary
// parameter**, and the boundary is generated while the body is encoded. Nobody can
// hand-write a correct one. Both wrong answers look reasonable and both break:
//
//   - `headers: { 'Content-Type': 'multipart/form-data' }` goes out with no boundary.
//     Busboy rejects the whole body (`Multipart: Boundary not found`), every field is
//     dropped and `req.file` is never set. It only ever worked because axios deletes
//     the header for a `FormData` body in a browser — correct by accident of an axios
//     internal, not by construction.
//   - Setting no header at all inherits the `application/json` instance default in
//     `services/api.js`, and axios's `transformRequest` then does
//     `JSON.stringify(formDataToJSON(data))`: the request leaves as `{"image":{}}` and
//     the file is gone before it leaves the browser.
//
// Both were live in this repository. `createAdRequest` sent school ad requests as
// `{"image":{}}`, so a school's uploaded creative never reached the server as a file.
// `upload.js`, `settings.js` and `students.js` all hand-wrote a boundary-less header.
//
// The fix is one line in `services/api.js` — delete the header for a `FormData` body —
// plus removing the four hand-written headers. These tests hold both halves shut: the
// central rule stays in place, and no call site reintroduces the mistake it replaces.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

/**
 * Source with comments removed.
 *
 * These are assertions about source text, and this repository's source text is mostly
 * prose about the bugs being fixed — including the exact string
 * `'Content-Type': 'multipart/form-data'`, quoted in `services/admin.js` as the thing
 * not to do. A scanner that cannot tell a comment from code reports the explanation as
 * the offence. Comments are stripped before matching so only executable code is judged.
 */
const readCode = (relative) =>
  read(relative)
    // Block comments, including the JSDoc headers these files carry most of their
    // reasoning in. The `/*` inside a regex or string is not a concern here: these
    // files are line-oriented prose, and the alternative is a real parser.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Line comments. A `//` inside a URL string would truncate the rest of that line,
    // which only ever removes code from consideration and cannot invent any.
    .replace(/^[ \t]*\/\/.*$/gm, '');

/** Every service and page that sends a body the server parses with multer. */
const MULTIPART_CALL_SITES = [
  '../services/adRequests.js',
  '../services/admin.js',
  '../services/upload.js',
  '../services/settings.js',
  '../services/students.js',
  '../services/parentPay.js',
  '../pages/admin/AdminAdCreate.jsx',
];

describe('multipart requests', () => {
  test('services/api.js removes the Content-Type from any FormData body', () => {
    // The central rule. If this is deleted the two tests below stop being sufficient,
    // because every call site would go back to inheriting `application/json`.
    assert.match(
      readCode('../services/api.js'),
      /config\.data instanceof FormData/,
      'the request interceptor must special-case a FormData body'
    );
    assert.match(
      readCode('../services/api.js'),
      /config\.headers\.delete\(['"]Content-Type['"]\)/,
      'the interceptor must delete Content-Type so axios can set multipart with a boundary'
    );
  });

  test('the instance default is still JSON, which is why the rule above is needed', () => {
    // Documents the hazard rather than the fix. If this ever changes, the interceptor's
    // deletion becomes unnecessary but harmless — and this test says which of the two
    // worlds we are in, so the next reader is not left guessing.
    assert.match(readCode('../services/api.js'), /'Content-Type':\s*'application\/json'/);
  });

  test('no call site hand-writes a multipart Content-Type', () => {
    // A hand-written multipart header is *always* wrong, whatever axios happens to do
    // with it. Left in place it is a trap for the next person who reads it as the
    // documented way to upload a file.
    for (const file of MULTIPART_CALL_SITES) {
      assert.doesNotMatch(
        readCode(file),
        /['"]Content-Type['"]\s*:\s*['"]multipart\/form-data['"]/,
        `${file} must not set Content-Type: multipart/form-data — a boundary is required and cannot be hand-written`
      );
    }
  });

  test('every appended file carries a filename', () => {
    // `FormData.append(name, file)` derives the filename from the `File`, which works
    // in every current browser — but a part with no filename is a *field* to multer
    // rather than a file, so `req.file` stays undefined and the server reports a
    // missing image about an image the operator can see attached. Stating it costs
    // nothing and removes the dependency on that default.
    //
    // Matched on the call *closing* right after the file argument: that is the shape
    // with no third argument, and it cannot be confused with `append(x, file, f.name)`
    // the way a bare "does this mention file" test could.
    const offenders = MULTIPART_CALL_SITES.filter((file) =>
      /\.append\(\s*['"][\w-]+['"]\s*,\s*[\w.]*file\s*\)/.test(readCode(file))
    );

    assert.deepEqual(offenders, [], `these append a file without a filename: ${offenders.join(', ')}`);
  });
});

describe('the axios behaviour this relies on', () => {
  // The source assertions above check that *we* delete the header. These check that
  // deleting it actually does what the fix assumes — so an axios upgrade that changes
  // the rule is caught here rather than as a "Boundary not found" in production.
  //
  // Real axios, a real `FormData`, and a stub adapter that captures the config without
  // sending anything. `platform.hasStandardBrowserEnv` is forced before import, because
  // that branch is what clears the header for a FormData body and it is decided at
  // module load.
  test('a FormData survives transformRequest when no Content-Type is set', async () => {
    globalThis.window = globalThis.window || { location: { href: '' } };
    globalThis.document = globalThis.document || { createElement: () => ({}) };

    const { default: axios } = await import('axios');

    const client = axios.create({ headers: { 'Content-Type': 'application/json' } });
    const captured = [];
    client.defaults.adapter = (config) => {
      captured.push(config);
      return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
    };

    const withJsonDefault = new FormData();
    withJsonDefault.append('headline', 'x');
    withJsonDefault.append('image', new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), 'a.jpg');
    await client.post('/x', withJsonDefault);

    const afterDefault = captured[0];
    assert.equal(
      afterDefault.data instanceof FormData,
      false,
      'with application/json still in place axios serialises the FormData to JSON — this is the bug createAdRequest had'
    );
    assert.match(String(afterDefault.data), /"image":\{\}/, 'the file collapses to an empty object');

    // The same request once the header is gone — what the interceptor produces.
    const neutralised = new FormData();
    neutralised.append('headline', 'x');
    neutralised.append('image', new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), 'a.jpg');
    await client.post('/x', neutralised, { headers: { 'Content-Type': undefined } });

    const afterFix = captured[1];
    assert.equal(
      afterFix.data instanceof FormData,
      true,
      'with no Content-Type the FormData must pass through untouched'
    );
    assert.deepEqual(
      [...afterFix.data.keys()],
      ['headline', 'image'],
      'and both parts must survive, the file among them'
    );
  });
});

describe('multer field names', () => {
  test('each upload names the field its route is mounted for', () => {
    // `.single("<field>")` is what decides whether a part is a file at all, and a
    // mismatch produces no error from multer — just a silently absent `req.file`.
    // Asserted against `middleware/upload.js`, which is where every `.single()` call in
    // the product lives: the routers reference the built middleware by name.
    const middleware = readCode('../../../Backend/src/middleware/upload.js');

    for (const field of ['file', 'image', 'logo', 'stamp', 'audio']) {
      assert.match(
        middleware,
        new RegExp(`\\.single\\(["']${field}["']\\)`),
        `no upload is mounted for the "${field}" field`
      );
    }

    // The router wires the middleware the field names above imply.
    const uploadRoutes = readCode('../../../Backend/src/routes/upload.routes.js');
    assert.match(uploadRoutes, /student-photo[\s\S]*?studentPhotoUpload/);
    assert.match(uploadRoutes, /school-logo[\s\S]*?schoolLogoUpload/);

    const adminRoutes = readCode('../../../Backend/src/routes/admin.routes.js');
    assert.match(
      adminRoutes,
      /'\/school-ads',\s*\n?\s*uploadSchoolAd/,
      'POST /admin/school-ads must run the ad upload middleware'
    );

    const schoolAdRoutes = readCode('../../../Backend/src/routes/schoolAd.routes.js');
    assert.match(
      schoolAdRoutes,
      /"\/schools\/me\/ad-requests",[\s\S]*?uploadSchoolAd/,
      'POST /schools/me/ad-requests must run the ad upload middleware'
    );
    assert.match(
      readCode('../../../Backend/src/routes/payment.routes.js'),
      /notify-school[\s\S]*?uploadParentAudioRoute/,
      'POST /pay/:token/notify-school must run the audio upload middleware'
    );

    // And the client sends what those field names require.
    const settings = readCode('../services/settings.js');
    assert.match(settings, /\.append\('logo', file/, 'the logo part must use the logo field');
    assert.match(settings, /\.append\('stamp', file/, 'the seal part must use the stamp field');

    // `upload.js` posts both its routes under "file", which is what `schoolLogoUpload`
    // and `studentPhotoUpload` are mounted for.
    const upload = readCode('../services/upload.js');
    assert.doesNotMatch(
      upload,
      /asMultipart\([^)]*'(?!file)[\w-]+'/,
      'services/upload.js posts under the "file" field for both of its routes'
    );
  });
});