import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { Clock, Play, Pause, Disc } from 'lucide-react';

interface TimelineBarProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  trackName?: string;
}

export const TimelineBar: React.FC<TimelineBarProps> = React.memo(({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  trackName
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  const remainingTimeTextRef = useRef<HTMLSpanElement>(null);

  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number | null>(null);

  // Format seconds to mm:ss.d
  const formatTime = useCallback((seconds: number, includeTenths = true) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    return includeTenths ? `${mm}:${ss}.${tenths}` : `${mm}:${ss}`;
  }, []);

  // Compute adaptive ruler tick marks based on song duration
  const rulerTicks = useMemo(() => {
    if (duration <= 0) return [];
    
    // Choose sensible interval based on duration
    let majorInterval = 10; // in seconds
    if (duration > 600) majorInterval = 60; // >10 min -> 1 min
    else if (duration > 300) majorInterval = 30; // >5 min -> 30s
    else if (duration > 120) majorInterval = 15; // >2 min -> 15s
    else if (duration > 60) majorInterval = 10;  // >1 min -> 10s
    else if (duration > 20) majorInterval = 5;   // >20s -> 5s
    else majorInterval = 2;                     // <=20s -> 2s

    const minorInterval = majorInterval / 5;
    const ticks: { time: number; label?: string; isMajor: boolean; pct: number }[] = [];

    for (let t = 0; t <= duration; t += minorInterval) {
      const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs((t % majorInterval) - majorInterval) < 0.001;
      const pct = (t / duration) * 100;
      ticks.push({
        time: t,
        label: isMajor ? formatTime(t, false) : undefined,
        isMajor,
        pct
      });
    }

    return ticks;
  }, [duration, formatTime]);

  // High-performance 60fps direct DOM needle update (zero React lag)
  useEffect(() => {
    let rafId: number;

    const updatePlayhead = () => {
      if (duration > 0) {
        const liveTime = isPlaying ? audioEngine.getCurrentTime() : currentTime;
        const pct = Math.max(0, Math.min(100, (liveTime / duration) * 100));

        if (playheadRef.current) {
          playheadRef.current.style.left = `${pct}%`;
        }
        if (progressFillRef.current) {
          progressFillRef.current.style.width = `${pct}%`;
        }
        if (currentTimeTextRef.current) {
          currentTimeTextRef.current.innerText = formatTime(liveTime, true);
        }
        if (remainingTimeTextRef.current) {
          const rem = Math.max(0, duration - liveTime);
          remainingTimeTextRef.current.innerText = `-${formatTime(rem, false)}`;
        }
      }
      rafId = requestAnimationFrame(updatePlayhead);
    };

    rafId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, duration, currentTime, formatTime]);

  // Convert mouse event to timeline time
  const getTimeFromEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!trackRef.current || duration <= 0) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    return fraction * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    const time = getTimeFromEvent(e);
    setIsScrubbing(true);
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(fraction * duration);
    setHoverPos(fraction * 100);

    if (isScrubbing) {
      onSeek(fraction * duration);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverPos(null);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isScrubbing && duration > 0) {
        const time = getTimeFromEvent(e);
        onSeek(time);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isScrubbing, duration, onSeek]);

  return (
    <div className="shrink-0 rounded-xl p-2.5 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-lg select-none">
      {/* Top Meta Header: Current Time / Track Name / Duration */}
      <div className="flex items-center justify-between text-[11px] font-mono px-1">
        {/* Current Time Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
            <span ref={currentTimeTextRef} className="font-bold tracking-wider">
              {formatTime(currentTime, true)}
            </span>
          </div>
          {trackName && (
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-sans truncate max-w-[200px]">
              {trackName}
            </span>
          )}
        </div>

        {/* Total Duration & Remaining Badge */}
        <div className="flex items-center gap-2 text-slate-400 text-[10px]">
          <span ref={remainingTimeTextRef} className="text-slate-500">
            -{formatTime(Math.max(0, duration - currentTime), false)}
          </span>
          <span className="text-slate-600">/</span>
          <div className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 font-bold text-slate-300">
            {formatTime(duration, false)}
          </div>
        </div>
      </div>

      {/* Interactive Timeline Ruler Bar */}
      <div 
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-8 relative cursor-pointer group flex flex-col justify-end"
      >
        {/* Background Track with Subtle Glow */}
        <div className="absolute inset-x-0 bottom-0 h-4 bg-slate-950/90 rounded-lg border border-slate-800/90 overflow-hidden shadow-inner">
          {/* Active Progress Fill */}
          <div 
            ref={progressFillRef}
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-600/50 to-cyan-400/70 border-r border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-[width] duration-75 ease-out"
            style={{ width: '0%' }}
          />
        </div>

        {/* Tick Marks Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {rulerTicks.map((tick, idx) => (
            <div 
              key={idx}
              className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label && (
                <span className="text-[8px] font-mono font-medium text-slate-500 leading-none mb-1 select-none">
                  {tick.label}
                </span>
              )}
              <div 
                className={`w-px ${tick.isMajor ? 'h-3.5 bg-slate-500/80' : 'h-1.5 bg-slate-700/50'}`}
              />
            </div>
          ))}
        </div>

        {/* Hover Time Tooltip Indicator */}
        {hoverPos !== null && hoverTime !== null && (
          <div 
            className="absolute top-0 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center animate-in fade-in duration-100"
            style={{ left: `${hoverPos}%` }}
          >
            <div className="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-[9px] font-bold shadow-lg">
              {formatTime(hoverTime, true)}
            </div>
            <div className="w-px h-5 bg-cyan-400/60" />
          </div>
        )}

        {/* Playhead Needle Cursor */}
        <div 
          ref={playheadRef}
          className="absolute bottom-0 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
          style={{ left: '0%' }}
        >
          {/* Top Diamond Pip */}
          <div className="w-2.5 h-2.5 rotate-45 bg-cyan-300 border border-white shadow-[0_0_8px_#22d3ee] -mb-1" />
          {/* Vertical Needle */}
          <div className="w-0.5 h-5 bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
        </div>
      </div>
    </div>
  );
});
