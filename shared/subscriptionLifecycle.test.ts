import { describe, expect, it } from 'vitest';
import { calculateRenewalExpiry, fallbackPlanAfterExpiry, getSubscriptionLifecycle, SUBSCRIPTION_DAY_MS } from './subscriptionLifecycle';

const now = Date.UTC(2026, 10, 3, 12);

describe('subscription lifecycle', () => {
  it('marks the final 24 hours as the renewal day', () => {
    expect(getSubscriptionLifecycle({ plan: 'pro_monthly', subscriptionStatus: 'active', subscriptionExpiresAt: now + SUBSCRIPTION_DAY_MS }, now)).toBe('expires-today');
    expect(getSubscriptionLifecycle({ plan: 'pro_monthly', subscriptionStatus: 'active', subscriptionExpiresAt: now + SUBSCRIPTION_DAY_MS + 1 }, now)).toBe('active');
  });

  it('marks a finished Pro cycle as expired', () => {
    expect(getSubscriptionLifecycle({ plan: 'pro_annual', subscriptionStatus: 'active', subscriptionExpiresAt: now - 1 }, now)).toBe('expired');
  });

  it('never prompts an owner to renew', () => {
    expect(getSubscriptionLifecycle({ role: 'owner', plan: 'pro_monthly', subscriptionStatus: 'active', subscriptionExpiresAt: now - 1 }, now)).toBe('none');
  });

  it('preserves Pay As You Go when unused credits remain', () => {
    expect(fallbackPlanAfterExpiry(2)).toBe('payg');
    expect(fallbackPlanAfterExpiry(0)).toBe('free');
  });

  it('extends active cycles and restarts expired cycles from payment approval', () => {
    const activeExpiry = now + 10 * SUBSCRIPTION_DAY_MS;
    expect(calculateRenewalExpiry(activeExpiry, 30, now)).toBe(activeExpiry + 30 * SUBSCRIPTION_DAY_MS);
    expect(calculateRenewalExpiry(now - 1, 365, now)).toBe(now + 365 * SUBSCRIPTION_DAY_MS);
  });
});
