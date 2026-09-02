import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  Check,
  AlertCircle,
  ChevronDown,
  X,
  Usb,
  Sparkles
} from 'lucide-react';
import {
  isWebSerialSupported,
  getAuthorizedSerialPorts,
  requestSerialPort,
  getActiveSerialPort,
  setActiveSerialPort,
  clearActiveSerialPort,
  getActiveSerialPortLabel,
  SerialPortInfo
} from '../../services/escpos';

interface SerialPortPickerProps {
  selectedPortName?: string;
  baudRate?: number;
  onPortNameChange?: (portName: string) => void;
  onBaudRateChange?: (baudRate: number) => void;
  onPortSelected?: (port: any, info: SerialPortInfo) => void;
  variant?: 'compact' | 'full';
  showBaudRate?: boolean;
}

const COMMON_PORTS = [
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'COM10',
  'COM11',
  'COM12',
  '/dev/ttyUSB0',
  '/dev/ttyUSB1',
  '/dev/ttyACM0'
];

export const SerialPortPicker: React.FC<SerialPortPickerProps> = ({
  selectedPortName = 'COM1',
  baudRate = 9600,
  onPortNameChange,
  onBaudRateChange,
  onPortSelected,
  variant = 'compact',
  showBaudRate = true
}) => {
  const [supported] = useState<boolean>(isWebSerialSupported());
  const [authorizedPorts, setAuthorizedPorts] = useState<SerialPortInfo[]>([]);
  const [activePortLabel, setActivePortLabel] = useState<string | null>(getActiveSerialPortLabel());
  const [customPortMode, setCustomPortMode] = useState<boolean>(
    !COMMON_PORTS.includes(selectedPortName) && selectedPortName !== ''
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAuthorizedPorts = async () => {
    if (!supported) return;
    try {
      const ports = await getAuthorizedSerialPorts();
      setAuthorizedPorts(ports);
      setActivePortLabel(getActiveSerialPortLabel());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAuthorizedPorts();
  }, [supported]);

  const handleRequestSystemPort = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await requestSerialPort();
      if (result) {
        setActivePortLabel(result.label);
        const nameToSet = `COM_${result.usbProductId ? result.usbProductId.toString(16) : 'USB'}`;
        if (onPortNameChange) {
          onPortNameChange(result.label);
        }
        if (onPortSelected) {
          onPortSelected(result.port, result);
        }
        setMessage({
          type: 'success',
          text: `Porta serial vinculada: ${result.label}`
        });
        await loadAuthorizedPorts();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Não foi possível selecionar a porta serial.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAuthorized = (info: SerialPortInfo) => {
    setActiveSerialPort(info.port);
    setActivePortLabel(info.label);
    if (onPortNameChange) {
      onPortNameChange(info.label);
    }
    if (onPortSelected) {
      onPortSelected(info.port, info);
    }
    setMessage({
      type: 'success',
      text: `Porta selecionada: ${info.label}`
    });
  };

  const handleDisconnectPort = () => {
    clearActiveSerialPort();
    setActivePortLabel(null);
    setMessage(null);
  };

  if (variant === 'compact') {
    return (
      <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Porta Serial (COM):</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Port Dropdown */}
            {!customPortMode ? (
              <select
                value={selectedPortName}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomPortMode(true);
                  } else {
                    onPortNameChange?.(e.target.value);
                  }
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {authorizedPorts.length > 0 && (
                  <optgroup label="Portas Autorizadas pelo Navegador">
                    {authorizedPorts.map((p, idx) => (
                      <option key={`auth-${idx}`} value={p.label}>
                        ✓ {p.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Portas do Sistema">
                  {COMMON_PORTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </optgroup>
                <option value="__custom__">+ Outra porta manual...</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={selectedPortName}
                  onChange={(e) => onPortNameChange?.(e.target.value)}
                  placeholder="Ex: COM1 ou /dev/ttyUSB0"
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-medium w-32 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomPortMode(false);
                    onPortNameChange?.('COM1');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60"
                  title="Voltar para lista"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Baud Rate quick selector */}
            {showBaudRate && (
              <select
                value={baudRate}
                onChange={(e) => onBaudRateChange?.(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                title="Velocidade Baud Rate"
              >
                <option value={9600}>9600 bps</option>
                <option value={19200}>19200 bps</option>
                <option value={38400}>38400 bps</option>
                <option value={115200}>115200 bps</option>
              </select>
            )}

            {/* WebSerial System Picker Button */}
            {supported ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleRequestSystemPort}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                title="Abrir seletor nativo do sistema para vincular a porta USB / Serial"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>{activePortLabel ? 'Trocar Porta' : 'Detectar Porta'}</span>
              </button>
            ) : (
              <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                WebSerial indisponível
              </span>
            )}
          </div>
        </div>

        {/* Active hardware indicator */}
        {activePortLabel && (
          <div className="flex items-center justify-between bg-purple-50/80 border border-purple-200 rounded-lg px-2.5 py-1 text-[11px] text-purple-900">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold">Porta ativa:</span>
              <span className="font-mono">{activePortLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleDisconnectPort}
              className="text-purple-600 hover:text-purple-900 text-[10px] underline ml-2 cursor-pointer"
            >
              Liberar
            </button>
          </div>
        )}

        {message && (
          <div
            className={`p-1.5 rounded-md text-[11px] flex items-center gap-1.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>
    );
  }

  // Full / Settings Variant
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Configuração da Porta Serial (COM / ESC-POS)</h4>
            <p className="text-slate-500 text-xs">
              Configure a porta de comunicação direta para impressoras fiscais/térmicas seriais ou adaptadores USB-Serial
            </p>
          </div>
        </div>

        {supported ? (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" /> WebSerial Ativo
          </span>
        ) : (
          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Navegador sem WebSerial
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Desired Serial Port Select */}
        <div>
          <label className="block text-slate-700 font-semibold mb-1 text-xs">
            Porta Serial Desejada (COM / Device)
          </label>
          {!customPortMode ? (
            <div className="flex gap-2">
              <select
                value={selectedPortName}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomPortMode(true);
                  } else {
                    onPortNameChange?.(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                {authorizedPorts.length > 0 && (
                  <optgroup label="Dispositivos Serial Autorizados">
                    {authorizedPorts.map((p, idx) => (
                      <option key={`auth-${idx}`} value={p.label}>
                        ✓ {p.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Portas Físicas / Virtuais (Windows / Linux)">
                  {COMMON_PORTS.map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                </optgroup>
                <option value="__custom__">+ Informar nome personalizado...</option>
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedPortName}
                onChange={(e) => onPortNameChange?.(e.target.value)}
                placeholder="Ex: COM3, COM4, /dev/ttyUSB0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                type="button"
                onClick={() => {
                  setCustomPortMode(false);
                  onPortNameChange?.('COM1');
                }}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Lista
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-1">
            Selecione a porta onde a impressora está conectada (ex: COM1 a COM12).
          </p>
        </div>

        {/* Baud Rate */}
        <div>
          <label className="block text-slate-700 font-semibold mb-1 text-xs">
            Velocidade de Transmissão (Baud Rate)
          </label>
          <select
            value={baudRate}
            onChange={(e) => onBaudRateChange?.(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value={9600}>9600 bps (Padrão maioria das térmicas)</option>
            <option value={19200}>19200 bps (Epson / Bematech rápida)</option>
            <option value={38400}>38400 bps (Daruma / Elgin)</option>
            <option value={57600}>57600 bps</option>
            <option value={115200}>115200 bps (Alta velocidade USB-Serial)</option>
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            Certifique-se de que a velocidade corresponda aos dip-switches da impressora.
          </p>
        </div>
      </div>

      {/* System Device Selection Action */}
      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="font-semibold text-slate-900 text-xs block">
            Seleção Interativa via WebSerial
          </span>
          <span className="text-[11px] text-slate-500">
            Abre a caixa de diálogo nativa do navegador para vincular portas COM e cabos adaptadores USB-Serial.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {supported && (
            <button
              type="button"
              disabled={loading}
              onClick={handleRequestSystemPort}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Usb className="w-4 h-4" />
              {loading ? 'Aguardando seleção...' : 'Selecionar Porta Serial no Sistema'}
            </button>
          )}

          {activePortLabel && (
            <button
              type="button"
              onClick={handleDisconnectPort}
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              Desvincular
            </button>
          )}
        </div>
      </div>

      {/* Authorized ports quick switcher */}
      {authorizedPorts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
            <span>Portas Seriais Já Autorizadas neste Navegador ({authorizedPorts.length}):</span>
            <button
              type="button"
              onClick={loadAuthorizedPorts}
              className="text-purple-600 hover:text-purple-800 text-[11px] flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {authorizedPorts.map((ap) => (
              <div
                key={ap.index}
                onClick={() => handleSelectAuthorized(ap)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                  activePortLabel === ap.label
                    ? 'bg-purple-50/70 border-purple-400 text-purple-900 font-semibold shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="truncate">{ap.label}</span>
                </div>
                {activePortLabel === ap.label && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-800 text-[10px] font-bold">
                    Ativa
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback message */}
      {message && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
