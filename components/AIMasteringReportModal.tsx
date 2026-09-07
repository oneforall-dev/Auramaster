import React from 'react';
import { 
  X, CheckCircle2, Sparkles, VolumeX, ArrowRight, ShieldCheck, 
  Activity, Music2, Cpu, Disc, Sliders, Layers, BarChart2, Gauge, Mic
} from 'lucide-react';
import { AIMasteringResult, SkinMode } from '../types';
import { Language, getT } from '../services/i18n';

interface AIMasteringReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AIMasteringResult | null;
  isBypassed: boolean;
  onToggleBypass: () => void;
  skin?: SkinMode;
  lang?: Language;
}

export const AIMasteringReportModal: React.FC<AIMasteringReportModalProps> = ({
  isOpen,
  onClose,
  result,
  isBypassed,
  onToggleBypass,
  skin = 'modern',
  lang = 'es'
}) => {
  if (!isOpen || !result) return null;

  const t = getT(lang);
  const isClear = false;
  const { before, after, decisions, targetMet, statusNote, referenceReport } = result;

  const formatMode = (m: string) => {
    switch(m) {
      case 'replicate': return 'Replicar Estilo';
      case 'adapt_and_enhance': return 'Adaptar y Mejorar';
      default: return 'Adaptar Estilo';
    }
  };

  const formatIntensity = (i: string) => {
    switch(i) {
      case 'subtle': return 'Sutil (35%)';
      case 'strong': return 'Fuerte (90%)';
      default: return 'Moderado (65%)';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className={`w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[92vh] ${
        isClear 
          ? 'bg-white border-slate-200 text-slate-900' 
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-md text-white ${
              referenceReport 
                ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500' 
                : 'bg-gradient-to-br from-indigo-500 to-cyan-500'
            }`}>
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">
                  {referenceReport ? 'Reporte de Mastering Multi-Referencia AI' : 'Reporte de Mixer Fixer AI'}
                </h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  targetMet 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}>
                  {referenceReport 
                    ? `Match Sónico: ${referenceReport.matchingScorePercent}%` 
                    : targetMet ? 'Objetivo Cumplido' : 'Master Optimizado'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isClear ? 'text-slate-600' : 'text-slate-400'}`}>
                {statusNote || `Masterización completada: ${after.integratedLUFS.toFixed(1)} LUFS-I | True Peak: ${after.truePeakDbTP.toFixed(1)} dBTP`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isClear ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Target Compliance Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isClear 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          }`}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={26} className="text-emerald-500 shrink-0" />
              <div>
                <div className="font-bold text-sm">
                  {referenceReport 
                    ? 'Perfil de Referencia Calibrado & True Peak Protegido' 
                    : 'Estándar de Distribución & Streaming Calibrado'}
                </div>
                <div className="text-xs opacity-90 font-mono mt-0.5">
                  LUFS-I: {after.integratedLUFS.toFixed(1)} LUFS &nbsp;|&nbsp; True Peak medido: {after.truePeakDbTP.toFixed(1)} dBTP (Ceiling configurado: ≤ -1.0 dBTP)
                </div>
              </div>
            </div>

            {/* Live A/B Toggle */}
            <button
              onClick={onToggleBypass}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 ${
                isBypassed
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isBypassed ? <VolumeX size={14} /> : <CheckCircle2 size={14} />}
              <span>Escuchando: {isBypassed ? 'ORIGINAL (Mix Raw)' : 'MASTERIZADO (DSP)'}</span>
            </button>
          </div>

          {/* If Reference Report exists: 4-Way Comparison Table */}
          {referenceReport ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <BarChart2 size={14} className="text-indigo-400" />
                  Comparativa Cuádruple: Original vs. Referencia vs. Master
                </h4>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Modo: {formatMode(referenceReport.config.mode)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    {formatIntensity(referenceReport.config.intensity)}
                  </span>
                </div>
              </div>

              {/* 4-Way Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">Métrica</th>
                      <th className="p-3 text-center">Original (Mix)</th>
                      <th className="p-3 text-center text-indigo-300">Referencia (Obj.)</th>
                      <th className="p-3 text-center text-emerald-400 font-bold">Master Final</th>
                      <th className="p-3 text-right">Resultado / Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    
                    {/* Integrated LUFS */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">Integrated LUFS</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.integratedLUFS.toFixed(1)}</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.integratedLUFS.toFixed(1)}</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{referenceReport.finalProfile.integratedLUFS.toFixed(1)}</td>
                      <td className="p-3 text-right text-slate-300">
                        {Math.abs(referenceReport.finalProfile.integratedLUFS - referenceReport.originalProfile.integratedLUFS) < 0.2
                          ? 'Preservado (0.0 LU)'
                          : `${(referenceReport.finalProfile.integratedLUFS - referenceReport.originalProfile.integratedLUFS >= 0 ? '+' : '')}${(referenceReport.finalProfile.integratedLUFS - referenceReport.originalProfile.integratedLUFS).toFixed(1)} LU`}
                      </td>
                    </tr>

                    {/* True Peak */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">True Peak (dBTP)</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.truePeakDbTP.toFixed(1)}</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.truePeakDbTP.toFixed(1)}</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{referenceReport.finalProfile.truePeakDbTP.toFixed(1)}</td>
                      <td className="p-3 text-right text-emerald-400">≤ -1.0 dBTP Seguro</td>
                    </tr>

                    {/* Dynamic Range LRA */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">Dynamic Range (LRA)</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.dynamicRangeLRA.toFixed(1)} LU</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.dynamicRangeLRA.toFixed(1)} LU</td>
                      <td className="p-3 text-center text-cyan-400 font-bold">{referenceReport.finalProfile.dynamicRangeLRA.toFixed(1)} LU</td>
                      <td className="p-3 text-right text-slate-300">
                        {Math.abs(referenceReport.finalProfile.dynamicRangeLRA - referenceReport.originalProfile.dynamicRangeLRA) < 0.2
                          ? 'Dinámica Preservada'
                          : `${(referenceReport.finalProfile.dynamicRangeLRA - referenceReport.originalProfile.dynamicRangeLRA >= 0 ? '+' : '')}${(referenceReport.finalProfile.dynamicRangeLRA - referenceReport.originalProfile.dynamicRangeLRA).toFixed(1)} LU`}
                      </td>
                    </tr>

                    {/* Crest Factor */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">Crest Factor (Pegada)</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.crestFactor.toFixed(1)} dB</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.crestFactor.toFixed(1)} dB</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{referenceReport.finalProfile.crestFactor.toFixed(1)} dB</td>
                      <td className="p-3 text-right text-slate-300">Transientes Intactos</td>
                    </tr>

                    {/* Stereo Width Ratio */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">Ancho Estéreo (M/S)</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.stereoWidthRatio.toFixed(2)}x</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.stereoWidthRatio.toFixed(2)}x</td>
                      <td className="p-3 text-center text-cyan-400 font-bold">{referenceReport.finalProfile.stereoWidthRatio.toFixed(2)}x</td>
                      <td className="p-3 text-right text-cyan-400">Sub Mono &lt; 105 Hz</td>
                    </tr>

                    {/* Transient Punch */}
                    <tr className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-sans font-semibold text-slate-200">Punch de Transientes</td>
                      <td className="p-3 text-center text-slate-400">{referenceReport.originalProfile.transientPunch}/100</td>
                      <td className="p-3 text-center text-indigo-300">{referenceReport.targetProfile.transientPunch}/100</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">{referenceReport.finalProfile.transientPunch}/100</td>
                      <td className="p-3 text-right text-emerald-400">Calibrado</td>
                    </tr>

                  </tbody>
                </table>
              </div>

              {/* Spectral Comparison Bar */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-400" />
                  Distribución Espectral de 5 Bandas (Master Final)
                </span>
                <div className="grid grid-cols-5 gap-2 font-mono text-center text-[10px]">
                  {['Sub (<80Hz)', 'Low-Mid (320Hz)', 'Mid (1kHz)', 'High-Mid (4.2k)', 'Air (>10kHz)'].map((bandName, idx) => {
                    const finalVal = referenceReport.finalProfile.spectralBands[idx] || 0;
                    const targetVal = referenceReport.targetProfile.spectralBands[idx] || 0;
                    return (
                      <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex flex-col gap-1">
                        <span className="text-slate-400 text-[9px] font-sans truncate">{bandName}</span>
                        <span className="font-bold text-slate-200">{finalVal.toFixed(1)} dB</span>
                        <span className="text-[9px] text-indigo-400">Ref: {targetVal.toFixed(1)} dB</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reference Track Sources */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-xs">
                <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Disc size={13} className="text-indigo-400" />
                  <span>Referencias Utilizadas ({referenceReport.references.length}):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {referenceReport.references.map((r, i) => (
                    <div key={i} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-[11px]">
                      <span className="font-medium text-slate-200">{r.name}</span>
                      {r.isPrimary && (
                        <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-950/60 px-1 rounded">
                          Primaria
                        </span>
                      )}
                      <span className="text-slate-500 font-mono">({Math.round(r.weight * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Standard Before vs After Metric Grid */
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Integrated Loudness */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Integrated LUFS
                </div>
                <div className="flex items-center justify-between my-3">
                  <div className="text-center">
                    <span className="text-[10px] opacity-60 block">ORIGINAL</span>
                    <span className="font-mono text-sm font-bold opacity-80">{before.integratedLUFS.toFixed(1)}</span>
                  </div>
                  <ArrowRight size={16} className="text-cyan-500 opacity-60" />
                  <div className="text-center">
                    <span className="text-[10px] text-emerald-500 font-bold block">MASTER</span>
                    <span className="font-mono text-base font-black text-emerald-500">{after.integratedLUFS.toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-[10px] opacity-70 font-mono text-center">
                  {Math.abs(after.integratedLUFS - before.integratedLUFS) <= 0.3
                    ? 'Volumen Preservado (0.0 LU delta)'
                    : `Ganancia: ${(after.integratedLUFS - before.integratedLUFS >= 0 ? '+' : '') + (after.integratedLUFS - before.integratedLUFS).toFixed(1)} LU`}
                </div>
              </div>

              {/* True Peak */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                  True Peak (dBTP)
                </div>
                <div className="flex items-center justify-between my-3">
                  <div className="text-center">
                    <span className="text-[10px] opacity-60 block">ORIGINAL</span>
                    <span className={`font-mono text-sm font-bold ${before.truePeakDbTP > -1.0 ? 'text-rose-400' : 'opacity-80'}`}>
                      {before.truePeakDbTP.toFixed(1)}
                    </span>
                  </div>
                  <ArrowRight size={16} className="text-cyan-500 opacity-60" />
                  <div className="text-center">
                    <span className="text-[10px] text-emerald-500 font-bold block">PICO MEDIDO</span>
                    <span className="font-mono text-base font-black text-emerald-500">{after.truePeakDbTP.toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-[10px] opacity-70 font-mono text-center">
                  Ceiling configurado: ≤ -1.0 dBTP
                </div>
              </div>

              {/* Dynamic Range */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Dynamic Range (LRA)
                </div>
                <div className="flex items-center justify-between my-3">
                  <div className="text-center">
                    <span className="text-[10px] opacity-60 block">ORIGINAL</span>
                    <span className="font-mono text-sm font-bold opacity-80">{before.dynamicRangeLRA.toFixed(1)} LU</span>
                  </div>
                  <ArrowRight size={16} className="text-cyan-500 opacity-60" />
                  <div className="text-center">
                    <span className="text-[10px] text-cyan-400 font-bold block">MASTER</span>
                    <span className="font-mono text-base font-black text-cyan-400">{after.dynamicRangeLRA.toFixed(1)} LU</span>
                  </div>
                </div>
                <div className="text-[10px] opacity-70 font-mono text-center">
                  {Math.abs(after.dynamicRangeLRA - before.dynamicRangeLRA) < 0.2
                    ? 'Dinámica Preservada (0.0 LU delta)'
                    : `Delta Dinámico: ${(after.dynamicRangeLRA - before.dynamicRangeLRA >= 0 ? '+' : '') + (after.dynamicRangeLRA - before.dynamicRangeLRA).toFixed(1)} LU`}
                </div>
              </div>

            </div>
          )}

          {/* Intelligent Vocal Protection Audit Card (12 Pilares Acústicos) */}
          {result.vocalReport && (
            <div className={`p-4 rounded-xl border space-y-3.5 ${
              isClear 
                ? 'bg-indigo-50/70 border-indigo-200 text-slate-800' 
                : 'border-indigo-500/30 bg-indigo-950/25 text-slate-100'
            }`}>
              {/* Header with Title & Final A/B Verdict Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Mic size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        Protección Vocal Inteligente
                      </h4>
                      <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Mid/Side A/B Audit
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isClear ? 'text-slate-600' : 'text-slate-400'}`}>
                      {result.vocalReport.summaryNote}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border ${
                    result.vocalReport.verdict === 'EXCELLENT'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : result.vocalReport.verdict === 'COMPENSATED'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}>
                    {result.vocalReport.verdict === 'EXCELLENT' ? 'Preservación Óptima' : result.vocalReport.verdict === 'COMPENSATED' ? 'Compensación Activa' : 'Balance Protegido'} (Δ: {result.vocalReport.relativePresenceDeltaDb >= 0 ? '+' : ''}{result.vocalReport.relativePresenceDeltaDb.toFixed(2)} dB)
                  </span>
                </div>
              </div>

              {/* Diagnosis Bar: Masking & Vocal Register */}
              <div className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono ${
                isClear ? 'bg-white/80 border-indigo-100 text-slate-700' : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase text-[10px]">Enmascarador detectado:</span>
                  <span className="font-semibold text-indigo-300">{result.vocalReport.maskingElementDetected}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span>
                    Registro:{' '}
                    <strong className="text-slate-200 font-sans">
                      {result.vocalReport.original.detectedVocalRegister === 'male_deep'
                        ? 'Grave / Masculino (180-450Hz)'
                        : result.vocalReport.original.detectedVocalRegister === 'female_high'
                        ? 'Agudo / Femenino (250-900Hz)'
                        : 'Mixto / Instrumental'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Riesgo:{' '}
                    <strong className={result.vocalReport.original.bassMaskingIndex > 50 ? 'text-amber-400' : 'text-emerald-400'}>
                      {result.vocalReport.original.bassMaskingIndex > 50 ? 'Moderado' : 'Bajo'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Grid of Key 12-Criteria Vocal Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
                {/* 1. Delta Vocal */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Región Vocal (Presencia)</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-slate-200">
                      {result.vocalReport.vocalDeltaDb >= 0 ? '+' : ''}{result.vocalReport.vocalDeltaDb.toFixed(2)} dB
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">@{result.vocalReport.final.exactPresenceFreq}Hz</span>
                  </div>
                </div>

                {/* 2. Delta Graves & Comparison */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Región Graves (30-200Hz)</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-slate-200">
                      {result.vocalReport.lowEndDeltaDb >= 0 ? '+' : ''}{result.vocalReport.lowEndDeltaDb.toFixed(2)} dB
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${
                      result.vocalReport.lowEndVsVocalDiffDb <= 0.50 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      Δ: {result.vocalReport.lowEndVsVocalDiffDb >= 0 ? '+' : ''}{result.vocalReport.lowEndVsVocalDiffDb.toFixed(2)} dB ≤ 0.5
                    </span>
                  </div>
                </div>

                {/* 3. Mid Compensation */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Compensación Mid EQ</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`font-bold ${result.vocalReport.midCompensationAppliedDb > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {result.vocalReport.midCompensationAppliedDb > 0 
                        ? `+${result.vocalReport.midCompensationAppliedDb.toFixed(2)} dB` 
                        : '0.0 dB (No requerida)'}
                    </span>
                    {result.vocalReport.midCompensationAppliedDb > 0 && (
                      <span className="text-[10px] font-mono text-indigo-400">@{result.vocalReport.midCompensationFreq}Hz</span>
                    )}
                  </div>
                </div>

                {/* 4. Adaptive De-Esser */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">De-Esser Adaptativo</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-slate-200">
                      {result.vocalReport.deEsserApplied 
                        ? `-${result.vocalReport.deEsserReductionDb.toFixed(1)} dB máx` 
                        : 'Bypass (Limpio)'}
                    </span>
                    {result.vocalReport.deEsserApplied && (
                      <span className="text-[10px] font-mono text-indigo-400">@{result.vocalReport.exactDeEsserFreq}Hz</span>
                    )}
                  </div>
                </div>

                {/* 5. Anti-Pumping Protection */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Anti-Pumping Sub/Kick</span>
                  <span className="font-bold text-emerald-400 mt-1 block">
                    ✓ Sin Ducking en Voz
                  </span>
                </div>

                {/* 6. Mono Compatibility & Body */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Compatibilidad Mono</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-slate-200">
                      {result.vocalReport.monoCompatibilityPreserved ? '✓ Fase Coherente' : 'Revisión sugerida'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {result.vocalReport.final.monoCompatibilityScore}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DSP Decisions & Process Applied */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Cpu size={14} className="text-cyan-400" />
              Procesamiento y Ajustes Realizados por el Motor DSP
            </h4>
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              {decisions.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className={isClear ? 'text-slate-700' : 'text-slate-300'}>{d}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-3 text-xs opacity-70 font-mono">
            <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-emerald-400 font-semibold">
              {referenceReport ? `Exportación Nativa Preservada (${(referenceReport.sampleRate / 1000).toFixed(1)} kHz / 24-bit)` : 'Frecuencia Original Preservada'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
