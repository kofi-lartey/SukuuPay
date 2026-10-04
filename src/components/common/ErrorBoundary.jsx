import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Contains a render failure to one region of the page.
 *
 * ## Why this exists
 *
 * The Overview is nine independent cards fed by nine independent endpoints, and React
 * has no tolerance for a throw in any one of them: a single `TypeError` in a
 * `transactions.map` unmounted the entire subtree and replaced a working dashboard —
 * KPI band, collections curve, payment channels and all — with a blank screen and a
 * console stack trace. Every other region was fine. That is the worst possible
 * ratio of blast radius to fault, and it is why the browser's own advice is to add an
 * error boundary rather than to be more careful in the component that threw.
 *
 * Being more careful in the component is not a substitute, and this does not pretend
 * to be. `RecentTransactionsCard.initials` was made total *and* wrapped in a boundary,
 * because the first fixes this bug and the second contains the next one, and the next
 * one will be in a card nobody has read yet.
 *
 * ## What it deliberately does not do
 *
 * It does not retry, and it does not hide the error. A card that silently re-renders
 * on a timer would paper over a bad row by showing a different bad row, and a bursar
 * would see figures that change underneath them. The region is replaced with the
 * fault stated, so the shape of the failure is visible.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  /**
   * `getDerivedStateFromError` rather than setting state in `componentDidCatch`.
   *
   * The render pass has already thrown by the time `componentDidCatch` runs, so a
   * state update from there produces a second render that *also* renders the broken
   * children — the boundary does not catch until the next pass, and React logs the
   * original error as an uncaught exception either way.
   */
  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept as the only side effect. Surfacing it here rather than swallowing it is what
    // makes this diagnosable in a deployment: a blank card with a console trace is
    // findable, a silently degraded page is not.
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`,
      error,
      info?.componentStack
    );
  }

  handleReset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    const { children, label, className = '' } = this.props;

    if (!error) return children;

    return (
      <div className={`rounded-2xl border border-red-200 bg-red-50/60 p-5 ${className}`}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700"
          >
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-extrabold text-red-900">
              {label ? `${label} could not be displayed` : 'This section could not be displayed'}
            </h3>

            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-red-800">
              The rest of the page is unaffected and still shows live figures. The error is
              in the browser console.
            </p>

            {/*
              The message is shown, not the stack. A stack in this panel would either be
              truncated into uselessness or dumped raw to a bursar; the console already
              has the `componentStack` from `componentDidCatch`.
            */}
            <p className="mt-2 break-words rounded-lg bg-white/70 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-red-700">
              {String(error?.message || error)}
            </p>

            <button
              type="button"
              onClick={this.handleReset}
              className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-[12px] font-extrabold text-red-800 transition-colors hover:bg-red-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;