import React, { useEffect, useState, useRef } from 'react';
import { AnalysisMetrics, SkinMode } from '../types';
import { audioEngine } from '../services/audioEngine';
import { Info, CheckCircle, AlertTriangle, AlertOctagon, Sparkles, RefreshCcw, BarChart3, Activity, Scissors } from 'lucide-react';

interface AnalysisDashboardProps {
  skin?: SkinMode;
  onApplyGainChange?: (deltaDb: number) => void;
  onFixStereoIssue?: () => void;
  onFixClipping?: () => void;
  analysisStats?: { integrated: number; peak: number; shortTerm: number };
}

interface CardProps {
    title: string;
    children: React.ReactNode;
    status?: 'good' | 'bad' | 'neutral';
    isSketch: boolean;
    onReset?: () => void;
    onAutoFix?: () => void;
    fixLabel?: string;
    colSpan?: string;
}

const Card: React.FC<CardProps> = ({ title, children, status = 'neutral', isSketch, onReset, onAutoFix, fixLabel = "Fix", colSpan = '' }) => {
     const statusColors = {
         good: isSketch ? "text-emerald-600" : "text-emerald-400",
         bad: isSketch ? "text-rose-600" : "text-rose-400",
         neutral: isSketch ? "text-amber-600" : "text-yellow-400"
     };
     
     return (
         <div className={`p-4 rounded-xl flex flex-col justify-between h-32 transition-all ${colSpan} ${isSketch ? "bg-white border border-black/5 shadow-sm" : "bg-white/5 border border-white/5"}`}>
             <div className="flex justify-between items-start">
                 <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${isSketch ? "text-slate-500" : "text-slate-400"}`}>
                    {title} <Info size={12} className="opacity-50" />
                 </h4>
                 <div className="flex items-center gap-2">
                     {onAutoFix && status === 'bad' && (
                          <button 
                            onClick={onAutoFix}
                            className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-all animate-in fade-in zoom-in ${isSketch ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"}`}
                            title={title === 'Mono Compatibility' ? "Reduce Stereo Width" : "Apply Fix"}
                          >
                             <Sparkles size={10} />
                             <span>{fixLabel}</span>
                          </button>
                     )}
                     {onReset && (
                         <button onClick={onReset} className={`p-1 rounded-full hover:bg-white/10 ${isSketch ? "text-slate-400 hover:text-slate-900" : "text-slate-500 hover:text-white"}`}>
                             <RefreshCcw size={10} />
                         </button>
                     )}
                 </div>
             </div>
             {children}
             {status !== 'neutral' && (
                 <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${statusColors[status]}`}>
                     {status === 'good' ? 'Healthy' : status === 'bad' ? (title.includes('Dynamic') ? 'Crushed / Wall of Sound' : 'Issue Detected') : 'Competitive Loudness'}
                 </div>
             )}
         </div>
     );
};

interface BarProps {
    label: string;
    value: number; // The instantaneous value (bouncing)
    maxValue?: number; // The max value (held)
    min: number;
    max: number;
    target?: number;
    colorClass: string;
    isSketch: boolean;
    onAutoFix?: () => void;
}

const Bar: React.FC<BarProps> = ({ label, value, maxValue, min, max, target, colorClass, isSketch, onAutoFix }) => {
      const pct = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
      const maxPct = maxValue !== undefined ? Math.max(0, Math.min(100, (maxValue - min) / (max - min) * 100)) : 0;
      const targetPct = target !== undefined ? Math.max(0, Math.min(100, (target - min) / (max - min) * 100)) : 0;
      
      const effectiveMax = maxValue !== undefined ? maxValue : value;
      const isNearTarget = target !== undefined && Math.abs(effectiveMax - target) < 0.5;
      const displayValue = effectiveMax;

      return (
          <div className="flex flex-col gap-1 w-full relative">
              <div className="flex justify-between items-end mb-1">
                  <span className={`text-xs ${isSketch ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
                  <div className="flex items-center gap-2">
                      {onAutoFix && !isNearTarget && displayValue > -80 && (
                          <button 
                            onClick={onAutoFix}
                            className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-all animate-in fade-in zoom-in ${isSketch ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"}`}
                            title={`Auto-adjust gain to reach ${target}dB based on Max Peak`}
                          >
                             <Sparkles size={10} />
                             <span>Auto</span>
                          </button>
                      )}
                      <span className={`font-mono text-sm font-bold ${isSketch ? "text-slate-900" : "text-slate-200"}`}>{displayValue > -100 ? displayValue.toFixed(1) : "--"} <span className="text-[10px] opacity-50">{label.includes('Loudness') ? 'LUFS' : 'dB'}</span></span>
                  </div>
              </div>
              
              <div className="h-6 w-full relative">
                  <div className={`absolute top-2 left-0 right-0 h-2 rounded-full overflow-hidden ${isSketch ? "bg-slate-200" : "bg-slate-800"}`}>
                      <div className={`absolute top-0 left-0 h-full transition-all duration-100 ease-out ${colorClass}`} style={{ width: `${pct}%` }} />
                  </div>
                  
                  {/* Target Line */}
                  {target !== undefined && (
                      <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${targetPct}%` }}>
                          <div className={`absolute top-2 h-2 w-0.5 ${isSketch ? "bg-slate-900" : "bg-white"}`}></div>
                          <div className={`absolute -top-1 -translate-x-1/2 text-[9px] font-mono font-bold ${isSketch ? "text-slate-600" : "text-slate-400"}`}>
                             {target.toFixed(1)}
                          </div>
                      </div>
                  )}

                  {/* Max Value Ghost Line */}
                  {maxValue !== undefined && maxValue > min && (
                      <div className="absolute top-0 bottom-0 w-px z-0 opacity-80" style={{ left: `${maxPct}%` }}>
                          <div className={`absolute top-2 h-2 w-0.5 ${isSketch ? "bg-slate-400" : "bg-slate-400"}`}></div>
                      </div>
                  )}
              </div>

              <div className="flex justify-between text-[8px] opacity-40 font-mono -mt-1">
                  <span>{min}</span>
                  <span>{max}</span>
              </div>
          </div>
      );
};

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ skin = 'modern', onApplyGainChange, onFixStereoIssue, onFixClipping, analysisStats }) => {
  const [metrics, setMetrics] = useState<AnalysisMetrics>({
    sampleRate: 48000,
    bitDepth: '32 bit (Float)',
    clipping: false,
    phaseCorrelation: 1,
    integratedLoudness: -100,
    truePeak: -100,
    maxTruePeak: -100,
    dynamicRange: 12,
    stereoField: 'Normal',
    tonalBalance: [0, 0, 0, 0]
  });
  
  const isClear = skin === 'clear';

  useEffect(() => {
    // Optimization: Update at 10 FPS (100ms) instead of 60 FPS to reduce load
    const interval = setInterval(() => {
      const newMetrics = audioEngine.getAnalysisMetrics();
      setMetrics(newMetrics);
    }, 100);
    
    return () => {
        clearInterval(interval);
    };
  }, []);
  
  // Use pre-calculated stats if available (better for offline/preset updates)
  const displayIntegrated = analysisStats && analysisStats.integrated > -100 ? analysisStats.integrated : metrics.integratedLoudness;
  const displayPeak = analysisStats && analysisStats.peak > -100 ? analysisStats.peak : metrics.maxTruePeak;

  const handleAutoPeak = () => {
      if (onApplyGainChange && displayPeak > -100) {
          const delta = -1.0 - displayPeak;
          onApplyGainChange(delta);
          audioEngine.resetAnalysis(); 
      }
  };

  const handleAutoLoudness = () => {
      if (onApplyGainChange && displayIntegrated > -100) {
          const delta = -14.0 - displayIntegrated;
          onApplyGainChange(delta);
          audioEngine.resetAnalysis();
      }
  };
  
  const handleReset = () => {
      audioEngine.resetAnalysis();
  };
  
  const dr = metrics.dynamicRange;
  let drStatus: 'good' | 'neutral' | 'bad' = 'good';
  if (dr < 5) drStatus = 'bad';
  else if (dr < 8) drStatus = 'neutral';

  // Fix phase status logic: 0 to 1 is positive correlation (good). < 0 is out of phase (bad).
  const phaseStatus = metrics.phaseCorrelation < 0 ? 'bad' : 'good';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Row 1 */}
        <Card title="Sample Rate" isSketch={isClear}>
            <div className={`text-2xl font-bold ${isClear ? "text-slate-900" : "text-slate-200"}`}>
                {metrics.sampleRate / 1000} <span className="text-sm opacity-60">kHz</span>
            </div>
        </Card>
        
        <Card title="Bit Depth" isSketch={isClear}>
            <div className={`text-2xl font-bold ${isClear ? "text-slate-900" : "text-slate-200"}`}>
                {metrics.bitDepth.split(' ')[0]} <span className="text-sm opacity-60">{metrics.bitDepth.split(' ').slice(1).join(' ')}</span>
            </div>
        </Card>

        {/* Row 2 */}
        <Card title="Clipping" status={displayPeak > 0 ? 'bad' : 'good'} isSketch={isClear} onReset={handleReset} onAutoFix={onFixClipping} fixLabel="Fix Gain">
            <div className={`text-2xl font-bold flex items-center gap-2 ${displayPeak > 0 ? (isClear ? "text-rose-600" : "text-rose-400") : (isClear ? "text-slate-900" : "text-slate-200")}`}>
                {displayPeak > 0 ? (
                    <>Yes <AlertTriangle size={20} /></>
                ) : (
                    <>None <CheckCircle size={20} className={isClear ? "text-emerald-600" : "text-emerald-500"} /></>
                )}
            </div>
            {displayPeak > 0 && <div className="text-xs text-rose-500 font-mono mt-1">Overshoot: +{displayPeak.toFixed(1)}dB</div>}
        </Card>

        <Card title="Mono Compatibility" status={phaseStatus} isSketch={isClear} onAutoFix={onFixStereoIssue} fixLabel="Fix Phase">
             <div className={`text-2xl font-bold flex items-center gap-2 ${phaseStatus === 'good' ? (isClear ? "text-slate-900" : "text-slate-200") : (isClear ? "text-rose-600" : "text-rose-400")}`}>
                {phaseStatus === 'good' ? "Yes" : "Issues"}
                {phaseStatus === 'bad' && <AlertOctagon size={20} />}
             </div>
             <div className="text-xs opacity-60">Phase: {metrics.phaseCorrelation.toFixed(2)}</div>
        </Card>

        {/* DYNAMICS HEALTH METER (Expanded) */}
        <div className={`col-span-1 md:col-span-2 p-4 rounded-xl flex flex-col justify-between transition-all ${isClear ? "bg-white border border-black/5 shadow-sm" : "bg-white/5 border border-white/5"}`}>
            <div className="flex justify-between items-center mb-2">
                 <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${isClear ? "text-slate-500" : "text-slate-400"}`}>
                    Dynamics Health (PSR)
                 </h4>
                 <div className={`flex items-center gap-2 text-sm font-bold ${drStatus === 'bad' ? (isClear ? 'text-rose-600' : 'text-rose-400') : drStatus === 'neutral' ? (isClear ? 'text-amber-600' : 'text-yellow-400') : (isClear ? 'text-emerald-600' : 'text-emerald-400')}`}>
                    <Activity size={16} />
                    {dr.toFixed(1)} dB
                 </div>
            </div>
            
            {/* Custom Meter for Dynamics */}
            <div className="w-full h-4 rounded-full relative bg-gradient-to-r from-rose-500 via-yellow-500 to-emerald-500 opacity-80 overflow-hidden">
                <div className={`absolute top-0 bottom-0 right-0 transition-all duration-300 ${isClear ? "bg-slate-200" : "bg-slate-900"}`} style={{ width: `${Math.max(0, 100 - (dr / 14) * 100)}%` }}></div>
                {/* Threshold Markers */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-black/20 left-[35%]"></div> {/* 5dB mark approx */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-black/20 left-[57%]"></div> {/* 8dB mark approx */}
            </div>
            
            <div className="flex justify-between text-[9px] uppercase tracking-wider font-bold mt-2 opacity-60">
                 <span>Crushed (Fatigue)</span>
                 <span>Competitive</span>
                 <span>Dynamic (Open)</span>
            </div>
             <p className={`text-[10px] mt-2 ${isClear ? "text-slate-500" : "text-slate-400"}`}>
                 {drStatus === 'bad' 
                    ? "Warning: Your track has very little dynamic range. It may sound loud but flat ('Wall of Sound'). Reduce limiting or use the Transient Shaper."
                    : drStatus === 'neutral'
                    ? "Good: Your track is loud and competitive for modern genres (Pop/EDM/Rap) without being completely crushed."
                    : "Excellent: Your track has plenty of punch and breathing room. Great for Jazz, Rock, or Acoustic."}
             </p>
        </div>

        {/* Row 4 - Bars */}
        <div className={`p-4 rounded-xl flex flex-col justify-center gap-4 transition-all ${isClear ? "bg-white border border-black/5 shadow-sm" : "bg-white/5 border border-white/5"}`}>
            <Bar 
                label="Integrated Loudness" 
                value={metrics.integratedLoudness}
                maxValue={displayIntegrated} 
                min={-40} max={0} target={-14}
                colorClass={isClear ? "bg-blue-600" : "bg-gradient-to-r from-cyan-600 to-blue-500"}
                isSketch={isClear}
                onAutoFix={handleAutoLoudness}
            />
        </div>

        <div className={`p-4 rounded-xl flex flex-col justify-center gap-4 transition-all ${isClear ? "bg-white border border-black/5 shadow-sm" : "bg-white/5 border border-white/5"}`}>
            <Bar 
                label="True Peak" 
                value={metrics.truePeak} 
                maxValue={displayPeak}
                min={-20} max={3} target={-1.0}
                colorClass={displayPeak > -0.1 ? (isClear ? "bg-rose-500" : "bg-rose-500") : (isClear ? "bg-emerald-500" : "bg-emerald-500")}
                isSketch={isClear}
                onAutoFix={handleAutoPeak}
            />
        </div>

        {/* Row 5 - Tonal Profile */}
        <div className={`md:col-span-2 p-4 rounded-xl flex flex-col gap-3 transition-all ${isClear ? "bg-white border border-black/5 shadow-sm" : "bg-white/5 border border-white/5"}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${isClear ? "text-slate-500" : "text-slate-400"}`}>
                Tonal Profile <Info size={12} className="opacity-50" />
            </h4>
            <div className="flex h-24 gap-1 items-end pt-4 pb-2 relative">
                {/* Background Grid */}
                <div className={`absolute inset-0 border-t border-b ${isClear ? "border-slate-200" : "border-white/5"}`} />
                <div className={`absolute top-1/2 w-full border-t ${isClear ? "border-slate-200" : "border-white/5"}`} />

                {metrics.tonalBalance.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end h-full gap-2 group relative">
                        <div 
                            className={`w-full transition-all duration-300 rounded-t-sm ${isClear ? "bg-emerald-600/80" : "bg-emerald-500/20 border-t-2 border-emerald-500"}`} 
                            style={{ height: `${Math.max(5, val * 100)}%` }} 
                        />
                        <span className={`text-[9px] text-center uppercase tracking-wider absolute bottom-2 w-full ${isClear ? "text-slate-500 font-bold" : "text-slate-500"}`}>
                            {i === 0 ? "Low" : i === 1 ? "Low-Mid" : i === 2 ? "High-Mid" : "High"}
                        </span>
                    </div>
                ))}
            </div>
             <div className="flex justify-between text-[10px] opacity-40 font-mono px-1">
                <span>20 Hz</span>
                <span>20 kHz</span>
            </div>
        </div>

    </div>
  );
};