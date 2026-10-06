import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, Phone, Mail, Globe, ExternalLink } from 'lucide-react';
import { fetchPublicSchool } from '../../services/publicSchool';

const toWaLink = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
};

const Section = ({ title, children }) => (
  <div className="space-y-2">
    {title && <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{title}</p>}
    {children}
  </div>
);

const Row = ({ icon: Icon, label, value, href }) => {
  if (!value) return null;
  const content = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
    >
      {value}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  ) : (
    <span className="text-sm font-medium text-slate-700">{value}</span>
  );

  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div>
        {label && <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>}
        {content}
      </div>
    </div>
  );
};

const AdDetailModal = ({ schoolId, ad, open, onClose }) => {
  const [school, setSchool] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (!open || !schoolId) return;
    let active = true;
    setLoading(true);
    setSchool(null);
    fetchPublicSchool(schoolId).then((data) => {
      if (active) {
        setSchool(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [open, schoolId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const waLink = school?.phone ? toWaLink(school.phone) : null;

  if (!open) return null;

  const location = [school?.address, school?.city, school?.region].filter(Boolean).join(', ');

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-md transition-colors hover:bg-white hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {ad?.imageUrl && (
          <div className="relative h-56 w-full">
            <img src={ad.imageUrl} alt={ad.imageAlt || ad.headline} className="h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-brand-900/60 via-brand-900/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                {school?.name || ad.schoolName}
              </p>
              <p className="mt-1 text-lg font-extrabold leading-tight text-white">{ad.headline}</p>
            </div>
          </div>
        )}

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            </div>
          ) : school ? (
            <>
              <div className="flex items-center gap-4">
                {school.logo && (
                  <img
                    src={school.logo}
                    alt={`${school.name} logo`}
                    className="h-14 w-14 rounded-xl border border-slate-100 bg-white object-contain p-1"
                  />
                )}
                <div>
                  <h3 className="font-display text-xl font-extrabold text-ink">{school.name}</h3>
                  {school.motto && (
                    <p className="mt-1 text-sm italic text-slate-500">"{school.motto}"</p>
                  )}
                </div>
              </div>

              {location && (
                <Section title="Location">
                  <Row icon={MapPin} value={location} />
                </Section>
              )}

              <div className="grid grid-cols-1 gap-3">
                {school.phone && <Row icon={Phone} label="Phone" value={school.phone} href={`tel:${school.phone}`} />}
                {school.email && <Row icon={Mail} label="Email" value={school.email} href={`mailto:${school.email}`} />}
                {school.website && <Row icon={Globe} label="Website" value={school.website} href={school.website} />}
              </div>

              {ad?.writeup && (
                <Section title="About this ad">
                  <p className="text-sm leading-relaxed text-slate-600">{ad.writeup}</p>
                </Section>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700"
                  >
                    <Phone className="h-4 w-4" />
                    Contact via WhatsApp
                  </a>
                )}
                {ad?.linkUrl && (
                  <a
                    href={ad.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-soft transition-colors hover:border-slate-300 hover:shadow-md"
                  >
                    Visit school website
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-500">School details are not available right now.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AdDetailModal;
