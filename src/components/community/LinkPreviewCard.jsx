import React from 'react';
import { Link2 } from 'lucide-react';

/**
 * The card shown for a link in a message, and for a link in the composer before
 * it is sent.
 *
 * Two states, one component:
 *
 *  - **Stored** (`preview` came from the message) — rendered inside the bubble,
 *    `compact`, non-interactive beyond the link.
 *  - **Pending** (`onRemove` supplied) — rendered above the input while typing,
 *    with a remove button, because at that point it is a draft the user can still
 *    change their mind about.
 *
 * ## Why the image is optional and the title is not
 *
 * Plenty of pages serve no `og:image`, and a card that collapses when one is
 * missing looks broken. The title and the hostname are always available — the
 * title from `<title>`, the hostname from the URL — so the card always renders
 * something.
 *
 * `loading="lazy"` and a fixed aspect box: a preview that reflows the transcript
 * when its image finally arrives is the one thing worse than no image.
 */
const LinkPreviewCard = ({ preview, compact = false, onRemove }) => {
  if (!preview?.url) return null;

  return (
    <div
      className={`relative flex gap-2 overflow-hidden rounded-lg border border-slate-200 bg-white ${
        compact ? 'p-1.5' : 'p-2'
      }`}
    >
      {preview.imageUrl && (
        <div
          className={`shrink-0 overflow-hidden rounded bg-slate-100 ${
            compact ? 'h-11 w-11' : 'h-16 w-16'
          }`}
        >
          <img
            src={preview.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              // A dead image URL would otherwise leave a grey box.
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-extrabold text-ink ${compact ? 'text-[11px]' : 'text-[12.5px]'}`}
        >
          {preview.title || preview.url}
        </p>

        {preview.description && !compact && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
            {preview.description}
          </p>
        )}

        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-400">
          <Link2 className="h-2.5 w-2.5 shrink-0" />
          {preview.siteName || preview.url}
        </p>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove link preview"
          className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default LinkPreviewCard;