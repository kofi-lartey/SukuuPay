import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSchoolAds } from '../../hooks/useSchoolAds';

const Dots = ({ total, index, goTo }) => (
  <div className="flex items-center justify-center gap-1.5">
    {Array.from({ length: total }, (_, dot) => (
      <button
        key={dot}
        type="button"
        onClick={() => goTo(dot)}
        aria-label={`Show advertisement ${dot + 1} of ${total}`}
        aria-current={dot === index}
        className={`h-1.5 rounded-full transition-all ${
          dot === index ? 'w-5 bg-amber-300' : 'w-1.5 bg-white/40 hover:bg-white/70'
        }`}
      />
    ))}
  </div>
);

/**
 * Pure presentation for a loaded set of creatives. Split from the data-owning
 * wrapper so the markup can be rendered and asserted without a browser.
 */
export const CarouselView = ({ ads, index, onPause, onStep, onGoTo, className = '' }) => {
  const total = ads.length;
  if (total === 0) return null;

  const ad = ads[index];

  return (
    <section
      aria-label="Schools open for admission"
      aria-roledescription="carousel"
      className={`group relative h-full overflow-hidden rounded-xl border border-white/10 bg-brand-900/40 ${className}`}
      onMouseEnter={() => onPause(true)}
      onMouseLeave={() => onPause(false)}
      onFocusCapture={() => onPause(true)}
      onBlurCapture={() => onPause(false)}
    >
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
        <img
          src={ad.imageUrl}
          alt={ad.imageAlt}
          loading="lazy"
          onError={(event) => {
            // A creative whose host is down must not leave a broken-image glyph
            // in the middle of the login panel. Swapping in a brand gradient
            // keeps the band intact and still advertises the school by name.
            event.currentTarget.style.display = 'none';
          }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-4 pb-8">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
            {ad.schoolName}
          </p>
          <p className="mt-1 text-[15px] font-extrabold leading-tight text-white">{ad.headline}</p>
        </div>
      </a>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Previous advertisement"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-brand-900/70 p-1.5 text-white/80 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Next advertisement"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-brand-900/70 p-1.5 text-white/80 opacity-0 transition-opacity hover:text-white focus-visible:opacity-100 focus:opacity-100 group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-2.5">
            <Dots total={total} index={index} goTo={onGoTo} />
          </div>
        </>
      )}
    </section>
  );
};

/**
 * Rotating panel of approved school creatives.
 *
 * Renders nothing at all when there is no live ad, so the aside falls back to
 * the metrics row rather than showing an empty frame on the login path. Height
 * comes from the caller, which owns the fixed slot this band sits in.
 */
export const SchoolAdCarousel = ({ placement = 'auth_aside', className = '', onCountChange }) => {
  const { ads, index, total, goTo, next, prev, setPaused } = useSchoolAds(placement);

  // Report upward so the slot can swap its metrics fallback for this band.
  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  if (total === 0) return null;

  return (
    <CarouselView
      ads={ads}
      index={index}
      className={className}
      onPause={setPaused}
      onGoTo={goTo}
      onStep={(delta) => (delta > 0 ? next() : prev())}
    />
  );
};

export default SchoolAdCarousel;
