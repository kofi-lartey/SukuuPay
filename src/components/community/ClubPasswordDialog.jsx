import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';

const ClubPasswordDialog = ({ open, clubName, onSubmit, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the club password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(password.trim());
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Incorrect club password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-teal-600" />
            <h2 className="text-[16px] font-extrabold text-ink">Enter Club Password</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13px] text-slate-600 mb-4">
          To join <strong>{clubName}</strong>, please enter the club password.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 hover:text-teal-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p className="text-[11px] text-red-500 font-bold">{error}</p>
          )}
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
              disabled={loading || !password.trim()}
              className="rounded-xl bg-teal-600 px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClubPasswordDialog;
