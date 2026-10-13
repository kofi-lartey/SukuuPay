import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useParentPay } from '../../layouts/ParentLayout';
import {
  useConversation,
  useSendMessage,
  useMarkConversationRead,
} from '../../hooks/parent/useMessages';
import AudioRecorder from '../../components/parent/AudioRecorder';
import useToast from '../../hooks/useToast';
import { SkeletonRow } from '../../components/parent/shared/Skeleton';
import ErrorBanner from '../../components/parent/shared/ErrorBanner';

const MessageBubble = ({ message }) => {
  const mine = message.author === 'parent';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
          mine
            ? 'rounded-br-sm bg-[#0A5C36] text-white'
            : 'rounded-bl-sm bg-slate-100 text-slate-800'
        }`}
      >
        {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
        {message.hasAudio ? (
          <audio
            controls
            preload="none"
            src={message.audioUrl || ''}
            className="mt-1.5 h-7 w-full"
          >
            <a href={message.audioUrl || ''} download="voice-note.m4a">
              Download the voice note
            </a>
          </audio>
        ) : null}
        <p
          className={`mt-1 text-[10px] font-semibold ${
            mine ? 'text-emerald-100' : 'text-slate-400'
          }`}
        >
          {message.relativeTime || message.timestamp}
        </p>
      </div>
    </div>
  );
};

const MessageThread = () => {
  const { token, school } = useParentPay();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [audio, setAudio] = useState(null);
  const scrollRef = useRef(null);

  const { data, isLoading, error, refetch } = useConversation(token, threadId);
  const send = useSendMessage(token);
  const markRead = useMarkConversationRead(token);

  useEffect(() => {
    if (data?.conversation?.threadId) {
      markRead.mutate(data.conversation.threadId);
    }
    // Keyed on the thread id alone: the handler identity changes on every
    // render of a query whose data just arrived, and re-running the mark for
    // that would fire a second PUT per message received.
  }, [data?.conversation?.threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [data?.messages?.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !audio) return;
    try {
      await send.mutateAsync({
        subject: data?.conversation?.subject,
        body,
        threadId,
        audio,
      });
      setDraft('');
      setAudio(null);
    } catch (err) {
      toast.error(err.message || 'Could not send the message.');
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-ink">
            {data?.conversation?.subject || 'Conversation'}
          </p>
          <p className="truncate text-[11.5px] text-slate-500">
            {data?.conversation?.recipient || school?.name}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3">
        {error ? (
          <ErrorBanner message={error.message} onRetry={refetch} />
        ) : isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          (data?.messages || []).map((message) => (
            <MessageBubble key={message._id} message={message} />
          ))
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 flex items-end gap-2 border-t border-slate-100 bg-white pt-3"
      >
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          placeholder="Write a message…"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:border-[#0A5C36] focus:outline-none focus:ring-1 focus:ring-[#0A5C36]"
        />

        {/* Voice note — optional. A message is text, a recording, or both. */}
        <div className="-mb-1">
          <AudioRecorder onChange={setAudio} />
        </div>

        <button
          type="submit"
          disabled={!draft.trim() && !audio || send.isPending}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0A5C36] text-white transition-colors hover:bg-[#084a2b] disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};

export default MessageThread;
