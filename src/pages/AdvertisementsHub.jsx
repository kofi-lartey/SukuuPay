import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Filter,
  Loader2,
  Megaphone,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchSchoolAds, trackAdImpression } from '../services/schoolAds';
import AdDetailModal from '../components/common/AdDetailModal';
import EmptyState from '../components/dashboard/EmptyState';

/**
 * The public advertisements hub.
 *
 * A marketing page filled with user-generated content. That shapes every
 * choice: the hero leads with a headline figure rather than a list, the cards
 * are composed so a bursar can judge one in three seconds, and the empty
 * state reads as "you could be here" rather than "nothing to show".
 *
 * ## Additions over the previous version
 *
 * 1. **Infinite scroll.** A page of 60 loads immediately; the next page loads
 *    when the sentinel scrolls into view, with a "Load more" fallback for
 *    browsers without IntersectionObserver (older Safari, some in-app
 *    browsers). The fallback is not dead code — in-app browsers on Android
 *    are common in this market.
 *
 * 2. **Impression tracking.** Each card fires one impression the first time it
 *    enters the viewport, deduped by `_id` in a ref so scrolling back up does
 *    not double-count. This is what makes the "Sponsored" claim honest — the
 *    school's dashboard reflects real views.
 *
 * 3. **Sorting.** Newest / Ending soon / School A–Z. "Ending soon" is the one
 *    that matters for a bursar who wants to know what's about to disappear.
 *
 * 4. **School filter.** A searchable dropdown of unique school names. Useful
 *    when the hub has dozens of ads from a handful of schools.
 */

const PAGE_SIZE = 24;

const PLACEMENTS = [
  { key: 'all', label: 'All placements' },
  { key: 'advertisement_page', label: 'Advertisement page' },
  { key: 'home_hero', label: 'Homepage hero' },
];

const PLACEMENT_LABEL = {
  advertisement_page: 'Advertisement page',
  home_hero: 'Homepage hero',
};

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'ending_soon', label: 'Ending soon' },
  { key: 'school_az', label: 'School A–Z' },
];

const formatDay = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

const daysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const diff = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// IntersectionObserver hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fires `onIntersect` once when the returned ref's element scrolls into view.
 *
 * Uses a 200px root margin so the next page begins loading *before* the user
 * reaches the bottom — a page that loads only at the exact viewport edge shows
 * a spinner on every scroll. Falls back to returning `null` in environments
 * without IntersectionObserver; the caller renders a "Load more" button in that
 * case, which also serves users who prefer to control the load themselves.
 */
const useInViewTrigger = (onIntersect, { disabled } = {}) => {
  const ref = useRef(null);
  const handler = useRef(onIntersect);
  handler.current = onIntersect;

  useEffect(() => {
    if (disabled) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) handler.current?.();
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);

  return ref;
};

// ─────────────────────────────────────────────────────────────────────────────
// Impression tracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fires `onSeen` once per card, when it first enters the viewport.
 *
 * A ref-based dedupe set is what keeps this honest: React's StrictMode mounts
 * the effect twice in development, and scrolling up and back down re-enters the
 * same card. Without dedupe, a card the user viewed once could be counted five
 * times, and the school's impression figure becomes meaningless.
 */
const useImpression = (adId, onSeen) => {
  const ref = useRef(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !fired.current) {
          fired.current = true;
          onSeen?.(adId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [adId, onSeen]);

  return ref;
};

// ─────────────────────────────────────────────────────────────────────────────
// Small UI pieces
// ─────────────────────────────────────────────────────────────────────────────

/** Placement pill with the brand-green background used across the app. */
const PlacementPill = ({ placement }) => (
  <span className="inline-flex items-center rounded-full bg-[#EAF7F0] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#0A5C36]">
    {PLACEMENT_LABEL[placement] || 'Advertisement'}
  </span>
);

/** Dropdown used for both sort and school filter. */
const Dropdown = ({ label, value, options, onChange, icon: Icon }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => o.key === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:border-slate-300"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />}
        <span className="hidden sm:inline">{label}:</span>
        <span className="text-ink">{selected?.label || 'All'}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 max-h-72 min-w-[180px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map((opt) => {
            const isSelected = opt.key === value;
            return (
              <li key={opt.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[#EAF7F0] text-[#0A5C36]'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AdCard
// ─────────────────────────────────────────────────────────────────────────────

const AdCard = ({ ad, onOpen, onImpression }) => {
  const cardRef = useImpression(ad._id, onImpression);
  const ends = formatDay(ad.endsAt);
  const remaining = daysUntil(ad.endsAt);

  return (
    <article
      ref={cardRef}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
    >
      <button
        type="button"
        onClick={() => onOpen(ad)}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-100 text-left"
        aria-label={`Open details for ${ad.headline}`}
      >
        {ad.imageUrl ? (
          <img
            src={ad.imageUrl}
            alt={ad.imageAlt || ad.headline}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <Megaphone className="h-8 w-8 text-slate-400" aria-hidden="true" />
          </div>
        )}

        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0A5C36]/95 via-[#0A5C36]/50 to-transparent"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-300">
            {ad.schoolName || 'School'}
          </p>
          <p className="mt-1 line-clamp-2 text-[15px] font-extrabold leading-tight text-white">
            {ad.headline}
          </p>
        </div>

        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur">
          {ad.placement === 'home_hero' ? 'Featured' : 'Sponsored'}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {ad.writeup ? (
          <p className="line-clamp-3 text-[13.5px] font-medium leading-relaxed text-slate-600">
            {ad.writeup}
          </p>
        ) : (
          <p className="text-[13.5px] italic text-slate-400">
            No description provided.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <PlacementPill placement={ad.placement} />
          {ends && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              Until {ends}
              {remaining !== null && remaining > 0 && remaining <= 14 && (
                <span className="text-amber-600"> · {remaining}d left</span>
              )}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpen(ad)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0A5C36] px-4 py-2.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-[#084a2b]"
          >
            View details
          </button>
          {ad.linkUrl && (
            <a
              href={ad.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${ad.schoolName || 'school'} website`}
              className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:text-[#0A5C36]"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

const AdCardSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="aspect-[16/10] w-full animate-pulse bg-slate-100" />
    <div className="space-y-3 p-4">
      <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
      <div className="h-8 w-full animate-pulse rounded-xl bg-slate-100" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const AdvertisementsHub = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const [placementFilter, setPlacementFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [school, setSchool] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedAd, setSelectedAd] = useState(null);

  // Impression dedupe — a Set of ids that have already been reported.
  const seenRef = useRef(new Set());
  const onImpression = useCallback((adId) => {
    if (!adId) return;
    if (seenRef.current.has(adId)) return;
    seenRef.current.add(adId);
    // Fire and forget. A failed impression is not worth surfacing to the user;
    // the advertiser simply does not get credit for one view.
    trackAdImpression(adId).catch(() => {});
  }, []);

  // ── Initial + paginated fetch ──
  const loadPage = useCallback(
    async (pageToLoad, { replace = false } = {}) => {
      if (replace) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await fetchSchoolAds('all', {
          perPage: PAGE_SIZE,
          page: pageToLoad,
        });
        const list = Array.isArray(result) ? result : [];
        setAds((current) => (replace ? list : [...current, ...list]));
        setHasMore(list.length === PAGE_SIZE);
        setPage(pageToLoad);
      } catch (err) {
        if (replace) setError(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    loadPage(1, { replace: true });
  }, [loadPage]);

  // Sentinel that triggers the next page. Disabled while a load is in flight,
  // while the initial load is happening, and when there is nothing more.
  const sentinelRef = useInViewTrigger(
    () => {
      if (!loading && !loadingMore && hasMore) {
        loadPage(page + 1);
      }
    },
    { disabled: loading || loadingMore || !hasMore }
  );

  // ── Derived: school options for the filter ──
  const schoolOptions = useMemo(() => {
    const names = new Set();
    ads.forEach((ad) => {
      if (ad.schoolName) names.add(ad.schoolName);
    });
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));
    return [
      { key: 'all', label: 'All schools' },
      ...sorted.map((name) => ({ key: name, label: name })),
    ];
  }, [ads]);

  // ── Derived: visible list after filter + sort + search ──
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = ads.filter((ad) => {
      if (placementFilter !== 'all' && ad.placement !== placementFilter) {
        return false;
      }
      if (school !== 'all' && ad.schoolName !== school) return false;
      if (q) {
        const haystack = `${ad.schoolName || ''} ${ad.headline || ''} ${ad.writeup || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === 'ending_soon') {
      // Ads with no `endsAt` sort last (they run indefinitely by intent).
      sorted.sort((a, b) => {
        const at = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
        const bt = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
        return at - bt;
      });
    } else if (sort === 'school_az') {
      sorted.sort((a, b) =>
        String(a.schoolName || '').localeCompare(String(b.schoolName || ''))
      );
    } else {
      // Newest first. `createdAt` is the field the backend writes.
      sorted.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
    }
    return sorted;
  }, [ads, placementFilter, sort, school, query]);

  const counts = useMemo(
    () => ({
      all: ads.length,
      advertisement_page: ads.filter((a) => a.placement === 'advertisement_page').length,
      home_hero: ads.filter((a) => a.placement === 'home_hero').length,
    }),
    [ads]
  );

  const clearAll = useCallback(() => {
    setPlacementFilter('all');
    setSort('newest');
    setSchool('all');
    setQuery('');
  }, []);

  const anyFilterActive =
    placementFilter !== 'all' || school !== 'all' || query.trim() !== '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ── */}
      <header className="relative overflow-hidden bg-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(10,92,54,0.08),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D1F0DE] bg-[#EAF7F0] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0A5C36]">
              School advertising
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              See where schools are reaching families
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-relaxed text-slate-500">
              Every advertisement on SukuuPay is placed by a real Ghanaian school —
              on the homepage, on the parent portal, on the fee screens parents open
              every term.
            </p>

            <dl className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <dt className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                  Active
                </dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                  {loading ? '—' : counts.all}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <dt className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                  Homepage
                </dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                  {loading ? '—' : counts.home_hero}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <dt className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                  Ad page
                </dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                  {loading ? '—' : counts.advertisement_page}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 py-3">
            {/* Placement tabs */}
            <div
              role="tablist"
              aria-label="Filter by placement"
              className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1"
            >
              {PLACEMENTS.map((tab) => {
                const isActive = placementFilter === tab.key;
                const count = counts[tab.key] ?? 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setPlacementFilter(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold transition-colors ${
                      isActive
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-1.5 text-[10.5px] font-bold text-slate-400">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <form
              role="search"
              onSubmit={(e) => e.preventDefault()}
              className="relative min-w-0 flex-1 sm:max-w-xs"
            >
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search school or headline…"
                aria-label="Search advertisements"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-[12.5px] font-semibold text-ink placeholder:font-medium placeholder:text-slate-400 focus:border-[#0A5C36] focus:outline-none focus:ring-2 focus:ring-[#0A5C36]/15"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {/* School filter */}
            <Dropdown
              label="School"
              value={school}
              options={schoolOptions}
              onChange={setSchool}
              icon={Filter}
            />

            {/* Sort */}
            <Dropdown
              label="Sort"
              value={sort}
              options={SORTS}
              onChange={setSort}
            />

            {/* Clear all — shown only when a filter is active */}
            {anyFilterActive && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {error && !loading && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-[13px] font-extrabold text-red-800">
              Advertisements could not be loaded
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-red-700">
              {error.message}
            </p>
            <button
              type="button"
              onClick={() => loadPage(1, { replace: true })}
              className="mt-2 text-[11.5px] font-extrabold text-red-700 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <AdCardSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={
              query
                ? 'Nothing matched that search'
                : anyFilterActive
                  ? 'Nothing for these filters'
                  : 'No advertisements yet'
            }
            description={
              query
                ? 'Try the school name or a word from the headline.'
                : anyFilterActive
                  ? 'Try clearing a filter, or check back soon.'
                  : 'Schools can submit a creative for the public pages. Check back soon.'
            }
            action={
              anyFilterActive ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((ad) => (
                <AdCard
                  key={ad._id}
                  ad={ad}
                  onOpen={setSelectedAd}
                  onImpression={onImpression}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel + fallback button */}
            <div className="mt-10 flex flex-col items-center gap-3">
              <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />

              {loadingMore && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-[12px] font-extrabold text-slate-500 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Loading more…
                </div>
              )}

              {!loadingMore && hasMore && typeof IntersectionObserver === 'undefined' && (
                <button
                  type="button"
                  onClick={() => loadPage(page + 1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12.5px] font-extrabold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Load more
                </button>
              )}

              {!hasMore && visible.length > 0 && (
                <p className="text-[11.5px] font-semibold text-slate-400">
                  You&rsquo;ve seen everything.
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <AdDetailModal
        open={Boolean(selectedAd)}
        ad={selectedAd}
        schoolId={selectedAd?.schoolId}
        onClose={() => setSelectedAd(null)}
      />
    </div>
  );
};

export default AdvertisementsHub;