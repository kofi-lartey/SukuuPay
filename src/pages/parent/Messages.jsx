import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Plus, Send } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import { useConversations, useSendMessage } from '../../hooks/parent/useMessages';
import { PARENT_ROUTES } from '../../utils/constants';
import StudentRow from '../../components/parent/shared/StudentRow';
import EmptyState from '../../components/parent/shared/EmptyState';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';
import Modal from '../../components/common/Modal';
import AudioRecorder from '../../components/parent/AudioRecorder';
import useToast from '../../hooks/useToast';

const ConversationRow = ({ token, conversation }) => {
  const unread = conversation.unreadCount > 0;

  return (
    <Link
      to={PARENT_ROUTES.messageThread(token, conversation.threadId)}
      className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-extrabold text-[#0A5C36]">
        {conversation.initials || 'S'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13.5px] font-extrabold text-ink">
            {conversation.subject || 'Conversation'}
          </p>
          <p className="shrink-0 text-[10.5px] font-semibold text-slate-400">
            {conversation.relativeTime}
          </p>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-slate-500">
          {conversation.lastMessage}
        </p>
        {unread ? (
          <span className="mt-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-[#0A5C36] px-1.5 text-[10px] font-extrabold text-white">
            {conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
};

const NewConversationModal = ({ open, onClose, token }) => {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audio, setAudio] = useState(null); // { file, url, seconds, mimeType } | null
  const send = useSendMessage(token);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() && !body.trim() && !audio) return;
    try {
      await send.mutateAsync({ subject, body, audio });
      toast.success('Message sent');
      setSubject('');
      setBody('');
      setAudio(null);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not send the message.');
    }
  };

  const hasContent = Boolean(subject.trim() || body.trim() || audio);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New conversation"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-conversation-form"
            disabled={send.isPending || !hasContent}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0A5C36] px-4 py-2.5 text-[13px] font-extrabold text-white hover:bg-[#084a2b] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      <form id="new-conversation-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Question about Term 2 fees"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:border-[#0A5C36] focus:outline-none focus:ring-1 focus:ring-[#0A5C36]"
          />
        </div>
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Message
          </label>
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:border-[#0A5C36] focus:outline-none focus:ring-1 focus:ring-[#0A5C36]"
          />
        </div>

        {/* Voice note — optional, and a complete message on its own. */}
        <div>
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Voice note
          </label>
          <AudioRecorder onChange={setAudio} />
        </div>
      </form>
    </Modal>
  );
};

const Messages = () => {
  const { token, student, school } = useParentPay();
  const [composing, setComposing] = useState(false);
  const { data, isLoading, error, refetch } = useConversations(token);

  const conversations = data?.conversations || [];

  return (
    <div className="space-y-5">
      <StudentRow student={student} school={school} />

      <button
        type="button"
        onClick={() => setComposing(true)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A5C36] text-[13.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Start a new conversation
      </button>

      {error ? (
        <ErrorBanner message={error.message} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Send a message to your child's teacher or the school office."
        />
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <ConversationRow key={c.threadId} token={token} conversation={c} />
          ))}
        </div>
      )}

      <NewConversationModal
        open={composing}
        onClose={() => setComposing(false)}
        token={token}
      />
    </div>
  );
};

export default Messages;
