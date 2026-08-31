import React, { useState } from 'react';
import { Track, SkinMode } from '../types';
import { X, Scissors, ChevronDown, ChevronUp } from 'lucide-react';

interface MixerChannelProps {
  track: Track;
  onChange: (id: string, updates: Partial<Track>) => void;
  onRemove: (id: string) => void;
  onSplit?: (id: string) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  skin?: SkinMode;
  variant?: 'full' | 'minimal';
}

export const MixerChannel: React.FC<MixerChannelProps> = ({ track, onChange, onRemove, onSplit, onSelect, isSelected = false, skin = 'modern', variant = 'full' }) => {
  const isClear = skin === 'clear';
  const [showTools, setShowTools] = useState(false);
  
  // Selection Styles
  const selectedStyle = isSelected 
    ? (isClear ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900/10" : "border-cyan-500/50 bg-cyan-950/20 ring-1 ring-cyan-500/30") 
    : (isClear ? "border-black/5 bg-white hover:border-black/10" : "border-white/5 bg-white/5 hover:border-white/10");

  const handleClick = (e: React.MouseEvent) => {
      // Don't select if clicking buttons
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
      if (onSelect) onSelect(track.id);
  };

  // MINIMAL VARIANT (For Files Box)
  if (variant === 'minimal') {
      return (
        <div onClick={handleClick} className={`w-full rounded-lg p-2 flex items-center gap-2 transition-all group relative border cursor-pointer ${selectedStyle}`}>
            {/* Track Color Strip */}
            <div className={`w-1 h-6 rounded-full shrink-0`} style={{ backgroundColor: track.color }} />
            
            {/* Track Name */}
            <div className="flex-1 min-w-0">
                <span className={`text-xs font-bold truncate font-mono block ${isClear ? "text-slate-900" : "text-slate-200"}`} title={track.name}>
                    {track.name}
                </span>
            </div>

            {/* Remove Button */}
            <button 
                onClick={() => onRemove(track.id)}
                className={`p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${isClear ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-500 hover:text-red-400 hover:bg-white/5"}`}
                title="Remove File"
            >
                <X size={14} />
            </button>
        </div>
      );
  }

  // FULL VARIANT (For Mixer Tab)
  return (
    <div onClick={handleClick} className={`w-full rounded-xl p-3 flex flex-col gap-2 transition-all group relative backdrop-blur-sm border cursor-pointer ${selectedStyle} ${isClear ? "shadow-sm" : "shadow-lg hover:shadow-xl"}`}>
       {/* Main Row */}
       <div className="flex items-center gap-3 w-full">
            {/* Track Color Strip */}
            <div className={`w-1 h-8 rounded-full shrink-0 ${isClear ? "" : "shadow-[0_0_8px_currentColor]"}`} style={{ backgroundColor: track.color, color: track.color }} />
            
            {/* Track Name */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <span className={`text-xs font-bold truncate font-mono ${isClear ? "text-slate-900" : "text-slate-200"}`} title={track.name}>
                    {track.name}
                </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-1">
                    <button 
                        onClick={() => onChange(track.id, { muted: !track.muted })}
                        className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                            track.muted 
                            ? (isClear ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/20 text-red-400 border border-red-500/50') 
                            : (isClear ? 'bg-slate-100 text-slate-400 hover:text-slate-900' : 'bg-white/5 text-slate-500 hover:bg-white/10')
                        }`}
                        title="Mute"
                    >M</button>
                    <button 
                        onClick={() => onChange(track.id, { soloed: !track.soloed })}
                        className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                            track.soloed 
                            ? (isClear ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50') 
                            : (isClear ? 'bg-slate-100 text-slate-400 hover:text-slate-900' : 'bg-white/5 text-slate-500 hover:bg-white/10')
                        }`}
                        title="Solo"
                    >S</button>
                </div>
                
                {/* Volume Slider */}
                 <div className="flex flex-col justify-center w-16 gap-0.5">
                    <div className={`relative w-full h-1.5 rounded-full overflow-hidden ${isClear ? "bg-slate-200" : "bg-slate-900"}`}>
                        <div 
                            className={`absolute top-0 left-0 h-full rounded-full pointer-events-none ${isClear ? "bg-slate-900" : "bg-cyan-500"}`} 
                            style={{ width: `${(Math.min(1.5, Math.max(0, track.volume)) / 1.5) * 100}%` }}
                        />
                        <input 
                            type="range"
                            min="0" max="1.5" step="0.01"
                            value={track.volume}
                            onChange={(e) => onChange(track.id, { volume: parseFloat(e.target.value) })}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            
            {/* Tools Toggle / Remove */}
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setShowTools(!showTools)}
                    className={`p-1 rounded-md transition-colors ${isClear ? "text-slate-400 hover:text-slate-900" : "text-slate-500 hover:text-white"}`}
                >
                   {showTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button 
                    onClick={() => onRemove(track.id)}
                    className={`p-1 rounded-md transition-colors hover:bg-red-500/10 hover:text-red-500 ${isClear ? "text-slate-300" : "text-slate-600"}`}
                >
                    <X size={14} />
                </button>
            </div>
       </div>

       {/* Expanded Tools Area */}
       {showTools && (
           <div className={`w-full pt-2 mt-1 border-t flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-200 ${isClear ? "border-slate-100" : "border-white/5"}`}>
               <button 
                  onClick={() => onSplit && onSplit(track.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${isClear ? "bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700" : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"}`}
               >
                   <Scissors size={10} /> Cut
               </button>

                <div className="flex items-center gap-1.5 flex-1 min-w-[60px]">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Pan</span>
                    <input 
                        type="range" min="-1" max="1" step="0.1" value={track.pan}
                        onChange={(e) => onChange(track.id, { pan: parseFloat(e.target.value) })}
                        className={`flex-1 h-1 rounded-full appearance-none cursor-pointer ${isClear ? "bg-slate-200 accent-slate-900" : "bg-slate-800 accent-slate-400 hover:accent-cyan-400"}`}
                    />
                </div>
           </div>
       )}
    </div>
  );
};