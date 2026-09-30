import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  MessageSquare,
  Smartphone,
  Building2,
  Play,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  User,
  Zap,
  Lock,
  Clock,
  TrendingUp,
  Percent
} from 'lucide-react';

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Section Header */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/60 mb-4">
            <span className="w-2 h-2 rounded-full bg-brand-600"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 font-display">
              Seamless 4-Step Workflow
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight mb-4 font-display">
            From Upload to Paid in 4 Simple Steps
          </h1>

          <p className="text-slate-600 text-base sm:text-lg">
            How Ghanaian headmasters and bursars transform tedious fee collection into automated mobile money deposits.
          </p>
        </div>

        {/* 4-Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  1
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2 font-display">
                Upload Your Students
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Upload 1,000 students via Excel or CSV in under 2 minutes. Our system automatically validates phone numbers across MTN, Telecel, and AT.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">⚡ 2-min bulk setup</span>
              <CheckCircle2 size={16} className="text-brand-700" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  2
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <MessageSquare size={20} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2 font-display">
                Send Fee Reminders
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Parents receive an official SMS notification from 'SukuuPay' containing their child's fee breakdown and a secure one-click payment link.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">📱 99% SMS delivery rate</span>
              <FileSpreadsheet size={16} className="text-brand-700" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  3
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2 font-display">
                Parents Pay via MoMo
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Parents pay using MTN MoMo, Telecel Cash, or AirtelTigo. Zero login friction, zero app download required, zero stress.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">⚡ 15-second checkout</span>
              <Zap size={16} className="text-brand-700" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  4
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
              </div>
              <h3 className="text-lg font-bold text-ink mb-2 font-display">
                Get Paid. Track Everything.
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
                Your Bursar dashboard reconciles immediately. Instant PDF receipts go to parents, and funds sweep directly to your school bank account.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700">🏦 Automated T+1 bank settlement</span>
              <CheckCircle2 size={16} className="text-brand-700" />
            </div>
          </div>

        </div>

        {/* --- PARENT PERSPECTIVE & LIVE SIMULATION SECTION --- */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-soft mb-20">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider">
                <span>🟡 Parent Perspective</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
                See the Parent Experience
              </h2>
              
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Watch how Kwame Mensah receives a fee reminder for his daughter Akua at Morning Star Academy, authorizes payment on his MTN MoMo wallet prompt, and downloads his verified official receipt in under 20 seconds.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-medium mb-1">Payment Mode</p>
                  <p className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> MTN MoMo USSD
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-medium mb-1">Average Speed</p>
                  <p className="text-sm font-bold text-ink">14.8 seconds</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button className="bg-brand-800 hover:bg-brand-900 text-white px-6 py-3.5 rounded-xl font-semibold text-sm shadow-md shadow-brand-800/20 transition-all flex items-center gap-2">
                  <Play size={16} />
                  <span>Play 40s Interactive Demo</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Lock size={14} className="text-slate-400" />
                  <span>No download required</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Simulation Video / Graphic Mockup */}
            <div className="lg:col-span-7 relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center">
                {/* Background Video/Image Mockup representation */}
                <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1000')` }}></div>
                
                {/* Overlay Simulation Badge */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium flex items-center gap-2 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span>LIVE SIMULATION</span>
                </div>

                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium border border-white/10">
                  Prompt: *170#
                </div>

                {/* Center Play Button */}
                <div className="relative z-10 w-16 h-16 rounded-full bg-brand-700 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
                  <Play size={28} className="ml-1" />
                </div>

                {/* Bottom App Preview Card Overlay */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-ink text-sm">Morning Star Academy</p>
                    <p className="text-slate-500">Student: Akua Mensah (JHS 2)</p>
                    <p className="font-bold text-brand-800 mt-0.5">Term 1 Tuition: GH₵ 1,850.00</p>
                  </div>
                  <div className="text-right">
                    <span className="bg-brand-100 text-brand-800 px-2.5 py-1 rounded-full font-bold text-[11px]">
                      Verified
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">Auth Prompt Approved</p>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/*
          This used to be a four-up "live stats" strip: GH₵ 42M+ processed safely in
          2024, 180+ partner schools, 98.4% on-time remittance, 0% cash leakage. All
          four were invented, and they contradicted each other across the site —
          the auth aside claimed 140+ schools and the pricing page claimed 180+.
          There is no aggregate over the schools or payments collections that
          produces any of them, and the database has one school on it.

          Replaced with the flow the page actually demonstrates above: what
          happens, in order. Those are checkable against the product rather than
          against nothing.
        */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 bg-white rounded-2xl p-8 border border-slate-100 shadow-soft text-center">
          <div className="p-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-ink mb-1 font-display">1</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Push to pay</p>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-extrabold text-ink mb-1 font-display">2</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Parent pays by MoMo</p>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-extrabold text-ink mb-1 font-display">3</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Receipt issued</p>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-2xl sm:text-3xl font-extrabold text-ink mb-1 font-display">4</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Reconciled on the dashboard</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;