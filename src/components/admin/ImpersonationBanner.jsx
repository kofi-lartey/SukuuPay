import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, LoaderCircle, LogOut, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useImpersonation } from '../../hooks/useImpersonation';
import { impersonationScope } from '../../utils/impersonationScope';

/**
 * The banner that says, at all times, that you are looking at somebody else's school.
 *
 * **This is not a notification. It is a mode indicator, and it is the only thing
 * standing between a support session and an accident.** Every other control in the
 * console assumes the person reading the screen is the platform owner; this one
 * tells them, permanently and unmissably, that for the last few minutes they have
 * not been. A platform admin looking at a school's student list should never have
 * to wonder whether they are about to operate on production data belonging to a
 * customer.
 *
 * The design decisions follow from that:
 *
 *   - **Sticky, directly under the header, full width.** Not a toast (it would
 *     disappear), not a modal (it would obstruct the work it is describing), not a
 *     sidebar tint (it would be off-screen at the moment it mattered). It occupies
 *     the one strip of the layout that is always visible.
 *
 *   - **Amber, not red and not brand-green.** Red is reserved for destructive
 *     confirmations elsewhere in the console; a persistent red bar would train the
 *     operator to ignore it, and then it would be ignored at the moment it mattered.
 *     Green is the product's own accent and would say the opposite of what is true.
 *
 *   - **The school's name is the largest thing in it.** "You are viewing as …" is a
 *     status; the school's name is the fact. An operator glancing up for half a
 *     second needs to read the school, not the grammar.
 *
 *   - **The reason is shown.** The operator wrote it, but they wrote it minutes ago
 *     and it is the reason this session is being looked at by anyone later. Showing
 *     it keeps the banner honest about what it is.
 *
 * Rendered in `AdminLayout`, above the content and below the header — one instance
 * for the whole console, not one per page. A banner that re-mounted on navigation
 * would flash, and a flashing indicator is read as decoration.
 */

/**
 * Where the operator is, relative to the school they are impersonating.
 *
 * **This two-state read replaced a route block, and the reasoning is worth keeping
 * because the instinct that produced the block was reasonable.**
 *
 * The console used to refuse platform-wide navigation during a support session, and
 * `AdminSidebar` hid the matching rail entries. Both were wrong, for one reason: the
 * server deliberately *serves* those reads and records each one against
 * `ImpersonationSession.actionsCount`. A client-side restriction was therefore never
 * a security boundary — it contradicted the layer that actually decides, and the
 * boundary existed in only one of the two places it needed to.
 *
 * It also cost real friction. Ending and restarting a session burns one of ten
 * hourly impersonation starts, so somebody checking a number mid-support-call paid
 * for it. And the risk it guarded against is small, because the platform pages
 * label themselves: `/admin/finance` is titled "Platform revenue", `/admin/payments`
 * says "All payments". Neither reads as one school's data.
 *
 * So navigation is allowed and the banner says what is true — see
 * `utils/impersonationScope.js` for the three-way classification and the reasoning
 * behind it.
 */
const ImpersonationBanner = () => {
  const { isImpersonating, session, ending, end, exitTo } = useImpersonation();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const schoolName = session?.schoolName || 'this school';
  const scope = impersonationScope(session?.schoolId, location.pathname);
  const onSchoolPage = scope === 'school';

  /*
   * The other school's name, taken from the route rather than fetched.
   *
   * The header is rendered before this component's siblings, and the point is to name
   * *whose* records are on screen, so it cannot wait on a request for the name. The id
   * in the URL plus "another school" already tells the operator the two are different,
   * which is the fact that matters — and the page's own header will name the school in
   * full a moment later.
   */
  const otherSchoolLabel = 'Another school';

  /*
   * Both variants of the second line, chosen here rather than in the JSX.
   *
   * On the school's own pages the reason on file is the most useful thing to repeat
   * — it is why this session exists at all. Anywhere else the reason is noise, and
   * what matters is that what is on screen is not this school's records, so that
   * sentence replaces it.
   *
   * Either way the reads are recorded, because that is true in every state and is the
   * fact an operator is least likely to assume.
   *
   * Computed before the return so the JSX below is a flat, unconditional tree: three
   * near-identical branches of inline markup differing only in an icon and a phrase is
   * the shape in which they drift apart on the next edit.
   */
  const Heading = onSchoolPage ? Eye : TriangleAlert;

  const headingText = {
    school: 'Viewing as',
    other: otherSchoolLabel,
    platform: 'Platform data',
  }[scope];

  const secondaryText = {
    school: session?.reason || '',
    other: `You are acting as ${schoolName}, but this is a different school's records. You cannot change anything, and this read is recorded on the support session.`,
    platform: `This page is platform-wide, not ${schoolName}'s. You are still acting as ${schoolName}, cannot change anything, and every read here is recorded on the support session.`,
  }[scope];

  const leaveImpersonation = async () => {
    await end();
    // Only navigate when ending actually succeeded. A failure signs the operator out
    // server-side and they are already on their way to `/login`; pushing them to the
    // platform overview first would flash a screen whose every request is about to
    // 401.
    if (!ending) navigate(exitTo, { replace: true });
  };

  return (
    // `role="status"` with `aria-live="assertive"`, not a plain div. The banner
    // appearing is the single most important state change in the console and it
    // happens on a route change, deep in a history navigation, with no focus
    // movement — a screen-reader user would otherwise have no way to know they had
    // stopped being the platform owner.
    //
    // `assertive` is also why both states share one live region: switching pages
    // changes the *wording*, and a screen reader should read the new wording rather
    // than only reading it if focus happens to move.
    <div
      role="status"
      aria-live="assertive"
      className="sticky top-16 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-600/30 bg-amber-400 px-4 py-2 text-slate-950 shadow-sm sm:px-6"
    >
      <span className="flex items-center gap-2">
        <Heading className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-[13px] font-extrabold uppercase tracking-wide">
          {headingText}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold leading-tight">
          {schoolName}
          {session?.schoolCode && (
            <span className="ml-2 font-bold text-slate-900/60">{session.schoolCode}</span>
          )}
        </span>

        {secondaryText ? (
          <span className="mt-0.5 flex items-start gap-1.5 text-[12px] font-semibold leading-snug text-slate-900/75">
            {onSchoolPage && <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
            <span className={onSchoolPage ? 'min-w-0 truncate' : 'min-w-0'} title={secondaryText}>
              {secondaryText}
            </span>
          </span>
        ) : null}
      </span>

      {/* Read-only, stated where the operator's eye already is. The server refuses
          every write with `403 IMPERSONATION_READ_ONLY` regardless
          (`Backend/src/middleware/impersonation.js`), so this text is not
          enforcement — it is the difference between an operator thinking the platform
          is broken and one who knows they are in a mode. The prohibition belongs in
          the banner; the refusal belongs in the API. */}
      <span className="hidden text-[12px] font-bold text-slate-900/70 md:inline">
        Read-only
      </span>

      <button
        type="button"
        onClick={leaveImpersonation}
        disabled={ending}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-[12px] font-extrabold text-amber-300 transition-colors hover:bg-slate-900 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/40"
      >
        {ending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {ending ? 'Ending…' : 'Exit impersonation'}
      </button>
    </div>
  );
};

export default ImpersonationBanner;
