import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Badge from '../../../components/dashboard/ui/Badge';
import AnnouncementForm from './AnnouncementForm';
import { useToast } from '../../../hooks/useToast';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { getAnnouncement, updateAnnouncement } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';
import { formatCount } from '../../../utils/format';

/**
 * `/admin/announcements/:id` — edit one notice, in patch mode.
 *
 * The second consumer of `AnnouncementForm`, and the reason the form takes a `mode`
 * at all. Two behaviours differ from create, and both are forced by the endpoint
 * rather than chosen:
 *
 * ## It loads the whole document, including an inactive one
 *
 * `getAnnouncement` returns withdrawn notices
 * (`announcements.service.js:250-273`) and a computed `isLive`. That is
 * deliberate — the deactivate-not-delete rule is worthless without a way to read
 * the row it preserved, because "what did we publish last Tuesday" is a question
 * the console has to be able to answer. So a 404 here is genuinely "no such
 * announcement", and it is shown as an empty state with a way back rather than as
 * a form with nothing in it.
 *
 * `isLive` is read and shown as a badge but **not used to drive the form**. The
 * form derives its own state from `isActive` plus the window
 * (`AnnouncementsList.jsx`'s `announcementState`), because the server's `isLive`
 * was computed at request time and a form left open across a start boundary would
 * then disagree with the server by the time it was submitted. Two sources of truth
 * for "is this live" on an editable screen is one too many.
 *
 * ## The patch is merged server-side, so "unchanged" is a real outcome
 *
 * `updateAnnouncement` applies only the keys present and diffs the result
 * (`announcements.service.js:386-426`); an identical re-submit returns
 * `changedFields: []` and writes **no audit entry**. The toast says so, because a
 * console that reported "saved!" for a write that left no trace is claiming a
 * record it did not create — and an audit log whose entries cannot be trusted to
 * correspond to actions is worse than one with fewer entries.
 *
 * The form sends the full document rather than a computed diff for the same reason
 * `usePlatformSettingsControls` does (`usePlatformSettings.js:167-181`): one place
 * deciding what changed, and it is the server, which has the stored value and can
 * produce the `before`/`after` pair the audit entry needs.
 */
const AnnouncementEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isImpersonating } = useImpersonation();

  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: new Error('No announcement id in the URL.') });
      return undefined;
    }

    let active = true;
    setState({ data: null, loading: true, error: null });
    getAnnouncement(id)
      .then((result) => active && setState({ data: result, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [id]);

  const submit = useCallback(
    async (payload) => {
      try {
        const result = await updateAnnouncement(id, payload);
        const changed = Array.isArray(result?.changedFields) ? result.changedFields : [];
        if (!changed.length) {
          toast.info('No changes to save. Nothing was written and no audit entry was made.');
        } else {
          toast.success(
            `“${result?.title || payload.title}” updated. Changed: ${changed.join(', ')}.`
          );
        }
        navigate(ROUTES.ADMIN_ANNOUNCEMENTS);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This announcement could not be updated.' };
      }
    },
    [id, navigate, toast]
  );

  const cancel = useCallback(() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS), [navigate]);

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
      </div>
    );
  }

  if (state.error) {
    return (
      <>
        <PageHeader eyebrow="Platform console" title="Announcement" />
        <EmptyState
          icon={Megaphone}
          title="This announcement could not be loaded"
          description={state.error.message}
          action={
            <button
              type="button"
              onClick={cancel}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              Back to announcements
            </button>
          }
        />
      </>
    );
  }

  const announcement = state.data;
  const live = announcement?.isLive;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Edit announcement"
        description={announcement?.title || 'Announcement'}
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={live ? 'green' : 'slate'} dot={Boolean(live)}>
              {live ? 'Live now' : 'Not live'}
            </Badge>
            <Badge tone={announcement?.isActive ? 'brand' : 'slate'}>
              {announcement?.isActive ? 'Active' : 'Withdrawn'}
            </Badge>
            {announcement?.targetAudience === 'selected_schools' && (
              <Badge tone="slate">
                {formatCount(announcement.targetSchoolIds?.length || 0)} schools
              </Badge>
            )}
            <Badge tone="slate">By {announcement?.createdBy?.name || 'unknown'}</Badge>
          </div>
        }
      />

      {isImpersonating && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <p className="text-[12px] font-semibold leading-relaxed text-amber-900">
            Saving is blocked while you are impersonating a school. Writes on this route are
            refused server-side during an impersonation — end the session and try again.
          </p>
        </div>
      )}

      {/*
        The loaded document, handed straight in. `AnnouncementForm` re-seeds on the
        id, so a later refetch of the same announcement would not wipe the operator's
        edits — the wrapper deliberately has no reload button for that reason.
      */}
      <AnnouncementForm
        mode="edit"
        initial={announcement}
        onSubmit={submit}
        onCancel={cancel}
        submitLabel={isImpersonating ? 'Blocked while impersonating' : 'Save changes'}
      />
    </>
  );
};

export default AnnouncementEdit;