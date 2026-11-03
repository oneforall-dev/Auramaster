import React, { useEffect, useState } from 'react';
import { Check, Crown, Sparkles, X, Zap, KeyRound, Loader2, RefreshCw, CircleAlert, ExternalLink } from 'lucide-react';
import { authService, UserProfile } from '../services/authService';
import { billingService, BillingStatus, PurchasablePlan, isProUser } from '../services/billingService';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  notice?: string;
}

export const BillingModal: React.FC<BillingModalProps> = ({ isOpen, onClose, user, notice }) => {
  const [account, setAccount] = useState<UserProfile | null>(user);
  const [tiers, setTiers] = useState<BillingStatus['tiers'] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PurchasablePlan | null>(null);
  const [error, setError] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const refresh = async () => {
    try {
      const updated = await billingService.refreshStatus();
      setAccount(updated.user);
      setTiers(updated.tiers);
    } catch (e: any) {
      setError(e.message || 'No se pudo actualizar el plan.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setAccount(authService.getUser() || user);
    setError('');
    setCheckoutMessage('');
    refresh();
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const refreshAfterPayment = () => refresh();
    window.addEventListener('focus', refreshAfterPayment);
    return () => window.removeEventListener('focus', refreshAfterPayment);
  }, [isOpen]);

  const checkout = async (plan: PurchasablePlan) => {
    const paymentWindow = window.open('', '_blank');
    if (!paymentWindow) {
      setError('El navegador bloqueó la pestaña de pago. Permite ventanas emergentes para AuraMaster y vuelve a intentarlo.');
      return;
    }
    paymentWindow.document.title = 'AuraMaster · Preparando pago';
    paymentWindow.document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;margin:0;background:#020617;color:#cffafe;font-family:system-ui,sans-serif"><div style="text-align:center"><div style="width:38px;height:38px;margin:0 auto 18px;border:3px solid #164e63;border-top-color:#22d3ee;border-radius:50%;animation:spin .8s linear infinite"></div><strong>Preparando pago seguro…</strong><p style="color:#64748b;font-size:13px">No cierres esta pestaña.</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style></main>`;
    setLoadingPlan(plan);
    setError('');
    setCheckoutMessage('');
    try {
      const url = await billingService.createCheckout(plan);
      paymentWindow.location.replace(url);
      try { paymentWindow.opener = null; } catch {}
      paymentWindow.focus();
      setCheckoutMessage('El pago se abrió en una pestaña nueva. AuraMaster seguirá disponible aquí.');
    } catch (e: any) {
      paymentWindow.close();
      setError(e.message || 'No se pudo iniciar el pago.');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (!isOpen) return null;
  const pro = isProUser(account);
  const owner = account?.role === 'owner';
  const usd = (value: number | undefined) => `$${Number(value || 0).toFixed(2).replace(/\.00$/, '')} USD`;
  const discount = (value: number | undefined) => value ? ` · ${value}% de descuento` : '';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-6 py-5 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-black">Planes de AuraMaster</h2>
            <p className="mt-1 text-xs text-slate-400">Mastering profesional con cobro seguro mediante Bold.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title="Actualizar plan"><RefreshCw size={17} /></button>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="px-6 pt-5 text-xs text-slate-300">
          Plan actual: <strong className="text-cyan-300">{owner ? 'Owner · Acceso total' : pro ? 'Pro Ilimitado' : account?.plan === 'payg' ? `Pay As You Go · ${account.credits || 0} créditos` : `Gratis · ${account?.freeGenerationsRemaining ?? tiers?.free.generations ?? 1} generación disponible`}</strong>
        </div>
        {notice && <div className="mx-6 mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-cyan-500/5 p-4 text-sm text-amber-50"><CircleAlert size={19} className="mt-0.5 shrink-0 text-amber-300" /><div><strong className="block">Necesitas acceso para continuar</strong><span className="mt-1 block text-xs text-slate-300">{notice}</span><span className="mt-2 block text-[11px] text-cyan-200">Elige una opción abajo; el pago se completará en una pestaña segura separada.</span></div></div>}
        {error && <div className="mx-6 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        {checkoutMessage && <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100"><ExternalLink size={15} />{checkoutMessage}</div>}

        {owner ? (
          <div className="m-6 rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-slate-900 p-6">
            <div className="flex items-center gap-3 text-amber-200"><Crown size={24} /><h3 className="text-lg font-black">Cuenta Owner de AuraMaster</h3></div>
            <p className="mt-3 text-sm text-slate-300">Masterizaciones ilimitadas, acceso completo al baúl de API Keys y funciones administrativas. Esta cuenta nunca consume créditos ni entra al checkout de Bold.</p>
          </div>
        ) : <div className="grid gap-4 p-6 md:grid-cols-3">
          <PlanCard icon={<Sparkles size={20} />} title="Gratis (Prueba)" price="$0 USD" subtitle={`${tiers?.free.generations ?? 1} generación(es) completa(s)`} features={["Master completo listo para streaming", "Sin tarjeta", "Cupo inicial configurable"]} active={account?.plan === 'free' || !account?.plan} />

          <PlanCard icon={<Zap size={20} />} title="Pay As You Go" price={usd(tiers?.payg.priceUsd ?? 1)} subtitle={`por diseño · 1 crédito${discount(tiers?.payg.discountPercent)}`} features={["Compra sólo lo que uses", "1 crédito = 1 master completo", "Créditos sin vencimiento"]} active={account?.plan === 'payg'} actionLabel={tiers?.payg.enabled === false ? 'Oferta no disponible' : 'Comprar 1 crédito'} disabled={tiers?.payg.enabled === false} loading={loadingPlan === 'payg'} onAction={() => checkout('payg')} />

          <PlanCard icon={<Crown size={20} />} title="Pro Ilimitado" price={usd(tiers?.pro_monthly.priceUsd ?? 9.99)} subtitle={`al mes${discount(tiers?.pro_monthly.discountPercent)} · anual ${usd(tiers?.pro_annual.priceUsd ?? 99.99)}${discount(tiers?.pro_annual.discountPercent)}`} features={["Masterizaciones ilimitadas", "Baúl de API Keys habilitado", "Precio anual configurable"]} active={pro} highlighted actionLabel={tiers?.pro_monthly.enabled === false ? 'Mensual no disponible' : 'Elegir mensual'} secondaryLabel={tiers?.pro_annual.enabled === false ? 'Anual no disponible' : `Elegir anual · ${usd(tiers?.pro_annual.priceUsd ?? 99.99)}`} loading={loadingPlan === 'pro_monthly' || loadingPlan === 'pro_annual'} disabled={tiers?.pro_monthly.enabled === false} secondaryDisabled={tiers?.pro_annual.enabled === false} onAction={() => checkout('pro_monthly')} onSecondary={() => checkout('pro_annual')} />
        </div>}

        <div className="mx-6 mb-6 flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
          <KeyRound size={17} className="text-cyan-400" />
          {owner ? 'El owner tiene acceso permanente al baúl cifrado y a todas las funciones sin límites de pago.' : 'El botón para añadir una API Key y el baúl cifrado aparecen únicamente con Pro Ilimitado activo.'}
        </div>
      </div>
    </div>
  );
};

const PlanCard = ({ icon, title, price, subtitle, features, active, highlighted, actionLabel, secondaryLabel, loading, disabled, secondaryDisabled, onAction, onSecondary }: any) => (
  <div className={`relative flex flex-col rounded-3xl border p-5 ${highlighted ? 'border-cyan-400/60 bg-gradient-to-b from-cyan-500/15 to-slate-900' : 'border-slate-800 bg-slate-900/80'}`}>
    {active && <span className="absolute right-4 top-4 rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-black uppercase text-emerald-300">Plan actual</span>}
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">{icon}</div>
    <h3 className="font-black">{title}</h3>
    <div className="mt-3 text-2xl font-black">{price}</div>
    <div className="text-xs text-slate-400">{subtitle}</div>
    <ul className="my-5 flex-1 space-y-2 text-xs text-slate-300">
      {features.map((feature: string) => <li key={feature} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />{feature}</li>)}
    </ul>
    {onAction && <button onClick={onAction} disabled={loading || disabled} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{loading && <Loader2 size={14} className="animate-spin" />}{actionLabel}</button>}
    {onSecondary && <button onClick={onSecondary} disabled={loading || secondaryDisabled} className="mt-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50">{secondaryLabel}</button>}
  </div>
);
