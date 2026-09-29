import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Play,
  ShieldCheck,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import GhanaFlag from './GhanaFlag';
import PhoneMockup from './PhoneMockup';

const AVATARS = [
  {
    name: 'Headmistress Ama Darko',
    src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
  },
  {
    name: 'Bursar Kwesi Owusu',
    src: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80',
  },
  {
    name: 'Headmaster Yaw Boateng',
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  },
  {
    name: 'Registrar Efua Ansah',
    src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
  },
];

const TRUST_POINTS = [
  { icon: CheckCircle2, label: 'Zero parent surcharge' },
  { icon: Zap, label: 'Instant GhIPSS bank sweeps' },
  { icon: ShieldCheck, label: '100% BoG Compliant' },
];

const Hero = () => {
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

  return (
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

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-32">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-10">
          {/* Left column */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 shadow-soft backdrop-blur">
              <GhanaFlag />
              <span className="text-xs font-bold text-brand-700 sm:text-sm">
                Ghana&apos;s #1 School Fee &amp; Mobile Money Solution
              </span>
            </div>

            <h1 className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-[4.25rem]">
              Collect every school fee.
              <br />
              <span className="relative inline-block text-brand-700">
                Every term.
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 h-3 w-full text-brand-300"
                >
                  <path
                    d="M2 8C40 3 70 10 108 5c38-5 70 2 110-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Ghanaian schools use SukuuPay to collect fees via MTN MoMo, Telecel Cash and AT
              Money — with automatic receipts, SMS reminders and flexible installment plans.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                to="/signup"
                className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-brand-700 px-7 py-4 text-base font-bold text-white shadow-lift transition-all hover:-translate-y-0.5 hover:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-700/25"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#book-demo"
                className="inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-800 shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-900/5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                </span>
                Book a Demo
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex -space-x-3">
                {AVATARS.map((avatar) => (
                  <img
                    key={avatar.name}
                    src={avatar.src}
                    alt={avatar.name}
                    title={avatar.name}
                    loading="lazy"
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-soft"
                  />
                ))}
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white ring-2 ring-white">
                  400+
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1" aria-label="Rated 5 out of 5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-1.5 text-xs font-bold text-slate-500">4.9/5</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Trusted by schools in Prampram, Tema &amp; Accra
                </p>
              </div>
            </div>

            {/* Trust row */}
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-200/80 pt-6 text-sm font-bold text-slate-700">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-700" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column */}
          <div className="relative lg:col-span-5">
            <div className="relative mx-auto max-w-sm px-6 py-4 sm:px-10">
              <PhoneMockup onPaid={handlePaid} paid={paid} />

              {/* Floating payment notification */}
              <div
                className={`absolute -top-2 right-0 z-30 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-xl shadow-slate-900/10 transition-all duration-300 sm:-right-6 lg:-right-4 ${
                  paid ? 'scale-105 ring-2 ring-brand-700/30' : ''
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Payment Received
                  </p>
                  <p className="text-base font-extrabold text-ink">GH₵ 300.00</p>
                </div>
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold text-brand-700">
                  {lastChannel ? lastChannel.badge : 'MoMo'}
                </span>
              </div>

              {/* Floating analytics card */}
              <div className="absolute -bottom-4 left-0 z-30 w-60 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl shadow-slate-900/10 sm:-left-8 lg:-left-10">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Term 2 Progress</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold text-brand-700">
                    <TrendingUp className="h-3 w-3" /> +18.4%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight text-ink">87%</span>
                  <span className="text-xs font-bold text-slate-600">Collection Rate</span>
                </div>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 200 40"
                  preserveAspectRatio="none"
                  className="mt-3 h-8 w-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="sukuu-spark" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6CE9A6" />
                      <stop offset="100%" stopColor="#0F5132" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 35C30 33 50 26 78 27c28 1 42-8 70-11 20-2 32 2 52-9"
                    fill="none"
                    stroke="url(#sukuu-spark)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="200" cy="7" r="4" fill="#0F5132" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

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
};

export default Hero;
