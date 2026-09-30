import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCount } from '../../utils/format';

const PER_PAGE_OPTIONS = [8, 20, 50, 100];

/**
 * Pagination for a server-paged list.
 *
 * The window of page numbers is a moving band around the current page rather
 * than every page. A school with 1,000 students has 125 pages at the default
 * size, and rendering all 125 buttons is a row of noise wider than the table it
 * sits under. The first and last page stay reachable, because "jump to the end"
 * is a real intent.
 */
const pageWindow = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const window = new Set([1, totalPages, page, page - 1, page + 1]);
  const pages = [...window].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return pages;
};

const Pagination = ({ meta = {}, onPageChange, onPerPageChange, itemLabel = 'students' }) => {
  const { page = 1, perPage = 20, total = 0, totalPages = 0 } = meta;

  if (!total) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  const pages = pageWindow(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] font-semibold text-slate-500">
        Showing <span className="font-extrabold text-ink">{formatCount(first)}</span>–
        <span className="font-extrabold text-ink">{formatCount(last)}</span> of{' '}
        <span className="font-extrabold text-ink">{formatCount(total)}</span> {itemLabel}
        <span className="mx-2 text-slate-300" aria-hidden="true">
          •
        </span>
        <label htmlFor="roster-per-page" className="whitespace-nowrap">
          Rows per page:
        </label>{' '}
        <select
          id="roster-per-page"
          value={perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
          className="rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-[12px] font-extrabold text-ink focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </PageButton>

        {pages.map((p, index) => {
          const previous = pages[index - 1];
          const gap = previous !== undefined && p - previous > 1;
          return (
            <React.Fragment key={p}>
              {gap && <span className="px-1 text-slate-300">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={`h-9 min-w-9 rounded-lg px-2.5 text-[13px] font-extrabold transition-colors ${
                  p === page
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                {p}
              </button>
            </React.Fragment>
          );
        })}

        <PageButton onClick={() => onPageChange(page + 1)} disabled={!canNext} label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PageButton>
      </nav>
    </div>
  );
};

const PageButton = ({ children, disabled, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[13px] font-extrabold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
  >
    {children}
  </button>
);

export default Pagination;
