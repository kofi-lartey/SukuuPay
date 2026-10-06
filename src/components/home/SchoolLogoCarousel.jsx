import React, { useEffect, useState } from 'react';
import { fetchSchoolLogos } from '../../services/schoolLogos';

const DEMO_SCHOOLS = [
  { _id: 'demo-1', name: 'Morning Star Academy', logo: 'https://placehold.co/80x80/0F5132/white?text=MS' },
  { _id: 'demo-2', name: 'Riverside International', logo: 'https://placehold.co/80x80/1e40af/white?text=RI' },
  { _id: 'demo-3', name: 'New Horizon School', logo: 'https://placehold.co/80x80/7c3aed/white?text=NH' },
  { _id: 'demo-4', name: 'Ashanti Grove School', logo: 'https://placehold.co/80x80/b91c1c/white?text=AG' },
  { _id: 'demo-5', name: 'Victory Preparatory', logo: 'https://placehold.co/80x80/0369a1/white?text=VP' },
  { _id: 'demo-6', name: 'Crown Legacy Academy', logo: 'https://placehold.co/80x80/a16207/white?text=CL' },
  { _id: 'demo-7', name: 'Pioneer Heights', logo: 'https://placehold.co/80x80/be185d/white?text=PH' },
  { _id: 'demo-8', name: 'Golden Gate School', logo: 'https://placehold.co/80x80/15803d/white?text=GG' },
];

const MARQUEE_KEYFRAMES = `
@keyframes logo-marquee {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-50%, 0, 0); }
}
`;

/**
 * An infinite-scrolling row of the schools on SukuuPay.
 *
 * The track is two identical copies of the source list, animated left by
 * -50% so it loops without a seam. Pauses on hover/focus, and falls back
 * to a static wrap grid for readers who ask for reduced motion.
 *
 * When the platform has fewer than six schools, demo logos pad the track
 * so the marquee is always visibly moving.
 */
const SchoolLogoCarousel = () => {
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    let active = true;
    fetchSchoolLogos().then((loaded) => {
      if (active) setSchools(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    setReducedMotion(query.matches);
    const onChange = (event) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (schools.length === 0) return null;

  const allSchools = schools.length >= 6 ? schools : [...schools, ...DEMO_SCHOOLS].slice(0, 12);

  // Repeat the source list until one copy of the track holds at least
  // six tiles, so the seam at -50% never shows the same school twice
  // in a row.
  const copy = [];
  while (copy.length < 6) {
    copy.push(...allSchools);
  }

  const duration = Math.max(24, copy.length * 6);

  return (
    <section aria-label="Schools on SukuuPay" className="border-t border-slate-100 bg-white py-10">
      <style>{MARQUEE_KEYFRAMES}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Schools on SukuuPay</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {schools.length > 0
                ? `${schools.length} ${schools.length === 1 ? 'school' : 'schools'} collect fees with us`
                : 'Trusted by schools across Ghana'}
            </p>
          </div>
        </div>

        {reducedMotion ? (
          <div className="mt-8 flex flex-wrap gap-4">
            {allSchools.map((school) => (
              <div
                key={school._id}
                className="flex h-20 w-44 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50/60 px-4"
              >
                <img
                  src={school.logo}
                  alt={`${school.name} logo`}
                  loading="lazy"
                  className="max-h-10 max-w-full object-contain"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="group mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
          >
            <div
              className="flex w-max gap-4 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
              style={{
                animationName: 'logo-marquee',
                animationDuration: `${duration}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
              }}
              tabIndex={0}
            >
              {[...copy, ...copy].map((school, position) => (
                <div
                  key={`${school._id}-${position}`}
                  className="flex h-20 w-44 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50/60 px-4"
                >
                  <img
                    src={school.logo}
                    alt={`${school.name} logo`}
                    loading="lazy"
                    className="max-h-10 max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SchoolLogoCarousel;
