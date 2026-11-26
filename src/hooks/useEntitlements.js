import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardOverview } from './useDashboardOverview';
import {
  resolveEntitlements,
  hasFeature,
  lockedFeaturesFor,
  nextTier,
  tierKeyForServerPlan,
} from '../utils/featureCatalog';

const TIER_MARKETING = { starter: 'Starter', growth: 'Growth' };

/**
 * Pure resolver — derives entitlements from a school object.
 *
 * Kept separate from the hook so a caller that already holds the school (the
 * dashboard shell, which fetches it once) can derive entitlements without a
 * second network round trip.
 *
 * @param {object} school - School object with `subscription.plan` and optional `subscription.featureFlags`
 */
export const deriveEntitlements = (school) => {
  const enabled = resolveEntitlements(school);
  const currentTier = tierKeyForServerPlan(school?.subscription?.plan);
  const nextTierKey = nextTier(currentTier);
  const locked = lockedFeaturesFor(school);
  const upgradeTarget =
    currentTier && nextTierKey
      ? {
          tier: nextTierKey,
          marketingName: TIER_MARKETING[nextTierKey],
          features: locked.filter((l) => l.tier === nextTierKey),
        }
      : null;

  return {
    enabled,
    has: (featureId) => hasFeature(school, featureId),
    locked,
    currentTier,
    nextTierKey,
    nextTierMarketing: nextTierKey ? TIER_MARKETING[nextTierKey] : null,
    upgradeTarget,
    isTopTier: currentTier === 'growth',
  };
};

/**
 * Entitlement hook for the current signed-in school.
 *
 * - `enabled`: Set of enabled feature IDs
 * - `has(featureId)`: boolean check
 * - `locked`: Array of locked features with their unlocking tier
 * - `currentTier`: 'starter' | 'growth' | 'campus' | null
 * - `nextTierKey`, `nextTierMarketing`: upgrade target tier
 * - `upgradeTarget`: { tier, features } for the upgrade CTA
 */
export const useEntitlements = () => {
  const { user } = useAuth();
  const { data } = useDashboardOverview(user?.schoolId);
  const school = data?.school || user;
  const base = useMemo(() => deriveEntitlements(school), [
    school?.subscription?.plan,
    school?.subscription?.featureFlags,
  ]);
  return base;
};

export default useEntitlements;