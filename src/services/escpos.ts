import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { Sale, ServiceOrder, StoreSettings, CashRegisterStatus } from '../types';
import { formatCurrency, formatDateTime } from './api';

export interface PrinterDeviceStatus {
  connected: boolean;
  type?: 'webusb' | 'webserial' | 'webbluetooth' | 'network' | 'electron' | 'dialog';
  deviceName?: string;
  error?: string;
}

// Stored USB / Serial device reference in memory for fast re-prints
let activeUsbDevice: any = null;
let activeSerialPort: any = null;
let activeBluetoothDevice: any = null;

/**
 * Strips or maps special accents to ASCII if needed for legacy printers
 */
function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics for universal ESC/POS hardware safety
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

/**
 * Creates and configures an ESC/POS encoder instance
 */
export function createEncoder(settings: StoreSettings): any {
  const is58mm = settings.printer_width === '58mm';
  const columns = is58mm ? 32 : 48;

  try {
    const encoder = new ReceiptPrinterEncoder({
      language: 'esc-pos',
      width: columns,
      codepageMapping: (settings.printer_codepage as any) || 'epson',
      autoFlush: false
    });
    return encoder;
  } catch (e) {
    console.warn('Fallback initializing basic receipt printer encoder', e);
    return new ReceiptPrinterEncoder({
      language: 'esc-pos',
      width: columns
    });
  }
}

/**
 * 1. Encode Sale Receipt to raw ESC/POS binary buffer
 */
export function encodeSaleReceipt(sale: Sale, settings: StoreSettings): Uint8Array {
  const is58mm = settings.printer_width === '58mm';
  const cols = is58mm ? 32 : 48;
  const encoder = createEncoder(settings);

  encoder.initialize();

  // Store Header
  encoder.align('center');
  encoder.bold(true).size(2, 2).line(sanitizeText(settings.name || 'TECHCELL')).size(1, 1).bold(false);
  
  if (settings.cnpj) encoder.line(`CNPJ: ${sanitizeText(settings.cnpj)}`);
  if (settings.address) encoder.line(sanitizeText(settings.address));
  if (settings.phone) encoder.line(`TEL: ${sanitizeText(settings.phone)}`);
  
  encoder.rule({ style: 'single' });
  encoder.bold(true).line('CUPOM NAO FISCAL - VENDA').bold(false);
  encoder.line(`CUPOM: #${String(sale.sale_number).padStart(5, '0')}  ${formatDateTime(sale.created_at)}`);
  
  if (sale.client_name) {
    encoder.align('left').line(`CLIENTE: ${sanitizeText(sale.client_name)}`);
  }
  
  encoder.rule({ style: 'single' });

  // Column headers & items
  encoder.align('left');
  if (is58mm) {
    // 32 columns compact layout
    encoder.line('ITEM DESC            QTD   VALOR');
    encoder.rule({ style: 'single' });
    sale.items.forEach((item, index) => {
      const idx = String(index + 1).padStart(2, '0');
      const name = sanitizeText(item.name).substring(0, 15).padEnd(15);
      const qty = String(item.quantity).padStart(2);
      const totalStr = formatCurrency(item.subtotal).replace('R$', '').trim().padStart(8);
      encoder.line(`${idx} ${name} ${qty}x${totalStr}`);
    });
  } else {
    // 48 columns standard layout
    encoder.line('ITEM  DESCRICAO           QTD  UN   V.UNIT   TOTAL');
    encoder.rule({ style: 'single' });
    sale.items.forEach((item, index) => {
      const idx = String(index + 1).padStart(2, '0');
      const name = sanitizeText(item.name).substring(0, 18).padEnd(18);
      const qty = String(item.quantity).padStart(3);
      const unit = sanitizeText(item.unit || 'UN').substring(0, 2).padEnd(2);
      const unitVal = formatCurrency(item.price).replace('R$', '').trim().padStart(7);
      const totVal = formatCurrency(item.subtotal).replace('R$', '').trim().padStart(8);
      encoder.line(`${idx} ${name} ${qty} ${unit} ${unitVal} ${totVal}`);
    });
  }

  encoder.rule({ style: 'single' });

  // Totals
  encoder.align('right');
  encoder.line(`SUBTOTAL: ${formatCurrency(sale.subtotal)}`);
  if (sale.discount > 0) {
    encoder.line(`DESCONTO: -${formatCurrency(sale.discount)}`);
  }
  if (sale.addition > 0) {
    encoder.line(`ACRESCIMO: +${formatCurrency(sale.addition)}`);
  }
  
  encoder.bold(true).size(1, 2).line(`TOTAL: ${formatCurrency(sale.total)}`).size(1, 1).bold(false);
  encoder.rule({ style: 'single' });

  // Payment details
  encoder.align('left');
  const paymentMap: Record<string, string> = {
    dinheiro: 'DINHEIRO',
    pix: 'PIX',
    cartao_credito: 'CARTAO CREDITO',
    cartao_debito: 'CARTAO DEBITO',
    a_prazo: 'A PRAZO / FIADO',
    multiplo: 'MULTIPLOS PAGAMENTOS'
  };
  encoder.line(`PAGAMENTO: ${paymentMap[sale.payment_method] || sale.payment_method.toUpperCase()}`);

  if (sale.payment_method === 'dinheiro') {
    encoder.line(`VALOR PAGO:  ${formatCurrency(sale.amount_paid)}`);
    encoder.line(`TROCO:       ${formatCurrency(sale.change_amount)}`);
  }

  if (sale.payment_details && sale.payment_details.length > 0) {
    sale.payment_details.forEach(p => {
      encoder.line(`- ${paymentMap[p.method] || p.method}: ${formatCurrency(p.amount)}`);
    });
  }

  // Barcode with Sale Number
  encoder.newline();
  encoder.align('center');
  try {
    const paddedNum = String(sale.sale_number).padStart(8, '0');
    encoder.barcode(paddedNum, 'code128', 45);
    encoder.line(`* ${paddedNum} *`);
  } catch {
    // If barcode not supported on specific codepage
  }

  // Footer note
  if (settings.receipt_footer) {
    encoder.newline();
    encoder.line(sanitizeText(settings.receipt_footer));
  }

  encoder.newline();
  encoder.line('SISTEMA TECHCELL PDV');

  // Pulse cash drawer on cash sale if configured
  if (settings.printer_open_drawer || sale.payment_method === 'dinheiro') {
    try {
      encoder.pulse(0, 50, 250);
    } catch {
      // ignore
    }
  }

  // Cut Paper
  encoder.newline().newline().newline();
  if (settings.printer_cut_paper !== false) {
    encoder.cut('partial');
  }

  return encoder.encode();
}

/**
 * 2. Encode Service Order (OS) Entry or Delivery Receipt to ESC/POS binary buffer
 */
export function encodeOSReceipt(os: ServiceOrder, settings: StoreSettings, mode: 'entry' | 'delivery' = 'entry'): Uint8Array {
  const is58mm = settings.printer_width === '58mm';
  const encoder = createEncoder(settings);

  encoder.initialize();

  // Store Header
  encoder.align('center');
  encoder.bold(true).size(2, 2).line(sanitizeText(settings.name || 'TECHCELL ASSISTENCIA')).size(1, 1).bold(false);
  
  if (settings.cnpj) encoder.line(`CNPJ: ${sanitizeText(settings.cnpj)}`);
  if (settings.address) encoder.line(sanitizeText(settings.address));
  if (settings.phone) encoder.line(`TEL: ${sanitizeText(settings.phone)}`);
  
  encoder.rule({ style: 'single' });
  encoder.bold(true);
  if (mode === 'entry') {
    encoder.line('COMPROVANTE DE ENTRADA DE OS');
  } else {
    encoder.line('COMPROVANTE DE ENTREGA E GARANTIA');
  }
  encoder.bold(false);
  
  encoder.line(`OS NUMERO: #${String(os.os_number).padStart(5, '0')}`);
  encoder.line(`DATA: ${formatDateTime(os.created_at)}`);
  encoder.rule({ style: 'single' });

  // Client info
  encoder.align('left');
  encoder.bold(true).line('DADOS DO CLIENTE:').bold(false);
  encoder.line(`NOME: ${sanitizeText(os.client_name)}`);
  encoder.line(`FONE: ${sanitizeText(os.client_phone)}`);
  if (os.client_cpf) encoder.line(`CPF: ${sanitizeText(os.client_cpf)}`);
  encoder.rule({ style: 'single' });

  // Device info
  encoder.bold(true).line('DADOS DO APARELHO:').bold(false);
  encoder.line(`EQUIPAMENTO: ${sanitizeText(os.device_brand)} ${sanitizeText(os.device_model)}`);
  if (os.device_color) encoder.line(`COR: ${sanitizeText(os.device_color)}`);
  if (os.device_imei) encoder.line(`IMEI/SERIAL: ${sanitizeText(os.device_imei)}`);
  if (os.device_password) encoder.line(`SENHA: ${sanitizeText(os.device_password)}`);
  if (os.device_condition) encoder.line(`ESTADO: ${sanitizeText(os.device_condition)}`);
  
  if (os.device_accessories && os.device_accessories.length > 0) {
    encoder.line(`ACESSORIOS: ${sanitizeText(os.device_accessories.join(', '))}`);
  }

  encoder.rule({ style: 'single' });
  encoder.bold(true).line('DEFEITO RECLAMADO:').bold(false);
  encoder.line(sanitizeText(os.reported_defect));

  if (os.technical_diagnosis) {
    encoder.rule({ style: 'single' });
    encoder.bold(true).line('DIAGNOSTICO TECNICO:').bold(false);
    encoder.line(sanitizeText(os.technical_diagnosis));
  }

  // Parts & Services itemized
  if ((os.parts_used && os.parts_used.length > 0) || (os.services_done && os.services_done.length > 0)) {
    encoder.rule({ style: 'single' });
    encoder.bold(true).line('PECAS & SERVICOS:').bold(false);
    
    os.parts_used?.forEach(p => {
      encoder.line(`- ${sanitizeText(p.name)} (${p.quantity}x) : ${formatCurrency(p.unitPrice * p.quantity)}`);
    });
    os.services_done?.forEach(s => {
      encoder.line(`- ${sanitizeText(s.name)} : ${formatCurrency(s.price)}`);
    });
  }

  encoder.rule({ style: 'single' });
  encoder.align('right');
  encoder.bold(true).size(1, 2).line(`VALOR TOTAL: ${formatCurrency(os.total)}`).size(1, 1).bold(false);
  
  encoder.rule({ style: 'single' });
  encoder.align('left');
  encoder.bold(true).line('TERMO DE GARANTIA & CONDICOES:').bold(false);
  const terms = sanitizeText(settings.os_terms || 'Garantia legal de 90 dias conforme Art. 26 do CDC para os servicos executados.');
  encoder.line(terms);

  // Signature line
  encoder.newline().newline();
  encoder.align('center');
  encoder.line('____________________________________');
  encoder.line('Assinatura do Cliente');

  // Barcode with OS number
  encoder.newline();
  try {
    const osBarcode = String(os.os_number).padStart(8, '0');
    encoder.barcode(osBarcode, 'code128', 40);
    encoder.line(`* OS #${os.os_number} *`);
  } catch {}

  // Cut Paper
  encoder.newline().newline().newline();
  if (settings.printer_cut_paper !== false) {
    encoder.cut('partial');
  }

  return encoder.encode();
}

/**
 * 3. Encode Cash Register Closing / Movement Report to ESC/POS binary buffer
 */
export function encodeCashRegisterReceipt(status: CashRegisterStatus, settings: StoreSettings): Uint8Array {
  const encoder = createEncoder(settings);
  const session = status.session;
  const summary = status.salesSummary;

  encoder.initialize();
  encoder.align('center');
  encoder.bold(true).size(2, 2).line(sanitizeText(settings.name || 'TECHCELL')).size(1, 1).bold(false);
  encoder.rule({ style: 'single' });
  encoder.bold(true).line('FECHAMENTO DE CAIXA').bold(false);
  encoder.line(`DATA: ${formatDateTime(new Date().toISOString())}`);
  if (session?.operator_name) {
    encoder.line(`OPERADOR: ${sanitizeText(session.operator_name)}`);
  }
  encoder.rule({ style: 'single' });

  encoder.align('left');
  encoder.line(`ABERTURA:    ${formatDateTime(session?.opened_at)}`);
  encoder.line(`VALOR INICIAL: ${formatCurrency(session?.initial_amount || 0)}`);
  encoder.rule({ style: 'single' });

  if (summary) {
    encoder.bold(true).line('RESUMO DE VENDAS:').bold(false);
    encoder.line(`- DINHEIRO:       ${formatCurrency(summary.cashSales)}`);
    encoder.line(`- PIX:            ${formatCurrency(summary.pixSales)}`);
    encoder.line(`- CARTAO / OUTRO: ${formatCurrency(summary.cardSales + summary.otherSales)}`);
    encoder.line(`TOTAL VENDAS (${status.salesCount}): ${formatCurrency(summary.totalSales)}`);
    encoder.rule({ style: 'single' });

    encoder.bold(true).line('MOVIMENTACOES:').bold(false);
    encoder.line(`(+) SUPRIMENTOS:  ${formatCurrency(summary.suprimentos)}`);
    encoder.line(`(-) SANGRIA:      ${formatCurrency(summary.sangrias)}`);
    encoder.rule({ style: 'single' });

    encoder.align('right');
    encoder.bold(true).size(1, 2).line(`TOTAL EM GAVETA: ${formatCurrency(summary.calculatedExpectedCash)}`).size(1, 1).bold(false);
  }

  encoder.newline().newline();
  encoder.align('center');
  encoder.line('____________________________________');
  encoder.line('Assinatura do Responsavel');

  encoder.newline().newline().newline();
  if (settings.printer_cut_paper !== false) {
    encoder.cut('partial');
  }

  return encoder.encode();
}

/**
 * 4. Encode Diagnostic Test Receipt (Hardware & ESC/POS verification)
 */
export function encodeTestReceipt(settings: StoreSettings): Uint8Array {
  const encoder = createEncoder(settings);
  encoder.initialize();

  encoder.align('center');
  encoder.bold(true).size(2, 2).line('TESTE ESC/POS OK').size(1, 1).bold(false);
  encoder.line('BIBLIOTECA ESC/POS ATIVA');
  encoder.line(`LARGURA: ${settings.printer_width || '80mm'}`);
  encoder.rule({ style: 'double' });

  encoder.align('left');
  encoder.line('1. Alinhamento: Esquerda');
  encoder.align('center');
  encoder.line('2. Alinhamento: Centralizado');
  encoder.align('right');
  encoder.line('3. Alinhamento: Direita');

  encoder.rule({ style: 'single' });
  encoder.align('left');
  encoder.bold(true).line('4. TEXTO NEGRITO ATIVADO').bold(false);
  encoder.underline(true).line('5. Texto Sublinhado Ativado').underline(false);
  encoder.size(2, 2).line('6. Altura e Largura Dupla').size(1, 1);

  encoder.rule({ style: 'single' });
  encoder.align('center');
  encoder.line('7. Codigo de Barras Code128:');
  try {
    encoder.barcode('12345678', 'code128', 40);
  } catch {}

  encoder.line('8. Codigo QR Code ESC/POS:');
  try {
    encoder.qrcode('https://techcellpro.com.br');
  } catch {}

  encoder.rule({ style: 'single' });
  encoder.line('COMPATIBILIDADE TERMICA:');
  encoder.line('Bematech, Elgin, Epson, Daruma, POS-58, POS-80');
  encoder.line(`Data/Hora: ${formatDateTime(new Date().toISOString())}`);

  // Test pulse cash drawer
  try {
    encoder.pulse(0, 50, 250);
  } catch {}

  encoder.newline().newline().newline();
  encoder.cut('full');

  return encoder.encode();
}

/**
 * 5. Encode Cash Drawer Pulse Command (ESC p)
 */
export function encodeCashDrawerPulse(): Uint8Array {
  // ESC p 0 25 250 (pin 2, pulse on 50ms, pulse off 500ms)
  return new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
}

/**
 * -------------------------------------------------------------
 * HARDWARE DRIVERS (WebUSB, WebSerial, WebBluetooth, Network, Electron)
 * -------------------------------------------------------------
 */

/**
 * Prints buffer directly via WebUSB
 */
export async function printViaWebUsb(buffer: Uint8Array): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('usb' in navigator)) {
    throw new Error('Navegador sem suporte a WebUSB (Recomendado: Google Chrome, Microsoft Edge ou Opera)');
  }

  try {
    let device = activeUsbDevice;
    if (!device || !device.opened) {
      try {
        // Request device filter for thermal printers (Class 7 = Printer) or open selector
        device = await (navigator as any).usb.requestDevice({
          filters: [{ classCode: 7 }]
        }).catch(async () => {
          // Fallback: show all USB devices in picker
          return await (navigator as any).usb.requestDevice({ filters: [] });
        });
        activeUsbDevice = device;
      } catch (usbPromptErr: any) {
        if (
          usbPromptErr.name === 'NotFoundError' ||
          usbPromptErr.message?.includes('No device selected') ||
          usbPromptErr.message?.includes('cancelled')
        ) {
          return {
            success: false,
            error: 'Nenhuma impressora USB foi selecionada no diálogo do navegador (operação cancelada).'
          };
        }
        throw usbPromptErr;
      }
    }

    if (!device) {
      return { success: false, error: 'Nenhuma impressora USB selecionada.' };
    }

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find printer interface or interface 0
    let printerInterface = device.configuration.interfaces.find((i: any) =>
      i.alternates.some((a: any) => a.interfaceClass === 7)
    );
    if (!printerInterface) {
      printerInterface = device.configuration.interfaces[0];
    }

    if (!printerInterface) {
      return { success: false, error: 'Interface de impressora USB não encontrada.' };
    }

    const ifaceNumber = printerInterface.interfaceNumber;
    await device.claimInterface(ifaceNumber);

    // Find OUT bulk endpoint
    const alternate = printerInterface.alternates.find((a: any) => a.interfaceClass === 7) || printerInterface.alternates[0];
    const outEndpoint = alternate.endpoints.find((e: any) => e.direction === 'out');

    if (!outEndpoint) {
      return { success: false, error: 'Endpoint de saída USB não encontrado.' };
    }

    // Transfer in chunks of 512 bytes for maximum hardware stability
    const chunkSize = 512;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      await device.transferOut(outEndpoint.endpointNumber, chunk);
    }

    return {
      success: true,
      deviceName: device.productName || device.manufacturerName || 'Impressora USB ESC/POS'
    };
  } catch (err: any) {
    console.error('WebUSB error:', err);
    if (
      err.name === 'NotFoundError' ||
      err.message?.includes('No device selected') ||
      err.message?.includes('cancelled')
    ) {
      return {
        success: false,
        error: 'Nenhuma impressora USB foi selecionada no diálogo do navegador (operação cancelada).'
      };
    }
    return { success: false, error: err.message || 'Erro de comunicação USB.' };
  }
}

/**
 * Web Serial (COM) Device and Port Selection Helpers
 */
export interface SerialPortInfo {
  port: any;
  index: number;
  label: string;
  usbVendorId?: number;
  usbProductId?: number;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function formatSerialPortLabel(port: any, index?: number): string {
  if (!port) return 'Nenhuma porta selecionada';
  try {
    const info = typeof port.getInfo === 'function' ? port.getInfo() : {};
    const vid = info.usbVendorId ? `VID: 0x${info.usbVendorId.toString(16).toUpperCase().padStart(4, '0')}` : '';
    const pid = info.usbProductId ? `PID: 0x${info.usbProductId.toString(16).toUpperCase().padStart(4, '0')}` : '';
    const details = [vid, pid].filter(Boolean).join(' ');
    if (details) {
      return index !== undefined ? `Porta #${index + 1} (${details})` : `Dispositivo Serial (${details})`;
    }
    return index !== undefined ? `Porta Serial #${index + 1}` : 'Porta Serial Padrão';
  } catch {
    return index !== undefined ? `Porta Serial #${index + 1}` : 'Porta Serial Conectada';
  }
}

export async function getAuthorizedSerialPorts(): Promise<SerialPortInfo[]> {
  if (!isWebSerialSupported()) return [];
  try {
    const ports: any[] = await (navigator as any).serial.getPorts();
    return ports.map((port, index) => ({
      port,
      index,
      label: formatSerialPortLabel(port, index),
      usbVendorId: port.getInfo?.().usbVendorId,
      usbProductId: port.getInfo?.().usbProductId
    }));
  } catch (err) {
    console.warn('Erro ao obter portas seriais autorizadas:', err);
    return [];
  }
}

export async function requestSerialPort(): Promise<SerialPortInfo | null> {
  if (!isWebSerialSupported()) {
    throw new Error('Navegador sem suporte a Web Serial (Recomendado: Google Chrome, Microsoft Edge ou Opera).');
  }
  try {
    const port = await (navigator as any).serial.requestPort();
    if (!port) return null;
    activeSerialPort = port;
    const label = formatSerialPortLabel(port);
    return {
      port,
      index: 0,
      label,
      usbVendorId: port.getInfo?.().usbVendorId,
      usbProductId: port.getInfo?.().usbProductId
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('No port selected')) {
      return null;
    }
    throw err;
  }
}

export function getActiveSerialPort(): any {
  return activeSerialPort;
}

export function setActiveSerialPort(port: any): void {
  activeSerialPort = port;
}

export function clearActiveSerialPort(): void {
  activeSerialPort = null;
}

export function getActiveSerialPortLabel(): string | null {
  if (!activeSerialPort) return null;
  return formatSerialPortLabel(activeSerialPort);
}

/**
 * Prints buffer directly via Web Serial (COM Port)
 */
export async function printViaWebSerial(
  buffer: Uint8Array,
  baudRate = 9600,
  targetPort?: any
): Promise<{ success: boolean; portName?: string; error?: string }> {
  if (!isWebSerialSupported()) {
    throw new Error('Navegador sem suporte a Web Serial (Recomendado: Google Chrome, Microsoft Edge ou Opera)');
  }

  try {
    let port = targetPort || activeSerialPort;

    // Check if browser already has authorized ports and none is selected yet
    if (!port) {
      const authorized = await (navigator as any).serial.getPorts().catch(() => []);
      if (authorized && authorized.length > 0) {
        port = authorized[0];
        activeSerialPort = port;
      }
    }

    // If still no port, prompt user to pick from OS serial ports
    if (!port) {
      if (typeof window !== 'undefined' && window.self !== window.top) {
        return {
          success: false,
          error: 'O navegador restringe a seleção de portas seriais dentro de janelas incorporadas (iframe). Abra o sistema em uma nova aba do navegador para comunicação Serial direta, ou utilize o método "Diálogo do Windows" (100% compatível).'
        };
      }
      try {
        port = await (navigator as any).serial.requestPort();
        activeSerialPort = port;
      } catch (reqErr: any) {
        if (
          reqErr.name === 'NotFoundError' ||
          reqErr.message?.includes('No port selected') ||
          reqErr.message?.includes('requestPort')
        ) {
          return {
            success: false,
            error: 'Nenhuma porta serial foi selecionada na janela do navegador (seleção cancelada). Por favor, conecte a impressora e confirme a porta desejada no diálogo.'
          };
        }
        if (reqErr.name === 'SecurityError') {
          return {
            success: false,
            error: 'Acesso à porta serial bloqueado pelo navegador. Caso esteja utilizando o sistema incorporado em um iframe, abra em uma nova aba.'
          };
        }
        throw reqErr;
      }
    }

    if (!port) {
      return { success: false, error: 'Nenhuma porta Serial / COM selecionada.' };
    }

    const portName = formatSerialPortLabel(port);

    let shouldClose = false;
    if (!port.readable) {
      await port.open({
        baudRate: Number(baudRate) || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      shouldClose = true;
    }

    const writer = port.writable.getWriter();
    try {
      await writer.write(buffer);
    } finally {
      writer.releaseLock();
      if (shouldClose) {
        await port.close();
      }
    }

    return { success: true, portName };
  } catch (err: any) {
    console.error('WebSerial error:', err);
    if (
      err.name === 'NotFoundError' ||
      err.message?.includes('No port selected') ||
      err.message?.includes('requestPort')
    ) {
      return {
        success: false,
        error: 'Nenhuma porta serial foi selecionada na janela do navegador (seleção cancelada). Conecte a impressora e selecione a porta no diálogo.'
      };
    }
    if (err.name === 'SecurityError') {
      return {
        success: false,
        error: 'Permissão para portas seriais bloqueada pelo navegador. Se estiver em iframe, abra o sistema em uma nova aba.'
      };
    }
    if (err.name === 'NetworkError' || err.message?.includes('Failed to open')) {
      return {
        success: false,
        error: `Não foi possível abrir a porta serial a ${baudRate} bps. Verifique se a porta já está em uso por outro programa ou tente desligar e religar a impressora.`
      };
    }
    return { success: false, error: err.message || 'Erro de comunicação Serial / COM.' };
  }
}

/**
 * Prints buffer directly via Web Bluetooth (Portable 58mm/80mm printers)
 */
export async function printViaWebBluetooth(buffer: Uint8Array): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!('bluetooth' in navigator)) {
    throw new Error('Navegador sem suporte a Web Bluetooth.');
  }

  try {
    let device = activeBluetoothDevice;
    if (!device || !device.gatt?.connected) {
      try {
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS service
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            0xffe0,
            0x18f0,
            0x49535343
          ]
        });
        activeBluetoothDevice = device;
      } catch (btPromptErr: any) {
        if (
          btPromptErr.name === 'NotFoundError' ||
          btPromptErr.message?.includes('User cancelled') ||
          btPromptErr.message?.includes('No device selected')
        ) {
          return {
            success: false,
            error: 'Nenhuma impressora Bluetooth foi selecionada no diálogo do navegador (busca cancelada).'
          };
        }
        throw btPromptErr;
      }
    }

    if (!device) {
      return { success: false, error: 'Nenhuma impressora Bluetooth selecionada.' };
    }

    const server = await device.gatt.connect();
    
    // Find primary service and writable characteristic
    let printCharacteristic: any = null;
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          printCharacteristic = char;
          break;
        }
      }
      if (printCharacteristic) break;
    }

    if (!printCharacteristic) {
      return { success: false, error: 'Característica de impressão Bluetooth não encontrada.' };
    }

    // Send in 20-byte chunks for Bluetooth BLE MTU limit
    const chunkSize = 20;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      if (printCharacteristic.properties.writeWithoutResponse) {
        await printCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await printCharacteristic.writeValue(chunk);
      }
    }

    return {
      success: true,
      deviceName: device.name || 'Impressora Bluetooth Térmica'
    };
  } catch (err: any) {
    console.error('WebBluetooth error:', err);
    return { success: false, error: err.message || 'Erro de conexão Bluetooth.' };
  }
}

/**
 * Prints buffer directly to Network / Ethernet / Wi-Fi IP (TCP Port 9100)
 */
export async function printViaNetwork(buffer: Uint8Array, ip: string, port = 9100): Promise<{ success: boolean; error?: string }> {
  try {
    const base64Buffer = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
    const res = await fetch('/api/printer/network-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, buffer: base64Buffer })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao enviar dados para a impressora de rede.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Network print error:', err);
    return { success: false, error: err.message || 'Erro ao conectar à impressora na rede.' };
  }
}

/**
 * Universal Print Execution Dispatcher:
 * Tries the selected transport method or falls back smoothly
 */
export async function printEscPosUniversal(
  buffer: Uint8Array,
  settings: StoreSettings,
  preferredType?: 'webusb' | 'webserial' | 'webbluetooth' | 'network' | 'electron' | 'dialog',
  options?: { serialPort?: any }
): Promise<{ success: boolean; mode: string; message: string; deviceName?: string }> {
  const type = preferredType || settings.printer_connection || 'dialog';

  // 1. Electron Desktop Native Print
  if (type === 'electron' || (window.electronAPI?.isDesktop && type !== 'webusb' && type !== 'webserial')) {
    try {
      const res = await window.electronAPI!.printThermalReceipt({
        silent: true,
        width: settings.printer_width
      });
      if (res.success) {
        return { success: true, mode: 'electron', message: 'Cupom enviado para a impressora padrão do Windows.' };
      }
    } catch (e) {
      console.warn('Electron direct print fallback', e);
    }
  }

  // 2. WebUSB Direct
  if (type === 'webusb') {
    const res = await printViaWebUsb(buffer);
    if (res.success) {
      return {
        success: true,
        mode: 'webusb',
        deviceName: res.deviceName,
        message: `Impresso via USB Direto (${res.deviceName || 'ESC/POS'}).`
      };
    }
    throw new Error(res.error || 'Falha ao imprimir via USB.');
  }

  // 3. Web Serial (COM)
  if (type === 'webserial') {
    const res = await printViaWebSerial(buffer, settings.printer_baud_rate || 9600, options?.serialPort);
    if (res.success) {
      const portDesc = res.portName || settings.printer_serial_port || 'COM';
      return {
        success: true,
        mode: 'webserial',
        deviceName: portDesc,
        message: `Impresso com sucesso via Porta Serial (${portDesc}) a ${settings.printer_baud_rate || 9600} bps.`
      };
    }
    throw new Error(res.error || 'Falha ao imprimir via Porta Serial.');
  }

  // 4. Web Bluetooth
  if (type === 'webbluetooth') {
    const res = await printViaWebBluetooth(buffer);
    if (res.success) {
      return {
        success: true,
        mode: 'webbluetooth',
        deviceName: res.deviceName,
        message: `Impresso via Bluetooth (${res.deviceName || 'ESC/POS'}).`
      };
    }
    throw new Error(res.error || 'Falha ao imprimir via Bluetooth.');
  }

  // 5. Network / TCP
  if (type === 'network') {
    if (!settings.printer_ip) {
      throw new Error('Endereço IP da impressora não configurado nas Configurações.');
    }
    const res = await printViaNetwork(buffer, settings.printer_ip, settings.printer_port || 9100);
    if (res.success) {
      return {
        success: true,
        mode: 'network',
        message: `Impresso via Rede IP ${settings.printer_ip}:${settings.printer_port || 9100}.`
      };
    }
    throw new Error(res.error || 'Falha ao imprimir via rede.');
  }

  // 6. Standard Browser Print Dialog Fallback with Thermal Roll Formatting
  const textReceipt = generateTestReceiptText(settings);
  await printThermalReceiptViaBrowser(textReceipt, settings);
  return {
    success: true,
    mode: 'dialog',
    message: 'Diálogo de impressão padrão do sistema acionado com formatação térmica.'
  };
}

/**
 * Generates formatted plain-text receipt for thermal testing
 */
export function generateTestReceiptText(settings: StoreSettings): string {
  const is58mm = settings.printer_width === '58mm';
  const width = is58mm ? 32 : 48;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);
  const store = (settings.name || 'TECHCELL').toUpperCase();

  const centerText = (str: string) => {
    if (str.length >= width) return str.substring(0, width);
    const pad = Math.floor((width - str.length) / 2);
    return ' '.repeat(pad) + str;
  };

  const rightText = (str: string) => {
    if (str.length >= width) return str.substring(0, width);
    return ' '.repeat(width - str.length) + str;
  };

  return [
    doubleDivider,
    centerText(store),
    settings.cnpj ? centerText(`CNPJ: ${settings.cnpj}`) : '',
    settings.address ? centerText(settings.address) : '',
    settings.phone ? centerText(`TEL: ${settings.phone}`) : '',
    doubleDivider,
    centerText('TESTE DE IMPRESSAO ESC/POS'),
    centerText(`LARGURA: ${settings.printer_width || '80mm'} (${width} colunas)`),
    centerText(`DATA: ${formatDateTime(new Date().toISOString())}`),
    divider,
    '1. Alinhamento: Esquerda',
    centerText('2. Alinhamento: Centralizado'),
    rightText('3. Alinhamento: Direita'),
    divider,
    '4. TEXTO NEGRITO E DESTACADO',
    '5. TESTE DE BOBINA TERMICA OK',
    divider,
    is58mm ? '01 CABO USB-C          1x  25,00' : '01 CABO USB-C           1  UN    25,00   25,00',
    is58mm ? '02 PELICULA 3D         1x  15,00' : '02 PELICULA 3D          1  UN    15,00   15,00',
    divider,
    rightText('TOTAL TESTE: R$ 40,00'),
    doubleDivider,
    centerText('COMPATIBILIDADE TERMICA:'),
    centerText('Bematech, Elgin, Epson, Daruma, POS-80'),
    doubleDivider,
    centerText(settings.receipt_footer || 'Obrigado pela preferencia!'),
    centerText('SISTEMA TECHCELL PDV'),
    '\n- - - - - - CORTE AQUI - - - - - -'
  ].filter(Boolean).join('\n');
}

/**
 * Prints thermal receipt via the browser print dialog, scoping styles to the thermal paper roll
 */
export function printThermalReceiptViaBrowser(
  receiptText: string,
  settings: StoreSettings
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const is58mm = settings.printer_width === '58mm';
      const widthMm = is58mm ? '48mm' : '72mm';
      const containerId = 'thermal-print-container';
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
      }

      const escaped = receiptText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      container.innerHTML = `
        <style id="thermal-print-style">
          @media screen {
            #${containerId} { display: none !important; }
          }
          @media print {
            @page {
              margin: 0 !important;
              size: auto;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }
            body * {
              visibility: hidden !important;
            }
            #${containerId}, #${containerId} * {
              visibility: visible !important;
            }
            #${containerId} {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: ${widthMm} !important;
              max-width: ${widthMm} !important;
              margin: 0 !important;
              padding: 2mm 1.5mm !important;
              box-sizing: border-box !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: ${is58mm ? '9.5px' : '11px'} !important;
              line-height: 1.25 !important;
              color: #000 !important;
              white-space: pre-wrap !important;
              word-break: break-all !important;
            }
          }
        </style>
        <pre style="margin: 0; font-family: inherit; font-size: inherit; white-space: pre-wrap; word-break: break-word;">${escaped}</pre>
      `;

      setTimeout(() => {
        try {
          window.print();
          resolve({ success: true });
        } catch (e: any) {
          resolve({ success: false, error: e.message });
        } finally {
          setTimeout(() => {
            if (container && container.parentNode) {
              container.parentNode.removeChild(container);
            }
          }, 2000);
        }
      }, 100);
    } catch (err: any) {
      resolve({ success: false, error: err.message || 'Erro ao abrir janela de impressão.' });
    }
  });
}

/**
 * Downloads raw ESC/POS binary file for DOSPrint, Spooler, RawBT or command prompt copy
 */
export function downloadRawEscPosFile(buffer: Uint8Array, filename = 'cupom_escpos.bin') {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
