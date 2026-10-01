import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, MessageSquare, Plus, Wallet } from 'lucide-react';
import PageHeader from '../../components/dashboard/PageHeader';
import ModuleTabs from '../../components/dashboard/ModuleTabs';
import AudiencePanel from '../../components/sms/AudiencePanel';
import ComposerPanel from '../../components/sms/ComposerPanel';
import PhonePreview from '../../components/sms/PhonePreview';
import SendBar from '../../components/sms/SendBar';
import TemplatesTab from '../../components/sms/TemplatesTab';
import HistoryTab from '../../components/sms/HistoryTab';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import useToast from '../../hooks/useToast';
import { useSmsReminders } from '../../hooks/useSmsReminders';
import { useAuth } from '../../context/AuthContext';
import { getSchool } from '../../services/school';
import { topUpSmsCredits } from '../../services/sms';
import { ROUTES } from '../../utils/constants';
import { formatCediShort, formatCount } from '../../utils/format';

const TABS = [
  { value: 'compose', label: 'Compose' },
  { value: 'templates', label: 'Templates' },
  { value: 'history', label: 'History' },
];

/**
 * The SMS Reminders module.
 *
 * Fee reminders, end to end: choose who gets them, write the message, see it on
 * a handset, and queue the send. The History tab answers "what happened" and the
 * Templates tab answers "what did we say last time".
 *
 * The layout is the design's three columns, and the order is load-bearing. The
 * audience is on the left because it is the decision that determines whether
 * this is a sensible message at all — there is no point composing copy for
 * 1,200 people who have already paid. The phone preview is on the right, not
 * under the textarea, because the thing being checked is what a parent receives
 * and a preview you have to scroll to is a preview nobody checks.
 *
 * This file owns the shell: the tab, the school, the toast, and the wiring
 * between the hook and the panels. The panels hold no fetching of their own.
 */

const SmsReminders = () => {
  const { user } = useAuth();
  const { success, warning, error: errorToast } = useToast();
  const [school, setSchool] = useState(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpUnits, setTopUpUnits] = useState(1000);

  const sms = useSmsReminders();

  // The class list, for the "By Specific Class" rule. The same list Add Student
  // validates against, so the two can never offer different class names.
  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    getSchool(user.schoolId)
      .then((result) => {
        if (active) setSchool(result);
      })
      .catch(() => {
        // The class rule degrades to a free-text field rather than blocking the
        // module: a school whose class list cannot be read should still be able
        // to send a reminder to everyone owing.
        if (active) setSchool(null);
      });
    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  const classes = school?.academic?.classes || school?.classes || [];

  const handleSend = async () => {
    try {
      const result = await sms.send();
      const job = result?.job;
      if (job?.scheduledAt) {
        success(
          `Scheduled ${formatCount(job.recipients)} reminders for ${new Date(job.scheduledAt).toLocaleString('en-GB')}.`
        );
      } else {
        success(
          `Queued ${formatCount(job?.recipients || 0)} reminders. ${formatCount(job?.balanceAfter ?? 0)} SMS left.`
        );
      }
    } catch (err) {
      errorToast(err?.message || 'The reminders could not be queued.');
    }
  };

  const handleSaveTemplate = async (payload, editing) => {
    try {
      await sms.saveTemplate({ ...payload, id: editing?._id });
      success('Template saved.');
    } catch (err) {
      errorToast(err?.message || 'The template could not be saved.');
      // Re-thrown so the modal keeps itself open on a failure. Swallowing it
      // here closed the dialog and discarded what the user had typed.
      throw err;
    }
  };

  const handleTopUp = async () => {
    try {
      const units = Number(topUpUnits) || 0;
      const result = await topUpSmsCredits({ schoolId: sms.schoolId, units });
      setTopUpOpen(false);
      success(
        `Added ${formatCount(result.topUp?.units ?? units)} SMS. Balance is now ${formatCount(result.balance)}.`
      );
      // The composer's cost estimate and the header pill both read the balance.
      // Re-read it rather than bumping it locally — a locally-incremented number
      // is a guess about what the server did, and the one moment it must not be
      // a guess is immediately after a top-up.
      await sms.refreshCredits();
    } catch (err) {
      errorToast(err?.message || 'The credit could not be added.');
    }
  };

  const handleDeleteTemplate = async (id) => {
    await sms.removeTemplate(id);
    success('Template deleted.');
  };

  /** Why the send button is disabled, in words. Never a silent disabled button. */
  const blocker = (() => {
    if (sms.canSend === false) return 'No SMS gateway is configured on this server.';
    if (!sms.body.trim()) return 'Write a message first.';
    if (sms.unknownTokens.length) return 'Fix the unknown tokens in your message.';
    if (sms.overSegmentLimit) return 'The message is over the 10-part limit.';
    if (sms.audienceType === 'class' && !sms.classFilter) return 'Pick a class.';
    if (sms.audienceLoading) return 'Sizing the audience…';
    if (!sms.audiencePreview) return 'Choose an audience to see the cost.';
    if (!sms.audiencePreview.matchCount) return 'Nobody matches this audience yet.';
    if (sms.affordable === false) return 'Not enough SMS credit for this audience.';
    if (!sms.confirmed) return 'Confirm the recipient count to send.';
    return null;
  })();

  return (
    <>
      <PageHeader
        eyebrow="SMS Reminders"
        title="Fee Reminder SMS Broadcast"
        description="Automate and send one-click mobile money payment links directly to parents' mobile phones across Ghana."
        actions={
          <>
            {sms.credits && (
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Wallet className="h-4 w-4 text-slate-500" aria-hidden="true" />
                {formatCount(sms.credits.balance)} SMS left
              </button>
            )}
            <Link
              to={ROUTES.DASHBOARD_PAYMENTS}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-4 w-4 text-slate-500" aria-hidden="true" />
              New Payment
            </Link>
          </>
        }
        meta={
          sms.credits && (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                  SMS Balance
                </p>
                <p className="text-[13px] font-extrabold text-ink">
                  {formatCount(sms.credits.balance)}{' '}
                  <span className="font-semibold text-slate-500">
                    ({sms.credits.balanceCedis})
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className="ml-1 inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-amber-100"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Top Up
              </button>
            </div>
          )
        }
      />

      <ModuleTabs items={TABS} value={sms.tab} onChange={sms.setTab} ariaLabel="SMS sections" />

      {/* The result banner. A send is asynchronous — the job is queued, not
          delivered — so the confirmation says what actually happened rather than
          "Sent". A bursar who reads "Sent" and finds a failure in the morning has
          been told something false. */}
      {sms.sendResult && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-brand-900">
            <span className="font-extrabold">
              {formatCount(sms.sendResult.job?.recipients || 0)} reminders queued
            </span>{' '}
            for {formatCediShort(sms.sendResult.job?.creditsCharged || 0)} of credit.{' '}
            {formatCount(sms.sendResult.job?.balanceAfter ?? 0)} SMS left. They will send
            {sms.sendResult.job?.scheduledAt
              ? ` on ${new Date(sms.sendResult.job.scheduledAt).toLocaleString('en-GB')}`
              : ' shortly'}
            . Watch the outcome on the History tab.
          </p>
          <button
            type="button"
            onClick={() => sms.setTab('history')}
            className="rounded-lg border border-brand-700 px-3 py-1.5 text-[12px] font-extrabold text-brand-700 transition-colors hover:bg-brand-100"
          >
            View history
          </button>
        </div>
      )}

      {sms.sendError && (
        <div role="alert" className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="flex-1 text-[13px] font-semibold text-red-800">
            <span className="font-extrabold">The reminders were not queued.</span>{' '}
            {sms.sendError.message}
          </p>
        </div>
      )}

      {sms.tab === 'compose' && (
        <>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_320px]">
            <AudiencePanel
              audienceType={sms.audienceType}
              setAudienceType={sms.setAudienceType}
              audienceRules={sms.audienceRules}
              classFilter={sms.classFilter}
              setClassFilter={sms.setClassFilter}
              classes={classes}
              preview={sms.audiencePreview}
              loading={sms.audienceLoading}
              error={sms.audienceError}
              excludeRecentPayers={sms.excludeRecentPayers}
              setExcludeRecentPayers={sms.setExcludeRecentPayers}
              recentPaymentWindowHours={sms.recentPaymentWindowHours}
              setRecentPaymentWindowHours={sms.setRecentPaymentWindowHours}
              dueSoonDays={sms.dueSoonDays}
              setDueSoonDays={sms.setDueSoonDays}
              gracePeriodDays={sms.gracePeriodDays}
              setGracePeriodDays={sms.setGracePeriodDays}
              minBalance={sms.minBalance}
              setMinBalance={sms.setMinBalance}
            />

            <ComposerPanel
              body={sms.body}
              setBody={sms.setBody}
              category={sms.category}
              setCategory={sms.setCategory}
              tokens={sms.tokens}
              tokensInBody={sms.tokensInBody}
              unknownTokens={sms.unknownTokens}
              rendered={sms.rendered}
              segments={sms.segments}
              perSegmentLimit={sms.perSegmentLimit}
              overSegmentLimit={sms.overSegmentLimit}
              estimatedCost={sms.estimatedCost}
              affordable={sms.affordable}
              balance={sms.balance ?? 0}
              balanceAfter={sms.sendResult?.job?.balanceAfter}
              ratePes={sms.credits?.ratePes ?? 12}
              matchCount={sms.audiencePreview?.matchCount || 0}
              presets={sms.presets}
              applyTemplate={sms.applyTemplate}
              templates={sms.templates}
              templateId={sms.templateId}
              onDeleteTemplate={sms.removeTemplate}
              senderId={sms.credits?.senderId}
              creditsLoading={sms.creditsLoading}
            />

            <PhonePreview
              rendered={sms.rendered}
              payLink={sms.audiencePreview?.sample?.payLink}
              amount={sms.audiencePreview?.sample?.balanceDisplay || 'GHC 0.00'}
              schoolName={user?.schoolName || school?.name}
              senderName={sms.credits?.senderId}
              sending={sms.sending}
            />
          </div>

          <SendBar
            matchCount={sms.audiencePreview?.matchCount || 0}
            segments={sms.segments}
            estimatedCost={sms.estimatedCost}
            ratePes={sms.credits?.ratePes ?? 12}
            balance={sms.balance ?? 0}
            canQueue={sms.canQueue}
            confirmed={sms.confirmed}
            setConfirmed={sms.setConfirmed}
            sending={sms.sending}
            onSend={handleSend}
            scheduledAt={sms.scheduledAt}
            setScheduledAt={sms.setScheduledAt}
            onReset={sms.resetComposer}
            blocker={blocker}
            canSend={sms.canSend}
            gateway={sms.gateway}
            audienceType={sms.audienceType}
          />
        </>
      )}

      {sms.tab === 'templates' && (
        <TemplatesTab
          templates={sms.templates}
          presets={sms.presets}
          loading={sms.templatesLoading}
          onUse={(template) => {
            sms.applyTemplate(template);
            sms.setTab('compose');
            success(`"${template.name}" loaded into the composer.`);
          }}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
        />
      )}

      {sms.tab === 'history' && (
        <HistoryTab
          jobs={sms.jobs}
          jobsMeta={sms.jobsMeta}
          messages={sms.messages}
          messagesMeta={sms.messagesMeta}
          loading={sms.historyLoading}
          error={sms.historyError}
          filters={sms.historyFilters}
          setFilter={sms.setHistoryFilter}
          clearFilters={sms.clearHistoryFilters}
          credits={sms.credits}
          deliveryRate={sms.deliveryRate}
          usage={sms.usage}
          balance={sms.balance ?? 0}
          ratePes={sms.credits?.ratePes ?? 12}
          onCancelJob={sms.cancelJob}
          busyJobId={sms.busyJobId}
        />
      )}

      {/* Top-up. A modal rather than a page: it is one number and one button, and
          a bursar who clicks "Top Up" wants credit now, not a settings tour. */}
      <Modal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        title="Add SMS credit"
        description="Credit is metered in SMS. One SMS costs what the rate on your account says."
        footer={
          <>
            <Button variant="secondary" onClick={() => setTopUpOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleTopUp}>
              Add {formatCount(Number(topUpUnits) || 0)} SMS
            </Button>
          </>
        }
      >
        <label className="text-[11px] font-semibold text-slate-700">
          SMS credits to add
          <input
            type="number"
            min="1"
            step="100"
            value={topUpUnits}
            onChange={(event) => setTopUpUnits(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/30"
          />
        </label>

        <p className="mt-3 text-[12px] font-medium leading-relaxed text-slate-500">
          This records credit against the school. Payment for it happens in the
          Payments module — the reference you pass links the two, so a bursar can
          reconcile what they bought against what they sent.
        </p>
      </Modal>
    </>
  );
};

export default SmsReminders;
