import React, { useEffect, useState } from 'react';
import { fetchSchoolLogos } from '../../services/schoolLogos';

/**
 * Fallback static demo schools with reliable SVG/CSS logos in case
 * backend schools list is empty or under 6 items.
 */
const DEMO_SCHOOLS = [
  {
    _id: 'demo-1',
    name: 'Morning Star School',
    shortName: 'MS',
    brandColor: '#0F5132',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=MorningStar&backgroundColor=0F5132',
  },
  {
    _id: 'demo-2',
    name: 'Riverside International',
    shortName: 'RI',
    brandColor: '#1e40af',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=Riverside&backgroundColor=1e40af',
  },
  {
    _id: 'demo-3',
    name: 'New Horizon Academy',
    shortName: 'NH',
    brandColor: '#7c3aed',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=NewHorizon&backgroundColor=7c3aed',
  },
  {
    _id: 'demo-4',
    name: 'Ashanti Grove School',
    shortName: 'AG',
    brandColor: '#b91c1c',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=AshantiGrove&backgroundColor=b91c1c',
  },
  {
    _id: 'demo-5',
    name: 'Victory Preparatory',
    shortName: 'VP',
    brandColor: '#0369a1',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=VictoryPrep&backgroundColor=0369a1',
  },
  {
    _id: 'demo-6',
    name: 'Crown Legacy Academy',
    shortName: 'CL',
    brandColor: '#a16207',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=CrownLegacy&backgroundColor=a16207',
  },
  {
    _id: 'demo-7',
    name: 'Pioneer Heights',
    shortName: 'PH',
    brandColor: '#be185d',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=PioneerHeights&backgroundColor=be185d',
  },
  {
    _id: 'demo-8',
    name: 'Golden Gate International',
    shortName: 'GG',
    brandColor: '#15803d',
    logo: 'https://api.dicebear.com/7.x/identicon/svg?seed=GoldenGate&backgroundColor=15803d',
  },
];

const MARQUEE_KEYFRAMES = `
@keyframes logo-marquee {
  0%   { transform: translate3d(0, 0, 0); }
  100% { transform: translate3d(-50%, 0, 0); }
}
`;

/**
 * Renders a school logo with error handling that falls back to a clean badge.
 */
const SchoolLogoTile = ({ school }) => {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-20 w-48 shrink-0 items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      {!imageError && school.logo ? (
        <img
          src={school.logo}
          alt={`${school.name} logo`}
          loading="lazy"
          onError={() => setImageError(true)}
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white shadow-inner"
          style={{ backgroundColor: school.brandColor || '#0F5132' }}
        >
          {school.shortName || getInitials(school.name)}
        </div>
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800">
        {school.name}
      </span>
    </div>
  );
};

/**
 * An infinite-scrolling marquee of schools onboarded on SukuuPay.
 */
const SchoolLogoCarousel = () => {
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    let active = true;
    fetchSchoolLogos()
      .then((loaded) => {
        if (active && Array.isArray(loaded)) {
          setSchools(loaded.filter(Boolean));
        }
      })
      .catch(() => {
        if (active) setSchools([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    setReducedMotion(query.matches);
    const onChange = (event) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Merge real schools with demo pad if less than 6
  const sourceList =
    schools.length >= 6
      ? schools
      : [...schools, ...DEMO_SCHOOLS].slice(0, 12);

  if (sourceList.length === 0) return null;

  // Build marquee track array
  const copy = [];
  while (copy.length < 6) {
    copy.push(...sourceList);
  }

  const duration = Math.max(20, copy.length * 5);

  return (
    <section
      aria-label="Schools on SukuuPay"
      className="border-t border-slate-100 bg-slate-50/50 py-10"
    >
      <style>{MARQUEE_KEYFRAMES}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Schools on SukuuPay
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {schools.length > 0
                ? `${schools.length} ${
                    schools.length === 1 ? 'school' : 'schools'
                  } collect fees with us`
                : 'Trusted by educational institutions across Ghana'}
            </p>
          </div>
        </div>

        {reducedMotion ? (
          <div className="mt-8 flex flex-wrap gap-4">
            {sourceList.map((school) => (
              <SchoolLogoTile key={school._id} school={school} />
            ))}
          </div>
        ) : (
          <div className="group mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
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
                <SchoolLogoTile
                  key={`${school._id}-${position}`}
                  school={school}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SchoolLogoCarousel;