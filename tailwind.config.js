/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ECFDF3',
          100: '#D1FADF',
          200: '#A6F4C5',
          300: '#6CE9A6',
          400: '#32D583',
          500: '#12B76A',
          600: '#0A8F52',
          700: '#0F5132',
          800: '#0C4529',
          900: '#0A3722',
        },
        ink: '#0B1220',
        /**
         * Mobile Money networks.
         *
         * Defined once because three surfaces render the same three networks and
         * must agree on them: the transaction table's pill, the Payment Channels
         * stacked bar, and the chart's channel filter. Reading MTN's amber from
         * `amber-500` in one place and `bg-[#F59E0B]` in another is how a
         * network ends up two shades apart between the list and its legend.
         *
         * `DEFAULT` is the mark/dot/segment colour, `soft` the pill background,
         * `ink` the label. Telecel is rose rather than pink: the design calls for
         * a warm red that still reads as a distinct brand beside MTN's amber.
         */
        momo: {
          mtn: { DEFAULT: '#F59E0B', soft: '#FEF3C7', ink: '#B45309' },
          telecel: { DEFAULT: '#F43F5E', soft: '#FFE4E6', ink: '#BE123C' },
          at: { DEFAULT: '#3B82F6', soft: '#DBEAFE', ink: '#1D4ED8' },
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)',
        lift: '0 12px 32px rgba(15, 81, 50, 0.18)',
        phone: '0 40px 80px -20px rgba(11, 18, 32, 0.45)',
      },
      maxWidth: {
        '8xl': '90rem',
      },
    },
  },
  plugins: [],
}
