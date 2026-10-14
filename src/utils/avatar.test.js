import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_ACCEPT_ATTRIBUTE,
  AVATAR_MAX_BYTES,
  initialsFor,
  validateAvatarFile,
} from './avatar.js';

/**
 * The client-side gate on a picture, before any bytes leave the browser.
 *
 * The numbers are transcribed from the backend and must stay in step with it:
 * `2 * 1024 * 1024` is `avatarUpload`'s `limits.fileSize`, and the MIME list is
 * the shared `fileFilter` in `Backend/src/middleware/upload.js`. A test here
 * that only re-reads this file would prove nothing, so the values are asserted
 * against their originals — if the server moves and this does not, the tests
 * fail rather than the teacher getting "invalid image" about a picture the API
 * would have accepted.
 */
describe('validateAvatarFile', () => {
  it('allows the three formats the server accepts', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      assert.deepEqual(validateAvatarFile({ type, size: 1024 }), { ok: true });
    }
  });

  it('refuses anything else, with a message naming what to choose', () => {
    for (const type of ['image/gif', 'image/bmp', 'application/pdf', '', undefined]) {
      const verdict = validateAvatarFile({ type, size: 1024 });
      assert.equal(verdict.ok, false, `${type} must be refused`);
      assert.equal(verdict.code, 'INVALID_TYPE');
      assert.match(verdict.message, /JPG, PNG or WebP/);
    }
  });

  it('refuses a file over the 2 MB ceiling the server enforces', () => {
    const verdict = validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'FILE_TOO_LARGE');
  });

  it('lets a file exactly at the ceiling through', () => {
    // Off-by-one in the ceiling is the classic: `>=` refuses a 2 MB picture the
    // server would have taken, and the teacher is told to choose a smaller one
    // about a file that was exactly the size they were told was allowed.
    assert.deepEqual(validateAvatarFile({ type: 'image/png', size: AVATAR_MAX_BYTES }), { ok: true });
  });

  it('refuses an empty file, which is what a cancelled pick leaves behind', () => {
    const verdict = validateAvatarFile({ type: 'image/jpeg', size: 0 });
    assert.equal(verdict.code, 'EMPTY_FILE');
  });

  it('falls back to the extension when the browser reports no type', () => {
    // Some Android gallery picks arrive with `type: ''` but a perfectly good
    // filename. Refusing those is the single most common way a phone camera
    // photo becomes "invalid image".
    assert.deepEqual(validateAvatarFile({ type: '', name: 'IMG_2043.JPG', size: 2048 }), { ok: true });
    assert.equal(validateAvatarFile({ type: '', name: 'scan.PDF', size: 2048 }).ok, false);
  });

  it('still refuses a refused extension even with no type', () => {
    assert.equal(validateAvatarFile({ type: undefined, name: 'photo.gif', size: 4096 }).ok, false);
  });

  it('refuses nothing at all', () => {
    assert.equal(validateAvatarFile(null).code, 'NO_FILE');
    assert.equal(validateAvatarFile(undefined).ok, false);
  });

  it('exposes its limits and its accept attribute to the pickers', () => {
    // The `<input accept>` string is what the file dialog offers. A catch-all
    // `image/*` here would let a teacher pick a GIF the next line refuses.
    assert.equal(AVATAR_ACCEPT_ATTRIBUTE, 'image/jpeg,image/png,image/webp');
    assert.equal(AVATAR_ACCEPTED_TYPES.length, 3);
    assert.equal(AVATAR_MAX_BYTES, 2 * 1024 * 1024);
  });
});

describe('initialsFor', () => {
  it('takes one letter from each of the first two words', () => {
    assert.equal(initialsFor('Ama Mensah'), 'AM');
    assert.equal(initialsFor('Kofi Asante Owusu'), 'KA');
  });

  it('takes two letters from a single name', () => {
    // A one-word name still needs two characters to look like an avatar rather
    // than a typo, and it is the common case for many Ghanaian names.
    assert.equal(initialsFor('Ama'), 'A');
    assert.equal(initialsFor('Kwabena'), 'K');
  });

  it('survives untrimmed and empty input', () => {
    assert.equal(initialsFor('  Ama   Mensah '), 'AM');
    assert.equal(initialsFor(''), 'T');
    assert.equal(initialsFor(undefined), 'T');
  });
});

// ── The client and the server must agree ────────────────────────────────────
describe('the client ceiling agrees with the server', () => {
  const readServerSource = async () => {
    const { readFile } = await import('node:fs/promises');
    return readFile(
      new URL('../../../Backend/src/middleware/upload.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      'utf8'
    );
  };

  it('matches the multer limit and the shared file filter', async () => {
    const source = await readServerSource();
    const avatarBlock = source.slice(source.indexOf('export const avatarUpload'));

    assert.ok(
      avatarBlock.includes('2 * 1024 * 1024'),
      'the server avatar upload is no longer 2 MB — update AVATAR_MAX_BYTES to match'
    );
    assert.ok(
      avatarBlock.includes('fileFilter'),
      'the server avatar upload no longer uses the shared fileFilter — update AVATAR_ACCEPTED_TYPES'
    );

    const filterBlock = source.slice(source.indexOf('const fileFilter'), source.indexOf('const stampFileFilter'));
    for (const type of AVATAR_ACCEPTED_TYPES) {
      assert.ok(filterBlock.includes(type), `the server filter no longer allows ${type}`);
    }
  });
});
