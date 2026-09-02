import {
  Product,
  Client,
  Sale,
  ServiceOrder,
  CashRegisterStatus,
  CashRegisterSession,
  StoreSettings,
  StockLog,
  OSStatus
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Settings
  async getSettings(): Promise<StoreSettings> {
    const res = await fetch(`${BASE_URL}/settings`);
    if (!res.ok) throw new Error('Erro ao carregar configurações');
    return res.json();
  },

  async updateSettings(settings: Partial<StoreSettings>): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Erro ao salvar configurações');
    return res.json();
  },

  // Products
  async getProducts(params?: { search?: string; category?: string; type?: string; low_stock?: boolean }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.type) query.append('type', params.type);
    if (params?.low_stock) query.append('low_stock', 'true');

    const res = await fetch(`${BASE_URL}/products?${query.toString()}`);
    if (!res.ok) throw new Error('Erro ao buscar produtos');
    return res.json();
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Erro ao cadastrar produto');
    return res.json();
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const res = await fetch(`${BASE_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Erro ao atualizar produto');
    return res.json();
  },

  async adjustStock(id: string, data: { change_qty: number; reason?: string; type?: string }): Promise<Product> {
    const res = await fetch(`${BASE_URL}/products/${id}/adjust-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao ajustar estoque');
    return res.json();
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao excluir produto');
  },

  // Clients
  async getClients(search?: string): Promise<Client[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${BASE_URL}/clients${query}`);
    if (!res.ok) throw new Error('Erro ao buscar clientes');
    return res.json();
  },

  async createClient(client: Partial<Client>): Promise<Client> {
    const res = await fetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    });
    if (!res.ok) throw new Error('Erro ao cadastrar cliente');
    return res.json();
  },

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    const res = await fetch(`${BASE_URL}/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    });
    if (!res.ok) throw new Error('Erro ao atualizar cliente');
    return res.json();
  },

  async deleteClient(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/clients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erro ao excluir cliente');
  },

  // Sales (PDV)
  async getSales(params?: { date_from?: string; date_to?: string; search?: string; limit?: number }): Promise<Sale[]> {
    const query = new URLSearchParams();
    if (params?.date_from) query.append('date_from', params.date_from);
    if (params?.date_to) query.append('date_to', params.date_to);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${BASE_URL}/sales?${query.toString()}`);
    if (!res.ok) throw new Error('Erro ao buscar vendas');
    return res.json();
  },

  async createSale(sale: Partial<Sale>): Promise<Sale> {
    const res = await fetch(`${BASE_URL}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao registrar venda');
    }
    return res.json();
  },

  async cancelSale(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/sales/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao cancelar venda');
    return res.json();
  },

  // Service Orders
  async getServiceOrders(params?: { status?: string; search?: string; priority?: string }): Promise<ServiceOrder[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.priority) query.append('priority', params.priority);

    const res = await fetch(`${BASE_URL}/service-orders?${query.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar Ordens de Serviço');
    return res.json();
  },

  async getServiceOrder(id: string): Promise<ServiceOrder> {
    const res = await fetch(`${BASE_URL}/service-orders/${id}`);
    if (!res.ok) throw new Error('Erro ao buscar OS');
    return res.json();
  },

  async createServiceOrder(os: Partial<ServiceOrder>): Promise<ServiceOrder> {
    const res = await fetch(`${BASE_URL}/service-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(os)
    });
    if (!res.ok) throw new Error('Erro ao criar Ordem de Serviço');
    return res.json();
  },

  async updateServiceOrder(id: string, os: Partial<ServiceOrder>): Promise<ServiceOrder> {
    const res = await fetch(`${BASE_URL}/service-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(os)
    });
    if (!res.ok) throw new Error('Erro ao atualizar Ordem de Serviço');
    return res.json();
  },

  async updateOSStatus(id: string, data: { status: OSStatus; note?: string; operator_name?: string; custom_message?: string }): Promise<{
    success: boolean;
    status: OSStatus;
    message: string;
    whatsappUrl: string;
    phone: string;
  }> {
    const res = await fetch(`${BASE_URL}/service-orders/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao atualizar status da OS');
    return res.json();
  },

  // Cash Register
  async getCashRegister(): Promise<CashRegisterStatus> {
    const res = await fetch(`${BASE_URL}/cash-register/current`);
    if (!res.ok) throw new Error('Erro ao consultar caixa');
    return res.json();
  },

  async openCashRegister(data: { initial_amount: number; operator_name?: string; notes?: string }): Promise<CashRegisterSession> {
    const res = await fetch(`${BASE_URL}/cash-register/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao abrir caixa');
    }
    return res.json();
  },

  async closeCashRegister(data: { final_amount: number; notes?: string }): Promise<CashRegisterSession> {
    const res = await fetch(`${BASE_URL}/cash-register/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao fechar caixa');
    return res.json();
  },

  async addCashMovement(data: { type: 'suprimento' | 'sangria'; amount: number; reason?: string }): Promise<void> {
    const res = await fetch(`${BASE_URL}/cash-register/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao registrar movimentação');
  },

  async getCashSessions(): Promise<CashRegisterSession[]> {
    const res = await fetch(`${BASE_URL}/cash-register/sessions`);
    if (!res.ok) throw new Error('Erro ao buscar histórico do caixa');
    return res.json();
  },

  // Stock logs
  async getStockLogs(params?: { product_id?: string; limit?: number }): Promise<StockLog[]> {
    const query = new URLSearchParams();
    if (params?.product_id) query.append('product_id', params.product_id);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${BASE_URL}/stock-logs?${query.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar histórico de estoque');
    return res.json();
  },

  // Database Backup
  async exportDatabase(): Promise<Blob> {
    const res = await fetch(`${BASE_URL}/db/export`);
    if (!res.ok) throw new Error('Erro ao exportar banco SQLite');
    return res.blob();
  },

  async importDatabase(base64Data: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/db/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data })
    });
    if (!res.ok) throw new Error('Erro ao restaurar banco SQLite');
    return res.json();
  },

  // Network Printer
  async testPrinterNetwork(ip: string, port = 9100): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/printer/test-network`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao testar conexão de rede com a impressora.');
    return data;
  }
};

// Formatting helpers
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string | undefined | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
