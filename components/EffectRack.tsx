
import React, { useState } from 'react';
import { MasteringChainParams, Track, EQParams, EQBand, SkinMode } from '../types';
import { SliderControl } from './Knob.tsx';
import { VisualEQ } from './VisualEQ.tsx';
import { Sliders, Activity, Volume2, Layers, Zap, Waves, Hexagon, Speaker, Settings2, BarChart2, Hammer, Maximize2, Minimize2, Wand2, Power, Smartphone, Disc, Infinity, Wrench, CheckCircle2, AlertTriangle, Monitor, MoveHorizontal, Scissors, Sparkles, VolumeX } from 'lucide-react';
import { MixerChannel } from './MixerChannel';
import { AnalysisDashboard } from './AnalysisDashboard';
import { audioEngine } from '../services/audioEngine';

import { Language, getT } from '../services/i18n';

interface EffectRackProps {
  params: MasteringChainParams;
  onChange: (params: MasteringChainParams) => void;
  tracks: Track[];
  onTrackChange: (id: string, updates: Partial<Track>) => void;
  onRemove: (id: string) => void;
  skin?: SkinMode;
  lang?: Language;
  analysisStats?: { integrated: number; peak: number; shortTerm: number };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSmartMaster?: (type: 'spotify' | 'peak' | 'combo' | 'punch' | 'mono' | 'clipping' | 'super_mix' | 'clean_noise', selectionRange?: {start: number, end: number} | null) => void;
  selection?: {start: number, end: number} | null;
  isSmartAdjusting?: boolean;
  activeTrackId?: string | null;
  onSelectTrack?: (id: string) => void;
}

const EffectRack: React.FC<EffectRackProps> = ({ params, onChange, tracks, onTrackChange, onRemove, skin = 'modern', lang = 'es', analysisStats, isExpanded = false, onToggleExpand, onSmartMaster, selection, isSmartAdjusting, activeTrackId, onSelectTrack }) => {
  const [activeTab, setActiveTab] = useState<'fixers' | 'mixer' | 'dynamics' | 'eq' | 'transient' | 'color' | 'lofi' | 'space' | 'analysis'>('fixers');
  const [compBand, setCompBand] = useState<'low' | 'mid' | 'high'>('mid');
  const [selectedEQBand, setSelectedEQBand] = useState<keyof EQParams | null>('mid'); 
  const [isAutoMixing, setIsAutoMixing] = useState(false);

  const t = getT(lang);
  const isClear = false; // Unified Apple Pro Dark Studio Theme

  // Analysis Logic for Fixers
  const peak = analysisStats?.peak ?? -100;
  const lufs = analysisStats?.integrated ?? -100;
  const hasClipping = peak > 0;
  const hasSafePeakIssue = peak > -0.9;
  const hasLufsIssue = lufs > -100 && (Math.abs(lufs - (-14)) > 1.5);
  
  const updateEQ = (key: keyof EQParams, val: EQBand) => {
    onChange({ ...params, eq: { ...params.eq, [key]: val } });
  };
  const updateComp = (band: 'low' | 'mid' | 'high', key: keyof typeof params.multiband.mid, val: number) => {
    onChange({ ...params, multiband: { ...params.multiband, [band]: { ...params.multiband[band], [key]: val } } });
  };

  const handleAutoMix = () => {
     setIsAutoMixing(true);
     setTimeout(() => {
         const newTracks = audioEngine.autoBalanceTracks(tracks);
         newTracks.forEach(t => onTrackChange(t.id, { volume: t.volume }));
         setIsAutoMixing(false);
     }, 600);
  };

  const getBandLabel = (b: string) => {
      switch(b) {
          case 'low': return 'Low Shelf';
          case 'lowMid': return 'Low-Mid Bell';
          case 'mid': return 'Mid Bell';
          case 'highMid': return 'High-Mid Bell';
          case 'high': return 'High Shelf';
          default: return b;
      }
  }

  // 1. Fixers First, 2. Mixer Second
  const tabs = [
      { id: 'fixers', label: t.fixersTab, icon: Wrench, color: 'text-rose-400' },
      { id: 'mixer', label: t.mixerTab, icon: Settings2, color: 'text-emerald-400' },
      { id: 'dynamics', label: t.dynamicsTab, icon: Activity, color: 'text-cyan-400' },
      { id: 'eq', label: t.eqTab, icon: Sliders, color: 'text-purple-400' },
      { id: 'transient', label: t.punchTab, icon: Hammer, color: 'text-yellow-400' },
      { id: 'color', label: t.colorTab, icon: Zap, color: 'text-orange-400' },
      { id: 'lofi', label: t.lofiTab, icon: Disc, color: 'text-red-400' },
      { id: 'space', label: 'Space', icon: Waves, color: 'text-pink-400' },
      { id: 'analysis', label: 'Analysis', icon: BarChart2, color: 'text-indigo-400' },
  ] as const;
  
  const containerClass = "bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl";
  const tabButtonBase = "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5 font-sans text-xs rounded-xl";
  const tabButtonActive = "bg-slate-800 text-white border border-slate-700/80 shadow-md rounded-xl font-semibold";
  const cardClass = "bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80";
  const headerTextClass = "text-xs font-semibold uppercase tracking-wider text-slate-300";

  const PowerToggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: () => void }) => (
      <button 
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${enabled ? (isClear ? "bg-emerald-500 text-white shadow-md" : "bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.6)]") : (isClear ? "bg-slate-200 text-slate-400" : "bg-white/10 text-slate-500")}`}
        title={enabled ? "Bypass" : "Enable"}
      >
          <Power size={12} strokeWidth={3} />
      </button>
  );

  const QuickPreset = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
      <button 
        onClick={onClick}
        className={`px-2 py-1 text-[9px] font-bold uppercase rounded border transition-all ${active ? (isClear ? "bg-slate-800 text-white border-slate-800" : "bg-cyan-500/20 text-cyan-400 border-cyan-500/50") : (isClear ? "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100" : "bg-transparent text-slate-500 border-white/10 hover:border-white/20")}`}
      >
          {label}
      </button>
  );

  return (
    <div className={`overflow-hidden flex flex-col w-full h-full ${containerClass}`}>
      {!isClear && <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />}
      
      {/* Header with Tabs and Expand Button */}
      <div className="p-3 shrink-0 z-10 flex items-center gap-2">
          {/* Tabs Container */}
          <div className={`flex-1 flex p-1 overflow-x-auto no-scrollbar ${isClear ? "gap-2" : "bg-black/40 rounded-xl border border-white/5"}`}>
             {tabs.map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`flex-1 min-w-[70px] py-2 px-3 tracking-wide transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        activeTab === tab.id ? tabButtonActive : tabButtonBase
                    }`}
                 >
                    <tab.icon size={14} className={activeTab === tab.id ? (isClear ? 'text-white' : tab.color) : 'opacity-70'}/> 
                    <span className="hidden sm:inline">{tab.label}</span>
                 </button>
             ))}
          </div>

          {/* Expand/Collapse Button */}
          {onToggleExpand && (
              <button 
                onClick={onToggleExpand}
                className={`shrink-0 p-2.5 rounded-xl transition-all ${isClear ? "bg-white border border-black/5 text-slate-400 hover:text-slate-900 hover:shadow-sm" : "bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:bg-white/10"}`}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
          )}
      </div>

      {/* Content Area */}
      <div className={`px-4 pb-4 flex-1 relative z-0 overflow-y-auto custom-scrollbar`}>
        
        {/* MIXER TAB */}
        {activeTab === 'mixer' && (
             <div className="h-full w-full animate-in fade-in zoom-in-95 duration-300 relative">
                 {tracks.length > 0 && (
                     <div className={`sticky top-0 z-20 mb-3 p-2 rounded-xl flex items-center justify-between ${isClear ? "bg-white/80 border border-black/5 backdrop-blur-md" : "bg-black/40 border border-white/5 backdrop-blur-md"}`}>
                        <div className={`text-xs font-bold uppercase tracking-wider ${isClear ? "text-slate-500" : "text-slate-400"}`}>
                            {tracks.length} Stems
                        </div>
                        <button 
                            onClick={handleAutoMix}
                            disabled={isAutoMixing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isClear ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"}`}
                        >
                            <Wand2 size={12} className={isAutoMixing ? "animate-spin" : ""} />
                            {isAutoMixing ? "Balancing..." : "Auto-Level Mix"}
                        </button>
                     </div>
                 )}

                 {tracks.length === 0 ? (
                     <div className="flex flex-col items-center justify-center text-slate-600 h-full w-full min-h-[200px]">
                         <div className={`p-4 mb-4 ${isClear ? "bg-slate-100 rounded-full border border-slate-200" : "rounded-full bg-white/5 border border-white/5"}`}>
                            <Volume2 size={32} className="opacity-50" />
                         </div>
                         <p className="text-xs font-medium uppercase tracking-wider">No tracks loaded</p>
                     </div>
                 ) : (
                     <div className={`grid grid-cols-1 gap-3 w-full md:grid-cols-2 lg:grid-cols-3 max-h-[420px] overflow-y-auto pr-1`}>
                        {tracks.map(track => (
                             <MixerChannel 
                                key={track.id} 
                                track={track} 
                                onChange={onTrackChange} 
                                onRemove={onRemove} 
                                skin={skin} 
                                variant="full" 
                                isSelected={activeTrackId === track.id}
                                onSelect={(id) => onSelectTrack && onSelectTrack(id)}
                             />
                        ))}
                     </div>
                 )}
             </div>
        )}

        {/* DYNAMICS TAB */}
        {activeTab === 'dynamics' && (
            <div className={`grid grid-cols-1 gap-4 animate-in fade-in zoom-in-95 duration-300 md:grid-cols-2 lg:grid-cols-4`}>
                <div className={`${cardClass} flex flex-col justify-start gap-3`}>
                    <div className="flex items-center justify-between">
                         <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-cyan-400"} flex items-center gap-2`}><Hexagon size={14} /> Gate</h3>
                         <PowerToggle enabled={params.gate.enabled} onToggle={() => onChange({...params, gate: {...params.gate, enabled: !params.gate.enabled}})} />
                    </div>
                    <div className="space-y-4">
                        <SliderControl skin={skin} variant="cyan" label="Threshold" value={params.gate.threshold} min={-100} max={0} step={1} unit="dB" onChange={(v) => onChange({...params, gate: {...params.gate, threshold: v}})} />
                        <SliderControl skin={skin} variant="cyan" label="Reduction" value={params.gate.ratio} min={0} max={40} step={0.5} unit="dB" onChange={(v) => onChange({...params, gate: {...params.gate, ratio: v}})} />
                    </div>
                </div>
                
                {/* Multiband */}
                <div className={`${cardClass} md:col-span-2 order-last md:order-none lg:order-none`}>
                    <div className={`flex justify-between items-center mb-4 pb-2 ${isClear ? "border-b border-black/5" : "border-b border-white/5"}`}>
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-cyan-400"} flex items-center gap-2`}><Layers size={14}/> Multiband</h3>
                        <div className="flex items-center gap-3">
                             <div className={`flex p-0.5 ${isClear ? "gap-1" : "bg-black/40 rounded-lg border border-white/5"}`}>
                                {(['low', 'mid', 'high'] as const).map(b => (
                                    <button key={b} onClick={() => setCompBand(b)} className={`px-3 py-1 text-[10px] uppercase font-bold transition-all ${compBand === b ? (isClear ? 'bg-slate-900 text-white rounded-md shadow-md' : 'bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)] rounded-[6px]') : (isClear ? 'bg-white text-slate-600 hover:bg-slate-50' : 'text-slate-500 hover:text-slate-300')}`}>{b}</button>
                                ))}
                            </div>
                            <PowerToggle enabled={params.multiband.enabled} onToggle={() => onChange({...params, multiband: {...params.multiband, enabled: !params.multiband.enabled}})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <SliderControl skin={skin} variant="cyan" label="Threshold" value={params.multiband[compBand].threshold} min={-60} max={0} step={1} unit="dB" onChange={(v) => updateComp(compBand, 'threshold', v)} />
                        <SliderControl skin={skin} variant="cyan" label="Ratio" value={params.multiband[compBand].ratio} min={1} max={20} step={0.5} unit=":1" onChange={(v) => updateComp(compBand, 'ratio', v)} />
                        <SliderControl skin={skin} variant="cyan" label="Attack" value={params.multiband[compBand].attack} min={0} max={1} step={0.01} unit="s" onChange={(v) => updateComp(compBand, 'attack', v)} />
                        <SliderControl skin={skin} variant="cyan" label="Release" value={params.multiband[compBand].release} min={0} max={1} step={0.01} unit="s" onChange={(v) => updateComp(compBand, 'release', v)} />
                    </div>
                </div>

                {/* Master & De-Esser */}
                <div className={`${cardClass} flex flex-col justify-start gap-4`}>
                     <div className="flex items-center justify-between">
                         <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-cyan-400"} flex items-center gap-2`}><Volume2 size={14} /> Master</h3>
                     </div>
                     <div className="space-y-4">
                        <SliderControl skin={skin} variant="cyan" label="Input Gain" value={params.gain} min={0} max={3} step={0.001} unit="x" onChange={(v) => onChange({...params, gain: v})} />
                        {/* Updated Stereo Width to reflect Air Width */}
                        <SliderControl skin={skin} variant="cyan" label="Air Width" value={params.stereoWidth} min={0} max={2} step={0.05} unit="%" onChange={(v) => onChange({...params, stereoWidth: v})} />
                        
                        <div className={`w-full h-px my-1 ${isClear ? "bg-black/5" : "bg-white/10"}`}></div>
                        
                        {/* Dynamic Breathe Control */}
                        <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-bold uppercase ${isClear ? "text-slate-500" : "text-slate-500"}`}>Breathe</span>
                             </div>
                             <SliderControl skin={skin} variant="cyan" label="Dynamics" value={params.limiter.breathe || 0} min={0} max={100} step={1} unit="%" onChange={(v) => onChange({...params, limiter: {...params.limiter, breathe: v}})} />
                        </div>

                        <div className={`w-full h-px my-1 ${isClear ? "bg-black/5" : "bg-white/10"}`}></div>
                        
                        {/* De-Esser Mini Control */}
                         <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-bold uppercase ${isClear ? "text-slate-500" : "text-slate-500"}`}>De-Esser</span>
                                <PowerToggle enabled={params.deEsser?.enabled ?? false} onToggle={() => onChange({...params, deEsser: {...(params.deEsser || {threshold: -20, amount: 4}), enabled: !(params.deEsser?.enabled)}})} />
                            </div>
                            <SliderControl skin={skin} variant="cyan" label="Threshold" value={params.deEsser?.threshold ?? -20} min={-60} max={0} step={1} unit="dB" onChange={(v) => onChange({...params, deEsser: {...(params.deEsser || {enabled: true, amount: 4}), threshold: v}})} />
                        </div>
                     </div>
                </div>
            </div>
        )}

        {/* OTHER TABS REMAIN SAME (Included for context/completeness of file structure but unchanged logic) */}
        {/* FIXERS TAB */}
        {activeTab === 'fixers' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                  {/* Top Full-Width AI Auto Master Banner */}
                  <button 
                    onClick={() => onSmartMaster?.('super_mix')}
                    disabled={isSmartAdjusting || tracks.length === 0}
                    className={`col-span-1 md:col-span-2 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all group relative overflow-hidden ${isClear ? "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl" : "bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-pink-900/90 border border-purple-500/30 text-white shadow-xl shadow-purple-950/40"}`}
                  >
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-center gap-3.5 z-10">
                          <div className="p-3 bg-purple-500/20 border border-purple-400/40 rounded-2xl backdrop-blur-md shadow-lg shadow-purple-500/20 text-purple-300">
                              <Sparkles size={22} className={isSmartAdjusting ? "animate-spin text-purple-300" : "animate-pulse text-purple-300"} strokeWidth={2.5} />
                          </div>
                          <div className="flex flex-col items-start text-left">
                              <span className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-white">
                                 Mixer Fixer AI
                                 <span className="px-2 py-0.5 rounded-full bg-purple-500/30 border border-purple-400/40 text-[9px] font-extrabold text-purple-200">AUTO 32-BIT</span>
                              </span>
                              <span className="text-[11px] text-purple-200/80 font-medium max-w-[420px] leading-relaxed">
                                  {lang === 'es' ? 'Analiza stems, balancea volumen, corrige fase y masteriza a -14 LUFS / -1.0 dBTP.' : 'Analyzes stems, auto-balances volume, aligns phase, and masters to -14 LUFS / -1.0 dBTP.'}
                              </span>
                          </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-all">
                          <span>{isSmartAdjusting ? (lang === 'es' ? 'Optimizando...' : 'Optimizing...') : (lang === 'es' ? 'Ejecutar AI Fix' : 'Run AI Fix')}</span>
                          <Wand2 size={13} />
                      </div>
                  </button>

                  {/* Left Column: Target Mastering */}
                  <div className={`${cardClass} flex flex-col justify-between gap-3`}>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                          <h3 className={`${headerTextClass} text-emerald-400 flex items-center gap-2`}><BarChart2 size={14}/> {lang === 'es' ? 'Objetivos de Mastering' : 'Mastering Targets'}</h3>
                          <span className="text-[10px] font-mono text-slate-400">ITU-R BS.1770</span>
                      </div>
                      <div className="flex flex-col gap-2.5 flex-1 justify-center">
                           <button 
                             onClick={() => onSmartMaster?.('spotify', selection)} 
                             disabled={isSmartAdjusting || tracks.length === 0 || !hasLufsIssue}
                             className={`p-3 rounded-xl flex items-center justify-between transition-all border ${!hasLufsIssue ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-emerald-500/50 active:scale-[0.99]'}`}
                           >
                               <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                     <Monitor size={15}/>
                                  </div>
                                  <div className="flex flex-col items-start">
                                      <span className="text-xs font-bold text-slate-100">Spotify & Apple Music</span>
                                      <span className="text-[10px] text-slate-400 font-mono">-14.0 LUFS / -1.0 dBTP</span>
                                  </div>
                               </div>
                               {!hasLufsIssue ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Wand2 size={14} className="text-slate-400"/>}
                           </button>
                           
                           <button 
                             onClick={() => onSmartMaster?.('peak', selection)} 
                             disabled={isSmartAdjusting || tracks.length === 0 || !hasSafePeakIssue}
                             className={`p-3 rounded-xl flex items-center justify-between transition-all border ${!hasSafePeakIssue ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-amber-500/50 active:scale-[0.99]'}`}
                           >
                               <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                     <AlertTriangle size={15}/>
                                  </div>
                                  <div className="flex flex-col items-start">
                                      <span className="text-xs font-bold text-slate-100">{lang === 'es' ? 'Pico Seguro (Anti-Clip)' : 'Safe True Peak'}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">-1.0 dBTP Ceiling</span>
                                  </div>
                               </div>
                               {!hasSafePeakIssue ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Wand2 size={14} className="text-slate-400"/>}
                           </button>

                           <button 
                             onClick={() => onSmartMaster?.('combo', selection)} 
                             disabled={isSmartAdjusting || tracks.length === 0}
                             className="p-3 rounded-xl flex items-center justify-between transition-all border bg-gradient-to-r from-indigo-950/60 to-purple-950/60 hover:from-indigo-900/70 hover:to-purple-900/70 border-indigo-500/30 hover:border-indigo-400/60 active:scale-[0.99]"
                           >
                               <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                     <CheckCircle2 size={15}/>
                                  </div>
                                  <div className="flex flex-col items-start">
                                      <span className="text-xs font-bold text-indigo-100">{lang === 'es' ? 'Masterizar Todo (Combo)' : 'Master All (Full Chain)'}</span>
                                      <span className="text-[10px] text-indigo-300/70">{lang === 'es' ? 'Ajuste inteligente de ganancia y dinámica' : 'Optimal Loudness & True Peak match'}</span>
                                  </div>
                               </div>
                               <Wand2 size={14} className="text-indigo-400"/>
                           </button>
                      </div>
                      {selection && selection.end > selection.start && (
                          <div className="text-[9px] text-center py-1 px-2 rounded-lg font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              {lang === 'es' ? 'Aplicando corrección solo a la selección activa' : 'Applying fixes to active selection range only'}
                          </div>
                      )}
                  </div>

                  {/* Right Column: Problem Solvers */}
                  <div className={`${cardClass} flex flex-col justify-between gap-3`}>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                          <h3 className={`${headerTextClass} text-rose-400 flex items-center gap-2`}><Wrench size={14}/> {lang === 'es' ? 'Correctores Inteligentes' : 'Smart Problem Solvers'}</h3>
                          <span className="text-[10px] font-mono text-slate-400">DSP Fixers</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 flex-1">
                           <button 
                             onClick={() => onSmartMaster?.('clipping', selection)}
                             disabled={isSmartAdjusting || tracks.length === 0 || !hasClipping}
                             className={`p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center border ${!hasClipping ? 'bg-slate-900/40 border-slate-800/50 opacity-60' : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 hover:border-rose-400/50 active:scale-95'}`}
                           >
                               {!hasClipping ? <CheckCircle2 size={18} className="text-emerald-400" /> : <Scissors size={18} className="text-rose-400" />}
                               <span className="text-[11px] font-bold text-slate-200">{!hasClipping ? (lang === 'es' ? "Sin Clipping" : "No Clipping") : (lang === 'es' ? "Reparar Clip" : "Fix Clipping")}</span>
                               <span className="text-[9px] text-slate-400">{lang === 'es' ? 'Soft-knee limiter' : 'True Peak cap'}</span>
                           </button>

                           <button 
                             onClick={() => onSmartMaster?.('mono', selection)}
                             disabled={isSmartAdjusting || tracks.length === 0}
                             className="p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center border bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-cyan-500/50 active:scale-95"
                           >
                               <MoveHorizontal size={18} className="text-cyan-400" />
                               <span className="text-[11px] font-bold text-slate-200">{lang === 'es' ? "Alinear Fase" : "Fix Phase"}</span>
                               <span className="text-[9px] text-slate-400">{lang === 'es' ? 'Mono bass (<120Hz)' : 'Mono sub alignment'}</span>
                           </button>

                           <button 
                             onClick={() => onSmartMaster?.('punch', selection)}
                             disabled={isSmartAdjusting || tracks.length === 0}
                             className="p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center border bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-amber-500/50 active:scale-95"
                           >
                               <Hammer size={18} className="text-amber-400" />
                               <span className="text-[11px] font-bold text-slate-200">{lang === 'es' ? "Añadir Pegada" : "Add Punch"}</span>
                               <span className="text-[9px] text-slate-400">{lang === 'es' ? 'Transient shaper' : 'Transient punch'}</span>
                           </button>

                           <button 
                             onClick={() => onSmartMaster?.('clean_noise', selection)}
                             disabled={isSmartAdjusting || tracks.length === 0}
                             className="p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all text-center border bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-purple-500/50 active:scale-95"
                           >
                               <VolumeX size={18} className="text-purple-400" />
                               <span className="text-[11px] font-bold text-slate-200">{lang === 'es' ? "Limpiar Ruido" : "Clean Noise"}</span>
                               <span className="text-[9px] text-slate-400">{lang === 'es' ? 'Expander / Gate' : 'Expander gate'}</span>
                           </button>
                      </div>
                  </div>
             </div>
        )}

        {/* EQ TAB */}
        {activeTab === 'eq' && (
            <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
                <div className={`${isClear ? "bg-white border border-black/5 rounded-2xl shadow-sm" : "bg-white/5 p-1 rounded-2xl border border-white/5"} overflow-hidden relative h-64 transition-all duration-300`}>
                     <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-purple-400"} flex items-center gap-2`}><Sliders size={14} /> Parametric EQ</h3>
                        <PowerToggle enabled={params.eq.enabled} onToggle={() => onChange({...params, eq: {...params.eq, enabled: !params.eq.enabled}})} />
                     </div>
                     <VisualEQ params={params.eq} onChange={updateEQ} onSelectBand={setSelectedEQBand} selectedBand={selectedEQBand} skin={skin} />
                </div>
                
                <div className={`${cardClass} transition-all`}>
                     <h4 className={`${headerTextClass} ${isClear ? "text-slate-900 border-black/5" : "text-slate-400 border-white/5"} mb-4 border-b pb-2 flex justify-between items-center`}>
                        <span>{selectedEQBand ? getBandLabel(selectedEQBand) : "Select a band"}</span>
                        {selectedEQBand && <span className={`text-[10px] px-2 py-0.5 rounded border ${isClear ? "bg-slate-900 text-white border-transparent" : "bg-purple-500/20 text-purple-300 border-purple-500/30"}`}>Active</span>}
                     </h4>
                     <div className={`grid grid-cols-3 gap-8 ${!selectedEQBand ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                         <SliderControl skin={skin} variant="purple" label="Freq" value={selectedEQBand ? params.eq[selectedEQBand].frequency : 1000} min={20} max={20000} step={1} unit="Hz" onChange={(v) => selectedEQBand && updateEQ(selectedEQBand, { ...params.eq[selectedEQBand], frequency: v })} />
                         <SliderControl skin={skin} variant="purple" label="Gain" value={selectedEQBand ? params.eq[selectedEQBand].gain : 0} min={-15} max={15} step={0.1} unit="dB" onChange={(v) => selectedEQBand && updateEQ(selectedEQBand, { ...params.eq[selectedEQBand], gain: v })} />
                         <SliderControl skin={skin} variant="purple" label="Q" value={selectedEQBand ? params.eq[selectedEQBand].q : 1} min={0.1} max={10} step={0.1} unit="" onChange={(v) => selectedEQBand && updateEQ(selectedEQBand, { ...params.eq[selectedEQBand], q: v })} />
                     </div>
                </div>
            </div>
        )}

        {/* COLOR TAB (UPDATED FOR TAPE) */}
        {activeTab === 'color' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                <div className={`${cardClass}`}>
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                         <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-orange-400"} flex items-center gap-2`}><Zap size={16} /> Saturation</h3>
                         <PowerToggle enabled={params.distortion.enabled} onToggle={() => onChange({...params, distortion: {...params.distortion, enabled: !params.distortion.enabled}})} />
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                         <QuickPreset label="Tape Warmth" active={params.distortion.mode === 'tape' && params.distortion.amount === 15} onClick={() => onChange({...params, distortion: {enabled: true, amount: 15, mode: 'tape'}})} />
                         <QuickPreset label="Crunch" active={params.distortion.amount === 35} onClick={() => onChange({...params, distortion: {enabled: true, amount: 35, mode: 'digital'}})} />
                         <QuickPreset label="Fuzz" active={params.distortion.amount === 80} onClick={() => onChange({...params, distortion: {enabled: true, amount: 80, mode: 'digital'}})} />
                    </div>

                    <div className="space-y-6">
                         <SliderControl skin={skin} variant="orange" label="Drive" value={params.distortion.amount} min={0} max={100} step={1} unit="%" onChange={(v) => onChange({...params, distortion: {...params.distortion, amount: v}})} />
                    </div>
                    <div className="mt-4 text-[10px] text-center opacity-50 uppercase tracking-widest font-bold">
                        {params.distortion.mode === 'tape' ? "Analog Tape Mode" : "Digital Clip Mode"}
                    </div>
                </div>
                <div className={`${cardClass}`}>
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                         <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-orange-400"} flex items-center gap-2`}>
                            {params.modulation.type === 'phaser' ? <Infinity size={16} /> : <Activity size={16} />}
                            {params.modulation.type === 'phaser' ? 'Phaser' : 'Chorus'}
                         </h3>
                         <div className="flex items-center gap-3">
                            <button 
                                onClick={() => onChange({...params, modulation: {...params.modulation, type: params.modulation.type === 'chorus' ? 'phaser' : 'chorus'}})}
                                className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition-all ${isClear ? "bg-slate-100 hover:bg-slate-200" : "bg-white/10 hover:bg-white/20"}`}
                            >
                                Switch to {params.modulation.type === 'chorus' ? 'Phaser' : 'Chorus'}
                            </button>
                            <PowerToggle enabled={params.modulation.enabled} onToggle={() => onChange({...params, modulation: {...params.modulation, enabled: !params.modulation.enabled}})} />
                         </div>
                    </div>
                    <div className="space-y-5">
                        <SliderControl skin={skin} variant="orange" label="Mix" value={params.modulation.mix} min={0} max={1} step={0.01} unit="%" onChange={(v) => onChange({...params, modulation: {...params.modulation, mix: v}})} />
                        <SliderControl skin={skin} variant="orange" label="Rate" value={params.modulation.rate} min={0.1} max={10} step={0.1} unit="Hz" onChange={(v) => onChange({...params, modulation: {...params.modulation, rate: v}})} />
                        <SliderControl skin={skin} variant="orange" label="Depth" value={params.modulation.depth} min={0} max={100} step={1} unit="%" onChange={(v) => onChange({...params, modulation: {...params.modulation, depth: v}})} />
                        {params.modulation.type === 'phaser' && (
                             <SliderControl skin={skin} variant="orange" label="Feedback" value={params.modulation.feedback} min={0} max={0.9} step={0.01} unit="%" onChange={(v) => onChange({...params, modulation: {...params.modulation, feedback: v}})} />
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* SPACE TAB */}
        {activeTab === 'space' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                <div className={`${cardClass}`}>
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-pink-400"} flex items-center gap-2`}><Waves size={16} /> Delay</h3>
                        <PowerToggle enabled={params.delay.enabled} onToggle={() => onChange({...params, delay: {...params.delay, enabled: !params.delay.enabled}})} />
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                         <QuickPreset label="Slap" active={params.delay.time >= 0.08 && params.delay.time <= 0.12} onClick={() => onChange({...params, delay: {enabled: true, time: 0.1, feedback: 0.1, mix: 0.3}})} />
                         <QuickPreset label="Short" active={params.delay.time >= 0.2 && params.delay.time <= 0.3} onClick={() => onChange({...params, delay: {enabled: true, time: 0.25, feedback: 0.2, mix: 0.25}})} />
                         <QuickPreset label="Ambient" active={params.delay.time > 0.4} onClick={() => onChange({...params, delay: {enabled: true, time: 0.5, feedback: 0.6, mix: 0.4}})} />
                    </div>

                    <div className="space-y-5">
                        <SliderControl skin={skin} variant="pink" label="Mix" value={params.delay.mix} min={0} max={1} step={0.01} unit="%" onChange={(v) => onChange({...params, delay: {...params.delay, mix: v}})} />
                        <SliderControl skin={skin} variant="pink" label="Time" value={params.delay.time} min={0} max={1} step={0.01} unit="s" onChange={(v) => onChange({...params, delay: {...params.delay, time: v}})} />
                        <SliderControl skin={skin} variant="pink" label="Fdbk" value={params.delay.feedback} min={0} max={0.9} step={0.01} unit="%" onChange={(v) => onChange({...params, delay: {...params.delay, feedback: v}})} />
                    </div>
                </div>
                <div className={`${cardClass}`}>
                    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-pink-400"} flex items-center gap-2`}><Speaker size={16} /> Reverb</h3>
                        <PowerToggle enabled={params.reverb.enabled} onToggle={() => onChange({...params, reverb: {...params.reverb, enabled: !params.reverb.enabled}})} />
                    </div>

                    <div className="flex gap-2 mb-4">
                         <QuickPreset label="Room" active={params.reverb.decay < 1.5} onClick={() => onChange({...params, reverb: {enabled: true, decay: 1.0, mix: 0.15}})} />
                         <QuickPreset label="Hall" active={params.reverb.decay >= 1.5 && params.reverb.decay < 3} onClick={() => onChange({...params, reverb: {enabled: true, decay: 2.5, mix: 0.25}})} />
                         <QuickPreset label="Ethereal" active={params.reverb.decay >= 4} onClick={() => onChange({...params, reverb: {enabled: true, decay: 5.0, mix: 0.4}})} />
                    </div>

                    <div className="space-y-5">
                        <SliderControl skin={skin} variant="pink" label="Mix" value={params.reverb.mix} min={0} max={1} step={0.01} unit="%" onChange={(v) => onChange({...params, reverb: {...params.reverb, mix: v}})} />
                        <SliderControl skin={skin} variant="pink" label="Decay" value={params.reverb.decay} min={0.5} max={10} step={0.1} unit="s" onChange={(v) => onChange({...params, reverb: {...params.reverb, decay: v}})} />
                    </div>
                </div>
             </div>
        )}

        {/* ANALYSIS TAB */}
        {activeTab === 'analysis' && (
             <AnalysisDashboard 
                skin={skin} 
                analysisStats={analysisStats}
                onApplyGainChange={(deltaDb) => {
                    const currentGainDb = 20 * Math.log10(params.gain > 0 ? params.gain : 0.001);
                    const newGainDb = currentGainDb + deltaDb;
                    let newGain = Math.pow(10, newGainDb / 20);
                    newGain = Math.max(0, Math.min(4, newGain));
                    onChange({ ...params, gain: parseFloat(newGain.toFixed(3)) });
                }}
                onFixStereoIssue={() => onSmartMaster?.('mono', selection)}
                onFixClipping={() => onSmartMaster?.('clipping', selection)}
             />
        )}
        
        {/* LOFI TAB, TRANSIENT TAB, etc. (included for completeness) */}
        {activeTab === 'lofi' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                 <div className={`${cardClass} col-span-1 md:col-span-2 flex flex-col gap-4`}>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-red-400"} flex items-center gap-2`}><Disc size={16} /> Vintage Sampler</h3>
                        <PowerToggle enabled={params.lofi.enabled} onToggle={() => onChange({...params, lofi: {...params.lofi, enabled: !params.lofi.enabled}})} />
                    </div>
                    
                    <div className="flex gap-2 pb-2">
                         <QuickPreset label="12-Bit" active={params.lofi.bitDepth === 12} onClick={() => onChange({...params, lofi: {...params.lofi, bitDepth: 12, sampleRate: 26040, enabled: true}})} />
                         <QuickPreset label="8-Bit" active={params.lofi.bitDepth === 8} onClick={() => onChange({...params, lofi: {...params.lofi, bitDepth: 8, sampleRate: 11025, enabled: true}})} />
                         <QuickPreset label="Telephone" active={params.lofi.sampleRate === 8000} onClick={() => onChange({...params, lofi: {...params.lofi, bitDepth: 10, sampleRate: 8000, enabled: true}})} />
                         <QuickPreset label="Clean" active={params.lofi.bitDepth === 32} onClick={() => onChange({...params, lofi: {...params.lofi, bitDepth: 32, sampleRate: 48000, enabled: true}})} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                        <SliderControl skin={skin} variant="default" label="Bit Depth" value={params.lofi.bitDepth} min={2} max={32} step={1} unit="bits" onChange={(v) => onChange({...params, lofi: {...params.lofi, bitDepth: v}})} />
                        <SliderControl skin={skin} variant="default" label="Sample Rate" value={params.lofi.sampleRate} min={1000} max={48000} step={100} unit="Hz" onChange={(v) => onChange({...params, lofi: {...params.lofi, sampleRate: v}})} />
                    </div>
                </div>
             </div>
        )}

        {activeTab === 'transient' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
                <div className={`${cardClass} col-span-1 md:col-span-2 flex flex-col gap-4`}>
                     <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h3 className={`${headerTextClass} ${isClear ? "text-slate-900" : "text-yellow-400"} flex items-center gap-2`}><Hammer size={16} /> Punch</h3>
                        <PowerToggle enabled={params.transient.enabled} onToggle={() => onChange({...params, transient: {...params.transient, enabled: !params.transient.enabled}})} />
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                        <div className="flex flex-col gap-2">
                             <SliderControl skin={skin} variant="default" label="Attack Boost" value={params.transient.amount} min={0} max={100} step={1} unit="%" onChange={(v) => onChange({...params, transient: {...params.transient, amount: v}})} />
                        </div>
                        <div className="flex flex-col gap-2">
                             <SliderControl skin={skin} variant="default" label="Sustain Level" value={params.transient.sustain} min={-100} max={100} step={1} unit="%" onChange={(v) => onChange({...params, transient: {...params.transient, sustain: v}})} />
                        </div>
                     </div>
                </div>
             </div>
        )}
      </div>
    </div>
  );
};

export const EffectRackMemo = React.memo(EffectRack);
export { EffectRackMemo as EffectRack };
