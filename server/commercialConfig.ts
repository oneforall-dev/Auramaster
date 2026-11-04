export interface CommercialPlanConfig {
  enabled: boolean;
  baseAmount: number;
  displayPriceUsd: number;
  discountPercent: number;
}

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  tone: 'info' | 'success' | 'warning';
  linkLabel: string;
  linkUrl: string;
}

export interface CommercialConfig {
  currency: 'COP' | 'USD';
  freeGenerations: number;
  announcement: AnnouncementConfig;
  plans: {
    payg: CommercialPlanConfig;
    pro_monthly: CommercialPlanConfig;
    pro_annual: CommercialPlanConfig;
  };
  updatedAt: number;
}

export const defaultCommercialConfig = (): CommercialConfig => ({
  currency: String(process.env.BOLD_CURRENCY || 'USD').toUpperCase() === 'COP' ? 'COP' : 'USD',
  freeGenerations: 1,
  announcement: {
    enabled: false,
    text: '',
    tone: 'info',
    linkLabel: '',
    linkUrl: ''
  },
  plans: {
    payg: { enabled: true, baseAmount: Number(process.env.BOLD_PRICE_PAYG || 1), displayPriceUsd: 1, discountPercent: 0 },
    pro_monthly: { enabled: true, baseAmount: Number(process.env.BOLD_PRICE_PRO_MONTHLY || 9.99), displayPriceUsd: 9.99, discountPercent: 0 },
    pro_annual: { enabled: true, baseAmount: Number(process.env.BOLD_PRICE_PRO_ANNUAL || 99.99), displayPriceUsd: 99.99, discountPercent: 0 }
  },
  updatedAt: Date.now()
});

export function normalizeCommercialConfig(input: Partial<CommercialConfig> = {}): CommercialConfig {
  const defaults = defaultCommercialConfig();
  const sanitizePlan = (plan: Partial<CommercialPlanConfig> | undefined, fallback: CommercialPlanConfig): CommercialPlanConfig => ({
    enabled: plan?.enabled === undefined ? fallback.enabled : Boolean(plan.enabled),
    baseAmount: Math.round(Math.max(1, Math.min(100000000, Number(plan?.baseAmount ?? fallback.baseAmount) || fallback.baseAmount)) * 100) / 100,
    displayPriceUsd: Math.round(Math.max(0, Math.min(100000, Number(plan?.displayPriceUsd ?? fallback.displayPriceUsd) || 0)) * 100) / 100,
    discountPercent: Math.round(Math.max(0, Math.min(100, Number(plan?.discountPercent ?? fallback.discountPercent) || 0)) * 100) / 100
  });

  return {
    currency: input.currency === 'USD' || input.currency === 'COP' ? input.currency : defaults.currency,
    freeGenerations: Math.max(0, Math.min(100, Math.floor(Number(input.freeGenerations ?? defaults.freeGenerations) || 0))),
    announcement: {
      enabled: Boolean(input.announcement?.enabled),
      text: String(input.announcement?.text || '').trim().slice(0, 240),
      tone: input.announcement?.tone === 'success' || input.announcement?.tone === 'warning' ? input.announcement.tone : 'info',
      linkLabel: String(input.announcement?.linkLabel || '').trim().slice(0, 40),
      linkUrl: /^https?:\/\//i.test(String(input.announcement?.linkUrl || '').trim()) ? String(input.announcement?.linkUrl || '').trim().slice(0, 500) : ''
    },
    plans: {
      payg: sanitizePlan(input.plans?.payg, defaults.plans.payg),
      pro_monthly: sanitizePlan(input.plans?.pro_monthly, defaults.plans.pro_monthly),
      pro_annual: sanitizePlan(input.plans?.pro_annual, defaults.plans.pro_annual)
    },
    updatedAt: Number(input.updatedAt) || Date.now()
  };
}
