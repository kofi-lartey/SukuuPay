import React from 'react';
import { useVoiceRecorder, MAX_RECORDING_SECONDS } from '../../hooks/useVoiceRecorder';

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
 * ## Where the behaviour lives
 *
 * The recorder state machine, the capability probe and the teardown rules live in
 * `hooks/useVoiceRecorder.js`, shared with the chat composer's microphone button.
 * This component is the *form* presentation of it: a full-width button and a
 * ready-to-send panel. Keeping the two apart is what lets a chat input offer a mic
 * without inheriting a 48px-minimum button designed for a page of its own.
 */

export { MAX_RECORDING_SECONDS };

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
 *   ready.
 */
const AudioRecorder = ({ onChange }) => {
  const { supported, recording, seconds, clip, error, toggle, cancel, discard } =
    useVoiceRecorder(onChange);

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
              <p className="text-[13px] font-extrabold text-emerald-900">Voice note ready</p>
              <p className="text-[12px] font-semibold text-emerald-700">
                {formatDuration(clip.seconds)} · {Math.max(1, Math.round(clip.file.size / 1024))} KB
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
              there is nothing to fetch. */}
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
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
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

export default AudioRecorder;