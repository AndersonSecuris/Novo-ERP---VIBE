import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Check } from 'lucide-react';

interface PatternLockProps {
  value?: string; // Comma-separated numbers e.g. "1,2,5,8,9" or empty
  onChange?: (pattern: string) => void;
  readonly?: boolean;
}

export const PatternLock: React.FC<PatternLockProps> = ({
  value = '',
  onChange,
  readonly = false
}) => {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize initial pattern
  useEffect(() => {
    if (value) {
      const parsed = value
        .split(',')
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 9);
      setSelectedDots(parsed);
    } else {
      setSelectedDots([]);
    }
  }, [value]);

  const handleDotClick = (dotNumber: number) => {
    if (readonly) return;
    if (selectedDots.includes(dotNumber)) {
      // If clicking already selected, let user clear or click sequence
      return;
    }
    const newDots = [...selectedDots, dotNumber];
    setSelectedDots(newDots);
    onChange?.(newDots.join(','));
  };

  const handleClear = () => {
    if (readonly) return;
    setSelectedDots([]);
    onChange?.('');
  };

  // Dots grid 1 to 9 (3x3)
  const dots = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="flex flex-col items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Padrão de Desenho (3x3)
        </span>
        {!readonly && selectedDots.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-100 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* 3x3 Grid */}
      <div
        ref={containerRef}
        className="relative grid grid-cols-3 gap-4 p-3 bg-white rounded-xl border border-slate-200 shadow-xs select-none"
      >
        {dots.map(dot => {
          const indexInSequence = selectedDots.indexOf(dot);
          const isSelected = indexInSequence !== -1;

          return (
            <button
              key={dot}
              type="button"
              disabled={readonly}
              onClick={() => handleDotClick(dot)}
              className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-4 ring-blue-500/20 scale-105'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <span className="text-xs font-bold font-mono">
                {isSelected ? indexInSequence + 1 : dot}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pattern sequence text */}
      <div className="mt-2 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-1">
        <span>Sequência:</span>
        <span className="font-semibold text-blue-600">
          {selectedDots.length > 0 ? selectedDots.join(' → ') : 'Nenhum padrão definido'}
        </span>
      </div>
    </div>
  );
};
