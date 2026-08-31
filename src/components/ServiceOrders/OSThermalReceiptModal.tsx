import React, { useRef, useState } from 'react';
import { Printer, Copy, Check, X, Download, FileText } from 'lucide-react';
import { ServiceOrder, StoreSettings } from '../../types';
import { formatCurrency, formatDateTime } from '../../services/api';

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
  const [copied, setCopied] = useState(false);
  const [printType, setPrintType] = useState<'thermal' | 'a4'>('thermal');
  const widthClass = settings.printer_width === '58mm' ? 'max-w-[250px]' : 'max-w-[360px]';

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-100">
                Imprimir {mode === 'entry' ? 'Comprovante de Entrada' : 'Comprovante de Entrega'} da OS #{os.os_number}
              </h3>
              <p className="text-xs text-slate-400">
                Formato Térmico ({settings.printer_width}) / Cupom não fiscal de assistência
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

        {/* Preview Body */}
        <div className="p-6 overflow-y-auto bg-slate-950 flex flex-col items-center">
          {/* Thermal Slip */}
          <div
            className={`w-full ${widthClass} bg-white text-black font-mono text-[10.5px] leading-tight p-4 shadow-2xl border border-gray-300 rounded-sm select-text`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <div className="font-extrabold text-sm uppercase tracking-tight">
                {settings.name || 'TECHCELL ASSISTÊNCIA'}
              </div>
              {settings.cnpj && <div className="text-[10px]">CNPJ: {settings.cnpj}</div>}
              {settings.address && <div className="text-[10px]">{settings.address}</div>}
              {settings.phone && <div className="text-[10px]">TEL: {settings.phone}</div>}
              <div className="mt-1.5 font-bold text-xs bg-gray-100 py-1 border border-gray-400 rounded uppercase">
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
                  <span>PADRÃO DESENHO:</span>
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

            {/* Diagnosis / Services / Parts if available */}
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
              {settings.os_terms || 'Garantia de 90 dias para os serviços e peças substituídas.'}
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

        {/* Modal Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/90 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Comprovante Térmico
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print Container for Printer */}
      <div className="print-only-container hidden">
        <div
          style={{
            width: settings.printer_width === '58mm' ? '54mm' : '76mm',
            margin: '0 auto',
            padding: '4px',
            fontFamily: 'monospace',
            fontSize: '10px',
            lineHeight: '1.2',
            color: '#000',
            backgroundColor: '#fff'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{settings.name || 'TECHCELL ASSISTÊNCIA'}</div>
            {settings.cnpj && <div>CNPJ: {settings.cnpj}</div>}
            {settings.address && <div>{settings.address}</div>}
            {settings.phone && <div>TEL: {settings.phone}</div>}
            <div style={{ marginTop: '4px', fontWeight: 'bold', border: '1px solid #000', padding: '2px' }}>
              {mode === 'entry' ? 'COMPROVANTE DE ENTRADA' : 'COMPROVANTE DE ENTREGA'}
            </div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>OS Nº: #{String(os.os_number).padStart(5, '0')}</div>
            <div>DATA: {formatDateTime(os.created_at)}</div>
            <div>CLIENTE: {os.client_name}</div>
            <div>FONE: {os.client_phone}</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div>APARELHO: {os.device_brand} {os.device_model}</div>
            {os.device_color && <div>COR: {os.device_color}</div>}
            {os.device_imei && <div>IMEI: {os.device_imei}</div>}
            {os.device_password && <div>SENHA: {os.device_password}</div>}
            {os.device_pattern_lock && <div>PADRÃO: {os.device_pattern_lock}</div>}
            <div>ACESSÓRIOS: {os.device_accessories.join(', ') || 'Nenhum'}</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ fontWeight: 'bold' }}>DEFEITO:</div>
            <div>{os.reported_defect}</div>
          </div>

          <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
              <span>VALOR TOTAL:</span>
              <span>{formatCurrency(os.total)}</span>
            </div>
          </div>

          {settings.os_terms && (
            <div style={{ fontSize: '8px', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '12px' }}>
              {settings.os_terms}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto 4px auto' }}></div>
            <div>Assinatura do Cliente</div>
          </div>
        </div>
      </div>
    </div>
  );
};
