import { useCallback, useEffect, useState } from 'react';
import { listStudents } from '../services/students';

/**
 * The print studio's own roster query.
 *
 * Deliberately **not** `useStudents`. That hook reads its filters out of the
 * query string, and the Students module is one route — `?tab=roster`,
 * `?tab=id-cards` — so both tabs would read and write the same `?q=`,
 * `?class=`, `?page=`. Filtering the roster would silently refilter the print
 * studio, and paginating one would move the other.
 *
 * The studio also has a filter the URL cannot express: printability is derived
 * from the field manifest against the school record, not from a column in the
 * database, so there is no server-side parameter to put in a link. Keeping its
 * state local is what makes those two facts consistent.
 *
 * `status: 'active'` because a card belongs to a student who is on the roll. An
 * archived or transferred-out student can still hold a valid card — the ledger
 * keeps paying them — but reprinting one from the current roster is not what
 * this screen is for; `listAlumni` is.
 */
export const usePrintRoster = ({ page = 1, perPage = 24, className = '', search = '' } = {}) => {
  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });
  // Bumped by `refresh`. Without a real invalidation handle a "refresh" button
  // would only flip a loading flag and show the same stale rows, which is worse
  // than having no button — it looks like the readiness check re-ran.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    // Empty strings dropped, matching `useStudents`: `class=` would otherwise
    // reach the API as a filter for the class literally named "".
    const params = Object.fromEntries(
      Object.entries({ page, perPage, class: className, search }).filter(
        ([, value]) => value !== '' && value !== null
      )
    );

    listStudents(params)
      .then((result) => {
        if (!active) return;
        if (result.offline) {
          setState({
            rows: [],
            meta: null,
            loading: false,
            error: new Error(
              'Could not reach the server. No students are listed — this is a connection problem, not an empty roster.'
            ),
          });
          return;
        }
        setState({ rows: result.rows || [], meta: result.meta || null, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ rows: [], meta: null, loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [page, perPage, className, search, revision]);

  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  return { ...state, refresh };
};

export default usePrintRoster;
