import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  MessageSquare,
  Printer,
  Smartphone,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  SlidersHorizontal,
  User,
  Shield,
  Eye
} from 'lucide-react';
import { ServiceOrder, OSStatus, Client, Product, StoreSettings } from '../../types';
import { api, formatCurrency, formatDateTime } from '../../services/api';
import { ServiceOrderModal } from './ServiceOrderModal';
import { OSUpdateAndNotifyModal } from './OSUpdateAndNotifyModal';
import { OSThermalReceiptModal } from './OSThermalReceiptModal';

interface ServiceOrdersViewProps {
  settings: StoreSettings;
}

export const ServiceOrdersView: React.FC<ServiceOrdersViewProps> = ({ settings }) => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedOSToEdit, setSelectedOSToEdit] = useState<ServiceOrder | null>(null);
  const [selectedOSToNotify, setSelectedOSToNotify] = useState<ServiceOrder | null>(null);
  const [selectedOSToPrint, setSelectedOSToPrint] = useState<{ os: ServiceOrder; mode: 'entry' | 'delivery' } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [osList, cliList, prodList] = await Promise.all([
        api.getServiceOrders({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          search: searchQuery || undefined
        }),
        api.getClients(),
        api.getProducts()
      ]);
      setOrders(osList);
      setClients(cliList);
      setProducts(prodList);
    } catch (err) {
      console.error('Error loading service orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getStatusBadge = (status: OSStatus) => {
    const map: Record<OSStatus, { label: string; bg: string; text: string; border: string }> = {
      aguardando_analise: { label: 'Aguardando Análise', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
      em_analise: { label: 'Em Análise', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
      aguardando_aprovacao: { label: 'Aguardando Aprovação', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
      aprovado: { label: 'Aprovado / Em Reparo', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
      aguardando_peca: { label: 'Aguardando Peça', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
      pronto: { label: 'Pronto para Retirada', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
      entregue: { label: 'Entregue / Concluído', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
      cancelado: { label: 'Cancelado', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' }
    };
    const s = map[status] || map.aguardando_analise;
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${s.bg} ${s.text} ${s.border} whitespace-nowrap`}>
        {s.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'urgente') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">Urgente</span>;
    }
    if (priority === 'alta') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Alta</span>;
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 lg:p-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-100">Ordens de Serviço - Celulares</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de assistência técnica, controle de aparelhos, checklists, laudos e avisos via WhatsApp
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem de Serviço
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="py-4 space-y-3">
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Todas as OS' },
            { id: 'aguardando_analise', label: 'Aguardando Análise' },
            { id: 'em_analise', label: 'Em Análise' },
            { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
            { id: 'aprovado', label: 'Em Reparo' },
            { id: 'aguardando_peca', label: 'Aguardando Peça' },
            { id: 'pronto', label: 'Pronto Retirada' },
            { id: 'entregue', label: 'Entregues' },
            { id: 'cancelado', label: 'Canceladas' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input + Priority */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, nº da OS, modelo do celular, IMEI ou fone..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* OS Cards List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Carregando ordens de serviço...</div>
        ) : orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-sm">
            <Smartphone className="w-12 h-12 stroke-1 mb-2 text-slate-700" />
            <p>Nenhuma ordem de serviço encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          orders.map(os => {
            const hasPhotos = os.photos && os.photos.length > 0;
            return (
              <div
                key={os.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700 transition-all shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: OS details & Device Info */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Photo thumbnail or Device Icon */}
                  {hasPhotos ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                      <img
                        src={os.photos[0].url}
                        alt="Aparelho"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                      <Smartphone className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {/* Header line: OS Number, Brand/Model, Priority, Status */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm text-indigo-400">
                        #{String(os.os_number).padStart(5, '0')}
                      </span>
                      <h3 className="font-extrabold text-slate-100 text-sm sm:text-base truncate">
                        {os.device_brand} {os.device_model}
                      </h3>
                      {getPriorityBadge(os.priority)}
                      {getStatusBadge(os.status)}
                    </div>

                    {/* Client & Contact line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1 font-semibold text-slate-200">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {os.client_name}
                      </span>
                      <span>•</span>
                      <span>Fone: {os.client_phone}</span>
                      {os.device_imei && (
                        <>
                          <span>•</span>
                          <span className="font-mono">IMEI: {os.device_imei}</span>
                        </>
                      )}
                    </div>

                    {/* Defect preview */}
                    <div className="text-xs text-slate-300 line-clamp-1 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/80">
                      <span className="font-bold text-slate-400">Defeito: </span>
                      {os.reported_defect}
                    </div>
                  </div>
                </div>

                {/* Right: Financial, Dates & Action Buttons */}
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <div className="text-left lg:text-right pr-2">
                    <span className="text-[11px] text-slate-400 block">Total do Reparo</span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      {formatCurrency(os.total)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Entrada: {formatDateTime(os.created_at)}
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    {/* WhatsApp notification button */}
                    <button
                      onClick={() => setSelectedOSToNotify(os)}
                      className="p-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Atualizar Status e Enviar WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    {/* Print Slip */}
                    <button
                      onClick={() => setSelectedOSToPrint({ os, mode: os.status === 'entregue' ? 'delivery' : 'entry' })}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                      title="Imprimir Comprovante Térmico"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline">Imprimir</span>
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => setSelectedOSToEdit(os)}
                      className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                    >
                      Editar OS
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New OS Modal */}
      {isNewModalOpen && (
        <ServiceOrderModal
          clients={clients}
          products={products}
          onClose={() => setIsNewModalOpen(false)}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {/* Edit OS Modal */}
      {selectedOSToEdit && (
        <ServiceOrderModal
          osToEdit={selectedOSToEdit}
          clients={clients}
          products={products}
          onClose={() => setSelectedOSToEdit(null)}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {/* OS Status & WhatsApp Notification Modal */}
      {selectedOSToNotify && (
        <OSUpdateAndNotifyModal
          os={selectedOSToNotify}
          settings={settings}
          onClose={() => setSelectedOSToNotify(null)}
          onUpdated={() => {
            loadData();
          }}
        />
      )}

      {/* OS Thermal Print Modal */}
      {selectedOSToPrint && (
        <OSThermalReceiptModal
          os={selectedOSToPrint.os}
          settings={settings}
          mode={selectedOSToPrint.mode}
          onClose={() => setSelectedOSToPrint(null)}
        />
      )}
    </div>
  );
};
