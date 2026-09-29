import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, LogOut, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STATS = [
  { label: 'Balance', value: 'GH₵ 0.00', icon: Wallet, tone: 'text-brand-700' },
  { label: 'Transactions', value: '0', icon: Receipt, tone: 'text-slate-900' },
  { label: 'MoMo Cards', value: '0', icon: CreditCard, tone: 'text-slate-900' },
];

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-slate-600">Welcome back, {user?.name || user?.email}</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STATS.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-soft"
            >
              <Icon className="mx-auto mb-3 h-5 w-5 text-slate-400" />
              <p className={`text-3xl font-extrabold tracking-tight ${tone}`}>{value}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft">
          <h2 className="mb-4 text-xl font-extrabold text-ink">Account Information</h2>
          <dl className="space-y-3 text-sm">
            {[
              { label: 'Name', value: user?.name || '—' },
              { label: 'Email', value: user?.email || '—' },
              { label: 'Phone', value: user?.phone || '—' },
              { label: 'Role', value: user?.role?.replace(/_/g, ' ') || '—' },
              {
                label: 'Email verified',
                value: user?.isEmailVerified ? 'Yes' : 'No',
                tone: user?.isEmailVerified ? 'text-brand-700' : 'text-red-600',
              },
              { label: 'User ID', value: user?.id || user?._id || '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-slate-500">{row.label}:</dt>
                <dd className={`text-right font-bold text-ink ${row.tone || ''}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
          {!user?.isEmailVerified && (
            <Link
              to="/verify-email"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white shadow-lift transition-colors hover:bg-brand-800"
            >
              <ShieldCheck className="h-4 w-4" />
              Verify Email
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
