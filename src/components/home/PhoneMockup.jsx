import React, { useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { LogoMark } from '../common/Logo';

const CHANNELS = [
  {
    id: 'momo',
    label: 'MTN MoMo',
    short: 'MTN',
    badge: 'MoMo',
    badgeClass: 'bg-[#FFCC00] text-slate-900',
    activeClass: 'border-brand-700 bg-brand-50 ring-1 ring-brand-700/20',
  },
  {
    id: 'telecel',
    label: 'Telecel Cash',
    short: 'TC',
    badge: 'TC',
    badgeClass: 'bg-[#E4002B] text-white',
    activeClass: 'border-[#E4002B] bg-red-50 ring-1 ring-[#E4002B]/20',
  },
  {
    id: 'atmoney',
    label: 'AT Money',
    short: 'AT',
    badge: 'AT',
    badgeClass: 'bg-[#00539F] text-white',
    activeClass: 'border-[#00539F] bg-blue-50 ring-1 ring-[#00539F]/20',
  },
];

const STUDENT_AVATAR =
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=160&auto=format&fit=crop&q=80';

const PhoneMockup = ({ onPaid, paid }) => {
  const [channel, setChannel] = useState('momo');
  const active = CHANNELS.find((item) => item.id === channel);

  return (
    <div className="relative mx-auto w-full max-w-[330px] rounded-[2.75rem] border-[10px] border-slate-900 bg-slate-900 shadow-phone sm:max-w-[348px]">
      <div className="relative">
        <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />

        <div className="flex min-h-[600px] flex-col justify-between overflow-hidden rounded-[2.1rem] bg-slate-50 px-4 pb-5 pt-9">
          {/* Screen header */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogoMark className="h-8 w-8" />
                <span className="text-sm font-extrabold tracking-tight text-ink">SukuuPay</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">
                <Lock className="h-2.5 w-2.5" /> Encrypted
              </span>
            </div>

            {/* Student card */}
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-soft">
              <img
                src={STUDENT_AVATAR}
                alt="Kwame Mensah"
                className="h-12 w-12 rounded-xl border border-slate-100 object-cover"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">Kwame Mensah</p>
                <p className="text-[11px] font-medium text-slate-500">JHS 2A • ID #SK-4902</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-brand-700">
                  Heritage Academy, Tema
                </p>
              </div>
            </div>

            {/* Balance card */}
            <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Term 2 Fee Balance</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Due in 5 days
                </span>
              </div>
              <p className="text-2xl font-extrabold tracking-tight text-ink">GH₵ 550.00</p>

              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Tuition &amp; Library</span>
                  <span className="font-bold text-ink">GH₵ 400.00</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>ICT &amp; Science Lab</span>
                  <span className="font-bold text-ink">GH₵ 150.00</span>
                </div>
              </div>
            </div>

            {/* Channels */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Payment Channel
                </span>
                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">
                  Zero fees
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment channel">
                {CHANNELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={channel === item.id}
                    onClick={() => setChannel(item.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all ${
                      channel === item.id
                        ? item.activeClass
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${item.badgeClass}`}
                    >
                      {item.short}
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-700">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pay CTA */}
          <div className="pt-4">
            <button
              type="button"
              onClick={() => onPaid(active)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-extrabold text-white shadow-lift transition-all active:scale-[0.98] ${
                paid ? 'bg-brand-600' : 'bg-brand-700 hover:bg-brand-800'
              }`}
            >
              {paid ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {paid ? 'Payment Prompt Sent' : 'Pay GH₵ 550.00 Now'}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] font-medium text-slate-400">
              <ShieldCheck className="h-3 w-3" />
              Instant {active.label} prompt sent to the parent&apos;s phone
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneMockup;
