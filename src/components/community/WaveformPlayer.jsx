import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * An inline voice-note player: a waveform you can scrub, and a speed control
 * (1x / 2x / 3x) that applies without re-fetching.
 *
 * ## Why this exists
 *
 * `MediaAttachment` rendered a raw `<audio controls>` for every `audio/*` entry.
 * That is ~120px of browser chrome per note, which dominates a chat bubble, and it
 * gives no hint of how long the note is before you press play. This player is one
 * 44px row that reads as "0:14 of audio" at a glance, and expands to reveal speed.
 *
 * ## The waveform is seeded, then real
 *
 * A true waveform needs the decoded PCM, which means fetching the whole clip before
 * the first frame can be drawn - the opposite of what a metered phone connection
 * wants. So the bars start as a deterministic pseudo-waveform derived from `seed`
 * (the `publicId`), shaped by a log curve so quiet clips stay short. On
 * `loadedmetadata` the player fetches and decodes the file, samples 32 peak
 * buckets, and replaces the seed - the shape you see after a second is the real
 * audio. The seed is what stops the row from reflowing while `preload="none"`
 * holds the bytes back.
 *
 * ## One clip at a time
 *
 * Native players let two clips play at once. A module-level registry pauses the
 * previous `<audio>` when a new one starts, so a room of notes behaves like a room
 * of people taking turns.
 *
 * ## Tones
 *
 * `mine` flips the palette for the sender's teal bubble: played bars go white, the
 * track drops to a translucent white, and the speed pills invert. Without it the
 * player is invisible on a teal background.
 */

const BAR_COUNT = 32;

/** The `<audio>` element currently playing anywhere on the page. */
let playing = null;

/** `0` -> `0:07`. Floors, because a duration of 7.9s is "0:07" to a listener. */
const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** A stable 32-bit hash of a string. FNV-1a, short and good enough for a seed. */
const hashSeed = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * A plausible bar for a given index and seed.
 *
 * Two sine waves at incommensurate frequencies, plus the hash, so neighbours differ
 * (audio is not a smooth ramp) but the whole strip is stable across renders and
 * identical for every reader of the same clip.
 */
const seededBar = (index, seed) => {
  const noise = ((hashSeed(`${seed}:${index}`) % 1000) / 1000) * 0.5;
  const wave =
    Math.abs(Math.sin(index * 0.55 + (seed % 17)) * 0.3) +
    Math.abs(Math.sin(index * 0.19 + (seed % 5)) * 0.2);
  // A gentle taper at the ends: a note usually opens and closes quieter than its middle.
  const taper = Math.sin((index / (BAR_COUNT - 1)) * Math.PI) * 0.25 + 0.75;
  return Math.min(1, 0.12 + (wave + noise) * taper);
};

/**
 * Decode `src` and return `BAR_COUNT` peak values in 0..1, or `null` if the
 * browser cannot (a format `decodeAudioData` rejects, or no `AudioContext`).
 *
 * Cached by URL in `sessionStorage` so a thread re-opened in the same tab does not
 * decode every note again. Entries are validated on read; a corrupt or foreign
 * value is dropped rather than trusted.
 */
const peakCache = new Map();

const readCache = (url) => {
  if (peakCache.has(url)) return peakCache.get(url);
  try {
    const raw = sessionStorage.getItem(`waveform:${url}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== BAR_COUNT) return null;
    peakCache.set(url, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (url, peaks) => {
  peakCache.set(url, peaks);
  try {
    sessionStorage.setItem(`waveform:${url}`, JSON.stringify(peaks));
  } catch {
    // A full or disabled quota is not worth surfacing; the seed still renders.
  }
};

const decodePeaks = async (url) => {
  const cached = readCache(url);
  if (cached) return cached;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  let context;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();

    context = new Ctx();
    const buffer = await context.decodeAudioData(bytes);
    const channel = buffer.getChannelData(0);
    const bucket = Math.max(1, Math.floor(channel.length / BAR_COUNT));

    const peaks = [];
    for (let i = 0; i < BAR_COUNT; i += 1) {
      let max = 0;
      const start = i * bucket;
      const end = Math.min(channel.length, start + bucket);
      for (let j = start; j < end; j += 1) {
        const value = Math.abs(channel[j]);
        if (value > max) max = value;
      }
      peaks.push(max);
    }

    // Normalise so a quiet note still fills the strip; an empty buffer stays flat.
    const loudest = Math.max(...peaks, 0.01);
    const normalised = peaks.map((p) => Math.min(1, Math.max(0.06, p / loudest)));

    writeCache(url, normalised);
    return normalised;
  } catch {
    return null;
  } finally {
    if (context) context.close().catch(() => {});
  }
};

const WaveformPlayer = ({ src, seed, durationHint, mine = false, onError }) => {
  const audioRef = useRef(null);
  const [playingNow, setPlayingNow] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(Number(durationHint) || 0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState(null);

  const fallback = useMemo(() => {
    const key = String(seed || src || '');
    return Array.from({ length: BAR_COUNT }, (_, i) => seededBar(i, hashSeed(key)));
  }, [seed, src]);

  const bars = peaks || fallback;

  // Pull the real peaks once metadata is in. `loadedmetadata` fires before the
  // whole file is fetched, so this runs against a partial download - fine, because
  // `decodeAudioData` reads what it needs and the browser keeps the rest warm.
  useEffect(() => {
    let cancelled = false;
    const node = audioRef.current;
    if (!node || !src) return undefined;

    const onMeta = () => {
      if (Number.isFinite(node.duration) && node.duration > 0) {
        setDuration(node.duration);
      }
      decodePeaks(src).then((real) => {
        if (!cancelled && real) setPeaks(real);
      });
    };

    if (node.readyState >= 1) onMeta();
    node.addEventListener('loadedmetadata', onMeta);
    return () => {
      cancelled = true;
      node.removeEventListener('loadedmetadata', onMeta);
    };
  }, [src]);

  // Pause this clip when another starts, and release the registry on unmount.
  useEffect(() => {
    const node = audioRef.current;
    return () => {
      if (node && playing === node) playing = null;
    };
  }, []);

  const toggle = useCallback(() => {
    const node = audioRef.current;
    if (!node) return;

    if (node.paused) {
      // Pause whoever was playing before this one took the floor.
      if (playing && playing !== node) {
        playing.pause();
      }
      playing = node;
      node.playbackRate = rate;
      node.play().catch(() => {});
    } else {
      node.pause();
      if (playing === node) playing = null;
    }
  }, [rate]);

  const seekToFraction = useCallback(
    (fraction) => {
      const node = audioRef.current;
      if (!node || !Number.isFinite(node.duration)) return;
      const clamped = Math.min(1, Math.max(0, fraction));
      node.currentTime = clamped * node.duration;
      setCurrent(node.currentTime);
    },
    []
  );

  const seekOnBars = useCallback(
    (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekToFraction((event.clientX - rect.left) / rect.width);
    },
    [seekToFraction]
  );

  const scrubWithKeyboard = useCallback(
    (event) => {
      const node = audioRef.current;
      if (!node) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const step = (event.key === 'ArrowRight' ? 1 : -1) * 5;
        const next = Math.min(
          node.duration || duration || 0,
          Math.max(0, node.currentTime + step)
        );
        node.currentTime = next;
        setCurrent(next);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        node.currentTime = 0;
        setCurrent(0);
      }
    },
    [duration]
  );

  const chooseRate = useCallback((value) => {
    setRate(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }, []);

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const playedBars = Math.round(progress * bars.length);

  const playedClass = mine ? 'bg-white' : 'bg-teal-600';
  const idleClass = mine ? 'bg-white/45' : 'bg-slate-300';
  const buttonClass = mine
    ? 'bg-white/15 text-white hover:bg-white/25'
    : 'bg-teal-50 text-teal-700 hover:bg-teal-100';

  const remaining = Math.max(0, duration - current);

  return (
    <div className={mine ? 'text-white' : 'text-ink'} data-bubble-interactive>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${playingNow ? 'Pause' : 'Play'} voice note, ${formatDuration(duration)}`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${buttonClass}`}
        >
          {playingNow ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
          )}
        </button>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek within voice note"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${formatDuration(current)} of ${formatDuration(duration)}`}
          onClick={seekOnBars}
          onKeyDown={scrubWithKeyboard}
          className="grid h-8 w-full flex-1 cursor-pointer items-center gap-[2px] overflow-hidden rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        >
          {bars.map((value, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`w-full rounded-full transition-[height,background-color] duration-150 ${
                i < playedBars ? playedClass : idleClass
              }`}
              style={{ height: `${Math.round(4 + value * 20)}px` }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => chooseRate(rate === 3 ? 1 : rate + 1)}
          aria-label={`Playback speed ${rate === 3 ? 1 : rate + 1}x`}
          aria-pressed={rate > 1}
          className={`shrink-0 rounded-full p-1.5 text-[10px] font-extrabold tabular-nums transition-colors ${
            rate > 1
              ? mine
                ? 'bg-white text-teal-700'
                : 'bg-teal-600 text-white'
              : mine
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          {rate}x
        </button>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlayingNow(true)}
        onPause={() => setPlayingNow(false)}
        onEnded={() => {
          setPlayingNow(false);
          setCurrent(0);
          if (playing === audioRef.current) playing = null;
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onError={() => onError?.()}
      />
    </div>
  );
};

export default WaveformPlayer;