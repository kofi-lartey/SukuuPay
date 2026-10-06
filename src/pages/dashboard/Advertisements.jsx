import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ImagePlus, Megaphone, TriangleAlert, XCircle } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import Badge from '../../components/dashboard/ui/Badge';
import EmptyState from '../../components/dashboard/EmptyState';
import Pagination from '../../components/students/Pagination';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import { listAdRequests, createAdRequest, withdrawAdRequest, AD_PLACEMENTS } from '../../services/adRequests';

/**
 * Ask to be advertised, and see what happened to the ask.
 *
 * ## The two halves are one screen
 *
 * The list is not a secondary tab. A school that submits an ad and lands on a form with
 * no sign of it is a school that submits it again, and a school whose request was
 * declined needs the reason *and* the ability to try again — both of which are the list.
 * So the form and the history share the page.
 *
 * ## The copy is editable twice, by two different people
 *
 * A school writes the headline and the writeup; the platform may adjust both before
 * publishing. When it does, `copyEditedByReview` is set and the row says so — because
 * discovering on the login page that your advertisement says something you did not
 * write is a trust problem, not a copy problem.
 *
 * ## Withdrawing is not deleting
 *
 * Only a request nobody has reviewed can be withdrawn. Once a moderator has approved it
 * the ad is live on public pages and taking it down is the platform's decision, so the
 * action is hidden and the server refuses it regardless.
 */

const STATUS_PRESENTATION = {
  pending: {
    tone: 'amber',
    icon: Clock,
    label: 'Waiting for review',
    next: 'A platform administrator is reviewing this. You will hear once they decide.',
  },
  draft: {
    tone: 'slate',
    icon: Clock,
    label: 'Draft',
    next: 'Not submitted yet.',
  },
  approved: {
    tone: 'green',
    icon: CheckCircle2,
    label: 'Live',
    next: 'This advertisement is running.',
  },
  rejected: {
    tone: 'red',
    icon: XCircle,
    label: 'Declined',
    next: 'This was declined. The reason is below — you can submit a new request.',
  },
  expired: {
    tone: 'slate',
    icon: Clock,
    label: 'Ended',
    next: 'This advertisement is no longer running.',
  },
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Waiting for review' },
  { key: 'approved', label: 'Live' },
  { key: 'rejected', label: 'Declined' },
];

/** A 60-day default: long enough to be useful, and never in the past. */
const defaultEndsAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  return date.toISOString().slice(0, 10);
};

const Advertisements = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [form, setForm] = useState({
    headline: '',
    writeup: '',
    imageAlt: '',
    linkUrl: '',
    placement: 'advertisement_page',
    endsAt: defaultEndsAt(),
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [list, setList] = useState({ rows: [], meta: null, loading: true });
  const [confirming, setConfirming] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    setList((current) => ({ ...current, loading: true }));

    listAdRequests({ status, page })
      .then((result) => {
        if (active) setList({ rows: result.rows, meta: result.meta, loading: false });
      })
      .catch((error) => {
        if (active) {
          setList({ rows: [], meta: null, loading: false });
          toast?.error?.(error?.message || 'Your requests could not be loaded.');
        }
      });

    return () => {
      active = false;
    };
  }, [status, page, reloadKey, toast]);

  // Object URLs for the image preview are revoked on replace and on unmount — a leaked
  // blob survives for the life of the tab, which on a low-memory handset is a crash
  // rather than a leak.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const setField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: null }));
  };

  const onPickImage = (event) => {
    const picked = event.target.files?.[0] || null;

    setErrors((current) => ({ ...current, file: null }));

    if (preview) URL.revokeObjectURL(preview);
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);

    // Alt text is the accessibility of the ad, and it is required — but auto-filling it
    // from the filename would be worse than asking, since "IMG_4821.jpg" describes
    // nothing. Left blank deliberately.
  };

  /** Mirrors `createSchoolAdRequestSchema`, so the round trip is not the first check. */
  const validateForm = () => {
    const found = {};
    const trimmedHeadline = form.headline.trim();

    if (trimmedHeadline.length < 4) found.headline = 'At least 4 characters';
    if (trimmedHeadline.length > 60) found.headline = '60 characters is the limit';
    if (form.writeup.length > 600) found.writeup = '600 characters is the limit';
    if (!file) found.file = 'Choose an image';
    if (form.imageAlt.trim().length < 5) found.imageAlt = 'Describe the image';
    if (!/^https:\/\/\S+$/i.test(form.linkUrl.trim())) {
      found.linkUrl = 'A full https:// link, e.g. https://yourschool.edu.gh';
    }
    if (!form.endsAt) found.endsAt = 'Choose an end date';
    else if (new Date(form.endsAt) <= new Date()) found.endsAt = 'Choose a date in the future';

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setConfirming(null);

    try {
      await createAdRequest({ file, ...form, headline: form.headline.trim(), writeup: form.writeup.trim() });

      toast?.success?.('Your advertisement request has been sent for review.');

      // Cleared rather than kept: a second identical submission is almost certainly a
      // mistake, and the list now shows the first one.
      setForm({
        headline: '',
        writeup: '',
        imageAlt: '',
        linkUrl: '',
        placement: form.placement,
        endsAt: defaultEndsAt(),
      });
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileInput.current) fileInput.current.value = '';

      setReloadKey((key) => key + 1);
      setStatus('all');
      setPage(1);
    } catch (error) {
      toast?.error?.(error?.message || 'Your request could not be sent.');
    } finally {
      setSubmitting(false);
    }
  };

  const onWithdraw = async () => {
    setBusyId(confirming?._id);
    try {
      await withdrawAdRequest(confirming._id);
      toast?.success?.('Request withdrawn.');
      setConfirming(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast?.error?.(error?.message || 'That request could not be withdrawn.');
    } finally {
      setBusyId(null);
    }
  };

  const placementLabel = useMemo(
    () => (value) => AD_PLACEMENTS.find((p) => p.value === value)?.label || value,
    []
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Advertising"
        title="Advertise your school"
        description="Put your school in front of parents. A platform administrator reviews every request before it appears anywhere — you will be told the decision and why."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── The form ── */}
        <Card padding="p-5">
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            Submit a request
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="ad-headline" className="block text-[13px] font-bold text-slate-700">
                Headline
              </label>
              <input
                id="ad-headline"
                type="text"
                value={form.headline}
                onChange={setField('headline')}
                maxLength={60}
                placeholder="Admissions open for 2026/27"
                className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] font-semibold text-slate-900 focus:outline-none ${
                  errors.headline ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              <div className="mt-1 flex items-start justify-between gap-2">
                {errors.headline ? (
                  <p className="text-[12px] font-semibold text-red-600">{errors.headline}</p>
                ) : (
                  <p className="text-[12px] text-slate-500">Shown as the bold line.</p>
                )}
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {form.headline.length}/60
                </span>
              </div>
            </div>

            {/* The writeup. This is why `headline`'s 60-character cap is survivable:
                without it there would be exactly one sentence to say everything. */}
            <div>
              <label htmlFor="ad-writeup" className="block text-[13px] font-bold text-slate-700">
                Write-up
                <span className="ml-1.5 font-semibold text-slate-400">optional</span>
              </label>
              <textarea
                id="ad-writeup"
                rows={4}
                value={form.writeup}
                onChange={setField('writeup')}
                maxLength={600}
                placeholder="What should a parent know? Fees, subjects, the boarding option, where to apply."
                className={`mt-1.5 w-full rounded-xl border-2 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-slate-900 focus:outline-none ${
                  errors.writeup ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              <div className="mt-1 flex items-start justify-between gap-2">
                {errors.writeup ? (
                  <p className="text-[12px] font-semibold text-red-600">{errors.writeup}</p>
                ) : (
                  <p className="text-[12px] text-slate-500">
                    A platform administrator may adjust this before publishing.
                  </p>
                )}
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {form.writeup.length}/600
                </span>
              </div>
            </div>

            <div>
              <span className="block text-[13px] font-bold text-slate-700">Image</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-3">
                <label
                  htmlFor="ad-image"
                  className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 text-[13px] font-extrabold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  {file ? 'Choose another' : 'Choose an image'}
                </label>
                <input
                  ref={fileInput}
                  id="ad-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onPickImage}
                  className="sr-only"
                />
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="text-[12px] font-semibold text-slate-400">
                    PNG, JPEG or WebP
                  </span>
                )}
              </div>
              {errors.file ? (
                <p className="mt-1 text-[12px] font-semibold text-red-600">{errors.file}</p>
              ) : null}
            </div>

            {/* Required by the server and by every accessibility rule, and these render
                on public pages where there is no alt text to infer from context. */}
            <div>
              <label htmlFor="ad-alt" className="block text-[13px] font-bold text-slate-700">
                Describe the image
              </label>
              <input
                id="ad-alt"
                type="text"
                value={form.imageAlt}
                onChange={setField('imageAlt')}
                maxLength={160}
                placeholder="Students in the science laboratory"
                className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] text-slate-900 focus:outline-none ${
                  errors.imageAlt ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              <p className="mt-1 text-[12px] text-slate-500">
                Read aloud to anyone using a screen reader.
              </p>
              {errors.imageAlt ? (
                <p className="mt-1 text-[12px] font-semibold text-red-600">{errors.imageAlt}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="ad-link" className="block text-[13px] font-bold text-slate-700">
                Where should this link to?
              </label>
              <input
                id="ad-link"
                type="url"
                inputMode="url"
                value={form.linkUrl}
                onChange={setField('linkUrl')}
                placeholder="https://yourschool.edu.gh/admissions"
                className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] text-slate-900 focus:outline-none ${
                  errors.linkUrl ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                }`}
              />
              {errors.linkUrl ? (
                <p className="text-[12px] font-semibold text-red-600">{errors.linkUrl}</p>
              ) : (
                <p className="mt-1 text-[12px] text-slate-500">Must start with https://</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ad-placement"
                  className="block text-[13px] font-bold text-slate-700"
                >
                  Where it appears
                </label>
                <select
                  id="ad-placement"
                  value={form.placement}
                  onChange={setField('placement')}
                  className="mt-1.5 min-h-[48px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-900 focus:border-[#0A5C36] focus:outline-none"
                >
                  {AD_PLACEMENTS.map((placement) => (
                    <option key={placement.value} value={placement.value}>
                      {placement.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-slate-500">
                  {AD_PLACEMENTS.find((p) => p.value === form.placement)?.help}
                </p>
              </div>

              <div>
                <label
                  htmlFor="ad-ends"
                  className="block text-[13px] font-bold text-slate-700"
                >
                  Run until
                </label>
                <input
                  id="ad-ends"
                  type="date"
                  value={form.endsAt}
                  onChange={setField('endsAt')}
                  className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3 text-[15px] text-slate-900 focus:outline-none ${
                    errors.endsAt ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
                  }`}
                />
                {errors.endsAt ? (
                  <p className="mt-1 text-[12px] font-semibold text-red-600">{errors.endsAt}</p>
                ) : null}
              </div>
            </div>
          </div>

          <Button
            onClick={() => {
              if (validateForm()) setConfirming(true);
            }}
            disabled={submitting}
            className="mt-5"
            full
            icon={Megaphone}
          >
            {submitting ? 'Sending…' : 'Submit for review'}
          </Button>
        </Card>

        {/* ── The history ── */}
        <div>
          <div className="mb-3">
            <div
              role="tablist"
              aria-label="Filter requests"
              className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.key}
                  onClick={() => {
                    setStatus(tab.key);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${
                    status === tab.key
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {list.loading && list.rows.length === 0 ? (
            <div className="space-y-2">
              {[0, 1].map((key) => (
                <Card key={key} padding="p-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2.5 h-3 w-full animate-pulse rounded bg-slate-100" />
                </Card>
              ))}
            </div>
          ) : null}

          {!list.loading && list.rows.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={status === 'all' ? 'No requests yet' : 'Nothing in this filter'}
              description={
                status === 'all'
                  ? 'Submit one with the form and it will appear here, with its decision.'
                  : 'Try another tab to see the rest of your history.'
              }
            />
          ) : null}

          <ul className="space-y-2">
            {list.rows.map((row) => {
              const presentation =
                STATUS_PRESENTATION[row.status] || STATUS_PRESENTATION.draft;
              const Icon = presentation.icon;
              // The server refuses anything already reviewed, so the action is hidden
              // rather than disabled with an explanation nobody reads.
              const canWithdraw = ['pending', 'draft'].includes(row.status);

              return (
                <li key={row._id}>
                  <Card padding="p-4">
                    <div className="flex items-start gap-3">
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-14 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={presentation.tone} icon={Icon}>
                            {presentation.label}
                          </Badge>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {placementLabel(row.placement)}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[14px] font-extrabold text-ink">
                          {row.headline}
                        </p>

                        {/* The writeup is echoed back, so a school can read what will
                            actually run — including an administrator's edit. */}
                        {row.writeup ? (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                            {row.writeup}
                          </p>
                        ) : null}

                        {row.copyEditedByReview ? (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-blue-800">
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            A platform administrator adjusted the wording before publishing.
                            This is the final copy.
                          </p>
                        ) : null}

                        {row.rejectedReason ? (
                          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-red-800">
                            Reason: {row.rejectedReason}
                          </p>
                        ) : null}

                        <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-500">
                          {presentation.next}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Submitted{' '}
                            {new Date(row.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {row.endsAt
                              ? ` · ran until ${new Date(row.endsAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}`
                              : ''}
                          </span>

                          {canWithdraw ? (
                            <button
                              type="button"
                              onClick={() => setConfirming(row)}
                              disabled={busyId === row._id}
                              className="text-[12px] font-extrabold text-slate-500 underline underline-offset-2 hover:text-red-600 disabled:opacity-50"
                            >
                              Withdraw
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {list.meta && list.meta.totalPages > 1 ? (
            <div className="mt-4">
              <Pagination meta={list.meta} onPageChange={setPage} />
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Confirm submit ──
          The last point at which the school can change its mind: once the request is
          sent a moderator is looking at it. */}
      <Modal
        open={confirming && !confirming._id}
        onClose={() => setConfirming(null)}
        title="Send this for review?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep editing
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send for review'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3">
            {preview ? (
              <img
                src={preview}
                alt=""
                className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-ink">{form.headline}</p>
              <p className="text-[12px] font-semibold text-slate-500">
                {placementLabel(form.placement)}
              </p>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-slate-600">
            A platform administrator reviews this before it appears anywhere. They may
            adjust the wording, and you will be able to read the final copy here.
          </p>
        </div>
      </Modal>

      {/* ── Confirm withdraw ── */}
      <Modal
        open={Boolean(confirming?._id)}
        onClose={() => setConfirming(null)}
        title="Withdraw this request?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={onWithdraw} disabled={Boolean(busyId)}>
              Withdraw request
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-slate-600">
          {confirming?.headline} will be taken off the review list. You can submit a new
          request at any time.
        </p>
      </Modal>
    </div>
  );
};

export default Advertisements;