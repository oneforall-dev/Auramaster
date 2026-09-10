
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Activity, Download, Loader2, Globe, Sparkles, Zap, Disc, Plus, FileAudio, FolderOpen, Settings2, Sliders, Cpu, Headphones, Music, Guitar, Leaf, CheckCircle2, Monitor, Maximize2, Minimize2, VolumeX, PenTool, UploadCloud, BrainCircuit, BarChart2, Archive, Undo2 } from 'lucide-react';
import { audioEngine, getNeutralMasteringParams } from './services/audioEngine';
import { MasteringChainParams, PlaybackState, Track, SkinMode, ProcessingMode, TrackMasterInfo, AIMasteringResult, ReferenceTrack, ReferenceMasteringConfig, BulkMasteringSummary } from './types';
import { Visualizer } from './components/Visualizer';
import { EffectRack } from './components/EffectRack';
import { TimelineBar } from './components/TimelineBar';
import { MeterBar } from './components/MeterBar';
import { Assistant } from './components/Assistant';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { AuthGate } from './components/AuthGate';
import { AISettingsModal } from './components/AISettingsModal';
import { AIMasteringReportModal } from './components/AIMasteringReportModal';
import { ReferenceMasteringModal } from './components/ReferenceMasteringModal';
import { BulkMasteringSummaryModal } from './components/BulkMasteringSummaryModal';
import { ExportSuccessModal } from './components/ExportSuccessModal';
import { FilesBox } from './components/FilesBox';
import { createMasteredZip } from './services/exportZip';
import { authService, UserProfile } from './services/authService';
import { Language, LANGUAGES, detectBrowserLanguage, getT } from './services/i18n';

const DEFAULT_COMP = { threshold: -18, ratio: 3.5, attack: 0.03, release: 0.15 };

// Commercial Standard Mastering Polish Defaults (Universal Preset)
const DEFAULT_PARAMS: MasteringChainParams = {
  eq: { 
      enabled: true,
      low: { frequency: 100, gain: 0.5, q: 0.7 },
      lowMid: { frequency: 320, gain: -0.4, q: 1 },
      mid: { frequency: 1000, gain: 0, q: 1 },
      highMid: { frequency: 3200, gain: 0.0, q: 1 },
      high: { frequency: 10000, gain: 0.4, q: 0.7 }
  },
  multiband: {
     enabled: true,
     low: { ...DEFAULT_COMP, threshold: -16, ratio: 1.5, attack: 0.03, release: 0.2 },
     mid: { ...DEFAULT_COMP, threshold: -18, ratio: 1.3, attack: 0.025, release: 0.15 },
     high: { ...DEFAULT_COMP, threshold: -20, ratio: 1.2, attack: 0.015, release: 0.10 }
  },
  gate: { 
      enabled: false, 
      threshold: -80, 
      ratio: 0 
  },
  deEsser: {
      enabled: false,
      threshold: -20,
      amount: 4
  },
  transient: { enabled: false, amount: 0, sustain: 0 },
  distortion: { enabled: false, amount: 0, mode: 'tape' },
  lofi: { enabled: false, bitDepth: 32, sampleRate: 48000, mix: 0 },
  modulation: { enabled: false, type: 'chorus', mix: 0, rate: 1.5, depth: 50, feedback: 0 },
  delay: { enabled: false, mix: 0, time: 0.3, feedback: 0.3 },
  reverb: { enabled: false, mix: 0, decay: 2.0 },
  gain: 1.25, // Transparent clean mastering gain
  stereoWidth: 1.0, // 100% natural stereo field preserved with mono-centered sub-bass
  limiter: { enabled: true, threshold: -1.0, breathe: 0 } // True-Peak Limiter (-1.0 dBTP ceiling, 8x oversampling, 3.5ms lookahead)
};

const eq = (l: number, lm: number, m: number, hm: number, h: number) => ({
    enabled: true,
    low: { frequency: 100, gain: l, q: 0.7 },
    lowMid: { frequency: 300, gain: lm, q: 1 },
    mid: { frequency: 1000, gain: m, q: 1 },
    highMid: { frequency: 3000, gain: hm, q: 1 },
    high: { frequency: 10000, gain: h, q: 0.7 }
});

const PRESETS = [
  { id: 'universal', label: 'Universal', icon: Globe, params: DEFAULT_PARAMS },
  { id: 'pop', label: 'Pop', icon: Sparkles, params: { ...DEFAULT_PARAMS, eq: eq(2, 0, -1.5, 2, 3.5), gain: 1.3 } },
  { id: 'hiphop', label: 'Hip-Hop', icon: Disc, params: { ...DEFAULT_PARAMS, eq: eq(5, 2, -1, 0, 2), gain: 1.45, transient: { enabled: true, amount: 25, sustain: 10 } } },
  { id: 'electronic', label: 'Electronic', icon: Cpu, params: { ...DEFAULT_PARAMS, stereoWidth: 1.25, eq: eq(4, 1, -1, 2, 4), gain: 1.35 } },
  { id: 'trap', label: 'Trap', icon: Headphones, params: { ...DEFAULT_PARAMS, eq: eq(6, -1, -2, 2.5, 5), gain: 1.5, multiband: { ...DEFAULT_PARAMS.multiband, low: { ...DEFAULT_COMP, threshold: -12, ratio: 6 } } } },
  { id: 'rock', label: 'Rock', icon: Zap, params: { ...DEFAULT_PARAMS, eq: eq(2.5, 2, -1, 3, 2.5), gain: 1.3, distortion: { enabled: true, amount: 5 } } },
  { id: 'metal', label: 'Metal', icon: Activity, params: { ...DEFAULT_PARAMS, gain: 1.6, eq: eq(1.5, 3.5, -1.5, 4, 4), transient: { enabled: true, amount: 30, sustain: 15 } } },
  { id: 'jazz', label: 'Jazz', icon: Music, params: { ...DEFAULT_PARAMS, gain: 1.1, eq: eq(0.5, 1, 1.5, 0.5, 1.5), multiband: { ...DEFAULT_PARAMS.multiband, enabled: false } } },
  { id: 'acoustic', label: 'Acoustic', icon: Guitar, params: { ...DEFAULT_PARAMS, gain: 1.15, eq: eq(-1, 0.5, 1, 2, 3), reverb: { enabled: true, mix: 0.1, decay: 1.8 } } },
  { id: 'natural', label: 'Natural', icon: Leaf, params: { ...DEFAULT_PARAMS, eq: eq(0,0,0,0,0), gain: 1.0, multiband: { ...DEFAULT_PARAMS.multiband, enabled: false } } },
];

export default function App() {
  const [lang, setLang] = useState<Language>(() => detectBrowserLanguage());
  const [skin, setSkin] = useState<SkinMode>('modern');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [params, setParams] = useState<MasteringChainParams>(DEFAULT_PARAMS);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isBypassed, setIsBypassed] = useState(true); // Default to Original (Raw)
  // Start with the exported delivery level so A/B exposes the real loudness change.
  const [loudnessMatchMode, setLoudnessMatchMode] = useState<'matched' | 'actual'>('actual');
  const [activePreset, setActivePreset] = useState<string>('universal');
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'waveform' | 'spectrum' | 'vector'>('waveform');
  const [fileStats, setFileStats] = useState({ peak: -Infinity, integrated: -100, shortTerm: -100 });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSmartAdjusting, setIsSmartAdjusting] = useState(false);
  const [smartMasterPhase, setSmartMasterPhase] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<{start: number, end: number} | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => authService.getUser());
  const [masteringReport, setMasteringReport] = useState<AIMasteringResult | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isExportSuccessOpen, setIsExportSuccessOpen] = useState(false);
  const [exportedFileName, setExportedFileName] = useState('');
  const [exportedQC, setExportedQC] = useState<AIMasteringResult['qcVerification'] | null>(null);
  const [editHistory, setEditHistory] = useState<{ trackId: string; buffer: AudioBuffer; description: string }[]>([]);

  // Multi-Reference AI Mastering State
  const [references, setReferences] = useState<ReferenceTrack[]>([]);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [isReferenceProcessing, setIsReferenceProcessing] = useState(false);

  useEffect(() => {
    return authService.subscribe((u) => setCurrentUser(u));
  }, []);

  const t = getT(lang);

  const getVerifiedMasterBlob = async (
    result: AIMasteringResult | undefined,
    expectedSourceId?: string
  ): Promise<Blob> => {
    const artifact = result?.finalMasterArtifact;
    if (!result || !artifact) {
      throw new Error('No existe un FinalMasterArtifact verificado para esta canción. Vuelve a ejecutar Master Fixer.');
    }
    if (expectedSourceId && artifact.sourceId !== expectedSourceId) {
      throw new Error('El master pertenece a otra canción. Se bloqueó la descarga.');
    }
    const exploration = result.loudnessExploration;
    if (!exploration?.selectedVariantId || artifact.deliveryVariantId !== exploration.selectedVariantId) {
      throw new Error('La variante Pass B del WAV no coincide con la seleccionada en el reporte.');
    }
    if (exploration.selectedWavSha256 !== artifact.sha256 || result.audioIdentity?.finalFileHash !== artifact.sha256) {
      throw new Error('La identidad criptográfica del reporte y el WAV no coincide.');
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', await artifact.wavBlob.arrayBuffer());
    const actualHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (actualHash !== artifact.sha256) {
      throw new Error(`WAV inválido: hash ${actualHash.slice(0, 16)}… distinto del reporte ${artifact.sha256.slice(0, 16)}…`);
    }
    return artifact.wavBlob;
  };

  // Bulk Mastering & Files State
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('stems');
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [trackMasterMap, setTrackMasterMap] = useState<Record<string, TrackMasterInfo>>({});
  const [isBulkMastering, setIsBulkMastering] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; trackName: string } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<BulkMasteringSummary | null>(null);
  const [isBulkSummaryOpen, setIsBulkSummaryOpen] = useState(false);

  const [currentSessionId, setCurrentSessionId] = useState<string>(
    typeof audioEngine?.getCurrentSessionId === 'function' 
      ? audioEngine.getCurrentSessionId() 
      : (audioEngine?.currentSessionId || `sess_${Date.now().toString(36)}`)
  );

  const currentSessionIdRef = useRef<string>(
    typeof audioEngine?.getCurrentSessionId === 'function' 
      ? audioEngine.getCurrentSessionId() 
      : (audioEngine?.currentSessionId || `sess_${Date.now().toString(36)}`)
  );

  // HARD RESET: Completely clears mastering state for a pristine session
  const resetMixerFixerSession = useCallback((newSessionId?: string) => {
    const sId = newSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentSessionIdRef.current = sId;
    if (typeof audioEngine?.resetMixerFixerSession === 'function') {
      audioEngine.resetMixerFixerSession(sId);
    }
    setParams(getNeutralMasteringParams());
    setActivePreset('universal');
    setIsBypassed(true); // HARD RESET: Immediately force RAW Original
    setLoudnessMatchMode('actual');
    setProcessedBuffer(null);
    setMasteringReport(null);
    setSelection(null);
    setEditHistory([]);
    setTrackMasterMap({});
    setExportedQC(null);
    setFileStats({ peak: -90, integrated: -90, shortTerm: -90 });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    audioEngine.onPlaybackEnded = () => { setPlaybackState(PlaybackState.STOPPED); setCurrentTime(0); };
    return () => { audioEngine.onPlaybackEnded = null; };
  }, []);

  useEffect(() => { audioEngine.setMasterParams(params); }, [params]);
  useEffect(() => { if (!audioEngine.setBypass(isBypassed)) setIsBypassed(true); }, [isBypassed]);
  useEffect(() => { audioEngine.setLoudnessMatchMode(loudnessMatchMode); }, [loudnessMatchMode]);
  
  useEffect(() => { 
      tracks.forEach(t => { audioEngine.updateTrackSettings(t, tracks); }); 
      if (processingMode === 'bulk' && activeTrackId) {
        setDuration(audioEngine.getTrackDuration(activeTrackId));
      } else {
        setDuration(audioEngine.getDuration());
      }
  }, [tracks, processingMode, activeTrackId]);

  // Keep activeTrackId synchronized
  useEffect(() => {
    if (tracks.length > 0) {
      if (!activeTrackId || !tracks.some(t => t.id === activeTrackId)) {
        setActiveTrackId(tracks[0].id);
      }
    } else {
      setActiveTrackId(null);
    }
  }, [tracks, activeTrackId]);

  // Render preview buffer (summed stems or single active track in bulk mode)
  useEffect(() => {
    if (tracks.length === 0 || loadingAudio) {
      setProcessedBuffer(null);
      return;
    }
    const timer = setTimeout(async () => {
        setIsPreviewRendering(true);
        let buffer: AudioBuffer | null = null;
        const artifact = processingMode === 'bulk' && activeTrackId
          ? trackMasterMap[activeTrackId]?.finalMasterArtifact
          : masteringReport?.finalMasterArtifact;
        if (artifact) {
          buffer = artifact.finalDecodedPCM;
        } else if (processingMode === 'bulk' && activeTrackId) {
          const currentTrack = tracks.find(t => t.id === activeTrackId);
          if (currentTrack) {
            const trackParams = trackMasterMap[activeTrackId]?.params || params;
            buffer = await audioEngine.renderPreview(trackParams, [currentTrack]);
          }
        } else {
          buffer = await audioEngine.renderPreview(params, tracks);
        }

        if (buffer) {
             const metrics = await audioEngine.calculateAccurateDSPMetrics(buffer);
             setFileStats({
               peak: metrics.truePeakDbTP,
               integrated: metrics.integratedLUFS,
               shortTerm: metrics.integratedLUFS
             });
             setProcessedBuffer(buffer);
             setDuration(buffer.duration);
        }
        setIsPreviewRendering(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [params, tracks, loadingAudio, processingMode, activeTrackId, trackMasterMap, masteringReport]);

  // Throttled time updater for UI text (4Hz interval instead of 60Hz full-tree re-renders)
  useEffect(() => {
    if (playbackState !== PlaybackState.PLAYING) return;
    const interval = setInterval(() => {
      setCurrentTime(audioEngine.getCurrentTime());
    }, 250);
    return () => clearInterval(interval);
  }, [playbackState]);

  const handleAddTrack = async (e: React.ChangeEvent<HTMLInputElement>) => { 
    if (e.target.files && e.target.files.length > 0) { 
      setLoadingAudio(true); 
      try { 
        const newFiles = Array.from(e.target.files) as File[];

        // HARD RESET: If loading a new song or replacing in single-track mastering,
        // clear previous tracks, buffers, presets and state completely
        const isStemsAdding = processingMode === 'stems' && tracks.length > 0;
        if (!isStemsAdding) {
          audioEngine.clearAllTracks();
          resetMixerFixerSession();
        }

        const added: Track[] = [];
        for (const file of newFiles) added.push(await audioEngine.addTrack(file)); 

        let allTracks = isStemsAdding ? [...tracks, ...added] : added;
        let newParams = getNeutralMasteringParams();
        
        // Stems auto-balance logic if in stems mode
        if (processingMode === 'stems' && allTracks.length > 1) {
            allTracks = audioEngine.autoBalanceTracks(allTracks);
            newParams.gain = 1.0;
        }

        // Safety limit (-1.0 dBTP strict ceiling)
        newParams.limiter.enabled = true;
        newParams.limiter.threshold = -1.0;
        newParams.limiter.breathe = 0;
        
        // Initialize tracks in trackMasterMap if in bulk mode
        if (processingMode === 'bulk') {
          setTrackMasterMap(prev => {
            const next = { ...prev };
            added.forEach(t => {
              if (!next[t.id]) {
                next[t.id] = {
                  trackId: t.id,
                  sourceId: t.sourceId,
                  isMastered: false,
                  isProcessing: false
                };
              }
            });
            return next;
          });
        }

        setTracks(allTracks);
        setParams(newParams);
        setIsBypassed(true); // HARD RESET: New audio is always auditioned as ORIGINAL raw first
        setMasteringReport(null); // Clear old report
        if (added.length > 0) {
          const newActiveId = (processingMode === 'bulk' || !activeTrackId || !allTracks.some(t => t.id === activeTrackId))
            ? added[0].id 
            : activeTrackId;
          setActiveTrackId(newActiveId);
          const activeBuf = audioEngine.getTrackBuffer(newActiveId);
          if (activeBuf) {
            setDuration(activeBuf.duration);
            setProcessedBuffer(activeBuf);
            audioEngine.calculateAccurateDSPMetrics(activeBuf).then(m => {
              setFileStats({
                peak: m.truePeakDbTP,
                integrated: m.integratedLUFS,
                shortTerm: m.integratedLUFS
              });
            });
          }
        }
      } catch (err) { 
        console.error(err);
        alert("Error loading files."); 
      } finally { 
        setLoadingAudio(false); 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      } 
    } 
  };

  const handleRemoveTrack = (id: string) => {
    audioEngine.removeTrack(id);
    setTracks(prev => prev.filter(t => t.id !== id));
    setTrackMasterMap(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeTrackId === id) {
      const remaining = tracks.filter(t => t.id !== id);
      setActiveTrackId(remaining[0]?.id || null);
    }
    if (tracks.length <= 1) {
        setPlaybackState(PlaybackState.STOPPED);
        setCurrentTime(0);
    }
  };

  const handleUndoEdit = useCallback(() => {
    if (editHistory.length === 0) return;
    const lastEntry = editHistory[editHistory.length - 1];
    setEditHistory(prev => prev.slice(0, prev.length - 1));

    audioEngine.setTrackBuffer(lastEntry.trackId, lastEntry.buffer);
    setTracks(prev => prev.map(t => t.id === lastEntry.trackId ? { ...t } : t));
    setProcessedBuffer(lastEntry.buffer);

    if (playbackState === PlaybackState.PLAYING) {
      audioEngine.seek(currentTime, lastEntry.trackId);
    }

    audioEngine.calculateAccurateDSPMetrics(lastEntry.buffer).then(metrics => {
      setFileStats({
        peak: metrics.truePeakDbTP,
        integrated: metrics.integratedLUFS,
        shortTerm: metrics.integratedLUFS
      });
    }).catch(err => console.error("Undo metrics error:", err));
  }, [editHistory, playbackState, currentTime]);

  const handlePlayPause = () => {
    if (playbackState === PlaybackState.PLAYING) {
      audioEngine.pause();
      setPlaybackState(PlaybackState.PAUSED);
    } else {
      if (tracks.length === 0) return;
      const targetTrackId = processingMode === 'bulk' ? (activeTrackId || undefined) : undefined;
      audioEngine.play(targetTrackId);
      setPlaybackState(PlaybackState.PLAYING);
    }
  };

  // Global Keyboard shortcuts (Spacebar for Play/Pause, Ctrl+Z / Cmd+Z for Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoEdit();
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState, processingMode, activeTrackId, tracks, handleUndoEdit]);

  const handleSeek = (time: number) => {
    const targetTrackId = processingMode === 'bulk' ? (activeTrackId || undefined) : undefined;
    audioEngine.seek(time, targetTrackId);
    setCurrentTime(time);
  };

  const handleSelectTrack = (id: string) => {
    setActiveTrackId(id);
    setProcessedBuffer(null);
    
    // Always reset timeline and playhead to 00:00 when selecting another song
    setCurrentTime(0);
    audioEngine.stop();
    const trackDur = audioEngine.getTrackDuration(id);
    if (trackDur > 0) {
      setDuration(trackDur);
    }

    const rawBuf = audioEngine.getTrackBuffer(id);
    if (rawBuf) {
      audioEngine.calculateAccurateDSPMetrics(rawBuf).then(m => {
        setFileStats({
          peak: m.truePeakDbTP,
          integrated: m.integratedLUFS,
          shortTerm: m.integratedLUFS
        });
      });
    }

    const currentTrack = tracks.find(t => t.id === id);
    const trackInfo = trackMasterMap[id];
    const restored = currentTrack ? audioEngine.activateTrackForPlayback(currentTrack, trackInfo?.result) : false;
    if (restored && trackInfo?.isMastered && trackInfo.result && trackInfo.result.sourceId === (currentTrack?.sourceId || id)) {
      setParams(trackInfo.params || trackInfo.result.appliedParams);
      setMasteringReport(trackInfo.result);
      audioEngine.setBypass(false);
      setIsBypassed(false);
    } else {
      // Clean slate for unmastered track: strictly neutral params, no previous report, forced raw bypass
      setParams(getNeutralMasteringParams());
      setMasteringReport(null);
      setIsBypassed(true);
    }
    
    // If audio is currently playing in bulk mode, start the newly selected song immediately from 00:00
    if (playbackState === PlaybackState.PLAYING && processingMode === 'bulk') {
      audioEngine.play(id);
    }
  };

  // 1. Single Track Mastering (Bulk Mode) - with isolated track session and phase tracking
  const handleMasterSingleTrack = async (track: Track) => {
    const targetSessionId = `track_${Date.now()}_${track.id}`;
    setTrackMasterMap(prev => ({
      ...prev,
      [track.id]: { 
        trackId: track.id, 
        sourceId: track.sourceId,
        trackSessionId: targetSessionId,
        isProcessing: true, 
        isMastered: false,
        currentPhase: 'reset'
      }
    }));
    setActiveTrackId(track.id);

    try {
      const result = await audioEngine.runMixerFixerAIForSingleTrack(
        getNeutralMasteringParams(),
        track,
        null,
        targetSessionId,
        (phase) => {
          setTrackMasterMap(prev => prev[track.id] ? {
            ...prev,
            [track.id]: { ...prev[track.id], currentPhase: phase }
          } : prev);
        }
      );

      // Async validation: discard late result if session changed
      if (result.sessionId && result.sessionId !== targetSessionId) {
        console.warn(`[BulkMaster] Session mismatch for ${track.name}, discarding stale result`);
        return;
      }

      setTrackMasterMap(prev => ({
        ...prev,
        [track.id]: {
          trackId: track.id,
          sourceId: track.sourceId,
          trackSessionId: targetSessionId,
          isMastered: true,
          isProcessing: false,
          currentPhase: 'complete',
          result,
          params: result.appliedParams,
          blob: result.finalMasterArtifact?.wavBlob || audioEngine.getFinalExportedMasterBlob() || undefined,
          finalMasterArtifact: result.finalMasterArtifact || audioEngine.getFinalMasterArtifact() || undefined
        }
      }));

      if (activeTrackId === track.id) {
        setParams(result.appliedParams);
        setMasteringReport(result);
        setIsBypassed(false);
      }
      setIsReportOpen(true);
    } catch (err: any) {
      console.error("Error mastering single track:", err);
      setTrackMasterMap(prev => ({
        ...prev,
        [track.id]: { 
          trackId: track.id, 
          sourceId: track.sourceId,
          isProcessing: false, 
          isMastered: false,
          currentPhase: 'error',
          errorMessage: err?.message || 'Error durante masterización'
        }
      }));
      alert(`Error mastering ${track.name}: ${err?.message || 'Error'}`);
    }
  };

  // 2. Bulk Master All Tracks - 100% Isolated Sessions per Track
  const handleMasterAllTracks = async () => {
    if (tracks.length === 0) return;
    setIsBulkMastering(true);
    let completedCount = 0;
    let failedCount = 0;
    const updatedMap = { ...trackMasterMap };
    const results: AIMasteringResult[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const targetSessionId = `bulk_${track.id}_${Date.now().toString(36)}`;
      setBulkProgress({ current: i + 1, total: tracks.length, trackName: track.name });
      try {
        setTrackMasterMap(prev => ({
          ...prev,
          [track.id]: {
            trackId: track.id,
            sourceId: track.sourceId,
            trackSessionId: targetSessionId,
            isProcessing: true,
            isMastered: false,
            currentPhase: 'analyze'
          }
        }));

        const result = await audioEngine.runMixerFixerAIForSingleTrack(
          getNeutralMasteringParams(),
          track,
          null,
          targetSessionId,
          (phase) => {
            setTrackMasterMap(prev => prev[track.id] ? {
              ...prev,
              [track.id]: { ...prev[track.id], currentPhase: phase }
            } : prev);
          }
        );

        updatedMap[track.id] = {
          trackId: track.id,
          sourceId: track.sourceId,
          trackSessionId: targetSessionId,
          isMastered: true,
          isProcessing: false,
          currentPhase: 'complete',
          result,
          params: result.appliedParams,
          blob: result.finalMasterArtifact?.wavBlob || audioEngine.getFinalExportedMasterBlob() || undefined,
          finalMasterArtifact: result.finalMasterArtifact || audioEngine.getFinalMasterArtifact() || undefined
        };
        results.push(result);
        setTrackMasterMap({ ...updatedMap });
      } catch (err: any) {
        console.error(`Error mastering ${track.name}:`, err);
        failedCount++;
        updatedMap[track.id] = { 
          trackId: track.id, 
          sourceId: track.sourceId,
          isProcessing: false, 
          isMastered: false,
          currentPhase: 'error',
          errorMessage: err?.message || 'Error'
        };
        setTrackMasterMap({ ...updatedMap });
      }
    }

    setIsBulkMastering(false);
    setBulkProgress(null);

    // Build BulkMasteringSummary
    {
      const totalTracks = tracks.length;
      const completedTracks = results.length;
      const resultCount = Math.max(1, results.length);
      const avgOrigLUFS = results.length > 0
        ? results.reduce((acc, r) => acc + (r.before.integratedLUFS || -14), 0) / resultCount
        : 0;
      const avgMasterLUFS = results.length > 0
        ? results.reduce((acc, r) => acc + (r.after.integratedLUFS || -14), 0) / resultCount
        : 0;
      const maxTP = results.length > 0 ? Math.max(...results.map(r => r.after.truePeakDbTP || -1.0)) : 0;
      const avgLRA = results.length > 0
        ? results.reduce((acc, r) => acc + (r.after.dynamicRangeLRA || 8.0), 0) / resultCount
        : 0;
      const vocalCount = results.filter(r => r.vocalReport && r.vocalReport.original.vocalSectionsCount > 0).length;
      const instCount = results.length - vocalCount;

      const summaryTracks = tracks.map(t => {
        const info = updatedMap[t.id];
        const res = info?.result;
        const vocStatus = res?.vocalReport?.statusLabel || (res?.vocalReport ? 'Protegida' : 'Instrumental');
        return {
          trackId: t.id,
          trackName: t.name,
          sourceId: t.sourceId || t.id,
          status: (info?.isMastered ? 'completed' : info?.currentPhase === 'error' ? 'failed' : 'skipped') as 'completed' | 'warning' | 'failed' | 'skipped',
          originalLUFS: res?.before?.integratedLUFS ?? 0,
          masterLUFS: res?.after?.integratedLUFS ?? 0,
          truePeakDbTP: res?.after?.truePeakDbTP ?? -1.0,
          dynamicRangeLRA: res?.after?.dynamicRangeLRA ?? 0,
          vocalStatus: vocStatus,
          result: res,
          errorMessage: info?.errorMessage
        };
      });

      const summary: BulkMasteringSummary = {
        bulkSessionId: `bulk_${Date.now().toString(36)}`,
        totalTracks,
        completedCount: completedTracks,
        warningCount: 0,
        failedCount,
        originalAvgLUFS: parseFloat(avgOrigLUFS.toFixed(1)),
        masterAvgLUFS: parseFloat(avgMasterLUFS.toFixed(1)),
        maxTruePeakDbTP: parseFloat(maxTP.toFixed(1)),
        avgLRA: parseFloat(avgLRA.toFixed(1)),
        vocalApprovedCount: vocalCount,
        vocalPartialCount: 0,
        vocalWarningCount: 0,
        instrumentalCount: instCount,
        tracks: summaryTracks,

        // Backwards compatibility aliases
        completedTracks,
        failedTracks: failedCount,
        averageOriginalLUFS: parseFloat(avgOrigLUFS.toFixed(1)),
        averageMasterLUFS: parseFloat(avgMasterLUFS.toFixed(1)),
        averageLRA: parseFloat(avgLRA.toFixed(1)),
        vocalProtectedCount: vocalCount,
        items: summaryTracks
      };

      setBulkSummary(summary);
      setIsBulkSummaryOpen(true);

      // Select first mastered track
      const firstMastered = tracks.find(t => updatedMap[t.id]?.isMastered);
      if (firstMastered && updatedMap[firstMastered.id]?.result) {
        audioEngine.activateTrackForPlayback(firstMastered, updatedMap[firstMastered.id].result);
        setActiveTrackId(firstMastered.id);
        setParams(updatedMap[firstMastered.id].params!);
        setMasteringReport(updatedMap[firstMastered.id].result!);
        setIsBypassed(false);
      }
    }
  };

  // 3. Download Single Mastered WAV (Strictly from FinalMasterArtifact - Requirement 2 & 7)
  const handleDownloadSingleTrack = async (track: Track) => {
    try {
      const trackResult = trackMasterMap[track.id]?.result;
      const finalMasterBlob = await getVerifiedMasterBlob(trackResult, track.sourceId || track.id);
      const url = URL.createObjectURL(finalMasterBlob);
      const a = document.createElement('a');
      a.href = url;
      const originalName = track.name.replace(/\.[^/.]+$/, "");
      const downloadName = `${originalName}_Auramaster.wav`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setExportedFileName(downloadName);
      setIsExportSuccessOpen(true);
    } catch (err: any) {
      console.error("Download single track error:", err);
      alert("Error al exportar la pista: " + (err?.message || 'Error'));
    }
  };

  // 4. Download All Mastered as ZIP (Strictly from FinalMasterArtifact)
  const handleDownloadAllMasteredZip = async () => {
    if (tracks.length === 0) return;
    setIsExportingZip(true);
    try {
      const filesToZip: { name: string; blob: Blob }[] = [];

      for (const track of tracks) {
        const trackResult = trackMasterMap[track.id]?.result;
        if (trackResult) {
          const blob = await getVerifiedMasterBlob(trackResult, track.sourceId || track.id);
          const originalName = track.name.replace(/\.[^/.]+$/, "");
          filesToZip.push({ name: `${originalName}_Auramaster.wav`, blob });
        }
      }

      if (filesToZip.length > 0) {
        const zipBlob = await createMasteredZip(filesToZip);
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const zipName = `AuraMaster_Bulk_${new Date().toISOString().slice(0, 10)}.zip`;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 20000);
        setExportedFileName(zipName);
        setIsExportSuccessOpen(true);
      }
    } catch (err: any) {
      console.error("ZIP creation error:", err);
      alert(`Error al generar archivo ZIP: ${err?.message || 'Revisa la consola'}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleSmartMaster = async (type: string) => {
    setIsSmartAdjusting(true);
    setSmartMasterPhase('analyze');
    
    setTimeout(async () => {
      try {
        let newParams = { ...params };
        const currentPeak = Number.isFinite(fileStats.peak) ? fileStats.peak : -20;
        const TARGET_PEAK = -1.0;

        switch(type) {
            case 'clipping':
                if (currentPeak > TARGET_PEAK) {
                    const diff = TARGET_PEAK - currentPeak;
                    if (Number.isFinite(diff)) {
                        const gainMod = Math.pow(10, diff / 20);
                        if (Number.isFinite(gainMod) && gainMod > 0) {
                            newParams.gain *= gainMod;
                        }
                    }
                }
                break;
            case 'spotify':
                newParams = await audioEngine.applySpotifyNormalization(newParams, tracks);
                break;
            case 'peak':
                const pDiff = TARGET_PEAK - currentPeak;
                if (Number.isFinite(pDiff)) {
                    const pGainMod = Math.pow(10, pDiff / 20);
                    if (Number.isFinite(pGainMod) && pGainMod > 0) {
                         newParams.gain *= pGainMod;
                    }
                }
                newParams.limiter.threshold = TARGET_PEAK;
                break;
            case 'mono':
                newParams.stereoWidth = 0.85;
                break;
            case 'punch':
                newParams.transient.enabled = true;
                newParams.transient.amount = 40;
                newParams.transient.sustain = 5;
                break;
            case 'clean_noise':
                const noiseFloor = audioEngine.detectNoiseFloor(tracks);
                const thresh = Math.min(-20, noiseFloor + 8); 
                newParams.gate.enabled = true;
                newParams.gate.threshold = parseFloat(thresh.toFixed(1));
                newParams.gate.ratio = 5.0; 
                break;
            case 'super_mix': {
                if (processingMode === 'bulk' && activeTrackId) {
                  const activeTrack = tracks.find(t => t.id === activeTrackId);
                  if (activeTrack) {
                    await handleMasterSingleTrack(activeTrack);
                  }
                } else {
                  const targetSessionId = currentSessionIdRef.current;
                  const balancedTracks = audioEngine.autoBalanceTracks(tracks);
                  setTracks(balancedTracks);
                  const activeSourceId = tracks[0]?.sourceId || `stems_${tracks.map(t => t.sourceId || t.id).join('_')}`;
                  const result = await audioEngine.runMixerFixerAIMastering(
                    newParams, 
                    balancedTracks,
                    null,
                    activeSourceId,
                    targetSessionId,
                    (phase) => {
                      setSmartMasterPhase(phase);
                    }
                  );
                  // Verify session is still active
                  if (result.sessionId === currentSessionIdRef.current) {
                    newParams = result.appliedParams;
                    setMasteringReport(result);
                    setIsBypassed(false); // Enable master auditioning safely
                    setIsReportOpen(true);
                  }
                }
                break;
            }
        }
        
        if (type !== 'super_mix' || !(processingMode === 'bulk' && activeTrackId)) {
          newParams.gain = Math.max(0.1, Math.min(30.0, newParams.gain));
          setParams(newParams);
        }
      } catch (err: any) {
        console.error("Error en masterización inteligente:", err);
        alert(`Error al ejecutar masterización: ${err?.message || 'Error inesperado'}`);
      } finally {
        setIsSmartAdjusting(false);
        setSmartMasterPhase(null);
      }
    }, 50);
  };

  const handleAddReference = (ref: ReferenceTrack) => {
    setReferences(prev => [...prev, ref]);
  };

  const handleUpdateReference = (id: string, updates: Partial<ReferenceTrack>) => {
    setReferences(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleRemoveReference = (id: string) => {
    setReferences(prev => prev.filter(r => r.id !== id));
  };

  const handleRunReferenceMastering = async (config: ReferenceMasteringConfig) => {
    if (references.length === 0 || tracks.length === 0) return;
    setIsReferenceProcessing(true);

    try {
      const activeTracks = processingMode === 'bulk' && activeTrackId
        ? tracks.filter(t => t.id === activeTrackId)
        : tracks;

      const result = await audioEngine.runReferenceAIMastering(params, activeTracks, references, config);
      setParams(result.appliedParams);
      setMasteringReport(result);
      setIsReferenceModalOpen(false);
      setIsReportOpen(true);
    } catch (err: any) {
      console.error("Reference mastering failed:", err);
      alert(`Error al ejecutar mastering por referencia: ${err?.message || 'Revisa la consola'}`);
    } finally {
      setIsReferenceProcessing(false);
    }
  };

  const applyPreset = (id: string) => { 
    const p = PRESETS.find(pr => pr.id === id); 
    if (p) { setParams(p.params); setActivePreset(id); setIsBypassed(false); } 
  };

  const handleApplySelectionEdit = (action: 'gain' | 'fadeIn' | 'fadeOut' | 'mute', valueDb: number = 0) => {
    if (!selection || tracks.length === 0) return;
    const targetTrackId = processingMode === 'bulk' && activeTrackId ? activeTrackId : tracks[0].id;
    const currentBuf = audioEngine.getTrackBuffer(targetTrackId);
    if (!currentBuf) return;

    try {
      // Save snapshot for undo
      const prevClone = audioEngine.cloneAudioBuffer(currentBuf);
      setEditHistory(prev => [...prev.slice(-15), { trackId: targetTrackId, buffer: prevClone, description: action }]);

      const editedBuf = audioEngine.applySelectionEdit(currentBuf, selection.start, selection.end, action, valueDb);
      audioEngine.setTrackBuffer(targetTrackId, editedBuf);
      
      // If currently playing, smoothly re-seek so it immediately plays the edited audio
      if (playbackState === PlaybackState.PLAYING) {
        audioEngine.seek(currentTime, targetTrackId);
      }

      // Update state references for instant visualizer waveform redraw
      setTracks(prev => prev.map(t => t.id === targetTrackId ? { ...t } : t));
      setProcessedBuffer(editedBuf);
      setSelection(null);

      // Refresh metrics asynchronously in background (non-blocking)
      audioEngine.calculateAccurateDSPMetrics(editedBuf).then(metrics => {
        setFileStats({
          peak: metrics.truePeakDbTP,
          integrated: metrics.integratedLUFS,
          shortTerm: metrics.integratedLUFS
        });
      }).catch(err => console.error("Metrics calculation error:", err));
    } catch (err) {
      console.error("Selection edit error:", err);
    }
  };

  const handleStartNewProject = () => {
    audioEngine.stop();
    resetMixerFixerSession();
    audioEngine.clearAllTracks();
    setTracks([]);
    setActiveTrackId(null);
    setTrackMasterMap({});
    setCurrentTime(0);
    setDuration(0);
  };

  const handleDownloadFormat = async (bitDepth: 16 | 24 | 32) => {
    if (tracks.length === 0) return;
    try {
      const activeTrack = (processingMode === 'bulk' && activeTrackId) ? tracks.find(t => t.id === activeTrackId) : undefined;
      const exportTracks = activeTrack ? [activeTrack] : tracks;
      const selectedResult = activeTrack ? trackMasterMap[activeTrack.id]?.result : masteringReport || undefined;
      const artifact = selectedResult?.finalMasterArtifact;

      let blob: Blob | null = null;
      if (artifact) {
        if (bitDepth === 24) {
          blob = await getVerifiedMasterBlob(selectedResult, activeTrack?.sourceId || activeTrack?.id);
        } else {
          await getVerifiedMasterBlob(selectedResult, activeTrack?.sourceId || activeTrack?.id);
          blob = await audioEngine.exportAlternativeBitDepth(artifact, bitDepth);
        }
      } else {
        throw new Error('No existe un master verificado para exportar. Ejecuta Master Fixer de nuevo.');
      }

      if (blob) {
        if (bitDepth === 24 && artifact) {
          const hashBuf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
          const dlHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (dlHash !== artifact.sha256) {
            console.error("Format download SHA-256 mismatch:", dlHash, artifact.sha256);
          }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = exportTracks[0].name.replace(/\.[^/.]+$/, "");
        const suffix = bitDepth === 32 ? 'MasterArchive_32bitFloat' : bitDepth === 24 ? 'Spotify_24bit' : 'CD_16bit';
        const downloadName = `${originalName}_Auramaster_${suffix}.wav`;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Format download error:", err);
      alert("Error descargando formato.");
    }
  };

  const handleExport = async () => {
    if (tracks.length === 0) return;
    setIsExporting(true);
    setTimeout(async () => {
        try {
          if (processingMode === 'bulk' && activeTrackId) {
            const activeTrack = tracks.find(t => t.id === activeTrackId);
            if (activeTrack) {
              await handleDownloadSingleTrack(activeTrack);
            }
          } else {
          const blob = await getVerifiedMasterBlob(masteringReport || undefined, tracks[0]?.sourceId || tracks[0]?.id);
          if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const originalName = tracks[0].name.replace(/\.[^/.]+$/, "");
              const downloadName = `${originalName}_Auramaster.wav`;
              a.download = downloadName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              setExportedFileName(downloadName);

              if (masteringReport?.qcVerification) {
                setExportedQC(masteringReport.qcVerification);
              } else if (masteringReport?.finalMasterArtifact?.finalDecodedPCM) {
                const qc = await audioEngine.performExportQC(masteringReport.finalMasterArtifact.finalDecodedPCM, 24);
                setExportedQC(qc);
              }

              setIsExportSuccessOpen(true);
            }
          }
        } catch (err) {
          console.error("Export error:", err);
          alert("Error exporting audio.");
        } finally {
          setIsExporting(false);
        }
    }, 50);
  };

  const glassClass = "bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl";

  // Pre-DAW Authentication Gate
  if (!currentUser) {
    return (
      <AuthGate
        lang={lang}
        onLanguageChange={setLang}
        onLoginSuccess={(user) => setCurrentUser(user)}
      />
    );
  }

  return (
    <div className="h-full w-full overflow-hidden relative flex flex-col bg-[#030712] text-slate-100 selection:bg-cyan-500/30">
      <header className="shrink-0 z-50 px-4 sm:px-6 pt-3.5 pb-2">
        <div className={`max-w-7xl mx-auto flex items-center justify-between px-4 py-2.5 ${glassClass}`}>
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="AURAMASTER" 
              className="h-8 sm:h-9 w-auto object-contain rounded-lg shadow-sm" 
            />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-wider text-white leading-tight font-sans">
                AURAMASTER
              </span>
              <span className="text-[9px] font-bold tracking-widest text-cyan-400">
                MASTERING DAW
              </span>
            </div>
          </div>

          {/* Header Right Actions: Google OAuth & Multi-Language Selector */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <GoogleAuthButton onOpenAISettings={() => setIsAiSettingsOpen(true)} lang={lang} />

            <div className="flex items-center gap-1 p-1 bg-slate-950/90 border border-slate-800/80 rounded-xl shadow-inner">
              <Globe size={13} className="text-cyan-400 ml-1.5 mr-0.5 hidden sm:inline" />
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    localStorage.setItem('auramaster_lang', l.code);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    lang === l.code
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                  title={l.label}
                >
                  <span>{l.flag}</span>
                  <span className="uppercase text-[10px] font-bold">{l.code}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 sm:p-6 gap-5 overflow-y-auto no-scrollbar relative z-10">
         <Assistant 
           onApplyPreset={(newParams) => setParams(newParams)} 
           currentParams={params}
           lang={lang}
         />

         <div className="flex flex-col md:flex-row gap-5 shrink-0 min-h-[440px] md:h-[440px]">
            <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className={`flex-1 overflow-hidden relative min-h-0 flex flex-col ${glassClass}`}>
                    <div className="h-10 flex items-center justify-between px-4 border-b border-slate-800/80">
                        <div className="flex items-center gap-4 text-[10px] font-mono">
                            <span className="text-cyan-400 font-bold">PK: {Number.isFinite(fileStats.peak) ? fileStats.peak.toFixed(1) : '--'} dB</span>
                            <span className="text-slate-400">LUFS: {fileStats.integrated > -100 ? fileStats.integrated.toFixed(1) : '--'}</span>
                            {processingMode === 'bulk' && activeTrackId && (
                              <span className="text-cyan-300 font-bold hidden sm:inline">
                                Track: {tracks.find(t => t.id === activeTrackId)?.name}
                              </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {editHistory.length > 0 && (
                                <button 
                                    onClick={handleUndoEdit}
                                    className="px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 shadow-sm active:scale-95 animate-in fade-in"
                                    title="Deshacer última edición sobre selección (Ctrl+Z)"
                                >
                                    <Undo2 size={12} className="text-amber-400" />
                                    <span>{lang === 'es' ? 'Deshacer' : 'Undo'} ({editHistory.length})</span>
                                </button>
                            )}
                            {masteringReport && (
                                <button 
                                    onClick={() => setIsReportOpen(true)}
                                    className="px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20"
                                    title="Ver Reporte DSP"
                                >
                                    <Sparkles size={11} className="text-cyan-400" />
                                    <span>DSP Report</span>
                                </button>
                            )}
                            {(() => {
                              const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0];
                              const hasActiveMaster = processingMode === 'bulk'
                                ? Boolean(activeTrack && trackMasterMap[activeTrack.id]?.isMastered && trackMasterMap[activeTrack.id]?.result?.sourceId === (activeTrack.sourceId || activeTrack.id) && audioEngine.hasValidMaster(activeTrack.sourceId || activeTrack.id))
                                : Boolean(audioEngine.hasValidMaster() && masteringReport && activeTrack && masteringReport.sourceId === (activeTrack.sourceId || activeTrack.id));
                              const comparisonGainDb = audioEngine.getComparisonGainDb();

                              return (
                                <div className="flex items-center gap-1.5">
                                  {/* Loudness Match Toggle */}
                                  {hasActiveMaster && (
                                    <button
                                      onClick={() => setLoudnessMatchMode(prev => prev === 'matched' ? 'actual' : 'matched')}
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all flex items-center gap-1 shadow-sm ${
                                        loudnessMatchMode === 'matched'
                                          ? 'bg-purple-950/70 border-purple-500/50 text-purple-200 hover:bg-purple-900/60'
                                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                                      }`}
                                      title={
                                        loudnessMatchMode === 'matched'
                                          ? `Comparación de timbre: se iguala el volumen. Si el master solo cambia de nivel, puede sonar igual. Compensación relativa: ${comparisonGainDb > 0 ? '+' : ''}${comparisonGainDb.toFixed(1)} dB para comparar timbre y voz sin sesgo de volumen`
                                          : 'Nivel Real de Exportación: Escuchando el volumen real del master final (sin compensación de ganancia)'
                                      }
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${loudnessMatchMode === 'matched' ? 'bg-purple-400 animate-pulse' : 'bg-slate-500'}`} />
                                      <span>
                                        {loudnessMatchMode === 'matched'
                                          ? `Igualar volumen (${comparisonGainDb > 0 ? '+' : ''}${comparisonGainDb.toFixed(1)} dB)`
                                          : 'Volumen de entrega'}
                                      </span>
                                    </button>
                                  )}

                                  {/* Synchronized Transparent A/B Switch */}
                                  <button 
                                      onClick={() => {
                                        if (!hasActiveMaster) {
                                          setIsBypassed(true);
                                          return;
                                        }
                                        setIsBypassed(!isBypassed);
                                      }} 
                                      disabled={!hasActiveMaster}
                                      className={`px-3.5 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                                        !hasActiveMaster
                                          ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-80"
                                          : isBypassed 
                                            ? "bg-amber-500 hover:bg-amber-400 text-black" 
                                            : "bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-extrabold"
                                      }`}
                                      title={!hasActiveMaster ? (lang === 'es' ? 'Audio Original (sin masterizar)' : 'Original Audio (unmastered)') : isBypassed ? "Escuchar WAV masterizado" : "Escuchar original"}
                                  >
                                      {isBypassed || !hasActiveMaster ? <VolumeX size={12}/> : <CheckCircle2 size={12}/>}
                                      <span>
                                        {!hasActiveMaster 
                                          ? (lang === 'es' ? 'ORIGINAL (Sin Master)' : 'ORIGINAL (Raw)') 
                                          : isBypassed ? t.originalRaw : t.masteredDsp}
                                      </span>
                                  </button>
                                </div>
                              );
                            })()}
                        </div>
                    </div>
                    {(() => {
                      const activeTrack = tracks.find(t => t.id === activeTrackId) || tracks[0];
                      const activeTrackBuf = activeTrack ? audioEngine.getTrackBuffer(activeTrack.id) : null;
                      const visBuffer = isBypassed 
                        ? (activeTrackBuf || processedBuffer) 
                        : (processedBuffer || activeTrackBuf);
                      const visDuration = duration > 0 
                        ? duration 
                        : (visBuffer ? visBuffer.duration : (activeTrackBuf ? activeTrackBuf.duration : 0));

                      return (
                        <div className="flex-1 min-h-0 relative flex flex-col w-full h-full">
                            <Visualizer 
                              audioBuffer={visBuffer} 
                              currentTime={currentTime} 
                              duration={visDuration} 
                              isPlaying={playbackState === PlaybackState.PLAYING} 
                              isRendering={isPreviewRendering || loadingAudio || isBulkMastering || isSmartAdjusting} 
                              mode={visualizerMode} 
                              skin="modern" 
                              selection={selection}
                              onSelectionChange={setSelection}
                              onApplySelectionEdit={handleApplySelectionEdit}
                              canUndo={editHistory.length > 0}
                              onUndo={handleUndoEdit}
                              onSeek={handleSeek} 
                              lang={lang}
                            />
                        </div>
                      );
                    })()}
                </div>
                {/* Dedicated Timeline adapted to real track duration */}
                <TimelineBar 
                  currentTime={currentTime}
                  duration={duration}
                  isPlaying={playbackState === PlaybackState.PLAYING}
                  onSeek={handleSeek}
                  trackName={activeTrackId ? tracks.find(t => t.id === activeTrackId)?.name : tracks[0]?.name}
                />
                <MeterBar skin="modern" />
            </div>

            {/* Files Box Component with Stems / Bulk Toggle */}
            <div className="w-full md:w-80 flex flex-col h-full min-h-0 shrink-0">
                <FilesBox 
                  tracks={tracks}
                  activeTrackId={activeTrackId}
                  onSelectTrack={handleSelectTrack}
                  onRemoveTrack={handleRemoveTrack}
                  onTrackChange={(id, u) => setTracks(prev => prev.map(tr => tr.id === id ? {...tr, ...u} : tr))}
                  processingMode={processingMode}
                  onModeChange={setProcessingMode}
                  onImportClick={() => fileInputRef.current?.click()}
                  trackMasterMap={trackMasterMap}
                  onMasterSingleTrack={handleMasterSingleTrack}
                  onMasterAllTracks={handleMasterAllTracks}
                  onDownloadSingleTrack={handleDownloadSingleTrack}
                  onDownloadAllMasteredZip={handleDownloadAllMasteredZip}
                  onViewReport={(res) => {
                    setMasteringReport(res);
                    setIsReportOpen(true);
                  }}
                  isBulkMastering={isBulkMastering}
                  bulkProgress={bulkProgress}
                  isExportingZip={isExportingZip}
                  skin="modern"
                  lang={lang}
                />
                <input type="file" multiple ref={fileInputRef} onChange={handleAddTrack} className="hidden" />
            </div>
         </div>

         <div className="flex-1 flex flex-col gap-4">
             <div className={`p-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar ${glassClass}`}>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePlayPause} 
                    className="w-10 h-10 bg-gradient-to-tr from-cyan-600 to-cyan-400 rounded-full flex items-center justify-center text-black font-bold shrink-0 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
                  >
                      {playbackState === PlaybackState.PLAYING ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <div className="flex gap-1.5">
                      {PRESETS.map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => applyPreset(p.id)} 
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${
                            activePreset === p.id 
                              ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-300 shadow-sm" 
                              : "border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsReferenceModalOpen(true)}
                    disabled={tracks.length === 0}
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-200 shadow-md shadow-indigo-950/30 active:scale-95"
                    title="Mastering inteligente por canciones de referencia"
                  >
                    <Disc size={15} className="text-indigo-400" />
                    <span>Referencia {references.length > 0 ? `(${references.length})` : ''}</span>
                  </button>

                  {processingMode === 'bulk' && tracks.length > 1 && (
                    <button
                      onClick={handleDownloadAllMasteredZip}
                      disabled={isExportingZip || isBulkMastering || tracks.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                    >
                      {isExportingZip ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} className="text-cyan-400" />}
                      <span>{t.exportAllZip}</span>
                    </button>
                  )}

                  <button 
                    onClick={handleExport}
                    disabled={isExporting || tracks.length === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                      isExporting 
                        ? "bg-slate-800 text-slate-400 cursor-wait" 
                        : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/20 active:scale-95"
                    }`}
                  >
                    {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span>{isExporting ? t.exporting : processingMode === 'bulk' ? t.singleTrackMaster : t.exportMaster}</span>
                  </button>
                </div>
             </div>
              <div className="flex-1 min-h-[400px]">
                 <EffectRack 
                  params={params} 
                  onChange={setParams} 
                  tracks={tracks} 
                  onTrackChange={(id, u) => setTracks(prev => prev.map(t => t.id === id ? {...t, ...u} : t))} 
                  onRemove={handleRemoveTrack} 
                  skin="modern" 
                  lang={lang}
                  analysisStats={fileStats} 
                  onSmartMaster={handleSmartMaster}
                  isSmartAdjusting={isSmartAdjusting}
                  smartMasterPhase={smartMasterPhase}
                  selection={selection}
                  activeTrackId={activeTrackId}
                  onSelectTrack={handleSelectTrack}
                  onOpenReferenceMastering={() => setIsReferenceModalOpen(true)}
                  referenceCount={references.length}
                />
             </div>
         </div>
      </main>

      <ReferenceMasteringModal 
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        references={references}
        onAddReference={handleAddReference}
        onUpdateReference={handleUpdateReference}
        onRemoveReference={handleRemoveReference}
        onRunMastering={handleRunReferenceMastering}
        skin={skin}
        lang={lang}
        isProcessing={isReferenceProcessing}
      />

      <AIMasteringReportModal 
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        result={masteringReport}
        isBypassed={isBypassed}
        onToggleBypass={() => setIsBypassed(!isBypassed)}
        loudnessMatchMode={loudnessMatchMode}
        onToggleLoudnessMatch={() => setLoudnessMatchMode(prev => prev === 'matched' ? 'actual' : 'matched')}
        lang={lang}
      />

      {/* Bulk Mastering Summary Modal */}
      <BulkMasteringSummaryModal
        isOpen={isBulkSummaryOpen}
        onClose={() => setIsBulkSummaryOpen(false)}
        summary={bulkSummary}
        trackMasterMap={trackMasterMap}
        onOpenTrackReport={(trackId) => {
          const res = trackMasterMap[trackId]?.result;
          if (res) {
            setMasteringReport(res);
            setIsReportOpen(true);
          }
        }}
        onDownloadSingleTrack={(trackId) => {
          const t = tracks.find(trk => trk.id === trackId);
          if (t) handleDownloadSingleTrack(t);
        }}
        onDownloadAllZip={handleDownloadAllMasteredZip}
        isExportingZip={isExportingZip}
        skin={skin}
        lang={lang}
      />

      {/* Secure VPS AES-256-GCM AI Vault Modal */}
      <AISettingsModal 
        isOpen={isAiSettingsOpen} 
        onClose={() => setIsAiSettingsOpen(false)} 
        onConfigSaved={() => {}} 
      />

      {/* Export Success & Chart Melodia Community Modal */}
      <ExportSuccessModal
        isOpen={isExportSuccessOpen}
        onClose={() => setIsExportSuccessOpen(false)}
        fileName={exportedFileName}
        lang={lang}
        onStartNewProject={handleStartNewProject}
        qc={exportedQC || masteringReport?.qcVerification}
        onDownloadFormat={handleDownloadFormat}
      />

      {/* Global Apple Pro Loading Overlay */}
      {(loadingAudio || isBulkMastering) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-xl shadow-cyan-500/20">
              <Loader2 size={36} className="animate-spin text-cyan-400" />
            </div>
            <div className="flex flex-col items-center text-center gap-1">
              <span className="text-sm font-bold tracking-wide text-white">
                {loadingAudio ? (lang === 'es' ? 'Cargando y decodificando audio...' : 'Loading & decoding audio...') : (lang === 'es' ? 'Masterizando pistas por lote...' : 'Batch mastering tracks...')}
              </span>
              {isBulkMastering && bulkProgress && (
                <span className="max-w-[420px] truncate text-xs font-semibold text-cyan-300">
                  {bulkProgress.current}/{bulkProgress.total} · {bulkProgress.trackName}
                </span>
              )}
              <span className="text-xs text-slate-400 font-medium font-mono">
                {lang === 'es' ? 'Procesamiento 32-bit Float DSP de alta fidelidad' : 'High-fidelity 32-bit Float DSP processing'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
