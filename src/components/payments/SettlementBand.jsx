import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Info } from 'lucide-react';
import Badge from '../dashboard/ui/Badge';
import { ROUTES } from '../../utils/constants';

/**
 * Where collected money lands, and how it gets there.
 *
 * **The design this was built from shows an "Automated Daily Bank Sweep" band:
 * a next-sweep time, a batch figure and an "Escrow Cleared" badge. None of that
 * is implemented in this backend, and none of it can be derived from what is
 * stored.** There is no settlement-batch collection and no sweep job — the only
 * scheduled jobs in `Backend/src/jobs/` are ID-card generation and installment
 * reminders. `Payment.settlement.appliedAt` looks like it might be the thing, but
 * it marks the moment a *student's balance* was credited, which is a ledger
 * event and not a bank transfer.
 *
 * So a next-sweep time and a pending batch would have been invented, and on this
 * screen an invented cedi figure is the most dangerous thing that could be
 * rendered: it is the number a bursar reconciles a bank statement against. The
 * band instead states the two things that are real — which account collections
 * are paid into, and that moving the money off it is still the school's job.
 *
 * The account number is masked to its last four digits, which is also what the
 * API's public school projection does for the same reason.
 */
const maskAccount = (accountNumber) => {
  const digits = String(accountNumber || '').replace(/\s+/g, '');
  if (!digits) return null;
  return `••••${digits.slice(-4)}`;
};

const GATEWAY_LABELS = {
  hubtel: 'Hubtel',
  arke: 'Arke',
  mnotify: 'MNotify',
  manual: 'recorded manually',
};

const SettlementBand = ({ school }) => {
  const payment = school?.payment || {};
  const account = payment.bankAccount || {};
  const masked = maskAccount(account.accountNumber);

  return (
    <section
      className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white"
      aria-label="Collection account"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white"
          >
            <Building2 className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold">Collection account</h2>
              {payment.gatewayMode && GATEWAY_LABELS[payment.gatewayMode] && (
                <Badge tone="green">
                  Paid in via {GATEWAY_LABELS[payment.gatewayMode]}
                </Badge>
              )}
              <Badge tone="amber" icon={Info}>
                No automated sweep
              </Badge>
            </div>

            {masked ? (
              <p className="mt-1 text-[13px] font-semibold text-white/80">
                {account.bankName || 'Bank account'}
                {account.accountName ? ` · ${account.accountName}` : ''} ·{' '}
                <span className="tabular-nums">{masked}</span>
                {account.branch ? ` · ${account.branch}` : ''}
              </p>
            ) : (
              <p className="mt-1 text-[13px] font-semibold text-white/80">
                No collection account is set on this school yet.
              </p>
            )}

            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium leading-snug text-white/60">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Parents pay into this account through the configured gateway, and
                SukuuPay records each collection against the student&apos;s balance. Moving
                the money off this account is still a manual step — no transfer is initiated
                by this system.
              </span>
            </p>
          </div>
        </div>

        <Link
          to={ROUTES.DASHBOARD_SETTINGS}
          className="shrink-0 self-start rounded-lg bg-white/95 px-3 py-2 text-[13px] font-extrabold text-ink transition-colors hover:bg-white lg:self-center"
        >
          Payment settings
        </Link>
      </div>
    </section>
  );
};

export { maskAccount };
export default SettlementBand;