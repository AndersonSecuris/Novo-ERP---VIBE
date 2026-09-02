import React, { useRef, useState } from 'react';
import {
  Printer,
  Copy,
  Check,
  X,
  Download,
  FileCode,
  Wifi,
  Usb,
  Cpu,
  Bluetooth,
  Monitor,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ServiceOrder, StoreSettings } from '../../types';
import { formatCurrency, formatDateTime } from '../../services/api';
import {
  encodeOSReceipt,
  printEscPosUniversal,
  downloadRawEscPosFile
} from '../../services/escpos';

interface OSThermalReceiptModalProps {
  os: ServiceOrder;
  settings: StoreSettings;
  onClose: () => void;
  mode?: 'entry' | 'delivery';
}

export const OSThermalReceiptModal: React.FC<OSThermalReceiptModalProps> = ({
  os,
  settings,
  onClose,
  mode = 'entry'
}) => {
  const osMode: 'entry' | 'delivery' = mode === 'delivery' ? 'delivery' : 'entry';
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string>(
    settings.printer_connection || 'dialog'
  );
  
  const widthClass = settings.printer_width === '58mm' ? 'max-w-[250px]' : 'max-w-[360px]';

  const handleEscPosPrint = async (targetType?: any) => {
    setPrinting(true);
    setStatusMessage(null);
    try {
      const conn = targetType || selectedConnection;
      const buffer = encodeOSReceipt(os, settings, osMode);
      const result = await printEscPosUniversal(buffer, settings, conn as any);
      setStatusMessage({
        type: 'success',
        text: result.message || 'Comprovante de OS ESC/POS processado com sucesso!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Falha ao imprimir comprovante de OS via ESC/POS.'
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadBin = () => {
    try {
      const buffer = encodeOSReceipt(os, settings, osMode);
      downloadRawEscPosFile(buffer, `os_${os.os_number}_${osMode}.bin`);
      setStatusMessage({
        type: 'info',
        text: 'Arquivo binário ESC/POS (.bin) baixado.'
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Erro ao gerar binário ESC/POS.' });
    }
  };

  const getPlainTextOS = () => {
    const divider = '------------------------------------------------';
    const store = settings.name || 'TECHCELL ASSISTÊNCIA';
    const lines = [
      '================================================',
      store.toUpperCase().padStart(24 + store.length / 2),
      settings.cnpj ? `CNPJ: ${settings.cnpj}` : '',
      settings.address ? `${settings.address}` : '',
      settings.phone ? `TEL/WHATSAPP: ${settings.phone}` : '',
      '================================================',
      mode === 'entry' ? '     COMPROVANTE DE ENTRADA DE APARELHO        ' : '        COMPROVANTE DE ENTREGA E GARANTIA       ',
      `ORDEM DE SERVIÇO Nº: #${String(os.os_number).padStart(5, '0')}`,
      `DATA ENTRADA: ${formatDateTime(os.created_at)}`,
      divider,
      `CLIENTE: ${os.client_name}`,
      `FONE: ${os.client_phone}`,
      os.client_cpf ? `CPF: ${os.client_cpf}` : '',
      divider,
      'DADOS DO APARELHO:',
      `APARELHO: ${os.device_brand} ${os.device_model}`,
      os.device_color ? `COR: ${os.device_color}` : '',
      os.device_imei ? `IMEI: ${os.device_imei}` : '',
      os.device_password ? `SENHA: ${os.device_password}` : '',
      os.device_pattern_lock ? `PADRÃO: ${os.device_pattern_lock}` : '',
      os.device_accessories.length > 0 ? `ACESSÓRIOS: ${os.device_accessories.join(', ')}` : 'ACESSÓRIOS: Nenhum',
      os.device_condition ? `ESTADO: ${os.device_condition}` : '',
      divider,
      'DEFEITO RELATADO:',
      os.reported_defect,
      divider
    ];

    if (os.technical_diagnosis) {
      lines.push('DIAGNÓSTICO TÉCNICO:');
      lines.push(os.technical_diagnosis);
      lines.push(divider);
    }

    if (os.parts_used.length > 0) {
      lines.push('PEÇAS:');
      os.parts_used.forEach(p => {
        lines.push(`- ${p.name} (${p.quantity}x) : ${formatCurrency(p.unitPrice * p.quantity)}`);
      });
      lines.push(divider);
    }

    if (os.services_done.length > 0) {
      lines.push('SERVIÇOS:');
      os.services_done.forEach(s => {
        lines.push(`- ${s.name}: ${formatCurrency(s.price)}`);
      });
      lines.push(divider);
    }

    lines.push(`VALOR TOTAL: ${formatCurrency(os.total)}`);
    lines.push('================================================');
    lines.push('TERMO DE GARANTIA & CONDIÇÕES:');
    lines.push(settings.os_terms || 'Garantia legal de 90 dias conforme Art. 26 do CDC.');
    lines.push('================================================');
    lines.push('\n\n________________________________________________');
    lines.push('          Assinatura do Cliente                 \n');

    return lines.filter(Boolean).join('\n');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getPlainTextOS());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadTxt = () => {
    const text = getPlainTextOS();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OS_${os.os_number}_${mode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto no-print">
      <div className="bg-white border border-slate-200/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfbfd]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">
                  {mode === 'entry' ? 'Entrada de OS' : 'Comprovante de Entrega'} #{os.os_number}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> ESC/POS Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Formato {settings.printer_width || '80mm'} • {os.device_brand} {os.device_model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection Selector Bar */}
        <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-medium text-slate-700">Modo de envio:</span>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="dialog">Diálogo Padrão (Ctrl+P)</option>
              <option value="webusb">USB Direto (WebUSB ESC/POS)</option>
              <option value="webserial">Porta Serial / COM (WebSerial)</option>
              <option value="webbluetooth">Bluetooth Direto (ESC/POS)</option>
              <option value="network">Rede IP TCP (Porta 9100)</option>
              <option value="electron">Impressão Silenciosa Desktop</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            {selectedConnection === 'webusb' && <span className="flex items-center gap-1 text-blue-600 font-medium"><Usb className="w-3.5 h-3.5" /> USB RAW</span>}
            {selectedConnection === 'webserial' && <span className="flex items-center gap-1 text-purple-600 font-medium"><Cpu className="w-3.5 h-3.5" /> COM Serial</span>}
            {selectedConnection === 'webbluetooth' && <span className="flex items-center gap-1 text-indigo-600 font-medium"><Bluetooth className="w-3.5 h-3.5" /> Bluetooth</span>}
            {selectedConnection === 'network' && <span className="flex items-center gap-1 text-emerald-600 font-medium"><Wifi className="w-3.5 h-3.5" /> {settings.printer_ip || 'IP'}</span>}
            {selectedConnection === 'dialog' && <span className="flex items-center gap-1 text-slate-600"><Monitor className="w-3.5 h-3.5" /> Spooler Navegador</span>}
          </div>
        </div>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div
            className={`mx-6 mt-3 p-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Preview Body */}
        <div className="p-6 overflow-y-auto bg-[#f5f5f7] flex flex-col items-center">
          {/* Thermal Slip */}
          <div
            className={`w-full ${widthClass} bg-white text-black font-mono text-[10.5px] leading-tight p-4 shadow-md border border-slate-300/80 rounded-sm select-text`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-extrabold text-sm uppercase tracking-tight text-black">
                {settings.name || 'TECHCELL ASSISTÊNCIA'}
              </div>
              {settings.cnpj && <div className="text-[10px]">CNPJ: {settings.cnpj}</div>}
              {settings.address && <div className="text-[10px]">{settings.address}</div>}
              {settings.phone && <div className="text-[10px]">TEL: {settings.phone}</div>}
              <div className="mt-1.5 font-bold text-xs bg-gray-100 py-1 border border-gray-400 rounded uppercase text-black">
                {mode === 'entry' ? 'COMPROVANTE DE ENTRADA' : 'COMPROVANTE DE ENTREGA'}
              </div>
            </div>

            {/* OS & Client Data */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-1">
              <div className="flex justify-between font-bold text-xs">
                <span>ORDEM DE SERVIÇO:</span>
                <span>#{String(os.os_number).padStart(5, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span>ENTRADA:</span>
                <span>{formatDateTime(os.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold">{os.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span>WHATSAPP/FONE:</span>
                <span>{os.client_phone}</span>
              </div>
              {os.client_cpf && (
                <div className="flex justify-between">
                  <span>CPF:</span>
                  <span>{os.client_cpf}</span>
                </div>
              )}
            </div>

            {/* Device Info */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-1">
              <div className="font-bold uppercase tracking-wider text-[11px]">DADOS DO APARELHO:</div>
              <div className="flex justify-between">
                <span>MODELO:</span>
                <span className="font-bold">{os.device_brand} {os.device_model}</span>
              </div>
              {os.device_color && (
                <div className="flex justify-between">
                  <span>COR:</span>
                  <span>{os.device_color}</span>
                </div>
              )}
              {os.device_imei && (
                <div className="flex justify-between">
                  <span>IMEI:</span>
                  <span className="font-mono text-[9px]">{os.device_imei}</span>
                </div>
              )}
              {os.device_password && (
                <div className="flex justify-between font-bold">
                  <span>SENHA:</span>
                  <span>{os.device_password}</span>
                </div>
              )}
              {os.device_pattern_lock && (
                <div className="flex justify-between">
                  <span>PADRÃO:</span>
                  <span className="font-bold">{os.device_pattern_lock}</span>
                </div>
              )}
              <div className="text-[9.5px]">
                <span className="font-semibold">ACESSÓRIOS: </span>
                <span>{os.device_accessories.length > 0 ? os.device_accessories.join(', ') : 'Nenhum'}</span>
              </div>
              {os.device_condition && (
                <div className="text-[9.5px]">
                  <span className="font-semibold">ESTADO FÍSICO: </span>
                  <span>{os.device_condition}</span>
                </div>
              )}
            </div>

            {/* Defect */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px]">
              <div className="font-bold mb-0.5">DEFEITO RELATADO:</div>
              <div className="bg-gray-50 p-1.5 rounded border border-gray-200">{os.reported_defect}</div>
            </div>

            {/* Diagnosis / Services / Parts */}
            {(os.parts_used.length > 0 || os.services_done.length > 0 || os.technical_diagnosis) && (
              <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-1">
                {os.technical_diagnosis && (
                  <div>
                    <span className="font-bold">LAUDO TÉCNICO: </span>
                    <span>{os.technical_diagnosis}</span>
                  </div>
                )}
                {os.parts_used.length > 0 && (
                  <div>
                    <span className="font-bold">PEÇAS UTILIZADAS:</span>
                    {os.parts_used.map((p, idx) => (
                      <div key={idx} className="flex justify-between pl-1">
                        <span>• {p.name} ({p.quantity}x)</span>
                        <span>{formatCurrency(p.unitPrice * p.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {os.services_done.length > 0 && (
                  <div>
                    <span className="font-bold">SERVIÇOS EXECUTADOS:</span>
                    {os.services_done.map((s, idx) => (
                      <div key={idx} className="flex justify-between pl-1">
                        <span>• {s.name}</span>
                        <span>{formatCurrency(s.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Financial Totals */}
            <div className="py-2 border-b border-dashed border-gray-400 text-xs space-y-0.5">
              <div className="flex justify-between font-extrabold text-sm">
                <span>VALOR TOTAL:</span>
                <span>{formatCurrency(os.total)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>STATUS ATUAL:</span>
                <span className="font-bold uppercase">{os.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Terms of Service & Warranty */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[8.5px] leading-tight text-gray-700 whitespace-pre-line text-justify">
              <div className="font-bold mb-0.5 text-center text-[9px]">TERMOS DE SERVIÇO & GARANTIA</div>
              {settings.os_terms || 'Garantia legal de 90 dias conforme Art. 26 do CDC.'}
            </div>

            {/* Signature Lines */}
            <div className="pt-5 pb-2 text-center text-[9.5px] space-y-4">
              <div>
                <div className="border-t border-black w-4/5 mx-auto mb-1"></div>
                <div className="font-semibold">Assinatura do Cliente ({os.client_name})</div>
              </div>
              <div>
                <div className="border-t border-dashed border-gray-400 w-3/5 mx-auto mb-1"></div>
                <div className="text-[8.5px] text-gray-600">Assinatura do Atendente / Técnico</div>
              </div>
            </div>

            {/* Cut line */}
            <div className="mt-2 text-center text-[8px] text-gray-400 uppercase tracking-widest">
              - - - - - - CORTE AQUI - - - - - -
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex flex-wrap items-center justify-between p-4 border-t border-slate-100 bg-[#fbfbfd] gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyText}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copiado' : 'Texto'}
            </button>

            <button
              onClick={handleDownloadTxt}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              .TXT
            </button>

            <button
              onClick={handleDownloadBin}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-blue-700 flex items-center gap-1.5 transition-colors border border-blue-200 shadow-2xs cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600" />
              ESC/POS .BIN
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={() => handleEscPosPrint()}
              disabled={printing}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {printing ? 'Imprimindo...' : 'Imprimir na Térmica'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
