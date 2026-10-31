import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudentMessages } from '../../services/student';
import { MessageSquare, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const Messages = () => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['student-messages'],
    queryFn: () => getStudentMessages(),
    staleTime: 60 * 1000,
    select: (response) => response?.data?.data || response?.data || [],
  });

  const messages = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-[13px] font-semibold text-amber-900">Could not load messages.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-extrabold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Messages</h1>
          <p className="text-[13px] font-semibold text-slate-500">Notices from teachers and school</p>
        </div>
      </div>

      <div className="space-y-3">
        {messages.length > 0 ? (
          messages.map((m, idx) => (
            <div key={m._id ?? idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-extrabold text-ink">{m.subject || m.title || 'Message'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {m.senderName || m.from || 'School'} · {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}
                  </p>
                </div>
                {!m.readAt && (
                  <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">New</span>
                )}
              </div>
              <p className="mt-2 text-[12.5px] text-slate-600 leading-relaxed">{m.body || m.message || ''}</p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[12px] text-slate-500 text-center py-6">No messages yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
