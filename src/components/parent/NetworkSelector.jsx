import { MOMO_NETWORKS } from '../../services/parentPay';

/**
 * The three mobile money networks, as cards.
 *
 * ## Why the operator's own colours
 *
 * MTN's yellow, Telecel's red and AirtelTigo's green are what is on the card in the
 * parent's wallet and on the app icon on their home screen. Rendering neutral grey
 * cards and asking someone to read "Telecel Cash" off a 13px label is a reading
 * task; handing them a red square is recognition. Parent pay portals are used by
 * people who have never opened a checkout on a computer, and the colour is the
 * fastest signal available.
 *
 * ## Why each brand colour is paired with a darkened one
 *
 * MTN's `#FFCC00` on white is roughly 1.7:1 — unreadable, and the label text cannot
 * simply be black-and-hope. So each network carries `brandColor` for the block and
 * `accent`, a darkened variant, for anything that has to be read *against* it. The
 * pair is declared next to each other rather than derived at render time, because a
 * contrast ratio computed from an arbitrary colour is a decision nobody reviews and
 * every future edit to that colour silently reopens.
 *
 * ## Why `radiogroup`
 *
 * These are a single choice of three, so it is a radio group. Announcing them as
 * buttons would tell a screen-reader user they are independent actions, and that one
 * network is selected is exactly the state they cannot otherwise perceive.
 */
const NetworkSelector = ({ value, onChange, detected, disabled = false }) => (
  <fieldset disabled={disabled}>
    <legend className="sr-only">Choose your mobile money network</legend>

    <div role="radiogroup" aria-label="Mobile money network" className="grid gap-2.5">
      {MOMO_NETWORKS.map((network) => {
        const selected = value === network.id;
        // "Recommended" is shown only when the number has already been typed and its
        // prefix matched. Announcing a recommendation for a network the parent has
        // not told us anything about would be a guess presented as a fact.
        const recommended = Boolean(detected && detected.id === network.id);

        return (
          <label
            key={network.id}
            className={`relative flex min-h-[68px] cursor-pointer items-center gap-3.5 rounded-xl border-2 bg-white p-3 transition-colors ${
              selected
                ? 'border-[#0A5C36] bg-emerald-50/40'
                : 'border-slate-200 hover:border-slate-300'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {/* The native input, visually hidden but focusable, so keyboard and
                screen-reader behaviour is the browser's rather than a div's. */}
            <input
              type="radio"
              name="momoNetwork"
              value={network.id}
              checked={selected}
              onChange={() => onChange?.(network.id)}
              className="peer sr-only"
            />

            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[13px] font-extrabold text-white"
              style={{ backgroundColor: network.brandColor }}
            >
              {network.short.slice(0, 3).toUpperCase()}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-bold text-slate-900">{network.label}</span>
                {recommended ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                    Your number
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[12px] text-slate-500">{network.tagline}</span>
            </span>

            {/* The tick sits inside the focus ring's reach rather than replacing the
                radio, so the selected state is visible *and* the control is still a
                radio for anyone not looking at colour. */}
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 ${
                selected ? 'border-[#0A5C36] bg-[#0A5C36]' : 'border-slate-300 bg-white'
              }`}
            >
              {selected ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export default NetworkSelector;