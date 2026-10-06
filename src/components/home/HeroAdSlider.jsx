import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { fetchSchoolAds } from '../../services/schoolAds';
import AdDetailModal from '../common/AdDetailModal';
import HeroBrandSlide from './HeroBrandSlide';

const ROTATE_MS = 6000;

/**
 * The hero, as a slider: the SukuuPay story first, then every live
 * `home_hero` creative.
 *
 * Crossfades between slides so the section height never jumps. The brand
 * slide stays in flow (it is the height of the hero); every ad overlay
 * is `absolute inset-0` and paints on top of it.
 */
const HeroAdSlider = () => {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [paid, setPaid] = useState(false);
  const [lastChannel, setLastChannel] = useState(null);
  const timerRef = useRef(null);

  const handlePaid = useCallback((channel) => {
    setLastChannel(channel);
    setPaid(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPaid(false), 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    let active = true;
    fetchSchoolAds('home_hero').then((loaded) => {
      if (active) setAds(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const total = ads.length + 1;

  useEffect(() => {
    setIndex((current) => Math.min(current, total - 1));
  }, [total]);

  useEffect(() => {
    if (total < 2) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return undefined;

    const timer = setInterval(() => {
      if (!pausedRef.current) setIndex((current) => (current + 1) % total);
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [total]);

  const goTo = useCallback((next) => setIndex(((next % total) + total) % total), [total]);
  const next = useCallback(() => setIndex((current) => (current + 1) % total), [total]);
  const prev = useCallback(() => setIndex((current) => (current - 1 + total) % total), [total]);

  const [selectedAd, setSelectedAd] = useState(null);

  const slideLabel = (position) => {
    if (position === 0) return 'SukuuPay';
    const ad = ads[position - 1];
    return `${ad.schoolName} — ${ad.headline}`;
  };

  if (total === 1) {
    return <HeroBrandSlide paid={paid} lastChannel={lastChannel} onPaid={handlePaid} />;
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured schools and SukuuPay"
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); prev(); }
        if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      }}
    >
      {/* Crossfade stack. The brand slide stays in flow (it is the height
          of the hero); every ad overlay is absolute inset-0 on top. */}
      <div className="relative">
        {/* Brand slide: always in flow, opacity toggles. */}
        <div className={index === 0 ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}>
          <HeroBrandSlide paid={paid} lastChannel={lastChannel} onPaid={handlePaid} />
        </div>

        {/* Ad slides: absolute inset-0, opacity toggles. */}
        {ads.map((ad, position) => (
          <div
            key={ad._id}
            onClick={() => setSelectedAd(ad)}
            className={index === position + 1 ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'}
          >
            <HeroAdSlide ad={ad} onAction={() => setSelectedAd(ad)} />
          </div>
        ))}
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous advertisement"
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-900 shadow-lg opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 focus:opacity-100 group-hover:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next advertisement"
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-900 shadow-lg opacity-0 transition-opacity hover:bg-white focus-visible:opacity-100 focus:opacity-100 group-hover:opacity-100"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
        <button
          type="button"
          onClick={() => goTo(0)}
          aria-label="SukuuPay story"
          aria-current={index === 0}
          className={`h-1.5 rounded-full transition-all ${
            index === 0 ? 'w-5 bg-brand-700' : 'w-1.5 bg-slate-400 hover:bg-slate-600'
          }`}
        />
        {ads.map((ad, position) => (
          <button
            key={ad._id}
            type="button"
            onClick={() => goTo(position + 1)}
            aria-label={`${ad.schoolName} — ${ad.headline}`}
            aria-current={index === position + 1}
            className={`h-1.5 rounded-full transition-all ${
              index === position + 1 ? 'w-5 bg-brand-700' : 'w-1.5 bg-slate-400 hover:bg-slate-600'
            }`}
          />
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {slideLabel(index)}
      </p>

      <AdDetailModal
        open={!!selectedAd}
        ad={selectedAd}
        schoolId={selectedAd?.schoolId}
        onClose={() => setSelectedAd(null)}
      />
    </section>
  );
};

const HeroAdSlide = ({ ad, onAction }) => (
  <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-32">
    <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 shadow-soft backdrop-blur">
          <Megaphone className="h-3.5 w-3.5 text-brand-700" />
          <span className="text-xs font-bold text-brand-700 sm:text-sm">{ad.schoolName}</span>
        </div>
        <h2 className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
          {ad.headline}
        </h2>
        {ad.writeup && (
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">{ad.writeup}</p>
        )}
        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href={ad.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-700 px-7 py-4 text-base font-bold text-white shadow-lift transition-all hover:-translate-y-0.5 hover:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-700/25"
          >
            Visit {ad.schoolName}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
          <Link
            to="/signup"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-800 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-900/5"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
      <div className="relative lg:col-span-5">
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="group relative block overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10"
        >
          <img
            src={ad.imageUrl}
            alt={ad.imageAlt}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-brand-900/40 via-transparent to-transparent" />
        </a>
      </div>
    </div>
  </div>
);

export default HeroAdSlider;
