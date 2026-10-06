import React, { useEffect, useState } from 'react';
import { fetchSchoolAds } from '../services/schoolAds';
import AdDetailModal from '../components/common/AdDetailModal';
import EmptyState from '../components/dashboard/EmptyState';
import { Megaphone } from 'lucide-react';

const PLACEMENT_TABS = [
  { key: 'all', label: 'All' },
  { key: 'advertisement_page', label: 'Advertisement page' },
  { key: 'home_hero', label: 'Homepage hero' },
];

const AdvertisementsHub = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedAd, setSelectedAd] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSchoolAds('all', { perPage: 24 }).then((loaded) => {
      if (active) {
        setAds(loaded);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = filter === 'all' ? ads : ads.filter((ad) => ad.placement === filter);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">School Advertisements</h1>
          <p className="mt-4 text-lg font-medium text-slate-500">
            See where schools are advertising across SukuuPay.
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {PLACEMENT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                filter === tab.key
                  ? 'bg-brand-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={Megaphone}
              title={filter === 'all' ? 'No advertisements yet' : 'Nothing for this filter'}
              description={
                filter === 'all'
                  ? 'Schools can submit a creative for the public pages; check back soon.'
                  : 'Try a different placement filter.'
              }
            />
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((ad) => (
              <article
                key={ad._id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setSelectedAd(ad)}
                  className="relative h-44 w-full text-left"
                >
                  <img
                    src={ad.imageUrl}
                    alt={ad.imageAlt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-brand-900/60 via-brand-900/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">{ad.schoolName}</p>
                    <p className="mt-1 text-sm font-extrabold leading-tight text-white">{ad.headline}</p>
                  </div>
                </button>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {ad.writeup && (
                    <p className="line-clamp-3 text-sm font-medium leading-relaxed text-slate-600">{ad.writeup}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand-700">
                      {ad.placement === 'advertisement_page' ? 'Advertisement page' : 'Homepage hero'}
                    </span>
                    {ad.endsAt && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        Runs until {new Date(ad.endsAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <a
                    href={ad.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-soft transition-colors hover:border-slate-300 hover:shadow-md"
                  >
                    Visit school
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        <AdDetailModal
          open={!!selectedAd}
          ad={selectedAd}
          schoolId={selectedAd?.schoolId}
          onClose={() => setSelectedAd(null)}
        />
      </div>
    </div>
  );
};

export default AdvertisementsHub;
