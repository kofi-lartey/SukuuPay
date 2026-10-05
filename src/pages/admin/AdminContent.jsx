import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Megaphone, Plus, X } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import Pagination from '../../components/students/Pagination';
import Badge from '../../components/dashboard/ui/Badge';
import Card from '../../components/dashboard/ui/Card';
import Modal from '../../components/common/Modal';
import { Field, SelectField, FormAlert } from '../../components/common/FormField';
import { useToast } from '../../hooks/useToast';
import { useImpersonation } from '../../hooks/useImpersonation';
import {
  AD_PLACEMENTS,
  AD_PLACEMENT_DETAILS,
  AD_STATUSES,
  listSchoolAds,
  reviewSchoolAd,
} from '../../services/admin';
import { formatCount } from '../../utils/format';
import { ROUTES } from '../../utils/constants';

const STATUS_TONES = {
  draft: 'slate',
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  expired: 'slate',
};

const placementLabel = (placement) => AD_PLACEMENT_DETAILS[placement]?.label || placement;

/**
 * The creative moderation queue, and the authoring form's way in.
 *
 * Backed end to end by `/api/admin/school-ads`. These five routes are the **only**
 * content surface in the product and the only ones that are **undocumented** —
 * Module 18 of `Backend/docs/MODULES_13_TO_17.md` stops at
 * `/admin/schools/:id/unsuspend` — so `services/admin.js` is currently the only
 * written record of their contract. Worth writing down before this grows.
 *
 * Four rules from the API shape the whole page:
 *
 *   - **Approve is the only status transition available**, and it is a body field
 *     on `PUT /admin/school-ads/:id/approve`, not a route per decision. So Approve
 *     and Reject are one dialog with a decision, and there is no status control on
 *     an edit form — `updateSchoolAdSchema` omits `status` deliberately, so an
 *     edit that tried to set it would be silently discarded and the operator would
 *     believe a creative had gone live.
 *   - **Rejecting requires a reason** (`approveSchoolAdSchema` 422s without one),
 *     because that reason is what gets told to the school that submitted it. So
 *     the field is required in the dialog rather than optional and regrettable.
 *   - **Creating is also two steps, but the steps are the operator's own.** A creative
 *     a super admin authors is posted straight (`publish: true` on
 *     `POST /admin/school-ads`), so it lands here already `approved`; one a school
 *     submits arrives `pending` and waits below. `AdminAdCreate` previews the ad before
 *     it posts rather than filing it for approval, because there is no second pair of
 *     eyes to file it for.
 *   - **There is no placement filter by default and that is not an oversight**: the
 *     schema defaults `placement` to `auth_aside`, and a moderation queue that only
 *     ever showed one placement would be a queue with the other two invisible.
 */
const AdminContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isImpersonating } = useImpersonation();
  const [reloadKey, setReloadKey] = useState(0);
  const [review, setReview] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [reason, setReason] = useState('');
  // The copy a moderator may adjust while deciding. Seeded from the ad on open and
  // submitted only when it differs — see `copyChanged` and `submitReview`.
  const [copy, setCopy] = useState({ headline: '', writeup: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      placement: searchParams.get('placement') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    listSchoolAds(filters)
      .then((result) => active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null }))
      .catch((error) => active && setState({ rows: [], meta: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (!value) params.delete(key);
          else params.set(key, value);
          if (key !== 'page') params.delete('page');
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const openReview = (ad, nextDecision) => {
    setReview(ad);
    setDecision(nextDecision);
    setReason('');
    setFormError(null);

    // The copy fields are seeded with what is stored, so the moderator *edits* the
    // school's words rather than retypes them. They are submitted only when they differ
    // — see `submitReview` — so an approve with no edit sends no copy at all and
    // `reviewSchoolAd` cannot record a change that did not happen.
    setCopy({
      headline: ad?.headline || '',
      writeup: ad?.writeup || '',
    });
  };

  /**
   * Whether the moderator actually changed anything.
   *
   * Compared against the stored values rather than tracked with a dirty flag, because a
   * dirty flag lies the moment someone types a character and deletes it — and the cost
   * of that lie is a permanent `copyEditedByReview: true` on an ad nobody edited, which
   * the school then sees as "an administrator adjusted the wording".
   */
  const copyChanged =
    Boolean(review) &&
    (copy.headline.trim() !== (review.headline || '') ||
      (copy.writeup || '').trim() !== (review.writeup || ''));

  const submitReview = async () => {
    if (!review) return;
    // Checked here for a better message than the server's 422, not instead of it:
    // the server is still the boundary, this just says which field is empty
    // instead of "A reason is required when rejecting an ad".
    if (decision === 'rejected' && reason.trim().length === 0) {
      setFormError('A rejection needs a reason. It is what the school is told.');
      return;
    }
    if (decision === 'rejected' && reason.trim().length > 300) {
      setFormError('Keep the reason under 300 characters.');
      return;
    }

    // An approval with edited copy must not be shorter than the schema allows. The
    // server rejects it either way; saying which field is at fault is the point of
    // checking here.
    if (decision === 'approved' && copy.headline.trim().length > 60) {
      setFormError('The headline is limited to 60 characters.');
      return;
    }
    if (decision === 'approved' && copy.writeup.trim().length > 600) {
      setFormError('The write-up is limited to 600 characters.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      // Copy rides along **only when it changed**, and only on an approval. Sending it
      // unconditionally would mark every approval as a copy edit and tell every school
      // an administrator rewrote their advertisement when they did not.
      const edited = decision === 'approved' && copyChanged;

      await reviewSchoolAd(review._id, {
        status: decision,
        rejectedReason: decision === 'rejected' ? reason.trim() : '',
        ...(edited
          ? { headline: copy.headline.trim(), writeup: copy.writeup.trim() }
          : {}),
      });

      setReview(null);
      refresh();
      toast.success(
        decision === 'approved'
          ? edited
            ? `${review.schoolName}’s creative is now live, with adjusted wording.`
            : `${review.schoolName}’s creative is now live.`
          : `${review.schoolName}’s creative was rejected and the reason recorded.`
      );
    } catch (error) {
      setFormError(error.message || 'This creative could not be reviewed.');
    } finally {
      setBusy(false);
    }
  };

  const hasFilters = Boolean(filters.status || filters.placement);

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Content"
        description="The creatives shown on the public pages. One you author here goes live as soon as you post it; one a school submits waits in this queue for your decision."
        actions={
          /*
            Authoring lives on its own page rather than in this header, for the same
            reason `announcements/new` does: this file is a queue of decisions, and a
            form inlined above it would push every row the operator came to judge
            below the fold.

            Disabled while impersonating, like `AnnouncementsList`. The server refuses
            every write during an impersonation (`IMPERSONATION_WRITE_ALLOWLIST` is
            just `/impersonate/end`), so the honest treatment is a control that says
            so rather than one that fails on submit.
          */
          <button
            type="button"
            onClick={() => navigate(ROUTES.ADMIN_CONTENT_NEW)}
            disabled={isImpersonating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New creative
          </button>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {AD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Placement"
            value={filters.placement}
            onChange={(event) => setFilter('placement', event.target.value)}
          >
            {/*
              "All placements" is an empty value, and an empty value means the
              query param is *omitted* — not sent as `placement=`. The API's schema
              defaults the parameter, so sending anything would narrow the queue to
              one slot and hide the rest of the submissions.
            */}
            <option value="">All placements</option>
            {AD_PLACEMENTS.map((placement) => (
              <option key={placement} value={placement}>
                {placementLabel(placement)}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={Megaphone}
            title="The content queue could not be loaded"
            description={state.error.message}
            action={
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
              >
                Try again
              </button>
            }
          />
        ) : state.loading && state.rows.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={hasFilters ? 'Nothing in the queue for these filters' : 'No creatives yet'}
            description={
              hasFilters
                ? 'Try a different status or placement.'
                : 'Schools can submit a creative for the public pages; each one arrives here for review. You can also author one yourself.'
            }
            action={
              hasFilters ? null : (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.ADMIN_CONTENT_NEW)}
                  disabled={isImpersonating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New creative
                </button>
              )
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {state.rows.map((ad) => (
                <li key={ad._id}>
                  <Card padding="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {/*
                        The creative itself, not a filename. The whole point of a
                        moderation queue is judging the image, and `imageAlt` is
                        shown beside it because the alt text is the only thing
                        describing this image to a screen reader on the login page.
                      */}
                      <div className="flex shrink-0 items-start gap-3 sm:w-[15rem]">
                        {ad.imageUrl ? (
                          <img
                            src={ad.imageUrl}
                            alt={ad.imageAlt || ''}
                            className="h-20 w-32 rounded-xl border border-slate-200 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400">
                            No creative
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-[13px] font-extrabold leading-tight text-ink">
                              {ad.headline || 'Untitled creative'}
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500">{ad.schoolName}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="slate">{placementLabel(ad.placement)}</Badge>
                            <Badge tone={STATUS_TONES[ad.status] || 'slate'} dot>
                              {ad.status}
                            </Badge>
                            {/*
                              `visibility` is the server's answer to "why is this not on
                              the login page?", computed from the same rule that serves
                              the public slider. It is shown for every approved creative
                              rather than only for hidden ones, because an operator
                              comparing the queue against the live page should be able
                              to see that the queue agrees with the page — and a
                              creative reading "Approved" with a silent empty login
                              panel is exactly the state that is impossible to
                              diagnose from the queue alone.
                            */}
                            {ad.status === 'approved' &&
                              (ad.visibility?.live ? (
                                <Badge tone="green">Showing</Badge>
                              ) : (
                                <Badge tone="amber" title={ad.visibility?.reason || undefined}>
                                  Not showing
                                </Badge>
                              ))}
                          </div>
                        </div>

                        {ad.status === 'approved' && ad.visibility?.reason && (
                          <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-amber-700">
                            {ad.visibility.reason}
                          </p>
                        )}

                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          <div className="flex gap-2 text-[11px]">
                            <dt className="font-semibold text-slate-400">Alt text</dt>
                            <dd className="min-w-0 truncate font-bold text-slate-600">
                              {ad.imageAlt || '— missing —'}
                            </dd>
                          </div>
                          <div className="flex gap-2 text-[11px]">
                            <dt className="font-semibold text-slate-400">Ends</dt>
                            <dd className="font-bold text-slate-600">
                              {ad.endsAt ? new Date(ad.endsAt).toLocaleDateString('en-GB') : '—'}
                            </dd>
                          </div>
                          <div className="flex gap-2 text-[11px] sm:col-span-2">
                            <dt className="shrink-0 font-semibold text-slate-400">Links to</dt>
                            <dd className="min-w-0 truncate font-mono font-bold text-slate-600">
                              {ad.linkUrl || '—'}
                            </dd>
                          </div>
                        </dl>

                        {ad.rejectedReason && (
                          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                            Rejected: {ad.rejectedReason}
                          </p>
                        )}

                        {/*
                          The action row is gated on status, not shown-then-disabled.
                          Only `pending` creatives can move — an approved creative
                          has no further status to reach — and a disabled Approve on
                          a live row implies a permission problem where there is a
                          lifecycle one.
                        */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {ad.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openReview(ad, 'approved')}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => openReview(ad, 'rejected')}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                Reject
                              </button>
                            </>
                          ) : (
                            <p className="text-[11px] font-semibold text-slate-400">
                              This creative is {ad.status}. Only pending creatives can be reviewed.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="creatives"
                onPageChange={(page) => setFilter('page', String(page))}
                onPerPageChange={(perPage) => {
                  setFilter('perPage', String(perPage));
                  setFilter('page', '1');
                }}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={decision === 'approved' ? 'Approve this creative' : 'Reject this creative'}
        description={
          review
            ? `${review.schoolName} — “${review.headline}”. ${
                decision === 'approved'
                  ? 'It becomes visible on the public pages immediately.'
                  : 'The school is shown the reason you give.'
              }`
            : ''
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setReview(null)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReview}
              disabled={busy}
              className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors disabled:opacity-60 ${
                decision === 'approved' ? 'bg-brand-700 hover:bg-brand-800' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {busy ? 'Saving…' : decision === 'approved' ? 'Approve and publish' : 'Reject'}
            </button>
          </>
        }
      >
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        {/*
          The creative, so the decision is made against what will actually be seen.
          Without it a moderator approves a headline they never read and discovers the
          image on the login page.
        */}
        <div className="mt-3 flex gap-3 rounded-xl bg-slate-50 p-3">
          {review?.imageUrl ? (
            <img
              src={review.imageUrl}
              alt={review.imageAlt || ''}
              className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-slate-800">{review?.headline}</p>
            {review?.writeup ? (
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                {review.writeup}
              </p>
            ) : (
              <p className="mt-1 text-[12px] font-semibold text-slate-400">
                No write-up — headline only.
              </p>
            )}
            {review?.linkUrl ? (
              <a
                href={review.linkUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 block truncate font-mono text-[11px] text-brand-700 underline underline-offset-2"
              >
                {review.linkUrl}
              </a>
            ) : null}
          </div>
        </div>

        {decision === 'approved' ? (
          /*
            The copy, editable — this is the product requirement that a super admin may
            author ad content as well as review a school's, and it is deliberately in
            the *same* dialog as the decision. Two round trips would leave a
            half-finished edit sitting in the queue.

            Only sent when it differs (`copyChanged`), so approving without touching
            anything does not record a copy edit and does not tell the school an
            administrator rewrote their words.
          */
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Copy
              </p>
              {copyChanged ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-extrabold text-blue-700">
                  Will be adjusted
                </span>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="review-headline"
                className="block text-[11px]/[15px] font-semibold text-slate-700"
              >
                Headline
              </label>
              <input
                id="review-headline"
                type="text"
                value={copy.headline}
                onChange={(event) =>
                  setCopy((current) => ({ ...current, headline: event.target.value }))
                }
                maxLength={60}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] font-semibold text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                {copy.headline.length}/60 · shown as the bold line
              </p>
            </div>

            <div>
              <label
                htmlFor="review-writeup"
                className="block text-[11px]/[15px] font-semibold text-slate-700"
              >
                Write-up
              </label>
              <textarea
                id="review-writeup"
                rows={4}
                value={copy.writeup}
                onChange={(event) =>
                  setCopy((current) => ({ ...current, writeup: event.target.value }))
                }
                maxLength={600}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                {copy.writeup.length}/600 · the school is told when the wording changes
              </p>
            </div>
          </div>
        ) : (
          <Field
            label="Reason"
            required
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What has to change before this can run?"
            hint={`${reason.trim().length}/300`}
            className="mt-3"
          />
        )}
      </Modal>
    </>
  );
};

export default AdminContent;