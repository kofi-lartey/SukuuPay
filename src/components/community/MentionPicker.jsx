import React, { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '../common/Avatar';

/**
 * The `@` picker for a composer.
 *
 * ## Why it is driven by the caret, not the whole value
 *
 * Typing `@kw` in the middle of a sentence must offer *Kwame*, not treat the whole
 * message as a query. So the token is read backwards from the caret to the nearest
 * whitespace, and only that fragment is matched.
 *
 * ## Why the list is filtered client-side
 *
 * The member list is already loaded for the header count, and a club is tens of
 * people, not thousands. A request per keystroke would add latency to the one
 * interaction that has to feel instant.
 *
 * ## Why the inserted text is `@First Name`
 *
 * The message stores `mentions: [{ userId, name }]` separately from the text, so the
 * visible token only has to be readable. Using the first name keeps the sentence
 * looking like a sentence â€” "@Kwame can you bring the ball" rather than
 * "@Kwame Mensah can you bring the ball".
 */

const TOKEN = /(?:^|\s)@([\w]*)$/;

/**
 * @param {string} value current text
 * @param {number} caret position in the text
 */
export const mentionQueryAt = (value, caret) => {
  const upto = value.slice(0, caret ?? value.length);
  const match = upto.match(TOKEN);
  if (!match) return null;
  return { query: match[1], start: match.index + (match[0].startsWith('@') ? 0 : 1) };
};

const MentionPicker = ({ members, value, caret, onPick, onClose }) => {
  const [active, setActive] = useState(0);
  const wrapper = useRef(null);

  const token = mentionQueryAt(value, caret);
  const query = (token?.query || '').toLowerCase();

  const matches = useMemo(() => {
    if (!token) return [];
    // Every member is mentionable - a teacher in the club should be nameable -
    // with students first, because the chat is a student space and the list is
    // what the eye scans first.
    const pool = [...members].sort((a, b) => {
      if (a.role === b.role) return 0;
      return a.role === 'student' ? -1 : 1;
    });
    if (!query) return pool.slice(0, 8);
    return pool
      .filter((m) => (m.fullName || m.name || '').toLowerCase().includes(query))
      .slice(0, 8);
  }, [members, query, token]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!token) return undefined;

    const onDocDown = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) onClose?.();
    };

    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [token, onClose]);

  if (!token || matches.length === 0) return null;

  const choose = (member) => {
    onPick?.({
      // Replace the `@fragment` with the full display token, keeping the trailing
      // space so typing continues the sentence.
      start: token.start,
      end: caret ?? value.length,
      insert: `@${member.name} `,
      member,
    });
  };

  return (
    <div
      ref={wrapper}
      role="listbox"
      aria-label="Mention a student"
      className="absolute bottom-full left-0 z-30 mb-1 max-h-56 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
    >
      <p className="px-2 py-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
        Mention someone
      </p>

      {matches.map((member, index) => (
        <button
          key={member._id}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseEnter={() => setActive(index)}
          onClick={() => choose(member)}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
            index === active ? 'bg-teal-50' : 'hover:bg-slate-100'
          }`}
        >
          <Avatar name={member.name} src={member.avatar} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
            {member.name}
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * Wires the picker to a textarea: exposes the key handling the textarea needs.
 * Kept separate so the same behaviour can be attached to either composer without
 * either one owning the logic.
 */
export const useMentionPicker = ({ members, onInsert }) => {
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState(0);

  const onKeyDown = (event) => {
    if (!open) return;
    // The list is short; arrow keys are a nicety, not a requirement. Escape and
    // Enter-to-send still work because the textarea owns Enter.
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return {
    open,
    setOpen,
    caret,
    setCaret,
    onKeyDown,
    onPick: (selection) => {
      onInsert?.(selection);
      setOpen(false);
    },
  };
};

export default MentionPicker;
