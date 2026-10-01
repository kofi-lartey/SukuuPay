import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  LayoutDashboard,
  LoaderCircle,
  PlayCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import MomoPreviewCard from '../../components/onboarding/MomoPreviewCard';
import useOnboardingProgress from '../../hooks/useOnboardingProgress';
import useToast from '../../hooks/useToast';
import { listStudents } from '../../services/students';
import { sendBulkSms } from '../../services/sms';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';

/**
 * Reminder copy. The placeholders are resolved by `MomoPreviewCard`; the same
 * string is what the server-side reminder job sends, so the preview is
 * representative rather than a separate code path.
 */
const TEMPLATE =
  'Dear {parentName}, {studentName} owes GHS {balance} for {term}. Pay securely via MTN, Telecel or AirtelTigo: {payLink}';

const PLACEHOLDER = {
  parentName: 'Mr. Kojo Mensah',
  studentName: 'Ama Serwaa Mensah',
  balance: '1,200.00',
  term: 'Term 1',
  payLink: 'sukuupay.gh/p/A7K2QX',
};

const TUTORIAL_VIDEO_ID = 'sukuupay-onboarding';

const formatCedis = (pesewas) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(
    (Number(pesewas) || 0) / 100
  );

const ActionButton = ({ icon: Icon, pending, children, className = '', ...props }) => (
  <button
    type="button"
    className={`flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6 ${className}`}
    {...props}
  >
    {pending ? (
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : (
      Icon && <Icon className="h-4 w-4" aria-hidden="true" />
    )}
    {children}
  </button>
);

const Step4SendReminder = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, markOnboardingComplete } = useAuth();
  const { getStepDraft, clearStepDraft, clearAll } = useOnboardingProgress();

  const [sample, setSample] = useState(null);
  const [owingCount, setOwingCount] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /**
   * Roster state, kept explicit rather than inferred from `owingCount === null`.
   *
   * `null` was doing two jobs: "still loading" and "loaded, and there are no
   * students". A school that skipped the import step is exactly the second case,
   * and conflating them means the empty-roster path cannot be detected — which is
   * how an admin ends up pressing "Send Reminder to All Owing" against nothing.
   */
  const [rosterEmpty, setRosterEmpty] = useState(false);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  const schoolId = user?.schoolId;
  const draft = getStepDraft('send-reminder');

  useEffect(() => {
    if (draft?.message) {
      toast.info(draft.message);
      clearStepDraft('send-reminder');
    }
    // Runs once on mount: the "skipped import" note is delivered exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A real preview when the roster has a student to show, placeholders otherwise.
  useEffect(() => {
    let active = true;
    if (!schoolId) return undefined;

    (async () => {
      try {
        const students = await listStudents({
          perPage: 100,
          sortBy: 'balance',
          sortOrder: 'desc',
        });
        if (!active) return;

        setOwingCount(students.length || null);
        setRosterEmpty(students.length === 0);
        setRosterLoaded(true);

        const first = students.find((student) => (student.balance ?? 0) > 0) || students[0];
        if (first) {
          const parent = first.parents?.find((p) => p.isPrimary) || first.parents?.[0];
          setSample({
            parentName: parent?.parentName || 'Parent',
            studentName: first.studentName,
            balance: formatCedis(first.balance),
            term: first.term || 'the current term',
            payLink: first.payLink ? first.payLink.replace(/^https?:\/\//, '') : 'your school pay link',
          });
        }
      } catch {
        // A roster that cannot be read is not an empty roster. Reporting it as
        // one would tell the admin they have no students when in fact the request
        // failed, and would send them off to import a roster that already exists.
        if (!active) return;
        setRosterLoaded(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const previewValues = useMemo(() => sample || PLACEHOLDER, [sample]);

  const finish = async (message) => {
    setFinishing(true);
    try {
      // Order matters: clear the drafts only once the completion flag is
      // durable, so a failure mid-way does not wipe a half-finished wizard.
      await markOnboardingComplete();
      clearAll();
      toast.success(message);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (error) {
      toast.error(error.message || 'We could not finish setup. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const handleSend = async () => {
    // Nothing to send to. Onboarding lets a school skip the import step, and the
    // reminder step has to handle that state rather than firing a bulk SMS at an
    // empty roster and reporting "sent 0".
    if (rosterLoaded && rosterEmpty) {
      toast.warning('Students not uploaded yet. Import your roster to send reminders.');
      // Still completes onboarding: the school is configured, only the roster is
      // outstanding, and blocking here would strand the admin in the wizard with
      // no way forward.
      await finish('Setup complete.');
      return;
    }

    setSending(true);
    try {
      // The same `POST /sms/bulk` the SMS Reminders module uses, so onboarding
      // does not get a second send path with none of the queueing, rate limiting
      // or refunding. `all_owing` is the rule this step has always meant by
      // "owingOnly" — every parent with a balance above zero.
      const result = await sendBulkSms({
        schoolId,
        audience: { type: 'all_owing', minBalance: 1 },
        body: TEMPLATE,
        category: 'fee_reminder',
      });
      setConfirmOpen(false);
      const recipients = result?.job?.recipients ?? 0;
      await finish(
        recipients
          ? `Queued ${recipients} reminder${recipients === 1 ? '' : 's'} to parents.`
          : 'Setup complete.'
      );
    } catch (error) {
      setConfirmOpen(false);
      if (error.code === 'SMS_SEND_NOT_SUPPORTED') {
        // Not a dead end: the roster reminders are queued server-side once the
        // roster exists, so the admin can still finish and see their dashboard.
        toast.warning(error.message);
        await finish('Setup complete.');
        return;
      }
      toast.error(error.message || 'The reminders could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const recipientCount = owingCount ?? 0;
  /**
   * Cost estimate from the recipient count alone.
   *
   * This used to be gated on the platform's master SMS balance, fetched from
   * `GET /admin/sms-balance`. That route sits behind `authorize("super_admin")`,
   * so every school admin got a 403 "You do not have access to this resource" the
   * moment they reached this step — including by skipping the import step, which
   * is how it was found. It also gated the estimate on a number that is not the
   * school's to see: the platform's master credit, not their balance. Deriving the
   * figure from the per-message unit cost removes both problems.
   */
  const SMS_UNIT_COST = 0.05;
  const costEstimate = recipientCount
    ? `${recipientCount} message${recipientCount === 1 ? '' : 's'} · about GH₵ ${(
        recipientCount * SMS_UNIT_COST
      ).toFixed(2)}`
    : null;

  return (
    <div>
      <header className="mb-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
          <Sparkles className="h-7 w-7 text-amber-500" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          You&apos;re all set!
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
          Your school is now on SukuuPay. Time to send your first fee reminder.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
            What your parent will see
          </h2>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-500">
            {sample
              ? 'Previewed with a real student from your roster.'
              : 'No students imported yet, so this is a sample reminder with placeholder details.'}
          </p>

          <div className="mt-5">
            <MomoPreviewCard template={TEMPLATE} values={previewValues} />
          </div>
        </div>

        <div>
          <h2 className="text-[15px] font-extrabold tracking-tight text-ink">What's next</h2>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-500">
            Send one reminder now, or go straight to your dashboard and come back to it later.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            {/* Stated before the click, not only after it. A button that silently
                redirects reads as broken; one that is explained first reads as
                a designed path. */}
            {rosterLoaded && rosterEmpty && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="text-[12px] font-medium leading-relaxed text-amber-900">
                  <span className="font-bold">Students not uploaded yet.</span> Reminders go to
                  parents on your roster, so there is nobody to send to yet. You can import
                  students later — your setup is not lost.
                </p>
              </div>
            )}

            <ActionButton
              icon={Send}
              pending={sending}
              disabled={sending || finishing}
              // An empty roster bypasses the confirmation dialog. Asking "send 0
              // messages?" is a dead end dressed as a confirmation; the notice
              // above already explains the state and `handleSend` takes it from
              // there.
              onClick={() =>
                rosterLoaded && rosterEmpty ? handleSend() : setConfirmOpen(true)
              }
              className="bg-brand-700 text-white shadow-lift hover:bg-brand-800"
            >
              {sending ? 'Sending…' : 'Send Reminder to All Owing'}
            </ActionButton>

            <ActionButton
              icon={LayoutDashboard}
              pending={finishing}
              disabled={sending || finishing}
              onClick={() => finish('Setup complete. Welcome aboard.')}
              className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              {finishing ? 'Finishing…' : 'Go to Dashboard'}
            </ActionButton>

            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="flex items-center justify-center gap-2 py-1 text-[13px] font-bold text-brand-700 hover:underline"
            >
              <PlayCircle className="h-4 w-4" aria-hidden="true" />
              Watch 2-Minute Tutorial
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
              <CircleCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Setup checklist
            </p>
            <ul className="mt-2.5 space-y-1.5 text-[12px] font-medium text-slate-600">
              <li>School profile saved</li>
              <li>Payment settlement details captured</li>
              <li>{sample ? 'Roster imported — reminders are ready' : 'No roster yet — import one from the dashboard'}</li>
            </ul>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="Send fee reminders?"
        description="This sends one SMS to the primary parent of every student who still owes a balance."
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={sending}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {sending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {sending ? 'Sending…' : 'Send now'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] font-medium text-slate-600">
          <p>
            {owingCount == null
              ? 'This will send one SMS per parent with an outstanding balance.'
              : `This will send ${recipientCount} SMS to parents with an outstanding balance.`}
          </p>
          {costEstimate && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-700">
              Estimated cost: {costEstimate}
            </p>
          )}
          <p>Parents can pay by Mobile Money or card from the link in the message.</p>
        </div>
      </Modal>

      <Modal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="SukuuPay in two minutes"
        description="A quick walkthrough of adding students, sending reminders and reconciling payments."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTutorialOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => finish('Setup complete. Welcome aboard.')}
              disabled={finishing}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
            >
              {finishing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {finishing ? 'Finishing…' : 'Go to Dashboard'}
            </button>
          </>
        }
      >
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
          {/* `youtube-nocookie` with `rel="noreferrer"`; the embed is only
              mounted while the dialog is open so it does not preload. */}
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${TUTORIAL_VIDEO_ID}?rel=0`}
            title="SukuuPay two-minute tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </Modal>
    </div>
  );
};

export default Step4SendReminder;
