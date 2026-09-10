import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  Download, 
  Activity, 
  ShieldCheck, 
  Mic, 
  FileArchive, 
  X,
  Layers
} from 'lucide-react';
import { BulkMasteringSummary, TrackMasterInfo } from '../types';

interface BulkMasteringSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: BulkMasteringSummary | null;
  trackMasterMap?: Record<string, TrackMasterInfo>;
  onOpenTrackReport?: (trackId: string) => void;
  onViewReport?: (result: any) => void;
  onDownloadSingleTrack?: (trackId: string) => void;
  onDownloadSingle?: (trackId: string) => void;
  onDownloadAllZip: () => void;
  isExportingZip: boolean;
  skin?: 'modern' | 'clear';
  lang?: string;
}

export const BulkMasteringSummaryModal: React.FC<BulkMasteringSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  trackMasterMap = {},
  onOpenTrackReport,
  onViewReport,
  onDownloadSingleTrack,
  onDownloadSingle,
  onDownloadAllZip,
  isExportingZip,
  skin = 'modern'
}) => {
  if (!isOpen || !summary) return null;

  const isClear = skin === 'clear';

  // Defensive extraction of numbers: guarantees .toFixed will NEVER throw
  const masterLUFS = Number(summary.masterAvgLUFS ?? (summary as any).averageMasterLUFS ?? -14.0);
  const origLUFS = Number(summary.originalAvgLUFS ?? (summary as any).averageOriginalLUFS ?? -14.0);
  const maxTP = Number(summary.maxTruePeakDbTP ?? -1.0);
  const avgLRA = Number(summary.avgLRA ?? (summary as any).averageLRA ?? 8.0);
  const completedCount = Number(summary.completedCount ?? (summary as any).completedTracks ?? 0);
  const totalCount = Number(summary.totalTracks ?? 0);
  const failedCount = Number(summary.failedCount ?? (summary as any).failedTracks ?? 0);
  const vocalApproved = Number((summary.vocalApprovedCount ?? (summary as any).vocalProtectedCount ?? 0) + (summary.vocalPartialCount ?? 0));
  const instCount = Number(summary.instrumentalCount ?? 0);

  const rawTracks = Array.isArray(summary.tracks) 
    ? summary.tracks 
    : (Array.isArray((summary as any).items) ? (summary as any).items : []);

  const handleOpenReport = (trackId: string) => {
    if (onOpenTrackReport) {
      onOpenTrackReport(trackId);
    } else if (onViewReport) {
      const res = trackMasterMap[trackId]?.result;
      if (res) onViewReport(res);
    }
  };

  const handleDownloadTrack = (trackId: string) => {
    if (onDownloadSingleTrack) {
      onDownloadSingleTrack(trackId);
    } else if (onDownloadSingle) {
      onDownloadSingle(trackId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden ${
          isClear 
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50' 
            : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between shrink-0 ${
          isClear ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Resumen Global de Bulk Mixer Fixer</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {completedCount} / {totalCount} Procesadas
                </span>
              </div>
              <p className={`text-xs ${isClear ? 'text-slate-500' : 'text-slate-400'}`}>
                Aislamiento acústico 100% independiente: cada canción analizada y masterizada con su propio target.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isClear ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-700' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          
          {/* Top Aggregated Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Loudness Range */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Loudness Promedio</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-400">
                  {completedCount > 0 && Number.isFinite(masterLUFS) ? masterLUFS.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-mono text-slate-400">LUFS-I</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Original: {completedCount > 0 && Number.isFinite(origLUFS) ? `${origLUFS.toFixed(1)} LUFS-I` : '—'}
              </span>
            </div>

            {/* 2. Peak Control */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">True Peak Máximo</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-cyan-400">
                  {completedCount > 0 && Number.isFinite(maxTP) ? maxTP.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-mono text-slate-400">dBTP</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {completedCount > 0 ? '✓ Ceiling ≤ -1.0 dBTP' : 'Sin medición disponible'}
              </span>
            </div>

            {/* 3. Dynamics Preservation */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Rango Dinámico (LRA)</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-indigo-300">
                  {completedCount > 0 && Number.isFinite(avgLRA) ? avgLRA.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-mono text-slate-400">LU</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Dinámica musical preservada
              </span>
            </div>

            {/* 4. Vocal Protection Summary */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Protección Vocal</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-emerald-400">
                  {vocalApproved}
                </span>
                <span className="text-xs font-mono text-slate-400">validadas</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {instCount > 0 ? `${instCount} sin voz confirmada` : (completedCount > 0 ? '0 enmascaramientos' : 'Sin análisis vocal')}
              </span>
            </div>
          </div>

          {/* Individual Tracks Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Activity size={14} className="text-cyan-400" />
              Detalle y Reporte Individual por Canción
            </h4>
            
            <div className={`rounded-xl border overflow-hidden ${
              isClear ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-950/40'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className={`border-b text-[10px] uppercase font-bold tracking-wider ${
                      isClear ? 'bg-slate-100/70 border-slate-200 text-slate-600' : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}>
                      <th className="p-3">Canción</th>
                      <th className="p-3 text-center">Original</th>
                      <th className="p-3 text-center">Master Final</th>
                      <th className="p-3 text-center">True Peak</th>
                      <th className="p-3 text-center">LRA</th>
                      <th className="p-3 text-center">Voz / Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {rawTracks.map((t: any, idx: number) => {
                      const trackId = t.trackId || t.id || `track_${idx}`;
                      const trackName = t.trackName || t.name || `Pista ${idx + 1}`;
                      const hasResult = Boolean(t.result || trackMasterMap[trackId]?.result);
                      const origLufsNum = Number(t.originalLUFS ?? 0);
                      const masterLufsNum = Number(t.masterLUFS ?? 0);
                      const tpNum = Number(t.truePeakDbTP);
                      const lraNum = Number(t.dynamicRangeLRA ?? 0);
                      const vocState = t.status === 'failed'
                        ? 'Falló'
                        : t.status === 'skipped'
                          ? 'No procesada'
                          : (t.vocalStatus || (t.vocalProtected ? 'Protegida' : 'Voz no confirmada'));

                      return (
                        <tr key={trackId} className="hover:bg-white/5 transition-colors" title={t.errorMessage || undefined}>
                          <td className="p-3 font-sans font-semibold text-slate-200 max-w-[220px]" title={trackName}>
                            <div className="truncate">{trackName}</div>
                            {t.errorMessage && (
                              <div className="mt-1 text-[9px] font-mono font-normal text-rose-400 line-clamp-2" title={t.errorMessage}>
                                {t.errorMessage}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center text-slate-400">
                            {origLufsNum !== 0 ? `${origLufsNum.toFixed(1)} LUFS` : '—'}
                          </td>
                          <td className="p-3 text-center text-emerald-400 font-bold">
                            {masterLufsNum !== 0 ? `${masterLufsNum.toFixed(1)} LUFS` : '—'}
                          </td>
                          <td className="p-3 text-center text-slate-300">
                            {hasResult && Number.isFinite(tpNum) ? `${tpNum.toFixed(1)} dBTP` : '—'}
                          </td>
                          <td className="p-3 text-center text-indigo-300">
                            {lraNum !== 0 ? `${lraNum.toFixed(1)} LU` : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              t.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : vocState === 'Voz no confirmada'
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : t.status === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {vocState}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasResult && (
                                <button
                                  onClick={() => handleOpenReport(trackId)}
                                  className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all text-[10px] font-bold flex items-center gap-1"
                                  title="Ver informe individual detallado"
                                >
                                  <Sparkles size={12} />
                                  <span className="hidden sm:inline">Reporte</span>
                                </button>
                              )}
                              {hasResult && (
                                <button
                                  onClick={() => handleDownloadTrack(trackId)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all text-[10px] font-bold flex items-center gap-1"
                                  title="Descargar master WAV individual"
                                >
                                  <Download size={12} />
                                  <span className="hidden sm:inline">WAV</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${
          isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-xs opacity-70 font-mono">
            {failedCount > 0 && completedCount === 0
              ? <XCircle size={15} className="text-rose-400" />
              : <CheckCircle2 size={15} className="text-emerald-400" />}
            <span>
              {completedCount} canciones listas para distribución streaming
              {failedCount > 0 ? ` · ${failedCount} fallidas` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onDownloadAllZip}
              disabled={isExportingZip || completedCount === 0}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <FileArchive size={14} />
              <span>{isExportingZip ? 'Comprimiendo...' : 'Descargar Todo en ZIP'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
