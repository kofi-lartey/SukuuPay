import { useEffect, useState } from 'react';
import { useToast } from '../useToast';
import { listTeachers } from '../../services/admin/academic';

/**
 * The school's teachable accounts, loaded once for the assign-teacher picker.
 *
 * `GET /users` is school-scoped and paginated, but a classroom picker holds the
 * whole staff — so it asks for the lot in one request rather than re-paginating
 * the dropdown. The shape returned (`{ id, name, role }[]`) is the subset the
 * assign endpoints consume; the headmaster never sees accountants or viewers.
 */
export const useTeachers = (reloadKey = 0) => {
  const { error: toastError } = useToast();
  const [state, setState] = useState({ items: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ items: [], loading: true, error: null });

    listTeachers()
      .then((items) => {
        if (!active) return;
        setState({ items, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        toastError(error.message);
        setState({ items: [], loading: false, error });
      });

    return () => {
      active = false;
    };
  }, [reloadKey, toastError]);

  return state;
};

export default useTeachers;
