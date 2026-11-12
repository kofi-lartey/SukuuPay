import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';

const EVENT_TYPES = ['meeting', 'competition', 'trip', 'activity', 'virtual'];

const CreateEventDialog = ({ open, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('activity');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !startAt) return;
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        eventType,
        startAt,
        endAt: endAt || null,
        location: location.trim(),
        isVirtual,
      });
      setTitle('');
      setDescription('');
      setEventType('activity');
      setStartAt('');
      setEndAt('');
      setLocation('');
      setIsVirtual(false);
      onClose();
    } catch (err) {
      console.error('Failed to create event:', err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            <h2 className="text-[16px] font-extrabold text-ink">Create Event</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event details"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] min-h-[80px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">Start</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-700 mb-1">End (optional)</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Physical location or leave blank for virtual"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isVirtual"
              checked={isVirtual}
              onChange={(e) => setIsVirtual(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isVirtual" className="text-[12px] font-bold text-slate-700">Virtual event</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !startAt}
              className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventDialog;