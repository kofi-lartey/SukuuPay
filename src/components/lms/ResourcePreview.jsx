import React from "react";
import { PlayCircle, ExternalLink } from "lucide-react";

function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}
function vimeoId(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}
function isDirectVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
}

export default function ResourcePreview({ resource }) {
  const url = resource?.url || "";
  const title = resource?.title || url || "Resource";

  const yt = youtubeId(url);
  if (yt) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-700">{title}</p>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      </div>
    );
  }
  const vm = vimeoId(url);
  if (vm) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-700">{title}</p>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe className="w-full h-full" src={`https://player.vimeo.com/video/${vm}`} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        </div>
      </div>
    );
  }
  if (isDirectVideo(url)) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-700">{title}</p>
        <video className="w-full rounded-xl" controls src={url} />
      </div>
    );
  }
  // Non-video / non-embeddable link
  const isYouTubeSearch = /youtube\.com\/results/i.test(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
      <PlayCircle className="w-4 h-4 text-emerald-700" />
      <span className="truncate">{title}</span>
      {isYouTubeSearch && <span className="text-[10px] text-amber-600">(search page – paste a direct video link to preview)</span>}
      <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
    </a>
  );
}
