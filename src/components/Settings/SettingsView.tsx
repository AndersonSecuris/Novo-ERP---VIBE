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
  Monitor,
  Play,
  FileCode,
  Sparkles,
  Wifi,
  Usb,
  Cpu,
  Bluetooth,
  AlertCircle,
  Coins,
  FileText
} from 'lucide-react';
import { StoreSettings } from '../../types';
import { api } from '../../services/api';
import {
  encodeTestReceipt,
  encodeCashDrawerPulse,
  printEscPosUniversal,
  downloadRawEscPosFile
} from '../../services/escpos';

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
  const [activeTab, setActiveTab] = useState<'store' | 'printer' | 'pix' | 'os' | 'whatsapp' | 'database' | 'desktop'>('printer');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateSettings(formData);
      onUpdateSettings(formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/db/export';
  };

  // Test ESC/POS Printing
  const handleRunEscPosTest = async (overrideConnection?: any) => {
    setTesting(true);
    setTestStatus(null);
    try {
      const conn = overrideConnection || formData.printer_connection || 'dialog';
      const buffer = encodeTestReceipt(formData);
      const res = await printEscPosUniversal(buffer, formData, conn);
      setTestStatus({
        type: 'success',
        text: `✅ ${res.message || 'Comprovante de teste enviado com sucesso!'}`
      });
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        text: `❌ Falha: ${err.message || 'Não foi possível imprimir.'}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Test Cash Drawer Pulse
  const handleTestCashDrawer = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const buffer = encodeCashDrawerPulse();
      const res = await printEscPosUniversal(buffer, formData, formData.printer_connection || 'dialog');
      setTestStatus({
        type: 'success',
        text: '✅ Comando de abertura de gaveta (ESC p) enviado à impressora!'
      });
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        text: `❌ Falha ao acionar gaveta: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Test Network TCP connection
  const handleTestNetworkPing = async () => {
    if (!formData.printer_ip) {
      setTestStatus({ type: 'error', text: 'Informe o endereço IP da impressora na rede antes de testar.' });
      return;
    }
    setTesting(true);
    setTestStatus(null);
    try {
      const res = await api.testPrinterNetwork(formData.printer_ip, formData.printer_port || 9100);
      setTestStatus({
        type: 'success',
        text: `✅ Conexão TCP bem-sucedida com a impressora em ${formData.printer_ip}:${formData.printer_port || 9100}`
      });
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        text: `❌ Falha de rede: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Download raw test binary
  const handleDownloadTestBin = () => {
    try {
      const buffer = encodeTestReceipt(formData);
      downloadRawEscPosFile(buffer, 'teste_escpos.bin');
      setTestStatus({
        type: 'info',
        text: 'Arquivo binário teste_escpos.bin baixado para envio direto via spooler.'
      });
    } catch (e: any) {
      setTestStatus({ type: 'error', text: 'Erro ao gerar arquivo binário.' });
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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 lg:p-6 bg-[#f5f5f7]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Configurações do Sistema</h2>
            <p className="text-xs text-slate-500">
              Biblioteca ESC/POS, Impressoras Térmicas (USB, COM, Rede, Bluetooth), Dados da Loja e App Windows
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 animate-in fade-in shadow-2xs">
            <Check className="w-4 h-4" />
            Configurações Salvas com Sucesso!
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 pt-4 gap-2 overflow-x-auto">
        {[
          { id: 'printer', label: 'Impressora Térmica & ESC/POS', icon: Printer, badge: 'ESC/POS' },
          { id: 'store', label: 'Dados da Empresa', icon: Store },
          { id: 'desktop', label: 'App Windows (.exe)', icon: Monitor, badge: 'Desktop' },
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
              className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  tab.id === 'printer' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Form */}
      <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-6 space-y-6 text-xs max-w-4xl">
        
        {/* TAB: PRINTER & ESC/POS */}
        {activeTab === 'printer' && (
          <div className="space-y-5">
            {/* Header banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-2xs">
                    <Printer className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">Motor de Impressão Térmica ESC/POS</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> Biblioteca Ativa
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Suporte de alta compatibilidade para Bematech (MP-4200 TH), Elgin (i7, i9, Quick), Epson (TM-T20), Daruma, POS-58 e POS-80.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700">
                    Bobina: {formData.printer_width || '80mm'}
                  </span>
                </div>
              </div>

              {testStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in ${
                    testStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : testStatus.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testStatus.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    )}
                    <span>{testStatus.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestStatus(null)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Main Configuration Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
              <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                Parâmetros de Conexão e Protocolo
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Método de Comunicação com a Impressora
                  </label>
                  <select
                    value={formData.printer_connection || 'dialog'}
                    onChange={e => setFormData({ ...formData, printer_connection: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="dialog">Diálogo de Impressão do Sistema (Ctrl+P / Spooler Padrão)</option>
                    <option value="webusb">USB Direto (WebUSB ESC/POS - Sem necessidade de driver complexo)</option>
                    <option value="webserial">Porta Serial COM (WebSerial - COM1, COM2, COM3, COM4...)</option>
                    <option value="webbluetooth">Bluetooth Direto (ESC/POS sem fio para mini impressoras)</option>
                    <option value="network">Rede Ethernet / Wi-Fi (Socket TCP Porta 9100)</option>
                    <option value="electron">Impressão Silenciosa Nativa Desktop Windows</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formData.printer_connection === 'webusb' && '💡 Conecta diretamente na impressora térmica USB via WebUSB com comandos ESC/POS nativos.'}
                    {formData.printer_connection === 'webserial' && '💡 Conecta em portas COM físicas ou adaptadores USB-Serial (Prolific, CH340, FTDI).'}
                    {formData.printer_connection === 'network' && '💡 Envia pacotes ESC/POS via rede local para impressoras com cabo de rede RJ45 ou Wi-Fi.'}
                    {formData.printer_connection === 'webbluetooth' && '💡 Conexão direta com maquininhas e impressoras térmicas portáteis Bluetooth.'}
                    {formData.printer_connection === 'dialog' && '💡 Abre a tela padrão de seleção de impressoras instaladas no Windows/Mac.'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Largura da Bobina Térmica</label>
                  <select
                    value={formData.printer_width || '80mm'}
                    onChange={e => setFormData({ ...formData, printer_width: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="80mm">80mm (48 colunas - Padrão Bematech, Elgin, Epson, Daruma)</option>
                    <option value="58mm">58mm (32 colunas - Mini impressoras e portáteis)</option>
                  </select>
                </div>

                {/* Conditional Network Fields */}
                {formData.printer_connection === 'network' && (
                  <>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Endereço IP da Impressora de Rede</label>
                      <input
                        type="text"
                        value={formData.printer_ip || ''}
                        onChange={e => setFormData({ ...formData, printer_ip: e.target.value })}
                        placeholder="Ex: 192.168.1.200"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Porta TCP RAW (Padrão 9100)</label>
                      <input
                        type="number"
                        value={formData.printer_port || 9100}
                        onChange={e => setFormData({ ...formData, printer_port: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </>
                )}

                {/* Conditional Serial Fields */}
                {formData.printer_connection === 'webserial' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Velocidade da Porta Serial (Baud Rate)</label>
                    <select
                      value={formData.printer_baud_rate || 9600}
                      onChange={e => setFormData({ ...formData, printer_baud_rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value={9600}>9600 bps (Padrão maioria)</option>
                      <option value={19200}>19200 bps</option>
                      <option value={38400}>38400 bps</option>
                      <option value={115200}>115200 bps (Alta velocidade)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tabela de Caracteres (Codepage)</label>
                  <select
                    value={formData.printer_codepage || 'epson'}
                    onChange={e => setFormData({ ...formData, printer_codepage: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="epson">Epson Padrão Universal (PC850 / CP850)</option>
                    <option value="bematech">Bematech / Elgin (PC860 Português)</option>
                    <option value="wpc1252">Windows-1252 (Latin 1)</option>
                    <option value="iso8859-1">ISO-8859-1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mensagem de Rodapé nos Cupons</label>
                  <input
                    type="text"
                    value={formData.receipt_footer || ''}
                    onChange={e => setFormData({ ...formData, receipt_footer: e.target.value })}
                    placeholder="Ex: Obrigado pela preferência! Volte sempre."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Hardware switches */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.printer_cut_paper !== false}
                    onChange={e => setFormData({ ...formData, printer_cut_paper: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">Acionar Corte Automático de Papel</span>
                    <span className="text-[11px] text-slate-500">Envia comando de guilhotina (GS V) ao finalizar cada cupom</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!formData.printer_open_drawer}
                    onChange={e => setFormData({ ...formData, printer_open_drawer: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">Abrir Gaveta de Dinheiro RJ11</span>
                    <span className="text-[11px] text-slate-500">Envia pulso elétrico (ESC p) em vendas a dinheiro e sangrias</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Test & Diagnostic Actions Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">Testes de Diagnóstico da Impressora Térmica</h4>
              <p className="text-slate-500 text-xs">
                Realize um teste prático para confirmar que a biblioteca ESC/POS está gerando e enviando os comandos corretamente.
              </p>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => handleRunEscPosTest()}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  {testing ? 'Enviando...' : '1. Imprimir Cupom de Teste ESC/POS'}
                </button>

                {formData.printer_connection === 'network' && (
                  <button
                    type="button"
                    disabled={testing}
                    onClick={handleTestNetworkPing}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    Testar Conexão de Rede IP
                  </button>
                )}

                <button
                  type="button"
                  disabled={testing}
                  onClick={handleTestCashDrawer}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Coins className="w-4 h-4 text-amber-600" />
                  Testar Gaveta de Dinheiro (Pulso)
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTestBin}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-blue-600" />
                  Baixar Binário .BIN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: STORE */}
        {activeTab === 'store' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm mb-2">Identificação do Estabelecimento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nome Fantasia da Loja *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">CNPJ / CPF</label>
                <input
                  type="text"
                  value={formData.cnpj || ''}
                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua das Palmeiras, 123 - Centro"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">WhatsApp de Contato</label>
                <input
                  type="text"
                  value={formData.whatsapp || ''}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: WINDOWS DESKTOP (.EXE) */}
        {activeTab === 'desktop' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-xs">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Modo Desktop & Executável Windows</h3>
                    <p className="text-slate-500 text-xs">
                      {isDesktop
                        ? '🟢 Executando atualmente em Janela Nativa Windows (Electron Desktop).'
                        : 'Permite abrir o sistema em uma janela independente e gerar instaladores .EXE standalone para Windows.'}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Compatível com Windows 10 & 11 (x64)
                </span>
              </div>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                  <Play className="w-4 h-4" />
                  1. Iniciar Direto em Janela Desktop
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Dê um duplo clique no arquivo <strong className="text-slate-900 font-mono">Executar_TechCell_Windows.bat</strong> incluído na raiz do projeto, ou execute no terminal:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 font-mono text-emerald-400 text-xs border border-slate-800 flex items-center justify-between">
                  <span>npm run electron</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Inicia o backend SQLite local e abre a janela personalizada com atalhos e barra nativa.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <FileCode className="w-4 h-4" />
                  2. Gerar Instalador e Portátil (.EXE)
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Dê um duplo clique em <strong className="text-slate-900 font-mono">Gerar_Executavel_EXE.bat</strong> ou rode o comando abaixo:
                </p>
                <div className="p-3 rounded-xl bg-slate-900 font-mono text-emerald-400 text-xs border border-slate-800 flex items-center justify-between">
                  <span>npm run dist:win</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Gera <strong className="text-slate-800">TechCell Setup.exe</strong> (instalador com ícone na Área de Trabalho) e a versão <strong className="text-slate-800">Portable.exe</strong> na pasta <code className="text-blue-600">/dist-electron</code>.
                </p>
              </div>
            </div>

            {/* Features table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Vantagens do Modo Executável Windows</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 text-xs mb-1">⚡ 100% Offline</div>
                  <div className="text-[11px] text-slate-500">
                    O banco SQLite e a interface funcionam direto no seu computador mesmo sem internet.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 text-xs mb-1">🖨️ Impressão Térmica ESC/POS</div>
                  <div className="text-[11px] text-slate-500">
                    Comunicação otimizada com impressoras USB e portas COM no Windows.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 text-xs mb-1">🔒 Instância Única Segura</div>
                  <div className="text-[11px] text-slate-500">
                    Bloqueia aberturas duplas para proteger os arquivos de estoque e caixa de conflitos.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PIX */}
        {activeTab === 'pix' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm mb-2">Configuração de Pagamento PIX</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tipo de Chave</label>
                <select
                  value={formData.pix_key_type || 'cnpj'}
                  onChange={e => setFormData({ ...formData, pix_key_type: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Email">Email</option>
                  <option value="Chave Aleatória">Chave Aleatória</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Chave PIX</label>
                <input
                  type="text"
                  value={formData.pix_key || ''}
                  onChange={e => setFormData({ ...formData, pix_key: e.target.value })}
                  placeholder="Insira sua chave PIX..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Nome do Beneficiário / Titular</label>
                <input
                  type="text"
                  value={formData.pix_beneficiary || ''}
                  onChange={e => setFormData({ ...formData, pix_beneficiary: e.target.value })}
                  placeholder="Nome exibido no comprovante"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: OS TERMS */}
        {activeTab === 'os' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm mb-1">Termos de Garantia & Condições da OS</h4>
            <p className="text-slate-500 text-xs mb-2">
              Este texto é impresso nos comprovantes térmicos e assinados pelo cliente no momento da entrega do aparelho.
            </p>
            <textarea
              rows={6}
              value={formData.os_terms || ''}
              onChange={e => setFormData({ ...formData, os_terms: e.target.value })}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-sans focus:outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>
        )}

        {/* TAB 5: WHATSAPP TEMPLATES */}
        {activeTab === 'whatsapp' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Modelos de Mensagem WhatsApp</h4>
                <p className="text-slate-500 text-xs">
                  Tags dinâmicas disponíveis: <code className="text-blue-600 font-mono">&#123;cliente&#125;</code>,{' '}
                  <code className="text-blue-600 font-mono">&#123;os_numero&#125;</code>,{' '}
                  <code className="text-blue-600 font-mono">&#123;aparelho&#125;</code>,{' '}
                  <code className="text-blue-600 font-mono">&#123;valor&#125;</code>,{' '}
                  <code className="text-blue-600 font-mono">&#123;diagnostico&#125;</code>,{' '}
                  <code className="text-blue-600 font-mono">&#123;loja&#125;</code>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {statusTemplates.map(st => {
                const currentVal = (formData.whatsapp_templates as any)?.[st.key] || '';
                return (
                  <div key={st.key} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block font-bold text-slate-900 mb-1">{st.label}</label>
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
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-sans text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: SQLITE & BACKUP */}
        {activeTab === 'database' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h4 className="font-bold text-slate-900 text-sm mb-1">Banco de Dados SQLite & Arquitetura Windows</h4>
            
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-900">Arquivo SQLite Local: /data/pdv_database.sqlite</h5>
                <p className="text-slate-600 leading-relaxed text-xs">
                  O sistema armazena todos os registros relacionais de produtos, clientes, movimentações de caixa,
                  histórico de estoque e ordens de serviço diretamente no SQLite em arquivo local com sincronização automática a cada operação.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
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
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando Configurações...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
};
