import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY_ADDRESS, HELPDESK_PHONE, ROUTES } from '../utils/constants';

const TRUST_POINTS = ['No credit card needed', 'Cancel anytime'];

/**
 * Contact page content.
 *
 * This previously carried its own copy of the full directory grid and
 * directives bar. Those now live in the shared `SiteFooter`, so the contact
 * details appear once, identically, on every page instead of being duplicated
 * here and missing from the other eight routes.
 */
const Contact = () => (
  <div className="bg-slate-50/60">
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="relative overflow-hidden rounded-3xl bg-brand-900 p-8 text-center text-white shadow-xl sm:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-brand-700/40 blur-3xl"
        />

        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-600/60 bg-brand-900/60 px-4 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-brand-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-200">
              Pilot batch open
            </span>
          </div>

          <h1 className="mx-auto mb-4 max-w-3xl text-balance font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ready to Collect Every Cedi This Term?
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-sm text-brand-100 sm:text-base">
            Join the first 5 pilot schools in Prampram, Tema and Accra. Set up in 10 minutes with
            free onboarding and zero setup fee.
          </p>

          <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={`mailto:${COMPANY_ADDRESS.email}?subject=SukuuPay%20demo%20request`}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-4 text-sm font-bold text-ink shadow-md transition-all hover:-translate-y-0.5 hover:bg-amber-300"
            >
              <Calendar size={18} />
              <span>Book a Free Demo</span>
            </a>
            {/* Hidden while the WhatsApp line is unconfigured. It used to render
                "+233 24 000 0000" — all eleven digits zeroed — as "Talk to us
                on WhatsApp", on the page whose entire job is to be contactable. */}
            {COMPANY_ADDRESS.whatsappHref && (
              <a
                href={COMPANY_ADDRESS.whatsappHref}
                className="flex items-center gap-2 rounded-xl border border-brand-600 bg-brand-800 px-8 py-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-700"
              >
                <MessageSquare size={18} className="text-brand-300" />
                <span>Talk to us on WhatsApp ({COMPANY_ADDRESS.whatsappDisplay})</span>
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-brand-200 sm:text-sm">
            {TRUST_POINTS.map((point) => (
              <div key={point} className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-brand-400" />
                <span>{point}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-brand-400" />
              <span>Bank of Ghana / GhIPSS compliant</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-8">
            <Link
              to={ROUTES.SIGNUP}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-900 transition-colors hover:bg-brand-50"
            >
              Create school account
            </Link>
            <Link
              to={ROUTES.PRICING}
              className="rounded-xl border border-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      {/* Reach us directly */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: MapPin, label: 'Visit', value: COMPANY_ADDRESS.office, sub: COMPANY_ADDRESS.street },
          // Dropped entirely when the number is unconfigured, rather than
          // rendering an empty card or a `tel:` link to a line that does not
          // exist. See `COMPANY_ADDRESS` in utils/constants.
          HELPDESK_PHONE && {
            icon: Phone,
            label: 'Call',
            value: HELPDESK_PHONE,
            href: `tel:${HELPDESK_PHONE.replace(/\s/g, '')}`,
          },
          {
            icon: Mail,
            label: 'Email',
            value: COMPANY_ADDRESS.email,
            href: `mailto:${COMPANY_ADDRESS.email}`,
          },
        ]
          .filter(Boolean)
          .map(({ icon: Icon, label, value, sub, href }) => {
          const body = (
            <>
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Icon size={13} className="text-brand-700" />
                {label}
              </span>
              <span className="mt-1.5 block text-sm font-bold text-ink">{value}</span>
              {sub && <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>}
            </>
          );

          return href ? (
            <a
              key={label}
              href={href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50/40"
            >
              {body}
            </a>
          ) : (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
            >
              {body}
            </div>
          );
        })}
      </div>
    </section>
  </div>
);

export default Contact;
