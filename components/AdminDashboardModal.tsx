import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import { adminService, CommercialConfig, CommercialPlanConfig } from '../services/adminService';

interface Props { isOpen: boolean; onClose: () => void; }
type PlanKey = keyof CommercialConfig['plans'];

const labels: Record<PlanKey, { title: string; help: string }> = {
  payg: { title: 'Pay As You Go', help: 'Un crédito para un master completo' },
  pro_monthly: { title: 'Pro mensual', help: 'Suscripción ilimitada mensual' },
  pro_annual: { title: 'Pro anual', help: 'Suscripción ilimitada anual' }
};

export const AdminDashboardModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<CommercialConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError(''); setMessage('');
    try { setConfig(await adminService.getCommercialConfig()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) load(); }, [isOpen]);

  const updatePlan = (key: PlanKey, patch: Partial<CommercialPlanConfig>) => {
    setConfig(current => current ? { ...current, plans: { ...current.plans, [key]: { ...current.plans[key], ...patch } } } : current);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true); setError(''); setMessage('');
    try {
      setConfig(await adminService.saveCommercialConfig(config));
      setMessage('Precios y descuentos guardados. Los próximos checkouts usarán estos valores.');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-6 py-5 backdrop-blur-xl">
          <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-300" /><div><h2 className="text-xl font-black">Panel Admin · Configuración comercial</h2><p className="text-xs text-slate-400">Controla el precio cobrado por Bold y la oferta visible.</p></div></div>
          <div className="flex gap-2"><button onClick={load} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><RefreshCw size={18} /></button><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></div>
        </header>
        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div> : config && <div className="space-y-5 p-6">
          <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:grid-cols-2">
            <Field label="Moneda cobrada por Bold"><select value={config.currency} onChange={e => setConfig({ ...config, currency: e.target.value as 'COP' | 'USD' })} className="input-admin"><option value="COP">COP · Peso colombiano</option><option value="USD">USD · Dólar estadounidense</option></select></Field>
            <Field label="Masterizaciones gratis iniciales"><input type="number" min="0" max="100" value={config.freeGenerations} onChange={e => setConfig({ ...config, freeGenerations: Number(e.target.value) })} className="input-admin" /></Field>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">{(Object.keys(labels) as PlanKey[]).map(key => {
            const plan = config.plans[key];
            const effective = plan.baseAmount * (1 - plan.discountPercent / 100);
            return <section key={key} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-black">{labels[key].title}</h3><p className="text-[11px] text-slate-400">{labels[key].help}</p></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={plan.enabled} onChange={e => updatePlan(key, { enabled: e.target.checked })} /> Activo</label></div>
              <div className="space-y-3">
                <Field label={`Precio base (${config.currency})`}><input type="number" min="1" step="0.01" value={plan.baseAmount} onChange={e => updatePlan(key, { baseAmount: Number(e.target.value) })} className="input-admin" /></Field>
                <Field label="Precio visible (USD)"><input type="number" min="0" step="0.01" value={plan.displayPriceUsd} onChange={e => updatePlan(key, { displayPriceUsd: Number(e.target.value) })} className="input-admin" /></Field>
                <Field label="Descuento (%)"><input type="number" min="0" max="100" step="0.01" value={plan.discountPercent} onChange={e => updatePlan(key, { discountPercent: Number(e.target.value) })} className="input-admin" /></Field>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">Bold cobrará <strong>{effective.toLocaleString('es-CO', { maximumFractionDigits: 2 })} {config.currency}</strong></div>
              </div>
            </section>;
          })}</div>
          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
          {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div>}
          <div className="flex justify-end"><button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar configuración</button></div>
        </div>}
      </div>
      <style>{`.input-admin{width:100%;border:1px solid rgb(51 65 85);border-radius:.75rem;background:rgb(2 6 23);padding:.65rem .75rem;font-size:.8rem;color:white;outline:none}.input-admin:focus{border-color:rgb(34 211 238)}`}</style>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>;
