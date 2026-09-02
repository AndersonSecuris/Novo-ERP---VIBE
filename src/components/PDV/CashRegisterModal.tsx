import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
  Receipt,
  X,
  History,
  CheckCircle2,
  Printer,
  Sparkles
} from 'lucide-react';
import { CashRegisterStatus, CashRegisterSession, StoreSettings } from '../../types';
import { api, formatCurrency, formatDateTime } from '../../services/api';
import { encodeCashRegisterReceipt, printEscPosUniversal } from '../../services/escpos';

interface CashRegisterModalProps {
  onClose: () => void;
  onStatusChanged: () => void;
}

export const CashRegisterModal: React.FC<CashRegisterModalProps> = ({
  onClose,
  onStatusChanged
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CashRegisterStatus | null>(null);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'movement' | 'close' | 'history'>('current');
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  // Form states
  const [initialAmount, setInitialAmount] = useState('150.00');
  const [operatorName, setOperatorName] = useState('Operador 1');
  const [openNotes, setOpenNotes] = useState('Fundo de troco inicial');

  const [movementType, setMovementType] = useState<'suprimento' | 'sangria'>('suprimento');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [finalAmount, setFinalAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, sessionsRes, settingsRes] = await Promise.all([
        api.getCashRegister(),
        api.getCashSessions(),
        api.getSettings()
      ]);
      setData(statusRes);
      setSessions(sessionsRes);
      setSettings(settingsRes);
      if (statusRes.session && statusRes.salesSummary) {
        setFinalAmount(statusRes.salesSummary.calculatedExpectedCash.toFixed(2));
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCashSummary = async () => {
    if (!settings || !data) return;

    setPrinting(true);
    setPrintStatus('Gerando comprovante de caixa ESC/POS...');
    try {
      const buffer = encodeCashRegisterReceipt(data, settings);
      const res = await printEscPosUniversal(buffer, settings, settings.printer_connection || 'dialog');
      setPrintStatus(res.message || 'Comprovante impresso com sucesso!');
      setTimeout(() => setPrintStatus(null), 3500);
    } catch (err: any) {
      setPrintStatus(`Erro ao imprimir: ${err.message}`);
      setTimeout(() => setPrintStatus(null), 4000);
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      await api.openCashRegister({
        initial_amount: parseFloat(initialAmount) || 0,
        operator_name: operatorName,
        notes: openNotes
      });
      await loadData();
      onStatusChanged();
      setActiveTab('current');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementAmount || parseFloat(movementAmount) <= 0) {
      setErrorMsg('Informe um valor válido');
      return;
    }
    try {
      setSubmitting(true);
      setErrorMsg('');
      await api.addCashMovement({
        type: movementType,
        amount: parseFloat(movementAmount),
        reason: movementReason
      });
      setMovementAmount('');
      setMovementReason('');
      await loadData();
      onStatusChanged();
      setActiveTab('current');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      await api.closeCashRegister({
        final_amount: parseFloat(finalAmount) || 0,
        notes: closeNotes
      });
      await loadData();
      onStatusChanged();
      setActiveTab('current');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isOpen = !!data?.session;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}
            >
              {isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Controle de Frente de Caixa</h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isOpen ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {isOpen ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isOpen ? `Aberto em ${formatDateTime(data?.session?.opened_at)}` : 'Nenhum turno de caixa em andamento'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'current'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Resumo do Turno
          </button>

          {isOpen && (
            <>
              <button
                onClick={() => setActiveTab('movement')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'movement'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                Sangria & Suprimento
              </button>
              <button
                onClick={() => setActiveTab('close')}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'close'
                    ? 'border-rose-600 text-rose-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Lock className="w-4 h-4" />
                Fechar Caixa
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Histórico de Turnos
          </button>
        </div>

        {/* Error notice */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Carregando dados do caixa...</div>
          ) : !isOpen && activeTab === 'current' ? (
            /* Open Register Form */
            <form onSubmit={handleOpenRegister} className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
                Para iniciar as vendas no PDV e registrar recebimentos em dinheiro ou cartão, abra um novo turno de caixa informando o valor do fundo de troco.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Fundo de Troco Inicial (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={initialAmount}
                      onChange={e => setInitialAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Operador do Caixa
                  </label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={e => setOperatorName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                    placeholder="Nome do operador"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Observações de Abertura
                </label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={e => setOpenNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                  placeholder="Ex: Turno da manhã, notas de 10 e 20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                {submitting ? 'Abrindo caixa...' : 'Abrir Caixa Agora'}
              </button>
            </form>
          ) : activeTab === 'current' && data?.session ? (
            /* Current Active Session Overview */
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Fundo Inicial
                  </span>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {formatCurrency(data.session.initial_amount)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                  <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                    Vendas no Caixa
                  </span>
                  <div className="text-base font-bold text-emerald-700 mt-1">
                    {formatCurrency(data.salesSummary?.totalSales)}
                  </div>
                  <span className="text-[10px] text-slate-500">{data.salesCount} vendas</span>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80">
                  <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider block">
                    Suprimentos (+)
                  </span>
                  <div className="text-base font-bold text-sky-700 mt-1">
                    {formatCurrency(data.salesSummary?.suprimentos)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80">
                  <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
                    Sangrias (-)
                  </span>
                  <div className="text-base font-bold text-rose-700 mt-1">
                    {formatCurrency(data.salesSummary?.sangrias)}
                  </div>
                </div>
              </div>

              {/* Expected in Drawer Highlight */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-blue-900 font-bold uppercase tracking-wider">
                    Saldo Esperado em Gaveta (Dinheiro Físico)
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {formatCurrency(data.salesSummary?.calculatedExpectedCash)}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Fundo Inicial + Suprimentos - Sangrias + Vendas em Dinheiro
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 font-medium">Total Geral Faturado:</span>
                    <div className="text-lg font-bold text-slate-900">
                      {formatCurrency(data.salesSummary?.totalSales)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={printing}
                    onClick={() => handlePrintCashSummary()}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4 text-blue-600" />
                    {printing ? 'Imprimindo...' : 'Imprimir Fechamento ESC/POS'}
                  </button>
                </div>
              </div>

              {printStatus && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{printStatus}</span>
                </div>
              )}

              {/* Payment Methods Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Detalhamento por Meio de Pagamento
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-slate-500 block">Dinheiro:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(data.salesSummary?.cashSales)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-emerald-600 font-semibold block">PIX:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(data.salesSummary?.pixSales)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-blue-600 font-semibold block">Cartões:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(data.salesSummary?.cardSales)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <span className="text-amber-600 font-semibold block">Outros / Prazo:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatCurrency(data.salesSummary?.otherSales)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Movements List */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Movimentações deste Turno (Sangrias & Suprimentos)
                </h4>
                {data.movements.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">Nenhuma movimentação avulsa registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {data.movements.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              m.type === 'suprimento'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.type}
                          </span>
                          <span className="text-slate-800 font-medium">{m.reason || 'Sem motivo especificado'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{formatDateTime(m.created_at)}</span>
                          <span className="font-bold text-slate-900">{formatCurrency(m.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'movement' ? (
            /* Movement Form (Sangria / Suprimento) */
            <form onSubmit={handleAddMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Tipo de Movimentação</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMovementType('suprimento')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      movementType === 'suprimento'
                        ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-sky-600" />
                    Suprimento (Entrada de Dinheiro)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('sangria')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      movementType === 'sangria'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    Sangria (Retirada de Dinheiro)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Valor (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={movementAmount}
                    onChange={e => setMovementAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Motivo / Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={e => setMovementReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                  placeholder="Ex: Pagamento de fornecedor, depósito bancário, reforço de troco"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                {submitting ? 'Registrando...' : 'Confirmar Movimentação'}
              </button>
            </form>
          ) : activeTab === 'close' ? (
            /* Close Register Form */
            <form onSubmit={handleCloseRegister} className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                Ao fechar o caixa, confira o valor real em dinheiro presente na gaveta e compare com o saldo esperado calculado pelo sistema.
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Saldo Teórico em Dinheiro:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(data?.salesSummary?.calculatedExpectedCash)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Geral Faturado:</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(data?.salesSummary?.totalSales)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Valor Contado na Gaveta (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={finalAmount}
                    onChange={e => setFinalAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Observações de Fechamento
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                  placeholder="Ex: Diferença de R$ 0,50 no troco, notas recolhidas para cofre"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {submitting ? 'Fechando caixa...' : 'Confirmar e Fechar Caixa'}
              </button>
            </form>
          ) : (
            /* Sessions History */
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="text-center text-slate-400 py-8 text-xs">Nenhum histórico de caixa registrado.</div>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {s.status === 'open' ? 'Aberto' : 'Fechado'}
                        </span>
                        <span className="font-bold text-slate-800">
                          Operador: {s.operator_name || 'Geral'}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1">
                        Aberto em: {formatDateTime(s.opened_at)}
                        {s.closed_at && ` • Fechado em: ${formatDateTime(s.closed_at)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">Fundo: {formatCurrency(s.initial_amount)}</div>
                      {s.final_amount !== undefined && s.final_amount !== null && (
                        <div className="font-bold text-slate-900 mt-0.5">
                          Final: {formatCurrency(s.final_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
