import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Construction,
  CreditCard,
  LogOut,
  Receipt,
  ShieldCheck,
  Upload,
  Wallet,
} from 'lucide-react';
import { listStudents } from '../services/students';
import { useAuth } from '../context/AuthContext';

const STATS = [
  { label: 'Balance', value: 'GH₵ 0.00', icon: Wallet, tone: 'text-brand-700' },
  { label: 'Transactions', value: '0', icon: Receipt, tone: 'text-slate-900' },
  { label: 'MoMo Cards', value: '0', icon: CreditCard, tone: 'text-slate-900' },
];

/**
 * The student roster, read here for the first time in the product.
 *
 * Steps 3 and 4 both promise "you can import students later from the dashboard".
 * Until the dashboard exists that promise resolves to nowhere, so the roster count
 * is surfaced here explicitly — with an honest note that the import screen itself
 * is still to come, rather than a button that navigates to a stub.
 */
const RosterCard = () => {
  const { user } = useAuth();
  const [state, setState] = useState({ loaded: false, total: null });

  useEffect(() => {
    let active = true;
    if (!user?.schoolId) return undefined;

    listStudents({ perPage: 1 })
      .then((rows) => {
        if (!active) return;
        const total = rows?.[0]?.totalStudents ?? rows?.length ?? 0;
        setState({ loaded: true, total });
      })
      .catch(() => {
        if (active) setState({ loaded: false, total: null });
      });

    return () => {
      active = false;
    };
  }, [user?.schoolId]);

  const empty = state.loaded && state.total === 0;

  return (
    <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-extrabold text-ink">Students</h2>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
          Coming soon
        </span>
      </div>

      {state.loaded ? (
        <p className="text-sm font-medium text-slate-600">
          {state.total > 0 ? (
            <>
              <span className="font-extrabold text-ink">{state.total}</span>{' '}
              {state.total === 1 ? 'student' : 'students'} on your roster.
            </>
          ) : (
            <>
              You have not added any students yet. If you skipped the import step during setup,
              you can bring your roster in here.
            </>
          )}
        </p>
      ) : (
        <p className="text-sm font-medium text-slate-600">Loading your roster…</p>
      )}

      {empty && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Not a link: the import screen does not exist yet. Rendering a
              disabled-looking button to nowhere would be the same dead end this
              card exists to avoid, so the state is stated instead. */}
          <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold text-slate-400">
            <Upload className="h-4 w-4" />
            Import students
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Bulk import is on the way.
          </span>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">Dashboard</h1>
            <p className="mt-1 text-slate-600">Welcome back, {user?.name || user?.email}</p>
          </div>

          {/* The dashboard is a placeholder while the real one is built. Said
              plainly, so an admin sent here by the onboarding wizard knows the
              product is incomplete rather than concluding their setup failed. */}
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-extrabold text-amber-800">
            <Construction className="h-4 w-4" aria-hidden="true" />
            Dashboard is being built
          </span>
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

        <RosterCard />

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
