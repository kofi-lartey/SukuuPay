import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSchool } from '../../services/school';
import { getCashflowVelocity } from '../../services/analytics';
import PageHeader from '../../components/dashboard/PageHeader';
import Card from '../../components/dashboard/ui/Card';
import FeatureGate from '../../components/common/FeatureGate';
import { TrendingUp } from 'lucide-react';

const CashFlowAnalytics = () => {
  const { user } = useAuth();
  const [horizon, setHorizon] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [school, setSchool] = useState(null);

  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    getSchool(user.schoolId).then((r) => { if (active) setSchool(r); }).catch(() => { if (active) setSchool(null); });
    return () => { active = false; };
  }, [user?.schoolId]);

  useEffect(() => {
    if (!user?.schoolId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    getCashflowVelocity(user.schoolId, { horizonDays: horizon })
      .then((r) => { if (active) setData(r); })
      .catch((e) => { if (active) setError(e?.message || 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.schoolId, horizon]);

  const summary = data?.summary || {};
  const series = Array.isArray(data?.series) ? data.series : [];
  const schoolName = user?.schoolName || school?.name || 'your school';

  return (
    <FeatureGate feature="cashFlowAnalytics">
      <PageHeader
        eyebrow="Overview / Analytics / Cash Flow"
        title="Cash Flow & Velocity Analytics"
        description={`Forecast collections and track payment velocity for ${schoolName}.`}
      />
      <div className="mb-4 flex items-center gap-2">
        {[30, 60, 90].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-extrabold ${horizon === h ? 'bg-brand-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            {h} days
          </button>
        ))}
      </div>

      {loading && <p className="text-[12px] font-semibold text-slate-500">Loading…</p>}
      {error && <p className="text-[12px] font-semibold text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Projected Inflow', summary.projectedInflowDisplay ?? summary.projectedInflow],
              ['Collected to Date', summary.collectedToDateDisplay ?? summary.collectedToDate],
              ['Collection Velocity', summary.collectionVelocity != null ? `${summary.collectionVelocity}%` : '—'],
              ['Avg Days to Pay', summary.averageDaysToPay != null ? summary.averageDaysToPay : '—'],
              ['On-Time Rate', summary.onTimeRate != null ? `${summary.onTimeRate}%` : '—'],
            ].map(([label, val]) => (
              <Card key={label} padding="p-4">
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-[18px] font-extrabold text-ink">{val ?? '—'}</p>
              </Card>
            ))}
          </div>

          <Card padding="p-4" className="mt-5">
            {series.length === 0 ? (
              <p className="py-8 text-center text-[12px] font-semibold text-slate-500">No data for this range.</p>
            ) : (
              <svg viewBox="0 0 400 160" className="h-40 w-full">
                {series.map((b, i) => {
                  const max = Math.max(...series.map((s) => Math.max(s.projected || 0, s.collected || 0)), 1);
                  const w = 400 / series.length;
                  const ph = ((b.projected || 0) / max) * 120;
                  const ch = ((b.collected || 0) / max) * 120;
                  return (
                    <g key={i} transform={`translate(${i * w},0)`}>
                      <rect x={2} y={140 - ph} width={w / 2 - 2} height={ph} fill="#94a3b8" />
                      <rect x={w / 2} y={140 - ch} width={w / 2 - 2} height={ch} fill="#1d4ed8" />
                    </g>
                  );
                })}
              </svg>
            )}
          </Card>
        </>
      )}
    </FeatureGate>
  );
};

export default CashFlowAnalytics;
