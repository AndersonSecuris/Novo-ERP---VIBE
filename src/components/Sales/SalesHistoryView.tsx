import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  User,
  ShoppingBag,
  TrendingUp
} from 'lucide-react';
import { Sale, StoreSettings } from '../../types';
import { api, formatCurrency, formatDateTime } from '../../services/api';
import { ThermalReceiptModal } from '../PDV/ThermalReceiptModal';

interface SalesHistoryViewProps {
  settings: StoreSettings;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ settings }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSaleToPrint, setSelectedSaleToPrint] = useState<Sale | null>(null);

  const loadSales = async () => {
    try {
      setLoading(true);
      const data = await api.getSales({ limit: 100 });
      setSales(data);
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const filteredSales = sales.filter(s => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      (s.client_name && s.client_name.toLowerCase().includes(term)) ||
      (s.payment_method && s.payment_method.toLowerCase().includes(term)) ||
      (s.sale_number && String(s.sale_number).includes(term))
    );
  });

  const totalSold = filteredSales.reduce((acc, s) => acc + s.total, 0);

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'dinheiro':
        return <Banknote className="w-4 h-4 text-emerald-400" />;
      case 'pix':
        return <QrCode className="w-4 h-4 text-sky-400" />;
      case 'cartao_credito':
      case 'cartao_debito':
        return <CreditCard className="w-4 h-4 text-purple-400" />;
      default:
        return <Receipt className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 lg:p-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-100">Histórico de Vendas & Cupons</h2>
              <p className="text-xs text-slate-400">
                Consulta de cupons não fiscais emitidos, reimpressão térmica e extrato de faturamento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Filtrado</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {formatCurrency(totalSold)}
            </span>
          </div>
        </div>
      </div>

      {/* Search filter */}
      <div className="py-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, nº do cupom ou forma de pagamento..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Sales List Table */}
      <div className="flex-1 overflow-y-auto bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">Carregando histórico...</div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
            <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-700" />
            <p>Nenhuma venda registrada até o momento.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Cupom / Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Itens</th>
                <th className="py-3 px-4 text-right">Desconto</th>
                <th className="py-3 px-4 text-right">Total Venda</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-900/90 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-slate-200">
                      Cupom #{String(sale.sale_number).padStart(5, '0')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatDateTime(sale.created_at)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-200">{sale.client_name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 capitalize font-medium text-slate-300">
                      {getPaymentIcon(sale.payment_method)}
                      {sale.payment_method.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-400">
                    {sale.discount > 0 ? `-${formatCurrency(sale.discount)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-400 text-sm">
                    {formatCurrency(sale.total)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedSaleToPrint(sale)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 ml-auto transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reimprimir Cupom
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Thermal Print Modal */}
      {selectedSaleToPrint && (
        <ThermalReceiptModal
          sale={selectedSaleToPrint}
          settings={settings}
          onClose={() => setSelectedSaleToPrint(null)}
        />
      )}
    </div>
  );
};
