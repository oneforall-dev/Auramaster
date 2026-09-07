import React, { useState, useRef } from 'react';
import { 
  X, Sparkles, UploadCloud, Trash2, CheckCircle2, ShieldCheck, 
  Sliders, Music, Disc, Cpu, ArrowRight, Gauge, Layers, Info, Play, Pause, AlertCircle
} from 'lucide-react';
import { 
  ReferenceTrack, 
  ReferenceMasteringConfig, 
  ReferenceMasteringMode, 
  ReferenceMatchIntensity, 
  SkinMode 
} from '../types';
import { Language, getT } from '../services/i18n';
import { audioEngine } from '../services/audioEngine';

interface ReferenceMasteringModalProps {
  isOpen: boolean;
  onClose: () => void;
  references: ReferenceTrack[];
  onAddReference: (track: ReferenceTrack) => void;
  onUpdateReference: (id: string, updates: Partial<ReferenceTrack>) => void;
  onRemoveReference: (id: string) => void;
  onRunMastering: (config: ReferenceMasteringConfig) => Promise<void>;
  skin?: SkinMode;
  lang?: Language;
  isProcessing?: boolean;
}

export const ReferenceMasteringModal: React.FC<ReferenceMasteringModalProps> = ({
  isOpen,
  onClose,
  references,
  onAddReference,
  onUpdateReference,
  onRemoveReference,
  onRunMastering,
  skin = 'modern',
  lang = 'es',
  isProcessing = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingFileName, setAnalyzingFileName] = useState('');
  const [mode, setMode] = useState<ReferenceMasteringMode>('adapt');
  const [intensity, setIntensity] = useState<ReferenceMatchIntensity>('moderate');
  const [blendMode, setBlendMode] = useState<'primary' | 'weighted_average' | 'modular'>('primary');
  const [safeMode, setSafeMode] = useState<boolean>(true);
  const [playingRefId, setPlayingRefId] = useState<string | null>(null);
  const [previewAudioNode, setPreviewAudioNode] = useState<AudioBufferSourceNode | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getT(lang);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsAnalyzing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('audio/') && !/\.(wav|mp3|flac|aiff|m4a|ogg)$/i.test(file.name)) {
        continue;
      }

      setAnalyzingFileName(file.name);
      try {
        const buffer = await audioEngine.decodeAudioFile(file);
        const profile = await audioEngine.analyzeReferenceTrack(buffer);
        
        const newTrack: ReferenceTrack = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name.replace(/\.[^/.]+$/, ""),
          size: file.size,
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          buffer,
          profile,
          isPrimary: references.length === 0 && i === 0,
          weight: 1.0,
          features: {
            tonal: true,
            dynamics: true,
            stereo: true,
            loudness: true,
            texture: true
          }
        };

        onAddReference(newTrack);
      } catch (err) {
        console.error("Error analyzing reference audio:", err);
      }
    }

    setIsAnalyzing(false);
    setAnalyzingFileName('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleTogglePreview = (refTrack: ReferenceTrack) => {
    if (playingRefId === refTrack.id) {
      if (previewAudioNode) {
        try { previewAudioNode.stop(); } catch (_) {}
      }
      setPlayingRefId(null);
      setPreviewAudioNode(null);
      return;
    }

    if (previewAudioNode) {
      try { previewAudioNode.stop(); } catch (_) {}
    }

    if (!refTrack.buffer) return;

    try {
      const ctx = audioEngine.getAudioContext();
      if (!ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = refTrack.buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.8;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.onended = () => {
        setPlayingRefId(null);
        setPreviewAudioNode(null);
      };
      source.start();
      setPreviewAudioNode(source);
      setPlayingRefId(refTrack.id);
    } catch (err) {
      console.error("Audio preview failed:", err);
    }
  };

  const handleExecute = async () => {
    if (references.length === 0) return;
    if (previewAudioNode) {
      try { previewAudioNode.stop(); } catch (_) {}
      setPlayingRefId(null);
    }

    await onRunMastering({
      mode,
      intensity,
      blendMode,
      safeMode
    });
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl shadow-lg shadow-purple-900/30">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white tracking-wide">Mastering Inteligente por Referencia</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  AI Multi-Ref 4.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Carga una o varias canciones comerciales para extraer su ADN sonoro (volumen, tono, dinámica y estéreo).
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (previewAudioNode) {
                try { previewAudioNode.stop(); } catch (_) {}
              }
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {/* Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging 
                ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01]' 
                : 'border-slate-700/80 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="audio/*,.wav,.mp3,.flac,.aiff,.m4a"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl shadow-inner">
              <UploadCloud size={28} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-slate-200">
                Arrastra o selecciona tus canciones de referencia
              </span>
              <span className="text-xs text-slate-400">
                Soporta WAV, MP3, FLAC, AIFF y M4A (Muestreo nativo 44.1 kHz / 48 kHz preservado)
              </span>
            </div>

            {isAnalyzing && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/40 rounded-full text-xs text-indigo-300 font-mono animate-pulse">
                <Cpu size={14} className="animate-spin" />
                <span>Analizando ADN espectral y dinámico: {analyzingFileName}...</span>
              </div>
            )}
          </div>

          {/* Reference List */}
          {references.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Disc size={14} className="text-indigo-400" />
                  Referencias Cargadas ({references.length})
                </h4>
                {references.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Estrategia Multi-Ref:</span>
                    <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setBlendMode('primary')}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                          blendMode === 'primary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Primaria
                      </button>
                      <button
                        onClick={() => setBlendMode('weighted_average')}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                          blendMode === 'weighted_average' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Ponderada
                      </button>
                      <button
                        onClick={() => setBlendMode('modular')}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                          blendMode === 'modular' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Modular
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {references.map((ref) => {
                  const isPrimary = ref.isPrimary;
                  const p = ref.profile;

                  return (
                    <div 
                      key={ref.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col gap-3.5 ${
                        isPrimary 
                          ? 'bg-slate-950/80 border-indigo-500/40 shadow-lg shadow-indigo-950/30' 
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Row: Info & Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePreview(ref)}
                            className={`p-2 rounded-xl transition-all ${
                              playingRefId === ref.id 
                                ? 'bg-amber-500 text-slate-950 shadow-md animate-pulse' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                            title={playingRefId === ref.id ? "Pausar preescucha" : "Preescuchar referencia"}
                          >
                            {playingRefId === ref.id ? <Pause size={14} /> : <Play size={14} />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">{ref.name}</span>
                              {isPrimary && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  Primaria
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                              <span>{formatTime(ref.duration)}</span>
                              <span>•</span>
                              <span>{(ref.sampleRate / 1000).toFixed(1)} kHz</span>
                              <span>•</span>
                              <span>{(ref.size / (1024 * 1024)).toFixed(1)} MB</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {references.length > 1 && !isPrimary && (
                            <button
                              onClick={() => {
                                references.forEach(r => {
                                  onUpdateReference(r.id, { isPrimary: r.id === ref.id });
                                });
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all"
                            >
                              Hacer Primaria
                            </button>
                          )}
                          <button
                            onClick={() => onRemoveReference(ref.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors"
                            title="Eliminar referencia"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Profile Metrics Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 font-mono text-center">
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">INTEGRATED</span>
                          <span className="text-xs font-bold text-slate-200">{p.integratedLUFS.toFixed(1)} LUFS</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">SHORT-TERM</span>
                          <span className="text-xs font-bold text-slate-200">{p.shortTermMaxLUFS.toFixed(1)} LUFS</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">TRUE PEAK</span>
                          <span className={`text-xs font-bold ${p.truePeakDbTP > -1.0 ? 'text-amber-400' : 'text-slate-200'}`}>
                            {p.truePeakDbTP.toFixed(1)} dBTP
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">LRA DYNAMICS</span>
                          <span className={`text-xs font-bold ${p.dynamicRangeLRA < 4.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                            {p.dynamicRangeLRA.toFixed(1)} LU
                          </span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">M/S WIDTH</span>
                          <span className="text-xs font-bold text-cyan-400">{p.stereoWidthRatio.toFixed(2)}x</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                          <span className="text-[9px] text-slate-500 block">PUNCH</span>
                          <span className="text-xs font-bold text-indigo-400">{p.transientPunch}/100</span>
                        </div>
                      </div>

                      {/* Weight Slider if weighted_average mode */}
                      {blendMode === 'weighted_average' && references.length > 1 && (
                        <div className="flex items-center gap-3 px-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 w-24">Peso Ponderado:</span>
                          <input 
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={ref.weight}
                            onChange={(e) => onUpdateReference(ref.id, { weight: parseFloat(e.target.value) })}
                            className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                          />
                          <span className="font-mono text-xs font-bold text-indigo-400 w-12 text-right">
                            {Math.round(ref.weight * 100)}%
                          </span>
                        </div>
                      )}

                      {/* Modular feature checkboxes if modular mode */}
                      {blendMode === 'modular' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 mr-2">Extraer de esta pista:</span>
                          {(['tonal', 'dynamics', 'stereo', 'loudness', 'texture'] as const).map((feat) => {
                            const active = ref.features[feat];
                            const labels = {
                              tonal: 'Tono (EQ)',
                              dynamics: 'Dinámica',
                              stereo: 'Estéreo (M/S)',
                              loudness: 'Volumen LUFS',
                              texture: 'Textura'
                            };
                            return (
                              <button
                                key={feat}
                                onClick={() => {
                                  onUpdateReference(ref.id, {
                                    features: { ...ref.features, [feat]: !active }
                                  });
                                }}
                                className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                                  active 
                                    ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300' 
                                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {labels[feat]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders size={14} className="text-indigo-400" />
              Modo de Procesamiento Adaptativo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Replicar */}
              <button
                onClick={() => setMode('replicate')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  mode === 'replicate'
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-950/40 text-white ring-1 ring-indigo-500'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-indigo-200">Replicar Estilo</span>
                    {mode === 'replicate' && <CheckCircle2 size={16} className="text-indigo-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Máxima cercanía sónica al perfil de referencia dentro de los límites físicos del mix.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-indigo-400/80 mt-3 block">Ideal: Covers o singles directos</span>
              </button>

              {/* Adaptar */}
              <button
                onClick={() => setMode('adapt')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  mode === 'adapt'
                    ? 'bg-purple-950/60 border-purple-500 shadow-md shadow-purple-950/40 text-white ring-1 ring-purple-500'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-purple-200">Adaptar Estilo</span>
                      <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-400/30 rounded text-[9px] font-bold">RECOMENDADO</span>
                    </div>
                    {mode === 'adapt' && <CheckCircle2 size={16} className="text-purple-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Usa la referencia como brújula sónica, respetando la personalidad y balance original de la canción.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-purple-400/80 mt-3 block">Ideal: Producciones con arreglos propios</span>
              </button>

              {/* Adaptar y Mejorar */}
              <button
                onClick={() => setMode('adapt_and_enhance')}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  mode === 'adapt_and_enhance'
                    ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/40 text-white ring-1 ring-emerald-500'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-emerald-200">Adaptar y Mejorar</span>
                    {mode === 'adapt_and_enhance' && <CheckCircle2 size={16} className="text-emerald-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Toma lo mejor de la referencia pero filtra sus defectos: evita sobrecompresión, suaviza asperezas y centra subgrave.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400/80 mt-3 block">Ideal: Referencias comerciales agresivas</span>
              </button>

            </div>
          </div>

          {/* Match Intensity & Safety Protections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Match Intensity */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Gauge size={14} className="text-indigo-400" />
                  Intensidad del Emparejamiento
                </span>
                <span className="text-[10px] font-mono text-indigo-400">
                  {intensity === 'subtle' ? '35% (Sutil)' : intensity === 'moderate' ? '65% (Moderado)' : '90% (Fuerte)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setIntensity('subtle')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    intensity === 'subtle' 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sutil (35%)
                </button>
                <button
                  onClick={() => setIntensity('moderate')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    intensity === 'moderate' 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Moderado (65%)
                </button>
                <button
                  onClick={() => setIntensity('strong')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                    intensity === 'strong' 
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fuerte (90%)
                </button>
              </div>
            </div>

            {/* Quality and Audio Rules */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Reglas de Protección Acústica
                </span>
                <span className="text-[10px] font-mono text-emerald-400">DSP Safety Core</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>True Peak estricto ≤ -1.0 dBTP (Ceiling seguro anti-clipping)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>Sub-graves centrados en mono (&lt; 105 Hz) para máxima pegada</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span>No aplastar dinámica si la mezcla no lo requiere (LRA inteligente)</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info size={14} className="text-indigo-400" />
            <span>
              {references.length === 0 
                ? 'Carga al menos una canción de referencia para comenzar.' 
                : `${references.length} referencia${references.length > 1 ? 's' : ''} lista${references.length > 1 ? 's' : ''} para calibración.`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                if (previewAudioNode) {
                  try { previewAudioNode.stop(); } catch (_) {}
                }
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-all"
            >
              Cancelar
            </button>

            <button
              onClick={handleExecute}
              disabled={references.length === 0 || isProcessing || isAnalyzing}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                references.length === 0 || isProcessing || isAnalyzing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-purple-900/40 active:scale-95'
              }`}
            >
              <Sparkles size={15} className={isProcessing ? "animate-spin" : ""} />
              <span>{isProcessing ? 'Masterizando con Referencias...' : 'Ejecutar Masterización con Referencias'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
