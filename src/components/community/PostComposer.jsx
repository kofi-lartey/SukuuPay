import React, { useState } from 'react';
import { Send, Paperclip, Image, FileText, X } from 'lucide-react';

const PostComposer = ({ onSubmit, onCancel, initialBody = '' }) => {
  const [body, setBody] = useState(initialBody);
  const [postType, setPostType] = useState('discussion');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPoll, setShowPoll] = useState(false);

  const handleSubmit = () => {
    if (!body.trim() && !title.trim() && postType !== 'poll') return;
    if (postType === 'poll' && !pollQuestion.trim()) return;

    const payload = {
      postType,
      body: body.trim() || null,
      title: title.trim() || null,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    };

    if (postType === 'poll') {
      payload.question = pollQuestion.trim();
      payload.options = pollOptions.map((o) => o.trim()).filter(Boolean);
    }

    onSubmit(payload);
    resetForm();
  };

  const resetForm = () => {
    setBody('');
    setTitle('');
    setTags('');
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPoll(false);
    setPostType('discussion');
  };

  const addPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (idx) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const updatePollOption = (idx, value) => {
    const updated = [...pollOptions];
    updated[idx] = value;
    setPollOptions(updated);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {['discussion', 'question', 'poll', 'resource'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setPostType(t); if (t !== 'poll') setShowPoll(false); }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${postType === t ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {postType !== 'poll' && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium mb-2"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={postType === 'poll' ? 'Describe the poll context...' : 'Share something with the community...'}
        rows={3}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] resize-none"
      />

      {postType === 'poll' && (
        <div className="mt-3 space-y-2">
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            placeholder="Poll question"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
          />
          {pollOptions.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => updatePollOption(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
              />
              {pollOptions.length > 2 && (
                <button onClick={() => removePollOption(idx)} className="p-1 text-slate-400 hover:text-rose-500">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 10 && (
            <button onClick={addPollOption} className="text-[12px] font-bold text-teal-600 hover:text-teal-700">
              + Add option
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <Paperclip className="h-4 w-4" />
          </button>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <Image className="h-4 w-4" />
          </button>
          <button type="button" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <FileText className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button onClick={onCancel} className="rounded-xl px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!body.trim() && !(postType === 'poll' && pollQuestion.trim())}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-white text-[12px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-700"
          >
            <Send className="h-3.5 w-3.5" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;