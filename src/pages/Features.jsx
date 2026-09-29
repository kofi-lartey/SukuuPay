import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Smartphone,
  Calendar,
  MessageSquare,
  Receipt,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
} from 'lucide-react';

const Features = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Section Header */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/60 mb-4">
            <span className="w-2 h-2 rounded-full bg-brand-600"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 font-display">
              Powerful Fee Infrastructure
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight mb-4 font-display">
            Everything a Ghanaian School Needs to Collect Fees
          </h1>

          <p className="text-slate-600 text-base sm:text-lg">
            From bulk student upload to automatic MoMo receipts — purpose-built for Basic and Senior High Schools across Ghana.
          </p>

          {/* Trust Compliance Sub-badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs sm:text-sm font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-brand-700" />
              <span>BoG & GhIPSS Compliant</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-brand-700" />
              <span>99.98% MoMo Settlement Rate</span>
            </div>
          </div>
        </div>

        {/* Features 6-Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mt-16">
          
          {/* Card 1: Bulk Student Upload */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <FileSpreadsheet size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-brand-50 text-brand-800 rounded-md">
                  Fast Import
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                Bulk Student Upload
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Upload up to 5,000 students at once using Excel or CSV. Automatic telco network validation (MTN, Telecel, AT) and instant ledger generation.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium truncate">
                <FileSpreadsheet size={14} className="text-brand-700 shrink-0" />
                <span className="truncate">0172_JHS_Term1.csv</span>
              </div>
              <span className="bg-brand-100 text-brand-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                Parsed (1,248/1,248)
              </span>
            </div>
          </div>

          {/* Card 2: All Mobile Money Networks */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Smartphone size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md">
                  Zero-Fail USSD
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                All Mobile Money Networks
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Accept MTN MoMo, Telecel Cash, and AirtelTigo Money through a single instant USSD prompt or secure web link.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs font-medium text-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> MTN MoMo</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Telecel</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-600"></span> AT Money</div>
              </div>
              <span className="text-slate-400 text-[11px]">1-Sec Prompt</span>
            </div>
          </div>

          {/* Card 3: Installment Payment Plans */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-brand-50 text-brand-800 rounded-md">
                  Flexible
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                Installment Payment Plans
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Break term fees into flexible 2–6 tranches with automated collection schedules tailored for Ghanaian guardians.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Tranche 2 of 4 Paid</span>
                <span className="font-bold">50% Complete</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-700 h-full w-1/2 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Card 4: Automatic SMS Reminders */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <MessageSquare size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-brand-50 text-brand-800 rounded-md">
                  NCA Certified
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                Automatic SMS Reminders
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                NCA Ghana registered sender ID ('SukuuPay') with automated prompts dispatched 3 days prior to due dates.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-600 truncate flex items-center gap-2">
              <span className="font-bold text-brand-800">SukuuPay:</span> Friendly reminder, GH₵ 650.00 due...
            </div>
          </div>

          {/* Card 5: Instant PDF Receipts */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <Receipt size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-brand-50 text-brand-800 rounded-md">
                  QR Verified
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                Instant PDF Receipts
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Verifiable digital receipts with QR authentication stamps delivered via SMS and email immediately upon payment.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium">
              <span className="font-mono text-[11px] bg-slate-200/70 px-2 py-0.5 rounded">SKP-2025-0982-A</span>
              <span className="flex items-center gap-1 text-brand-800 font-semibold"><Download size={13} /> PDF</span>
            </div>
          </div>

          {/* Card 6: Real-Time Financial Dashboard */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-soft hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center">
                  <BarChart3 size={24} />
                </div>
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 bg-brand-50 text-brand-800 rounded-md">
                  Auto Sweeps
                </span>
              </div>
              <h3 className="text-xl font-bold text-ink mb-2 font-display">
                Real-Time Financial Dashboard
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                Monitor every cedi collected, track grade-level compliance, and automate daily GhIPSS sweeps to your school bank account.
              </p>
            </div>
            
            {/* Mockup Preview Inside Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-medium">Today's Collections</p>
                <p className="text-sm font-bold text-ink">GH₵ 48,250.00</p>
              </div>
              <div className="flex items-end gap-1 h-5">
                <div className="w-1.5 h-3 bg-brand-400 rounded-t"></div>
                <div className="w-1.5 h-4 bg-brand-600 rounded-t"></div>
                <div className="w-1.5 h-5 bg-brand-800 rounded-t"></div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Banner Card */}
        <div className="bg-brand-800 text-white rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl mt-16">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display">
              Zero setup friction — connect your school in under 10 minutes.
            </h2>
            <p className="text-brand-100 text-sm sm:text-base">
              No hardware required. Compatible with all Ghanaian registered banks & rural banks.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <Link to="/docs" className="bg-white hover:bg-brand-50 text-brand-900 font-semibold px-6 py-3 rounded-xl text-sm transition-all shadow-sm">
              Read Documentation
            </Link>
            <a href="#demo" className="bg-brand-700 hover:bg-brand-800 text-white border border-brand-600 font-semibold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2">
              <span>View Live Demo</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;