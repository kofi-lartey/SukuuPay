import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSchoolAds } from '../services/schoolAds';

const ROTATE_MS = 6000;

/**
 * Loads the live creatives for a placement and drives the rotation index.
 *
 * Autoplay is skipped for readers who ask for reduced motion, and the timer is
 * held while the carousel is hovered or focused so a slide never rotates out
 * from under someone mid-read or mid-click.
 */
export const useSchoolAds = (placement = 'auth_aside') => {
  const [ads, setAds] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let active = true;

    fetchSchoolAds(placement).then((loaded) => {
      if (active) setAds(loaded);
    });

    return () => {
      active = false;
    };
  }, [placement]);

  const total = ads.length;

  // Guard against the list shrinking under a stale index (ads expire server-side).
  useEffect(() => {
    setIndex((current) => (total === 0 ? 0 : Math.min(current, total - 1)));
  }, [total]);

  useEffect(() => {
    if (total < 2) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return undefined;

    const timer = setInterval(() => {
      if (!pausedRef.current) setIndex((current) => (current + 1) % total);
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [total]);

  const goTo = useCallback(
    (next) => setIndex(((next % total) + total) % total),
    [total]
  );

  return {
    ads,
    index,
    total,
    goTo,
    next: useCallback(() => setIndex((current) => (current + 1) % total), [total]),
    prev: useCallback(
      () => setIndex((current) => (current - 1 + total) % total),
      [total]
    ),
    setPaused,
  };
};

export default useSchoolAds;
