import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, RotateCcw, Wallet } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Pagination from '../../../components/students/Pagination';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import { Field, SelectField } from '../../../components/common/FormField';
import SchoolSelect from '../../../components/admin/finance/SchoolSelect';
import ApproveBatchModal from '../../../components/admin/finance/ApproveBatchModal';
import RetryBatchModal from '../../../components/admin/finance/RetryBatchModal';
import CreateBatchModal from '../../../components/admin/finance/CreateBatchModal';
import {
  DISBURSEMENT_LABEL,
  DISBURSEMENT_TONE,
  canApprove,
  canRetry,
  periodLabel,
} from '../../../components/admin/finance/financeVocabulary';
import { useToast } from '../../../hooks/useToast';
import {
  approveDisbursement,
  createDisbursement,
  DISBURSEMENT_STATUSES,
  listDisbursements,
  retryDisbursement,
} from '../../../services/finance';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedi, formatCount } from '../../../utils/format';
import { formatDate } from '../../../utils/dates';

/**
 * `/admin/finance/disbursements` — the payout queue.
 *
 * ### The row actions are the row's status, not a uniform control strip
 *
 * This table is the one place in the console where a button that cannot work is
 * genuinely dangerous rather than merely untidy. **Approve is offered only on a
 * `pending_approval` batch, and Retry only on a `failed` one** — the same rule
 * `APPROVABLE_DISBURSEMENT_STATUSES` and the server's own state checks enforce
 * (`disbursements.service.js:753-765`, `:820-826`).
 *
 * The rejected alternative is the obvious one: give every row both buttons and let
 * the server refuse the wrong combination. That teaches the operator two things,
 * both wrong — that the controls are unreliable, and that a refusal is a normal
 * outcome of pressing them. A Retry on a `paid` batch can only ever return a 409
 * naming the status it found; presenting it as available means offering an action
 * whose only possible result is an error. An action cell that shows one button on
 * four rows in seven is telling the operator something true.
 *
 * `canApprove` and `canRetry` live in `financeVocabulary.js` rather than here,
 * because the detail screen asks the same question about the same enum and two
 * copies of "which statuses are actionable" is how they drift.
 *
 * ### The whole row opens the batch, and the actions stay reachable
 *
 * The row *is* the record an operator scans — number, school, window, the three
 * figures, the status — so the row is the target. The buttons inside it
 * `stopPropagation`, because an operator who approves and then discovers they also
 * navigated will not do it twice. Same pattern as `AdminSchools.jsx:307-319`.
 *
 * ### `approvedBy` is null on purpose and the cell says so
 *
 * A job-approved batch carries `approvedBy: null` and `metadata.approvedByRule:
 * 'auto-approve-setting'` instead — deliberately, because an approval column
 * exists so a machine decision is never attributed to a person
 * (`DisbursementBatch.js:21`). Rendering that as a blank cell would read as a bug;
 * rendering it as a name would be the lie the column exists to prevent. So it
 * reads "Auto-approve setting".
 *
 * ### `attempts` is not a transfer count
 *
 * It is incremented once on entering `processing` and again when a provider call
 * fails, so the parked-`approved` case — no provider wired — reads one attempt and
 * zero transfers (`disbursements.service.js:783`, `:279`). The column is annotated
 * and the caveat is repeated under the table, because "attempts" beside a `paid`
 * batch invites the reading that a number above one means something went wrong,
 * when it is the normal count for a retry.
 *
 * ### Two cells are honest about what the endpoint does not send
 *
 * The list populates `schoolId` and nothing else, so:
 *
 *   - **"Approved by"** carries the approver's id but not their name — `getDisbursement`
 *     resolves that one (`disbursements.service.js:936`). Rather than a column of
 *     hex or an invented name, the cell links to the batch.
 *
 * A plausible-looking placeholder would have been the lie here; "the answer is one
 * click away" is the version an operator can act on.
 */
const DisbursementsList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [approveTarget, setApproveTarget] = useState(null);
  const [retryTarget, setRetryTarget] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      schoolId: searchParams.get('schoolId') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      page: Number(searchParams.get('page')) || 1,
      perPage: Number(searchParams.get('perPage')) || 20,
    }),
    [searchParams]
  );

  const [state, setState] = useState({ rows: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    listDisbursements(filters)
      .then((result) =>
        active && setState({ rows: result.rows, meta: result.meta, loading: false, error: null })
      )
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

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const hasFilters = Boolean(filters.status || filters.schoolId || filters.from || filters.to);

  /**
   * `{ ok, error }`, never a throw, so a refused approval leaves its dialog open.
   *
   * The success wording is derived from the **returned batch's `payoutReference`**
   * rather than from the fact that the request succeeded. That is the whole
   * honesty problem on this screen: `services/finance.js` returns `data.data`,
   * which drops the response's `meta.payoutProviderWired`, so the field that
   * actually says "a transfer was attempted" is not available to the client. A
   * `payoutReference` is the better signal anyway — the server writes it only from
   * a provider's own transfer id, so its absence is positive evidence that nothing
   * moved — and reporting "approved, nothing sent" is the difference between an
   * operator who knows the school has not been paid and one who assumes it has.
   */
  const confirmApprove = useCallback(
    async (batches) => {
      const list = Array.isArray(batches) ? batches : [batches];
      const failures = [];
      let sent = 0;

      for (const batch of list) {
        try {
          const updated = await approveDisbursement(batch._id);
          if (updated?.payoutReference) sent += 1;
        } catch (error) {
          failures.push({
            id: batch._id,
            batchNumber: batch.batchNumber,
            error: error.message || 'Refused by the server.',
          });
        }
      }

      if (failures.length === 0) {
        toast.success(
          sent === list.length
            ? `${list[0].batchNumber} paid out.`
            : `${list[0].batchNumber} approved — but no payout provider is wired, so the money has not moved. It stays held.`
        );
        refresh();
        return { ok: true };
      }

      return {
        ok: false,
        error: failures[0].error,
        failures,
      };
    },
    [refresh, toast]
  );

  const confirmRetry = useCallback(
    async (batch) => {
      try {
        const updated = await retryDisbursement(batch._id);
        toast[updated?.payoutReference ? 'success' : 'warning'](
          updated?.payoutReference
            ? `${batch.batchNumber} paid out on retry (${updated.payoutReference}).`
            : `${batch.batchNumber} retried, but no payout provider is wired — the money has not moved.`
        );
        refresh();
        return { ok: true };
      } catch (error) {
        // Stays open with the provider's own words on screen: a permanent failure
        // is refused here, and the operator needs to read why before they go and
        // correct the school's payout details.
        return { ok: false, error: error.message || 'This payout could not be retried.' };
      }
    },
    [refresh, toast]
  );

  const confirmCreate = useCallback(
    async ({ schoolId, periodStart, periodEnd }) => {
      try {
        const batch = await createDisbursement({ schoolId, periodStart, periodEnd });
        toast.success(
          `${batch.batchNumber || 'Batch'} staged for ${batch.schoolName || 'the school'} — ${
            batch.paymentCount || 0
          } payment(s) awaiting approval.`
        );
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message || 'That batch could not be created.' };
      }
    },
    [refresh, toast]
  );

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Disbursements"
        description="Every payout batch, from staged to paid. Gross is what parents paid; platform is what SukuuPay kept; net is what the school receives."
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Stage a batch
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={state.loading}
              aria-label="Refresh the disbursement queue"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw
                className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </>
        }
      />

      <Card padding="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {DISBURSEMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DISBURSEMENT_LABEL(status)}
              </option>
            ))}
          </SelectField>

          <SchoolSelect value={filters.schoolId} onChange={(value) => setFilter('schoolId', value)} />

          <Field
            label="Built from"
            type="date"
            value={filters.from}
            onChange={(event) => setFilter('from', event.target.value)}
            hint="creation date"
          />

          <Field
            label="Built to"
            type="date"
            value={filters.to}
            onChange={(event) => setFilter('to', event.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold text-slate-400">
            The date range filters when a batch was <strong>built</strong>, not when it was paid.
            Filters live in the URL.
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() =>
                setSearchParams(
                  (current) => {
                    const params = new URLSearchParams(current);
                    ['status', 'schoolId', 'from', 'to', 'page'].forEach((key) => params.delete(key));
                    return params;
                  },
                  { replace: true }
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-extrabold text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <div className="mt-4">
        {state.error ? (
          <EmptyState
            icon={RotateCcw}
            title="The disbursement queue could not be loaded"
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
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={hasFilters ? 'No batches match these filters' : 'No payout batches yet'}
            description={
              hasFilters
                ? 'Try clearing the status filter — “All statuses” includes paid and cancelled history as well as the open queue.'
                : 'A batch is built from a school’s completed parent payments over a window. Stage one from the button above.'
            }
            action={
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800"
              >
                Stage a batch
              </button>
            }
          />
        ) : (
          <>
            <Card padding="p-0" className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[78rem] border-collapse text-left">
                  <caption className="sr-only">
                    Disbursement batches, all three amounts in pesewas converted to cedis
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Batch
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Window
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Gross
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Platform
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Net to school
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Payments
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Built
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Approved by
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Attempts
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((batch) => {
                      const approvable = canApprove(batch.status);
                      const retryable = canRetry(batch.status);

                      return (
                        <tr
                          key={batch._id}
                          onClick={() =>
                            navigate(ADMIN_ROUTES.DISBURSEMENT_DETAIL.replace(':batchId', batch._id))
                          }
                          className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3.5">
                            {/*
                              A real link, not just a clickable row. A `<tr>` with a
                              click handler is unreachable by keyboard, so the batch
                              number is focusable and Enter-able. It stops propagation
                              rather than wrapping the row, which would put
                              interactive content inside a clickable row and fire
                              twice.
                            */}
                            <Link
                              to={ADMIN_ROUTES.DISBURSEMENT_DETAIL.replace(':batchId', batch._id)}
                              onClick={(event) => event.stopPropagation()}
                              className="font-mono text-[12px] font-extrabold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                            >
                              {batch.batchNumber}
                            </Link>
                          </td>
                          <td className="px-5 py-3.5 text-[13px] font-bold text-ink">
                            {batch.schoolName || 'Unknown school'}
                            {batch.schoolCode ? (
                              <span className="block font-mono text-[11px] font-bold text-slate-400">
                                {batch.schoolCode}
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                            {periodLabel(batch.periodStart, batch.periodEnd)}
                          </td>

                          {/*
                            All three are pesewas on the wire and cedis on screen, and
                            all three are rendered. The net column is the one that
                            matters and is the boldest — it is the number a school
                            would quote back, and the number the confirm dialog names.
                          */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-slate-500">
                            {formatCedi(batch.grossAmount)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold tabular-nums text-brand-700">
                            {formatCedi(batch.platformAmount)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-extrabold tabular-nums text-ink">
                            {formatCedi(batch.netAmount)}
                          </td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                            {formatCount(batch.paymentCount)}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone={DISBURSEMENT_TONE(batch.status)}>
                              {DISBURSEMENT_LABEL(batch.status)}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                            {formatDate(batch.createdAt)}
                          </td>
                          <td className="px-5 py-3.5 text-[12px] font-semibold text-slate-600">
                            {batch.status === 'pending_approval' ? (
                              <span className="text-slate-400">Not yet approved</span>
                            ) : batch.approvedBy || batch.approvedByName ? (
                              /*
                                The list endpoint populates `schoolId` but not
                                `approvedBy`, so the id is here and the *name* is not
                                — `getDisbursement` resolves it
                                (`disbursements.service.js:936`). Rendering the raw
                                ObjectId would be a column of hex; inventing a name
                                would be worse. So it says where the answer is.
                              */
                              <Link
                                to={ADMIN_ROUTES.DISBURSEMENT_DETAIL.replace(':batchId', batch._id)}
                                onClick={(event) => event.stopPropagation()}
                                className="font-extrabold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                              >
                                {batch.approvedByName || 'Named on the batch'}
                              </Link>
                            ) : (
                              /*
                                `approvedBy` null on a batch past `pending_approval`
                                is not missing data — it is the machine-approval case,
                                and the model is explicit that pointing the column at
                                the cron owner would attribute a machine decision to a
                                person. See the header.
                              */
                              <span className="text-slate-500">Auto-approve setting</span>
                            )}
                          </td>
                          {/*
                            With the "not transfers sent" caveat in the title, so the
                            number is interpretable. `title` is not announced and is
                            not the only place the caveat appears — the note under the
                            table says it too.
                          */}
                          <td
                            className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600"
                            title="Attempts, not transfers sent — an approval attempt that never reached a provider still counts as one."
                          >
                            {formatCount(batch.attempts)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {/*
                              The status-reflecting action cell. Two buttons, and a
                              row where neither applies renders an em dash rather
                              than a disabled pair — a disabled control says "you lack
                              permission", which is a different fact from "there is
                              nothing to do with this batch".
                            */}
                            <span className="inline-flex items-center gap-1.5">
                              {approvable && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setApproveTarget(batch);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                >
                                  Approve
                                </button>
                              )}
                              {retryable && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setRetryTarget(batch);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
                                >
                                  Retry
                                </button>
                              )}
                              {!approvable && !retryable && (
                                <span className="text-slate-300" aria-hidden="true">
                                  —
                                </span>
                              )}
                              <ChevronRight
                                className="h-4 w-4 text-slate-300"
                                aria-hidden="true"
                              />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-400">
              <strong className="font-extrabold text-slate-600">Actions follow status.</strong>{' '}
              Approve appears only while a batch is awaiting approval; Retry only after a failure.
              A paid or cancelled batch has nothing left to do and says so. “Attempts” counts
              attempts — an approval that never reached a provider still counts as one, so it is not
              a count of transfers sent.
            </p>

            <div className="mt-4">
              <Pagination
                meta={state.meta}
                itemLabel="batches"
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

      <ApproveBatchModal
        open={Boolean(approveTarget)}
        batches={approveTarget ? [approveTarget] : []}
        onClose={() => setApproveTarget(null)}
        onConfirm={confirmApprove}
      />

      <RetryBatchModal
        open={Boolean(retryTarget)}
        batch={retryTarget}
        onClose={() => setRetryTarget(null)}
        onConfirm={confirmRetry}
      />

      <CreateBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onConfirm={confirmCreate}
      />
    </>
  );
};

export default DisbursementsList;
