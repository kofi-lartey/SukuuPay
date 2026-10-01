import React, { useState } from 'react';
import {
  Ban,
  CheckCheck,
  CircleAlert,
  CircleDollarSign,
  Loader2,
  Send,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import Tile from '../dashboard/ui/Tile';
import Card from '../dashboard/ui/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import { SelectField } from '../common/FormField';
import { useToast } from '../../hooks/useToast';
import { formatCedi, formatCediShort, formatCount, formatPercent } from '../../utils/format';

/**
 * The History tab: what has been sent, what it cost, and what happened.
 *
 * Two tables because they answer different questions and neither is a subset of
 * the other. The **broadcasts** are "what did I decide to do, and did it work?"
 * The **messages** are "what happened to individual sends?" — a delivery report
 * problem, a duplicate, a wrong number. A bursar chasing one bounced message
 * needs the second and does not care about the first; a bursar reconciling
 * their bill needs the first and will not find it in a per-message list.
 *
 * The delivery rate deliberately excludes messages still awaiting a report. A
 * message the carrier has not yet ruled on is not a failure, and counting it as
 * one would make a school's rate collapse the instant it sends a batch — the
 * exact moment they are most likely to look at it.
 */

/** Status → badge tone. `unknown` is grey, not red: an unmapped provider code is
 *  a gap in our mapping, not a delivery failure. */
const STATUS_TONES = {
  queued: 'slate',
  submitted: 'blue',
  sent: 'blue',
  delivered: 'green',
  failed: 'red',
  failed_dlr: 'red',
  rejected: 'rose',
  unknown: 'slate',
};

const STATUS_LABELS = {
  queued: 'Queued',
  submitted: 'Submitted',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed to send',
  failed_dlr: 'Dropped by carrier',
  rejected: 'Rejected',
  unknown: 'Unknown',
};

const JOB_TONES = {
  queued: 'slate',
  scheduled: 'blue',
  processing: 'amber',
  cancelling: 'amber',
  cancelled: 'slate',
  completed: 'green',
  failed: 'red',
};

const CATEGORY_LABELS = {
  fee_reminder: 'Fee Reminder',
  overdue: 'Overdue',
  final_warning: 'Final Warning',
  installment_due: 'Installment Due',
  payment_receipt: 'Receipt',
  announcement: 'Announcement',
  pta: 'PTA',
  custom: 'Custom',
};

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** One broadcast row. */
const JobRow = ({ job, onCancel, busy }) => {
  const result = job.result || {};
  const settled = (result.sent || 0) + (result.delivered || 0);
  const cancellable = ['queued', 'scheduled'].includes(job.status);

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <p className="text-[12px] font-extrabold text-ink">
          {CATEGORY_LABELS[job.category] || job.category}
        </p>
        <p className="text-[11px] font-semibold text-slate-500">
          {formatCount(job.recipientsResolved)} recipient
          {job.recipientsResolved === 1 ? '' : 's'} &middot;{' '}
          {job.audienceType?.replace(/_/g, ' ')}
        </p>
      </td>

      <td className="px-4 py-3">
        <Badge tone={JOB_TONES[job.status] || 'slate'}>{job.status}</Badge>
        {job.status === 'processing' && (
          <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-700 transition-all"
              style={{ width: `${job.progressPercent || 0}%` }}
            />
          </div>
        )}
        {job.failureReason && (
          <p className="mt-1 max-w-[24ch] truncate text-[10px] font-semibold text-red-600">
            {job.failureReason}
          </p>
        )}
      </td>

      <td className="px-4 py-3 text-[12px] font-semibold text-slate-600">
        {settled ? (
          <>
            {formatCount(result.delivered || 0)} delivered
            {result.failed ? `, ${formatCount(result.failed)} failed` : ''}
          </>
        ) : (
          '—'
        )}
      </td>

      <td className="px-4 py-3 text-[12px] font-extrabold text-ink">
        {formatCediShort(job.creditsCharged || 0)}
        {job.creditsRefunded > 0 && (
          <span className="block text-[10px] font-semibold text-emerald-600">
            {formatCediShort(job.creditsRefunded)} refunded
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-[11px] font-semibold text-slate-500">
        {job.status === 'scheduled' && job.scheduledAt
          ? `Sends ${formatWhen(job.scheduledAt)}`
          : formatWhen(job.createdAt)}
      </td>

      <td className="px-4 py-3 text-right">
        {cancellable && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-extrabold text-slate-600 transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            <Ban className="h-3 w-3" aria-hidden="true" />
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
};

/** One message row. */
const MessageRow = ({ message }) => {
  const student = message.studentId || {};

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <p className="text-[12px] font-extrabold text-ink">
          {student.studentName || 'Unknown student'}
        </p>
        <p className="text-[11px] font-semibold text-slate-500">
          {student.studentClass || '—'} &middot; {message.toMasked || message.to}
        </p>
      </td>

      <td className="max-w-[28ch] px-4 py-3">
        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-600">
          {message.message}
        </p>
        {message.segments > 1 && (
          <span className="mt-0.5 inline-block text-[10px] font-bold text-amber-700">
            {message.segments} parts
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge tone={STATUS_TONES[message.status] || 'slate'}>
          {STATUS_LABELS[message.status] || message.status}
        </Badge>
        {message.network && (
          <span className="mt-1 block text-[10px] font-semibold uppercase text-slate-400">
            {message.network}
          </span>
        )}
        {message.failureReason && (
          <p className="mt-1 max-w-[22ch] truncate text-[10px] font-semibold text-red-600">
            {message.failureReason}
          </p>
        )}
      </td>

      <td className="px-4 py-3 text-[11px] font-semibold text-slate-500">
        {formatWhen(message.sentAt || message.createdAt)}
      </td>
    </tr>
  );
};

const EmptyRow = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-[12px] font-semibold text-slate-500">
      {children}
    </td>
  </tr>
);

const HistoryTab = ({
  jobs,
  jobsMeta,
  messages,
  messagesMeta,
  loading,
  error,
  filters,
  setFilter,
  clearFilters,
  credits,
  deliveryRate,
  usage,
  balance,
  ratePes,
  onCancelJob,
  busyJobId,
}) => {
  const { warning, error: errorToast } = useToast();
  const [pendingCancel, setPendingCancel] = useState(null);

  const runCancel = async () => {
    const id = pendingCancel;
    setPendingCancel(null);
    try {
      await onCancelJob(id);
      warning('The broadcast was cancelled and its credit returned.');
    } catch (err) {
      errorToast(err?.message || 'The broadcast could not be cancelled.');
    }
  };

  const hasFilters = filters.status !== 'all' || filters.category !== 'all' || filters.search;

  return (
    <div className="space-y-5">
      {/* The band. Cost, coverage and balance, because a bursar reconciling an
          invoice is asking all three at once. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Delivery Rate"
          icon={TrendingUp}
          value={deliveryRate === null ? '—' : formatPercent(deliveryRate)}
          valueTone={deliveryRate === null ? 'text-slate-400' : deliveryRate >= 90 ? 'text-emerald-600' : 'text-amber-600'}
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              Of messages the carrier has ruled on
            </p>
          }
        />

        <Tile
          label="Messages Sent"
          icon={Send}
          value={formatCount((usage?.sent || 0) + (usage?.delivered || 0))}
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(usage?.failed || 0)} failed
            </p>
          }
        />

        <Tile
          label="Credit Used"
          icon={CircleDollarSign}
          value={formatCedi((usage?.netCharged || 0) * ratePes)}
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(usage?.netCharged || 0)} SMS
              {usage?.refunded ? `, ${formatCount(usage.refunded)} refunded` : ''}
            </p>
          }
        />

        <Tile
          label="Balance"
          icon={Wallet}
          badge={<Badge tone="amber">{formatCount(balance ?? 0)} SMS</Badge>}
          value={formatCedi((balance ?? 0) * ratePes)}
          footer={
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(balance ?? 0)} messages remaining
            </p>
          }
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-red-700">{error.message}</p>
        </div>
      )}

      {/* Broadcasts. */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-[13px] font-extrabold text-ink">Broadcasts</h2>
          {jobsMeta?.total > 0 && (
            <p className="text-[11px] font-semibold text-slate-500">
              {formatCount(jobsMeta.total)} total
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {['Broadcast', 'Status', 'Outcome', 'Cost', 'When', ''].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <EmptyRow colSpan={6}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading broadcasts…
                  </span>
                </EmptyRow>
              )}

              {!loading && !jobs.length && (
                <EmptyRow colSpan={6}>
                  No broadcasts yet. Compose one and it will appear here with its
                  cost and delivery outcome.
                </EmptyRow>
              )}

              {!loading &&
                jobs.map((job) => (
                  <JobRow
                    key={job._id}
                    job={job}
                    busy={busyJobId === job._id}
                    onCancel={() => setPendingCancel(job)}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Messages. */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-[13px] font-extrabold text-ink">Messages</h2>

          <div className="flex flex-wrap items-end gap-2">
            <SelectField
              label="Status"
              className="w-40"
              value={filters.status}
              onChange={(event) => setFilter({ status: event.target.value })}
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Category"
              className="w-40"
              value={filters.category}
              onChange={(event) => setFilter({ category: event.target.value })}
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mb-0.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {messagesMeta?.statusCounts && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
            <CheckCheck className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {Object.entries(messagesMeta.statusCounts).map(([status, count]) => (
              <Badge key={status} tone={STATUS_TONES[status] || 'slate'}>
                {formatCount(count)} {STATUS_LABELS[status]?.toLowerCase() || status}
              </Badge>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                {['Recipient', 'Message', 'Status', 'Sent'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <EmptyRow colSpan={4}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading messages…
                  </span>
                </EmptyRow>
              )}

              {!loading && !messages.length && (
                <EmptyRow colSpan={4}>
                  {hasFilters
                    ? 'No messages match these filters.'
                    : 'No messages yet. Every SMS this school sends is recorded here with its delivery status.'}
                </EmptyRow>
              )}

              {!loading &&
                messages.map((message) => <MessageRow key={message._id} message={message} />)}
            </tbody>
          </table>
        </div>

        {messagesMeta?.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5">
            <p className="text-[11px] font-semibold text-slate-500">
              Page {messagesMeta.page} of {messagesMeta.totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={messagesMeta.page <= 1}
                onClick={() => setFilter({ page: messagesMeta.page - 1 }, { resetPage: false })}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={messagesMeta.page >= messagesMeta.totalPages}
                onClick={() => setFilter({ page: messagesMeta.page + 1 }, { resetPage: false })}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Cancelling is a refund, so it gets the same second click as a send. A
          queued broadcast has sent nothing, so cancelling it is exact — which is
          exactly why it is safe to offer, and why the button only appears for
          `queued` and `scheduled`. */}
      <Modal
        open={Boolean(pendingCancel)}
        onClose={() => setPendingCancel(null)}
        title="Cancel this broadcast?"
        description={
          pendingCancel
            ? `${formatCount(pendingCancel.recipientsResolved)} parents were queued. Cancelling returns the full ${formatCediShort(pendingCancel.creditsCharged || 0)} in credit and nothing is sent.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingCancel(null)}>
              Keep it queued
            </Button>
            <Button variant="danger" onClick={runCancel}>
              Cancel and refund
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-slate-600">
          A broadcast that has already started sending cannot be cancelled — messages
          the gateway has accepted are on their way. This one has not started.
        </p>
      </Modal>
    </div>
  );
};

export default HistoryTab;
