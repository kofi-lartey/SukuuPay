import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `MediaRecorder` as a hook, so the same take can be rendered as a form block
 * (parent portal) and as a chat composer button without two copies of the
 * teardown rules.
 *
 * ## The rules that are easy to get wrong, kept in one place
 *
 *  - **Unmount mid-recording** stops the tracks. A live microphone after
 *    navigating away is the bug a user describes as "the app is spying on me".
 *  - **The object URL is revoked** on replace and on unmount, because
 *    `createObjectURL` allocates a fresh URL per call and a caller that keeps one
 *    it cannot revoke leaks a blob for the life of the tab.
 *  - **A take that recorded nothing is discarded**, not returned — a 0-byte blob
 *    reaches Cloudinary as an opaque failure.
 *  - **Capability and permission failures are distinct.** No `MediaRecorder` is a
 *    browser problem; `NotAllowedError` is a site-settings problem. The generic
 *    "something went wrong" tells the user nothing they can act on.
 *
 * Duration is measured on the client because the UI needs it while recording. It
 * is not authoritative: the server's number comes from Cloudinary's probe.
 */

/** Hard ceiling on one take. A minute is a long time to hold a phone up. */
export const MAX_RECORDING_SECONDS = 60;

/** Mirrors the 15 MB server-side multer cap for community attachments. */
const MAX_BYTES = 15 * 1024 * 1024;

/** Minimum plausible take: 1 second and 1 KB. */
const MIN_SECONDS = 1;
const MIN_BYTES = 1024;

/**
 * Picks the best container this browser can record.
 *
 * MP4/AAC is preferred over WebM/Opus because Cloudinary's ffmpeg probe decodes
 * MP4 reliably but frequently fails to find an audio channel in the fragmented
 * WebM blobs Chrome on Android produces. A slightly larger file is worth a file
 * that actually uploads.
 */
const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/mp4',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || '';
};

/** Best-guess extension from a MIME type. Only affects the uploaded filename. */
const extensionFor = (mimeType = '') => {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

/**
 * @param {(clip: { file: File, url: string, seconds: number, mimeType: string } | null) => void} onChange
 *   Called with `null` when a take is discarded, and with a new object when one is
 *   ready. The hook owns the object URL and revokes it on replace and on unmount.
 */
export const useVoiceRecorder = (onChange) => {
  const [supported, setSupported] = useState(null); // null = not yet probed
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);
  const onChangeRef = useRef(onChange);

  // The callback is held in a ref so a caller passing an inline arrow does not
  // rebuild every callback below on each render — which would otherwise
  // re-create `start` mid-recording.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const hasApi =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';
    setSupported(hasApi);
    if (!hasApi) {
      setError('This browser cannot record audio. You can still write your message below.');
    }
  }, []);

  // Two separate obligations on unmount: the interval, or it fires into an
  // unmounted component for the life of the tab; and the mic tracks, or the
  // browser's recording indicator stays on.
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
    setError(null);
    onChangeRef.current?.(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (caught) {
      // Split from the generic case because the remedy is different: this one is
      // fixed in the browser's site settings.
      const denied = caught?.name === 'NotAllowedError' || caught?.name === 'PermissionDeniedError';
      setError(
        denied
          ? 'Microphone access is blocked for this site. Allow it in your browser settings, or write your message instead.'
          : 'We could not open your microphone. Write your message instead.'
      );
      return;
    }

    const mimeType = pickMimeType();

    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      // Some browsers reject a constructor argument rather than ignoring it.
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopTracks();
        setError('Your browser could not start a recording. Write your message instead.');
        return;
      }
    }

    chunksRef.current = [];
    secondsRef.current = 0;
    setSeconds(0);

    recorder.ondataavailable = (event) => {
      // A recorder can emit a final zero-length chunk on stop; storing it would
      // make the assembled Blob unplayable on some players.
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      clearTimer();
      stopTracks();
      setRecording(false);

      const duration = secondsRef.current;
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];

      if (duration < MIN_SECONDS || blob.size < MIN_BYTES) {
        discard();
        setError('That recording was too short. Hold the button while you speak, or write your message.');
        return;
      }

      if (blob.size > MAX_BYTES) {
        discard();
        setError('That recording is too long to send. Keep it under a minute, or write your message.');
        return;
      }

      // Sanity-check the blob header before it reaches the server. WebM starts
      // 1a45dfa3, MP4 000000xx, Ogg 4f676753.
      const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      const headerHex = Array.from(header)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const isWebM = headerHex.startsWith('1a45dfa3');
      const isMP4 = headerHex.startsWith('000000');
      const isOgg = headerHex.startsWith('4f676753');

      if (!isWebM && !isMP4 && !isOgg) {
        discard();
        setError('We could not finish that recording on this phone. Please try again, or write your message.');
        return;
      }

      const file = new File([blob], `voice-note-${Date.now()}.${extensionFor(type)}`, { type });
      const url = URL.createObjectURL(blob);
      const next = { file, url, seconds: duration, mimeType: type };

      setClip(next);
      onChangeRef.current?.(next);
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    streamRef.current = stream;
    setRecording(true);

    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      // Stop rather than warn: a recording past the limit is not recoverable by
      // asking the user to trim it.
      if (secondsRef.current >= MAX_RECORDING_SECONDS) {
        recorder.stop();
      }
    }, 1000);
  }, [clearTimer, discard, stopTracks]);

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

  // Cancelling while recording goes through `stop` so the tracks are released on
  // the same path a normal stop takes.
  const cancel = useCallback(() => {
    if (recording) stop();
    discard();
  }, [discard, recording, stop]);

  return {
    supported,
    recording,
    seconds,
    clip,
    error,
    start,
    stop,
    toggle,
    cancel,
    discard,
    setError,
  };
};

export default useVoiceRecorder;