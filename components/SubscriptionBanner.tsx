import React from 'react';
import { Clock3 } from 'lucide-react';

interface SubscriptionBannerProps {
  plan: 'pro_monthly' | 'pro_annual';
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  onRenew: () => void;
}

export const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({ plan, monthlyPriceUsd, annualPriceUsd, onRenew }) => {
  const annual = plan === 'pro_annual';
  const price = annual ? annualPriceUsd : monthlyPriceUsd;
  const priceLabel = `$${Number(price || 0).toFixed(2)} USD`;

  return (
    <aside className="shrink-0 border-b border-amber-300/30 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-lime-400/10 px-4 py-2.5 text-amber-50" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5 text-xs sm:text-sm">
          <Clock3 size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <span><strong>Tu suscripción vence hoy.</strong> Renueva ahora para no perder tu acceso ilimitado.</span>
        </div>
        <button onClick={onRenew} className="shrink-0 rounded-xl border border-amber-200/40 bg-amber-300 px-3.5 py-2 text-[11px] font-black text-slate-950 shadow-lg shadow-amber-500/10 transition hover:bg-lime-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
          {annual ? 'Renovar Pro anual' : 'Renovar'} por {priceLabel}
        </button>
      </div>
    </aside>
  );
};
