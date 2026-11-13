import React from 'react';
import { FileText, Download } from 'lucide-react';

/**
 * Renders one `media[]` entry — an image, a video, an audio note, or a file.
 *
 * Shared by the thread and the club chat so an attachment looks the same wherever
 * it lands. The `kind` is derived from the MIME type rather than trusted from the
 * client, because `mimeType` on the wire is whatever the uploader wrote.
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

const MediaAttachment = ({ media, compact = false }) => {
  if (!media?.url) return null;

  const kind = kindFor(media.mimeType);
  const name = media.originalName || 'Attachment';
  const size = formatBytes(media.bytes);

  if (kind === 'image') {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={media.url}
          alt={name}
          loading="lazy"
          className={compact ? 'max-h-40 rounded-lg' : 'max-h-60 rounded-xl'}
        />
      </a>
    );
  }

  if (kind === 'video') {
    return (
      <video
        src={media.url}
        controls
        playsInline
        className={compact ? 'max-h-40 rounded-lg' : 'max-h-60 rounded-xl'}
      />
    );
  }

  if (kind === 'audio') {
    return <audio src={media.url} controls className="w-full max-w-xs" />;
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 hover:border-teal-300"
    >
      <FileText className="h-4 w-4 shrink-0 text-teal-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold text-ink">{name}</span>
        {size && <span className="block text-[10px] text-slate-400">{size}</span>}
      </span>
      <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </a>
  );
};

export default MediaAttachment;