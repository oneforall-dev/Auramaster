import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Download, ExternalLink, CheckCircle2, ShieldCheck, Music, Trophy, Radio, ArrowRight, RefreshCw, X } from 'lucide-react';
import { Language } from '../services/i18n';

interface ExportSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  lang?: Language;
  onStartNewProject?: () => void;
}

export const ExportSuccessModal: React.FC<ExportSuccessModalProps> = ({
  isOpen,
  onClose,
  fileName = 'Master_Auramaster.wav',
  lang = 'es',
  onStartNewProject
}) => {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-cyan-950/60 flex flex-col gap-5 relative m-auto max-h-[92vh] overflow-y-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X size={18} />
        </button>

        {/* Header Success Animation */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/25 animate-bounce">
              <Download size={26} />
            </div>
            <div className="absolute -top-1 -right-1 p-1 bg-emerald-400 rounded-full text-slate-950">
              <CheckCircle2 size={14} />
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {lang === 'es' ? '¡Mastering Descargado con Éxito!' : 'Mastering Downloaded Successfully!'}
            </h2>
            <p className="text-xs font-mono text-cyan-300 truncate max-w-[360px]">
              📁 {fileName}
            </p>
          </div>
        </div>

        {/* Step-by-Step Spotify Distribution & AI Chart Eligibility Card */}
        <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-indigo-950/90 via-slate-900 to-purple-950/70 border border-cyan-500/40 shadow-xl shadow-indigo-950/50 flex flex-col gap-4">
          
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <Trophy size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                {lang === 'es' ? 'Ranking Mundial de Música con IA' : 'Global AI Music Ranking'}
              </span>
              <span className="text-sm font-bold text-white leading-tight">
                {lang === 'es' ? '¿Creaste esta canción con IA (Suno, Udio, etc.)?' : 'Created with AI Music (Suno, Udio)?'}
              </span>
            </div>
          </div>

          {/* Steps explanation */}
          <div className="flex flex-col gap-2.5 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/40">
                1
              </div>
              <p>
                <strong>{lang === 'es' ? 'Sube tu master a Spotify:' : 'Distribute to Spotify:'}</strong>{' '}
                {lang === 'es' 
                  ? 'Tu pista ya cuenta con el estándar comercial (-14 LUFS / -1 dB TP). Distribúyela a Spotify a través de tu distribuidora favorita.'
                  : 'Your master is normalized for Spotify standards (-14 LUFS / -1 dB TP). Upload via your favorite distributor.'}
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-500/40">
                2
              </div>
              <p>
                <strong>{lang === 'es' ? 'Opta al Chart de Música IA:' : 'Qualify for AI Music Chart:'}</strong>{' '}
                {lang === 'es'
                  ? 'Una vez esté en Spotify, tu canción podrá ingresar a competir en el ranking oficial de música generada con IA.'
                  : 'Once live on Spotify, your track becomes eligible to compete on the official AI Music Chart.'}
              </p>
            </div>
          </div>

          {/* Button to view chart */}
          <a
            href="https://chart.melodia.top"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:via-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer group active:scale-95"
          >
            <Radio size={16} className="text-cyan-200 animate-pulse" />
            <span>{lang === 'es' ? 'Ver el Chart de Música IA en chart.melodia.top' : 'Explore AI Music Chart at chart.melodia.top'}</span>
            <ExternalLink size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>

        {/* Ephemeral Privacy Notice */}
        <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span>
            {lang === 'es'
              ? 'Privacidad absoluta: Tus proyectos y audios nunca se guardan en el servidor. Todo se procesa en la RAM de tu navegador.'
              : 'Absolute privacy: Your projects and audio files are never saved on the server. Processed in browser RAM.'}
          </span>
        </div>

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          {onStartNewProject && (
            <button
              onClick={() => {
                onClose();
                onStartNewProject();
              }}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={14} className="text-cyan-400" />
              <span>{lang === 'es' ? 'Nuevo Proyecto Limpio' : 'New Clean Project'}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>{lang === 'es' ? 'Continuar en el Estudio' : 'Continue in Studio'}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
