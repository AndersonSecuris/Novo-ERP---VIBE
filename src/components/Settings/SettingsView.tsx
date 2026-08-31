import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Printer,
  QrCode,
  Shield,
  MessageSquare,
  Database,
  Download,
  Check,
  Save,
  HardDrive,
  RefreshCw,
  Monitor,
  Terminal,
  Play,
  FileCode,
  Sparkles
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { api } from '../../services/api';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (newSettings: StoreSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings
}) => {
  const isDesktop = typeof window !== 'undefined' && !!window.electronAPI?.isDesktop;
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [activeTab, setActiveTab] = useState<'store' | 'printer' | 'pix' | 'os' | 'whatsapp' | 'database' | 'desktop'>('store');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateSettings(formData);
      onUpdateSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/database/backup';
  };

  const handleTestDesktopPrint = async () => {
    if (window.electronAPI?.printThermalReceipt) {
      setTestPrintStatus('Enviando para impressora térmica...');
      const res = await window.electronAPI.printThermalReceipt({
        silent: false,
        width: formData.printer_width || '80mm'
      });
      if (res.success) {
        setTestPrintStatus('Impressão enviada com sucesso!');
      } else {
        setTestPrintStatus(`Aviso: ${res.error || 'Cancelado ou não configurado'}`);
      }
      setTimeout(() => setTestPrintStatus(null), 4000);
    } else {
      window.print();
    }
  };

  const statusTemplates = [
    { key: 'aguardando_analise', label: '1. Aguardando Análise' },
    { key: 'em_analise', label: '2. Em Análise / Orçamento' },
    { key: 'aguardando_aprovacao', label: '3. Aguardando Aprovação' },
    { key: 'aprovado', label: '4. Aprovado / Em Reparo' },
    { key: 'aguardando_peca', label: '5. Aguardando Peça' },
    { key: 'pronto', label: '6. Pronto para Retirada' },
    { key: 'entregue', label: '7. Entregue / Concluído' },
    { key: 'cancelado', label: '8. Cancelado / Sem Reparo' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 lg:p-6 bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-100">Configurações do Sistema</h2>
            <p className="text-xs text-slate-400">
              Personalize dados da loja, impressora térmica, PIX, templates de WhatsApp, SQLite e Aplicativo Windows (.exe)
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4" />
            Configurações Salvas!
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 pt-4 gap-2 overflow-x-auto">
        {[
          { id: 'store', label: 'Dados da Empresa', icon: Store },
          { id: 'desktop', label: 'App Windows (.exe)', icon: Monitor, badge: 'Desktop' },
          { id: 'printer', label: 'Impressora Térmica', icon: Printer },
          { id: 'pix', label: 'Chave PIX', icon: QrCode },
          { id: 'os', label: 'Termos de Garantia OS', icon: Shield },
          { id: 'whatsapp', label: 'Modelos WhatsApp', icon: MessageSquare },
          { id: 'database', label: 'Banco SQLite & Backup', icon: Database }
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${
                isSelected
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Form */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-6 space-y-6 text-xs max-w-4xl">
        {/* TAB: WINDOWS DESKTOP (.EXE) */}
        {activeTab === 'desktop' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-6 rounded-2xl border border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-100">Modo Desktop & Executável Windows</h3>
                    <p className="text-slate-400 text-xs">
                      {isDesktop
                        ? '🟢 Executando atualmente em Janela Nativa Windows (Electron Desktop).'
                        : 'Permite abrir o sistema em uma janela independente e gerar instaladores .EXE standalone para Windows.'}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Compatível com Windows 10 & 11 (x64)
                </span>
              </div>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Play className="w-4 h-4" />
                  1. Iniciar Direto em Janela Desktop
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Dê um duplo clique no arquivo <strong className="text-slate-200 font-mono">Executar_TechCell_Windows.bat</strong> incluído na raiz do projeto, ou execute no terminal:
                </p>
                <div className="p-3 rounded-xl bg-slate-950 font-mono text-emerald-400 text-xs border border-slate-800 flex items-center justify-between">
                  <span>npm run electron</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Inicia o backend SQLite local e abre a janela personalizada com atalhos e barra nativa.
                </p>
              </div>

              <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <FileCode className="w-4 h-4" />
                  2. Gerar Instalador e Portátil (.EXE)
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Dê um duplo clique em <strong className="text-slate-200 font-mono">Gerar_Executavel_EXE.bat</strong> ou rode o comando abaixo:
                </p>
                <div className="p-3 rounded-xl bg-slate-950 font-mono text-emerald-400 text-xs border border-slate-800 flex items-center justify-between">
                  <span>npm run dist:win</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Gera <strong className="text-slate-300">TechCell Setup.exe</strong> (instalador com ícone na Área de Trabalho) e a versão <strong className="text-slate-300">Portable.exe</strong> na pasta <code className="text-indigo-400">/dist-electron</code>.
                </p>
              </div>
            </div>

            {/* Features table */}
            <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 text-sm">Vantagens do Modo Executável Windows</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="font-bold text-slate-200 text-xs mb-1">⚡ 100% Offline</div>
                  <div className="text-[11px] text-slate-400">
                    O banco SQLite e a interface funcionam direto no seu computador mesmo sem internet.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="font-bold text-slate-200 text-xs mb-1">🖨️ Impressão Térmica Direta</div>
                  <div className="text-[11px] text-slate-400">
                    Comunicação otimizada com impressoras USB e portas COM no Windows.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="font-bold text-slate-200 text-xs mb-1">🔒 Instância Única Segura</div>
                  <div className="text-[11px] text-slate-400">
                    Bloqueia aberturas duplas para proteger os arquivos de estoque e caixa de conflitos.
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestDesktopPrint}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4 text-indigo-400" />
                  Testar Diálogo / Impressão Térmica
                </button>
                {testPrintStatus && (
                  <span className="text-xs text-indigo-400 font-semibold animate-pulse">
                    {testPrintStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: STORE */}
        {activeTab === 'store' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-slate-100 text-sm mb-2">Identificação do Estabelecimento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome Fantasia da Loja *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">CNPJ / CPF</label>
                <input
                  type="text"
                  value={formData.cnpj || ''}
                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 font-semibold mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua das Palmeiras, 123 - Centro"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email de Contato</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@assistencia.com.br"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRINTER */}
        {activeTab === 'printer' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-slate-100 text-sm mb-2">Impressão Não Fiscal de Cupons</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Largura da Bobina Térmica</label>
                <select
                  value={formData.printer_width || '80mm'}
                  onChange={e => setFormData({ ...formData, printer_width: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="80mm">80mm (Padrão Impressoras Térmicas Bematech, Elgin, EPSON)</option>
                  <option value="58mm">58mm (Mini Impressoras Térmicas / Portáteis Bluetooth)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Mensagem de Rodapé no Cupom</label>
                <input
                  type="text"
                  value={formData.receipt_footer || ''}
                  onChange={e => setFormData({ ...formData, receipt_footer: e.target.value })}
                  placeholder="Ex: Obrigado pela preferência! Volte sempre."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PIX */}
        {activeTab === 'pix' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-slate-100 text-sm mb-2">Configuração de Pagamento PIX</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tipo de Chave</label>
                <select
                  value={formData.pix_key_type || 'cnpj'}
                  onChange={e => setFormData({ ...formData, pix_key_type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Email">Email</option>
                  <option value="Chave Aleatória">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Chave PIX</label>
                <input
                  type="text"
                  value={formData.pix_key || ''}
                  onChange={e => setFormData({ ...formData, pix_key: e.target.value })}
                  placeholder="Insira sua chave PIX..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome do Beneficiário / Titular</label>
                <input
                  type="text"
                  value={formData.pix_beneficiary || ''}
                  onChange={e => setFormData({ ...formData, pix_beneficiary: e.target.value })}
                  placeholder="Nome exibido no comprovante"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OS TERMS */}
        {activeTab === 'os' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-slate-100 text-sm mb-1">Termos de Garantia & Condições da OS</h4>
            <p className="text-slate-400 text-xs mb-2">
              Este texto é impresso nos comprovantes térmicos e assinados pelo cliente no momento da entrega do aparelho.
            </p>
            <textarea
              rows={6}
              value={formData.os_terms || ''}
              onChange={e => setFormData({ ...formData, os_terms: e.target.value })}
              className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-sans focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>
        )}

        {/* TAB 5: WHATSAPP TEMPLATES */}
        {activeTab === 'whatsapp' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100 text-sm">Modelos de Mensagem WhatsApp</h4>
                <p className="text-slate-400 text-xs">
                  Tags dinâmicas disponíveis: <code className="text-indigo-400 font-mono">&#123;cliente&#125;</code>,{' '}
                  <code className="text-indigo-400 font-mono">&#123;os_numero&#125;</code>,{' '}
                  <code className="text-indigo-400 font-mono">&#123;aparelho&#125;</code>,{' '}
                  <code className="text-indigo-400 font-mono">&#123;valor&#125;</code>,{' '}
                  <code className="text-indigo-400 font-mono">&#123;diagnostico&#125;</code>,{' '}
                  <code className="text-indigo-400 font-mono">&#123;loja&#125;</code>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {statusTemplates.map(st => {
                const currentVal = (formData.whatsapp_templates as any)?.[st.key] || '';
                return (
                  <div key={st.key} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <label className="block font-bold text-slate-200 mb-1">{st.label}</label>
                    <textarea
                      rows={2}
                      value={currentVal}
                      onChange={e => {
                        setFormData({
                          ...formData,
                          whatsapp_templates: {
                            ...formData.whatsapp_templates,
                            [st.key]: e.target.value
                          }
                        });
                      }}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 font-sans text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: SQLITE & BACKUP */}
        {activeTab === 'database' && (
          <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-5">
            <h4 className="font-bold text-slate-100 text-sm mb-1">Banco de Dados SQLite & Arquitetura Windows</h4>
            
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-200">Arquivo SQLite Local: /data/pdv_database.sqlite</h5>
                <p className="text-slate-400 leading-relaxed text-xs">
                  O sistema armazena todos os registros relacionais de produtos, clientes, movimentações de caixa,
                  histórico de estoque e ordens de serviço diretamente no SQLite em arquivo local com sincronização automática a cada operação.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Cópia de Segurança do SQLite (.sqlite)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando Configurações...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
