import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Package,
  Plus,
  TriangleAlert,
  Wallet,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Tile from '../../../components/dashboard/ui/Tile';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import Pagination from '../../../components/students/Pagination';
import { Field, FormAlert, SelectField } from '../../../components/common/FormField';
import SchoolPicker from '../../../components/admin/sms/SchoolPicker';
import { useToast } from '../../../hooks/useToast';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { getSmsCredits, recordSmsCreditTopUp } from '../../../services/admin';
import {
  getSmsPool,
  recordSmsPoolTopUp,
  listSmsRequests,
  approveSmsRequest,
  rejectSmsRequest,
  markSmsRequestRefunded,
} from '../../../services/smsPool';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCedis, formatCediShort, formatCount } from '../../../utils/format';

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const firstNumber = (payload, keys) => {
  for (const key of keys) {
    if (payload?.[key] !== undefined && payload?.[key] !== null) return number(payload[key]);
  }
  return 0;
};
const firstValue = (payload, keys) => {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

const normaliseCredits = (payload) => {
  const source = payload || {};
  const rows = firstValue(source, ['bySchool', 'schools', 'breakdown']);
  return {
    totalHeldBySchools: firstNumber(source, ['totalHeldBySchools', 'totalBalance']),
    totalPurchased: firstNumber(source, ['totalPurchased', 'purchased', 'unitsPurchased']),
    totalUsed: firstNumber(source, ['totalUsed', 'used', 'consumed']),
    provider: firstValue(source, ['provider', 'smsProvider']) || '',
    schools: Array.isArray(rows)
      ? rows
          .map((row) => ({
            id: row?.schoolId || row?._id || row?.school?.id || '',
            name: row?.schoolName || row?.name || row?.school?.name || 'Unnamed school',
            region: row?.region || row?.school?.region || '',
            balance: firstNumber(row, ['balance', 'credits', 'remaining', 'units']),
            used: firstNumber(row, ['used', 'creditsUsed', 'consumed']),
            purchased: firstNumber(row, ['purchased', 'creditsPurchased', 'unitsPurchased']),
          }))
          .sort((a, b) => b.balance - a.balance)
      : [],
  };
};

const CREDIT_PROVIDERS = ['arke', 'moolre'];
const MAX_UNITS = 1000000;

const AWAITING_APPROVAL = 'awaiting_approval';
const AWAITING_VERIFICATION = 'awaiting_verification';
const STATUS_TONE = {
  awaiting_payment: 'amber',
  awaiting_verification: 'purple',
  awaiting_approval: 'blue',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
};
const TABS = [
  { key: AWAITING_VERIFICATION, label: 'Needs verification' },
  { key: AWAITING_APPROVAL, label: 'Awaiting approval' },
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Declined' },
];
const DIRECTION_TONE = { topup: 'green', allocation: 'blue', reversal: 'amber' };

const SmsCredits = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const { isImpersonating } = useImpersonation();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocUnits, setAllocUnits] = useState('');
  const [allocProvider, setAllocProvider] = useState('');
  const [schoolIds, setSchoolIds] = useState([]);
  const [allocBusy, setAllocBusy] = useState(false);
  const [allocError, setAllocError] = useState(null);

  const [pool, setPool] = useState(null);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolError, setPoolError] = useState(null);
  const [queue, setQueue] = useState({ rows: [], meta: null, loading: true });
  const [reqStatus, setReqStatus] = useState(AWAITING_VERIFICATION);
  const [reqPage, setReqPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [refunding, setRefunding] = useState(null);
  const [refundReference, setRefundReference] = useState('');
  const [poolTopUpOpen, setPoolTopUpOpen] = useState(false);
  const [poolTopUpUnits, setPoolTopUpUnits] = useState('');
  const [poolTopUpCost, setPoolTopUpCost] = useState('');
  const [poolTopUpReference, setPoolTopUpReference] = useState('');
  const [poolTopUpProvider, setPoolTopUpProvider] = useState('arke');
  const [poolTopUpError, setPoolTopUpError] = useState(null);
  const [poolTopUpBusy, setPoolTopUpBusy] = useState(false);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getSmsCredits()
      .then((result) => active && setState({ data: normaliseCredits(result), loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setPoolLoading(true);
    getSmsPool()
      .then((result) => { if (active) { setPool(result); setPoolError(null); } })
      .catch((error) => { if (active) setPoolError(error); })
      .finally(() => { if (active) setPoolLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    setQueue((current) => ({ ...current, loading: true }));
    listSmsRequests({ status: reqStatus, page: reqPage })
      .then((result) => { if (active) setQueue({ rows: result.rows, meta: result.meta, loading: false }); })
      .catch((error) => {
        if (active) {
          setQueue({ rows: [], meta: null, loading: false });
          toast?.error?.(error?.message || 'Requests could not be loaded.');
        }
      });
    return () => { active = false; };
  }, [reqStatus, reqPage, reloadKey, toast]);

  const onApprove = async (row) => {
    setBusyId(row.requestId);
    try {
      const result = await approveSmsRequest(row.requestId);
      toast?.success?.(result?.alreadyApproved ? 'Already approved — nothing was allocated twice.' : `${formatCount(row.units)} SMS released.`);
      refresh();
    } catch (error) {
      toast?.error?.(error?.message || 'That request could not be approved.');
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async () => {
    if (reason.trim().length < 3) { setReasonError('The school is told this reason, so it cannot be blank.'); return; }
    setBusyId(rejecting?.requestId);
    try {
      await rejectSmsRequest(rejecting.requestId, reason.trim());
      toast?.success?.('Declined. The school has been told why.');
      setRejecting(null); setReason('');
      refresh();
    } catch (error) {
      setReasonError(error?.message || 'That request could not be declined.');
    } finally {
      setBusyId(null);
    }
  };

  const onRecordRefund = async () => {
    setBusyId(refunding?.requestId);
    try {
      await markSmsRequestRefunded(refunding.requestId, refundReference.trim());
      toast?.success?.('Refund recorded.');
      setRefunding(null); setRefundReference('');
      refresh();
    } catch (error) {
      toast?.error?.(error?.message || 'The refund could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  const onPoolTopUp = async () => {
    const u = Number(poolTopUpUnits);
    if (!Number.isFinite(u) || u < 1) { setPoolTopUpError('Enter how many units you bought.'); return; }
    setPoolTopUpBusy(true);
    setPoolTopUpError(null);
    try {
      await recordSmsPoolTopUp({
        units: u,
        provider: poolTopUpProvider || undefined,
        amountPes: poolTopUpCost === '' ? null : Number(poolTopUpCost),
        reference: poolTopUpReference.trim() || undefined,
      });
      toast?.success?.(`${formatCount(u)} units added to the pool.`);
      setPoolTopUpOpen(false);
      setPoolTopUpUnits(''); setPoolTopUpCost(''); setPoolTopUpReference(''); setPoolTopUpProvider('arke');
      refresh();
    } catch (error) {
      setPoolTopUpError(error?.message || 'That top-up could not be recorded.');
    } finally {
      setPoolTopUpBusy(false);
    }
  };

  const ratePes = settings?.sms?.ratePesewas ?? 0;
  const data = state.data;
  const sectionTabs = useMemo(() => [
    { value: ADMIN_ROUTES.SMS, label: 'Overview' },
    { value: ADMIN_ROUTES.SMS_CREDITS, label: 'Credits' },
    { value: ADMIN_ROUTES.SMS_LOGS, label: 'Message history' },
  ], []);

  const openAlloc = () => {
    if (isImpersonating) { toast.error('Recording credit is blocked while you are impersonating a school. Exit the session first.'); return; }
    setAllocUnits(''); setAllocProvider(settings?.sms?.provider || CREDIT_PROVIDERS[0]); setSchoolIds([]); setAllocError(null); setAllocOpen(true);
  };

  const parsedAllocUnits = Number(allocUnits);
  const allocValid = Number.isInteger(parsedAllocUnits) && parsedAllocUnits > 0 && parsedAllocUnits <= MAX_UNITS;
  const creditsSchools = schoolIds.length > 0;

  const submitAlloc = async () => {
    if (!allocValid) { setAllocError(`Enter a whole number of messages between 1 and ${formatCount(MAX_UNITS)}.`); return; }
    setAllocBusy(true); setAllocError(null);
    try {
      const result = await recordSmsCreditTopUp({ amount: parsedAllocUnits, provider: allocProvider, schoolIds });
      const creditedCount = firstNumber(result, ['creditedSchools']);
      const platformCreditNote = result?.platformCreditNote === true;
      toast.success(platformCreditNote || creditedCount === 0
        ? `${formatCount(parsedAllocUnits)} messages recorded as a platform credit note. No school's balance changed.`
        : `${formatCount(parsedAllocUnits)} messages recorded against ${formatCount(creditedCount)} school${creditedCount === 1 ? '' : 's'}.`);
      setAllocOpen(false);
      refresh();
    } catch (error) {
      setAllocError(error.message || 'The credit top-up could not be recorded.');
    } finally {
      setAllocBusy(false);
    }
  };

  const schools = data?.schools || [];
  const credited = schools.filter((school) => school.balance > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="SMS credits"
        description="Pool, top-ups (Arkesel/Moolre), purchase requests, and per-school balances."
        actions={
          <button type="button" onClick={openAlloc} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Allocate to schools
          </button>
        }
      />

      <ModuleTabs items={sectionTabs} value={ADMIN_ROUTES.SMS_CREDITS} onChange={navigate} ariaLabel="SMS sections" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="p-4" className={pool?.isLow ? 'border-amber-300 bg-amber-50/50' : ''}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Available in pool</p>
          {poolLoading ? <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{formatCount(pool?.availableUnits ?? 0)}</p>}
          {pool?.isLow ? <p className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-700"><TriangleAlert className="h-3 w-3" aria-hidden="true" />At or below the low threshold</p> : <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Bought on {pool?.unitPricePes ? formatCedis(pool.unitPricePes) : '—'} each</p>}
        </Card>
        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total topped up</p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{formatCount(pool?.totalToppedUp ?? 0)}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Arkesel / Moolre</p>
        </Card>
        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Allocated to schools</p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{formatCount(pool?.totalAllocated ?? 0)}</p>
        </Card>
        <Card padding="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Held by schools</p>
          <p className="mt-1.5 text-[26px] font-extrabold tabular-nums tracking-tight text-ink">{formatCount(pool?.heldBySchools ?? 0)}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Unspent, on school balances</p>
        </Card>
      </div>

      {poolError ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-[13px] font-semibold text-red-800 ring-1 ring-inset ring-red-200">{poolError.message}</div> : null}

      <Card padding="p-0" className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[14px] font-extrabold tracking-tight text-ink">Pool ledger</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">Append-only. A correction is a new entry, never an edit.</p>
          </div>
          <Button variant="secondary" onClick={() => setPoolTopUpOpen(true)} icon={ArrowDownToLine}>Record a top-up</Button>
        </div>
        {pool?.entries?.length ? (
          <ul className="divide-y divide-slate-100">
            {pool.entries.slice(0, 10).map((entry) => (
              <li key={entry._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge tone={DIRECTION_TONE[entry.direction] || 'slate'}>{entry.direction}</Badge>
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-slate-800">{formatCount(entry.units)} units{entry.schoolId?.name ? ` → ${entry.schoolId.name}` : ''}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{entry.entryId}{entry.reference ? ` · ${entry.reference}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  {entry.balanceAfter != null ? <p className="text-[12px] font-extrabold tabular-nums text-slate-600">{formatCount(entry.balanceAfter)} after</p> : null}
                  <p className="text-[11px] text-slate-400">{new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{entry.createdBy ? ` · ${(entry.createdBy.firstName || '')} ${(entry.createdBy.lastName || '')}`.trim() : ' · automatic'}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] font-semibold text-slate-500">Nothing recorded yet. Add a top-up to start allocating credit to schools.</p>
        )}
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-ink">Credit requests</h2>
        <div role="tablist" aria-label="Filter requests" className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={reqStatus === tab.key} onClick={() => { setReqStatus(tab.key); setReqPage(1); }}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${reqStatus === tab.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {queue.loading && queue.rows.length === 0 ? (
        <div className="space-y-2">{[0, 1].map((key) => (<Card key={key} padding="p-4"><div className="h-4 w-48 animate-pulse rounded bg-slate-100" /><div className="mt-2.5 h-3 w-64 animate-pulse rounded bg-slate-100" /></Card>))}</div>
      ) : null}
      {!queue.loading && queue.rows.length === 0 ? (
        <EmptyState icon={Package} title={reqStatus === AWAITING_APPROVAL || reqStatus === AWAITING_VERIFICATION ? 'Nothing waiting' : 'No requests here'} description={reqStatus === AWAITING_VERIFICATION ? 'No manual payment is waiting for verification right now.' : reqStatus === AWAITING_APPROVAL ? 'No school is waiting for approval right now.' : 'Try another tab to see the rest of the history.'} />
      ) : null}

      <ul className="space-y-2">
        {queue.rows.map((row) => {
          const isWaiting = row.status === AWAITING_APPROVAL || row.status === AWAITING_VERIFICATION;
          const isManual = row.payment?.method === 'manual';
          const isDeclined = row.status === 'rejected' && !row.refundedAt;
          const busy = busyId === row.requestId;
          return (
            <li key={row._id}>
              <Card padding="p-4" className={isWaiting ? 'border-blue-200' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[row.status] || 'slate'}>{row.status}</Badge>
                      {isManual ? <Badge tone="slate">Manual</Badge> : <Badge tone="slate">MoMo</Badge>}
                      <span className="font-mono text-[11px] text-slate-400">{row.requestId}</span>
                    </div>
                    <p className="mt-2 text-[14px] font-extrabold text-ink">{row.schoolId?.name || 'Unknown school'}</p>
                    <p className="mt-1 text-[13px] font-semibold text-slate-600">{formatCount(row.units)} SMS · <span className="tabular-nums font-extrabold text-ink">{formatCedis(row.totalPes)}</span> · {formatCedis(row.unitPricePes)} each</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-500">Requested by {row.requestedBy?.firstName || '—'} {row.requestedBy?.lastName || ''} · {new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <Badge tone={row.payment?.status === 'completed' ? 'green' : 'slate'}>{row.payment?.status || 'pending'}</Badge>
                      {row.payment?.reference ? <span className="font-mono">Pay ref: {row.payment.reference}</span> : null}
                      {row.payment?.submittedReference ? <span className="font-mono">Submitted: {row.payment.submittedReference}</span> : null}
                      {row.payment?.phoneNumber ? <span className="tabular-nums">{row.payment.phoneNumber}</span> : null}
                      {row.payment?.financialTransactionId ? <span className="font-mono">{row.payment.financialTransactionId}</span> : null}
                    </div>
                    {row.payment?.proofNote ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700">Note: {row.payment.proofNote}</p> : null}
                    {row.rejectionReason ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">Declined: {row.rejectionReason}</p> : null}
                    {row.refundedAt ? <p className="mt-2 text-[12px] font-bold text-emerald-700">Refunded{row.refundReference ? ` · ${row.refundReference}` : ''}</p> : null}
                    {isWaiting && pool && row.units > pool.availableUnits ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">Only {formatCount(pool.availableUnits)} units are left in the pool. Top up before approving this.</p> : null}
                    {row.status === AWAITING_VERIFICATION ? <p className="mt-2 text-[12px] font-semibold text-violet-700">Verify the submitted payment reference externally, then approve to release credit.</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {isWaiting ? (<>
                      <Button onClick={() => onApprove(row)} disabled={busy || !pool || row.units > pool.availableUnits} icon={CheckCircle2}>{busy ? 'Working…' : (row.status === AWAITING_VERIFICATION ? 'Verify & approve' : 'Approve')}</Button>
                      <Button variant="secondary" onClick={() => { setRejecting(row); setReason(''); setReasonError(null); }} disabled={busy} icon={XCircle}>Decline</Button>
                    </>) : null}
                    {isDeclined ? <Button variant="secondary" onClick={() => { setRefunding(row); setRefundReference(''); }} disabled={busy}>Record refund</Button> : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {queue.meta && queue.meta.totalPages > 1 ? <div className="mt-4"><Pagination meta={queue.meta} onPageChange={setReqPage} /></div> : null}

      <div className="mt-8">
        {state.error ? (
          <EmptyState icon={Wallet} title="SMS credits could not be loaded" description={state.error.message} action={<button type="button" onClick={refresh} className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift hover:bg-brand-800">Try again</button>} />
        ) : state.loading && !data ? (
          <div className="space-y-4"><div className="h-36 animate-pulse rounded-2xl bg-slate-200/70" /><div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile label="Held by schools" icon={Wallet} value={formatCediShort((data.totalHeldBySchools || 0) * ratePes)} footer={<p className="text-[11px] font-semibold text-slate-500">{formatCount(data.totalHeldBySchools)} messages across every school</p>} />
              <Tile label="Recorded as purchased" icon={CircleDollarSign} value={formatCount(data.totalPurchased)} footer={<p className="text-[11px] font-semibold text-slate-500">Credit rows ever entered, in messages</p>} />
              <Tile label="Consumed" icon={CircleDollarSign} value={formatCount(data.totalUsed)} footer={<p className="text-[11px] font-semibold text-slate-500">Debited by sends, before any refund</p>} />
              <Tile label="Schools with credit" icon={Wallet} value={formatCount(credited)} footer={<p className="text-[11px] font-semibold text-slate-500">Of {formatCount(schools.length)} schools in the breakdown</p>} />
            </div>
            <Card padding="p-0" className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-[13px] font-extrabold text-ink">Balance by school</h2>
                <p className="text-[11px] font-semibold text-slate-500">Estimated value at {formatCediShort(ratePes)} per message</p>
              </div>
              {schools.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12px] font-semibold text-slate-500">No per-school breakdown yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-left">
                    <caption className="sr-only">SMS credit balance for each school</caption>
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">School</th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Messages left</th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Used</th>
                        <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Estimated value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map((school) => (
                        <tr key={school.id || school.name} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3.5"><p className="text-[13px] font-extrabold text-ink">{school.name}</p>{school.region && <p className="text-[11px] font-semibold text-slate-400">{school.region}</p>}</td>
                          <td className="px-5 py-3.5 text-right"><span className={`text-[13px] font-extrabold tabular-nums ${school.balance > 0 ? 'text-ink' : 'text-red-600'}`}>{formatCount(school.balance)}</span>{school.balance === 0 && <span className="ml-1.5 text-[10px] font-bold uppercase text-red-600">cannot send</span>}</td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">{formatCount(school.used)}</td>
                          <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">{formatCediShort(school.balance * ratePes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <Modal open={poolTopUpOpen} onClose={() => setPoolTopUpOpen(false)} title="Record SMS pool top-up" footer={<><Button variant="ghost" onClick={() => setPoolTopUpOpen(false)}>Cancel</Button><Button onClick={onPoolTopUp} disabled={poolTopUpBusy}>{poolTopUpBusy ? 'Saving…' : 'Add to pool'}</Button></>}>
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-slate-600">Record units bought from the provider (Arkesel or Moolre) to replenish the platform pool.</div>
          <div><label htmlFor="ptu-provider" className="block text-[13px] font-bold text-slate-700">Provider</label><select id="ptu-provider" value={poolTopUpProvider} onChange={(e) => setPoolTopUpProvider(e.target.value)} className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"><option value="arke">Arkesel</option><option value="moolre">Moolre</option></select></div>
          <div><label htmlFor="ptu-units" className="block text-[13px] font-bold text-slate-700">Units bought</label><input id="ptu-units" type="number" min="1" value={poolTopUpUnits} onChange={(e) => setPoolTopUpUnits(e.target.value)} placeholder="10000" className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[16px] font-extrabold tabular-nums text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" /></div>
          <div><label htmlFor="ptu-cost" className="block text-[13px] font-bold text-slate-700">What you paid (GH₵)</label><input id="ptu-cost" type="number" min="0" step="0.01" value={poolTopUpCost} onChange={(e) => setPoolTopUpCost(e.target.value)} placeholder="Optional" className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[16px] tabular-nums text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" /></div>
          <div><label htmlFor="ptu-ref" className="block text-[13px] font-bold text-slate-700">Provider receipt / reference</label><input id="ptu-ref" type="text" value={poolTopUpReference} onChange={(e) => setPoolTopUpReference(e.target.value)} placeholder="Optional audit trail" className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" /></div>
          {poolTopUpError ? <p role="alert" className="text-[12px] font-semibold text-red-600">{poolTopUpError}</p> : null}
        </div>
      </Modal>

      <Modal open={allocOpen} onClose={() => setAllocOpen(false)} title="Allocate credit to schools" description="Records allocation in credit ledger. No payment taken." size="lg" footer={<><button type="button" onClick={() => setAllocOpen(false)} disabled={allocBusy} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancel</button><button type="button" onClick={submitAlloc} disabled={allocBusy || !allocValid} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-800 disabled:opacity-50"><Plus className="h-4 w-4" aria-hidden="true" />{allocBusy ? 'Recording…' : creditsSchools ? `Record against ${formatCount(schoolIds.length)} school${schoolIds.length === 1 ? '' : 's'}` : 'Record platform credit note'}</button></>}>
        <div className="space-y-4">
          {allocError && <FormAlert tone="error">{allocError}</FormAlert>}
          <Field label="Messages (count, not money)" required type="number" inputMode="numeric" min="1" max={MAX_UNITS} step="1" value={allocUnits} onChange={(e) => setAllocUnits(e.target.value)} placeholder="5000" hint={`Whole messages, up to ${formatCount(MAX_UNITS)}`} error={allocUnits && !allocValid ? 'A whole number of messages, greater than zero.' : null} />
          {allocValid && <p className="-mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><CircleAlert className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />{formatCount(parsedAllocUnits)} messages ≈ {formatCediShort(parsedAllocUnits * ratePes)} at {formatCediShort(ratePes)} each.</p>}
          <SelectField label="Provider the credit came from" value={allocProvider} onChange={(e) => setAllocProvider(e.target.value)} hint="Recorded, not charged">{CREDIT_PROVIDERS.map((value) => (<option key={value} value={value}>{value}</option>))}</SelectField>
          <SchoolPicker label="Schools to credit (optional)" hint={creditsSchools ? `${formatCount(schoolIds.length)} selected` : 'None selected'} value={schoolIds} onChange={setSchoolIds} />
        </div>
      </Modal>

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={`Decline ${rejecting?.requestId || ''}`} footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" onClick={onReject} disabled={busyId === rejecting?.requestId}>Decline request</Button></>}>
        <div className="space-y-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-amber-800">This school has <strong>already paid</strong>. Declining keeps their money; record a refund after.</p>
          <div><label htmlFor="reject-reason" className="block text-[13px] font-bold text-slate-700">Reason shown to the school</label><textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason for declining" className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-900 focus:outline-none ${reasonError ? 'border-red-300' : 'border-slate-200 focus:border-brand-700'}`} />{reasonError ? <p className="mt-1 text-[12px] font-semibold text-red-600">{reasonError}</p> : null}</div>
        </div>
      </Modal>

      <Modal open={Boolean(refunding)} onClose={() => setRefunding(null)} title="Record a refund" footer={<><Button variant="ghost" onClick={() => setRefunding(null)}>Cancel</Button><Button onClick={onRecordRefund} disabled={busyId === refunding?.requestId}>Mark as refunded</Button></>}>
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed text-slate-600">This does not move money. Return {formatCedis(refunding?.totalPes ?? 0)} to the payer, then record it here.</p>
          <div><label htmlFor="refund-reference" className="block text-[13px] font-bold text-slate-700">Refund reference</label><input id="refund-reference" type="text" value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Optional" className="mt-1.5 min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-[14px] text-slate-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20" /></div>
        </div>
      </Modal>
    </>
  );
};

export { CREDIT_PROVIDERS, MAX_UNITS };
export default SmsCredits;
