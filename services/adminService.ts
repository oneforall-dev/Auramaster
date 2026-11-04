import { authService } from './authService';
import type { PurchasablePlan } from './billingService';

export interface CommercialPlanConfig {
  enabled: boolean;
  baseAmount: number;
  displayPriceUsd: number;
  discountPercent: number;
}

export interface CommercialConfig {
  currency: 'COP' | 'USD';
  freeGenerations: number;
  announcement: {
    enabled: boolean;
    text: string;
    tone: 'info' | 'success' | 'warning';
    linkLabel: string;
    linkUrl: string;
  };
  plans: Record<PurchasablePlan, CommercialPlanConfig>;
  updatedAt: number;
}

const request = async (method: 'GET' | 'PUT', config?: CommercialConfig): Promise<CommercialConfig> => {
  const token = authService.getToken();
  if (!token) throw new Error('Debes iniciar sesión.');
  const res = await fetch('/api/admin/commercial-config', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(config ? { 'Content-Type': 'application/json' } : {})
    },
    body: config ? JSON.stringify(config) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.config) throw new Error(data.error || 'No se pudo actualizar la configuración comercial.');
  return data.config;
};

export const adminService = {
  getCommercialConfig: () => request('GET'),
  saveCommercialConfig: (config: CommercialConfig) => request('PUT', config)
};
