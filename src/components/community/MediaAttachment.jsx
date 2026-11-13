import React, { useState } from 'react';
import { FileText, Download, Maximize2 } from 'lucide-react';
import MediaViewer from './MediaViewer';

/**
 * Renders one `media[]` entry — an image, a video, an audio note, or a file.
 *
 * Shared by the thread and the club chat so an attachment looks the same wherever
 * it lands. The `kind` is derived from the MIME type rather than trusted from the
 * client, because `mimeType` on the wire is whatever the uploader wrote.
 *
 * ## Tapping opens the in-app viewer
 *
 * This used to be an `<a target="_blank">`, so a photo left the app and a PDF went
 * to the browser's own viewer — with its download button and no way to get back to
 * the conversation. It is a button now: the media opens in `MediaViewer`, the post
 * stays behind it, and Escape closes it.
 *
 * ## `fullBleed`
 *
 * In a post card the media sits in a padded column, so a fixed-height image stops
 * short of the column edge and leaves a band of white before the divider — which
 * reads as a gap in the layout rather than as padding. `fullBleed` lets the image
 * span the whole column and meet the divider, with the card's own negative margin
 * supplying the bleed. Used only where the post and its discussion sit side by
 * side; a stacked card keeps the rounded inset.
 */

const kindFor = (mime) => {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
};

const formatBytes = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const mediaClass = (compact, fullBleed) => {
  if (fullBleed) return 'aspect-[4/5] max-h-[22rem] w-full rounded-none object-cover';
  return compact ? 'max-h-40 rounded-lg' : 'max-h-60 rounded-xl';
};

const MediaAttachment = ({ media, compact = false, fullBleed = false }) => {
  const [open, setOpen] = useState(false);

  if (!media?.url) return null;

  const kind = kindFor(media.mimeType);
  const name = media.originalName || 'Attachment';
  const size = formatBytes(media.bytes);

  // Audio has no meaningful full-size view; the inline player is the whole UI.
  if (kind === 'audio') {
    return (
      <div className={fullBleed ? '' : 'rounded-lg border border-slate-200 bg-white p-2'}>
        <audio src={media.url} controls className="w-full max-w-xs" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${name}`}
        className="group relative block w-full overflow-hidden rounded-lg text-left"
      >
        {kind === 'image' && (
          <img
            src={media.url}
            alt={name}
            loading="lazy"
            className={mediaClass(compact, fullBleed)}
          />
        )}

        {kind === 'video' && (
          <video
            src={media.url}
            playsInline
            preload="metadata"
            className={mediaClass(compact, fullBleed)}
          />
        )}

        {kind === 'file' && (
          <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 transition-colors group-hover:border-teal-300">
            <FileText className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-bold text-ink">{name}</span>
              {size && <span className="block text-[10px] text-slate-400">{size}</span>}
            </span>
            <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </span>
        )}

        {/* Affordance: a still image gives no hint that it opens. */}
        {kind !== 'file' && (
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-3 w-3" />
          </span>
        )}
      </button>

      <MediaViewer media={media} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default MediaAttachment;