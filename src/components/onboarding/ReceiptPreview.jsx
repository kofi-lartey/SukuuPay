import React from 'react';
import { FileCheck2, MapPin } from 'lucide-react';
import PhonePreview from './PhonePreview';

/**
 * Live preview of what a parent actually receives.
 *
 * Every field on this step exists because it is printed on a receipt, an SMS or a
 * payment page that a parent reads. A form that only states that requirement is a
 * form the user guesses at; watching their own school name and logo appear on the
 * message is what turns "required field" into "this is why".
 *
 * **Real-time by construction.** There is no local state, no copy, no debounce and
 * no effect here — every value is rendered straight from the prop the live form
 * state supplies. A copy would go stale and be the reason a user concluded the
 * preview "doesn't update", so the only synchronisation logic that exists is
 * React's.
 *
 * **Coverage is the other half of that promise.** The receipt itself is short, so
 * the fields that do not fit on an SMS are listed underneath it rather than being
 * quietly omitted: a bursar who changes their Ghana Post GPS address needs to see
 * that something moved. A preview that ignores half the form teaches the opposite
 * lesson from the one it is meant to teach.
 *
 * `aria-hidden` is not decorative politeness. Without it the whole preview
 * re-announces on every keystroke, which makes the form unusable with a screen
 * reader. Everything it shows is already in the form labels.
 */
const ReceiptPreview = ({
  name,
  logoUrl,
  city,
  region,
  address,
  phone,
  email,
  website,
  gpsAddress,
  motto,
  typeLabel,
  yearFounded,
  placeLabel,
  latitude,
  longitude,
}) => {
  const safe = (value) => (typeof value === 'string' ? value.trim() : '');

  const schoolName = safe(name);
  const cityRegion = [safe(city), safe(region)].filter(Boolean).join(', ');
  const contactPhone = safe(phone);
  const hasIdentity = Boolean(schoolName);

  // Parent-visible fields that do not fit on the SMS itself. Empty ones are
  // omitted rather than shown as blanks, so the list reflects what the bursar has
  // actually supplied instead of a wall of placeholders.
  const alsoPrinted = [
    { label: 'Contact email', value: safe(email) },
    { label: 'Ghana Post GPS', value: safe(gpsAddress) },
    { label: 'Address', value: safe(address) },
    { label: 'Website', value: safe(website) },
    { label: 'Motto', value: safe(motto) },
    { label: 'Type', value: safe(typeLabel) },
    { label: 'Founded', value: safe(yearFounded) ? String(yearFounded) : '' },
    { label: 'Map pin', value: safe(placeLabel) },
  ].filter((entry) => entry.value);

  const hasPin = Number.isFinite(latitude) && Number.isFinite(longitude);
  const coordinateText = hasPin ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : '';

  return (
    /**
     * The whole preview, phone frame included, stays on screen at every width.
     *
     * Two things make that work on a phone, where the frame is far taller than the
     * space available:
     *
     * 1. `order-first` moves this element ahead of the form in the single-column
     *    mobile grid. A sticky element can only travel inside its own containing
     *    block, so as the second grid item it had nothing above it to pin against
     *    and ended up stranded below the entire form. As the first item it starts
     *    on screen and pins under the Navbar with the form scrolling beneath it.
     *    `lg:order-none` restores the desktop arrangement — form left, preview
     *    right — where it is sticky in its own 320px column.
     *
     * 2. The frame is sized against the viewport, not at a fixed 520px. It takes
     *    whatever height remains between the 64px Navbar and the bottom action
     *    bar, so the entire phone — bezel, notch, screen — is visible rather than
     *    the top of it. `100dvh` rather than `100vh` because mobile browser chrome
     *    collapses on scroll and the action bar tracks the live viewport.
     *
     * Sticky rather than fixed, so the preview still occupies real space in the
     * document and does not need padding faked around it to stop the first field
     * hiding underneath.
     */
    <aside
      aria-hidden="true"
      className="order-first self-start lg:order-none lg:sticky lg:top-24"
    >
      <div className="mx-auto mb-2 flex w-fit items-center gap-2 lg:mb-3 lg:w-auto lg:justify-start">
        <FileCheck2 className="h-4 w-4 text-brand-700" />
        <h2 className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
          What parents see
        </h2>
      </div>

      <PhonePreview
        label="Example SMS receipt"
        footer="Delivered by SMS"
        // Narrower and shorter on a phone so the whole handset fits above the
        // action bar; the desktop size is unchanged from before.
        className="max-w-[236px] lg:max-w-[300px]"
        // `h-auto` on mobile: the screen grows to whatever the receipt actually
        // occupies, so the whole message is visible with no internal scroller.
        // The `max-h` guard still applies — it only bites on a very short
        // viewport, where it is better to clip than to pin a frame taller than the
        // screen. Desktop keeps its fixed 520px, which has ample room.
        heightClass="h-auto max-h-[calc(100dvh-11rem)] lg:h-[520px] lg:max-h-[calc(100vh-15rem)]"
      >
        {/* No `overflow-y-auto`: the scroller is gone at every width. The frame is
            sized to its content instead, so nothing is ever cut off or hidden
            behind a scroll. */}
        <div className="flex flex-col px-2.5 py-2.5 lg:px-3.5 lg:py-3">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm lg:p-3">
            {/* SMS bubble, not a bank statement: this is the message a parent
                actually receives, close to word for word how it is sent. */}
            <div className="rounded-2xl rounded-tl-sm bg-brand-700 px-3 py-2 text-white lg:px-3.5 lg:py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-100 lg:text-[10px]">
                Payment received
              </p>
              <p className="mt-1 text-[12px] font-extrabold leading-snug line-clamp-2 lg:mt-1.5 lg:text-[13px]">
                {hasIdentity ? schoolName : 'Your school name'}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug text-brand-100 lg:text-[10px]">
                {cityRegion || 'City, Region'}
              </p>
            </div>

            <dl className="mt-2.5 space-y-1 text-[10px] lg:mt-3 lg:space-y-1.5 lg:text-[11px]">
              {[
                ['Received', 'GH₵ 450.00'],
                ['For', 'Ama Serwa (JHS 3)'],
                ['Method', 'MTN MoMo'],
                ['Reference', 'RCPT-2026-0042'],
              ].map(([term, description]) => (
                <div key={term} className="flex items-baseline justify-between gap-2 min-w-0">
                  <dt className="shrink-0 font-semibold text-slate-500">{term}</dt>
                  <dd className="min-w-0 text-right font-bold text-ink break-all">{description}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-2.5 border-t border-dashed border-slate-200 pt-2 text-center text-[8px] font-medium leading-snug text-slate-400 lg:mt-3 lg:text-[9px]">
              Thank you. Your balance has been updated.
            </p>
          </div>

          {/* Logo as a placeholder rather than a broken image: an optional field
              should read as "add this if you have it", not as something broken. */}
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 lg:mt-2.5 lg:px-2.5 lg:py-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed lg:h-7 lg:w-7 ${
                logoUrl ? 'border-brand-200 bg-brand-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-slate-400 lg:text-[9px]">LOGO</span>
              )}
            </span>
            <p className="text-[9px] font-medium leading-snug text-slate-500 lg:text-[10px]">
              {logoUrl ? 'Your logo leads the message.' : 'Add a logo and it leads every receipt.'}
            </p>
          </div>

          {hasPin && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 lg:mt-2.5 lg:px-2.5 lg:py-2">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
              <p className="min-w-0 text-[9px] font-medium leading-snug text-slate-500 lg:text-[10px]">
                {placeLabel || 'Map pin set'}
                <br />
                <span className="font-mono">{coordinateText}</span>
              </p>
            </div>
          )}
        </div>
      </PhonePreview>

      {/* The rest of the form, shown live. A preview that only reflects a third
          of the fields being edited reads as broken.

          On a phone this list is dropped: it would double the height of the
          pinned block and squeeze the form into an unusable strip. The full list
          still renders at `lg` and above, where there is room for it. */}
      {alsoPrinted.length > 0 && (
        <div className="mx-auto mt-3 hidden w-full max-w-[236px] rounded-xl border border-slate-200 bg-white p-3 lg:block lg:max-w-[300px]">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Also on your receipts
          </p>
          <dl className="mt-1.5 space-y-1.5">
            {alsoPrinted.map((entry) => (
              <div key={entry.label} className="flex items-baseline justify-between gap-3 min-w-0">
                <dt className="shrink-0 text-[10px] font-semibold text-slate-500">{entry.label}</dt>
                <dd className="min-w-0 text-right text-[11px] font-bold text-ink break-all">{entry.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <p className="mx-auto mt-2 max-w-[236px] text-center text-[10px] font-medium leading-snug text-slate-400 lg:mt-3 lg:max-w-[300px] lg:text-[11px]">
        {contactPhone
          ? `Reminders go out from ${contactPhone}.`
          : 'Reminders go out from the phone number you add.'}
      </p>
    </aside>
  );
};

export default ReceiptPreview;
