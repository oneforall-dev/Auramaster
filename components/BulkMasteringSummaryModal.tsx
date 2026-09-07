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
  trackMasterMap: Record<string, TrackMasterInfo>;
  onOpenTrackReport: (trackId: string) => void;
  onDownloadSingleTrack: (trackId: string) => void;
  onDownloadAllZip: () => void;
  isExportingZip: boolean;
  skin?: 'modern' | 'clear';
}

export const BulkMasteringSummaryModal: React.FC<BulkMasteringSummaryModalProps> = ({
  isOpen,
  onClose,
  summary,
  trackMasterMap,
  onOpenTrackReport,
  onDownloadSingleTrack,
  onDownloadAllZip,
  isExportingZip,
  skin = 'modern'
}) => {
  if (!isOpen || !summary) return null;

  const isClear = skin === 'clear';

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
                  {summary.completedCount} / {summary.totalTracks} Procesadas
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
                  {summary.masterAvgLUFS.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">LUFS-I</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Original: {summary.originalAvgLUFS.toFixed(1)} LUFS-I
              </span>
            </div>

            {/* 2. Peak Control */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">True Peak Máximo</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-cyan-400">
                  {summary.maxTruePeakDbTP.toFixed(1)}
                </span>
                <span className="text-xs font-mono text-slate-400">dBTP</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">
                ✓ Ceiling ≤ -1.0 dBTP
              </span>
            </div>

            {/* 3. Dynamics Preservation */}
            <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
              isClear ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'
            }`}>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Rango Dinámico (LRA)</span>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-mono font-bold text-indigo-300">
                  {summary.avgLRA.toFixed(1)}
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
                  {summary.vocalApprovedCount + summary.vocalPartialCount}
                </span>
                <span className="text-xs font-mono text-slate-400">validadas</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {summary.instrumentalCount > 0 ? `${summary.instrumentalCount} instrumental(es)` : '0 enmascaramientos'}
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
                    {summary.tracks.map((t, idx) => {
                      const hasResult = Boolean(trackMasterMap[t.trackId]?.result);
                      return (
                        <tr key={t.trackId || idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-sans font-semibold text-slate-200 truncate max-w-[180px]" title={t.trackName}>
                            {t.trackName}
                          </td>
                          <td className="p-3 text-center text-slate-400">
                            {t.originalLUFS !== 0 ? `${t.originalLUFS.toFixed(1)} LUFS` : '—'}
                          </td>
                          <td className="p-3 text-center text-emerald-400 font-bold">
                            {t.masterLUFS !== 0 ? `${t.masterLUFS.toFixed(1)} LUFS` : '—'}
                          </td>
                          <td className="p-3 text-center text-slate-300">
                            {t.truePeakDbTP !== 0 ? `${t.truePeakDbTP.toFixed(1)} dBTP` : '—'}
                          </td>
                          <td className="p-3 text-center text-indigo-300">
                            {t.dynamicRangeLRA !== 0 ? `${t.dynamicRangeLRA.toFixed(1)} LU` : '—'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              t.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : t.vocalStatus === 'Instrumental'
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : t.status === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {t.vocalStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasResult && (
                                <button
                                  onClick={() => onOpenTrackReport(t.trackId)}
                                  className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all text-[10px] font-bold flex items-center gap-1"
                                  title="Ver informe individual detallado"
                                >
                                  <Sparkles size={12} />
                                  <span className="hidden sm:inline">Reporte</span>
                                </button>
                              )}
                              {hasResult && (
                                <button
                                  onClick={() => onDownloadSingleTrack(t.trackId)}
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
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>{summary.completedCount} canciones listas para distribución streaming</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onDownloadAllZip}
              disabled={isExportingZip || summary.completedCount === 0}
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
