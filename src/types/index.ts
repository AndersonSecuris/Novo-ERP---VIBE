export type ProductType = 'product' | 'service' | 'part';

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  category: string;
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  type: ProductType;
  created_at?: string;
  updated_at?: string;
  adjustment_reason?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  cpf?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  quantity: number;
  subtotal: number;
  unit?: string;
  type?: ProductType;
}

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'a_prazo'
  | 'multiplo';

export interface PaymentDetail {
  method: PaymentMethod;
  amount: number;
  installments?: number;
}

export interface Sale {
  id: string;
  sale_number: number;
  client_id?: string;
  client_name: string;
  session_id?: string;
  subtotal: number;
  discount: number;
  addition: number;
  total: number;
  payment_method: PaymentMethod;
  payment_details?: PaymentDetail[];
  amount_paid: number;
  change_amount: number;
  items: SaleItem[];
  status: 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export type OSStatus =
  | 'aguardando_analise'
  | 'em_analise'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'aguardando_peca'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export type OSPriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface OSChecklist {
  screen?: boolean;
  touch?: boolean;
  cameras?: boolean;
  mic?: boolean;
  speaker?: boolean;
  charging?: boolean;
  wifi?: boolean;
  bluetooth?: boolean;
  biometrics?: boolean;
  buttons?: boolean;
  water_damage?: boolean;
  sim_reading?: boolean;
  flash?: boolean;
  nfc?: boolean;
  sensor_proximity?: boolean;
  notes?: string;
}

export interface OSPhoto {
  id: string;
  url: string;
  timestamp: string;
  type: 'entry' | 'repair' | 'exit';
  caption?: string;
}

export interface OSPart {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
}

export interface OSServiceItem {
  name: string;
  price: number;
}

export interface OSHistoryEvent {
  timestamp: string;
  status: OSStatus;
  note: string;
  operator: string;
}

export interface ServiceOrder {
  id: string;
  os_number: number;
  client_id: string;
  client_name: string;
  client_phone: string;
  client_cpf?: string;
  client_email?: string;
  device_type: 'smartphone' | 'tablet' | 'smartwatch' | 'notebook' | 'outro';
  device_brand: string;
  device_model: string;
  device_color?: string;
  device_imei?: string;
  device_serial?: string;
  device_password?: string;
  device_pattern_lock?: string;
  device_accessories: string[];
  device_condition?: string;
  reported_defect: string;
  technical_diagnosis?: string;
  technical_solution?: string;
  checklist_in: OSChecklist;
  checklist_out: OSChecklist;
  photos: OSPhoto[];
  parts_used: OSPart[];
  services_done: OSServiceItem[];
  parts_cost: number;
  services_cost: number;
  discount: number;
  total: number;
  status: OSStatus;
  priority: OSPriority;
  technician_name?: string;
  warranty_terms?: string;
  history: OSHistoryEvent[];
  estimated_delivery?: string;
  created_at: string;
  updated_at: string;
}

export interface CashRegisterSession {
  id: string;
  opened_at: string;
  closed_at?: string;
  initial_amount: number;
  final_amount?: number;
  status: 'open' | 'closed';
  operator_name?: string;
  notes?: string;
}

export type CashRegister = CashRegisterSession;

export interface CashMovement {
  id: string;
  session_id: string;
  type: 'suprimento' | 'sangria';
  amount: number;
  reason?: string;
  created_at: string;
}

export interface CashRegisterStatus {
  session: CashRegisterSession | null;
  movements: CashMovement[];
  salesCount: number;
  salesSummary: {
    totalSales: number;
    cashSales: number;
    pixSales: number;
    cardSales: number;
    otherSales: number;
    suprimentos: number;
    sangrias: number;
    calculatedExpectedCash: number;
  } | null;
}

export interface StoreSettings {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  city_state?: string;
  receipt_footer?: string;
  os_terms?: string;
  printer_width: '58mm' | '80mm';
  printer_connection?: 'dialog' | 'webusb' | 'webserial' | 'webbluetooth' | 'network' | 'electron';
  printer_ip?: string;
  printer_port?: number;
  printer_baud_rate?: number;
  printer_cut_paper?: boolean;
  printer_open_drawer?: boolean;
  printer_codepage?: string;
  printer_model?: string;
  pix_key?: string;
  pix_key_type?: string;
  pix_beneficiary?: string;
  whatsapp_templates?: Record<OSStatus, string>;
}

export interface StockLog {
  id: string;
  product_id: string;
  product_name: string;
  change_qty: number;
  previous_stock: number;
  new_stock: number;
  type: 'sale' | 'os_part' | 'manual_entry' | 'manual_exit' | 'adjustment';
  reference_id?: string;
  reason?: string;
  created_at: string;
}

export interface ElectronAPI {
  isDesktop: boolean;
  platform?: string;
  minimize: () => Promise<void>;
  maximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  toggleFullScreen: () => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  printThermalReceipt: (options?: { silent?: boolean; deviceName?: string; width?: string }) => Promise<{ success: boolean; error?: string }>;
  saveBackupDialog: (defaultName?: string) => Promise<{ canceled: boolean; filePath?: string } | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
