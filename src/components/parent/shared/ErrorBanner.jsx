import { AlertCircle } from 'lucide-react';

/**
 * A failed read, said once and plainly.
 *
 * The retry button is a slot rather than a built-in refetch because the query
 * that failed belongs to the page — this banner only knows how to say so.
 */
const ErrorBanner = ({ message, onRetry }) => (
  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-red-800">
        {message || 'Something went wrong.'}
      </p>
    </div>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-extrabold text-red-700 transition-colors hover:bg-red-50"
      >
        Retry
      </button>
    ) : null}
  </div>
);

export default ErrorBanner;
