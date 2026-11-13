import React from 'react';
import { Download, FileText } from 'lucide-react';
import Modal from '../common/Modal';

/**
 * Full-size in-app viewer for an attachment.
 *
 * ## Why a modal and not a new tab
 *
 * `MediaAttachment` used to render an `<a target="_blank">`, so opening a file
 * left the app — and for a PDF the browser's own viewer decided the experience,
 * with a download button, no back-affordance, and no way to keep the conversation
 * beside it. The viewer keeps the post in place behind a scrim, closes on Escape
 * or a backdrop click, and holds the whole file at the largest size the viewport
 * allows.
 *
 * ## Why it reuses `Modal`
 *
 * `Modal` already owns the portal, the scroll lock, the Escape handler, the focus
 * placement and the backdrop. A media viewer that reimplemented those would be a
 * second place for the same accessibility bugs to live. `hideTitle` gives the
 * chrome-less presentation a photo wants while keeping the tree shape stable.
 *
 * ## PDF
 *
 * Rendered in an `<iframe>` rather than a `<object>`: Cloudinary serves the file
 * inline, and a frame is the one container every browser paints without a plugin.
 * If a browser still refuses, the download link in the header remains the fallback
 * rather than a blank panel.
 */

const kindFor = (mime) => {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'file';
};

const MediaViewer = ({ media, open, onClose }) => {
  if (!media?.url) return null;

  const kind = kindFor(media.mimeType);
  const name = media.originalName || 'Attachment';

  return (
    <Modal open={open} onClose={onClose} hideTitle size="xl" title={name}>
      <div className="-mx-5 -my-5 sm:-mx-6 sm:-my-5">
        {/* Caption bar: filename and the download fallback, over the media. */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-teal-600" />
          <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">{name}</p>
          <a
            href={media.url}
            download={name}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-teal-600"
            aria-label="Download instead"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>

        <div className="flex max-h-[78vh] items-center justify-center overflow-auto bg-slate-900/95 p-3">
          {kind === 'image' && (
            <img
              src={media.url}
              alt={name}
              className="max-h-[74vh] w-auto max-w-full object-contain"
            />
          )}

          {kind === 'video' && (
            <video
              src={media.url}
              controls
              autoPlay
              playsInline
              className="max-h-[74vh] w-full"
            />
          )}

          {kind === 'audio' && (
            <div className="w-full max-w-md rounded-xl bg-white p-4">
              <audio src={media.url} controls autoPlay className="w-full" />
            </div>
          )}

          {kind === 'pdf' && (
            <iframe
              src={media.url}
              title={name}
              className="h-[74vh] w-full rounded-lg bg-white"
            />
          )}

          {kind === 'file' && (
            <div className="w-full max-w-md rounded-xl bg-white p-6 text-center">
              <FileText className="mx-auto h-8 w-8 text-teal-600" />
              <p className="mt-2 text-[13px] font-bold text-ink">{name}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                This file type cannot be previewed in the browser.
              </p>
              <a
                href={media.url}
                download={name}
                className="mt-3 inline-block rounded-lg bg-teal-600 px-3 py-1.5 text-[12px] font-bold text-white"
              >
                Download the file
              </a>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MediaViewer;