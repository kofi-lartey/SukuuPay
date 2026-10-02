import { useCallback, useEffect, useState } from 'react';
import { getPlatformSettings, updatePlatformSettings } from '../services/admin';

/**
 * The platform settings singleton, loaded once and shared.
 *
 * **Why a cache at all, given the server already has one.** The server's cache
 * (`Backend/src/services/platformSettings.service.js`) bounds how stale the *flags*
 * can be for code that reads them on a request path. This is a different problem:
 * four console screens need `support.phone` and `sms.ratePesewas` to render, and
 * without a client cache each one fires its own `GET /admin/settings` on mount. The
 * settings page saves them; a screen that then still shows the old number is
 * actively misleading, so `save` updates the cache directly rather than waiting for
 * a refetch that may never happen.
 *
 * **Fail-open, and deliberately so.** A failed load resolves to `null` and every
 * consumer renders without the setting rather than blocking. A platform console
 * that will not draw because a settings document could not be read is a console
 * that is unavailable during exactly the incident where somebody needs it. The
 * screens that *depend* on a value (the commission form) show their own error
 * because they are about to write it, and a page that cannot load its defaults is
 * not a page anybody should submit from.
 *
 * `usePlatformSettings()` with no key returns the whole cache object and is the
 * right call for a component that reads one field. Pass a key for the narrow case
 * where a subtree genuinely should not re-render when an unrelated setting changes.
 */
const SETTINGS_CACHE = {
  value: null,
  promise: null,
  listeners: new Set(),
};

/** Subscribe to the shared cache. Every subscriber re-renders on every change. */
const subscribe = (listener) => {
  SETTINGS_CACHE.listeners.add(listener);
  return () => SETTINGS_CACHE.listeners.delete(listener);
};

const publish = () => {
  SETTINGS_CACHE.listeners.forEach((listener) => listener());
};

/**
 * Fetch once, however many callers arrive.
 *
 * The `promise` is kept on the module rather than in a component because two
 * screens mounting on the same navigation both fire this, and without it the second
 * request is a guaranteed duplicate of the first. A rejected promise is cleared so
 * a transient failure does not poison the cache for the life of the tab — otherwise
 * one dropped request leaves every screen showing nothing until a full reload.
 */
export const loadPlatformSettings = ({ force = false } = {}) => {
  if (SETTINGS_CACHE.value && !force) return Promise.resolve(SETTINGS_CACHE.value);
  if (SETTINGS_CACHE.promise && !force) return SETTINGS_CACHE.promise;

  SETTINGS_CACHE.promise = getPlatformSettings()
    .then((settings) => {
      SETTINGS_CACHE.value = settings;
      publish();
      return settings;
    })
    .catch((error) => {
      SETTINGS_CACHE.promise = null;
      throw error;
    });

  return SETTINGS_CACHE.promise;
};

/**
 * Replace the cached document after a write.
 *
 * Called by `usePlatformSettingsControls`' `save`. Patching rather than refetching
 * is what makes the settings page feel immediate — and it is safe precisely because
 * the caller sends the whole document it wants stored, not a partial patch the
 * server merges. A patch would leave the cache describing a document that no longer
 * exists.
 */
export const setPlatformSettingsCache = (settings) => {
  SETTINGS_CACHE.value = settings;
  publish();
};

export const usePlatformSettings = () => {
  const [settings, setSettings] = useState(SETTINGS_CACHE.value);
  const [loading, setLoading] = useState(!SETTINGS_CACHE.value);
  const [error, setError] = useState(null);

  useEffect(() => subscribe(() => setSettings(SETTINGS_CACHE.value)), []);

  useEffect(() => {
    let mounted = true;
    if (SETTINGS_CACHE.value) {
      setLoading(false);
      return undefined;
    }

    loadPlatformSettings()
      .then((value) => {
        if (mounted) {
          setSettings(value);
          setError(null);
        }
      })
      .catch((err) => {
        // Surfaced, never thrown. See the fail-open note above.
        if (mounted) setError(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading, error, refresh: () => loadPlatformSettings({ force: true }) };
};

/**
 * Read/write pair for the platform settings page.
 *
 * Split from `usePlatformSettings` because the read half must be *shared* (every
 * console screen needs `support.phone`) and the write half must be *local* (only the
 * settings page has one). A single hook doing both would either refetch on every
 * unrelated render or give every consumer its own copy of the document they could
 * then drift from each other on.
 *
 * `dirty` is computed by comparing against the last-known-good document rather than
 * tracked by a flag per input, so a field the user changed and changed back reports
 * clean — which is what makes "unsaved changes" mean something.
 *
 * `saving` exists separately from the field list because every save in this console
 * has a moment where the button must be disabled: `autoApprove` releases a school's
 * money unattended, and a double-clicked save is two writes.
 */
export const usePlatformSettingsControls = () => {
  const { settings, loading, error } = usePlatformSettings();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Adopt the server document once, and never again mid-edit. Re-seeding `draft`
  // from a background refetch would silently discard whatever the operator had
  // typed — the failure mode where a settings page appears to "forget" an edit.
  if (settings && !draft) {
    setDraft(settings);
    setLastSaved(settings);
  }

  const dirty = Boolean(
    draft && lastSaved && JSON.stringify(draft) !== JSON.stringify(lastSaved)
  );

  const set = useCallback((updater) => {
    setDraft((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return next;
    });
  }, []);

  /**
   * Send the whole draft.
   *
   * The whole document, not a diff. The server's `updatePlatformSettings` takes a
   * patch and diffs it for the audit entry, and sending the full document is safe
   * precisely because the server knows which fields were absent before the change.
   * Sending a diff from the client would mean two places computing "what changed",
   * and the audit entry is written from the server's answer.
   */
  const save = useCallback(async () => {
    if (!draft) return null;
    setSaving(true);
    try {
      /*
       * Statically imported, not `await import(...)`.
       *
       * It was a dynamic import, and `vite build` correctly complained that
       * `services/admin.js` was both statically and dynamically imported by this
       * module — thirty-odd other files import it statically, so the dynamic one
       * bought nothing and only cost Rollup a chunking opportunity. More to the
       * point, a settings save that had to fetch its own client before it could call
       * it is a save that fails differently on a slow connection.
       */
      const saved = await updatePlatformSettings(draft);
      const merged = { ...draft, ...saved };
      setLastSaved(merged);
      setDraft(merged);
      setPlatformSettingsCache(merged);
      return saved;
    } finally {
      setSaving(false);
    }
  }, [draft]);

  /** Discard local edits. Offered only while `dirty`, since it is otherwise a no-op. */
  const reset = useCallback(() => {
    setDraft(lastSaved);
  }, [lastSaved]);

  return { draft, set, dirty, saving, save, reset, loading, error };
};

export default usePlatformSettings;