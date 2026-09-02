import React, { useState, useEffect } from 'react';
import {
  Printer,
  Usb,
  Cpu,
  Wifi,
  Bluetooth,
  Monitor,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Coins,
  FileCode,
  X,
  Zap,
  CheckCircle2,
  Info
} from 'lucide-react';
import { StoreSettings, PrinterConnectionType } from '../../types';
import {
  encodeTestReceipt,
  encodeCashDrawerPulse,
  printEscPosUniversal,
  printThermalReceiptViaBrowser,
  generateTestReceiptText,
  downloadRawEscPosFile,
  isWebSerialSupported,
  isWebUsbSupported,
  requestSerialPort,
  getActiveSerialPortLabel
} from '../../services/escpos';
import { api } from '../../services/api';

interface PrinterConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => Promise<void> | void;
}

export const PrinterConnectionModal: React.FC<PrinterConnectionModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings
}) => {
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedSerialObj, setSelectedSerialObj] = useState<any>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSerialLabel, setActiveSerialLabel] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsIframe(window.self !== window.top);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setTestResult(null);
      setActiveSerialLabel(getActiveSerialPortLabel());
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const currentMethod: PrinterConnectionType = formData.printer_connection || 'dialog';

  const connectionOptions: {
    id: PrinterConnectionType;
    title: string;
    subtitle: string;
    icon: any;
    recommended?: boolean;
    badge?: string;
    description: string;
  }[] = [
    {
      id: 'dialog',
      title: 'Diálogo do Windows / Spooler Padrão',
      subtitle: 'Para qualquer impressora USB ou instalada no Windows',
      icon: Monitor,
      recommended: true,
      badge: 'Recomendado • 100% Compatível',
      description:
        'Funciona instantaneamente com qualquer impressora conectada por cabo USB comum (Elgin i7/i8/i9, Bematech MP-4200, Epson TM-T20X, Daruma, POS-58 e POS-80) já configurada no Windows.'
    },
    {
      id: 'webusb',
      title: 'USB Direto ESC/POS (WebUSB)',
      subtitle: 'Comunicação direta sem passar pela fila do Windows',
      icon: Usb,
      badge: 'Alta Velocidade',
      description:
        'Envia comandos binários ESC/POS diretamente para o cabo USB da impressora. Suportado nativamente no Google Chrome e Microsoft Edge.'
    },
    {
      id: 'webserial',
      title: 'Porta Serial COM (WebSerial)',
      subtitle: 'Portas físicas COM ou adaptadores USB-Serial (CH340/FTDI)',
      icon: Cpu,
      badge: 'Portas COM1 a COM9',
      description:
        'Ideal para balcões com comunicação RS-232 serial ou cabos adaptadores USB-Serial. Permite configurar velocidade Baud Rate (9600 a 115200).'
    },
    {
      id: 'network',
      title: 'Rede Local Ethernet / Wi-Fi',
      subtitle: 'Impressoras com cabo de rede RJ45 ou Wi-Fi (Porta TCP 9100)',
      icon: Wifi,
      badge: 'Rede Local IP',
      description:
        'Envia pacotes de impressão diretamente pelo IP local da impressora na rede (ex: 192.168.1.200 na porta padrão RAW 9100).'
    },
    {
      id: 'webbluetooth',
      title: 'Bluetooth Direto sem Fio',
      subtitle: 'Mini impressoras portáteis térmicas Bluetooth (58mm/80mm)',
      icon: Bluetooth,
      badge: 'Portátil Sem Fio',
      description:
        'Conexão sem fio direta com maquininhas de bobina e mini impressoras térmicas portáteis de bolso.'
    }
  ];

  const handleSelectPortDirectly = async () => {
    if (isIframe) {
      setTestResult({
        type: 'info',
        message: 'Aviso: Em janelas incorporadas (iframe), o navegador restringe a seleção de portas seriais nativas. Clique no botão "Abrir em Nova Aba" no topo para acesso livre ao hardware.'
      });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const portInfo = await requestSerialPort();
      if (portInfo) {
        setSelectedSerialObj(portInfo.port);
        setActiveSerialLabel(portInfo.label);
        setFormData(prev => ({
          ...prev,
          printer_serial_port: portInfo.label
        }));
        setTestResult({
          type: 'success',
          message: `Porta serial vinculada com sucesso: ${portInfo.label}`
        });
      } else {
        setTestResult({
          type: 'info',
          message: 'Seleção de porta finalizada sem alteração.'
        });
      }
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: err.message || 'Falha ao solicitar porta serial.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const conn = currentMethod;
      if (conn === 'dialog') {
        const textReceipt = generateTestReceiptText(formData);
        await printThermalReceiptViaBrowser(textReceipt, formData);
        setTestResult({
          type: 'success',
          message: 'Janela de impressão da impressora do Windows aberta com formatação térmica!'
        });
      } else {
        const buffer = encodeTestReceipt(formData);
        const res = await printEscPosUniversal(buffer, formData, conn, {
          serialPort: selectedSerialObj
        });
        setTestResult({
          type: 'success',
          message: res.message || 'Cupom de teste enviado à impressora com sucesso!'
        });
      }
    } catch (err: any) {
      let errMsg = err.message || 'Não foi possível imprimir o cupom de teste.';
      if (err.name === 'NotFoundError' || errMsg.includes('No port selected') || errMsg.includes('requestPort')) {
        errMsg = 'Nenhuma porta ou impressora foi confirmada na janela do navegador.';
      }
      setTestResult({
        type: 'error',
        message: errMsg
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestDrawer = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const buffer = encodeCashDrawerPulse();
      const res = await printEscPosUniversal(buffer, formData, currentMethod, {
        serialPort: selectedSerialObj
      });
      setTestResult({
        type: 'success',
        message: 'Comando elétrico de abertura de gaveta (ESC p) enviado à impressora!'
      });
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Falha ao acionar gaveta: ${err.message || 'Impressora não respondeu ao comando.'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDownloadBin = () => {
    try {
      const buffer = encodeTestReceipt(formData);
      downloadRawEscPosFile(buffer, 'teste_impressora_escpos.bin');
      setTestResult({
        type: 'info',
        message: 'Arquivo binário .BIN gerado e baixado para o seu computador.'
      });
    } catch {
      setTestResult({
        type: 'error',
        message: 'Erro ao gerar arquivo binário.'
      });
    }
  };

  const handleSaveAndApply = async () => {
    try {
      setSaving(true);
      await api.updateSettings(formData);
      await onSaveSettings(formData);
      setTestResult({
        type: 'success',
        message: 'Configurações da impressora salvas como padrão com sucesso!'
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setTestResult({
        type: 'error',
        message: `Erro ao salvar: ${err.message || 'Falha no servidor.'}`
      });
    } finally {
      setSaving(false);
    }
  };

  const openInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfbfd]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Assistente de Conexão da Impressora Térmica</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> ESC/POS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure, emparelhe e teste a sua impressora térmica de cupom e gaveta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#fcfcfd]">
          
          {/* Iframe Notice & New Tab Shortcut */}
          {isIframe && (
            <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Ambiente de Pré-Visualização Incorporada (Iframe)</span>
                </div>
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                  Abrir Sistema em Nova Aba
                </button>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                • <strong>Dica importante:</strong> O método <strong>"Diálogo do Windows"</strong> funciona perfeitamente aqui dentro para qualquer impressora USB ou de rede instalada no seu computador.
                <br />
                • Caso você precise de comunicação física direta por <strong>Porta Serial COM</strong> ou <strong>USB Direto</strong>, abra o sistema em uma nova aba para que o navegador conceda acesso nativo às portas do computador.
              </p>
            </div>
          )}

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start justify-between gap-3 animate-in fade-in duration-150 ${
                testResult.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : testResult.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : testResult.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">{testResult.message}</span>
                  {testResult.type === 'error' && currentMethod !== 'dialog' && (
                    <div className="mt-2 pt-2 border-t border-rose-200/80 flex items-center gap-2">
                      <span className="text-[11px] text-rose-900">Sua impressora usa cabo USB comum?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, printer_connection: 'dialog' }));
                          setTestResult({
                            type: 'info',
                            message: 'Método alterado para "Diálogo do Windows". Clique em "Imprimir Cupom de Teste" para testar agora!'
                          });
                        }}
                        className="px-2 py-0.5 bg-white border border-rose-300 rounded font-bold text-[11px] text-rose-900 hover:bg-slate-50 cursor-pointer"
                      >
                        ✓ Usar Diálogo do Windows
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-slate-400 hover:text-slate-700 font-bold px-1"
              >
                ×
              </button>
            </div>
          )}

          {/* STEP 1: Select Communication Method */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                Escolha o Método de Conexão com a Impressora:
              </label>
              <span className="text-[11px] text-slate-500">
                Ativo: <strong>{connectionOptions.find(o => o.id === currentMethod)?.title}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {connectionOptions.map(opt => {
                const Icon = opt.icon;
                const isSelected = currentMethod === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setFormData(prev => ({ ...prev, printer_connection: opt.id }))}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{opt.title}</span>
                        {opt.badge && (
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                              opt.recommended
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.subtitle}</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{opt.description}</p>
                    </div>

                    <div className="shrink-0 mt-1">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conditional Method Config Parameters */}
          {currentMethod === 'webserial' && (
            <div className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  Configuração de Porta Serial (COM)
                </span>
                {activeSerialLabel && (
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                    {activeSerialLabel}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Porta COM Identificada
                  </label>
                  <input
                    type="text"
                    value={formData.printer_serial_port || 'COM1'}
                    onChange={e => setFormData(prev => ({ ...prev, printer_serial_port: e.target.value }))}
                    placeholder="Ex: COM1, COM2, COM3..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Taxa de Transmissão (Baud Rate)
                  </label>
                  <select
                    value={formData.printer_baud_rate || 9600}
                    onChange={e => setFormData(prev => ({ ...prev, printer_baud_rate: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                  >
                    <option value={9600}>9600 bps (Padrão Bematech / Elgin)</option>
                    <option value={19200}>19200 bps (Epson / Daruma)</option>
                    <option value={38400}>38400 bps (POS-80 Alta velocidade)</option>
                    <option value={57600}>57600 bps</option>
                    <option value={115200}>115200 bps (Modernas)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectPortDirectly}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Localizar e Conectar Porta COM no Sistema
                </button>
              </div>
            </div>
          )}

          {currentMethod === 'network' && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-3">
              <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-600" />
                Configuração de Impressora de Rede Local
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Endereço IP na Rede Local
                  </label>
                  <input
                    type="text"
                    value={formData.printer_ip || ''}
                    onChange={e => setFormData(prev => ({ ...prev, printer_ip: e.target.value }))}
                    placeholder="Ex: 192.168.1.200"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Porta TCP RAW (Padrão 9100)
                  </label>
                  <input
                    type="number"
                    value={formData.printer_port || 9100}
                    onChange={e => setFormData(prev => ({ ...prev, printer_port: Number(e.target.value) }))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Thermal Width & Formatting */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
              Formato e Largura da Bobina Térmica:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setFormData(prev => ({ ...prev, printer_width: '80mm' }))}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.printer_width !== '58mm'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Bobina 80mm (48 Colunas)</span>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      formData.printer_width !== '58mm' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {formData.printer_width !== '58mm' && <Check className="w-2 h-2" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Padrão Bematech MP-4200, Elgin i7/i9, Epson TM-T20 e Daruma.
                </p>
              </div>

              <div
                onClick={() => setFormData(prev => ({ ...prev, printer_width: '58mm' }))}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.printer_width === '58mm'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">Bobina 58mm (32 Colunas)</span>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      formData.printer_width === '58mm' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {formData.printer_width === '58mm' && <Check className="w-2 h-2" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mini impressoras portáteis, de bolso e maquininhas de cartão.
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3: Integrated Test Panel */}
          <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                Testar a Impressora Agora:
              </span>
              <span className="text-[11px] text-slate-500">Feedback em tempo real</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={testing}
                onClick={handleTestPrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                {testing ? 'Imprimindo...' : 'Imprimir Cupom de Teste'}
              </button>

              <button
                type="button"
                disabled={testing}
                onClick={handleTestDrawer}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                Testar Abertura de Gaveta
              </button>

              <button
                type="button"
                onClick={handleDownloadBin}
                className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Baixar arquivo .BIN para testes externos"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                Baixar .BIN
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-[#fbfbfd]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAndApply}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              {saving ? 'Salvando...' : 'Salvar e Definir como Impressora Padrão'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
