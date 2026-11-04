export type AnnouncementTone = 'info' | 'success' | 'warning';

export interface PublicPlanConfig {
  enabled: boolean;
  originalPriceUsd: number;
  priceUsd: number;
  discountPercent: number;
}

export interface SiteConfig {
  announcement: {
    enabled: boolean;
    text: string;
    tone: AnnouncementTone;
    linkLabel: string;
    linkUrl: string;
  };
  freeGenerations: number;
  currency: 'COP' | 'USD';
  plans: {
    payg: PublicPlanConfig;
    pro_monthly: PublicPlanConfig;
    pro_annual: PublicPlanConfig;
  };
}

export const defaultSiteConfig: SiteConfig = {
  announcement: { enabled: false, text: '', tone: 'info', linkLabel: '', linkUrl: '' },
  freeGenerations: 1,
  currency: 'USD',
  plans: {
    payg: { enabled: true, originalPriceUsd: 1, priceUsd: 1, discountPercent: 0 },
    pro_monthly: { enabled: true, originalPriceUsd: 9.99, priceUsd: 9.99, discountPercent: 0 },
    pro_annual: { enabled: true, originalPriceUsd: 99.99, priceUsd: 99.99, discountPercent: 0 }
  }
};

export const siteConfigService = {
  async get(): Promise<SiteConfig> {
    const response = await fetch('/api/site-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la configuración pública.');
    return response.json();
  }
};
