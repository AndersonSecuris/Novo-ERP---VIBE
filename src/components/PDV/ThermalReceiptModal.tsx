import React, { useRef } from 'react';
import { Printer, Copy, Check, X, Download, FileText, QrCode } from 'lucide-react';
import { Sale, StoreSettings } from '../../types';
import { formatCurrency, formatDateTime } from '../../services/api';

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
  const [copied, setCopied] = React.useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const widthClass = settings.printer_width === '58mm' ? 'max-w-[240px]' : 'max-w-[340px]';

  const handlePrint = () => {
    window.print();
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
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100">Cupom Não Fiscal para Impressora Térmica</h3>
              <p className="text-xs text-slate-400">
                Formato bobina {settings.printer_width} (ESC/POS & Impressão Direta)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Preview */}
        <div className="p-6 overflow-y-auto bg-slate-950 flex flex-col items-center">
          {/* Thermal Paper Simulation Container */}
          <div
            ref={receiptRef}
            className={`w-full ${widthClass} bg-white text-black font-mono text-[11px] leading-tight p-4 shadow-xl border border-gray-300 rounded-sm select-text`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-extrabold text-sm uppercase tracking-tight">
                {settings.name || 'PDV & ASSISTÊNCIA TÉCNICA'}
              </div>
              {settings.cnpj && <div className="text-[10px]">CNPJ: {settings.cnpj}</div>}
              {settings.address && <div className="text-[10px]">{settings.address}</div>}
              {settings.phone && <div className="text-[10px]">TEL: {settings.phone}</div>}
              <div className="mt-1 font-bold text-xs bg-gray-100 py-0.5 border border-gray-300 rounded">
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
                <span className="font-semibold truncate max-w-[150px]">{sale.client_name || 'CONSUMIDOR'}</span>
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

            {/* PIX Key if configured and payment is PIX */}
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

        {/* Modal Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/90 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
              title="Copiar texto puro para spoolers ou impressoras texto"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
              title="Baixar arquivo TXT"
            >
              <Download className="w-4 h-4" />
              Baixar .TXT
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
            >
              <Printer className="w-4 h-4" />
              Imprimir na Térmica (Ctrl+P)
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print-Only Container with Thermal Printer width format */}
      <div className="print-only-container hidden">
        <div
          style={{
            width: settings.printer_width === '58mm' ? '54mm' : '76mm',
            margin: '0 auto',
            padding: '4px',
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: '1.2',
            color: '#000',
            backgroundColor: '#fff'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>
              {settings.name || 'PDV & ASSISTÊNCIA'}
            </div>
            {settings.cnpj && <div>CNPJ: {settings.cnpj}</div>}
            {settings.address && <div>{settings.address}</div>}
            {settings.phone && <div>TEL: {settings.phone}</div>}
            <div style={{ marginTop: '4px', fontWeight: 'bold' }}>CUPOM NÃO FISCAL</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div>CUPOM: #{String(sale.sale_number).padStart(5, '0')}</div>
            <div>DATA: {formatDateTime(sale.created_at)}</div>
            <div>CLIENTE: {sale.client_name || 'CONSUMIDOR'}</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            {sale.items.map((item, i) => (
              <div key={i} style={{ marginBottom: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>{i + 1}. {item.name}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
                <div style={{ fontSize: '10px' }}>
                  {item.quantity} {item.unit || 'UN'} x {formatCurrency(item.price)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SUBTOTAL:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DESCONTO:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '6px' }}>
            <div>FORMA: {sale.payment_method.toUpperCase()}</div>
            {sale.payment_method === 'dinheiro' && (
              <>
                <div>PAGO: {formatCurrency(sale.amount_paid)}</div>
                <div>TROCO: {formatCurrency(sale.change_amount)}</div>
              </>
            )}
          </div>

          {settings.receipt_footer && (
            <div style={{ textAlign: 'center', fontSize: '9px', whiteSpace: 'pre-line' }}>
              {settings.receipt_footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
