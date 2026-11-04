export const SUBSCRIPTION_DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionLifecycle = 'none' | 'active' | 'expires-today' | 'expired';

export interface SubscriptionAccount {
  role?: 'user' | 'admin' | 'owner';
  plan?: 'free' | 'payg' | 'pro_monthly' | 'pro_annual';
  credits?: number;
  subscriptionStatus?: 'inactive' | 'active' | 'expired';
  subscriptionExpiresAt?: number;
}

export function getSubscriptionLifecycle(account: SubscriptionAccount | null | undefined, now = Date.now()): SubscriptionLifecycle {
  if (!account || account.role === 'owner') return 'none';
  const expiresAt = Number(account.subscriptionExpiresAt || 0);
  const isProPlan = account.plan === 'pro_monthly' || account.plan === 'pro_annual';
  if (!expiresAt) return 'none';
  if (expiresAt <= now && (isProPlan || account.subscriptionStatus === 'expired')) return 'expired';
  if (!isProPlan || account.subscriptionStatus !== 'active') return 'none';
  if (expiresAt - now <= SUBSCRIPTION_DAY_MS) return 'expires-today';
  return 'active';
}

export function fallbackPlanAfterExpiry(credits = 0): 'free' | 'payg' {
  return Math.max(0, Number(credits) || 0) > 0 ? 'payg' : 'free';
}

export function calculateRenewalExpiry(existingExpiry: number | undefined, durationDays: 30 | 365, now = Date.now()): number {
  const base = Math.max(now, Number(existingExpiry || 0));
  return base + durationDays * SUBSCRIPTION_DAY_MS;
}
