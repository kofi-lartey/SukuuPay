import React from 'react';
import MediaAttachment from './MediaAttachment';
import LinkPreviewCard from './LinkPreviewCard';

/**
 * Derive media kind from a URL's file extension, so a link to an audio or
 * video file renders as a player instead of a preview card.
 */
const mediaKindForUrl = (url) => {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const dot = pathname.lastIndexOf('.');
    const ext = dot === -1 ? '' : pathname.slice(dot + 1);
    if (/^(mp3|wav|m4a|aac|ogg|weba|opus|webm)$/i.test(ext)) return 'audio';
    if (/^(mp4|mov|avi|mkv)$/i.test(ext)) return 'video';
    if (/^(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(ext)) return 'image';
  } catch {}
  return null;
};

/**
 * YouTube video id from youtu.be / youtube.com watch / shorts / embed / v URLs.
 */
const youtubeIdOf = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const match = u.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{6,})/);
      return match ? match[1] : null;
    }
  } catch {}
  return null;
};

/**
 * Renders a stored link preview. Audio/video file links open as inline players
 * (via MediaAttachment / WaveformPlayer), YouTube links embed inline, and
 * everything else keeps the rich preview card.
 */
const LinkOrMedia = ({ preview, mine = false }) => {
  if (!preview?.url) return null;

  const ytId = youtubeIdOf(preview.url);
  const kind = mediaKindForUrl(preview.url);

  if (ytId) {
    return (
      <div className="aspect-video rounded-lg bg-slate-200 overflow-hidden">
        <iframe
          src={`https://www.youtube.com/embed/${ytId}?modestbranding=1&rel=0`}
          title={preview.title || 'YouTube video'}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <MediaAttachment
        key={preview.url}
        media={{
          url: preview.url,
          mimeType: 'audio/mpeg',
          originalName: preview.title || 'Audio',
        }}
        compact
        mine={mine}
      />
    );
  }

  if (kind === 'video' || kind === 'image') {
    return (
      <MediaAttachment
        key={preview.url}
        media={{
          url: preview.url,
          mimeType: kind === 'video' ? 'video/mp4' : 'image/jpeg',
          originalName: preview.title || 'Attachment',
        }}
        compact
        mine={mine}
      />
    );
  }

  return <LinkPreviewCard preview={preview} compact />;
};

export default LinkOrMedia;
export { mediaKindForUrl, youtubeIdOf };
