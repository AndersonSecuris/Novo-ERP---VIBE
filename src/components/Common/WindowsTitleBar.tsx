import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Minus,
  Square,
  Copy,
  X,
  Maximize2,
  HardDrive,
  Monitor
} from 'lucide-react';
import { StoreSettings } from '../../types';

interface WindowsTitleBarProps {
  settings: StoreSettings;
}

export const WindowsTitleBar: React.FC<WindowsTitleBarProps> = ({ settings }) => {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isDesktop;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isElectron && window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized);
    }
  }, [isElectron]);

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = async () => {
    if (window.electronAPI?.maximize) {
      const maxState = await window.electronAPI.maximize();
      setIsMaximized(maxState);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  const handleToggleFullscreen = () => {
    if (window.electronAPI?.toggleFullScreen) {
      window.electronAPI.toggleFullScreen();
    }
  };

  return (
    <header
      id="windows-app-titlebar"
      className="h-9 bg-[#fbfbfd] border-b border-slate-200/80 flex items-center justify-between px-3.5 select-none text-xs text-slate-600 no-print z-50 shadow-xs"
      style={{ WebkitAppRegion: isElectron ? 'drag' : 'no-drag' } as any}
    >
      {/* Left: App icon, name and mode badge */}
      <div className="flex items-center gap-2.5 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="w-5 h-5 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
          <Smartphone className="w-3 h-3" />
        </div>
        <span className="font-semibold text-slate-800 text-xs truncate max-w-[280px]">
          {settings.name || 'TechCell'} - PDV & Assistência Técnica
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
          <Monitor className="w-2.5 h-2.5" />
          {isElectron ? 'Windows App (.exe)' : 'Modo Desktop Habilitado'}
        </span>
      </div>

      {/* Center: Quick shortcuts helper */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] text-slate-400 font-medium">
        <span><strong className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">F1</strong> PDV</span>
        <span><strong className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">F2</strong> Buscar</span>
        <span><strong className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">F4</strong> Finalizar</span>
        <span><strong className="text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">F11</strong> Tela Cheia</span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center h-full gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleToggleFullscreen}
          className="h-7 w-7 rounded-md hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          title="Alternar Tela Cheia (F11)"
        >
          <Maximize2 className="w-3 h-3" />
        </button>

        <button
          onClick={handleMinimize}
          className="h-7 w-7 rounded-md hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          title="Minimizar"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="h-7 w-7 rounded-md hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          onClick={handleClose}
          className="h-7 w-7 rounded-md hover:bg-rose-500 hover:text-white text-slate-500 transition-colors flex items-center justify-center cursor-pointer"
          title="Fechar Janela"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
