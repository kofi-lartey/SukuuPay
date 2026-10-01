import React from 'react';
import { QrCode } from 'lucide-react';
import { cardReadiness, CARD_GEOMETRY } from '../../../utils/idCardFields';

/**
 * One side of a CR80 card, rendered from the field manifest.
 *
 * The manifest decides what is on the card; this decides where. Keeping those
 * separate is the point: adding a field to the card is an edit to the manifest
 * and nothing here, so the readiness check and the printed card can never
 * disagree about what a card contains.
 *
 * **The proportions are the real ones.** CR80 is 85.60 × 53.98 mm, so the aspect
 * ratio is fixed by `aspect-[8560/5398]` rather than picked to suit the layout.
 * A card previewed at a different ratio is a card that will look wrong the
 * moment it is cut, and the error is invisible until 500 of them are printed.
 *
 * This is a *preview*, not the artefact. The file that actually goes to a printer
 * is the server's PDF; this exists so a bursar can see a name before committing
 * a 1,000-card run, and it says so rather than implying fidelity it does not
 * have — the real card is CMYK, 300 DPI and bleed-registered.
 */

const CardSurface = ({ children, className = '', bleed = false }) => (
  <div
    className={`relative w-full overflow-hidden rounded-[6%] bg-white shadow-sm ring-1 ring-slate-900/10 ${
      bleed ? 'p-[3%]' : ''
    } ${className}`}
    style={{ aspectRatio: `${CARD_GEOMETRY.widthMm} / ${CARD_GEOMETRY.heightMm}` }}
  >
    {children}
  </div>
);

const IdCardFront = ({ values, school, showPhoto = true, showQr = true }) => (
  <CardSurface className="flex flex-col p-[4%]">
    {/* Issuing institution */}
    <header className="flex items-start justify-between gap-2 border-b-2 border-amber-400 pb-[3%]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-700 text-[10px] font-extrabold text-white">
          S
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-extrabold uppercase leading-tight text-ink">
            {school?.name || 'School name not set'}
          </span>
          {school?.motto && (
            <span className="block truncate text-[7px] italic text-slate-500">
              {school.motto}
            </span>
          )}
        </span>
      </div>
      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[7px] font-bold text-slate-600">
        {school?.schoolCode || '—'}
      </span>
    </header>

    {/* Identity + academic + contact */}
    <div className="flex flex-1 gap-[4%] pt-[4%]">
      <div className="shrink-0">
        {showPhoto && values.studentImage ? (
          <img
            src={values.studentImage}
            alt=""
            className="h-16 w-16 rounded-md object-cover ring-1 ring-slate-900/10"
          />
        ) : (
          /* An explicit "no photo" block rather than an empty hole. On a
             *printed card a blank rectangle reads as a printing fault; a
             labelled one reads as a missing photograph, which is what it is. */
          <span className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md bg-slate-100 text-[7px] font-bold uppercase text-slate-400 ring-1 ring-slate-900/5">
            No photo
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-[3%]">
        <div>
          <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
            Full student name
          </p>
          <p className="truncate text-[12px] font-extrabold leading-tight text-ink">
            {values.studentName || '—'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-2">
          <div className="min-w-0">
            <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">Student ID</p>
            <p className="truncate font-mono text-[9px] font-bold text-ink">
              {values.studentId || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
              Class / stream
            </p>
            <p className="truncate text-[9px] font-extrabold text-ink">
              {values.studentClass || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
              Academic cycle
            </p>
            <p className="truncate text-[9px] font-extrabold text-ink">
              {values.academicYear || '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
              Date of birth
            </p>
            <p className="truncate text-[9px] font-extrabold text-ink">
              {values.dateOfBirth
                ? new Date(values.dateOfBirth).toLocaleDateString('en-GB')
                : '—'}
            </p>
          </div>
        </div>

        <div className="min-w-0 border-t border-slate-100 pt-[2%]">
          <p className="truncate text-[7px] font-semibold text-slate-500">
            Guardian:{' '}
            <span className="font-extrabold text-slate-700">
              {values.guardianName || '—'}
            </span>
            {values.guardianPhone && ` · ${values.guardianPhone}`}
          </p>
        </div>
      </div>

      {showQr && (
        <div className="shrink-0 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded bg-slate-50 ring-1 ring-slate-900/5">
            <QrCode className="h-8 w-8 text-slate-700" aria-hidden="true" />
          </span>
          <span className="mt-0.5 block text-[5px] font-bold uppercase tracking-wide text-slate-400">
            Scan to pay
          </span>
        </div>
      )}
    </div>

    <footer className="flex items-center justify-between border-t border-slate-100 pt-[2%]">
      <span className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
        GES compliant student card
      </span>
      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[6px] font-extrabold text-brand-800">
        Powered by SukuuPay
      </span>
    </footer>
  </CardSurface>
);

const IdCardBack = ({ values, school }) => (
  <CardSurface className="flex flex-col p-[4%]">
    {/* The magnetic stripe spans the full width, which is why it is its own
        band rather than a panel inside the padding. */}
    <div className="-mx-[4%] -mt-[4%] flex items-center justify-between bg-slate-800 px-[4%] py-[3%]">
      <span className="text-[6px] font-bold uppercase tracking-wider text-slate-400">
        Track 1 encrypted
      </span>
      <span className="font-mono text-[7px] font-bold text-slate-200">
        SUKUUPAY
      </span>
    </div>

    <div className="mt-[4%] space-y-[3%]">
      <div>
        <p className="text-[6px] font-bold uppercase tracking-wide text-slate-400">
          Institutional terms &amp; conditions
        </p>
        <p className="line-clamp-3 text-[6px] leading-tight text-slate-500">
          This credential is the exclusive legal property of{' '}
          {school?.name || 'the issuing school'}. It is not transferable.
          Return it promptly if so requested. Authorised for classroom
          identification only.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex h-10 flex-1 items-end gap-px bg-white px-1.5 pb-1 pt-1 ring-1 ring-slate-900/10">
          {/* A barcode is bars, not text: a fake one built from characters
              renders as letters and is not scannable. */}
          {(values.studentId || '000000').split('').map((char, index) => (
            <span
              key={index}
              className="h-full bg-slate-900"
              style={{
                width: `${((char.charCodeAt(0) % 3) + 1) * 0.7}px`,
                opacity: (char.charCodeAt(0) % 5) / 7 + 0.45,
              }}
            />
          ))}
        </div>
        <p className="shrink-0 font-mono text-[6px] font-bold text-slate-600">
          “{values.studentId || '—'}”
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[6px]">
        <div>
          <dt className="font-bold uppercase text-slate-400">Guardian</dt>
          <dd className="truncate font-extrabold text-slate-700">
            {values.guardianName || '—'}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Emergency</dt>
          <dd className="truncate font-extrabold text-slate-700">
            {values.emergencyContact || '—'}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Holder</dt>
          <dd className="truncate font-extrabold text-slate-700">
            {values.studentName || '—'}
          </dd>
        </div>
        <div>
          <dt className="font-bold uppercase text-slate-400">Expires</dt>
          {/* Not "—". The data model has no expiry field, so a real card would
              carry a blank here. Saying so is the honest rendering, and it makes
              the gap visible instead of hiding it behind a dash. */}
          <dd className="truncate font-extrabold text-amber-700">Not tracked</dd>
        </div>
      </dl>
    </div>
  </CardSurface>
);

/**
 * Front and back, plus the readiness panel.
 *
 * `readiness` is computed here rather than passed in so the preview and the
 * check cannot be rendered from two different states of the same record.
 */
const IdCardPreview = ({ student, school, showBleed = false }) => {
  const readiness = cardReadiness(student, school, {
    qrCode: student?.payLink ? 'generated' : null,
    barcode: student?.studentId || null,
    termsText: school?.name || null,
  });

  return (
    <div className="space-y-3">
      <div className={showBleed ? 'rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3' : ''}>
        <p className="mb-1.5 text-[11px] font-extrabold text-ink">Card front</p>
        <IdCardFront values={readiness.values} school={school} />
      </div>

      <div className={showBleed ? 'rounded-xl bg-[repeating-conic-gradient(#e2e8f0_0_25%,#f8fafc_0_50%)] bg-[length:16px_16px] p-3' : ''}>
        <p className="mb-1.5 text-[11px] font-extrabold text-ink">Card back</p>
        <IdCardBack values={readiness.values} school={school} />
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-500">
          Preview only. The printed file is the server&rsquo;s PDF — CMYK,
          300&nbsp;DPI, {(CARD_GEOMETRY.widthMm)}&nbsp;&times;&nbsp;
          {CARD_GEOMETRY.heightMm}&nbsp;mm with{' '}
          {(CARD_GEOMETRY.bleedMm).toFixed(3)}&nbsp;mm bleed.
        </p>
      </div>
    </div>
  );
};

export { IdCardFront, IdCardBack };
export default IdCardPreview;
