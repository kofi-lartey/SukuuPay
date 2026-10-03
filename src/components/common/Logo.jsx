import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The brand mark, as a file.
 *
 * Served from `public/sukuupay-logo.png` rather than inlined as SVG for two
 * reasons. The artwork is a raster original, so an SVG wrapper would either
 * embed the PNG as a base64 data URI — a 85 KB string in the bundle, re-downloaded
 * on every deploy — or be a hand-trace of a logo, and a traced brand mark is a
 * different logo. And `public/` is the one place that is also reachable from the
 * backend: the email templates cannot import a React component, but they can
 * point an `<img>` at the same file on `CLIENT_URL`.
 *
 * ### The file is cropped, and it has to stay that way
 *
 * The original was a 500×500 canvas holding a 190×190 circle — a 155px transparent
 * margin on all four sides. Rendered with `object-contain`, that is 38% of the box:
 * at `w-12 h-12` the visible mark was a 18px dot. The published file is now the
 * artwork cropped to its bounds, so the mark fills whatever box it is given.
 *
 * **If you replace it, crop it.** A logo re-exported at 1024×1024 with the usual
 * generous canvas will look 2–3x smaller than it did and there will be nothing in
 * the diff to explain why. The measurement is one line: the content bounds must
 * reach the canvas edge, allow a few pixels for the antialiased rim.
 *
 * `alt=""` plus `aria-hidden` because every caller renders the wordmark beside it,
 * so the file is decorative — announcing "SukuuPay logo" immediately before the
 * text "SukuuPay" makes a screen reader say the name twice.
 *
 * `width`/`height` are the file's real dimensions, set so the browser reserves the
 * right space before decoding and the navbar does not reflow on load. Update them
 * if the file is ever re-exported at a different size.
 */
const LogoMark = ({ className = 'w-12 h-12' }) => (
  <img
    src="/sukuupay-logo.png"
    alt=""
    aria-hidden="true"
    width={256}
    height={256}
    decoding="async"
    className={`${className} shrink-0 object-contain`}
  />
);

/**
 * `markClassName` is gone.
 *
 * It used to size the letter "S" inside the placeholder tile (`text-lg`,
 * `text-base`, `text-xl`, `text-xs` at five call sites). An image has no font
 * size, so the prop had nowhere to go and was kept alive only by callers still
 * passing it — a prop that is accepted and ignored is worse than no prop,
 * because the next person raises its font size and watches nothing happen.
 * Remove it from a call site if you see it; size the mark through `className`.
 */
const Logo = ({ className = '', to = '/' }) => (
  <Link to={to} className={`flex items-center gap-2.5 ${className}`} aria-label="SukuuPay home">
    <LogoMark />
    <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
      Sukuu<span className="text-brand-700">Pay</span>
    </span>
  </Link>
);

export default Logo;
export { LogoMark };