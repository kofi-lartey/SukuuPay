import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, CircleDollarSign, Plus, Wallet } from 'lucide-react';
import PageHeader from '../../../components/dashboard/PageHeader';
import EmptyState from '../../../components/dashboard/EmptyState';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import Tile from '../../../components/dashboard/ui/Tile';
import ModuleTabs from '../../../components/dashboard/ModuleTabs';
import Modal from '../../../components/common/Modal';
import { Field, FormAlert, SelectField } from '../../../components/common/FormField';
import SchoolPicker from '../../../components/admin/sms/SchoolPicker';
import { useToast } from '../../../hooks/useToast';
import { usePlatformSettings } from '../../../hooks/usePlatformSettings';
import { useImpersonation } from '../../../hooks/useImpersonation';
import { getSmsCredits, recordSmsCreditTopUp } from '../../../services/admin';
import { ADMIN_ROUTES } from '../../../utils/constants';
import { formatCediShort, formatCount } from '../../../utils/format';

/**
 * The platform's SMS credit: the master balance, and how it is divided up.
 *
 * Backed by `GET /admin/sms/credits`, which — like the overview — has no server
 * implementation yet (no `controllers/admin/sms.controller.js`, and `admin.routes.js`
 * registers only the older `/admin/sms-balance`). The shape is read defensively
 * for the reasons set out in `SmsOverview.jsx`: aliases are tried in order, and a
 * missing one renders as a zero rather than throwing.
 *
 * ## The word "records" is in the dialog's title
 *
 * `recordSmsCreditTopUp` **records a credit purchase; it does not take a payment.**
 * There is no payment integration for SMS credit anywhere in this product — no
 * checkout, no gateway, no provider top-up API call, and `SmsCreditTopUp.amountPes`
 * is nullable precisely because credit is also granted by support or by migration
 * with no money attached (`smsCreditTopUpModel.js:35-39`). A dialog whose primary
 * button said "Buy credit" would be promising a transaction the platform cannot
 * perform, and the first operator to press it would be looking for a receipt that
 * would never arrive. So the dialog says "Record top-up", and the confirmation
 * states that no payment has been taken and no provider account has been topped up.
 *
 * ## The two outcomes from one button
 *
 * With schools selected, each named school's own balance is credited — which does
 * put real, sendable messages into real schools' hands. The messages come out of
 * credit already bought from the provider; this is an allocation, not a purchase.
 * With no school selected, the same call records a **platform-level credit note
 * that credits nobody** — the endpoint answers `platformCreditNote: true,
 * creditedSchools: 0`. It exists so that "we bought 50,000 messages from Arkesel
 * on 3 March" has a row in the ledger, but not one school gains a single message
 * from it.
 *
 * Those are very different outcomes from the same button, and the dialog says which
 * one is about to happen **before** the form, in a banner that changes colour with
 * the selection, rather than in a footnote after it. An operator who credits "the
 * platform" expecting three schools to be able to bill their parents tomorrow has
 * made a mistake that produces no error anywhere — the row was written, the audit
 * entry is clean, and the schools are still out of credit a week later. The toast
 * after the fact therefore reads the *response's* flags rather than the request,
 * so what the operator is told is what the server did.
 *
 * **There is no platform balance to show, on this page or anywhere else.**
 * `getSmsCredits` returns `platformPool: null`, and `SmsCreditTopUp.schoolId` is
 * `required: true` (`smsCreditTopUpModel.js:18-21`) — a credit row cannot exist
 * without a school, so there is nothing to hold a platform purse. The total this
 * page shows is the *sum of schools' holdings*, labelled as such. A tile reading
 * "Platform balance: GH₵ 0" would tell an operator the platform is out of credit
 * when the truth is that no such figure exists.
 */

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

/**
 * `GET /admin/sms/credits` → the platform-wide credit picture.
 *
 * Aliases, in the same spirit as `SmsOverview`'s normaliser:
 *
 *   - total: `totalHeldBySchools` | `totalBalance`. This is the sum of every
 *     school's own balance — it is **not** a pool the platform can spend, because
 *     credit in this product lives on the school (`SmsCreditTopUp.schoolId` is
 *     `required`). The endpoint returns `platformPool: null` to say exactly that,
 *     and this page renders **no platform balance tile at all** rather than showing
 *     a zero, because "GH₵ 0" reads as "the platform has run out" and the truth
 *     is "there is no such figure".
 *   - rows:   `bySchool` | `schools` | `breakdown`, each with a balance in
 *     messages and optionally a cedi figure.
 *   - top-ups are **not** rendered as a table here. `SmsCreditTopUp` is a
 *     per-school purchase history and this page shows the balance breakdown;
 *     mixing the two would read as one ledger with two different meanings.
 */
const normaliseCredits = (payload) => {
  const source = payload || {};
  const rows = firstValue(source, ['bySchool', 'schools', 'breakdown']);

  return {
    // Read for the total only. `platformBalance` is deliberately absent from the
    // alias list: the field does not exist and must never be rendered, however
    // tempting a "0" would be to fill the gap.
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

/**
 * The providers a top-up can be attributed to.
 *
 * Mirrors `SMS_PROVIDERS` in `Backend/src/config/constants.js:216`
 * (`hubtel | arke | mnotify`) rather than reusing `PAYMENT_PROVIDERS` from
 * `services/admin.js`, which is a different enum for a different product area —
 * it carries `manual` (a school collecting outside SukuuPay, so the platform took
 * no money) and `mtn` (a collection rail), neither of which can send SMS.
 * `PlatformSettings.sms.provider` is narrower still (`arke | hubtel` only), which
 * is why the two lists disagree and why this one is written out locally: the
 * provider recorded on a *purchase* is a historical fact about where credit came
 * from, and the platform may have moved since. The field is a free `String` on
 * `SmsCreditTopUp`, so nothing here is rejected server-side.
 */
const CREDIT_PROVIDERS = ['arke', 'hubtel', 'mnotify', 'other'];

/** `MAX_SMS_CREDIT_TOP_UP_UNITS`, `Backend/src/config/constants.js:328`. */
const MAX_UNITS = 1000000;

const SmsCredits = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { settings } = usePlatformSettings();
  const { isImpersonating } = useImpersonation();

  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [units, setUnits] = useState('');
  const [provider, setProvider] = useState('');
  const [schoolIds, setSchoolIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    getSmsCredits()
      .then((result) => active && setState({ data: normaliseCredits(result), loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const ratePes = settings?.sms?.ratePesewas ?? 0;
  const data = state.data;

  const sectionTabs = useMemo(
    () => [
      { value: ADMIN_ROUTES.SMS, label: 'Overview' },
      { value: ADMIN_ROUTES.SMS_CREDITS, label: 'Credits' },
      { value: ADMIN_ROUTES.SMS_LOGS, label: 'Message history' },
    ],
    []
  );

  /** Seeded from the platform settings so the default is the current provider. */
  const openTopUp = () => {
    if (isImpersonating) {
      toast.error(
        'Recording credit is blocked while you are impersonating a school. Exit the session first.'
      );
      return;
    }
    setUnits('');
    setProvider(settings?.sms?.provider || CREDIT_PROVIDERS[0]);
    setSchoolIds([]);
    setFormError(null);
    setTopUpOpen(true);
  };

  const parsedUnits = Number(units);
  const unitsValid = Number.isInteger(parsedUnits) && parsedUnits > 0 && parsedUnits <= MAX_UNITS;

  /** Which of the two outcomes this submission will produce. Drives the banner. */
  const creditsSchools = schoolIds.length > 0;

  /**
   * The write, returning `{ ok, error }` and never throwing.
   *
   * A 400 from this endpoint is a real possibility — `assertAudienceConsistent`'s
   * sibling rules apply to the top-up payload too — and it must come back as a
   * sentence inside this dialog with the operator's units and provider still
   * filled in. A throw here would close over what they typed.
   */
  const submit = async () => {
    if (!unitsValid) {
      setFormError(
        `Enter a whole number of messages between 1 and ${formatCount(MAX_UNITS)}. This field counts messages, not money.`
      );
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      const result = await recordSmsCreditTopUp({
        amount: parsedUnits,
        provider,
        schoolIds,
      });

      /*
       * The response, not the request, decides what the toast says.
       *
       * The endpoint answers `{ platformCreditNote: true, creditedSchools: 0 }` for
       * the empty-selection case, and that flag is the authoritative answer to "did
       * anything actually get credited". Trusting the request instead — `if
       * (schoolIds.length)` — would report a success the server knows did not happen
       * the moment an operator selected a school that then turned out to be
       * ineligible.
       */
      const creditedSchools = firstNumber(result, ['creditedSchools']);
      const platformCreditNote = result?.platformCreditNote === true;

      toast.success(
        platformCreditNote || creditedSchools === 0
          ? `${formatCount(parsedUnits)} messages recorded as a platform credit note. No school's balance changed.`
          : `${formatCount(parsedUnits)} messages recorded against ${formatCount(creditedSchools)} school${creditedSchools === 1 ? '' : 's'}.`
      );

      setTopUpOpen(false);
      refresh();
      return { ok: true };
    } catch (error) {
      setFormError(error.message || 'The credit top-up could not be recorded.');
      return { ok: false, error: error.message };
    } finally {
      setBusy(false);
    }
  };

  const schools = data?.schools || [];
  const credited = schools.filter((school) => school.balance > 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="SMS credits"
        description="The platform's master message balance, and how it is divided between schools."
        actions={
          <button
            type="button"
            onClick={openTopUp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Record top-up
          </button>
        }
      />

      <ModuleTabs items={sectionTabs} value={ADMIN_ROUTES.SMS_CREDITS} onChange={navigate} ariaLabel="SMS sections" />

      {state.error ? (
        <EmptyState
          icon={Wallet}
          title="SMS credits could not be loaded"
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
      ) : state.loading && !data ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Held by schools"
              icon={Wallet}
              value={formatCediShort((data.totalHeldBySchools || 0) * ratePes)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  {formatCount(data.totalHeldBySchools)} messages across every school
                </p>
              }
            />
            <Tile
              label="Recorded as purchased"
              icon={CircleDollarSign}
              value={formatCount(data.totalPurchased)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  Credit rows ever entered, in messages
                </p>
              }
            />
            <Tile
              label="Consumed"
              icon={CircleDollarSign}
              value={formatCount(data.totalUsed)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  Debited by sends, before any refund
                </p>
              }
            />
            <Tile
              label="Schools with credit"
              icon={Wallet}
              value={formatCount(credited)}
              footer={
                <p className="text-[11px] font-semibold text-slate-500">
                  Of {formatCount(schools.length)} schools in the breakdown
                </p>
              }
            />
          </div>

          {/*
            The provider line, placed under the tiles rather than inside one.

            Note what it does **not** claim: there is no platform credit account to
            hold a balance, because `platformPool` is `null` and `SmsCreditTopUp`
            requires a `schoolId`. The money buys messages from the provider; SukuuPay
            then allocates them to schools, and those allocations — not a platform
            purse — are what this page shows.
          */}
          {data.provider && (
            <Card padding="p-4">
              <p className="text-[12px] font-semibold text-slate-600">
                Messages are bought from{' '}
                <Badge tone="brand">{data.provider}</Badge> and then allocated to schools. There
                is no platform credit pool: each school&rsquo;s balance is its own, and a school
                can only send while its own row is positive.
              </p>
            </Card>
          )}

          <Card padding="p-0" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-[13px] font-extrabold text-ink">Balance by school</h2>
              <p className="text-[11px] font-semibold text-slate-500">
                Estimated value at the platform rate of {formatCediShort(ratePes)} per message
              </p>
            </div>

            {schools.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] font-semibold text-slate-500">
                The credits endpoint returns no per-school breakdown yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <caption className="sr-only">SMS credit balance for each school</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th scope="col" className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        School
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Messages left
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Used
                      </th>
                      <th scope="col" className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Estimated value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((school) => (
                      <tr key={school.id || school.name} className="border-b border-slate-50 last:border-0">
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] font-extrabold text-ink">{school.name}</p>
                          {school.region && (
                            <p className="text-[11px] font-semibold text-slate-400">{school.region}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {/*
                            Zero is coloured, not grey. A school sitting at exactly
                            zero cannot send its next payment reminder, and on a
                            table of forty rows that is invisible unless the cell
                            itself says so.
                          */}
                          <span
                            className={`text-[13px] font-extrabold tabular-nums ${
                              school.balance > 0 ? 'text-ink' : 'text-red-600'
                            }`}
                          >
                            {formatCount(school.balance)}
                          </span>
                          {school.balance === 0 && (
                            <span className="ml-1.5 text-[10px] font-bold uppercase text-red-600">
                              cannot send
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCount(school.used)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-bold tabular-nums text-slate-600">
                          {formatCediShort(school.balance * ratePes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        title="Record a top-up"
        description="Writes a row to the credit ledger. It does not take a payment."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTopUpOpen(false)}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !unitsValid}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-lift transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/40"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {busy
                ? 'Recording…'
                : creditsSchools
                  ? `Record against ${formatCount(schoolIds.length)} school${schoolIds.length === 1 ? '' : 's'}`
                  : 'Record platform credit note'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {/* ── What this will actually do. Before the form, not after it. ── */}
          <div
            role="status"
            className={`rounded-xl border-2 p-3.5 ${
              creditsSchools
                ? 'border-brand-700 bg-brand-50'
                : 'border-amber-300 bg-amber-50'
            }`}
          >
            <p
              className={`text-[13px] font-extrabold ${
                creditsSchools ? 'text-brand-800' : 'text-amber-900'
              }`}
            >
              {creditsSchools
                ? `${formatCount(parsedUnits || 0)} messages will be added to ${formatCount(
                    schoolIds.length
                  )} school${schoolIds.length === 1 ? '' : 's'}.`
                : 'This records a platform credit note that credits no school.'}
            </p>
            <ul
              className={`mt-1.5 space-y-1 text-[12px] font-semibold leading-relaxed ${
                creditsSchools ? 'text-brand-800' : 'text-amber-900'
              }`}
            >
              {creditsSchools ? (
                <>
                  <li>
                    Each named school&rsquo;s balance goes up immediately, and that school can
                    send. The credit comes out of the messages already bought from the provider —
                    this records an allocation, it does not buy more.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>No school&rsquo;s balance changes</strong>, so no school can send
                    anything because of this row. The endpoint confirms it: it answers{' '}
                    <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">
                      platformCreditNote: true
                    </code>{' '}
                    with <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">creditedSchools: 0</code>.
                  </li>
                  <li>
                    It exists so &ldquo;we bought 50,000 messages from the provider on this
                    date&rdquo; has a row — a record of a purchase that had to be bought out of
                    band, because this dialog cannot buy it.
                  </li>
                </>
              )}
              <li>
                <strong>No payment is taken.</strong> SukuuPay has no payment integration for
                SMS credit: this does not charge a card, and it does not top up the provider&rsquo;s
                account. Somebody has to buy the messages from the provider separately.
              </li>
              <li>
                Recorded in the audit trail as{' '}
                <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">
                  admin.sms_credit_topup
                </code>
                .
              </li>
            </ul>
          </div>

          <Field
            label="Messages (count, not money)"
            required
            type="number"
            inputMode="numeric"
            min="1"
            max={MAX_UNITS}
            step="1"
            value={units}
            onChange={(event) => setUnits(event.target.value)}
            placeholder="5000"
            hint={`Whole messages, up to ${formatCount(MAX_UNITS)}`}
            error={
              units && !unitsValid
                ? 'A whole number of messages, greater than zero.'
                : null
            }
          />

          {/*
            The unit, spelled out in the label rather than the hint. This field is
            the single most misread control in the console: an operator who types
            "500" meaning GH₵ 500 has recorded 500 *messages*, worth about GH₵ 6,
            and the mismatch surfaces days later as an invoice that does not line
            up. The label says which one it is, and the estimated value under it
            gives them the cedi to sanity-check against.
          */}
          {unitsValid && (
            <p className="-mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <CircleAlert className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              {formatCount(parsedUnits)} messages is worth an estimated{' '}
              {formatCediShort(parsedUnits * ratePes)} at the platform rate of{' '}
              {formatCediShort(ratePes)} each.
            </p>
          )}

          <SelectField
            label="Provider the credit came from"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            hint="Recorded, not charged"
          >
            {CREDIT_PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectField>

          {/*
            The picker is *optional* and labelled so. Optional because the empty
            selection is a meaningful case — the platform credit note above — and
            hiding the distinction by marking the field required would push every
            operator into crediting schools whether or not that was the intent.
          */}
          <SchoolPicker
            label="Schools to credit (optional)"
            hint={creditsSchools ? `${formatCount(schoolIds.length)} selected` : 'None selected'}
            value={schoolIds}
            onChange={setSchoolIds}
            // No `filterStatus`: credit can be granted to a school before it is
            // reactivated, and this is not a send.
          />

          <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
            Leave the selection empty to file a platform-level credit note. Selecting schools
            moves real, sendable credit into them, which is almost always what an operator
            topping up on behalf of a customer actually means.
          </p>
        </div>
      </Modal>
    </>
  );
};

export { CREDIT_PROVIDERS, MAX_UNITS };
export default SmsCredits;