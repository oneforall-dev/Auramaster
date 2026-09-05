import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Loader2, TrendingUp, TrendingDown, Volume2, VolumeX, X, Sparkles, Sliders, ZoomIn, ZoomOut, Maximize2, Move, Scissors, ChevronLeft, ChevronRight, GripVertical, Undo2 } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { SkinMode } from '../types';
import { Language } from '../services/i18n';

interface VisualizerProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isRendering: boolean;
  mode: 'waveform' | 'spectrum' | 'vector';
  onPeakCalculated?: (peak: number) => void;
  onSeek?: (time: number) => void;
  selection?: { start: number; end: number } | null;
  onSelectionChange?: (range: { start: number; end: number } | null) => void;
  onApplySelectionEdit?: (action: 'gain' | 'fadeIn' | 'fadeOut' | 'mute', valueDb?: number) => void;
  canUndo?: boolean;
  onUndo?: () => void;
  skin?: SkinMode;
  lang?: Language;
}

export const Visualizer: React.FC<VisualizerProps> = React.memo(({ 
  audioBuffer, 
  currentTime, 
  duration, 
  isPlaying, 
  isRendering, 
  mode, 
  onPeakCalculated, 
  onSeek, 
  selection, 
  onSelectionChange, 
  onApplySelectionEdit,
  canUndo = false,
  onUndo,
  skin = 'modern',
  lang = 'es' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({ width: 800, height: 200, dpr: 1 });
  
  // Interaction Mode: 'scrub' (default: drag to seek) or 'select' (drag to highlight & edit)
  const [interactMode, setInteractMode] = useState<'scrub' | 'select'>('scrub');
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);

  // Horizontal Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1.0);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [isDraggingScrollbar, setIsDraggingScrollbar] = useState<boolean>(false);
  const scrollDragStartRef = useRef<{ startX: number; startOffset: number } | null>(null);

  // Selection Drag State
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [localSelection, setLocalSelection] = useState<{ start: number; end: number } | null>(selection || null);

  useEffect(() => {
    setLocalSelection(selection || null);
  }, [selection]);

  const activeSelection = localSelection;

  // Format seconds to mm:ss
  const formatTime = useCallback((seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Zoom handlers (focus around playhead/currentTime)
  const handleZoomIn = () => {
    setZoom(prev => {
      const next = Math.min(8.0, Math.round((prev * 1.5) * 10) / 10);
      const newVisible = duration / next;
      const targetTime = currentTime > 0 ? currentTime : scrollOffset;
      const newOffset = Math.max(0, Math.min(targetTime - newVisible / 2, Math.max(0, duration - newVisible)));
      setScrollOffset(newOffset);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(1.0, Math.round((prev / 1.5) * 10) / 10);
      if (next === 1.0) {
        setScrollOffset(0);
      } else {
        const newVisible = duration / next;
        const newOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, duration - newVisible)));
        setScrollOffset(newOffset);
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setScrollOffset(0);
  };

  const handleScrollStep = (direction: 'left' | 'right') => {
    const stepSec = visibleDuration * 0.25;
    setScrollOffset(prev => {
      if (direction === 'left') return Math.max(0, prev - stepSec);
      return Math.min(maxScroll, prev + stepSec);
    });
  };

  // Keep scroll offset clamped within valid range
  const visibleDuration = duration > 0 ? duration / zoom : 1;
  const maxScroll = Math.max(0, duration - visibleDuration);
  const clampedScrollOffset = Math.max(0, Math.min(scrollOffset, maxScroll));
  const startTime = clampedScrollOffset;
  const endTime = startTime + visibleDuration;

  // Auto-follow playhead during playback when zoomed
  useEffect(() => {
    if (isPlaying && zoom > 1.0 && duration > 0) {
      if (currentTime < startTime || currentTime > endTime) {
        const newOffset = Math.max(0, Math.min(currentTime - visibleDuration * 0.2, maxScroll));
        setScrollOffset(newOffset);
      }
    }
  }, [currentTime, isPlaying, zoom, duration, visibleDuration, maxScroll, startTime, endTime]);

  // 1. High-precision vector peak extraction
  const peaksData = useMemo(() => {
    if (!audioBuffer) return null;
    
    const numPoints = 2048;
    const numChannels = audioBuffer.numberOfChannels;
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }
    const length = channels[0].length;
    const mins = new Float32Array(numPoints);
    const maxs = new Float32Array(numPoints);
    let overallAbsMax = 0;

    for (let i = 0; i < numPoints; i++) {
      let chunkMin = 1.0;
      let chunkMax = -1.0;
      const startIdx = Math.floor((i / numPoints) * length);
      const endIdx = Math.floor(((i + 1) / numPoints) * length);
      const limit = Math.max(startIdx + 1, Math.min(endIdx, length));
      
      for (let c = 0; c < numChannels; c++) {
        const data = channels[c];
        let j = startIdx;
        while (j < limit) {
          const s = data[j];
          if (s < chunkMin) chunkMin = s;
          if (s > chunkMax) chunkMax = s;
          j++;
        }
      }

      if (chunkMin > chunkMax) {
        chunkMin = -0.002;
        chunkMax = 0.002;
      }
      if (chunkMax - chunkMin < 0.004) {
        const mid = (chunkMax + chunkMin) / 2;
        chunkMin = mid - 0.002;
        chunkMax = mid + 0.002;
      }

      const abs = Math.max(Math.abs(chunkMin), Math.abs(chunkMax));
      if (abs > overallAbsMax) overallAbsMax = abs;

      mins[i] = chunkMin;
      maxs[i] = chunkMax;
    }

    const safeMax = overallAbsMax > 0.000001 ? overallAbsMax : 0.000001;
    if (onPeakCalculated) {
      onPeakCalculated(20 * Math.log10(safeMax));
    }

    // True 1:1 physical dBFS amplitude scale (1.0 = 0 dBFS ceiling)
    const scaleFactor = 1.0;

    return { mins, maxs, scaleFactor, numPoints };
  }, [audioBuffer]);

  // Fast ResizeObserver to eliminate getBoundingClientRect layout thrashing
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const dpr = window.devicePixelRatio || 1;
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) {
          sizeRef.current = { width, height, dpr };
          if (canvasRef.current) {
            canvasRef.current.width = Math.floor(width * dpr);
            canvasRef.current.height = Math.floor(height * dpr);
          }
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 2. High-Performance Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const { width: drawWidth, height: drawHeight, dpr } = sizeRef.current;
      if (drawWidth <= 0 || drawHeight <= 0) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Dark Pro Background Fill
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, drawWidth, drawHeight);

      const centerY = drawHeight / 2;
      const PADDING_Y = 16;
      const amp = centerY - PADDING_Y;

      // 1. COMPLETE MASTERING dB RULER GUIDELINES (True 1:1 Physical dBFS Scale)
      const getYPos = (db: number) => {
        if (db === 0) return amp;
        const lin = Math.pow(10, db / 20);
        return amp * lin;
      };

      // 0 dBFS lines (Top & Bottom Full Scale)
      const y0Top = centerY - amp;
      const y0Bot = centerY + amp;
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y0Top); ctx.lineTo(drawWidth, y0Top);
      ctx.moveTo(0, y0Bot); ctx.lineTo(drawWidth, y0Bot);
      ctx.stroke();

      // -1.0 dBTP Dotted Red Lines (Top & Bottom Ceiling)
      const yCeilTop = centerY - getYPos(-1);
      const yCeilBot = centerY + getYPos(-1);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(244, 63, 94, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, yCeilTop); ctx.lineTo(drawWidth, yCeilTop);
      ctx.moveTo(0, yCeilBot); ctx.lineTo(drawWidth, yCeilBot);
      ctx.stroke();

      // Intermediate Guidelines (-3, -6, -12, -18)
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.10)";
      ctx.lineWidth = 1;
      [-3, -6, -12, -18].forEach(db => {
        const offset = getYPos(db);
        ctx.beginPath();
        ctx.moveTo(0, centerY - offset); ctx.lineTo(drawWidth, centerY - offset);
        ctx.moveTo(0, centerY + offset); ctx.lineTo(drawWidth, centerY + offset);
        ctx.stroke();
      });

      // Center Zero Baseline
      ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY); ctx.lineTo(drawWidth, centerY);
      ctx.stroke();

      // 2. ZOOM-MAPPED WAVEFORM RENDERING
      if (peaksData && duration > 0) {
        const { mins, maxs, scaleFactor, numPoints } = peaksData;

        // Gradient Fill
        const grad = ctx.createLinearGradient(0, PADDING_Y, 0, drawHeight - PADDING_Y);
        grad.addColorStop(0, "rgba(34, 211, 238, 0.95)");
        grad.addColorStop(0.25, "rgba(6, 182, 212, 0.80)");
        grad.addColorStop(0.5, "rgba(6, 182, 212, 0.35)");
        grad.addColorStop(0.75, "rgba(6, 182, 212, 0.80)");
        grad.addColorStop(1, "rgba(34, 211, 238, 0.95)");

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        // Top lobe
        for (let x = 0; x <= drawWidth; x += 2) {
          const t = startTime + (x / drawWidth) * visibleDuration;
          const fraction = Math.max(0, Math.min(0.9999, t / duration));
          const idx = Math.floor(fraction * numPoints);
          const val = Math.max(0.002, maxs[idx]) * scaleFactor * amp;
          const y = Math.max(PADDING_Y, centerY - val);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(drawWidth, centerY);

        // Bottom lobe
        for (let x = drawWidth; x >= 0; x -= 2) {
          const t = startTime + (x / drawWidth) * visibleDuration;
          const fraction = Math.max(0, Math.min(0.9999, t / duration));
          const idx = Math.floor(fraction * numPoints);
          const val = Math.max(0.002, -mins[idx]) * scaleFactor * amp;
          const y = Math.min(drawHeight - PADDING_Y, centerY + val);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // High-Precision Transient Bars
        ctx.fillStyle = "rgba(103, 232, 249, 0.35)";
        for (let x = 0; x <= drawWidth; x += 3) {
          const t = startTime + (x / drawWidth) * visibleDuration;
          const fraction = Math.max(0, Math.min(0.9999, t / duration));
          const idx = Math.floor(fraction * numPoints);
          const topH = Math.max(0.002, maxs[idx]) * scaleFactor * amp;
          const botH = Math.max(0.002, -mins[idx]) * scaleFactor * amp;
          ctx.fillRect(x, Math.max(PADDING_Y, centerY - topH), 1.4, topH + botH);
        }

        // Top Contour Line
        ctx.strokeStyle = "rgba(165, 243, 252, 0.95)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let x = 0; x <= drawWidth; x += 2) {
          const t = startTime + (x / drawWidth) * visibleDuration;
          const fraction = Math.max(0, Math.min(0.9999, t / duration));
          const idx = Math.floor(fraction * numPoints);
          const val = Math.max(0.002, maxs[idx]) * scaleFactor * amp;
          const y = Math.max(PADDING_Y, centerY - val);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Bottom Contour Line
        ctx.beginPath();
        for (let x = 0; x <= drawWidth; x += 2) {
          const t = startTime + (x / drawWidth) * visibleDuration;
          const fraction = Math.max(0, Math.min(0.9999, t / duration));
          const idx = Math.floor(fraction * numPoints);
          const val = Math.max(0.002, -mins[idx]) * scaleFactor * amp;
          const y = Math.min(drawHeight - PADDING_Y, centerY + val);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. PLAYHEAD (Direct AudioEngine Time Reading for 60-120fps smooth motion)
      if (duration > 0 && mode === 'waveform') {
        const liveTime = isPlaying ? audioEngine.getCurrentTime() : currentTime;
        const x = ((liveTime - startTime) / visibleDuration) * drawWidth;
        if (x >= 0 && x <= drawWidth) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 8;
          ctx.fillRect(x, 0, 2, drawHeight);
          ctx.shadowBlur = 0;
        }
      }

      // 4. SELECTION OVERLAY (Zoomed Coordinates)
      if (activeSelection && duration > 0 && mode === 'waveform') {
        const startX = ((activeSelection.start - startTime) / visibleDuration) * drawWidth;
        const endX = ((activeSelection.end - startTime) / visibleDuration) * drawWidth;
        const leftX = Math.max(0, Math.min(drawWidth, startX));
        const rightX = Math.max(0, Math.min(drawWidth, endX));
        const width = rightX - leftX;

        if (width > 0) {
          ctx.fillStyle = "rgba(34, 211, 238, 0.22)";
          ctx.fillRect(leftX, 0, width, drawHeight);
          
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(leftX, 0, width, drawHeight);
        }
      }

      // 5. READABLE dB RULER BADGES (Right-Aligned Pill Tags)
      const badgeRight = drawWidth - 8;
      ctx.font = "600 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      const drawBadge = (text: string, yPos: number, color: string, bg: string, border: string) => {
        const textWidth = ctx.measureText(text).width;
        const badgeW = textWidth + 8;
        const badgeH = 14;
        const badgeX = badgeRight - badgeW;
        const badgeY = yPos - badgeH / 2;

        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
        ctx.fill();

        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillText(text, badgeRight - 4, yPos);
      };

      // Top Badges
      drawBadge("0 dB", y0Top, "rgba(226, 232, 240, 0.9)", "rgba(15, 23, 42, 0.85)", "rgba(148, 163, 184, 0.3)");
      drawBadge("-1 dB", yCeilTop, "rgba(244, 63, 94, 0.95)", "rgba(15, 23, 42, 0.85)", "rgba(244, 63, 94, 0.4)");
      drawBadge("-3 dB", centerY - getYPos(-3), "rgba(148, 163, 184, 0.8)", "rgba(15, 23, 42, 0.75)", "rgba(148, 163, 184, 0.2)");
      drawBadge("-6 dB", centerY - getYPos(-6), "rgba(148, 163, 184, 0.8)", "rgba(15, 23, 42, 0.75)", "rgba(148, 163, 184, 0.2)");
      drawBadge("-12 dB", centerY - getYPos(-12), "rgba(100, 116, 139, 0.7)", "rgba(15, 23, 42, 0.70)", "rgba(100, 116, 139, 0.2)");

      // Center Baseline Badge
      drawBadge("0 DC", centerY, "rgba(34, 211, 238, 0.9)", "rgba(15, 23, 42, 0.85)", "rgba(6, 182, 212, 0.3)");

      // Bottom Badges
      drawBadge("-12 dB", centerY + getYPos(-12), "rgba(100, 116, 139, 0.7)", "rgba(15, 23, 42, 0.70)", "rgba(100, 116, 139, 0.2)");
      drawBadge("-6 dB", centerY + getYPos(-6), "rgba(148, 163, 184, 0.8)", "rgba(15, 23, 42, 0.75)", "rgba(148, 163, 184, 0.2)");
      drawBadge("-3 dB", centerY + getYPos(-3), "rgba(148, 163, 184, 0.8)", "rgba(15, 23, 42, 0.75)", "rgba(148, 163, 184, 0.2)");
      drawBadge("-1 dB", yCeilBot, "rgba(244, 63, 94, 0.95)", "rgba(15, 23, 42, 0.85)", "rgba(244, 63, 94, 0.4)");
      drawBadge("0 dB", y0Bot, "rgba(226, 232, 240, 0.9)", "rgba(15, 23, 42, 0.85)", "rgba(148, 163, 184, 0.3)");
    };

    render();
    const loop = () => {
      render();
      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, [peaksData, currentTime, mode, isPlaying, duration, activeSelection, zoom, startTime, visibleDuration]);

  // Convert mouse X to absolute song time
  const getTimelineTime = (e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return 0;
    const { width: drawWidth } = sizeRef.current;
    if (drawWidth <= 0) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(x, drawWidth));
    return startTime + (clampedX / drawWidth) * visibleDuration;
  };

  // Main Waveform Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return;
    
    const t = getTimelineTime(e);
    setDragStart(t);

    if (interactMode === 'select' || e.shiftKey) {
      setIsSelecting(true);
      setLocalSelection({ start: t, end: t });
    } else {
      setIsScrubbing(true);
      if (onSeek) onSeek(t);
    }
  };

  // Main Waveform Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (duration <= 0) return;

    if (isScrubbing) {
      const t = getTimelineTime(e);
      if (onSeek) onSeek(t);
    } else if (isSelecting && dragStart !== null) {
      const t = getTimelineTime(e);
      const start = Math.min(dragStart, t);
      const end = Math.max(dragStart, t);
      setLocalSelection({ start, end });
    }
  };

  // Main Waveform Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isScrubbing) {
      setIsScrubbing(false);
    }

    if (isSelecting && dragStart !== null && duration > 0) {
      setIsSelecting(false);
      const t = getTimelineTime(e);
      const start = Math.min(dragStart, t);
      const end = Math.max(dragStart, t);
      if (end - start > 0.08) {
        setLocalSelection({ start, end });
        if (onSelectionChange) onSelectionChange({ start, end });
      } else {
        setLocalSelection(null);
        if (onSelectionChange) onSelectionChange(null);
      }
    }

    setDragStart(null);
  };

  // Scrollbar Track Mouse Down / Drag
  const handleScrollbarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!scrollbarTrackRef.current || duration <= 0 || zoom <= 1.0) return;
    
    const rect = scrollbarTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const fraction = Math.max(0, Math.min(1, clickX / trackWidth));
    
    // Jump viewport to clicked region
    const targetOffset = Math.max(0, Math.min(fraction * duration - visibleDuration / 2, maxScroll));
    setScrollOffset(targetOffset);

    setIsDraggingScrollbar(true);
    scrollDragStartRef.current = { startX: e.clientX, startOffset: targetOffset };
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingScrollbar && scrollDragStartRef.current && scrollbarTrackRef.current && duration > 0) {
        const dx = e.clientX - scrollDragStartRef.current.startX;
        const trackWidth = scrollbarTrackRef.current.getBoundingClientRect().width;
        const dt = (dx / trackWidth) * duration;
        const newOffset = Math.max(0, Math.min(scrollDragStartRef.current.startOffset + dt, maxScroll));
        setScrollOffset(newOffset);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingScrollbar) {
        setIsDraggingScrollbar(false);
        scrollDragStartRef.current = null;
      }
    };

    if (isDraggingScrollbar) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDraggingScrollbar, duration, maxScroll]);

  // Mouse wheel pan & pinch-to-zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (duration <= 0) return;
    
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 1.2 : 0.833;
      setZoom(prev => Math.max(1.0, Math.min(8.0, Math.round(prev * zoomDelta * 10) / 10)));
    } else if (zoom > 1.0) {
      e.preventDefault();
      const deltaSec = ((e.deltaX || e.deltaY) / 300) * visibleDuration;
      setScrollOffset(prev => Math.max(0, Math.min(prev + deltaSec, maxScroll)));
    }
  };

  return (
    <div 
      className="w-full h-full flex flex-col relative select-none overflow-hidden bg-slate-950 rounded-xl"
      onWheel={handleWheel}
    >
      {/* Canvas Waveform Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full relative cursor-crosshair overflow-hidden min-h-[140px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsScrubbing(false); setIsSelecting(false); setDragStart(null); }}
      >
        <canvas ref={canvasRef} className="w-full h-full relative z-10 block" />

        {/* Floating Horizontal Zoom & Navigation Toolbar (Top Left) */}
        <div 
          className="absolute top-2.5 left-3 z-30 flex items-center gap-1.5 p-1 bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-xl shadow-2xl text-slate-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Mode Switcher (Scrub vs Select) */}
          <div className="flex items-center bg-black/50 rounded-lg p-0.5 border border-white/5 mr-1">
            <button
              onClick={() => { setInteractMode('scrub'); setLocalSelection(null); onSelectionChange?.(null); }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                interactMode === 'scrub' ? 'bg-cyan-500 text-black font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Scrubbing: Arrastra sobre la onda para avanzar/retroceder en tiempo real"
            >
              <Move size={11} />
              <span>Scrub</span>
            </button>
            <button
              onClick={() => setInteractMode('select')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                interactMode === 'select' ? 'bg-cyan-500 text-black font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Selección: Arrastra para seleccionar y editar (Fades, Ganancia, Mute)"
            >
              <Scissors size={11} />
              <span>{lang === 'es' ? 'Selección' : 'Select'}</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Stepper Buttons */}
          {zoom > 1.0 && (
            <button
              onClick={() => handleScrollStep('left')}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Desplazar a la izquierda"
            >
              <ChevronLeft size={13} />
            </button>
          )}

          {/* Zoom Out */}
          <button 
            onClick={handleZoomOut}
            disabled={zoom <= 1.0}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut size={13} />
          </button>

          {/* Zoom % Badge */}
          <button
            onClick={handleResetZoom}
            className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all cursor-pointer"
            title="Restablecer escala (Fit 100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button 
            onClick={handleZoomIn}
            disabled={zoom >= 8.0}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn size={13} />
          </button>

          {zoom > 1.0 && (
            <button
              onClick={() => handleScrollStep('right')}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Desplazar a la derecha"
            >
              <ChevronRight size={13} />
            </button>
          )}

          {zoom > 1.0 && (
            <button 
              onClick={handleResetZoom}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all cursor-pointer ml-0.5"
              title="Ajustar a 100%"
            >
              <Maximize2 size={9} />
              <span>Fit</span>
            </button>
          )}

          {/* Global Undo Button */}
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm ml-1 animate-in fade-in"
              title="Deshacer última edición (Ctrl+Z)"
            >
              <Undo2 size={11} />
              <span>Deshacer</span>
            </button>
          )}
        </div>

        {/* Floating Selection Tool Bar */}
        {activeSelection && duration > 0 && Math.abs(activeSelection.end - activeSelection.start) > 0.05 && (
          <div 
            className="absolute top-2.5 z-40 transform -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-slate-900/95 border border-slate-700/90 backdrop-blur-2xl rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100"
            style={{
              left: `${Math.min(90, Math.max(10, ((((activeSelection.start + activeSelection.end) / 2 - startTime) / visibleDuration)) * 100))}%`
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Duration Badge */}
            <div className="flex items-center gap-1 px-2 text-[10px] font-mono font-bold text-cyan-400 border-r border-slate-800 shrink-0">
              <span>{(activeSelection.end - activeSelection.start).toFixed(2)}s</span>
            </div>

            {/* Gain Down */}
            <button 
              onClick={() => onApplySelectionEdit?.('gain', -2)}
              className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 hover:text-cyan-300 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold transition-all border border-slate-700/50 cursor-pointer"
              title="Bajar volumen -2 dB"
            >
              -2 dB
            </button>

            {/* Gain Up */}
            <button 
              onClick={() => onApplySelectionEdit?.('gain', +2)}
              className="px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 hover:text-cyan-300 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold transition-all border border-slate-700/50 cursor-pointer"
              title="Subir volumen +2 dB"
            >
              +2 dB
            </button>

            {/* Fade In */}
            <button 
              onClick={() => onApplySelectionEdit?.('fadeIn')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/90 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-700/50 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
              title="Fade In (Entrada suave)"
            >
              <TrendingUp size={12} className="text-cyan-400" />
              <span>Fade In</span>
            </button>

            {/* Fade Out */}
            <button 
              onClick={() => onApplySelectionEdit?.('fadeOut')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/90 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40 border border-slate-700/50 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
              title="Fade Out (Salida suave)"
            >
              <TrendingDown size={12} className="text-cyan-400" />
              <span>Fade Out</span>
            </button>

            {/* Mute */}
            <button 
              onClick={() => onApplySelectionEdit?.('mute')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/90 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 border border-slate-700/50 active:scale-95 text-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
              title="Silenciar selección"
            >
              <VolumeX size={12} className="text-rose-400" />
              <span>Mute</span>
            </button>

            {/* Undo if available */}
            {canUndo && (
              <button 
                onClick={onUndo}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                title="Deshacer última edición (Ctrl+Z)"
              >
                <Undo2 size={12} />
                <span>Deshacer</span>
              </button>
            )}

            {/* Deselect / Close */}
            <button 
              onClick={() => {
                setLocalSelection(null);
                onSelectionChange?.(null);
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all ml-0.5 cursor-pointer"
              title="Deseleccionar"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Prominent Dedicated Horizontal Navigation Scrollbar (Auto-appears when zoom > 1.0) */}
      {zoom > 1.0 && duration > 0 && (
        <div className="h-9 shrink-0 bg-slate-900 border-t border-slate-800/90 flex items-center gap-2 px-2 select-none z-20">
          {/* Scroll Left Button */}
          <button
            onClick={() => handleScrollStep('left')}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 shadow-sm transition-all cursor-pointer shrink-0"
            title="Desplazar a la izquierda"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Draggable Scroll Track Container */}
          <div 
            ref={scrollbarTrackRef}
            onMouseDown={handleScrollbarMouseDown}
            className="flex-1 h-6 bg-slate-950 rounded-lg relative overflow-hidden border border-slate-800 cursor-pointer shadow-inner flex items-center"
          >
            {/* Viewport Window Slider Thumb */}
            <div 
              className="absolute top-0.5 bottom-0.5 bg-cyan-500/25 border-2 border-cyan-400 rounded-md shadow-[0_0_12px_rgba(6,182,212,0.5)] cursor-grab active:cursor-grabbing flex items-center justify-center transition-shadow hover:shadow-[0_0_16px_rgba(6,182,212,0.8)]"
              style={{
                left: `${(startTime / duration) * 100}%`,
                width: `${Math.max(6, (visibleDuration / duration) * 100)}%`
              }}
            >
              <div className="flex items-center gap-1 text-[9px] font-mono font-black text-cyan-200 drop-shadow select-none">
                <GripVertical size={11} className="text-cyan-300" />
                <span className="hidden sm:inline-block">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => handleScrollStep('right')}
            className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 shadow-sm transition-all cursor-pointer shrink-0"
            title="Desplazar a la derecha"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Frosted Apple-Grade Loading Overlay */}
      {isRendering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl">
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-lg shadow-cyan-500/20">
              <Loader2 size={28} className="animate-spin text-cyan-400" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold tracking-wide text-white">
                {lang === 'es' ? 'Generando forma de onda...' : lang === 'ko' ? '파형 렌더링 중...' : lang === 'ja' ? '波形をレンダリング中...' : 'Rendering waveform...'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {lang === 'es' ? 'Calculando precisión 32-bit DSP' : 'Processing 32-bit floating DSP'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
