import React from 'react';
import { X, CheckCircle2, Sparkles, VolumeX, ArrowRight, ShieldCheck, Activity, Music2, Cpu } from 'lucide-react';
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
  const { before, after, decisions, targetMet, statusNote } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] ${
        isClear 
          ? 'bg-white border-slate-200 text-slate-900' 
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white rounded-xl shadow-md">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Reporte de Mixer Fixer AI</h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  targetMet 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}>
                  {targetMet ? 'Objetivo Cumplido' : 'Master Optimizado'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isClear ? 'text-slate-600' : 'text-slate-400'}`}>
                {statusNote || 'Normalización de loudness a -14 LUFS-I y True Peak ≤ -1.0 dBTP'}
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
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Target Compliance Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isClear 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          }`}>
            <div className="flex items-center gap-3">
              <ShieldCheck size={26} className="text-emerald-500 shrink-0" />
              <div>
                <div className="font-bold text-sm">Estándar de Streaming Alcanzado</div>
                <div className="text-xs opacity-90 font-mono mt-0.5">
                  LUFS-I: ≤ -14.0 LUFS &nbsp;|&nbsp; True Peak: ≤ -1.0 dBTP
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

          {/* Before vs After Metric Grid */}
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
                Target: -14.0 LUFS
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
                  <span className="text-[10px] text-emerald-500 font-bold block">MASTER</span>
                  <span className="font-mono text-base font-black text-emerald-500">{after.truePeakDbTP.toFixed(1)}</span>
                </div>
              </div>
              <div className="text-[10px] opacity-70 font-mono text-center">
                Ceiling: -1.0 dBTP
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
                Preservación Dinámica
              </div>
            </div>

          </div>

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
          <span className="text-xs opacity-60 font-mono">
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
