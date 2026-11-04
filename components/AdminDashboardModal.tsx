import React, { useEffect, useState } from 'react';
import { CreditCard, Eye, Loader2, Megaphone, RefreshCw, Save, ShieldCheck, X } from 'lucide-react';
import { adminService, CommercialConfig, CommercialPlanConfig } from '../services/adminService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: CommercialConfig) => void;
}

type PlanKey = keyof CommercialConfig['plans'];
type AdminSection = 'plans' | 'info-bar';

const labels: Record<PlanKey, { title: string; help: string }> = {
  payg: { title: 'Pay As You Go', help: 'Un crédito para un master completo' },
  pro_monthly: { title: 'Pro mensual', help: 'Suscripción ilimitada mensual' },
  pro_annual: { title: 'Pro anual', help: 'Suscripción ilimitada anual' }
};

export const AdminDashboardModal: React.FC<Props> = ({ isOpen, onClose, onConfigSaved }) => {
  const [config, setConfig] = useState<CommercialConfig | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('plans');
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
      const saved = await adminService.saveCommercialConfig(config);
      setConfig(saved);
      onConfigSaved?.(saved);
      setMessage(activeSection === 'plans'
        ? 'Planes, precios y descuentos guardados. Los próximos checkouts usarán estos valores.'
        : 'Info bar guardada y actualizada en el sitio.');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-lime-300" />
              <div>
                <h2 className="text-xl font-black">Owner Dashboard</h2>
                <p className="text-xs text-slate-400">Configuración comercial y comunicación global de AuraMaster.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={load} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800" title="Actualizar"><RefreshCw size={18} /></button>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800" title="Cerrar"><X size={20} /></button>
            </div>
          </div>
          <nav className="flex gap-2 px-6 pb-4" aria-label="Owner dashboard sections">
            <Tab active={activeSection === 'plans'} onClick={() => setActiveSection('plans')} icon={<CreditCard size={15} />} label="Plans & Billing" />
            <Tab active={activeSection === 'info-bar'} onClick={() => setActiveSection('info-bar')} icon={<Megaphone size={15} />} label="Info bar" />
          </nav>
        </header>

        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-lime-300" /></div> : config && (
          <div className="space-y-5 p-6">
            {activeSection === 'plans' ? (
              <>
                <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:grid-cols-2">
                  <Field label="Moneda cobrada por Bold">
                    <select value={config.currency} onChange={e => setConfig({ ...config, currency: e.target.value as 'COP' | 'USD' })} className="input-admin">
                      <option value="USD">USD · Dólar estadounidense</option>
                      <option value="COP">COP · Peso colombiano</option>
                    </select>
                  </Field>
                  <Field label="Masterizaciones gratis iniciales">
                    <input type="number" min="0" max="100" value={config.freeGenerations} onChange={e => setConfig({ ...config, freeGenerations: Number(e.target.value) })} className="input-admin" />
                  </Field>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {(Object.keys(labels) as PlanKey[]).map(key => {
                    const plan = config.plans[key];
                    const effective = plan.baseAmount * (1 - plan.discountPercent / 100);
                    const visible = plan.displayPriceUsd * (1 - plan.discountPercent / 100);
                    return (
                      <section key={key} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div><h3 className="font-black">{labels[key].title}</h3><p className="text-[11px] text-slate-400">{labels[key].help}</p></div>
                          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={plan.enabled} onChange={e => updatePlan(key, { enabled: e.target.checked })} /> Activo</label>
                        </div>
                        <div className="space-y-3">
                          <Field label={`Costo cobrado (${config.currency})`}><input type="number" min="1" step="0.01" value={plan.baseAmount} onChange={e => updatePlan(key, { baseAmount: Number(e.target.value) })} className="input-admin" /></Field>
                          <Field label="Precio mostrado (USD)"><input type="number" min="0" step="0.01" value={plan.displayPriceUsd} onChange={e => updatePlan(key, { displayPriceUsd: Number(e.target.value) })} className="input-admin" /></Field>
                          <Field label="Descuento (%)"><input type="number" min="0" max="100" step="0.01" value={plan.discountPercent} onChange={e => updatePlan(key, { discountPercent: Number(e.target.value) })} className="input-admin" /></Field>
                          <div className="rounded-xl border border-lime-500/20 bg-lime-500/5 p-3 text-xs text-lime-100">
                            Bold cobrará <strong>{effective.toLocaleString('es-CO', { maximumFractionDigits: 2 })} {config.currency}</strong><br />
                            El cliente verá <strong>${visible.toFixed(2)} USD</strong>{plan.discountPercent > 0 && <span className="text-lime-300"> · {plan.discountPercent}% OFF</span>}
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
                <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <div>
                    <h3 className="flex items-center gap-2 font-black"><Megaphone size={17} className="text-lime-300" /> Info bar global</h3>
                    <p className="mt-1 text-xs text-slate-400">Publica un aviso en la parte superior de la landing y del estudio.</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm font-semibold">
                    <input type="checkbox" checked={config.announcement.enabled} onChange={e => setConfig({ ...config, announcement: { ...config.announcement, enabled: e.target.checked } })} /> Mostrar info bar
                  </label>
                  <Field label="Mensaje (máximo 240 caracteres)">
                    <textarea maxLength={240} rows={4} value={config.announcement.text} onChange={e => setConfig({ ...config, announcement: { ...config.announcement, text: e.target.value } })} className="input-admin resize-none" placeholder="Ej.: 20% de descuento en Pro anual esta semana." />
                    <span className="mt-1 block text-right text-[10px] text-slate-500">{config.announcement.text.length}/240</span>
                  </Field>
                  <Field label="Estilo">
                    <select value={config.announcement.tone} onChange={e => setConfig({ ...config, announcement: { ...config.announcement, tone: e.target.value as 'info' | 'success' | 'warning' } })} className="input-admin">
                      <option value="info">Información · Cian</option>
                      <option value="success">Promoción · Verde</option>
                      <option value="warning">Aviso · Ámbar</option>
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Texto del enlace"><input maxLength={40} value={config.announcement.linkLabel} onChange={e => setConfig({ ...config, announcement: { ...config.announcement, linkLabel: e.target.value } })} className="input-admin" placeholder="Ver planes" /></Field>
                    <Field label="URL del enlace"><input type="url" value={config.announcement.linkUrl} onChange={e => setConfig({ ...config, announcement: { ...config.announcement, linkUrl: e.target.value } })} className="input-admin" placeholder="https://..." /></Field>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <h3 className="flex items-center gap-2 font-black"><Eye size={17} className="text-cyan-300" /> Vista previa</h3>
                  <p className="mt-1 text-xs text-slate-400">Así aparecerá en la parte superior.</p>
                  <div className={`mt-6 rounded-xl border p-3 text-center text-xs font-semibold ${config.announcement.tone === 'warning' ? 'border-amber-400/30 bg-amber-400/10 text-amber-100' : config.announcement.tone === 'success' ? 'border-lime-400/30 bg-lime-400/10 text-lime-100' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'}`}>
                    {config.announcement.text || 'Escribe un mensaje para previsualizar la info bar.'}
                    {config.announcement.linkLabel && <strong className="ml-2 underline underline-offset-4">{config.announcement.linkLabel} ↗</strong>}
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-[11px] text-slate-400">
                    La barra sólo será pública si está activada y contiene texto. Las URL deben comenzar con <code>https://</code> o <code>http://</code>.
                  </div>
                </section>
              </div>
            )}

            {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
            {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div>}
            <div className="flex justify-end">
              <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-xs font-black text-slate-950 hover:bg-lime-300 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar {activeSection === 'plans' ? 'Plans & Billing' : 'info bar'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`.input-admin{width:100%;border:1px solid rgb(51 65 85);border-radius:.75rem;background:rgb(2 6 23);padding:.65rem .75rem;font-size:.8rem;color:white;outline:none}.input-admin:focus{border-color:rgb(163 230 53);box-shadow:0 0 0 3px rgb(163 230 53 / .1)}`}</style>
    </div>
  );
};

const Tab = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black transition ${active ? 'border-lime-400/40 bg-lime-400/15 text-lime-200' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'}`}>{icon}{label}</button>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>{children}</label>;
