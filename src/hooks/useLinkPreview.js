import { useEffect, useRef, useState } from 'react';
import { fetchLinkPreview } from '../services/community';

/** Mirrors the server's `firstUrlIn` — first http(s) URL, minus trailing punctuation. */
const firstUrlIn = (text) => {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[.,;:!?)\]]+$/, '');
};

/**
 * Shows a link card while the message is still being typed.
 *
 * ## Why debounced rather than per-keystroke
 *
 * Typing `https://example.com/a/b/c` produces a new URL string on almost every
 * keystroke, and each one is a server-side fetch of somebody else's website. A
 * 700 ms pause after typing stops is short enough to feel immediate and long
 * enough that a pasted URL costs one request instead of forty.
 *
 * ## Why it is a preview of a preview
 *
 * The authoritative card is derived by the server when the message is stored, so
 * what this shows can differ from what other readers eventually see if the page
 * changes between the two. That is the right way round: a stale card is a cosmetic
 * problem, whereas a client-supplied card the server trusts is a spoofing one.
 */
const useLinkPreview = (text, { enabled = true } = {}) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dismissedUrl, setDismissedUrl] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }

    const url = firstUrlIn(text);
    if (!url) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }

    // The user removed this card; do not bring it back while the same URL stays
    // in the text.
    if (dismissedUrl === url) {
      setPreview(null);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      const result = await fetchLinkPreview(url);
      // A slower response for an older URL must not overwrite the newer one.
      if (id !== requestId.current) return;
      setPreview(result);
      setLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [text, enabled, dismissedUrl]);

  const dismiss = () => {
    const url = firstUrlIn(text);
    setDismissedUrl(url);
    setPreview(null);
  };

  return { preview, loading, dismiss };
};

export default useLinkPreview;