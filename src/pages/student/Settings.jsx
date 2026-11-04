import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Bell, Download, Trash2, Camera, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudentDashboard } from '../../hooks/useStudentDashboard';

const Settings = () => {
  const { user } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('auth_token') === 'student-demo-token';
  const { data } = useStudentDashboard(!isDemo);
  const prefilled = useRef(false);

  const [tab, setTab] = useState('profile');
  const [name, setName] = useState('Student');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('student@school.edu');
  const [phone, setPhone] = useState('');
  const [theme, setTheme] = useState('system');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (prefilled.current) return;
    const p = data?.profile || {};
    const hasData = data || user;
    if (!hasData) return;
    prefilled.current = true;
    setName(p.name || user?.name || 'Student');
    setEmail(p.email || user?.email || '');
    setPhone(p.phone || user?.phone || '');
    setBio(p.bio || '');
  }, [data, user]);

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Lock },
    { key: 'preferences', label: 'Preferences', icon: Bell },
    { key: 'data', label: 'Data', icon: Download },
  ];

  const save = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const strength = newPw.length >= 8 && /[A-Z]/.test(newPw) && /\d/.test(newPw) ? 'strong' : newPw.length >= 6 ? 'medium' : 'weak';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
          <p className="text-[13px] font-semibold text-slate-500">Manage your profile and account</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-bold transition ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profile' && (
        <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 font-extrabold text-2xl">
                {name.charAt(0).toUpperCase()}
              </div>
              <label className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white cursor-pointer shadow">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" />
              </label>
            </div>
            <div>
              <p className="text-[13px] font-extrabold text-ink">Profile photo</p>
              <p className="text-[11px] text-slate-500">JPG, PNG up to 2MB. Drag & drop or click to upload.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Full name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={200} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" placeholder="Tell us about yourself..." />
            <p className="text-[10.5px] text-slate-400 mt-1">{bio.length}/200</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2 text-[12.5px] font-extrabold text-white hover:bg-brand-800">Save changes</button>
            {saved && <span className="inline-flex items-center gap-1 text-emerald-600 text-[12px] font-bold"><Check className="h-3.5 w-3.5" />Saved</span>}
          </div>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Current password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">New password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            {newPw && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${strength === 'strong' ? 'bg-emerald-500 w-full' : strength === 'medium' ? 'bg-amber-500 w-2/3' : 'bg-rose-500 w-1/3'}`} />
                </div>
                <span className={`text-[10.5px] font-bold ${strength === 'strong' ? 'text-emerald-600' : strength === 'medium' ? 'text-amber-600' : 'text-rose-600'}`}>{strength}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Confirm new password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[12.5px]" />
            {confirmPw && confirmPw !== newPw && <p className="mt-1 text-[11px] text-rose-600">Passwords do not match</p>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] font-bold text-ink mb-2">Two-factor authentication</p>
            <p className="text-[11.5px] text-slate-500 mb-3">Add an extra layer of security to your account.</p>
            <button type="button" className="rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200">Enable 2FA</button>
          </div>
          <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2 text-[12.5px] font-extrabold text-white hover:bg-brand-800">Update password</button>
        </form>
      )}

      {tab === 'preferences' && (
        <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <p className="text-[12px] font-bold text-ink mb-2">Theme</p>
            <div className="flex gap-2">
              {['light', 'dark', 'system'].map((t) => (
                <button key={t} type="button" onClick={() => setTheme(t)}
                  className={`rounded-xl px-3 py-2 text-[12px] font-bold capitalize ${theme === t ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[12px] font-bold text-ink">Notifications</p>
            <label className="flex items-center justify-between">
              <span className="text-[12.5px] text-slate-600">Email notifications</span>
              <input type="checkbox" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-[12.5px] text-slate-600">Push notifications</span>
              <input type="checkbox" checked={notifPush} onChange={(e) => setNotifPush(e.target.checked)} className="h-4 w-4" />
            </label>
          </div>
          <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2 text-[12.5px] font-extrabold text-white hover:bg-brand-800">Save preferences</button>
        </form>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-slate-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-ink">Export your data</p>
                <p className="text-[11.5px] text-slate-500 mt-1">Download a copy of your profile, grades, and attendance.</p>
                <button className="mt-3 rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:bg-slate-200">Request export</button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-rose-900">Delete account</p>
                <p className="text-[11.5px] text-rose-700 mt-1">This action is permanent. Type DELETE to confirm.</p>
                <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="mt-3 w-full rounded-xl border border-rose-200 px-3 py-2 text-[12.5px]" />
                <button disabled={deleteConfirm !== 'DELETE'} className="mt-3 rounded-xl bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                  Delete my account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
