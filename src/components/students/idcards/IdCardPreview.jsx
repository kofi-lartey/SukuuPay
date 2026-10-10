import React from 'react';
import { QrCode } from 'lucide-react';
import { CARD_GEOMETRY } from '../../../utils/idCardFields';
import {
  FRONTEND_FONT_STACK,
  FONT_PX,
  resolveCardData,
} from './cardContract';

/**
 * Clean, modern React preview of a CR80 landscape card.
 * Uses a universal dark charcoal & gold theme that matches any school badge.
 */

const CardShell = ({ children, className = '' }) => (
  <div
    className={`relative w-full overflow-hidden rounded-[4%] bg-white shadow-md ring-1 ring-slate-900/10 ${className}`}
    style={{
      aspectRatio: `${CARD_GEOMETRY.widthMm} / ${CARD_GEOMETRY.heightMm}`,
      fontFamily: FRONTEND_FONT_STACK.regular,
      fontSize: `${FONT_PX.body}px`,
    }}
  >
    {children}
  </div>
);

const HeaderPattern = ({ brand }) => (
  <div
    aria-hidden="true"
    className="absolute inset-0 opacity-20"
    style={{
      backgroundImage: `
        linear-gradient(135deg, transparent 40%, ${brand}33 40%, ${brand}33 50%, transparent 50%),
        linear-gradient(135deg, transparent 55%, ${brand}22 55%, ${brand}22 65%, transparent 65%),
        linear-gradient(135deg, transparent 70%, ${brand}11 70%, ${brand}11 80%, transparent 80%)
      `,
      backgroundSize: '20px 20px',
    }}
  />
);

const IdCardFront = ({
  values,
  school,
  showPhoto = true,
  showStamp = true,
}) => {
  const brand = school?.brandColor || '#0F172A';

  const rows = [
    { label: 'Student ID', value: values.studentId || '—', mono: true },
    { label: 'Class / stream', value: values.studentClass || '—', mono: false },
    { label: 'Phone', value: values.guardianPhone || values.studentPhone || '—', mono: true },
    { label: 'Session', value: values.academicYear || '—', mono: false },
  ];

  return (
    <CardShell>
      {/* ── Header Band (28% height) ── */}
      <div
        className="relative flex h-[28%] items-center gap-[3%] overflow-hidden px-[4.5%]"
        style={{ backgroundColor: brand }}
      >
        <HeaderPattern brand={brand} />

        {/* Logo Tile */}
        <div className="relative z-10 flex h-[62%] w-[14%] shrink-0 items-center justify-center rounded bg-white p-[1.5px] shadow-sm ring-1 ring-white/20">
          {school?.logo ? (
            <img src={school.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] font-extrabold text-slate-800">
              {String(school?.name || 'S').charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* School Name & Motto */}
        <div className="relative z-10 min-w-0 flex-1">
          <p className="truncate text-[9px] font-black uppercase tracking-tight text-white">
            {school?.name || 'School Name'}
          </p>
          {school?.motto && (
            <p className="mt-[1.5px] truncate text-[6px] font-medium text-white/75">
              {school.motto}
            </p>
          )}
        </div>
      </div>

      {/* ── Gold Accent Divider ── */}
      <div className="h-[0.7px] w-full" style={{ backgroundColor: '#F2B705' }} aria-hidden="true" />

      {/* ── Body Content Layout ── */}
      <div className="flex h-[69%] items-start justify-between px-[4.5%] pt-[3%]">
        
        {/* Left Column: Details & Signature */}
        <div className="flex h-full w-[52%] flex-col justify-between pb-[2%]">
          <div className="space-y-[4%]">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline gap-[4px]">
                <span className="w-[38%] shrink-0 text-[7px] font-bold text-slate-700">
                  {row.label}
                </span>
                <span className="shrink-0 text-[7px] font-bold text-slate-400">:</span>
                <span
                  className={`min-w-0 flex-1 truncate text-[7.5px] font-extrabold text-slate-900 ${
                    row.mono ? 'font-mono' : ''
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Signature Line — above the footer mark */}
          <div className="w-[75%]">
            <div className="border-t border-slate-300" />
            <p className="mt-[2px] text-[5px] font-semibold uppercase tracking-wider text-slate-400">
              AUTHORIZE SIGNATURE
            </p>
          </div>
        </div>

        {/* Right Column: Photo, Name, and QR Code */}
        <div className="flex w-[40%] flex-col items-center justify-between">
          <div className="flex w-full flex-col items-center">
            {/* Photo Container */}
            <div className="aspect-square w-[52%] overflow-hidden rounded-[1.5mm] bg-slate-100 shadow-sm ring-1 ring-slate-200">
              {showPhoto && values.studentImage ? (
                <img src={values.studentImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-[5.5px] font-bold text-slate-400">
                  PHOTO
                </div>
              )}
            </div>

            {/* Student Name */}
            <p className="mt-[3px] w-full truncate text-center text-[8.5px] font-black text-slate-900">
              {values.studentName || 'Student Name'}
            </p>
          </div>

          {/* QR Code Section */}
          <div className="flex items-center gap-2 self-end pr-1">
            <div className="flex flex-col items-end">
              <span className="text-[5px] font-bold uppercase tracking-wider text-slate-400">SCAN VERIFY</span>
              <span className="font-mono text-[5px] font-semibold text-slate-500">Secure ID</span>
            </div>
            <div className="flex h-[20px] w-[20px] items-center justify-center overflow-hidden rounded bg-white p-[1px] shadow-sm ring-1 ring-slate-200">
              {values.qrCodeUrl ? (
                <img src={values.qrCodeUrl} alt="QR Code" className="h-full w-full object-contain" />
              ) : (
                <QrCode className="h-full w-full text-slate-700" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Optional Watermark Stamp ── */}
      {showStamp && school?.stamp && (
        <img
          src={school.stamp}
          alt=""
          className="pointer-events-none absolute bottom-[10%] left-[42%] w-[12%] object-contain opacity-20"
        />
      )}
    </CardShell>
  );
};

const IdCardBack = ({ values, school }) => {
  const brand = school?.brandColor || '#0F172A';
  const guardianText = values.guardianName
    ? `${values.guardianName}${values.guardianPhone ? ` · ${values.guardianPhone}` : ''}`
    : '—';

  return (
    <CardShell>
      {/* Header band */}
      <div
        className="flex h-[13%] items-center justify-between px-[5%]"
        style={{ backgroundColor: brand }}
      >
        <span className="text-[5.5px] font-bold uppercase tracking-[0.15em] text-white/75">
          Official Credential
        </span>
        {school?.logo ? (
          <img
            src={school.logo}
            alt=""
            className="h-[55%] w-auto object-contain"
          />
        ) : (
          <span className="font-mono text-[6px] font-bold tracking-[0.1em] text-white/90">
            SUKUUPAY
          </span>
        )}
      </div>

      <div className="h-[0.7px] w-full" style={{ backgroundColor: '#F2B705' }} aria-hidden="true" />

      <div className="px-[5%] pt-[3%]">
        <div>
          <p className="text-[5.5px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Institutional Terms & Conditions
          </p>
          <p className="mt-[2px] text-[6px] leading-tight text-slate-500">
            This credential is the exclusive legal property of {school?.name || 'the issuing school'}. 
            It is not transferable. Return promptly if requested. Valid for academic use only.
          </p>
        </div>

        <div className="mt-[4%] flex items-center justify-center gap-[6px]">
          <span className="font-mono text-[6.5px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Student ID
          </span>
          <span className="font-mono text-[9px] font-bold text-slate-900">
            "{values.studentId || '—'}"
          </span>
        </div>

        <div className="mt-[4%] overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-2">
            <div className="flex items-baseline gap-2 border-b border-r border-slate-200 px-2 py-[5px]">
              <span className="shrink-0 text-[5.5px] font-bold uppercase tracking-wider text-slate-400">
                Guardian
              </span>
              <span className="min-w-0 flex-1 truncate text-[6.5px] font-extrabold text-slate-900">
                {guardianText}
              </span>
            </div>
            <div className="flex items-baseline gap-2 border-b border-slate-200 px-2 py-[5px]">
              <span className="shrink-0 text-[5.5px] font-bold uppercase tracking-wider text-slate-400">
                Emergency
              </span>
              <span className="min-w-0 flex-1 truncate text-[6.5px] font-extrabold text-slate-900">
                {values.emergencyContact || '—'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 border-r border-slate-200 px-2 py-[5px]">
              <span className="shrink-0 text-[5.5px] font-bold uppercase tracking-wider text-slate-400">
                Holder
              </span>
              <span className="min-w-0 flex-1 truncate text-[6.5px] font-extrabold text-slate-900">
                {values.studentName || '—'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 px-2 py-[5px]">
              <span className="shrink-0 text-[5.5px] font-bold uppercase tracking-wider text-slate-400">
                Expires
              </span>
              <span className="min-w-0 flex-1 truncate text-[6.5px] font-extrabold text-amber-600">
                Active Session
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-[5%] h-px bg-slate-200" />
        <div className="flex items-center justify-between px-[5%] py-[2.5%]">
          <span className="text-[5.5px] font-bold uppercase tracking-[0.15em] text-slate-400">
            SukuuPay Secure ID
          </span>
          <span className="text-[5.5px] font-bold uppercase tracking-[0.15em] text-slate-400">
            {values.academicYear || ''}
          </span>
        </div>
      </div>
    </CardShell>
  );
};

const IdCardPreview = ({ student, school, showBleed = false }) => {
  const values = resolveCardData(student, school, { qrCodeUrl: student?.qrCodeUrl || null });

  return (
    <div className="space-y-3">
      <div
        className={
          showBleed
            ? 'rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3'
            : ''
        }
      >
        <p className="mb-1.5 text-[11px] font-extrabold text-slate-900">Card front</p>
        <IdCardFront values={values} school={school} />
      </div>

      <div
        className={
          showBleed
            ? 'rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3'
            : ''
        }
      >
        <p className="mb-1.5 text-[11px] font-extrabold text-slate-900">Card back</p>
        <IdCardBack values={values} school={school} />
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-500">
          Preview only. The printed file is the server&rsquo;s PDF — CMYK,
          300&nbsp;DPI, {CARD_GEOMETRY.widthMm}&nbsp;&times;&nbsp;
          {CARD_GEOMETRY.heightMm}&nbsp;mm.
        </p>
      </div>
    </div>
  );
};

export { IdCardFront, IdCardBack };
export default IdCardPreview;