
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Activity, Download, Loader2, Globe, Sparkles, Zap, Disc, Plus, FileAudio, FolderOpen, Settings2, Sliders, Cpu, Headphones, Music, Guitar, Leaf, CheckCircle2, Monitor, Maximize2, Minimize2, VolumeX, PenTool, UploadCloud, BrainCircuit, BarChart2, Archive, Undo2 } from 'lucide-react';
import { audioEngine } from './services/audioEngine';
import { MasteringChainParams, PlaybackState, Track, SkinMode, ProcessingMode, TrackMasterInfo, AIMasteringResult } from './types';
import { Visualizer } from './components/Visualizer';
import { EffectRack } from './components/EffectRack';
import { TimelineBar } from './components/TimelineBar';
import { MeterBar } from './components/MeterBar';
import { Assistant } from './components/Assistant';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { AuthGate } from './components/AuthGate';
import { AISettingsModal } from './components/AISettingsModal';
import { AIMasteringReportModal } from './components/AIMasteringReportModal';
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
      low: { frequency: 100, gain: 1.5, q: 0.7 },
      lowMid: { frequency: 320, gain: -0.8, q: 1 },
      mid: { frequency: 1000, gain: 0, q: 1 },
      highMid: { frequency: 3200, gain: 1.2, q: 1 },
      high: { frequency: 10000, gain: 2.0, q: 0.7 }
  },
  multiband: {
     enabled: true,
     low: { ...DEFAULT_COMP, threshold: -16, ratio: 2.5, attack: 0.03, release: 0.2 },
     mid: { ...DEFAULT_COMP, threshold: -18, ratio: 2.0, attack: 0.025, release: 0.15 },
     high: { ...DEFAULT_COMP, threshold: -20, ratio: 1.8, attack: 0.015, release: 0.10 }
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
  gain: 1.45, // +3.2dB clean mastering gain
  stereoWidth: 1.15, // +15% enhanced stereo air
  limiter: { enabled: true, threshold: -1.0, breathe: 0 } // Strict -1.0dB true-peak ceiling with soft knee
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
  const [isBypassed, setIsBypassed] = useState(false); 
  const [activePreset, setActivePreset] = useState<string>('universal');
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isPreviewRendering, setIsPreviewRendering] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'waveform' | 'spectrum' | 'vector'>('waveform');
  const [fileStats, setFileStats] = useState({ peak: -Infinity, integrated: -100, shortTerm: -100 });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSmartAdjusting, setIsSmartAdjusting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selection, setSelection] = useState<{start: number, end: number} | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => authService.getUser());
  const [masteringReport, setMasteringReport] = useState<AIMasteringResult | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isExportSuccessOpen, setIsExportSuccessOpen] = useState(false);
  const [exportedFileName, setExportedFileName] = useState('');
  const [editHistory, setEditHistory] = useState<{ trackId: string; buffer: AudioBuffer; description: string }[]>([]);

  useEffect(() => {
    return authService.subscribe((u) => setCurrentUser(u));
  }, []);

  const t = getT(lang);

  // Bulk Mastering & Files State
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('stems');
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [trackMasterMap, setTrackMasterMap] = useState<Record<string, TrackMasterInfo>>({});
  const [isBulkMastering, setIsBulkMastering] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; trackName: string } | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    audioEngine.onPlaybackEnded = () => { setPlaybackState(PlaybackState.STOPPED); setCurrentTime(0); };
    return () => { audioEngine.onPlaybackEnded = null; };
  }, []);

  useEffect(() => { audioEngine.setMasterParams(params); }, [params]);
  useEffect(() => { audioEngine.setBypass(isBypassed); }, [isBypassed]);
  
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
        if (processingMode === 'bulk' && activeTrackId) {
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
  }, [params, tracks, loadingAudio, processingMode, activeTrackId, trackMasterMap]);

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
        const added: Track[] = [];
        for (const file of newFiles) added.push(await audioEngine.addTrack(file)); 
        
        let allTracks = [...tracks, ...added];
        const newParams = { ...params };
        
        // Stems auto-balance logic if in stems mode
        if (processingMode === 'stems' && allTracks.length > 1) {
            allTracks = audioEngine.autoBalanceTracks(allTracks);
            newParams.gain = 1.0;
        }

        // Safety limit (-1.0 dBTP strict with soft knee)
        newParams.limiter.enabled = true;
        newParams.limiter.threshold = -1.0;
        newParams.limiter.breathe = 0;
        
        setTracks(allTracks);
        setParams(newParams);
        setIsBypassed(false); 
        if (added.length > 0) {
          const newActiveId = activeTrackId || added[0].id;
          setActiveTrackId(newActiveId);
          const activeBuf = audioEngine.getTrackBuffer(newActiveId);
          if (activeBuf) {
            setDuration(activeBuf.duration);
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
    audioEngine.seek(0, id);
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

    if (trackMasterMap[id]?.params) {
      setParams(trackMasterMap[id].params!);
    }
    if (trackMasterMap[id]?.result) {
      setMasteringReport(trackMasterMap[id].result!);
    }
    
    // If audio is currently playing in bulk mode, start the newly selected song immediately from 00:00
    if (playbackState === PlaybackState.PLAYING && processingMode === 'bulk') {
      audioEngine.play(id);
    }
  };

  // 1. Single Track Mastering (Bulk Mode)
  const handleMasterSingleTrack = async (track: Track) => {
    setTrackMasterMap(prev => ({
      ...prev,
      [track.id]: { trackId: track.id, isProcessing: true, isMastered: false }
    }));
    setActiveTrackId(track.id);

    try {
      const result = await audioEngine.runMixerFixerAIForSingleTrack(params, track);
      setTrackMasterMap(prev => ({
        ...prev,
        [track.id]: {
          trackId: track.id,
          isMastered: true,
          isProcessing: false,
          result,
          params: result.appliedParams
        }
      }));
      setParams(result.appliedParams);
      setMasteringReport(result);
      setIsReportOpen(true);
    } catch (err) {
      console.error("Error mastering single track:", err);
      setTrackMasterMap(prev => ({
        ...prev,
        [track.id]: { trackId: track.id, isProcessing: false, isMastered: false }
      }));
      alert(`Error mastering ${track.name}`);
    }
  };

  // 2. Bulk Master All Tracks
  const handleMasterAllTracks = async () => {
    if (tracks.length === 0) return;
    setIsBulkMastering(true);
    
    const updatedMap = { ...trackMasterMap };
    let lastResult: AIMasteringResult | null = null;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      setBulkProgress({ current: i + 1, total: tracks.length, trackName: track.name });
      
      updatedMap[track.id] = { trackId: track.id, isProcessing: true, isMastered: false };
      setTrackMasterMap({ ...updatedMap });

      try {
        const result = await audioEngine.runMixerFixerAIForSingleTrack(params, track);
        updatedMap[track.id] = {
          trackId: track.id,
          isMastered: true,
          isProcessing: false,
          result,
          params: result.appliedParams
        };
        lastResult = result;
        setTrackMasterMap({ ...updatedMap });
      } catch (err) {
        console.error(`Error mastering ${track.name}:`, err);
        updatedMap[track.id] = { trackId: track.id, isProcessing: false, isMastered: false };
        setTrackMasterMap({ ...updatedMap });
      }
    }

    setIsBulkMastering(false);
    setBulkProgress(null);
    
    if (lastResult) {
      setMasteringReport(lastResult);
      setIsReportOpen(true);
    }
  };

  // 3. Download Single Mastered WAV
  const handleDownloadSingleTrack = async (track: Track) => {
    try {
      const trackParams = trackMasterMap[track.id]?.params || params;
      const blob = await audioEngine.exportSingleTrackAudio(trackParams, track, 24);
      if (blob) {
        const url = URL.createObjectURL(blob);
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
      }
    } catch (err) {
      console.error("Download single track error:", err);
      alert("Error al exportar la pista.");
    }
  };

  // 4. Download All Mastered as ZIP
  const handleDownloadAllMasteredZip = async () => {
    if (tracks.length === 0) return;
    setIsExportingZip(true);
    try {
      const filesToZip: { name: string; blob: Blob }[] = [];

      for (const track of tracks) {
        const trackParams = trackMasterMap[track.id]?.params || params;
        const blob = await audioEngine.exportSingleTrackAudio(trackParams, track, 24);
        if (blob) {
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
    
    setTimeout(async () => {
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
                  const balancedTracks = audioEngine.autoBalanceTracks(tracks);
                  setTracks(balancedTracks);
                  const result = await audioEngine.runMixerFixerAIMastering(newParams, balancedTracks);
                  newParams = result.appliedParams;
                  setMasteringReport(result);
                  setIsReportOpen(true);
                }
                break;
            }
        }
        
        if (type !== 'super_mix' || !(processingMode === 'bulk' && activeTrackId)) {
          newParams.gain = Math.max(0.1, Math.min(30.0, newParams.gain));
          setParams(newParams);
        }
        setIsSmartAdjusting(false);
    }, 100);
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
    setTracks([]);
    setActiveTrackId(null);
    setTrackMasterMap({});
    setProcessedBuffer(null);
    setEditHistory([]);
    setParams(DEFAULT_PARAMS);
    setSelection(null);
    setMasteringReport(null);
    setCurrentTime(0);
    setDuration(0);
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
            const blob = await audioEngine.exportAudio(params, tracks, 24);
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

         <div className="flex flex-col md:flex-row gap-5 shrink-0 h-[340px]">
            <div className="flex-1 flex flex-col gap-3">
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
                            <button 
                                onClick={() => setIsBypassed(!isBypassed)} 
                                className={`px-3.5 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${isBypassed ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-extrabold"}`}
                                title={isBypassed ? "Activar Master DSP" : "Bypass (Raw)"}
                            >
                                {isBypassed ? <VolumeX size={12}/> : <CheckCircle2 size={12}/>}
                                <span>{isBypassed ? t.originalRaw : t.masteredDsp}</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        <Visualizer 
                          audioBuffer={isBypassed 
                            ? ((activeTrackId ? audioEngine.getTrackBuffer(activeTrackId) : tracks[0] ? audioEngine.getTrackBuffer(tracks[0].id) : null) || processedBuffer)
                            : (processedBuffer || (activeTrackId ? audioEngine.getTrackBuffer(activeTrackId) : tracks[0] ? audioEngine.getTrackBuffer(tracks[0].id) : null))
                          } 
                          currentTime={currentTime} 
                          duration={duration} 
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
             <div className={`flex-1 min-h-[400px] ${isBypassed ? "opacity-30 pointer-events-none" : ""}`}>
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
                  selection={selection}
                  activeTrackId={activeTrackId}
                  onSelectTrack={handleSelectTrack}
                />
             </div>
         </div>
      </main>

      <AIMasteringReportModal 
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        result={masteringReport}
        isBypassed={isBypassed}
        onToggleBypass={() => setIsBypassed(!isBypassed)}
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
