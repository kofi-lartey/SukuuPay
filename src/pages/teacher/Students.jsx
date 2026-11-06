import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Users, Paperclip, Loader2 } from 'lucide-react';
import AudioRecorder from '../../components/parent/AudioRecorder';
import { fetchTeacherStudents, fetchTeacherStudentMessages, sendTeacherStudentMessage, editTeacherStudentMessage, deleteTeacherStudentMessage } from '../../services/teacher/students';

const TeacherStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const studentId = selected ? (selected.id || selected._id || selected.studentId) : null;
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [text, setText] = useState('');
  const [audio, setAudio] = useState(null);
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const pollRef = useRef(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTeacherStudents();
      const data = res?.data?.data ?? res?.data ?? [];
      setStudents(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Could not load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const loadThread = useCallback(async (studentId) => {
    if (!studentId) return;
    setThreadLoading(true);
    try {
      const res = await fetchTeacherStudentMessages(studentId);
      const data = res?.data?.data ?? res?.data ?? [];
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadThread(selected.id || selected._id || selected.studentId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadThread(selected.id || selected._id || selected.studentId), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, loadThread]);

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteTeacherStudentMessage(messageId);
      await loadThread(studentId);
    } catch (e) {
      alert(e?.message || 'Could not delete');
    }
  };

  const handleEditSave = async (messageId) => {
    try {
      await editTeacherStudentMessage(messageId, editText);
      setEditingId(null);
      setEditText('');
      await loadThread(studentId);
    } catch (e) {
      alert(e?.message || 'Could not edit');
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!studentId) return;
    if (!text.trim() && !audio && !file) return;
    setSending(true);
    try {
      await sendTeacherStudentMessage(studentId, { text: text.trim(), audio: audio?.file || null, file });
      setText('');
      setAudio(null);
      setFile(null);
      await loadThread(studentId);
    } catch (e) {
      alert(e?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">My Students</h1>
          <p className="text-[13px] font-semibold text-slate-500">Students assigned to you</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></div>
      ) : error ? (
        <div className="text-red-600 text-sm">{error}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-3 space-y-2 max-h-[70vh] overflow-auto">
            {students.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No students assigned.</p>
            ) : students.map((s) => {
              const id = s.id || s._id || s.studentId;
              const active = studentId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border ${active ? 'border-brand-700 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <p className="text-sm font-bold text-ink">{s.name || s.studentName}</p>
                  <p className="text-xs text-slate-500">{s.className || s.studentClass || ''}</p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 flex flex-col min-h-[60vh]">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                <MessageSquare className="h-5 w-5 mr-2" /> Select a student to message
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 pb-3 mb-3">
                  <p className="font-bold text-ink">{selected.name || selected.studentName}</p>
                  <p className="text-xs text-slate-500">{selected.className || selected.studentClass}</p>
                </div>

                <div className="flex-1 overflow-auto space-y-3 mb-3">
                  {threadLoading && messages.length === 0 ? (
                    <div className="flex items-center justify-center h-20"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No messages yet.</p>
                  ) : messages.map((m) => {
                    const mine = m.senderRole === 'teacher';
                    const canModify = mine && m.createdAt && (Date.now() - new Date(m.createdAt).getTime() < 15 * 60 * 1000) && !m.deletedAt;
                    return (
                      <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-brand-700 text-white' : 'bg-slate-100 text-ink'}`}>
                          {editingId === m._id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-2 py-1 text-sm text-ink"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleEditSave(m._id)} className="text-xs font-bold underline">Save</button>
                                <button type="button" onClick={() => { setEditingId(null); setEditText(''); }} className="text-xs underline">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {m.body ? <p className="text-sm whitespace-pre-wrap">{m.body}{m.editedAt ? ' (edited)' : ''}</p> : null}
                              {Array.isArray(m.attachments) && m.attachments.map((a, idx) => (
                                <div key={idx} className="mt-2">
                                  {a.kind === 'audio' ? (
                                    <audio controls src={a.url} className="w-full" />
                                  ) : String(a.mimeType || '').startsWith('image/') ? (
                                    <a href={a.url} target="_blank" rel="noreferrer">
                                      <img src={a.url} alt={a.originalName || 'image'} className="max-h-48 rounded-xl cursor-pointer hover:opacity-90" />
                                    </a>
                                  ) : String(a.mimeType || '').includes('pdf') ? (
                                    <a href={a.url} target="_blank" rel="noreferrer" className="block">
                                      <iframe src={a.url} title={a.originalName || 'pdf'} className="w-full h-64 rounded-xl border pointer-events-none" />
                                    </a>
                                  ) : (
                                    <a href={a.url} target="_blank" rel="noreferrer" download={a.originalName || undefined} className="text-xs underline">
                                      {a.originalName || 'Attachment'}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <p className={`text-[10px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                              {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                            </p>
                            {canModify ? (
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { setEditingId(m._id); setEditText(m.body || ''); }} className={`text-[10px] underline ${mine ? 'text-white/80' : 'text-slate-600'}`}>Edit</button>
                                <button type="button" onClick={() => handleDelete(m._id)} className={`text-[10px] underline ${mine ? 'text-white/80' : 'text-slate-600'}`}>Delete</button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSend} className="space-y-3 border-t border-slate-100 pt-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write a message..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <AudioRecorder onChange={setAudio} />
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                      {file ? file.name : 'Attach file'}
                    </label>
                    <button
                      type="submit"
                      disabled={sending}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherStudents;
