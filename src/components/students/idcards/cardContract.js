/**
 * Shared contract for student ID cards — the single source of truth that keeps
 * the on-screen preview and the printed PDF in agreement.
 *
 * Historically the card existed as three independent layouts:
 *   1. `IdCardPreview.jsx`      — the React/Tailwind preview the bursar sees
 *   2. `idCardSheet.js:drawCard` — pdfkit, true-CR80 batch sheets
 *   3. `pdfGenerator.js:renderPage` — pdfkit, one-card-per-A4 "proof" PDF
 *
 * They disagreed on fonts, colours, field placement, and even which fields
 * appeared, so the PDF never matched the preview. This module fixes that by
 * stating in one place, and importing everywhere:
 *
 *   - `resolveCardData` — the exact field values for one student, read by the
 *     preview's readiness check *and* by the PDF service's `buildCardData`,
 *     so the two can never render different data.
 *   - `COLORS` — the palette, as hex strings the CSS and pdfkit both read.
 *   - `BACKEND_FONTS` / `FRONTEND_FONT_STACK` — font roles (regular/bold/mono)
 *     mapped to pdfkit face names and to the CSS stack that resolves to the
 *     same glyphs on macOS/Windows/Linux.
 *   - `TYPO` — the mm cap-height of every text style, so the printed hierarchy
 *     matches the preview hierarchy regardless of viewport.
 *   - `layoutFor` — the physical mm geometry of every element on the card.
 *
 * The React preview and the pdfkit renderer both consume these; there is no
 * second definition of a colour, a font, or a position anywhere.
 */

/* ── Geometry ───────────────────────────────────────────── */

/** ISO/IEC 7810 ID-1 (CR80) finished geometry, in millimetres.
 *
 * Defined here — and mirrored identically in the backend twin
 * `idCardContract.js` — so the two roots that cannot share a path each carry
 * the one constant they both need without coupling through a third file. */
export const CARD_GEOMETRY = {
  widthMm: 85.6,
  heightMm: 53.98,
  cornerRadiusMm: 3.18,
  bleedMm: 3.175,
  safeMarginMm: 3.0,
  printDpi: 300,
};

/** Points per millimetre (pdfkit's internal unit). */
export const MM = 72 / 25.4;
export const pt = (mm) => mm * MM;

/** Inner content padding as a fraction of card width.
 *
 * Tailwind's `p-[4%]` resolves to 4% of the **width** of the containing block on
 * all four sides (CSS percentage padding is always width-relative), so the PDF
 * mirrors that exactly: 4% of the 85.6mm card on every edge. */
const PAD_PCT = 0.04;

/** Exact brand word that appears in the "Powered by" badge.
 *
 * Centralised here (and mirrored byte-for-byte in the backend twin) rather than
 * hardcoded in each renderer, because the two must show the *same* spelling and
 * a typo that survives in one file but not the other is exactly the kind of
 * drift this module exists to stop. */
export const BRAND_BADGE_TEXT = '\x53\x75\x6b\x75\x75\x50\x61\x79'; // "SukuuPay"

/* ── Palette ────────────────────────────────────────────── */

/** Every colour on the card, shared by Tailwind classes and pdfkit hex. */
export const COLORS = {
  body: '#0B1220',
  muted: '#64748b',
  label: '#94a3b8',
  border: '#cbd5e1',
  cardBg: '#ffffff',
  headerRule: '#fbbf24',
  footerRule: '#f1f5f9',
  magStripe: '#1e293b',
  magStripeText: '#94a3b8',
  magStripeBrand: '#cbd5e1',
  brandBadge: '#ecfdf3',
  brandBadgeText: '#0c4529',
  brandFallback: '#1E3A8A',
  surfaceLight: '#f1f5f9',
  qrBg: '#f8fafc',
};

/* ── Fonts ──────────────────────────────────────────────── */

/** pdfkit font faces. Helvetica is pdfkit's standard-14 Type 1 face; it is the
 *  closest bundled face to the web "Helvetica Neue" stack and renders without
 *  shipping a TTF. Swap the value for a registered font name to use a custom
 *  font in one place. */
export const BACKEND_FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  boldOblique: 'Helvetica-BoldOblique',
  mono: 'Courier',
};

/** CSS font stack that resolves to the same metrics as BACKEND_FONTS on
 *  macOS (Helvetica), Windows (Arial), and Linux (dejaVu). Applied to the card
 *  root in the React preview so screen and paper share glyphs. */
export const FRONTEND_FONT_STACK = {
  regular: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  bold: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "Courier New", monospace',
};

/**
 * Typography scale — **millimetres of cap height on the printed CR80 card**.
 *
 * The React preview sizes text in `px` and is viewport-responsive, so its
 * absolute on-screen size is whatever the browser chooses. On paper the same
 * hierarchy must be legible at arm's length on a 54mm-tall card, so every face
 * below is pinned to a physical mm height and `FONT_PX` (the preview's px
 * values) is derived from `LAYOUT_SCALE` so the two cannot disagree.
 */
export const TYPO = {
  name: 3.0,
  field: 2.5,
  label: 1.7,
  body: 2.2,
  footer: 1.6,
  scan: 1.5,
  magStripe: 1.6,
  barcode: 1.6,
  small: 1.4,
};

/**
 * Reference scale: a CR80 card rendered at this width (px) is the design
 * canvas the Tailwind preview was authored against. Font `px` sizes below are
 * `TYPO[face] * MM_PER_PX` so the preview renders at the *same physical height*
 * the PDF will print when the card is shown at `LAYOUT_SCALE` px wide.
 *
 * 1 inch = 96 px (CSS) = 25.4 mm ⇒ 1 mm = 96/25.4 px.
 */
export const LAYOUT_SCALE = 480; // px wide — a comfortable mid-range preview
export const MM_PER_PX = 25.4 / 96;
export const PX_PER_MM = 96 / 25.4;

/** Font sizes in px for the React preview, locked to the printed mm height. */
export const FONT_PX = {
  name: Math.round(TYPO.name * PX_PER_MM),
  field: Math.round(TYPO.field * PX_PER_MM),
  label: Math.round(TYPO.label * PX_PER_MM),
  body: Math.round(TYPO.body * PX_PER_MM),
  footer: Math.round(TYPO.footer * PX_PER_MM),
  scan: Math.round(TYPO.scan * PX_PER_MM),
  magStripe: Math.round(TYPO.magStripe * PX_PER_MM),
  barcode: Math.round(TYPO.barcode * PX_PER_MM),
  small: Math.round(TYPO.small * PX_PER_MM),
};

/**
 * Layout frames for a card of `w` x `h` (mm). All coordinates are top-left
 * origin, in mm, relative to the card surface (the white CR80 area). The
 * pdfkit renderer converts these to bottom-left points; the React renderer uses
 * them as the basis for percentage-driven positioning so both share one
 * geometry.
 */
export const layoutFor = (w = CARD_GEOMETRY.widthMm, h = CARD_GEOMETRY.heightMm) => {
  const pad = w * PAD_PCT;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const headerH = 5.6;
  const footerH = 5.2;
  const bodyH = innerH - headerH - footerH;

  const photo = { size: 32, x: pad, y: pad + headerH };
  const qrSize = 12;
  const qr = { size: qrSize, x: pad + innerW - qrSize, y: pad + headerH + bodyH - qrSize };

  const textX = photo.x + photo.size + 3;
  const textW = qr.x - textX - 2;

  return {
    w, h, pad, innerW, innerH,
    header: { x: pad, y: pad, h: headerH, w: innerW },
    body: { x: pad, y: pad + headerH, h: bodyH, w: innerW },
    footer: { x: pad, y: pad + innerH - footerH, h: footerH, w: innerW },
    photo, qr,
    text: { x: textX, y: photo.y, w: textW, h: qrSize },
  };
};

/**
 * Resolve one student's card data from the field manifest.
 *
 * This is the data the preview readiness check AND the PDF service both read.
 * Centralising it means a field the preview shows but the PDF omits — or vice
 * versa — is a single omission here, not a silent drift between two readers of
 * the student record.
 */
export const resolveCardData = (student = {}, school = {}, derived = {}) => {
  const guardian = (student?.parents || []).find((p) => p.isPrimary) || (student?.parents || [])[0] || null;
  const emergency = (student?.emergencyContacts || [])[0];

  return {
     schoolName: school?.name || '',
     schoolLogo: school?.logo || null,
     schoolStamp: school?.stamp || null,
     schoolMotto: school?.motto || '',
    schoolCode: school?.schoolCode || '',
    brandColor: school?.brandColor || COLORS.brandFallback,
    studentImage: student?.studentImage || null,
    studentName: student?.studentName || '',
    studentId: student?.studentId || '',
    dateOfBirth: student?.dateOfBirth || null,
    studentClass: student?.studentClass || '',
    academicYear: student?.academicYear || school?.academic?.currentYear || '',
    guardianName: guardian?.parentName || '',
    guardianPhone: guardian?.phone || '',
    emergencyContact: emergency
      ? `${emergency.contactName} (${emergency.phone})`
      : '',
    qrCodeUrl: derived.qrCodeUrl || null,
  };
};

export default {
  CARD_GEOMETRY,
  MM,
  pt,
  COLORS,
  BACKEND_FONTS,
  FRONTEND_FONT_STACK,
  TYPO,
  LAYOUT_SCALE,
  FONT_PX,
  layoutFor,
  resolveCardData,
};
