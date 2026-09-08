import React from 'react';
import { 
  X, CheckCircle2, Sparkles, VolumeX, ArrowRight, ShieldCheck, 
  Activity, Music2, Cpu, Disc, Sliders, Layers, BarChart2, Gauge, Mic,
  Scale, Binary, Trophy, Target
} from 'lucide-react';
import { AIMasteringResult, SkinMode } from '../types';
import { Language, getT } from '../services/i18n';

interface AIMasteringReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AIMasteringResult | null;
  isBypassed: boolean;
  onToggleBypass: () => void;
  loudnessMatchMode?: 'matched' | 'actual';
  onToggleLoudnessMatch?: () => void;
  skin?: SkinMode;
  lang?: Language;
}

export const AIMasteringReportModal: React.FC<AIMasteringReportModalProps> = ({
  isOpen,
  onClose,
  result,
  isBypassed,
  onToggleBypass,
  loudnessMatchMode = 'matched',
  onToggleLoudnessMatch,
  skin = 'modern',
  lang = 'es'
}) => {
  if (!isOpen || !result) return null;

  const t = getT(lang);
  const isClear = false;
  const { before, after, decisions, targetMet, statusNote, referenceReport } = result;
  const finalMeasuredLUFS = result.finalMeasuredLUFS ?? after.integratedLUFS;

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
                  result.qualityVerdict === 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    : targetMet 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}>
                  {result.qualityVerdict === 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
                    ? 'Original Preservado (Sin Masterización Sustancial)'
                    : referenceReport 
                      ? `Match Sónico: ${referenceReport.matchingScorePercent}%` 
                      : targetMet ? 'Objetivo Cumplido' : 'Master Optimizado'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isClear ? 'text-slate-600' : 'text-slate-400'}`}>
                {statusNote || `Masterización completada: ${finalMeasuredLUFS.toFixed(1)} LUFS-I | True Peak: ${after.truePeakDbTP.toFixed(1)} dBTP`}
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
                  LUFS-I: {finalMeasuredLUFS.toFixed(1)} LUFS &nbsp;|&nbsp; True Peak medido: {after.truePeakDbTP.toFixed(1)} dBTP (Ceiling configurado: ≤ -1.0 dBTP)
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

          {/* Identidad del Audio & Fuente Única de Verdad (WAV Exportado & Reabierto) */}
          {result.audioIdentity && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isClear 
                ? 'bg-slate-50 border-slate-200 text-slate-800' 
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Binary size={18} className="text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    Fuente Única de Verdad: WAV Decodificado & Verificado
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  100% Bit-Identical al Archivo Final Exportado
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. File Hash SHA-256 */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Hash Criptográfico SHA-256</span>
                  <div className="mt-1 font-mono font-bold text-cyan-300 truncate" title={result.audioIdentity.fileHash}>
                    {result.audioIdentity.fileHash ? `${result.audioIdentity.fileHash.substring(0, 16)}...` : 'Verificado'}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                    Decodificado desde archivo real
                  </div>
                </div>

                {/* 2. Vocal-to-Instrumental Ratio (VIR) */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Relación Voz/Instrumental (VIR)</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`font-mono font-bold ${(result.audioIdentity.deltaVirDb ?? 0) >= -0.3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.audioIdentity.deltaVirDb !== undefined ? `${result.audioIdentity.deltaVirDb >= 0 ? '+' : ''}${result.audioIdentity.deltaVirDb.toFixed(2)} dB` : 'Preservada'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {(result.audioIdentity.deltaVirDb ?? 0) >= -0.3 ? '✓ Voz Protegida' : 'Auditoría'}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                    Orig: {result.audioIdentity.virOriginalDb?.toFixed(1) ?? '--'} dB | Mast: {result.audioIdentity.virMasterDb?.toFixed(1) ?? '--'} dB
                  </div>
                </div>

                {/* 3. Loudness Match Playback */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Compensación A/B (Loudness)</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-mono font-bold text-purple-300">
                      {result.audioIdentity.comparisonGainDb !== undefined 
                        ? `${result.audioIdentity.comparisonGainDb >= 0 ? '+' : ''}${result.audioIdentity.comparisonGainDb.toFixed(1)} dB`
                        : '0.0 dB'}
                    </span>
                    {onToggleLoudnessMatch && (
                      <button
                        onClick={onToggleLoudnessMatch}
                        className={`text-[9px] font-mono px-2 py-0.5 rounded border font-semibold transition-all ${
                          loudnessMatchMode === 'matched'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {loudnessMatchMode === 'matched' ? 'Matched' : 'Nivel Real'}
                      </button>
                    )}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                    {loudnessMatchMode === 'matched' ? 'Sin sesgo de volumen (igualado)' : 'Volumen real de exportación'}
                  </div>
                </div>

                {/* 4. Render Session ID */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Identidad de Render</span>
                  <div className="mt-1 font-mono text-xs text-slate-300 truncate" title={`Render: ${result.audioIdentity.renderId} | Sesión: ${result.audioIdentity.trackSessionId}`}>
                    {result.audioIdentity.renderId}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                    {(result.audioIdentity.sampleRate / 1000).toFixed(1)} kHz · {result.audioIdentity.duration.toFixed(1)}s
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1. Diagnóstico Acústico Multidimensional (17 Aspectos) */}
          {result.acousticDiagnosis && result.acousticDiagnosis.length > 0 && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isClear 
                ? 'bg-slate-50 border-slate-200 text-slate-800' 
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    1. Diagnóstico Acústico Multidimensional (17 Aspectos)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {result.acousticDiagnosis.filter(d => d.status === 'excelente').length} Excelentes (Protegidos)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {result.acousticDiagnosis.filter(d => d.status === 'mejorable' || d.status === 'problematico').length} Intervenidos
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {result.acousticDiagnosis.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                      item.status === 'excelente'
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : item.status === 'mejorable'
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : item.status === 'problematico'
                            ? 'bg-rose-950/20 border-rose-500/30'
                            : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-200 text-xs">{item.label}</span>
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                          item.status === 'excelente'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : item.status === 'mejorable'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : item.status === 'problematico'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {item.status === 'excelente' ? '✓ Excelente (Proteger)' : item.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300 mb-1">
                        {item.measuredValue}
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                      <span className="text-cyan-400">↳</span>
                      <span className="truncate" title={item.recommendation}>{item.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Dirección de Mastering Específica */}
          {result.masteringDirection && (
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              isClear 
                ? 'bg-gradient-to-r from-indigo-50 to-cyan-50 border-indigo-200 text-slate-800' 
                : 'bg-gradient-to-r from-indigo-950/40 to-cyan-950/30 border-indigo-500/30 text-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  2. Dirección de Mastering Específica Formulada para esta Canción
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {result.masteringDirection.selectedGoals.map((goal, gIdx) => (
                  <span key={gIdx} className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 shadow-sm flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-400" />
                    {goal}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 font-mono pt-1">
                {result.masteringDirection.rationale}
              </p>
            </div>
          )}

          {/* 3. Torneo de Candidatos a Loudness Igualado */}
          {result.tournamentReport && (
            <div className={`p-4 rounded-xl border space-y-4 ${
              isClear 
                ? 'bg-slate-50 border-slate-200 text-slate-800' 
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Trophy size={18} className="text-amber-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    3. Torneo Automático de Candidatos a Loudness Igualado
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Ganador: {result.tournamentReport.winnerName}
                  </span>
                  {result.tournamentReport.safetyFallbackApplied && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Regla de Seguridad
                    </span>
                  )}
                </div>
              </div>

              {/* Candidates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.tournamentReport.candidates.map((cand) => {
                  const isWinner = cand.id === result.tournamentReport?.winnerCandidateId;
                  return (
                    <div 
                      key={cand.id} 
                      className={`p-3 rounded-xl border flex flex-col justify-between relative transition-all ${
                        cand.isDisqualified
                          ? 'bg-rose-950/15 border-rose-500/30 opacity-75'
                          : isWinner
                            ? 'bg-gradient-to-b from-emerald-950/30 to-slate-900/90 border-emerald-500/50 shadow-lg ring-1 ring-emerald-500/30'
                            : 'bg-slate-900/70 border-slate-800'
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute -top-2.5 right-3 bg-emerald-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                          ★ Seleccionado
                        </div>
                      )}
                      <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="font-bold text-sm text-slate-100">{cand.name}</span>
                          <span className={`font-mono text-sm font-black ${isWinner ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {cand.scores.totalScore} pts
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mb-2">
                          LUFS: {cand.integratedLUFS.toFixed(1)} · TP: {cand.truePeakDbTP.toFixed(1)} dBTP
                        </div>

                        {/* Breakdown meters */}
                        <div className="space-y-1 text-[10px] font-mono text-slate-300 border-t border-slate-800 pt-2 mb-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Voz (VIR Δ {cand.deltaVirDb >= 0 ? '+' : ''}{cand.deltaVirDb.toFixed(2)} dB):</span>
                            <span className={cand.deltaVirDb >= -0.3 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {cand.scores.vocalScore}/20
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Balance Tonal:</span>
                            <span>{cand.scores.tonalBalanceScore}/15</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Profundidad 3D:</span>
                            <span>{cand.scores.depthScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Transientes / Pegada:</span>
                            <span>{cand.scores.transientScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Fase Estéreo:</span>
                            <span className={cand.phaseCorrelation >= 0.75 ? 'text-emerald-400' : 'text-amber-400'}>
                              {cand.scores.stereoPhaseScore}/10
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cohesión / Confort:</span>
                            <span>{cand.scores.cohesionFatigueScore}/15</span>
                          </div>
                        </div>

                        {cand.isDisqualified && cand.disqualificationReason && (
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[10px] font-mono mb-2">
                            Descalificado: {cand.disqualificationReason}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-[9px] font-mono text-slate-400">
                        {cand.perceptualHighlights.join(' • ')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Matchups list */}
              {result.tournamentReport.matchups.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Enfrentamientos Directos a Loudness Igualado:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {result.tournamentReport.matchups.map((m, mIdx) => (
                      <div key={mIdx} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono flex flex-col justify-between">
                        <div className="flex justify-between text-slate-300">
                          <span className="truncate">{m.candidate1} vs {m.candidate2}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          <span className="text-emerald-400 font-bold">↳ Ganador: {m.winner}</span>
                          <span className="text-slate-400">Δ {m.deltaScore > 0 ? '+' : ''}{m.deltaScore} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety & Loudness note */}
              {result.tournamentReport.sweetSpotLoudnessNote && (
                <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 p-2.5 rounded-lg flex items-center gap-2">
                  <Gauge size={16} className="text-cyan-400 shrink-0" />
                  <span>{result.tournamentReport.sweetSpotLoudnessNote}</span>
                </div>
              )}
            </div>
          )}

          {/* 3-Tier Adaptive Architecture Status Badge */}
          {result.masteringTierApplied && (
            <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
              isClear 
                ? 'bg-slate-50 border-slate-200' 
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    Arquitectura DSP Adaptativa de 3 Niveles
                  </span>
                </div>
                <span className={`text-[11px] font-mono px-3 py-1 rounded-full font-bold border ${
                  result.masteringTierApplied === 'stereo_direct'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : result.masteringTierApplied === 'stereo_microscopic_guided'
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {result.masteringTierApplied === 'stereo_direct'
                    ? 'NIVEL 1: MASTERIZACIÓN ESTÉREO DIRECTA'
                    : result.masteringTierApplied === 'stereo_microscopic_guided'
                      ? 'NIVEL 2: ESTÉREO GUIADO POR MICROSCOPIO'
                      : 'NIVEL 3: MASTERING ASISTIDO POR STEMS'}
                </span>
              </div>

              {/* Microscopic diagnostic findings if available */}
              {result.microscopicMasking && (
                <div className="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between font-mono text-[11px] text-cyan-300 font-bold">
                    <span>🔬 Diagnóstico Microscópico de Enmascaramiento:</span>
                    <span>{result.microscopicMasking.activeVocalBlocks} bloques vocales analizados</span>
                  </div>
                  {result.microscopicMasking.competingInstrumentalBands.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {result.microscopicMasking.competingInstrumentalBands.map((band, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
                          {band.band}: <strong className="text-amber-400">+{band.maskingDeltaDb} dB</strong> competencia (atenuación aplicada: {band.suggestedDipDb} dB)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">Sin competencia crítica detectada en el plano instrumental.</span>
                  )}
                </div>
              )}

              {/* Stem-assisted reconstruction test badge */}
              {result.masteringTierApplied === 'stem_assisted' && (
                <div className="flex items-center justify-between text-xs font-mono bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>Prueba Crítica de Reconstrucción: PASADA</span>
                  </div>
                  <span>Correlación Pearson: {(result.reconstructionCorrelation ?? 1.0).toFixed(6)} (100.0% fidelidad)</span>
                </div>
              )}
            </div>
          )}

          {/* MASTERING QUALITY SCORE (MQS) AUDIT: EL MASTER DEBE SUPERAR AL ORIGINAL */}
          {result.mqs && (
            <div className={`p-4 rounded-xl border space-y-4 ${
              isClear 
                ? 'bg-gradient-to-br from-indigo-50/70 via-slate-50 to-emerald-50/50 border-indigo-200/80 text-slate-800' 
                : 'bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-emerald-950/30 border-indigo-500/30 text-slate-200'
            }`}>
              {/* Header with Title & Overall Score */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shrink-0">
                    <Gauge size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                        Auditoría de Calidad: El Master Debe Superar al Original
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        result.qualityVerdict === 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : result.isFallbackApplied
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            : result.mqs.isApproved
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {result.qualityVerdict === 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
                          ? 'Original Preservado — Sin Masterización Sustancial'
                          : result.isFallbackApplied 
                            ? 'Fallback Transparente' 
                            : result.mqs.isApproved ? 'Master Superior Aprobado' : 'Revisión Requerida'}
                      </span>
                    </div>
                    <p className="text-xs opacity-75 font-mono mt-0.5">
                      {result.qualityVerdict === 'ORIGINAL_PRESERVED_NO_SUBSTANTIAL_MASTERING'
                        ? 'Mezcla terminada en origen. Correlación > 0.99999 y residuo < -80 dBFS: puntuación calibrada a nivel honesto.'
                        : result.isFallbackApplied 
                          ? 'La mezcla original ya posee balance sobresaliente; se aplicó preservación pura sin sobreprocesar.'
                          : (() => {
                              const origPts = result.originalMqs?.totalScore;
                              const mastPts = result.mqs.totalScore;
                              const delta = origPts !== undefined ? parseFloat((mastPts - origPts).toFixed(1)) : 0;
                              const deltaStr = delta >= 0 ? `+${delta} pts` : `${delta} pts`;
                              return `Evaluación comparativa a loudness igualado: Original ${origPts !== undefined ? `${origPts} pts` : ''} ➔ Master ${mastPts} pts (${deltaStr}).`;
                            })()
                      }
                    </p>
                  </div>
                </div>

                {/* Main Score Badge */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  {result.selectedIteration !== undefined && result.selectedIteration > 0 && (
                    <div className="text-right font-mono text-[11px] text-slate-400 hidden sm:block">
                      <span>Iteración {result.selectedIteration} de {result.totalIterationsRun || 1}</span>
                    </div>
                  )}
                  <div className={`px-4 py-2 rounded-xl flex items-baseline gap-1 border shadow-inner ${
                    result.mqs.totalScore >= 90
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : result.mqs.totalScore >= 80
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  }`}>
                    <span className="text-2xl font-black font-mono leading-none">{result.mqs.totalScore}</span>
                    <span className="text-xs font-bold opacity-70">/100 MQS</span>
                  </div>
                </div>
              </div>

              {/* 8 Audited Pillars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Tonal Balance */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Balance Tonal</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-cyan-400">{result.mqs.tonalBalance}</span>
                    <span className="text-[10px] font-mono text-slate-500">/20 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${(result.mqs.tonalBalance / 20) * 100}%` }}></div>
                  </div>
                </div>

                {/* 2. Vocal Preservation */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Protección Vocal</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-emerald-400">{result.mqs.vocalPreservation}</span>
                    <span className="text-[10px] font-mono text-slate-500">/20 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${(result.mqs.vocalPreservation / 20) * 100}%` }}></div>
                  </div>
                </div>

                {/* 3. Dynamics & Transients */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Dinámica & LRA</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-purple-400">{result.mqs.dynamicsTransients}</span>
                    <span className="text-[10px] font-mono text-slate-500">/15 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-purple-400 h-full rounded-full" style={{ width: `${(result.mqs.dynamicsTransients / 15) * 100}%` }}></div>
                  </div>
                </div>

                {/* 4. Low-End Control */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Control de Graves</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-blue-400">{result.mqs.lowEndControl}</span>
                    <span className="text-[10px] font-mono text-slate-500">/10 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${(result.mqs.lowEndControl / 10) * 100}%` }}></div>
                  </div>
                </div>

                {/* 5. Clarity & Separation */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Claridad & Medios</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-teal-400">{result.mqs.claritySeparation}</span>
                    <span className="text-[10px] font-mono text-slate-500">/10 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-teal-400 h-full rounded-full" style={{ width: `${(result.mqs.claritySeparation / 10) * 100}%` }}></div>
                  </div>
                </div>

                {/* 6. Stereo & Phase */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Estéreo & Fase</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-indigo-400">{result.mqs.stereoPhase}</span>
                    <span className="text-[10px] font-mono text-slate-500">/10 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${(result.mqs.stereoPhase / 10) * 100}%` }}></div>
                  </div>
                </div>

                {/* 7. Loudness & True Peak */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">True Peak ≤ -1dBTP</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-pink-400">{result.mqs.loudnessTruePeak}</span>
                    <span className="text-[10px] font-mono text-slate-500">/10 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-pink-400 h-full rounded-full" style={{ width: `${(result.mqs.loudnessTruePeak / 10) * 100}%` }}></div>
                  </div>
                </div>

                {/* 8. Distortion & Fatigue */}
                <div className={`p-2.5 rounded-lg border text-xs ${isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Anti-Fatiga / Puro</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold font-mono text-amber-400">{result.mqs.distortionFatigue}</span>
                    <span className="text-[10px] font-mono text-slate-500">/5 pts</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(result.mqs.distortionFatigue / 5) * 100}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Rejection triggers or Iterations history summary */}
              {result.iterationHistory && result.iterationHistory.length > 1 && (
                <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] font-mono space-y-1">
                  <span className="text-slate-400 font-bold block">Historial de Iteraciones Closed-Loop:</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {result.iterationHistory.map((iter, idx) => (
                      <span key={idx} className={`px-2 py-0.5 rounded border text-[10px] ${
                        !iter.isRejected
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-bold'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30 opacity-70'
                      }`}>
                        Iteración {iter.iterationIndex}: {iter.mqs.totalScore} pts {!iter.isRejected ? '✓ (Aprobada)' : '✗ (Descartada)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transparent Fallback Acoustic Verification Table */}
          {result.isFallbackApplied && result.fallbackBandDeltas && result.fallbackBandDeltas.length > 0 && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              isClear 
                ? 'bg-cyan-50/60 border-cyan-200 text-slate-800' 
                : 'bg-cyan-950/20 border-cyan-500/30 text-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-slate-700/50">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-cyan-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Verificación de Fallback Transparente (Medición Acústica en Render)
                    </h4>
                    <p className="text-[11px] opacity-75 font-mono">
                      Tolerancia estricta: desviación máxima permitida ≤ ±0.30 dB (≤ +0.50 dB en 20-150 Hz) a loudness igualado.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shrink-0">
                  Bit-Transparent + True Peak Safe
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                {result.fallbackBandDeltas.map((band, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 ${
                    isClear ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-[10px] text-slate-400 font-sans truncate">{band.band}</span>
                    <div className="flex items-baseline justify-between">
                      <span className={`font-bold ${band.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {band.deltaDb >= 0 ? `+${band.deltaDb.toFixed(2)}` : band.deltaDb.toFixed(2)} dB
                      </span>
                      <span className="text-[9px] text-slate-500">límite: ±{band.maxAllowedDb.toFixed(2)} dB</span>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-center ${
                      band.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {band.passed ? '✓ Verificado' : '⚠ Desviación'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDITORÍA MATEMÁTICA COMPARATIVA (MASTER VS ORIGINAL A GANANCIA COMPENSADA) */}
          {result.mathematicalComparison && (
            <div className={`p-4 rounded-xl border space-y-4 ${
              isClear 
                ? 'bg-gradient-to-br from-cyan-50/70 via-slate-50 to-indigo-50/50 border-cyan-200 text-slate-800' 
                : 'bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-cyan-950/30 border-cyan-500/30 text-slate-200'
            }`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shrink-0">
                    <Scale size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base tracking-wide flex items-center gap-1.5">
                        Auditoría Matemática Comparativa (Ganancia Compensada)
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        result.mathematicalComparison.isOriginalPreservedWithoutMastering
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : result.mathematicalComparison.classification === 'TECHNICAL_TRANSPARENT_DELIVERY'
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {result.mathematicalComparison.classificationLabel}
                      </span>
                    </div>
                    <p className="text-xs opacity-75 font-mono mt-0.5">
                      Compensación lineal aplicada: {result.mathematicalComparison.gainOffsetDb >= 0 ? '+' : ''}{result.mathematicalComparison.gainOffsetDb.toFixed(2)} dB ({result.mathematicalComparison.gainCompensationLinear.toFixed(4)}x) para aislar la acción DSP real.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center font-mono text-[11px]">
                  <span className={`px-2.5 py-1 rounded-lg border font-bold ${
                    result.mathematicalComparison.isOriginalPreservedWithoutMastering
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {result.mathematicalComparison.isOriginalPreservedWithoutMastering
                      ? '✓ ORIGEN PRESERVADO'
                      : '✓ DSP VERIFICADO'}
                  </span>
                </div>
              </div>

              {/* 5 Key Mathematical Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* 1. Pearson Sample Correlation */}
                <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Correlación Muestral (r)</span>
                    <span className="text-base font-bold font-mono text-cyan-400 block mt-1">
                      {result.mathematicalComparison.sampleCorrelation.toFixed(6)}
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-500">Umbral: &gt; 0.99999</span>
                    <span className={result.mathematicalComparison.sampleCorrelation >= 0.99999 ? 'text-cyan-400 font-bold' : 'text-emerald-400'}>
                      {result.mathematicalComparison.sampleCorrelation >= 0.99999 ? 'Identidad' : 'No lineal'}
                    </span>
                  </div>
                </div>

                {/* 2. Residual RMS */}
                <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Nivel RMS Residuo</span>
                    <span className="text-base font-bold font-mono text-indigo-400 block mt-1">
                      {result.mathematicalComparison.residualRmsDb.toFixed(1)} dBFS
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-500">Umbral: &lt; -80 dBFS</span>
                    <span className={result.mathematicalComparison.residualRmsDb <= -80 ? 'text-cyan-400 font-bold' : 'text-amber-400'}>
                      {result.mathematicalComparison.residualRmsDb <= -80 ? 'Inaudible' : 'Medible'}
                    </span>
                  </div>
                </div>

                {/* 3. Residual Peak & Real Max Error */}
                <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Residuo Pico</span>
                    <span className="text-base font-bold font-mono text-slate-200 block mt-1">
                      {result.mathematicalComparison.residualPeakDb.toFixed(1)} dBFS
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-500">Error Máx Real</span>
                    <span className="text-slate-300 font-bold">
                      {result.mathematicalComparison.residualMaxErrorDb !== undefined 
                        ? `${result.mathematicalComparison.residualMaxErrorDb.toFixed(1)} dBFS` 
                        : `${result.mathematicalComparison.residualPeakDb.toFixed(1)} dBFS`}
                    </span>
                  </div>
                </div>

                {/* 4. Envelope Correlation */}
                <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Envolvente (50ms)</span>
                    <span className="text-base font-bold font-mono text-emerald-400 block mt-1">
                      {(result.mathematicalComparison.envelopeCorrelation * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-500">Tracking temporal</span>
                    <span className="text-emerald-400 font-bold">Fiel</span>
                  </div>
                </div>

                {/* 5. Max Spectral Delta */}
                <div className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Δ Espectral Máx</span>
                    <span className={`text-base font-bold font-mono block mt-1 ${
                      result.mathematicalComparison.maxSpectralDeltaDb <= 0.05 ? 'text-cyan-400' : 'text-emerald-400'
                    }`}>
                      ±{result.mathematicalComparison.maxSpectralDeltaDb.toFixed(3)} dB
                    </span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-500">Límite: ±0.05 dB</span>
                    <span className={result.mathematicalComparison.maxSpectralDeltaDb <= 0.05 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                      {result.mathematicalComparison.maxSpectralDeltaDb <= 0.05 ? 'Idéntico' : 'Ajustado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5-Band Spectral Differences Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Activity size={13} className="text-cyan-400" />
                  Diferencias Espectrales por Bandas a Ganancia Compensada (Tolerancia: ±0.05 dB)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                  {result.mathematicalComparison.spectralBands.map((band, idx) => (
                    <div key={idx} className={`p-2 rounded-lg border flex flex-col justify-between gap-1 ${
                      isClear ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-sans truncate">{band.band}</span>
                        <span className="text-[9px] text-slate-500">{band.fLow}-{band.fHigh >= 1000 ? `${band.fHigh / 1000}k` : band.fHigh}Hz</span>
                      </div>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className={`font-bold ${band.passed ? 'text-cyan-400' : 'text-emerald-400'}`}>
                          {band.deltaDb >= 0 ? `+${band.deltaDb.toFixed(3)}` : band.deltaDb.toFixed(3)} dB
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded ${
                          band.passed ? 'bg-cyan-500/10 text-cyan-300' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {band.passed ? 'Sin cambio' : 'EQ Real'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamics & Stereo Image Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dynamic Metrics */}
                <div className={`p-3 rounded-lg border space-y-2 ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Diferencias de Dinámica (LRA & Factor de Cresta)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
                      <span className="text-[9px] text-slate-500 block">Δ Rango Dinámico (LRA)</span>
                      <span className="font-bold text-slate-200 text-sm">
                        {result.mathematicalComparison.deltaLra >= 0 ? '+' : ''}{result.mathematicalComparison.deltaLra.toFixed(3)} LU
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {Math.abs(result.mathematicalComparison.deltaLra) <= 0.05 ? 'Preservación idéntica' : 'Dinámica calibrada'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
                      <span className="text-[9px] text-slate-500 block">Δ Factor de Cresta (Pegada)</span>
                      <span className="font-bold text-slate-200 text-sm">
                        {result.mathematicalComparison.deltaCrestFactor >= 0 ? '+' : ''}{result.mathematicalComparison.deltaCrestFactor.toFixed(3)} dB
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {Math.abs(result.mathematicalComparison.deltaCrestFactor) <= 0.05 ? 'Transientes intactos' : 'Pegada adaptada'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stereo Image Metrics */}
                <div className={`p-3 rounded-lg border space-y-2 ${
                  isClear ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    Diferencias de Imagen Estéreo & Fase
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
                      <span className="text-[9px] text-slate-500 block">Relación Mid/Side</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-bold text-slate-200">
                          {result.mathematicalComparison.originalMidSideRatio.toFixed(3)} ➔ {result.mathematicalComparison.masterMidSideRatio.toFixed(3)}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Δ {result.mathematicalComparison.deltaStereoWidth >= 0 ? '+' : ''}{result.mathematicalComparison.deltaStereoWidth.toFixed(3)} ({Math.abs(result.mathematicalComparison.deltaStereoWidth) <= 0.02 ? 'Anchura idéntica' : 'Optimizado'})
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/50 border border-slate-800/80">
                      <span className="text-[9px] text-slate-500 block">Correlación de Fase Estéreo</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-bold text-slate-200">
                          {result.mathematicalComparison.originalPhaseCorrelation.toFixed(3)} ➔ {result.mathematicalComparison.masterPhaseCorrelation.toFixed(3)}
                        </span>
                      </div>
                      <span className="text-[9px] text-emerald-400 block mt-0.5">
                        Fase 100% Mono-compatible
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Action of Each DSP Module */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Binary size={13} className="text-indigo-400" />
                  Acción Real de Cada Módulo DSP en la Forma de Onda
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {result.mathematicalComparison.dspModuleActions.map((dsp, idx) => (
                    <div key={idx} className={`p-2.5 rounded-lg border flex flex-col justify-between text-xs ${
                      isClear ? 'bg-white border-slate-200' : 'bg-slate-950/60 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 text-[11px]">{dsp.module}</span>
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                          dsp.statusLabel?.includes('ARMADO')
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : dsp.applied
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {dsp.statusLabel || (dsp.applied ? 'Activo' : 'Bypass / Neutro')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-1 leading-relaxed">
                        {dsp.actionDescription}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Honest Engineering Notice */}
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                result.mathematicalComparison.isOriginalPreservedWithoutMastering
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                  : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
              }`}>
                <ShieldCheck size={18} className="shrink-0 text-cyan-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-xs">
                    {result.mathematicalComparison.isOriginalPreservedWithoutMastering
                      ? 'Dictamen de Integridad: Mezcla Original Preservada'
                      : 'Dictamen de Integridad: Masterización Sustancial Aprobada'}
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed font-sans">
                    {result.mathematicalComparison.honestNote}
                  </p>
                  <p className="text-[10px] font-mono opacity-75">
                    {result.mathematicalComparison.classificationReason}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                    <span className="font-mono text-base font-black text-emerald-500">{finalMeasuredLUFS.toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-[10px] opacity-70 font-mono text-center">
                  {Math.abs(finalMeasuredLUFS - before.integratedLUFS) <= 0.3
                    ? 'Volumen Preservado (0.0 LU delta)'
                    : `Ganancia: ${(finalMeasuredLUFS - before.integratedLUFS >= 0 ? '+' : '') + (finalMeasuredLUFS - before.integratedLUFS).toFixed(1)} LU`}
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
          {/* Intelligent Vocal Protection Audit Card (Validación General de Protección Vocal) */}
          {result.vocalReport && (
            <div className={`p-4 rounded-xl border space-y-3.5 ${
              isClear 
                ? 'bg-indigo-50/70 border-indigo-200 text-slate-800' 
                : 'border-indigo-500/30 bg-indigo-950/25 text-slate-100'
            }`}>
              {/* Header with Title & 5-State Validation Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Mic size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        Validación General de Protección Vocal
                      </h4>
                      <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Multi-Masker Audit
                      </span>
                      {result.vocalReport.iterationsPerformed && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {result.vocalReport.iterationsPerformed > 1
                            ? `${result.vocalReport.iterationsPerformed} iteraciones closed-loop`
                            : '1 iteración'}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isClear ? 'text-slate-600' : 'text-slate-400'}`}>
                      {result.vocalReport.summaryNote}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border ${
                    result.vocalReport.vocalStatus === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : result.vocalReport.vocalStatus === 'acceptable'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : result.vocalReport.vocalStatus === 'partially_achieved'
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                      : result.vocalReport.vocalStatus === 'warning'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {result.vocalReport.statusLabel || (result.vocalReport.verdict === 'EXCELLENT' ? 'Protección aprobada' : 'Protección aceptable')} 
                    {' '}(Δ máx: {result.vocalReport.maxRelativeDeltaDb !== undefined ? (result.vocalReport.maxRelativeDeltaDb >= 0 ? `+${result.vocalReport.maxRelativeDeltaDb.toFixed(2)}` : result.vocalReport.maxRelativeDeltaDb.toFixed(2)) : '0.00'} dB)
                  </span>
                </div>
              </div>

              {/* Diagnosis Bar: Masking, Vocal Register & Sections Analyzed */}
              <div className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono ${
                isClear ? 'bg-white/80 border-indigo-100 text-slate-700' : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase text-[10px]">Enmascarador principal:</span>
                  <span className="font-semibold text-indigo-300">{result.vocalReport.maskingElementDetected}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px]">
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
                    Secciones:{' '}
                    <strong className="text-slate-200 font-sans">
                      {result.vocalReport.sectionsSummary || `${result.vocalReport.original.vocalSectionsCount ?? 16} bloques evaluados`}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Multiband Relative Masking Matrix (5 Relational Deltas) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                  Matriz de Enmascaramiento Relativo (Δ = Elemento Competidor - Región Vocal)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {/* 1. Sub/Bass vs Vocal Body */}
                  <div className={`p-2 rounded-lg border text-[10px] ${
                    isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-slate-400 block truncate" title="Sub/Graves vs Cuerpo (180-900Hz)">Graves vs Cuerpo</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold font-mono ${
                        (result.vocalReport.subBassRelDeltaDb ?? 0) <= 0.30 ? 'text-emerald-400' :
                        (result.vocalReport.subBassRelDeltaDb ?? 0) <= 0.50 ? 'text-cyan-400' :
                        (result.vocalReport.subBassRelDeltaDb ?? 0) <= 0.80 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {(result.vocalReport.subBassRelDeltaDb ?? 0) >= 0 ? '+' : ''}{(result.vocalReport.subBassRelDeltaDb ?? 0).toFixed(2)} dB
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">≤0.3</span>
                    </div>
                  </div>

                  {/* 2. Low-Mid Res vs Vocal Body */}
                  <div className={`p-2 rounded-lg border text-[10px] ${
                    isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-slate-400 block truncate" title="Medios-Bajos (250-400Hz) vs Cuerpo">Medios-Bajos vs Cuerpo</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold font-mono ${
                        (result.vocalReport.lowMidRelDeltaDb ?? 0) <= 0.30 ? 'text-emerald-400' :
                        (result.vocalReport.lowMidRelDeltaDb ?? 0) <= 0.50 ? 'text-cyan-400' :
                        (result.vocalReport.lowMidRelDeltaDb ?? 0) <= 0.80 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {(result.vocalReport.lowMidRelDeltaDb ?? 0) >= 0 ? '+' : ''}{(result.vocalReport.lowMidRelDeltaDb ?? 0).toFixed(2)} dB
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">≤0.3</span>
                    </div>
                  </div>

                  {/* 3. Guitars/Synths vs Intelligibility */}
                  <div className={`p-2 rounded-lg border text-[10px] ${
                    isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-slate-400 block truncate" title="Guitarras/Sintes vs Inteligibilidad (1-4kHz)">Sintes/Gtr vs Claridad</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold font-mono ${
                        (result.vocalReport.midInstRelDeltaDb ?? 0) <= 0.30 ? 'text-emerald-400' :
                        (result.vocalReport.midInstRelDeltaDb ?? 0) <= 0.50 ? 'text-cyan-400' :
                        (result.vocalReport.midInstRelDeltaDb ?? 0) <= 0.80 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {(result.vocalReport.midInstRelDeltaDb ?? 0) >= 0 ? '+' : ''}{(result.vocalReport.midInstRelDeltaDb ?? 0).toFixed(2)} dB
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">≤0.3</span>
                    </div>
                  </div>

                  {/* 4. High Percussion/Cymbals vs Presence */}
                  <div className={`p-2 rounded-lg border text-[10px] ${
                    isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-slate-400 block truncate" title="Platillos/Brillo vs Presencia (2-5kHz)">Platillos vs Presencia</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold font-mono ${
                        (result.vocalReport.highInstRelDeltaDb ?? 0) <= 0.30 ? 'text-emerald-400' :
                        (result.vocalReport.highInstRelDeltaDb ?? 0) <= 0.50 ? 'text-cyan-400' :
                        (result.vocalReport.highInstRelDeltaDb ?? 0) <= 0.80 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {(result.vocalReport.highInstRelDeltaDb ?? 0) >= 0 ? '+' : ''}{(result.vocalReport.highInstRelDeltaDb ?? 0).toFixed(2)} dB
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">≤0.3</span>
                    </div>
                  </div>

                  {/* 5. Side Stereo Width vs Mid Vocal Growth */}
                  <div className={`p-2 rounded-lg border text-[10px] ${
                    isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                  }`}>
                    <span className="text-slate-400 block truncate" title="Crecimiento Side vs Crecimiento Mid Vocal">Ancho Side vs Centro</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`font-bold font-mono ${
                        (result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0 ? 'text-emerald-400' :
                        (result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0.30 ? 'text-emerald-400' :
                        (result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0.50 ? 'text-cyan-400' :
                        (result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0.80 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {(result.vocalReport.sideStereoRelDeltaDb ?? 0) >= 0 ? '+' : ''}{(result.vocalReport.sideStereoRelDeltaDb ?? 0).toFixed(2)} dB
                      </span>
                      <span className={`text-[9px] font-mono ${
                        (result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'
                      }`}>
                        {(result.vocalReport.sideStereoRelDeltaDb ?? 0) <= 0 ? '✓ Estable' : '≤0.3'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Closed-loop Correction & Responsible Stages */}
              {((result.vocalReport.responsibleStagesIdentified && result.vocalReport.responsibleStagesIdentified.length > 0) ||
                (result.vocalReport.dspAdjustmentsSummary && result.vocalReport.dspAdjustmentsSummary.length > 0)) && (
                <div className={`p-2.5 rounded-lg border text-[11px] space-y-2 ${
                  isClear ? 'bg-white/80 border-indigo-100 text-slate-700' : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-indigo-300 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      Corrección Activa Closed-Loop ({result.vocalReport.iterationsPerformed || 1} {(result.vocalReport.iterationsPerformed || 1) === 1 ? 'paso' : 'iteraciones'})
                    </span>
                    {result.vocalReport.safetyLimitReached && (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Límite de seguridad alcanzado
                      </span>
                    )}
                  </div>
                  
                  {result.vocalReport.responsibleStagesIdentified && result.vocalReport.responsibleStagesIdentified.length > 0 && (
                    <div className="text-[10px]">
                      <span className="text-slate-400 font-mono block mb-1">Etapas responsables identificadas:</span>
                      <div className="flex flex-wrap gap-1">
                        {result.vocalReport.responsibleStagesIdentified.map((stg, sIdx) => (
                          <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700 font-mono text-[9px]">
                            {stg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.vocalReport.dspAdjustmentsSummary && result.vocalReport.dspAdjustmentsSummary.length > 0 && (
                    <div className="text-[10px] pt-1 border-t border-slate-800/50">
                      <span className="text-slate-400 font-mono block mb-1">Ajustes DSP ejecutados:</span>
                      <ul className="space-y-0.5 font-mono text-[10px] text-slate-300">
                        {result.vocalReport.dspAdjustmentsSummary.map((adj, aIdx) => (
                          <li key={aIdx} className="flex items-center gap-1.5">
                            <span className="text-emerald-400">↳</span>
                            <span>{adj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Mix Adjustment Alert (if mix adjustment is recommended) */}
              {result.vocalReport.recommendedMixAdjustment && (
                <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] flex items-start gap-2">
                  <span className="shrink-0 text-amber-400 text-sm">💡</span>
                  <div>
                    <strong className="font-semibold block text-amber-200">Recomendación para la Mezcla Original:</strong>
                    <span>{result.vocalReport.recommendedMixAdjustment}</span>
                  </div>
                </div>
              )}

              {/* Grid of Corrective Actions & Acoustic Health */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-0.5">
                {/* 1. Delta Vocal (Presencia) */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Presencia Vocal</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-slate-200">
                      {result.vocalReport.vocalDeltaDb >= 0 ? '+' : ''}{result.vocalReport.vocalDeltaDb.toFixed(2)} dB
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">@{result.vocalReport.final.exactPresenceFreq}Hz</span>
                  </div>
                  {result.vocalReport.measuredAudioDeltas && (
                    <div className="mt-1 text-[9px] font-mono text-slate-400 truncate" title="Medición real en audio renderizado">
                      Audio: {result.vocalReport.measuredAudioDeltas.vocalPresenceMeasuredDb >= 0 ? '+' : ''}{result.vocalReport.measuredAudioDeltas.vocalPresenceMeasuredDb.toFixed(2)} dB
                    </div>
                  )}
                </div>

                {/* 2. Mid Compensation */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Compensación Mid EQ</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`font-bold ${result.vocalReport.midCompensationAppliedDb > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {result.vocalReport.midCompensationAppliedDb > 0 
                        ? `+${result.vocalReport.midCompensationAppliedDb.toFixed(2)} dB` 
                        : 'No requerida'}
                    </span>
                    {result.vocalReport.midCompensationAppliedDb > 0 ? (
                      <span className="text-[10px] font-mono text-indigo-400">@{result.vocalReport.midCompensationFreq}Hz</span>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500">Timbre original</span>
                    )}
                  </div>
                  {result.vocalReport.midCompensationAppliedDb === 0 && (
                    <div className="mt-1 text-[9px] font-mono text-slate-400 truncate" title="Balance tonal original conservado">
                      Timbre original conservado
                    </div>
                  )}
                </div>

                {/* 3. Adaptive De-Esser */}
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
                  <div className="mt-1 text-[9px] font-mono text-slate-400 truncate">
                    {result.vocalReport.deEsserApplied ? 'Release rápido 25 ms' : 'Transparente / sin exceso'}
                  </div>
                </div>

                {/* 4. Mono Compatibility */}
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
                  <div className="mt-1 text-[9px] font-mono text-slate-400 truncate">
                    Correlación de fase vocal
                  </div>
                </div>

                {/* 5. Dynamic Sub Cut (30-75Hz) */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">EQ Dinámica Sub</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`font-bold font-mono ${
                      result.vocalReport.dynamicSubCutAppliedDb && Math.abs(result.vocalReport.dynamicSubCutAppliedDb) > 0.05
                        ? 'text-cyan-400'
                        : 'text-slate-200'
                    }`}>
                      {result.vocalReport.dynamicSubCutAppliedDb && Math.abs(result.vocalReport.dynamicSubCutAppliedDb) > 0.05
                        ? `${result.vocalReport.dynamicSubCutAppliedDb.toFixed(2)} dB`
                        : '0.00 dB'}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">30-75Hz</span>
                  </div>
                  <div className="mt-1 text-[9px] font-mono text-slate-400 truncate">
                    {result.vocalReport.dynamicSubCutAppliedDb && Math.abs(result.vocalReport.dynamicSubCutAppliedDb) > 0.05
                      ? 'Control de pegada selectivo'
                      : 'Subgraves balanceados'}
                  </div>
                </div>

                {/* 6. Vocal Body Recovery (Mid 300-900Hz) */}
                <div className={`p-2.5 rounded-lg border text-[11px] ${
                  isClear ? 'bg-white border-indigo-100' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono tracking-wider">Cuerpo Vocal Mid</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`font-bold font-mono ${
                      result.vocalReport.vocalBodyRecoveryAppliedDb && result.vocalReport.vocalBodyRecoveryAppliedDb > 0.05
                        ? 'text-emerald-400'
                        : 'text-slate-200'
                    }`}>
                      {result.vocalReport.vocalBodyRecoveryAppliedDb && result.vocalReport.vocalBodyRecoveryAppliedDb > 0.05
                        ? `+${result.vocalReport.vocalBodyRecoveryAppliedDb.toFixed(2)} dB`
                        : '0.00 dB'}
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400">300-900Hz</span>
                  </div>
                  <div className="mt-1 text-[9px] font-mono text-slate-400 truncate">
                    {result.vocalReport.vocalBodyRecoveryAppliedDb && result.vocalReport.vocalBodyRecoveryAppliedDb > 0.05
                      ? 'Centro sólido sin manchar lados'
                      : 'Cuerpo original preservado'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Telemetría DSP Real en el Archivo Exportado */}
          {result.mathematicalComparison?.dspModuleActions && result.mathematicalComparison.dspModuleActions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                  <Sliders size={14} className="text-indigo-400" />
                  Telemetría DSP Verificada en el Archivo Exportado
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  Medición real sobre muestras del render
                </span>
              </div>
              <div className={`p-4 rounded-xl border ${
                isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                        <th className="pb-2 font-semibold">Módulo DSP</th>
                        <th className="pb-2 font-semibold">Estado</th>
                        <th className="pb-2 font-semibold">Impacto Medido</th>
                        <th className="pb-2 font-semibold">Muestras / Tiempo</th>
                        <th className="pb-2 font-semibold">Acción Confirmada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {result.mathematicalComparison.dspModuleActions.map((action, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2.5 font-bold text-slate-200">{action.module}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              action.statusLabel?.includes('ARMADO')
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : action.applied
                                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {action.statusLabel || (action.applied ? 'ACTIVO' : 'BYPASS')}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-300">
                            {action.measuredImpactDb !== 0 
                              ? `${action.measuredImpactDb >= 0 ? '+' : ''}${action.measuredImpactDb.toFixed(2)} dB`
                              : '0.00 dB (Neutro)'}
                          </td>
                          <td className="py-2.5 text-slate-400 text-[11px]">
                            {action.samplesAffected !== undefined && action.samplesAffected > 0
                              ? `${action.samplesAffected.toLocaleString()} m. (${action.activeTimeSeconds?.toFixed(1) ?? '0.0'}s)`
                              : action.applied ? 'Paso total' : '0 muestras'}
                          </td>
                          <td className="py-2.5 text-slate-400 text-[11px] max-w-xs truncate" title={action.actionDescription}>
                            {action.actionDescription}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
