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
      className="h-8 bg-slate-950 border-b border-slate-850 flex items-center justify-between px-3 select-none text-xs text-slate-400 no-print z-50"
      style={{ WebkitAppRegion: isElectron ? 'drag' : 'no-drag' } as any}
    >
      {/* Left: App icon, name and mode badge */}
      <div className="flex items-center gap-2 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="w-4 h-4 rounded bg-indigo-600 flex items-center justify-center text-white shrink-0">
          <Smartphone className="w-2.5 h-2.5" />
        </div>
        <span className="font-bold text-slate-200 text-xs truncate max-w-[280px]">
          {settings.name || 'TechCell'} - Sistema de PDV & Assistência Técnica
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Monitor className="w-2.5 h-2.5" />
          {isElectron ? 'Windows App (.exe)' : 'Modo Desktop Habilitado'}
        </span>
      </div>

      {/* Center: Quick shortcuts helper */}
      <div className="hidden lg:flex items-center gap-4 text-[10px] text-slate-500">
        <span><strong className="text-slate-400 font-mono">F1</strong> PDV</span>
        <span><strong className="text-slate-400 font-mono">F2</strong> Buscar</span>
        <span><strong className="text-slate-400 font-mono">F4</strong> Finalizar</span>
        <span><strong className="text-slate-400 font-mono">F11</strong> Tela Cheia</span>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleToggleFullscreen}
          className="h-8 px-2.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
          title="Alternar Tela Cheia (F11)"
        >
          <Maximize2 className="w-3 h-3" />
        </button>

        <button
          onClick={handleMinimize}
          className="h-8 px-3 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
          title="Minimizar"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="h-8 px-3 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-pointer"
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          onClick={handleClose}
          className="h-8 px-3.5 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors flex items-center justify-center cursor-pointer"
          title="Fechar Janela"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
