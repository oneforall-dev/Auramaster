import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { SkinMode } from '../types';

interface MeterBarProps {
    skin?: SkinMode;
}

export const MeterBar: React.FC<MeterBarProps> = React.memo(({ skin = 'modern' }) => {
    const shortTermRef = useRef<HTMLDivElement>(null);
    const integratedRef = useRef<HTMLDivElement>(null);
    const dynTextRef = useRef<HTMLSpanElement>(null);
    const rafRef = useRef<number>(0);
    const isClear = false;

    // Range Constants
    const MIN_DB = -60;
    const MAX_DB = 0;

    useEffect(() => {
        let frameCount = 0;
        const update = () => {
            const data = audioEngine.getLoudnessData();
            
            // Update Dynamic Range text at 2Hz directly on DOM without triggering React re-renders
            if (frameCount % 30 === 0 && dynTextRef.current) {
                 const metrics = audioEngine.getAnalysisMetrics();
                 const dyn = metrics.dynamicRange;
                 dynTextRef.current.innerText = dyn > 0 ? dyn.toFixed(1) : "--";
                 dynTextRef.current.className = `text-[10px] font-mono font-bold w-6 text-right ${
                   dyn < 5 ? 'text-rose-400' : dyn < 8 ? 'text-yellow-400' : 'text-emerald-400'
                 }`;
            }
            frameCount++;

            if (shortTermRef.current) {
                const pct = Math.max(0, Math.min(100, (data.shortTerm - MIN_DB) / (MAX_DB - MIN_DB) * 100));
                shortTermRef.current.style.width = `${pct}%`;
                
                const val = data.shortTerm;
                let cls = "absolute top-0 bottom-0 left-0 transition-colors duration-100 ease-out shadow-[0_0_15px_currentColor] ";
                
                if (val > -9) {
                    cls += "bg-rose-500 text-rose-500";
                } else if (val > -14) {
                    cls += "bg-cyan-400 text-cyan-400";
                } else {
                    cls += "bg-emerald-500 text-emerald-500";
                }
                
                if (shortTermRef.current.className !== cls) {
                    shortTermRef.current.className = cls;
                }
            }

            if (integratedRef.current) {
                const pct = Math.max(0, Math.min(100, (data.integrated - MIN_DB) / (MAX_DB - MIN_DB) * 100));
                integratedRef.current.style.left = `${pct}%`;
                const disp = data.integrated <= -100 ? 'none' : 'block';
                if (integratedRef.current.style.display !== disp) {
                     integratedRef.current.style.display = disp;
                }
            }

            rafRef.current = requestAnimationFrame(update);
        };
        rafRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    const getPosition = (db: number) => `${(db - MIN_DB)/(MAX_DB - MIN_DB)*100}%`;

    return (
        <div className="shrink-0 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative transition-all bg-black/40 border border-white/5 backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 w-8 shrink-0 tracking-wider">LUFS</span>
                <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    TARGET: -14.0 LUFS-I | -1.0 dBTP
                </span>
            </div>
            
            <div className="flex-1 h-2.5 rounded-full relative overflow-visible my-1 sm:my-0 bg-slate-800/50">
                {/* Short Term Bar (Animated via ref) */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                     <div ref={shortTermRef} className="absolute top-0 bottom-0 left-0 bg-cyan-500" style={{ width: '0%' }}></div>
                </div>
                
                {/* Markers Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* -14 Target Line */}
                    <div 
                        className="absolute top-[-4px] bottom-[-4px] w-0.5 z-20 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" 
                        style={{ left: getPosition(-14) }} 
                    />
                    <div className="absolute -top-4 text-[8px] font-mono -translate-x-1/2 font-bold text-emerald-400" style={{ left: getPosition(-14) }}>-14</div>

                    {/* -6 dB Marker */}
                    <div 
                        className="absolute top-[-2px] bottom-[-2px] w-px z-10 bg-slate-600" 
                        style={{ left: getPosition(-6) }} 
                    />
                    <div className="absolute -bottom-4 text-[8px] font-mono -translate-x-1/2 text-slate-500" style={{ left: getPosition(-6) }}>-6</div>

                    {/* -3 dB Marker */}
                     <div 
                        className="absolute top-[-2px] bottom-[-2px] w-px z-10 bg-slate-600" 
                        style={{ left: getPosition(-3) }} 
                    />
                    <div className="absolute -bottom-4 text-[8px] font-mono -translate-x-1/2 text-slate-500" style={{ left: getPosition(-3) }}>-3</div>
                </div>

                {/* Integrated Marker (Diamond) */}
                <div ref={integratedRef} className="absolute top-[-3px] bottom-[-3px] w-0.5 z-30 hidden transition-all duration-300 bg-white shadow-[0_0_10px_white]">
                    <div className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rotate-45 transform shadow-sm bg-white"></div>
                </div>
            </div>
            
            {/* Dynamic Range Readout */}
            <div className="flex items-center justify-end gap-3 pl-2 border-t sm:border-t-0 sm:border-l border-white/5 pt-1 sm:pt-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Dyn</span>
                    <span ref={dynTextRef} className="text-[10px] font-mono font-bold w-6 text-right text-emerald-400">--</span>
                </div>
            </div>
        </div>
    );
});