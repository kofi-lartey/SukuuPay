import React from 'react';
import { Link } from 'react-router-dom';
import HeroAdSlider from './HeroAdSlider';

/**
 * The hero, as a slider.
 *
 * The section shell — ambient background and the closing CTA band —
 * stays here; the slides inside are `HeroAdSlider`'s. The first slide
 * is always the SukuuPay story (`HeroBrandSlide`), and every live
 * `home_hero` creative rotates after it.
 */
const Hero = () => (
  <section className="relative overflow-hidden bg-slate-50/60">
    {/* Ambient background */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-32 top-10 h-[520px] w-[520px] rounded-full bg-brand-100/70 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-emerald-50 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent"
    />

    <HeroAdSlider />

    {/* Closing CTA */}
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-900 p-8 text-center text-white shadow-xl sm:p-10 lg:flex-row lg:text-left">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ready to collect every cedi this term?
          </h2>
          <p className="text-sm text-brand-100 sm:text-base">
            Set up in 10 minutes. Free onboarding for the first five pilot schools.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50"
          >
            Get started free
          </Link>
          <Link
            to="/contact"
            className="rounded-xl border border-brand-600 bg-brand-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
