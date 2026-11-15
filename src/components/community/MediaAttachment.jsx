import React, { useState } from 'react';
import { FileText, Download, Maximize2 } from 'lucide-react';
import MediaViewer from './MediaViewer';
import WaveformPlayer from './WaveformPlayer';

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
 *
 * ## `mine`
 *
 * Tones the audio player for the sender's side of a chat. A teal bubble swallows a
 * slate-and-teal player whole, so the waveform inverts to white-on-teal and the
 * speed pills follow. Only the audio branch reads it; images and files sit on a
 * white card regardless of who sent them.
 */

const kindFor = (mime, url) => {
  if (!mime && !url) return 'file';
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('audio/')) return 'audio';
  // Cloudinary sniffs M4A/WebM audio as `video/mp4`/`video/webm` (the container
  // is video; only the track differs). Use the URL extension to tell audio
  // apart from video when the MIME type says video but the file is audio-only.
  if (mime?.startsWith('video/') && url) {
    try {
      const ext = new URL(url).pathname.toLowerCase();
      const dot = ext.lastIndexOf('.');
      const extension = dot === -1 ? '' : ext.slice(dot + 1);
      if (/^(m4a|mp3|wav|ogg|aac|weba|opus|webm)$/i.test(extension)) return 'audio';
      if (/^(mp4|mov|avi|mkv)$/i.test(extension)) return 'video';
    } catch {}
    return 'video';
  }
  // MIME on the wire is whatever the uploader wrote; fall back to the file
  // extension so an audio/video upload still renders as a player instead of a
  // generic file card when the MIME type is missing or generic.
  if (url) {
    try {
      const ext = new URL(url).pathname.toLowerCase();
      const dot = ext.lastIndexOf('.');
      const extension = dot === -1 ? '' : ext.slice(dot + 1);
      if (/^(mp3|wav|m4a|aac|ogg|weba|opus|webm)$/i.test(extension)) return 'audio';
      if (/^(mp4|webm|mov|avi|mkv)$/i.test(extension)) return 'video';
      if (/^(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(extension)) return 'image';
    } catch {}
  }
  return 'file';
};

const formatBytes = (bytes) => {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * A media entry usually carries a `url`, but a `publicId` alone is enough to
 * rebuild a Cloudinary delivery URL. Deriving it means an entry that lost its
 * `url` in transit still renders instead of collapsing to an empty block.
 */
const cloudinaryUrl = (publicId) => {
  const cloud = import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME;
  if (!publicId || !cloud) return null;
  return `https://res.cloudinary.com/${cloud}/video/upload/${publicId}.m4a`;
};

const mediaClass = (compact, fullBleed) => {
  if (fullBleed) return 'aspect-[4/5] max-h-[22rem] w-full rounded-none object-cover';
  return compact ? 'max-h-40 rounded-lg' : 'max-h-60 rounded-xl';
};

const MediaAttachment = ({ media, compact = false, fullBleed = false, mine = false }) => {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  // A media entry with neither a `url` nor a `publicId` is unusable — but rather
  // than silently returning null (which left the bubble as an empty coloured block
  // with only the timestamp), render a visible fallback so the message still reads.
  const url = media?.url || (media?.publicId ? cloudinaryUrl(media.publicId) : null);
  if (!url) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-400">
        Attachment unavailable
      </div>
    );
  }

  const kind = kindFor(media.mimeType, media?.url);
  const name = media.originalName || 'Attachment';
  const size = formatBytes(media.bytes);

  // Audio has no meaningful full-size view; the inline player is the whole UI.
  // `publicId` seeds the placeholder waveform; `durationSeconds` seeds the label
  // before the file is fetched, so the length reads before the first play.
  if (kind === 'audio') {
    if (failed) {
      // The custom player could not bind — fall back to the native element rather
      // than leaving a blank box.
      return (
        <div className={fullBleed ? 'min-w-0' : 'min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2'}>
          <audio src={url} controls preload="metadata" className="h-9 w-full">
            <a href={url} download={name}>Download the voice note</a>
          </audio>
        </div>
      );
    }
    return (
      // On the sender's teal bubble the player sits directly on the bubble — a
      // white wrapper would invert the `mine` tones into white-on-white. On
      // anyone else's bubble it gets a white card so the slate bars read.
      <div
        className={
          fullBleed
            ? 'min-w-0'
            : mine
              ? 'min-w-0'
              : 'min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2'
        }
      >
        <WaveformPlayer
          src={url}
          seed={media.publicId || url}
          durationHint={media.durationSeconds}
          mine={mine}
          onError={() => setFailed(true)}
        />
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
            src={url}
            alt={name}
            loading="lazy"
            className={mediaClass(compact, fullBleed)}
          />
        )}

        {kind === 'video' && (
          <video
            src={url}
            controls
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

      <MediaViewer media={{ ...media, url }} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default MediaAttachment;