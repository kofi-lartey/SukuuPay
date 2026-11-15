import React, { useEffect } from 'react';
import { Mic, Trash2 } from 'lucide-react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

/**
 * The microphone in a chat composer.
 *
 * The parent portal's `AudioRecorder` is a form block â€” a full-width 48px button and
 * a "voice note ready" panel â€” which is the right shape for a page of its own and
 * the wrong one for an input row. This is the same recorder state machine
 * (`hooks/useVoiceRecorder.js`) rendered as an icon, so both surfaces share the
 * teardown rules, the capability probe and the take validation instead of each
 * having their own copy of them.
 *
 * ## Interaction model
 *
 * Tap to start, tap to stop â€” not press-and-hold. Hold-to-record is the WhatsApp
 * gesture, but it fights the click-to-open-context-menu behaviour a few pixels away
 * in the same row, and a missed hold on a phone is a lost sentence. A toggle is one
 * fewer thing to get wrong.
 *
 * The clip is handed to the parent as a `File` through `onRecorded`, which uploads
 * it exactly like a picked file. Nothing about the send path knows it came from a
 * microphone.
 */

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const VoiceNoteButton = ({ onRecorded, onRecordingChange }) => {
  const { supported, recording, seconds, clip, error, toggle, cancel } = useVoiceRecorder(
    (next) => {
      if (next) onRecorded?.(next.file);
    }
  );

  /*
   * Tell the room recording started or stopped. Driven by the recorder state
   * rather than the click handlers, so a take that ends on its own - the 60s
   * ceiling, or the mic being pulled - still reports the stop.
   */
  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  // Recording in progress: a stop button and the elapsed time replace the icon.
  if (recording) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label="Stop recording"
          className="flex h-9 items-center gap-1.5 rounded-lg bg-red-50 px-2.5 text-red-600 hover:bg-red-100"
        >
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
          <span className="text-[11px] font-extrabold tabular-nums">{formatDuration(seconds)}</span>
        </button>

        <button
          type="button"
          onClick={cancel}
          aria-label="Discard recording"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (supported === false) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={clip ? 'Record a new voice note' : 'Record a voice note'}
      title={error || (clip ? 'Record a new voice note' : 'Record a voice note')}
      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
};

export default VoiceNoteButton;
