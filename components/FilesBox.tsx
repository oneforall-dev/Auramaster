import React, { useState } from 'react';
import { 
  FolderOpen, 
  Layers, 
  Sparkles, 
  Download, 
  Trash2, 
  CheckCircle2, 
  UploadCloud, 
  Plus, 
  Loader2, 
  Archive, 
  FileAudio,
  Play,
  RotateCw
} from 'lucide-react';
import { Track, SkinMode, ProcessingMode, TrackMasterInfo, AIMasteringResult } from '../types';
import { MixerChannel } from './MixerChannel';
import { Language, getT } from '../services/i18n';

interface FilesBoxProps {
  tracks: Track[];
  activeTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onRemoveTrack: (id: string) => void;
  onTrackChange: (id: string, updates: Partial<Track>) => void;
  processingMode: ProcessingMode;
  onModeChange: (mode: ProcessingMode) => void;
  onImportClick: () => void;
  trackMasterMap: Record<string, TrackMasterInfo>;
  onMasterSingleTrack: (track: Track) => Promise<void>;
  onMasterAllTracks: () => Promise<void>;
  onDownloadSingleTrack: (track: Track) => Promise<void>;
  onDownloadAllMasteredZip: () => Promise<void>;
  onViewReport: (result: AIMasteringResult) => void;
  isBulkMastering: boolean;
  bulkProgress: { current: number; total: number; trackName: string } | null;
  isExportingZip: boolean;
  skin?: SkinMode;
  lang?: Language;
}

export const FilesBox: React.FC<FilesBoxProps> = ({
  tracks,
  activeTrackId,
  onSelectTrack,
  onRemoveTrack,
  onTrackChange,
  processingMode,
  onModeChange,
  onImportClick,
  trackMasterMap,
  onMasterSingleTrack,
  onMasterAllTracks,
  onDownloadSingleTrack,
  onDownloadAllMasteredZip,
  onViewReport,
  isBulkMastering,
  bulkProgress,
  isExportingZip,
  skin = 'modern',
  lang = 'es'
}) => {
  const t = getT(lang);
  const isClear = skin === 'clear';
  const isStems = processingMode === 'stems';

  const masteredCount = tracks.filter(t => trackMasterMap[t.id]?.isMastered).length;

  return (
    <div className="flex flex-col gap-3 p-4 flex-1 h-full min-h-0 overflow-hidden rounded-2xl transition-all bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-2xl text-slate-200">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 text-slate-300">
            <FolderOpen size={14} className="text-cyan-400" />
            <span>{t.filesListTitle} ({tracks.length})</span>
          </h3>

          {/* Mode Segmented Switch */}
          <div className="p-0.5 rounded-xl flex items-center border bg-slate-950/80 border-slate-800">
            <button
              onClick={() => onModeChange('stems')}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 ${
                isStems
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Stems Mode"
            >
              <Layers size={11} />
              <span>{t.stemsMode}</span>
            </button>

            <button
              onClick={() => onModeChange('bulk')}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1.5 ${
                !isStems
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Songs Mode"
            >
              <Sparkles size={11} />
              <span>{t.bulkMode}</span>
            </button>
          </div>
        </div>

        {/* Mode Explanatory Subtitle */}
        <div className={`text-[10px] px-2.5 py-1 rounded-lg flex items-center justify-between border ${
          isStems
            ? (isClear ? 'bg-cyan-50 text-cyan-900 border-cyan-200' : 'bg-cyan-950/30 text-cyan-300 border-cyan-500/20')
            : (isClear ? 'bg-indigo-50 text-indigo-900 border-indigo-200' : 'bg-indigo-950/30 text-indigo-300 border-indigo-500/20')
        }`}>
          <span>
            {isStems 
              ? '🎛️ Suma todos los canales en 1 master final'
              : '⚡ Procesa y masteriza cada archivo por separado'}
          </span>
          {!isStems && tracks.length > 0 && (
            <span className="font-mono font-bold">
              {masteredCount}/{tracks.length} Masterizados
            </span>
          )}
        </div>
      </div>

      {/* Bulk Master Actions Bar (When in Bulk Mode) */}
      {!isStems && tracks.length > 0 && (
        <div className="flex items-center gap-2 pt-1 shrink-0">
          <button
            onClick={onMasterAllTracks}
            disabled={isBulkMastering}
            className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-md transition-all ${
              isBulkMastering
                ? 'bg-cyan-700 text-cyan-200 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white'
            }`}
            title="Masterizar todos los archivos simultáneamente con Mixer Fixer AI"
          >
            {isBulkMastering ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Procesando ({bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}` : 'DSP...'})</span>
              </>
            ) : (
              <>
                <Sparkles size={12} />
                <span>Masterizar Todo (AI)</span>
              </>
            )}
          </button>

          {masteredCount > 0 && (
            <button
              onClick={onDownloadAllMasteredZip}
              disabled={isExportingZip || isBulkMastering}
              className={`py-1.5 px-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 border shadow-sm transition-all ${
                isClear
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
              }`}
              title="Descargar todos los tracks masterizados en un archivo .ZIP"
            >
              {isExportingZip ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Archive size={12} className="text-emerald-400" />
              )}
              <span>Descargar ZIP</span>
            </button>
          )}
        </div>
      )}

      {/* File List Content with scroll */}
      <div className={`flex-1 overflow-y-auto min-h-0 pr-1 flex flex-col gap-1.5 rounded-xl transition-all ${
        tracks.length === 0 ? 'border-2 border-dashed border-white/10 hover:border-cyan-500/30 p-4' : ''
      }`}>
        {tracks.length === 0 ? (
          <div 
            onClick={onImportClick}
            className="flex-1 flex flex-col items-center justify-center gap-2 opacity-40 hover:opacity-70 text-center cursor-pointer transition-opacity"
          >
            <div className="p-3 bg-white/5 rounded-full">
              <UploadCloud size={24} className="text-cyan-500" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isStems ? 'Click para Cargar Stems' : 'Click para Cargar Archivos para Bulk Master'}
            </span>
          </div>
        ) : isStems ? (
          /* STEMS MODE: Minimal mixer channels */
          <div className="flex flex-col gap-1">
            {tracks.map(t => (
              <div 
                key={t.id} 
                className="mixer-channel-item"
                onClick={() => onSelectTrack(t.id)}
              >
                <MixerChannel 
                  track={t} 
                  onChange={onTrackChange} 
                  onRemove={onRemoveTrack} 
                  onSelect={onSelectTrack}
                  isSelected={activeTrackId === t.id}
                  variant="minimal" 
                  skin={skin} 
                />
              </div>
            ))}
          </div>
        ) : (
          /* BULK MODE: Individual file cards with mastering status & direct actions */
          <div className="flex flex-col gap-2">
            {tracks.map(t => {
              const info = trackMasterMap[t.id];
              const isMastered = info?.isMastered;
              const isProcessingThis = info?.isProcessing || (isBulkMastering && bulkProgress?.trackName === t.name);
              const isActive = activeTrackId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTrack(t.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isActive
                      ? (isClear 
                          ? 'bg-slate-100/90 border-slate-400 ring-1 ring-slate-400/20 shadow-sm' 
                          : 'bg-cyan-950/30 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-md')
                      : (isClear
                          ? 'bg-white/90 border-slate-200 hover:border-slate-300'
                          : 'bg-slate-900/60 border-white/5 hover:border-white/10')
                  }`}
                >
                  {/* Row 1: File Name, Active Indicator & Remove */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: isMastered ? '#10b981' : t.color }} 
                      />
                      <span 
                        className={`text-xs font-mono font-bold truncate block ${
                          isClear ? 'text-slate-900' : 'text-slate-100'
                        }`} 
                        title={t.name}
                      >
                        {t.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTrack(t.id);
                      }}
                      className={`p-1 rounded-md transition-colors opacity-60 hover:opacity-100 ${
                        isClear ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-red-500/10 hover:text-red-400'
                      }`}
                      title="Eliminar archivo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Row 2: Status Tag and Quick Actions */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    {/* Status Pill */}
                    {isProcessingThis ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        <span>Masterizando...</span>
                      </span>
                    ) : isMastered ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        <span>Masterizado (-14 LUFS)</span>
                      </span>
                    ) : (
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                        isClear ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800/50 text-slate-400 border-white/5'
                      }`}>
                        Raw (Sin procesar)
                      </span>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {/* Master / Remaster button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMasterSingleTrack(t);
                        }}
                        disabled={isProcessingThis || isBulkMastering}
                        className={`p-1 px-2 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all border ${
                          isClear
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                            : 'bg-white/5 hover:bg-white/10 text-cyan-300 border-white/10'
                        }`}
                        title="Masterizar este archivo con Mixer Fixer AI (-14 LUFS | -1 dBTP)"
                      >
                        <Sparkles size={10} />
                        <span>{isMastered ? 'Re-Master' : 'Masterizar'}</span>
                      </button>

                      {/* Report button if mastered */}
                      {isMastered && info?.result && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReport(info.result!);
                          }}
                          className={`p-1 px-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                            isClear
                              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              : 'bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-300 border-indigo-500/30'
                          }`}
                          title="Ver Reporte DSP"
                        >
                          Reporte
                        </button>
                      )}

                      {/* Download WAV button if mastered */}
                      {isMastered && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadSingleTrack(t);
                          }}
                          className="p-1 px-2 rounded-lg text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm transition-all"
                          title="Descargar Master WAV (24-bit)"
                        >
                          <Download size={10} />
                          <span>WAV</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Import Button */}
      <button
        onClick={onImportClick}
        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 ${
          isClear 
            ? 'bg-slate-900 hover:bg-slate-800 text-white' 
            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
        }`}
      >
        <Plus size={14} />
        <span>{isStems ? 'Importar Stems' : 'Importar Archivos (Bulk)'}</span>
      </button>
    </div>
  );
};
