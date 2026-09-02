import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  QrCode,
  Percent,
  CheckCircle,
  RotateCcw,
  Printer,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Package,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Product, Client, Sale, SaleItem, PaymentMethod, StoreSettings } from '../../types';
import { api, formatCurrency } from '../../services/api';
import { ThermalReceiptModal } from './ThermalReceiptModal';

interface POSViewProps {
  settings: StoreSettings;
  onOpenCashModal: () => void;
  isCashRegisterOpen: boolean;
}

export const POSView: React.FC<POSViewProps> = ({
  settings,
  onOpenCashModal,
  isCashRegisterOpen
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [additionValue, setAdditionValue] = useState<number>(0);
  const [saleNotes, setSaleNotes] = useState('');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [submittingSale, setSubmittingSale] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Quick Client Register Modal
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCpf, setNewClientCpf] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial catalog
  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, clis] = await Promise.all([
        api.getProducts(),
        api.getClients()
      ]);
      setProducts(prods);
      setClients(clis);
    } catch (err) {
      console.error('Error loading POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard Shortcuts (F2, F4, F9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && isCashRegisterOpen) {
          handleOpenPayment();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && confirm('Deseja limpar todo o carrinho?')) {
          setCart([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCashRegisterOpen]);

  // Categories list
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'Geral')))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery)) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Add product to cart
  const addToCart = (product: Product) => {
    if (!isCashRegisterOpen) {
      onOpenCashModal();
      return;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.productId === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + 1;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: newQty * updated[existingIndex].price
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            price: product.sale_price,
            costPrice: product.cost_price,
            quantity: 1,
            subtotal: product.sale_price,
            unit: product.unit,
            type: product.type
          }
        ];
      }
    });
  };

  // Barcode / Fast Input Submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const term = barcodeInput.trim();
    // Search exact barcode or SKU first
    const found = products.find(
      p => p.barcode === term || (p.sku && p.sku.toLowerCase() === term.toLowerCase())
    );

    if (found) {
      addToCart(found);
      setBarcodeInput('');
    } else {
      // Search partial name
      const nameMatch = products.find(p => p.name.toLowerCase().includes(term.toLowerCase()));
      if (nameMatch) {
        addToCart(nameMatch);
        setBarcodeInput('');
      } else {
        alert(`Produto não encontrado com código: "${term}"`);
      }
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        subtotal: newQty * updated[index].price
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const calculatedDiscount =
    discountType === 'percent' ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0;
  const total = Math.max(0, subtotal - calculatedDiscount + (additionValue || 0));

  const handleOpenPayment = () => {
    setAmountPaid(total.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const handleQuickAddMoney = (val: number) => {
    const current = parseFloat(amountPaid) || 0;
    setAmountPaid((current + val).toFixed(2));
  };

  const numAmountPaid = parseFloat(amountPaid) || 0;
  const changeAmount = paymentMethod === 'dinheiro' ? Math.max(0, numAmountPaid - total) : 0;

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'dinheiro' && numAmountPaid < total) {
      alert('O valor recebido em dinheiro é menor que o total da venda!');
      return;
    }

    try {
      setSubmittingSale(true);
      const salePayload: Partial<Sale> = {
        client_id: selectedClient?.id,
        client_name: selectedClient?.name || 'Consumidor Final',
        subtotal,
        discount: calculatedDiscount,
        addition: additionValue || 0,
        total,
        payment_method: paymentMethod,
        amount_paid: paymentMethod === 'dinheiro' ? numAmountPaid : total,
        change_amount: changeAmount,
        items: cart,
        notes: saleNotes
      };

      const created = await api.createSale(salePayload);

      // Trigger celebration confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      setCompletedSale(created);
      setIsPaymentModalOpen(false);
      setShowReceiptModal(true);

      // Reset cart
      setCart([]);
      setSelectedClient(null);
      setDiscountValue(0);
      setAdditionValue(0);
      setSaleNotes('');

      // Reload products to update real stock
      loadData();
    } catch (err: any) {
      alert(`Erro ao registrar venda: ${err.message}`);
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleQuickCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPhone) {
      alert('Preencha ao menos Nome e WhatsApp/Telefone.');
      return;
    }
    try {
      const created = await api.createClient({
        name: newClientName,
        phone: newClientPhone,
        cpf: newClientCpf
      });
      setClients(prev => [...prev, created]);
      setSelectedClient(created);
      setShowQuickClientModal(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientCpf('');
    } catch (err: any) {
      alert(`Erro ao cadastrar cliente: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden gap-4 p-4 lg:p-6 bg-[#f5f5f7]">
      {/* Left: Product Catalog & Fast Scanner */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/90 p-4 lg:p-5 overflow-hidden shadow-xs">
        {/* Top Bar: Barcode scanner + Name Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Fast Barcode Reader */}
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <Barcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Código de Barras / SKU (F2 ou Leitor USB)..."
              className="w-full pl-11 pr-20 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-mono text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Bipar
            </button>
          </form>

          {/* Search by text */}
          <div className="sm:w-64 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              {cat === 'all' ? 'Todos os Produtos' : cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Carregando catálogo...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm">
              <Package className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(prod => {
                const isOutOfStock = prod.type !== 'service' && prod.stock <= 0;
                const isLowStock = prod.type !== 'service' && prod.stock <= prod.min_stock && prod.stock > 0;

                return (
                  <button
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="group relative flex flex-col justify-between p-3.5 bg-white hover:bg-slate-50/80 border border-slate-200 hover:border-blue-400 rounded-xl transition-all text-left shadow-xs hover:shadow-md cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                          {prod.category}
                        </span>
                        {prod.type === 'service' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Serviço
                          </span>
                        ) : isOutOfStock ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Esgotado
                          </span>
                        ) : isLowStock ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {prod.stock} un
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {prod.stock} un
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {prod.name}
                      </h4>
                      {prod.sku && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          SKU: {prod.sku}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-sm font-extrabold text-emerald-600 font-mono">
                        {formatCurrency(prod.sale_price)}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart & Checkout Panel */}
      <div className="w-full lg:w-96 xl:w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200/90 p-4 lg:p-5 shadow-xs">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Carrinho de Venda</h3>
              <span className="text-xs text-slate-500">
                {cart.length} {cart.length === 1 ? 'item' : 'itens'} no pedido
              </span>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Deseja cancelar e limpar o carrinho?')) setCart([]);
              }}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
              title="Limpar Carrinho (F9)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar (F9)
            </button>
          )}
        </div>

        {/* Client Selection */}
        <div className="py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Cliente (Opcional)
            </label>
            <button
              onClick={() => setShowQuickClientModal(true)}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              + Novo Cliente
            </button>
          </div>

          <select
            value={selectedClient?.id || ''}
            onChange={e => {
              const cli = clients.find(c => c.id === e.target.value);
              setSelectedClient(cli || null);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">Consumidor Final (Não identificado)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[160px] max-h-[300px] lg:max-h-none">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-8 text-center">
              <ShoppingCart className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600">Carrinho vazio</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Bipe um código de barras ou clique nos produtos do catálogo ao lado
              </p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-slate-900 truncate">{item.name}</h5>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {formatCurrency(item.price)} un
                  </div>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    onClick={() => updateQuantity(idx, -1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-7 text-center font-bold text-slate-900 font-mono">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div className="text-right flex items-center gap-2">
                  <span className="font-bold text-emerald-600 font-mono text-sm">
                    {formatCurrency(item.subtotal)}
                  </span>
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculations & Discounts */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          {/* Discount & Addition inputs */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Percent className="w-3 h-3 text-blue-600" />
                Desconto
              </label>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setDiscountType(discountType === 'value' ? 'percent' : 'value')}
                  className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-l-lg border border-r-0 border-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  {discountType === 'value' ? 'R$' : '%'}
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountValue || ''}
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-r-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-600 font-semibold mb-1 block">
                Acréscimo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={additionValue || ''}
                onChange={e => setAdditionValue(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Subtotal & Total display */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>Desconto ({discountType === 'percent' ? `${discountValue}%` : 'R$'}):</span>
                <span className="font-mono">-{formatCurrency(calculatedDiscount)}</span>
              </div>
            )}
            {additionValue > 0 && (
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Acréscimo:</span>
                <span className="font-mono">+{formatCurrency(additionValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>TOTAL:</span>
              <span className="text-emerald-600 font-mono text-lg">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Action Button */}
          {!isCashRegisterOpen ? (
            <button
              onClick={onOpenCashModal}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-5 h-5" />
              Caixa Fechado - Clique para Abrir
            </button>
          ) : (
            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                cart.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
              }`}
            >
              <Banknote className="w-5 h-5" />
              FINALIZAR VENDA (F4)
            </button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Pagamento da Venda</h3>
                <p className="text-xs text-slate-500">Selecione a forma e confirme os valores</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total a Pagar</span>
                <span className="text-xl font-black text-emerald-600 font-mono">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Payment Methods Grid */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                    { id: 'pix', label: 'PIX', icon: QrCode },
                    { id: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
                    { id: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard },
                    { id: 'a_prazo', label: 'A Prazo / Fiado', icon: User }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.id as PaymentMethod);
                          if (m.id !== 'dinheiro') setAmountPaid(total.toFixed(2));
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-bold">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIX Quick Info */}
              {paymentMethod === 'pix' && settings.pix_key && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <QrCode className="w-4 h-4" />
                    Chave PIX Cadastrada ({settings.pix_key_type || 'Chave'}):
                  </div>
                  <div className="font-mono text-slate-900 select-all font-semibold bg-white p-2 rounded border border-emerald-200 break-all">
                    {settings.pix_key}
                  </div>
                  {settings.pix_beneficiary && (
                    <div className="text-[11px] text-emerald-700 font-medium">Favorecido: {settings.pix_beneficiary}</div>
                  )}
                </div>
              )}

              {/* Cash Paid and Change Calculation */}
              {paymentMethod === 'dinheiro' && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Valor Recebido do Cliente (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Quick Value Helper Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAmountPaid(total.toFixed(2))}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 border border-slate-300 cursor-pointer shadow-xs"
                    >
                      Exato ({formatCurrency(total)})
                    </button>
                    {[10, 20, 50, 100].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddMoney(val)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[11px] font-bold text-blue-700 border border-blue-200 cursor-pointer"
                      >
                        +{formatCurrency(val)}
                      </button>
                    ))}
                  </div>

                  {/* Change Output */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
                    <span className="text-slate-600 font-semibold">Troco a devolver:</span>
                    <span
                      className={`font-mono font-black text-lg ${
                        changeAmount > 0 ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(changeAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Sale Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Observações do Pedido (Opcional)
                </label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  placeholder="Ex: Entregar com garantia de 30 dias..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submittingSale}
                onClick={handleFinalizeSale}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                {submittingSale ? 'Processando Venda...' : 'Confirmar e Imprimir Cupom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Client Modal */}
      {showQuickClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <h4 className="font-bold text-slate-900 mb-3">Cadastro Rápido de Cliente</h4>
            <form onSubmit={handleQuickCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">WhatsApp / Telefone *</label>
                <input
                  type="text"
                  required
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="(11) 98765-4321"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">CPF (Opcional)</label>
                <input
                  type="text"
                  value={newClientCpf}
                  onChange={e => setNewClientCpf(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickClientModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal after sale */}
      {showReceiptModal && completedSale && (
        <ThermalReceiptModal
          sale={completedSale}
          settings={settings}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
};
