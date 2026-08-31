import React, { useEffect, useRef, useState } from 'react';
import { EQParams, EQBand, SkinMode } from '../types';

interface VisualEQProps {
  params: EQParams;
  onChange: (key: keyof EQParams, val: EQBand) => void;
  onSelectBand?: (key: keyof EQParams | null) => void;
  selectedBand?: keyof EQParams | null;
  skin?: SkinMode;
}

export const VisualEQ: React.FC<VisualEQProps> = ({ params, onChange, onSelectBand, selectedBand, skin = 'modern' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<keyof EQParams | null>(null);
  
  const isClear = skin === 'clear';

  // Ref to hold params for the animation loop to read from without needing to be in dependency array
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const minGain = -15;
  const maxGain = 15;
  
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);

  const getX = (freq: number, width: number) => {
      const freqLog = Math.log10(Math.max(20, Math.min(20000, freq)));
      return ((freqLog - minLog) / (maxLog - minLog)) * width;
  };
  
  const getFreq = (x: number, width: number) => {
      const logFreq = (x / width) * (maxLog - minLog) + minLog;
      return Math.pow(10, logFreq);
  };

  const getY = (gain: number, height: number) => {
      const range = maxGain - minGain;
      const normalized = (gain - minGain) / range;
      return height - (normalized * height);
  };
  
  const getGain = (y: number, height: number) => {
      const range = maxGain - minGain;
      const normalized = (height - y) / height;
      return (normalized * range) + minGain;
  };

  const getResponse = (freq: number, type: 'lowshelf' | 'peaking' | 'highshelf', f0: number, gain: number, q: number) => {
      const ratio = freq / f0;
      if (type === 'peaking') {
          const dist = Math.abs(Math.log10(ratio));
          const w = 1 / (2 * Math.max(0.1, q));
          const falloff = Math.exp(-(dist * dist) / (w * w));
          return gain * falloff;
      } else if (type === 'lowshelf') {
          const sigmoid = 1 / (1 + Math.pow(ratio, 4));
          return gain * sigmoid;
      } else { 
          const sigmoid = 1 / (1 + Math.pow(1/ratio, 4));
          return gain * sigmoid;
      }
  };

  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const currentParams = paramsRef.current; // Read from ref

        // Resize logic (could be optimized to only run on resize event, but robust here)
        const parent = canvas.parentElement;
        if (parent) {
            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();
            // Only set dimensions if they changed to avoid clearing
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            } else {
                 ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            
            const width = rect.width;
            const height = rect.height;
            
            ctx.clearRect(0, 0, width, height);
            
            // 1. Grid
            ctx.strokeStyle = isClear ? "#f1f5f9" : "#1e293b";
            ctx.lineWidth = 1;
            ctx.beginPath();
            [100, 1000, 10000].forEach(f => {
                const x = getX(f, width);
                ctx.moveTo(x, 0); ctx.lineTo(x, height);
            });
            [0, 6, -6, 12, -12].forEach(g => {
                const y = getY(g, height);
                ctx.moveTo(0, y); ctx.lineTo(width, y);
            });
            ctx.stroke();

            // 2. Center Line (0dB)
            const yZero = getY(0, height);
            ctx.strokeStyle = isClear ? "#e2e8f0" : "#475569";
            ctx.beginPath(); ctx.moveTo(0, yZero); ctx.lineTo(width, yZero); ctx.stroke();

            // 3. Draw Curve
            ctx.beginPath();
            ctx.strokeStyle = isClear ? "#6366f1" : "#c084fc"; 
            ctx.lineWidth = 2;
            
            if (!isClear) {
                ctx.shadowColor = "#c084fc";
                ctx.shadowBlur = 10;
            }
            
            const bands: (keyof EQParams)[] = ['low', 'lowMid', 'mid', 'highMid', 'high'];
            const types: Record<string, 'lowshelf' | 'peaking' | 'highshelf'> = {
                low: 'lowshelf', lowMid: 'peaking', mid: 'peaking', highMid: 'peaking', high: 'highshelf'
            };

            for (let x = 0; x < width; x+=3) { // Step 3 for perf, looks fine
                const freq = getFreq(x, width);
                let totalGain = 0;
                
                bands.forEach(b => {
                    const p = currentParams[b];
                    totalGain += getResponse(freq, types[b], p.frequency, p.gain, p.q);
                });
                
                const y = getY(totalGain, height);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Reset shadow for fill
            ctx.shadowBlur = 0;
            
            // Fill Area
            ctx.lineTo(width, yZero);
            ctx.lineTo(0, yZero);
            ctx.fillStyle = isClear ? "rgba(99, 102, 241, 0.05)" : "rgba(192, 132, 252, 0.1)";
            ctx.fill();

            // 4. Draw Handles
            bands.forEach(n => {
                const p = currentParams[n];
                const x = getX(p.frequency, width);
                const y = getY(p.gain, height);
                
                const isSelected = selectedBand === n;
                // Note: dragNode is state, can be read directly here
                const isDragging = dragNode === n; 

                ctx.beginPath();
                ctx.arc(x, y, isSelected || isDragging ? 8 : 6, 0, Math.PI * 2);
                ctx.fillStyle = isSelected || isDragging ? (isClear ? "#4338ca" : "#ffffff") : (isClear ? "#fff" : "#c084fc");
                ctx.fill();
                ctx.strokeStyle = isClear ? "#4338ca" : "#581c87";
                ctx.lineWidth = 2;
                ctx.stroke();
                
                if (isSelected || isDragging) {
                    ctx.fillStyle = isClear ? "#1e293b" : "white";
                    ctx.font = isClear ? "10px sans-serif" : "10px sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText(`${p.gain > 0 ? '+' : ''}${p.gain.toFixed(1)}dB`, x, y - 14);
                    const freqText = p.frequency < 1000 ? Math.round(p.frequency) + 'Hz' : (p.frequency/1000).toFixed(1) + 'kHz';
                    ctx.fillText(freqText, x, y - 26);
                }
            });
        }
        animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dragNode, selectedBand, skin]); 

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      const nodes: (keyof EQParams)[] = ['low', 'lowMid', 'mid', 'highMid', 'high'];
      let closest: keyof EQParams | null = null;
      let minDist = 20;

      nodes.forEach(n => {
          const nx = getX(params[n].frequency, width);
          const ny = getY(params[n].gain, height);
          const dist = Math.sqrt(Math.pow(x - nx, 2) + Math.pow(y - ny, 2));
          if (dist < minDist) {
              minDist = dist;
              closest = n;
          }
      });
      
      if (closest) {
          setDragNode(closest);
          if (onSelectBand) onSelectBand(closest);
      } else {
          if (onSelectBand) onSelectBand(null);
      }
  };

  // Global event listeners for smoother dragging even outside canvas
  useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
          if (!dragNode || !canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const width = rect.width;
          const height = rect.height;
          
          const newGain = getGain(y, height);
          const newFreq = getFreq(x, width);

          const clampedGain = Math.max(minGain, Math.min(maxGain, newGain));
          const clampedFreq = Math.max(20, Math.min(20000, newFreq));
          
          onChange(dragNode, { ...params[dragNode], frequency: clampedFreq, gain: clampedGain });
      };

      const handleGlobalMouseUp = () => {
          setDragNode(null);
      };

      if (dragNode) {
          window.addEventListener('mousemove', handleGlobalMouseMove);
          window.addEventListener('mouseup', handleGlobalMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleGlobalMouseMove);
          window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
  }, [dragNode, params, onChange]);

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-64 rounded-lg relative cursor-default touch-none overflow-hidden ${isClear ? "bg-white border-b border-black/5" : "bg-slate-900 border border-slate-700"}`}
        onMouseDown={handleMouseDown}
    >
        <canvas ref={canvasRef} className="w-full h-full block rounded-lg" />
        <div className={`absolute top-2 right-2 text-[10px] pointer-events-none ${isClear ? "text-slate-400" : "text-slate-500"}`}>
            5-Band Parametric EQ
        </div>
    </div>
  );
};