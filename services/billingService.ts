import { authService, UserProfile } from './authService';

export type PurchasablePlan = 'payg' | 'pro_monthly' | 'pro_annual';

export interface BillingTier {
  enabled?: boolean;
  priceUsd: number;
  originalPriceUsd?: number;
  discountPercent?: number;
  amount?: number;
  currency?: 'COP' | 'USD';
  generations?: number;
  credits?: number;
  unlimited?: boolean;
  apiKeyVault?: boolean;
}

export interface BillingStatus {
  user: UserProfile | null;
  tiers: Record<'free' | PurchasablePlan, BillingTier>;
}

const authorizedFetch = async (url: string, init: RequestInit = {}) => {
  const token = authService.getToken();
  if (!token) throw new Error('Debes iniciar sesión con Google.');
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
  });
};

export const isProUser = (user: UserProfile | null | undefined): boolean =>
  Boolean(user && (user.role === 'owner' || ((user.plan === 'pro_monthly' || user.plan === 'pro_annual') && user.subscriptionStatus === 'active')));

export const billingService = {
  async refreshStatus(): Promise<BillingStatus> {
    const res = await authorizedFetch('/api/billing/status');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo consultar el plan.');
    return {
      user: data.user ? authService.updateStoredUser(data.user) : null,
      tiers: data.tiers
    };
  },

  async createCheckout(plan: PurchasablePlan, quantity = 1): Promise<string> {
    const res = await authorizedFetch('/api/billing/bold/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, quantity })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.checkoutUrl) throw new Error(data.error || 'No se pudo crear el enlace de pago.');
    return data.checkoutUrl;
  },

  async consumeGenerations(count: number, operationId: string): Promise<UserProfile> {
    const res = await authorizedFetch('/api/usage/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, operationId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) throw new Error(data.error || 'No fue posible autorizar esta masterización.');
    return authService.updateStoredUser(data.user);
  }
};
