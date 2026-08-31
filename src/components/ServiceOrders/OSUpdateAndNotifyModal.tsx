import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  Wrench,
  Package,
  X,
  Copy,
  Check,
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { ServiceOrder, OSStatus, StoreSettings } from '../../types';
import { api, formatCurrency } from '../../services/api';

interface OSUpdateAndNotifyModalProps {
  os: ServiceOrder;
  settings: StoreSettings;
  onClose: () => void;
  onUpdated: (updatedOS: ServiceOrder) => void;
}

export const OSUpdateAndNotifyModal: React.FC<OSUpdateAndNotifyModalProps> = ({
  os,
  settings,
  onClose,
  onUpdated
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OSStatus>(os.status);
  const [operatorName, setOperatorName] = useState('Técnico Responsável');
  const [note, setNote] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Status mapping labels and styles
  const statusOptions: { id: OSStatus; label: string; color: string }[] = [
    { id: 'aguardando_analise', label: 'Aguardando Análise', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
    { id: 'em_analise', label: 'Em Análise / Orçamento', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
    { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    { id: 'aprovado', label: 'Aprovado / Em Reparo', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' },
    { id: 'aguardando_peca', label: 'Aguardando Peça', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
    { id: 'pronto', label: 'Pronto para Retirada', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
    { id: 'entregue', label: 'Entregue / Finalizado', color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' },
    { id: 'cancelado', label: 'Cancelado / Sem Reparo', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' }
  ];

  // Update message preview when status changes
  useEffect(() => {
    const templates = settings.whatsapp_templates || ({} as any);
    const rawTemplate =
      templates[selectedStatus] ||
      `Olá {cliente}! Atualizamos sua OS #{os_numero} ({aparelho}) para o status: ${selectedStatus}.`;

    const storeName = settings.name || 'Assistência Técnica';
    const totalFormatted = formatCurrency(os.total);

    const filled = rawTemplate
      .replace(/\{cliente\}/g, os.client_name || 'Cliente')
      .replace(/\{os_numero\}/g, os.os_number?.toString() || os.id)
      .replace(/\{aparelho\}/g, `${os.device_brand} ${os.device_model}`)
      .replace(/\{loja\}/g, storeName)
      .replace(/\{valor\}/g, totalFormatted.replace('R$', '').trim())
      .replace(/\{diagnostico\}/g, os.technical_diagnosis || os.reported_defect || 'Em análise');

    setCustomMessage(filled);
  }, [selectedStatus, os, settings]);

  const rawPhone = (os.client_phone || '').replace(/\D/g, '');
  const fullPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
  const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(customMessage)}`;

  const handleSaveAndSend = async (openWhatsApp: boolean) => {
    try {
      setSubmitting(true);
      const res = await api.updateOSStatus(os.id, {
        status: selectedStatus,
        note: note || `Status alterado para ${selectedStatus}`,
        operator_name: operatorName,
        custom_message: customMessage
      });

      // Reload updated OS
      const updated = await api.getServiceOrder(os.id);
      onUpdated(updated);

      if (openWhatsApp) {
        window.open(whatsappUrl, '_blank');
      }

      onClose();
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-100">Atualizar Status & Notificar Cliente</h3>
              <p className="text-xs text-slate-400">
                OS #{os.os_number} • {os.client_name} ({os.device_brand} {os.device_model})
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Status Selector */}
          <div>
            <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-2">
              Selecione o Novo Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map(opt => {
                const isSelected = selectedStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedStatus(opt.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? `${opt.color} ring-2 ring-indigo-500 font-bold shadow-md`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Internal Operator Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Operador / Técnico
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Anotação Interna no Histórico
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ex: Peça instalada e testada..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* WhatsApp Message Preview & Customization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Mensagem WhatsApp para o Cliente ({os.client_phone})
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado!' : 'Copiar Texto'}
              </button>
            </div>

            <textarea
              rows={4}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-emerald-500/30 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500 text-xs leading-relaxed font-sans"
              placeholder="Digite a mensagem personalizada para enviar ao cliente..."
            />
            <p className="text-[11px] text-slate-500">
              O operador pode editar qualquer parte do texto acima antes de disparar o WhatsApp.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveAndSend(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors border border-slate-700"
            >
              Apenas Salvar Status
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveAndSend(true)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Salvando...' : 'Salvar & Enviar WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
