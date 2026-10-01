import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listUsers, inviteUser, resendUserInvite, updateUserRole, removeUser } from '../services/user';

/**
 * The team roster's list state, with the URL as the source of truth.
 *
 * Same contract as `useStudents`: filters live in the query string so a bursar
 * can send a colleague "the teachers who have not accepted yet" as a link, and
 * so the back button walks the filters. The free-text search is the deliberate
 * exception — it is client-side (see `visibleUsers`), because a school has tens
 * of staff, not thousands, and filtering the loaded page on each keystroke is
 * both instant and one request cheaper.
 *
 * `setFilter` replaces the page by default, for the same reason as the roster:
 * changing a filter while on page 4 of the old result set lands you on an empty
 * page.
 *
 * `reloadKey` is the invalidation handle. Four separate surfaces mutate this
 * list — invite, resend, role change, removal — and without a shared counter
 * each would carry its own copy of "re-fetch the roster".
 */
export const useUsers = (reloadKey = 0) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({
      role: searchParams.get('role') || '',
      status: searchParams.get('status') || '',
      page: Number(searchParams.get('page')) || 1,
      limit: 50,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listUsers({ page: filters.page, limit: filters.limit, role: filters.role, status: filters.status })
      .then((result) => {
        if (!active) return;
        setState({
          rows: result.users,
          pagination: result.pagination,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], pagination: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const setFilter = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key);
        else next.set(key, String(value));
      });
      if (resetPage) next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const hasFilters = Boolean(filters.role || filters.status);

  return { ...state, filters, setFilter, clearFilters, hasFilters };
};

/**
 * The roster, narrowed by the search box.
 *
 * Separate from `useUsers` because it is the one thing that must *not* touch the
 * server: re-querying on every keystroke is a race the user can lose (results
 * for "qua" landing after results for "quaye"), and it puts a request on the
 * wire for a filter that is visibly instant either way.
 *
 * Matches name, email and position, because an admin recalling a colleague is at
 * least as likely to remember "the bursar" as the spelling of their address.
 */
export const useFilteredUsers = (rows, search) => {
  const term = search.trim().toLowerCase();

  return useMemo(() => {
    if (!term) return rows;
    return rows.filter((row) =>
      [row.name, row.email, row.position]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [rows, term]);
};

/**
 * Mutations for the team roster.
 *
 * Every function returns `{ ok: false, error }` rather than throwing, because
 * the two failure modes on this page are not the same shape and the caller has
 * to react differently to each:
 *
 *   - a thrown request (offline, 500) — nothing changed, just retry
 *   - a resolved invite with `emailSent: false` — the account EXISTS but the
 *     credentials never reached anyone, so the correct next action is a *resend*
 *
 * Collapsing both into "something went wrong" is how a teacher ends up invited,
 * not told, and never told again.
 */
export const useUserActions = ({ onDone } = {}) => {
  const [busyKey, setBusyKey] = useState(null);

  const run = useCallback(
    async (key, operation) => {
      setBusyKey(key);
      try {
        const result = await operation();
        onDone?.();
        return { ok: true, ...result };
      } catch (error) {
        return { ok: false, error };
      } finally {
        setBusyKey(null);
      }
    },
    [onDone]
  );

  const invite = useCallback(
    (payload) => run('invite', () => inviteUser(payload)),
    [run]
  );

  const resend = useCallback((userId) => run(`resend:${userId}`, () => resendUserInvite(userId)), [run]);

  const changeRole = useCallback(
    (userId, role) => run(`role:${userId}`, () => updateUserRole(userId, role).then((user) => ({ user }))),
    [run]
  );

  const remove = useCallback((userId) => run(`remove:${userId}`, () => removeUser(userId)), [run]);

  return {
    invite,
    resend,
    changeRole,
    remove,
    busyKey,
    /** True while the matching operation for `key` is in flight. */
    isBusy: (key) => busyKey === key,
  };
};