import React, { useState, useEffect, useRef } from 'react';
import { SkinMode } from '../types';

type SliderVariant = 'cyan' | 'purple' | 'orange' | 'pink' | 'default';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
  className?: string;
  variant?: SliderVariant;
  skin?: SkinMode;
}

const variantStyles: Record<SliderVariant, { text: string; shadow: string; thumb: string }> = {
  default: { text: "text-slate-400", shadow: "shadow-slate-500/50", thumb: "bg-slate-400" },
  cyan: { text: "text-cyan-400", shadow: "shadow-cyan-500/50", thumb: "bg-cyan-400" },
  purple: { text: "text-purple-400", shadow: "shadow-purple-500/50", thumb: "bg-purple-400" },
  orange: { text: "text-orange-400", shadow: "shadow-orange-500/50", thumb: "bg-orange-400" },
  pink: { text: "text-pink-400", shadow: "shadow-pink-500/50", thumb: "bg-pink-400" },
};

export const SliderControl: React.FC<SliderControlProps> = ({ 
  label, value, min, max, step, unit = '', onChange, className = '', variant = 'default', skin = 'modern'
}) => {
  const styles = variantStyles[variant];
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isClear = skin === 'clear';

  const getDecimals = () => {
      if (step < 0.01) return 3;
      if (unit === 'x' || unit === 's') return 2;
      return 1;
  };

  useEffect(() => {
    setInputValue(value.toFixed(getDecimals()));
  }, [value, unit, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    let newVal = parseFloat(inputValue);
    if (isNaN(newVal)) newVal = value;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
    setInputValue(newVal.toFixed(getDecimals()));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col space-y-2 group ${className}`}>
      {/* Label Row */}
      <div className="flex justify-between items-baseline">
        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isClear ? "text-slate-500" : "text-slate-500 group-hover:text-slate-300"}`}>{label}</span>
        <div className="flex items-center gap-0.5">
            <input 
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`w-[3.5rem] bg-transparent text-right text-xs font-mono font-bold focus:outline-none focus:text-white transition-colors ${isClear ? "text-slate-900 focus:text-slate-700" : styles.text}`}
            />
            <span className={`text-[9px] font-medium select-none ${isClear ? "text-slate-400" : "text-slate-600"}`}>{unit}</span>
        </div>
      </div>

      {/* Custom Slider Track */}
      <div className="relative h-4 w-full flex items-center">
        {/* Background Track */}
        {isClear ? (
             <div className="absolute left-0 right-0 h-[2px] bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900" style={{ width: `${percentage}%` }} />
             </div>
        ) : (
             <div className="absolute left-0 right-0 h-[2px] bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${styles.thumb} opacity-50`} style={{ width: `${percentage}%` }} />
             </div>
        )}
        
        {/* Native Input (Invisible but interactive) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {/* Custom Thumb (Visual only) */}
        {isClear ? (
            <div 
                className="absolute h-3 w-3 bg-white border border-slate-300 rounded-full shadow-sm transition-transform duration-75 ease-out pointer-events-none z-0"
                style={{ left: `calc(${percentage}% - 6px)` }}
            >
            </div>
        ) : (
            <div 
                className={`absolute h-3 w-3 rounded-full border-[1.5px] border-black ${styles.thumb} ${styles.shadow} shadow-[0_0_12px_currentColor] transition-transform duration-75 ease-out pointer-events-none z-0`}
                style={{ left: `calc(${percentage}% - 6px)` }}
            />
        )}
      </div>
    </div>
  );
};