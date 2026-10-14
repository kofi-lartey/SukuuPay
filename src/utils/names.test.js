import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { firstNameOf, initialsOf } from './names.js';

/**
 * Names, and the honorific that is not part of one.
 *
 * The bug this module exists for: the dashboard greated "Good afternoon, **Sir**"
 * for a teacher whose name is stored "Sir Ciblah", because the greeting took the
 * first whitespace-separated token. In a Ghanaian school register "Sir X" and
 * "Madam Y" are the normal way a name is written down — the honorific and the
 * name in one field — so the first token is usually a title, not a person.
 *
 * Everything else in the app renders the whole string, and should: only a
 * greeting addressing somebody by a single name has this problem.
 */
describe('firstNameOf', () => {
  it('skips a leading honorific', () => {
    assert.equal(firstNameOf('Sir Ciblah'), 'Ciblah');
    assert.equal(firstNameOf('Madam Ama Mensah'), 'Ama');
    assert.equal(firstNameOf('Mr Kofi Asante'), 'Kofi');
    assert.equal(firstNameOf('Dr Owusu'), 'Owusu');
  });

  it('handles an honorific with a trailing dot', () => {
    assert.equal(firstNameOf('Dr. Ama'), 'Ama');
    assert.equal(firstNameOf('Prof. Mensah'), 'Mensah');
    assert.equal(firstNameOf('Mrs. Yeboah'), 'Yeboah');
  });

  it('is case-insensitive', () => {
    assert.equal(firstNameOf('SIR Ciblah'), 'Ciblah');
    assert.equal(firstNameOf('madam ama'), 'ama');
  });

  it('takes the first token of an ordinary name', () => {
    assert.equal(firstNameOf('Ama Mensah'), 'Ama');
    assert.equal(firstNameOf('Kwabena Osei'), 'Kwabena');
    assert.equal(firstNameOf('Ama'), 'Ama');
  });

  it('falls back to the whole string when every token is an honorific', () => {
    // A teacher recorded as just "Sir" must still be addressed, rather than
    // greeted with an empty name.
    assert.equal(firstNameOf('Sir'), 'Sir');
    assert.equal(firstNameOf('Dr'), 'Dr');
  });

  it('degrades to empty rather than throwing', () => {
    for (const bad of ['', '   ', null, undefined]) {
      assert.equal(firstNameOf(bad), '');
    }
  });

  it('skips an honorific only at the start, never inside a name', () => {
    // "Mister" is a name to some; "Nana Sir" would be odd, but a *surname* of
    // "Osei" must never be treated as a title.
    assert.equal(firstNameOf('Kofi Osei'), 'Kofi');
    assert.equal(firstNameOf('Ama Nana'), 'Ama');
  });
});

describe('initialsOf', () => {
  it('ignores a leading honorific', () => {
    // The avatar text for "Sir Ciblah" is "C" — the name. The old behaviour was
    // "SS": the honorific plus the name's first letter, which looks like a typo.
    // A teacher recorded with one name therefore gets one letter, which is all
    // there is to show; padding it out with the honorific would put the title
    // back into the two-letter slot this helper exists to keep it out of.
    assert.equal(initialsOf('Sir Ciblah'), 'C');
    assert.equal(initialsOf('Madam Ama Mensah'), 'AM');
    assert.equal(initialsOf('Dr. Kofi Asante'), 'KA');
  });

  it('takes at most two letters', () => {
    assert.equal(initialsOf('Ama Mensah Kofi'), 'AM');
    assert.equal(initialsOf('Kwabena'), 'K');
  });

  it('degrades to empty rather than throwing', () => {
    for (const bad of ['', null, undefined]) {
      assert.equal(initialsOf(bad), '');
    }
  });
});

// ── The two must agree with each other ──────────────────────────────────────
describe('the greeting and the avatar name the same person', () => {
  it('uses the same tokens for both', () => {
    // If these drift, the dashboard says "Good afternoon, Ciblah" above an
    // avatar reading "SS" — two different names for one person on one screen.
    for (const name of ['Sir Ciblah', 'Madam Ama Mensah', 'Ama Mensah', 'Dr. Kofi']) {
      const greetingName = firstNameOf(name);
      const avatar = initialsOf(name);
      assert.ok(
        avatar.startsWith(greetingName[0].toUpperCase()) || !greetingName,
        `${name}: greeting says "${greetingName}" but the avatar reads "${avatar}"`
      );
    }
  });
});
