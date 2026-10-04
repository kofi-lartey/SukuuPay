import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A voice-note recorder for the parent portal.
 *
 * ## Why this is a component and not a `<input type="file">`
 *
 * The gap it fills is a parent who can write but cannot comfortably type — or who is
 * driving, or holding a toddler, or whose eyes are tired at 11pm with a balance
 * discrepancy they need to explain. A file picker asking for a `.m4a` from someone
 * without a voice recorder app on the phone is not a workaround, it is a wall. The
 * `MediaRecorder` API is the one permission prompt that already exists on the device.
 *
 * ## Why recording is optional, and text still works
 *
 * Recording is *added* to the form, never required. A parent with data to save, on a
 * metered bundle, is better served by the textarea they already have — and a
 * microphone permission on an unauthenticated page is a large ask to make mandatory.
 * Both are accepted server-side, and either alone is a complete message.
 *
 * ## Failure modes handled explicitly
 *
 * Every one of these is a real, separate outcome and each gets its own message, because
 * the generic "something went wrong" tells a parent nothing they can act on:
 *
 *  - **No `MediaRecorder`** (older Safari, some in-app browsers): the control renders
 *    disabled with the reason, instead of throwing on tap.
 *  - **No `getUserMedia`** (very old browser, or a non-secure origin): same treatment.
 *    `getUserMedia` requires HTTPS in production, and this portal is reached over a
 *    pay link — so "works on my phone, not on yours" is a real support case unless it
 *    says why.
 *  - **Permission denied**: distinguished from the above, because the fix is different
 *    (change a browser setting rather than update anything).
 *  - **Recording ends on its own**: a parent who says nothing for a full minute hits
 *    `onstop` with zero usable audio. The take is discarded rather than sent.
 *  - **Unmount mid-recording**: the stream tracks are stopped and the recorder closed.
 *    Leaving a microphone open after navigating away is the kind of bug that gets an
 *    app uninstalled.
 *
 * ## Duration is measured on the client, not trusted from the server
 *
 * The recorded length is displayed while recording and shown on the chip after. It is
 * not sent as authoritative: the server's number comes from Cloudinary's probe, and a
 * client-supplied duration on a public endpoint is a field that would disagree with the
 * file every time a browser reported it differently.
 */

/** Hard ceiling on one take. A minute is a long time to hold a phone up. */
export const MAX_RECORDING_SECONDS = 60;

/** Mirrors the 5 MB server-side multer cap. Opus is ~8 kbps, so this is ~500 KB. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Picks the best container this browser can record.
 *
 * Order matters and is deliberate: Opus-in-WebM is the only combination with
 * broad hardware support *and* good speech compression. Safari has no WebM/Opus
 * encoder and falls to `audio/mp4`, which every recent Safari and iOS supports.
 *
 * `isTypeSupported` is checked rather than assumed. Constructing a `MediaRecorder`
 * with an unsupported `mimeType` throws in some browsers and silently produces an
 * unplayable file in others — the second of which is worse, because the parent finds
 * out after sending it.
 */
const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
};

/** `0` → `0:07`. */
const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const MicIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StopIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const TrashIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlayIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 001.54.84l10.1-6.86a1 1 0 000-1.68L9.54 4.3A1 1 0 008 5.14z" />
  </svg>
);

/**
 * @param {{ onChange: (audio: { file: File, url: string, seconds: number, mimeType: string } | null) => void }} props
 *   `onChange` receives `null` when the take is discarded, and a new object when one is
 *   ready. The component owns the object URL and revokes it on replace and on unmount —
 *   a caller that keeps the URL and leaks it would leave a blob alive for the life of
 *   the tab, which on a low-memory Android handset is a crash, not a leak.
 */
const AudioRecorder = ({ onChange }) => {
  const [supported, setSupported] = useState(null); // null = not yet probed
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null); // { file, url, seconds, mimeType }
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  // ── Capability probe ──────────────────────────────────────────────────────
  //
  // Runs once on mount. Rendered as nothing rather than as a disabled control during
  // the probe, because the probe is synchronous and there is no state in which the
  // answer is unknown in practice.
  useEffect(() => {
    const hasApi =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
    setSupported(hasApi);
    if (!hasApi) {
      setError(
        'This browser cannot record audio. You can still write your message below.'
      );
    }
  }, []);

  // ── Teardown ──────────────────────────────────────────────────────────────
  //
  // Two separate obligations, both easy to miss. The interval has to be cleared or it
  // fires into an unmounted component for the life of the tab; and the mic tracks have
  // to be stopped or the browser's recording indicator stays on, which is the one
  // piece of this feature a parent would describe as "the app is spying on me".
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
    },
    []
  );

  // Revoke the previous object URL whenever the clip changes, including on unmount.
  useEffect(
    () => () => {
      if (clip?.url) URL.revokeObjectURL(clip.url);
    },
    [clip]
  );

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const discard = useCallback(() => {
    setClip(null);
    setSeconds(0);
    secondsRef.current = 0;
    onChange?.(null);
  }, [onChange]);

  const start = useCallback(async () => {
    setError(null);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      // Split from the generic case because the remedy is different: this one is fixable
      // in the browser's site settings, and a parent who is told "update your browser"
      // when their browser is current will not think to look there.
      const denied =
        caught?.name === 'NotAllowedError' || caught?.name === 'PermissionDeniedError';
      setError(
        denied
          ? 'Microphone access is blocked for this site. Allow it in your browser settings, or write your message below.'
          : 'We could not open your microphone. Write your message below instead.'
      );
      return;
    }

    const mimeType = pickMimeType();

    let recorder;
    try {
      recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
    } catch {
      // Some browsers reject a constructor argument rather than ignoring it. Retry bare
      // before giving up — this is the difference between "works except on Safari" and
      // "works everywhere except where we tested".
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopTracks();
        setError('Your browser could not start a recording. Write your message below instead.');
        return;
      }
    }

    chunksRef.current = [];
    secondsRef.current = 0;
    setSeconds(0);

    recorder.ondataavailable = (event) => {
      // A recorder can emit a final zero-length chunk on stop; storing it would make
      // the assembled Blob unplayable on some players.
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearTimer();
      stopTracks();
      setRecording(false);

      const duration = secondsRef.current;
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];

      // A take that recorded nothing is discarded, not uploaded. Sending a 0-byte
      // file would look like a message the parent wrote and produce a bursar opening
      // an audio player with nothing in it.
      if (duration < 1 || blob.size === 0) {
        discard();
        setError('That recording was too short. Hold the button while you speak, or write your message.');
        return;
      }

      if (blob.size > MAX_BYTES) {
        discard();
        setError('That recording is too long to send. Keep it under a minute, or write your message.');
        return;
      }

      const file = new File([blob], `voice-note-${Date.now()}.${extensionFor(type)}`, {
        type,
      });

      // One object URL, not two. `createObjectURL` allocates a fresh URL on every call,
      // so building it for the state and again for the callback would hand the caller
      // a URL this component cannot revoke — the leak then lives as long as the tab,
      // on the low-memory handsets least able to afford it.
      const url = URL.createObjectURL(blob);

      setClip({ file, url, seconds: duration, mimeType: type });
      onChange?.({ file, url, seconds: duration, mimeType: type });
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    streamRef.current = stream;
    setRecording(true);

    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      // Stop rather than warn: a recording that has already gone past the limit is not
      // recoverable by asking the parent to trim it, and a parent who is mid-sentence
      // should not have to decide whether to finish the sentence.
      if (secondsRef.current >= MAX_RECORDING_SECONDS) {
        recorder.stop();
      }
    }, 1000);
  }, [clearTimer, discard, onChange, stopTracks]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  // Cancelling while recording goes through `stop`, so the tracks are released on the
  // same path a normal stop takes. Dropping straight to `discard` would leave the mic
  // open and the interval running.
  const cancel = useCallback(() => {
    if (recording) stop();
    discard();
  }, [discard, recording, stop]);

  if (supported === false && !clip) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-slate-500">
        {error || 'Recording is not available in this browser. Write your message below.'}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {clip && !recording ? (
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <PlayIcon className="h-3.5 w-3.5 translate-x-[1px]" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-emerald-900">
                Voice note ready
              </p>
              <p className="text-[12px] font-semibold text-emerald-700">
                {formatDuration(clip.seconds)} ·{' '}
                {Math.max(1, Math.round(clip.file.size / 1024))} KB
              </p>
            </div>

            <button
              type="button"
              onClick={discard}
              aria-label="Delete this recording"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <TrashIcon />
            </button>
          </div>

          {/* `preload="none"` — the audio is already on the device as a blob URL, so
              there is nothing to fetch, and preloading would start decoding a file the
              parent may only listen to once they are sure they want to. */}
          <audio controls preload="none" src={clip.url} className="mt-2.5 h-9 w-full">
            <a href={clip.url} download={clip.file.name}>
              Download the recording
            </a>
          </audio>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={supported === false}
          aria-pressed={recording}
          aria-label={recording ? 'Stop recording' : 'Record a voice note'}
          className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A5C36] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 ${
            recording
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border-2 border-[#0A5C36] bg-white text-[#0A5C36] hover:bg-emerald-50'
          }`}
        >
          {recording ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          {recording ? 'Stop recording' : clip ? 'Record again' : 'Record a voice note'}
        </button>

        {recording ? (
          <span
            role="timer"
            aria-live="off"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[14px] font-extrabold tabular-nums text-red-700"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-pulse rounded-full bg-red-600"
            />
            {formatDuration(seconds)}
          </span>
        ) : null}
      </div>

      {recording ? (
        <button
          type="button"
          onClick={cancel}
          className="w-full text-[12px] font-bold text-slate-500 underline underline-offset-2 hover:text-slate-700"
        >
          Cancel recording
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12px] font-semibold leading-relaxed text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** Best-guess extension from a MIME type. Only affects the uploaded filename. */
const extensionFor = (mimeType = '') => {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

export default AudioRecorder;