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
import { Sale, StoreSettings } from '../../types';
import { formatCurrency, formatDateTime } from '../../services/api';
import {
  encodeSaleReceipt,
  printEscPosUniversal,
  downloadRawEscPosFile
} from '../../services/escpos';
import { SerialPortPicker } from '../common/SerialPortPicker';

interface ThermalReceiptModalProps {
  sale: Sale;
  settings: StoreSettings;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  sale,
  settings,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string>(
    settings.printer_connection || 'dialog'
  );
  const [serialPort, setSerialPort] = useState<string>(settings.printer_serial_port || 'COM1');
  const [serialBaudRate, setSerialBaudRate] = useState<number>(settings.printer_baud_rate || 9600);
  const [selectedSerialObj, setSelectedSerialObj] = useState<any>(null);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  const widthClass = settings.printer_width === '58mm' ? 'max-w-[250px]' : 'max-w-[340px]';

  const handleEscPosPrint = async (targetType?: any) => {
    setPrinting(true);
    setStatusMessage(null);
    try {
      const conn = targetType || selectedConnection;
      const activeSettings: StoreSettings = {
        ...settings,
        printer_serial_port: serialPort,
        printer_baud_rate: serialBaudRate
      };
      const buffer = encodeSaleReceipt(sale, activeSettings);
      
      const result = await printEscPosUniversal(buffer, activeSettings, conn as any, {
        serialPort: selectedSerialObj
      });
      setStatusMessage({
        type: 'success',
        text: result.message || 'Cupom ESC/POS processado com sucesso!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Falha na comunicação ESC/POS com a impressora.'
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadBin = () => {
    try {
      const buffer = encodeSaleReceipt(sale, settings);
      downloadRawEscPosFile(buffer, `cupom_venda_${sale.sale_number}.bin`);
      setStatusMessage({
        type: 'info',
        text: 'Arquivo binário ESC/POS (.bin) gerado e baixado.'
      });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: 'Erro ao gerar binário ESC/POS.' });
    }
  };

  const getPlainTextReceipt = () => {
    const divider = '------------------------------------------------';
    const store = settings.name || 'PDV & ASSISTÊNCIA';
    const lines = [
      '================================================',
      store.toUpperCase().padStart(24 + store.length / 2),
      settings.cnpj ? `CNPJ: ${settings.cnpj}` : '',
      settings.address ? `${settings.address}` : '',
      settings.phone ? `TEL: ${settings.phone}` : '',
      '================================================',
      '           CUPOM NÃO FISCAL - VENDA             ',
      `CUPOM Nº: ${String(sale.sale_number).padStart(6, '0')}   DATA: ${formatDateTime(sale.created_at)}`,
      `CLIENTE: ${sale.client_name || 'CONSUMIDOR FINAL'}`,
      divider,
      'ITEM  DESCRIÇÃO          QTD  UN    V.UNIT   TOTAL',
      divider
    ];

    sale.items.forEach((item, index) => {
      const idx = String(index + 1).padStart(2, '0');
      const name = item.name.substring(0, 18).padEnd(18);
      const qty = String(item.quantity).padStart(3);
      const unit = (item.unit || 'UN').substring(0, 2).padEnd(2);
      const unitVal = formatCurrency(item.price).replace('R$', '').trim().padStart(7);
      const totVal = formatCurrency(item.subtotal).replace('R$', '').trim().padStart(8);
      lines.push(`${idx} ${name} ${qty} ${unit} ${unitVal} ${totVal}`);
    });

    lines.push(divider);
    lines.push(`SUBTOTAL:                      ${formatCurrency(sale.subtotal)}`);
    if (sale.discount > 0) {
      lines.push(`DESCONTO:                     -${formatCurrency(sale.discount)}`);
    }
    if (sale.addition > 0) {
      lines.push(`ACRÉSCIMO:                    +${formatCurrency(sale.addition)}`);
    }
    lines.push(`TOTAL A PAGAR:                 ${formatCurrency(sale.total)}`);
    lines.push(divider);

    const paymentMap: Record<string, string> = {
      dinheiro: 'DINHEIRO',
      pix: 'PIX',
      cartao_credito: 'CARTÃO CRÉDITO',
      cartao_debito: 'CARTÃO DÉBITO',
      a_prazo: 'A PRAZO / FIADO',
      multiplo: 'MÚLTIPLOS'
    };

    lines.push(`FORMA PAGAMENTO: ${paymentMap[sale.payment_method] || sale.payment_method.toUpperCase()}`);
    if (sale.payment_method === 'dinheiro') {
      lines.push(`VALOR PAGO:                    ${formatCurrency(sale.amount_paid)}`);
      lines.push(`TROCO:                         ${formatCurrency(sale.change_amount)}`);
    }
    lines.push('================================================');
    if (settings.receipt_footer) {
      lines.push(settings.receipt_footer);
      lines.push('================================================');
    }

    return lines.filter(Boolean).join('\n');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getPlainTextReceipt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadTxt = () => {
    const text = getPlainTextReceipt();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cupom_Venda_${sale.sale_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto no-print">
      <div className="bg-white border border-slate-200/80 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#fbfbfd]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">Cupom de Venda</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> ESC/POS Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Formato {settings.printer_width || '80mm'} • Cupom #{String(sale.sale_number).padStart(5, '0')}
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

        {/* Connection Bar */}
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

        {/* Serial Port Selector Strip */}
        {selectedConnection === 'webserial' && (
          <div className="px-6 py-2.5 bg-purple-50/40 border-b border-purple-100">
            <SerialPortPicker
              variant="compact"
              selectedPortName={serialPort}
              baudRate={serialBaudRate}
              onPortNameChange={setSerialPort}
              onBaudRateChange={setSerialBaudRate}
              onPortSelected={(p) => setSelectedSerialObj(p)}
            />
          </div>
        )}

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

        {/* Scrollable Visual Receipt Body */}
        <div className="p-6 overflow-y-auto bg-[#f5f5f7] flex flex-col items-center">
          <div
            ref={receiptRef}
            className={`w-full ${widthClass} bg-white text-black font-mono text-[11px] leading-tight p-4 shadow-md border border-slate-300/80 rounded-sm select-text`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-extrabold text-sm uppercase tracking-tight text-black">
                {settings.name || 'PDV & ASSISTÊNCIA TÉCNICA'}
              </div>
              {settings.cnpj && <div className="text-[10px]">CNPJ: {settings.cnpj}</div>}
              {settings.address && <div className="text-[10px]">{settings.address}</div>}
              {settings.phone && <div className="text-[10px]">TEL: {settings.phone}</div>}
              <div className="mt-1 font-bold text-xs bg-gray-100 py-0.5 border border-gray-300 rounded text-black">
                CUPOM NÃO FISCAL
              </div>
            </div>

            {/* Meta Info */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>CUPOM Nº:</span>
                <span className="font-bold">#{String(sale.sale_number).padStart(5, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span>DATA/HORA:</span>
                <span>{formatDateTime(sale.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-semibold truncate max-w-[150px]">{sale.client_name || 'CONSUMIDOR FINAL'}</span>
              </div>
            </div>

            {/* Items Header */}
            <div className="py-1 border-b border-dashed border-gray-400 text-[10px] font-bold flex justify-between">
              <span>ITEM / DESCRIÇÃO</span>
              <span>TOTAL</span>
            </div>

            {/* Items List */}
            <div className="py-2 space-y-1.5 border-b border-dashed border-gray-400">
              {sale.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-semibold">
                    <span className="truncate max-w-[160px]">
                      {idx + 1}. {item.name}
                    </span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                  <div className="text-[10px] text-gray-600 flex justify-between">
                    <span>
                      {item.quantity} {item.unit || 'UN'} x {formatCurrency(item.price)}
                    </span>
                    {item.sku && <span className="text-[9px]">SKU: {item.sku}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-gray-400 text-xs space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>SUBTOTAL:</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-[11px] text-red-600 font-semibold">
                  <span>DESCONTO:</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              {sale.addition > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span>ACRÉSCIMO:</span>
                  <span>+{formatCurrency(sale.addition)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-gray-300">
                <span>TOTAL:</span>
                <span>{formatCurrency(sale.total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>PAGAMENTO:</span>
                <span className="font-bold uppercase">{sale.payment_method.replace('_', ' ')}</span>
              </div>
              {sale.payment_method === 'dinheiro' && (
                <>
                  <div className="flex justify-between">
                    <span>VALOR RECEBIDO:</span>
                    <span>{formatCurrency(sale.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>TROCO:</span>
                    <span>{formatCurrency(sale.change_amount)}</span>
                  </div>
                </>
              )}
            </div>

            {/* PIX Key */}
            {sale.payment_method === 'pix' && settings.pix_key && (
              <div className="py-2 border-b border-dashed border-gray-400 text-center text-[10px]">
                <div className="font-bold mb-0.5">CHAVE PIX ({settings.pix_key_type || 'CHAVE'}):</div>
                <div className="bg-gray-100 p-1 rounded font-mono text-[9px] break-all border border-gray-300">
                  {settings.pix_key}
                </div>
                {settings.pix_beneficiary && (
                  <div className="text-[9px] text-gray-600 mt-0.5">Favorecido: {settings.pix_beneficiary}</div>
                )}
              </div>
            )}

            {/* Footer message */}
            <div className="pt-2 text-center text-[9px] text-gray-700 whitespace-pre-line leading-snug">
              {settings.receipt_footer || 'Obrigado pela preferência!\nVolte sempre!'}
            </div>

            {/* Cut line indicator */}
            <div className="mt-3 text-center text-[8px] text-gray-400 tracking-widest uppercase">
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
              title="Copiar texto puro do cupom"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? 'Copiado' : 'Texto'}
            </button>

            <button
              onClick={handleDownloadTxt}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
              title="Baixar arquivo TXT"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              .TXT
            </button>

            <button
              onClick={handleDownloadBin}
              className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-slate-50 text-blue-700 flex items-center gap-1.5 transition-colors border border-blue-200 shadow-2xs cursor-pointer"
              title="Baixar binário ESC/POS para Spooler Raw, DOSPrint ou RawBT"
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
