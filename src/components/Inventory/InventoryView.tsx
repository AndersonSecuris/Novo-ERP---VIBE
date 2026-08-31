import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  AlertTriangle,
  ArrowUpDown,
  History,
  Edit2,
  Trash2,
  Barcode,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Check,
  Percent,
  Sparkles
} from 'lucide-react';
import { Product, ProductType, StockLog } from '../../types';
import { api, formatCurrency, formatDateTime } from '../../services/api';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'manual_entry' | 'manual_exit'>('manual_entry');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Product Form states
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Geral');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('3');
  const [unit, setUnit] = useState('UN');
  const [prodType, setProdType] = useState<ProductType>('product');
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts({
        search: searchQuery || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        low_stock: lowStockOnly || undefined
      });
      setProducts(data);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [typeFilter, lowStockOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setName('');
    setBarcode('');
    setSku('');
    setCategory('Acessórios');
    setCostPrice('');
    setSalePrice('');
    setStock('10');
    setMinStock('3');
    setUnit('UN');
    setProdType('product');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setBarcode(p.barcode || '');
    setSku(p.sku || '');
    setCategory(p.category || 'Geral');
    setCostPrice(p.cost_price ? String(p.cost_price) : '');
    setSalePrice(String(p.sale_price));
    setStock(String(p.stock));
    setMinStock(String(p.min_stock));
    setUnit(p.unit || 'UN');
    setProdType(p.type || 'product');
    setIsProductModalOpen(true);
  };

  const handleGenerateBarcode = () => {
    const randomEan = '789' + Math.floor(100000000 + Math.random() * 900000000);
    setBarcode(randomEan);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !salePrice) {
      alert('Preencha ao menos Nome e Preço de Venda');
      return;
    }
    try {
      setSubmitting(true);
      const payload: Partial<Product> = {
        name,
        barcode: barcode || undefined,
        sku: sku || undefined,
        category,
        cost_price: parseFloat(costPrice) || 0,
        sale_price: parseFloat(salePrice) || 0,
        stock: parseInt(stock, 10) || 0,
        min_stock: parseInt(minStock, 10) || 0,
        unit,
        type: prodType
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }

      setIsProductModalOpen(false);
      loadProducts();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (confirm(`Deseja realmente excluir "${prodName}" do catálogo?`)) {
      try {
        await api.deleteProduct(id);
        loadProducts();
      } catch (err: any) {
        alert(`Erro ao excluir: ${err.message}`);
      }
    }
  };

  // Stock Adjustment
  const handleOpenAdjust = (p: Product) => {
    setAdjustingProduct(p);
    setAdjustType('manual_entry');
    setAdjustQty('');
    setAdjustReason('Compra de reposição de estoque');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !adjustQty || parseInt(adjustQty, 10) <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    try {
      setSubmitting(true);
      const qtyNum = parseInt(adjustQty, 10);
      const change = adjustType === 'manual_entry' ? qtyNum : -qtyNum;

      await api.adjustStock(adjustingProduct.id, {
        change_qty: change,
        reason: adjustReason,
        type: adjustType
      });

      setIsAdjustModalOpen(false);
      loadProducts();
    } catch (err: any) {
      alert(`Erro ao ajustar estoque: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Stock history
  const handleOpenHistory = async (product?: Product) => {
    try {
      setIsHistoryModalOpen(true);
      setHistoryLoading(true);
      const logs = await api.getStockLogs({
        product_id: product?.id,
        limit: 100
      });
      setStockLogs(logs);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Margin calculation helper
  const numCost = parseFloat(costPrice) || 0;
  const numSale = parseFloat(salePrice) || 0;
  const markupPercent = numCost > 0 ? (((numSale - numCost) / numCost) * 100).toFixed(1) : '100';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 lg:p-6 bg-slate-950">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-100">Controle de Estoque & Produtos</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de produtos, peças de reposição, mão de obra e histórico de movimentações
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenHistory()}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-xs flex items-center gap-2 transition-all"
          >
            <History className="w-4 h-4 text-slate-400" />
            Histórico Movimentações
          </button>
          <button
            onClick={handleOpenNewProduct}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Produto / Peça
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="py-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do produto, código de barras ou SKU..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todos os Tipos</option>
            <option value="product">Produtos para Venda</option>
            <option value="part">Peças de Reposição (OS)</option>
            <option value="service">Serviços / Mão de Obra</option>
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              lowStockOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Estoque Baixo
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-y-auto bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">Carregando estoque...</div>
        ) : products.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Package className="w-12 h-12 stroke-1 mb-2 text-slate-700" />
            <p>Nenhum item encontrado no estoque.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Item / Código</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Custo</th>
                <th className="py-3 px-4 text-right">Venda</th>
                <th className="py-3 px-4 text-center">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {products.map(p => {
                const isOutOfStock = p.type !== 'service' && p.stock <= 0;
                const isLowStock = p.type !== 'service' && p.stock <= p.min_stock && p.stock > 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-900/90 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        {p.barcode && <span>Barras: {p.barcode}</span>}
                        {p.sku && <span>SKU: {p.sku}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.category}</td>
                    <td className="py-3 px-4">
                      {p.type === 'service' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Serviço
                        </span>
                      ) : p.type === 'part' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          Peça Reparo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Produto Venda
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {formatCurrency(p.cost_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.type === 'service' ? (
                        <span className="text-slate-500 font-mono">Infinito</span>
                      ) : isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          0 {p.unit} (Esgotado)
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {p.stock} {p.unit} (Baixo)
                        </span>
                      ) : (
                        <span className="font-mono font-bold text-slate-200">
                          {p.stock} {p.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.type !== 'service' && (
                          <button
                            onClick={() => handleOpenAdjust(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Entrada / Saída Rápida de Estoque"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditProduct(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors"
                          title="Editar Cadastro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 transition-colors"
                          title="Excluir Produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <h3 className="font-extrabold text-slate-100 text-base">
                {editingProduct ? 'Editar Produto / Peça' : 'Cadastrar Novo Item'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Tela iPhone 11 Original, Película 3D, Troca de Conector"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo de Cadastro</label>
                  <select
                    value={prodType}
                    onChange={e => setProdType(e.target.value as ProductType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="product">Produto de Balcão (Acessórios, etc.)</option>
                    <option value="part">Peça de Reposição (Telas, Baterias)</option>
                    <option value="service">Serviço / Mão de Obra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Ex: Telas, Baterias, Acessórios"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400 font-semibold">Código de Barras / EAN</label>
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      + Gerar EAN
                    </button>
                  </div>
                  <input
                    type="text"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="789..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código SKU / Referência</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="TEL-IP11"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-indigo-500 text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Margem Lucro</label>
                  <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-indigo-400 font-mono font-bold text-center">
                    +{markupPercent}%
                  </div>
                </div>
              </div>

              {prodType !== 'service' && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Estoque Atual</label>
                    <input
                      type="number"
                      value={stock}
                      onChange={e => setStock(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Estoque Mínimo</label>
                    <input
                      type="number"
                      value={minStock}
                      onChange={e => setMinStock(e.target.value)}
                      placeholder="3"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Unidade</label>
                    <select
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="UN">UN (Unidade)</option>
                      <option value="PC">PC (Peça)</option>
                      <option value="KG">KG (Quilo)</option>
                      <option value="M">M (Metro)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {submitting ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <h4 className="font-bold text-slate-100 mb-1">Ajuste Manual de Estoque</h4>
            <p className="text-xs text-slate-400 mb-4">{adjustingProduct.name}</p>

            <form onSubmit={handleSaveAdjust} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('manual_entry')}
                  className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
                    adjustType === 'manual_entry'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Entrada (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('manual_exit')}
                  className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
                    adjustType === 'manual_exit'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Saída (-)
                </button>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Quantidade a Movimentar *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  placeholder="Ex: 5"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Motivo do Ajuste *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Ex: Nota Fiscal 1420, avaria, contagem física"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Logs History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100">Histórico de Movimentações de Estoque</h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Carregando logs...</div>
              ) : stockLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">Nenhum log registrado.</div>
              ) : (
                stockLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{log.product_name}</span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {log.reason || 'Movimentação'} • {formatDateTime(log.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono font-bold text-sm ${
                          log.change_qty > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty}
                      </span>
                      <div className="text-[10px] text-slate-500">
                        {log.previous_stock} → {log.new_stock}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
