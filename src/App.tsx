import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Wrench,
  Package,
  Receipt,
  Users,
  Settings,
  Vault,
  Smartphone,
  HardDrive,
  Circle,
  Clock,
  Printer,
  Sparkles
} from 'lucide-react';
import { StoreSettings, CashRegister } from './types';
import { api, formatCurrency } from './services/api';
import { POSView } from './components/PDV/POSView';
import { ServiceOrdersView } from './components/ServiceOrders/ServiceOrdersView';
import { InventoryView } from './components/Inventory/InventoryView';
import { SalesHistoryView } from './components/Sales/SalesHistoryView';
import { ClientsView } from './components/Clients/ClientsView';
import { SettingsView } from './components/Settings/SettingsView';
import { CashRegisterModal } from './components/PDV/CashRegisterModal';
import { WindowsTitleBar } from './components/Common/WindowsTitleBar';

type ActiveTab = 'pos' | 'os' | 'inventory' | 'sales' | 'clients' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [settings, setSettings] = useState<StoreSettings>({
    id: 'default',
    name: 'TechCell Assistência & PDV',
    printer_width: '80mm',
    receipt_footer: 'Obrigado pela preferência!',
    os_terms: 'Garantia de 90 dias conforme Art. 26 do Código de Defesa do Consumidor. Não nos responsabilizamos por dados não salvos.',
    whatsapp_templates: {
      aguardando_analise: 'Olá {cliente}! Seu aparelho {aparelho} foi recebido com sucesso na {loja}. Ordem de Serviço #{os_numero}. Avisaremos assim que o orçamento estiver pronto!',
      em_analise: 'Olá {cliente}! O aparelho {aparelho} (OS #{os_numero}) está sendo analisado pela nossa equipe técnica.',
      aguardando_aprovacao: 'Olá {cliente}! O orçamento da OS #{os_numero} ({aparelho}) ficou em R$ {valor}. Diagnóstico: {diagnostico}. Podemos aprovar o serviço?',
      aprovado: 'Olá {cliente}! O serviço da OS #{os_numero} ({aparelho}) foi aprovado e o reparo já foi iniciado!',
      aguardando_peca: 'Olá {cliente}! A OS #{os_numero} ({aparelho}) está aguardando a chegada da peça para conclusão.',
      pronto: 'Olá {cliente}! Ótima notícia: seu {aparelho} (OS #{os_numero}) está PRONTO para retirada na {loja}! Valor final: R$ {valor}.',
      entregue: 'Olá {cliente}! Agradecemos pela confiança na {loja}. Seu aparelho {aparelho} foi entregue com garantia de 90 dias!',
      cancelado: 'Olá {cliente}! A OS #{os_numero} do aparelho {aparelho} foi encerrada.'
    }
  });

  const [activeRegister, setActiveRegister] = useState<CashRegister | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Global POS / System shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't override if typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F3' && !isInput) {
        e.preventDefault();
        setActiveTab('inventory');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load initial settings and active cash register
  const loadSystem = async () => {
    try {
      const [st, regStatus] = await Promise.all([
        api.getSettings(),
        api.getCashRegister()
      ]);
      setSettings(st);
      setActiveRegister(regStatus.session);
    } catch (err) {
      console.error('Error loading initial app data:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadSystem();
  }, []);

  const navItems = [
    { id: 'pos', label: 'Frente de Caixa (PDV)', icon: ShoppingCart, shortcut: 'F1' },
    { id: 'os', label: 'Ordens de Serviço', icon: Wrench, badge: 'Assistência' },
    { id: 'inventory', label: 'Estoque & Produtos', icon: Package },
    { id: 'sales', label: 'Histórico & Cupons', icon: Receipt },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings }
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Windows Native-like Title Bar */}
      <WindowsTitleBar settings={settings} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 no-print">
          {/* Brand & Store header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Smartphone className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-extrabold text-xs text-slate-100 truncate">
                  {settings.name || 'PDV & Assistência'}
                </h1>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                  <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400 animate-pulse" />
                  SQLite Ativo (Windows/Web)
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 translate-x-1'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                        isSelected
                          ? 'bg-indigo-700 text-indigo-100'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Cash Register Widget in Sidebar */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <Vault className="w-3.5 h-3.5 text-indigo-400" />
                  Caixa Operacional
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    activeRegister
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {activeRegister ? 'Aberto' : 'Fechado'}
                </span>
              </div>

              {activeRegister ? (
                <div>
                  <span className="text-[10px] text-slate-500 block">Operador: {activeRegister.operator_name}</span>
                  <span className="text-xs font-mono font-bold text-slate-200 block">
                    Abertura: {formatCurrency(activeRegister.initial_cash)}
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">Abra o caixa para iniciar vendas e movimentações.</p>
              )}

              <button
                onClick={() => setIsCashModalOpen(true)}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Vault className="w-3.5 h-3.5" />
                {activeRegister ? 'Gerenciar / Fechar' : 'Abrir Caixa'}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Screen Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Render View depending on active tab */}
          {activeTab === 'pos' && (
            <POSView
              settings={settings}
              onOpenCashModal={() => setIsCashModalOpen(true)}
              isCashRegisterOpen={!!activeRegister}
            />
          )}

          {activeTab === 'os' && (
            <ServiceOrdersView settings={settings} />
          )}

          {activeTab === 'inventory' && (
            <InventoryView />
          )}

          {activeTab === 'sales' && (
            <SalesHistoryView settings={settings} />
          )}

          {activeTab === 'clients' && (
            <ClientsView />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={newSt => setSettings(newSt)}
            />
          )}
        </main>
      </div>

      {/* Cash Register Modal */}
      {isCashModalOpen && (
        <CashRegisterModal
          activeRegister={activeRegister}
          onClose={() => setIsCashModalOpen(false)}
          onRegisterUpdated={() => {
            loadSystem();
          }}
        />
      )}
    </div>
  );
}
