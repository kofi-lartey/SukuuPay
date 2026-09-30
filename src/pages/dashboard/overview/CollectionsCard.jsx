import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import Card from '../../../components/dashboard/ui/Card';
import Badge from '../../../components/dashboard/ui/Badge';
import AreaChart from '../../../components/dashboard/charts/AreaChart';
import { formatCedi, formatCediShort } from '../../../utils/format';

const FILTERS = [
  { key: 'all', label: 'All Channels' },
  { key: 'mtn', label: 'MTN MoMo' },
  { key: 'telecel', label: 'Telecel Cash' },
  { key: 'at', label: 'AT Money' },
];

/**
 * Weekly collections, with a network filter.
 *
 * The filter is a segmented control over the same series rather than a page
 * change: switching network is comparing one question from three angles, and
 * making it navigate would lose the comparison and the scroll position both.
 * The cumulative figure updates with it, because a bursar filtering to MTN wants
 * MTN's total, not the school's — leaving the headline on the unfiltered sum
 * would be a subtle lie.
 *
 * The peak callout is passed to the chart as `peakIndex` rather than left to
 * hover, so the card says something useful on first paint instead of presenting
 * an unlabelled curve and waiting to be touched.
 */
const CollectionsCard = ({ term, seriesFor, isDemo }) => {
  const [channel, setChannel] = useState('all');

  const series = useMemo(() => seriesFor(channel), [seriesFor, channel]);

  const cumulative = useMemo(
    () => series.reduce((sum, point) => sum + point.value, 0),
    [series]
  );

  const peakIndex = useMemo(() => {
    if (!series.length) return -1;
    return series.reduce(
      (best, point, i) => (point.value > series[best].value ? i : best),
      0
    );
  }, [series]);

  const activeFilter = FILTERS.find((f) => f.key === channel);

  return (
    <Card padding="p-5" className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold tracking-tight text-ink">
              Collections This Term (Weekly)
            </h3>
            {term?.weekLabel && (
              <Badge tone="slate" icon={Info}>
                {term.weekLabel}
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-md text-[13px] font-medium leading-snug text-slate-500">
            Automated Mobile Money settlements reconciled directly via Bank of Ghana
            switch
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter collections by network"
          className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 p-1"
        >
          {FILTERS.map((filter) => {
            const active = filter.key === channel;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setChannel(filter.key)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold leading-tight transition-colors ${
                  active
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-slate-500 hover:text-ink'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            Cumulative Net Inflow
          </p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-brand-700">
            {formatCedi(cumulative)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            Peak Inflow Week
          </p>
          <p className="mt-1 text-sm font-extrabold text-ink">
            {term?.peakInflow?.week}
            <span className="ml-1.5 text-[11px] font-semibold text-slate-500">
              {term?.peakInflow?.note}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            Target Term Threshold
          </p>
          <p className="mt-1 text-sm font-extrabold text-ink">
            {formatCedi(term?.targetThreshold)}
          </p>
        </div>
      </div>

      {/*
        The chart is a pure function of its series, so a network switch swaps it
        wholesale. The header is a region landmark and the chart is described in
        one aria-label listing every week, which is what makes the curve readable
        by a screen reader rather than being an unlabelled image.
      */}
      <AreaChart
        series={series}
        peakIndex={peakIndex}
        formatValue={formatCediShort}
        formatAxis={formatCediShort}
        className="mt-4"
      />

      <p className="mt-2 text-[11px] font-semibold text-slate-400">
        Showing {activeFilter?.label}
        {isDemo ? ' · demo data' : ''}. Hover a point for its exact amount.
      </p>
    </Card>
  );
};

export default CollectionsCard;
