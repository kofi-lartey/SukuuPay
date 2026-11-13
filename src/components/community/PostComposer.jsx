import React, { useRef, useState } from 'react';
import { Send, Paperclip, Image, FileText, X } from 'lucide-react';
import { uploadCommunityFile } from '../../services/community';
import MediaAttachment from './MediaAttachment';

const PostComposer = ({ onSubmit, onCancel, initialBody = '' }) => {
  const [body, setBody] = useState(initialBody);
  const [postType, setPostType] = useState('discussion');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPoll, setShowPoll] = useState(false);
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // One input, three entry points: the three icons are affordances over the same
  // picker, narrowed by `accept`. A separate input per icon would mean three
  // elements to keep in sync and three places to reset.
  const fileRef = useRef(null);
  const acceptRef = useRef('');

  const pickFiles = (accept) => {
    acceptRef.current = accept;
    // Reset first: selecting the same file twice in a row fires no `change` event
    // if the input still holds the previous value.
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  };

  const onFilesChosen = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError('');
    try {
      const uploaded = [];
      for (const file of files) {
        // Sequential: a phone connection is the bottleneck, and parallel uploads
        // make every one of them slower.
        uploaded.push(await uploadCommunityFile(file));
      }
      setMedia((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setUploadError(e?.response?.data?.message || e?.message || 'That file could not be uploaded');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    const hasMedia = media.length > 0;
    if (!body.trim() && !title.trim() && !hasMedia && postType !== 'poll') return;
    if (postType === 'poll' && !pollQuestion.trim()) return;
    if (uploading) return;

    const payload = {
      postType,
      body: body.trim() || null,
      title: title.trim() || null,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      media,
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
    setMedia([]);
    setUploadError('');
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

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFilesChosen}
      />

      {media.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {media.map((m, i) => (
            <div
              key={m.publicId || i}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
            >
              {m.mimeType?.startsWith('image/') ? (
                <img src={m.url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-teal-600" />
              )}
              <span className="max-w-[140px] truncate text-[11px] text-slate-600">
                {m.originalName || 'Attachment'}
              </span>
              <button
                type="button"
                onClick={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="Remove attachment"
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-600">{uploadError}</p>
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
          {/* Three affordances over one picker. Each narrows `accept`, so the
              paperclip takes anything and the other two steer the chooser. */}
          <button
            type="button"
            onClick={() => pickFiles('')}
            disabled={uploading}
            aria-label="Attach a file"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => pickFiles('image/*')}
            disabled={uploading}
            aria-label="Attach an image"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <Image className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => pickFiles('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip')}
            disabled={uploading}
            aria-label="Attach a document"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
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
            disabled={uploading || (!body.trim() && !title.trim() && media.length === 0 && !(postType === 'poll' && pollQuestion.trim()))}
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