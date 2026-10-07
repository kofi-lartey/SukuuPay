import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParentPay } from '../../layouts/ParentLayout';
import { notifySchool } from '../../services/parentPay';
import { Card, PrimaryButton, Amount } from '../../components/parent/primitives';
import AudioRecorder from '../../components/parent/AudioRecorder';
import { PARENT_ROUTES } from '../../utils/constants';
import { isValidGhanaPhone, normalise } from '../../components/common/PhoneInput';

/** Shorter than it looks — most parents write one line and send. */
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 1000;

/**
 * "Tell the school about this fee."
 *
 * **A message, not a support chat.** No thread, no read receipts, and three a day —
 * which is the server's rate limit, and the reason the copy says "the school will
 * call you" rather than promising a reply in here. A parent who needs a balance
 * investigated is being told to phone a bursar, and this form is for the cases where
 * the answer is quicker written than called: a payment that does not appear, a receipt
 * number to quote, a question before choosing a plan.
 *
 * The student's details are stated on the message automatically. Making a parent
 * re-type "about Kwame Mensah, JHS 2A" is a small thing that reliably produces
 * support messages about the wrong child.
 *
 * ## The voice note
 *
 * `AudioRecorder` is offered *alongside* the textarea, never instead of it. A voice
 * note alone is a complete message and the server accepts it alone — that is the
 * point, since the parent who cannot comfortably type is the one the recorder is for.
 * But the text box stays first and stays optional-because-empty rather than
 * required-because-a-file-exists: a parent on metered data is better served by three
 * words than by half a megabyte, and nothing about the school receiving a voice note
 * requires the text box to be the secondary path.
 *
 * `canSubmit` therefore tests `message` **or** `audio`, and the button's label changes
 * to say which it is about to send — a parent who has just recorded a minute of
 * speaking should not have to infer whether it was attached.
 */
const ContactSchool = () => {
  const { token, student, school } = useParentPay();

  const [parentName, setParentName] = useState(student?.primaryParent?.parentName || '');
  const [parentPhone, setParentPhone] = useState('');
  const [message, setMessage] = useState('');
  const [audio, setAudio] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  const trimmed = message.trim();

  const nameError = parentName.trim().length > 0 && parentName.trim().length < 2;
  const phoneError = parentPhone ? !isValidGhanaPhone(parentPhone) : false;

  // A message that exists but is too short to answer is an error the parent should be
  // told about. A *missing* message is not an error at all while a recording exists,
  // which is why this reads `trimmed.length > 0` rather than `trimmed.length < 10`.
  const messageError =
    trimmed.length > 0 && trimmed.length < MESSAGE_MIN
      ? 'Please write a little more so the school can help'
      : null;

  const hasContent = trimmed.length >= MESSAGE_MIN || Boolean(audio?.file);

  const canSubmit =
    !submitting &&
    parentName.trim().length >= 2 &&
    hasContent &&
    trimmed.length <= MESSAGE_MAX &&
    !phoneError;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await notifySchool(token, {
        parentName: parentName.trim(),
        parentPhone: normalise(parentPhone),
        message: trimmed,
        audio,
      });
      setSent(response);
    } catch (caught) {
      const code = caught?.code;
      const audioErrors = [
        'AUDIO_UNREADABLE',
        'AUDIO_TOO_SHORT',
        'AUDIO_BAD_HEADER',
        'AUDIO_UNSUPPORTED_TYPE',
      ];

      if (audioErrors.includes(code)) {
        // Clear the local clip so the parent can re-record
        setAudio(null);
        setError(caught.message);
      } else {
        setError(caught?.message || 'We could not send your message. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="mt-4 text-[21px] font-extrabold tracking-tight text-slate-900">
            {sent?.hasAudio ? 'Voice note sent' : 'Message sent'}
          </h1>

          {/*
            Three wordings for three genuinely different outcomes, chosen from what the
            server actually reported. The middle case is the one that used to be
            missing: the parent was told "the school will see this in their dashboard"
            when no alert had gone anywhere and the school had no dashboard to see it
            in. When nothing could be sent, saying so — and offering the phone number —
            is the difference between a parent who waits and a parent who calls.
          */}
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">
            {sent?.adminsNotified > 0
              ? `${school?.name || 'The school'} has your ${
                  sent?.hasAudio ? 'voice note' : 'message'
                } and has been alerted. They will call you back on ${
                  sent?.schoolPhone || 'the number you gave'
                }.`
              : `Your ${
                  sent?.hasAudio ? 'voice note' : 'message'
                } has been saved to ${
                  school?.name || 'the school'
                }, but they have not been alerted automatically. Please call so they know to look.`}
          </p>

          {school?.phone ? (
            <a
              href={`tel:${school.phone}`}
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-[15px] font-bold text-slate-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.6a1 1 0 01-.5 2.1L8.1 9.6a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.8.3 1.7.6 2.6.7a1 1 0 011.7 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Call {school.phone}
            </a>
          ) : null}

          <Link
            to={PARENT_ROUTES.portal(token)}
            className="mt-2.5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#0A5C36] px-5 text-[15px] font-bold text-white"
          >
            Back to the fee page
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-4">
      <Link
        to={PARENT_ROUTES.portal(token)}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-[#0A5C36]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Fee page
      </Link>

      <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">
        Message the school
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
        Something not right with this bill or a payment? Tell {school?.name || 'the school'} here.
      </p>

      {/* Stated on the message automatically. A parent re-typing the child's class is
          a small ask that reliably produces a message about the wrong child. */}
      <Card className="mt-4 flex items-center justify-between gap-3 bg-slate-50 p-4">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">About</p>
          <p className="mt-0.5 truncate text-[15px] font-bold text-slate-900">
            {student?.studentName || 'This student'}
          </p>
          {student?.studentClass ? (
            <p className="text-[12px] text-slate-500">{student.studentClass}</p>
          ) : null}
        </div>
        {student?.balance > 0 ? (
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Balance</p>
            <Amount pesewas={student.balance} size="sm" className="block" />
          </div>
        ) : null}
      </Card>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <Card className="space-y-4 p-4">
          <div>
            <label htmlFor="contact-name" className="block text-[13px] font-bold text-slate-700">
              Your name
            </label>
            <input
              id="contact-name"
              type="text"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
              autoComplete="name"
              placeholder="e.g. Mrs. Akosua Mensah"
              aria-invalid={Boolean(nameError)}
              className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] text-slate-900 focus:outline-none ${
                nameError ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
              }`}
            />
            {nameError ? (
              <p className="mt-1 text-[12px] font-semibold text-red-600">Please enter your name</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="contact-phone" className="block text-[13px] font-bold text-slate-700">
              Your phone number
            </label>
            <input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(event) => setParentPhone(normalise(event.target.value))}
              autoComplete="tel-national"
              placeholder="024 XXX XXXX"
              aria-invalid={Boolean(phoneError)}
              className={`mt-1.5 min-h-[48px] w-full rounded-xl border-2 bg-white px-3.5 text-[16px] font-bold tabular-nums text-slate-900 focus:outline-none ${
                phoneError ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
              }`}
            />
            {phoneError ? (
              <p className="mt-1 text-[12px] font-semibold text-red-600">Check this mobile number</p>
            ) : (
              <p className="mt-1 text-[12px] text-slate-500">
                So the bursar can call you back about it.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-message" className="block text-[13px] font-bold text-slate-700">
              Your message
            </label>
            <textarea
              id="contact-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MESSAGE_MAX}
              placeholder="e.g. I paid 300 cedis at the office last Friday and this page still shows the full amount."
              aria-invalid={Boolean(messageError)}
              className={`mt-1.5 w-full rounded-xl border-2 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-slate-900 focus:outline-none ${
                messageError ? 'border-red-300' : 'border-slate-200 focus:border-[#0A5C36]'
              }`}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              {messageError ? (
                <p className="text-[12px] font-semibold text-red-600">{messageError}</p>
              ) : (
                <p className="text-[12px] text-slate-500">
                  Quote a receipt number if you have one.
                </p>
              )}
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
          </div>

          {/* Optional, and offered after the text box rather than above it: writing is
              the cheaper path and a parent on metered data should meet it first. */}
          <div>
            <p className="text-[13px] font-bold text-slate-700">Or record a voice note</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
              Easier than typing. {school?.name || 'The school'} can play it back.
            </p>
            <div className="mt-2.5">
              <AudioRecorder onChange={setAudio} />
            </div>
          </div>
        </Card>

        {error ? (
          <div
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-[13px] font-semibold leading-relaxed text-red-800 ring-1 ring-inset ring-red-200"
          >
            {error}
          </div>
        ) : null}

        <PrimaryButton type="submit" full disabled={!canSubmit}>
          {submitting
            ? 'Sending…'
            : audio?.file && !trimmed
              ? 'Send voice note'
              : audio?.file
                ? 'Send message and voice note'
                : 'Send message'}
        </PrimaryButton>

        <p className="-mt-1 text-center text-[12px] leading-relaxed text-slate-500">
          This goes straight to the school&rsquo;s office. For anything urgent, please call.
        </p>
      </form>
    </div>
  );
};

export default ContactSchool;