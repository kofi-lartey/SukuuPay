import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/dashboard/PageHeader';
import AnnouncementForm from './AnnouncementForm';
import { useToast } from '../../../hooks/useToast';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { createAnnouncement } from '../../../services/admin';
import { ROUTES } from '../../../utils/constants';

/**
 * `/admin/announcements/new` — publish a notice.
 *
 * Thin by design. Everything about *what* an announcement is — the audience rules,
 * the window validation, the conditional school picker, the plain-text body — lives
 * in `AnnouncementForm`, because the edit route needs all of it too and two copies
 * of that logic are two places for the `targetSchoolIds` inversion to be right in
 * one and wrong in the other.
 *
 * What this wrapper owns, and the three things that only the route knows:
 *
 *   - **Which service call.** `createAnnouncement` always writes `isActive: true`
 *     (`announcements.service.js:323`) and records `createdBy` from the request's
 *     user, so the form has nothing to ask for that this page does not supply.
 *   - **What happens on success: navigation.** Publishing does not leave the
 *     operator on an empty form that looks still-editable; it goes to the list,
 *     where the new notice appears at the top of the ordering the backend uses
 *     (`sort({ startsAt: -1 })`) — or, for a notice scheduled for the future,
 *     further down, correctly reading as *scheduled* rather than *live*.
 *   - **What happens on failure: nothing.** `submit` returns `{ ok, error }` and
 *     the form keeps every field, so a 400 `TARGET_SCHOOLS_NOT_ALLOWED` — the one
 *     this endpoint raises when the audience and the target list contradict each
 *     other — is a sentence above the operator's untouched draft rather than a
 *     blank page.
 */
const AnnouncementCreate = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isImpersonating } = useImpersonation();

  const submit = useCallback(
    async (payload) => {
      try {
        const created = await createAnnouncement(payload);
        toast.success(
          created?.startsAt && new Date(created.startsAt).getTime() > Date.now()
            ? `“${created.title || payload.title}” is scheduled. It will appear when its start time arrives.`
            : `“${created?.title || payload.title}” is live. Every school in its audience can see it now.`
        );
        navigate(ROUTES.ADMIN_ANNOUNCEMENTS);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'This announcement could not be created.' };
      }
    },
    [navigate, toast]
  );

  const cancel = useCallback(() => navigate(ROUTES.ADMIN_ANNOUNCEMENTS), [navigate]);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="New announcement"
        description="A notice shown in school dashboards. It can go out to every school or to schools you name, now or at a time you choose."
      />

      {isImpersonating && (
        <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <p className="text-[12px] font-semibold leading-relaxed text-amber-900">
            Publishing is blocked while you are impersonating a school. Writes on this route are
            refused server-side during an impersonation — end the session and try again.
          </p>
        </div>
      )}

      <AnnouncementForm
        mode="create"
        initial={null}
        onSubmit={submit}
        onCancel={cancel}
        submitLabel={isImpersonating ? 'Blocked while impersonating' : 'Publish announcement'}
      />
    </>
  );
};

export default AnnouncementCreate;