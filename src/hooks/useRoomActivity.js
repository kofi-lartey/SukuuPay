import React, { useCallback, useEffect, useRef, useState } from 'react';
import { initializeSocket } from '../utils/socket';
import { getPresence } from '../services/community';

/**
 * Live room state for a school community: who is online, who is typing, who is
 * recording.
 *
 * ## Why presence is re-synced on subscribe
 *
 * The gateway broadcasts `community:presence` when a socket connects and when it
 * disconnects — but the browser's socket connects during app start, before this
 * listener exists, so the first broadcast is always missed. Without a re-sync the
 * count stays at whatever the initial HTTP call returned, which for a freshly
 * connected user is zero. That is exactly the "0 online while people are online"
 * bug: the server was right, the client was never told.
 *
 * ## Why typing and recording expire
 *
 * Both are "is happening now" facts. A `typing:true` with no matching `false`
 * (closed tab, dropped connection, network switch) would otherwise pin "Kwame is
 * typing" to the top of the chat forever. Each event arms its own expiry, so the
 * indicator disappears on its own even when the stop never arrives.
 */

const TYPING_TTL_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

export const useRoomActivity = ({ schoolId, enabled = true } = {}) => {
  const [onlineIds, setOnlineIds] = useState([]);
  const [typing, setTyping] = useState({});
  const [recording, setRecording] = useState({});

  const typingTimers = useRef(new Map());
  const recordingTimers = useRef(new Map());
  const lastTypingSent = useRef(0);
  const socketRef = useRef(null);

  const clearTimer = (map, key) => {
    const timer = map.current.get(key);
    if (timer) clearTimeout(timer);
    map.current.delete(key);
  };

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const onPresence = (payload) => setOnlineIds(payload?.userIds || []);

    const onTyping = (payload) => {
      const id = String(payload?.userId || '');
      if (!id) return;

      if (!payload.isTyping) {
        clearTimer(typingTimers, id);
        setTyping((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }

      setTyping((prev) => ({ ...prev, [id]: payload.name || 'Someone' }));

      // Re-armed on every keystroke burst: the indicator survives continuous
      // typing and still expires four seconds after the last one.
      clearTimer(typingTimers, id);
      typingTimers.current.set(
        id,
        setTimeout(() => {
          setTyping((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          typingTimers.current.delete(id);
        }, TYPING_TTL_MS)
      );
    };

    const onRecording = (payload) => {
      const id = String(payload?.userId || '');
      if (!id) return;

      if (!payload.isRecording) {
        clearTimer(recordingTimers, id);
        setRecording((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }

      setRecording((prev) => ({ ...prev, [id]: payload.name || 'Someone' }));

      // Recording has no natural end signal if the tab closes mid-take.
      clearTimer(recordingTimers, id);
      recordingTimers.current.set(
        id,
        setTimeout(() => {
          setRecording((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          recordingTimers.current.delete(id);
        }, 65000)
      );
    };

    initializeSocket(localStorage.getItem('auth_token'))
      .then((socket) => {
        if (cancelled) return;
        socketRef.current = socket;

        socket.on('community:presence', onPresence);
        socket.on('community:typing', onTyping);
        socket.on('community:recording', onRecording);

        // The broadcast that matters most already happened before this listener
        // existed, so ask for the current state directly.
        getPresence()
          .then((ids) => {
            if (!cancelled) setOnlineIds(ids);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      socketRef.current?.off?.('community:presence', onPresence);
      socketRef.current?.off?.('community:typing', onTyping);
      socketRef.current?.off?.('community:recording', onRecording);

      typingTimers.current.forEach(clearTimeout);
      recordingTimers.current.forEach(clearTimeout);
      typingTimers.current.clear();
      recordingTimers.current.clear();
    };
  }, [enabled, schoolId]);

  /**
   * Announce that this user is typing. Throttled, because an input fires on every
   * keystroke and the room does not need twenty events for one sentence.
   */
  const announceTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;

    lastTypingSent.current = now;
    socketRef.current?.emit('community:typing', { isTyping: true });

    // The stop is sent on the next announce after a pause, or by the caller on blur.
    clearTimeout(announceTyping.stopTimer);
    announceTyping.stopTimer = setTimeout(() => {
      socketRef.current?.emit('community:typing', { isTyping: false });
    }, TYPING_TTL_MS);
  }, []);

  const stopTyping = useCallback(() => {
    clearTimeout(announceTyping.stopTimer);
    socketRef.current?.emit('community:typing', { isTyping: false });
  }, []);

  const announceRecording = useCallback((isRecording) => {
    socketRef.current?.emit('community:recording', { isRecording });
  }, []);

  return {
    onlineIds,
    typingNames: Object.values(typing),
    recordingNames: Object.values(recording),
    announceTyping,
    stopTyping,
    announceRecording,
  };
};

export default useRoomActivity;