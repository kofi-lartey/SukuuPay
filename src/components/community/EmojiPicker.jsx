import React, { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';

/**
 * A small curated emoji set, grouped the way people actually reach for them.
 *
 * Deliberately not a dependency: an emoji-mart or emoji-picker-react bundle is
 * larger than the rest of this component tree, ships its own i18n and its own
 * theming, and every emoji it offers has to be weighed against the fact that this
 * is a school product. The set below covers the reactions that show up in a class
 * chat — acknowledgement, agreement, celebration, sympathy — without a 200 kB
 * payload to do it.
 *
 * Inserted at the caret rather than appended, so a reply that is being edited does
 * not have its emoji thrown to the end.
 */
const EMOJI_GROUPS = [
  {
    label: 'Smileys',
    emoji: ['😀', '😄', '😁', '😂', '🙂', '😉', '😍', '🤔', '😅', '😢', '😡', '👍'],
  },
  {
    label: 'Gestures',
    emoji: ['👏', '🙏', '💪', '👌', '✌️', '🤝', '👋', '🫡'],
  },
  {
    label: 'School',
    emoji: ['📚', '✏️', '📝', '🎓', '🏫', '📌', '📎', '📅', '⏰', '✅', '❌', '⭐'],
  },
  {
    label: 'Symbols',
    emoji: ['❤️', '🔥', '🎉', '💯', '❗', '❓', '➡️', '🔔'],
  },
];

const EmojiPicker = ({ onPick, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add emoji"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
      >
        <Smile className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-20 mb-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-1.5 last:mb-0">
              <p className="px-1 pb-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emoji.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      onPick(e);
                      setOpen(false);
                    }}
                    className="rounded p-1 text-[15px] leading-none hover:bg-slate-100"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Inserts text at the caret of an input or textarea, preserving focus and the
 * selection so a second emoji lands after the first rather than at the start.
 */
export const insertAtCaret = (element, text) => {
  if (!element) return text;

  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? element.value.length;
  const next = `${element.value.slice(0, start)}${text}${element.value.slice(end)}`;

  // Restore the caret after React re-renders the controlled value.
  requestAnimationFrame(() => {
    const caret = start + text.length;
    element.focus();
    element.setSelectionRange(caret, caret);
  });

  return next;
};

export default EmojiPicker;