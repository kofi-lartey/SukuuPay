import { useState } from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useSendSupportMessage } from '../../hooks/parent/useSupport';
import StudentRow from '../../components/parent/shared/StudentRow';
import SectionLabel from '../../components/parent/shared/SectionLabel';
import useToast from '../../hooks/useToast';

const SUBJECTS = [
  { value: 'fees', label: 'Fees & payments' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'records', label: 'Records & grades' },
  { value: 'other', label: 'Something else' },
];

const MessageSchool = () => {
  const { token, student, school } = useParentPay();
  const toast = useToast();
  const send = useSendSupportMessage(token);

  const [subject, setSubject] = useState('fees');
  const [subjectLine, setSubjectLine] = useState('');
  const [body, setBody] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) {
      toast.error('Please write a message.');
      return;
    }
    try {
      await send.mutateAsync({
        // The label, not the slug: this text is read by the bursar in the
        // school's inbox, where "Fees & payments" means something and "fees"
        // means nothing.
        category: SUBJECTS.find((s) => s.value === subject)?.label || subject,
        subject: subjectLine || SUBJECTS.find((s) => s.value === subject)?.label,
        body,
      });
      toast.success('Message sent to the school');
      setSubjectLine('');
      setBody('');
    } catch (err) {
      toast.error(err.message || 'Could not send the message.');
    }
  };

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            What is this about?
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
          >
            {SUBJECTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Subject line
          </label>
          <input
            type="text"
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Optional — a short summary"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
          />
        </div>

        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Message
          </label>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message to the school…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px]"
          />
        </div>

        <button
          type="submit"
          disabled={send.isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A5C36] text-[13.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b] disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {send.isPending ? 'Sending…' : 'Send to school'}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel className="mb-2">Or reach the school directly</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {school?.phone ? (
            <a
              href={`tel:${school.phone}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12.5px] font-extrabold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              Call school
            </a>
          ) : null}
          {school?.email ? (
            <a
              href={`mailto:${school.email}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[12.5px] font-extrabold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#0A5C36]"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Email school
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default MessageSchool;
