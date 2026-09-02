import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pdv_database.sqlite');

let db: Database;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('📦 Loaded existing SQLite database from:', DB_FILE);
    } catch (err) {
      console.error('⚠️ Could not load existing DB, creating a new one:', err);
      db = new SQL.Database();
    }
  } else {
    console.log('✨ Creating new SQLite database...');
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cnpj TEXT,
      phone TEXT,
      whatsapp TEXT,
      address TEXT,
      city_state TEXT,
      receipt_footer TEXT,
      os_terms TEXT,
      printer_width TEXT DEFAULT '80mm',
      printer_connection TEXT DEFAULT 'dialog',
      printer_ip TEXT,
      printer_port INTEGER DEFAULT 9100,
      printer_baud_rate INTEGER DEFAULT 9600,
      printer_cut_paper INTEGER DEFAULT 1,
      printer_open_drawer INTEGER DEFAULT 0,
      printer_codepage TEXT DEFAULT 'epson',
      printer_model TEXT DEFAULT 'generic',
      pix_key TEXT,
      pix_key_type TEXT,
      pix_beneficiary TEXT,
      whatsapp_templates TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      sku TEXT,
      category TEXT,
      cost_price REAL DEFAULT 0,
      sale_price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit TEXT DEFAULT 'UN',
      type TEXT DEFAULT 'product', -- 'product', 'service', 'part'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      cpf TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_register_sessions (
      id TEXT PRIMARY KEY,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      initial_amount REAL NOT NULL,
      final_amount REAL,
      status TEXT DEFAULT 'open', -- 'open', 'closed'
      operator_name TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'suprimento', 'sangria'
      amount REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      sale_number INTEGER,
      client_id TEXT,
      client_name TEXT,
      session_id TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      addition REAL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details TEXT,
      amount_paid REAL,
      change_amount REAL,
      items TEXT NOT NULL, -- JSON array of sale items
      status TEXT DEFAULT 'completed', -- 'completed', 'cancelled'
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      os_number INTEGER,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_cpf TEXT,
      client_email TEXT,
      device_type TEXT DEFAULT 'smartphone',
      device_brand TEXT NOT NULL,
      device_model TEXT NOT NULL,
      device_color TEXT,
      device_imei TEXT,
      device_serial TEXT,
      device_password TEXT,
      device_pattern_lock TEXT,
      device_accessories TEXT, -- JSON array
      device_condition TEXT,
      reported_defect TEXT NOT NULL,
      technical_diagnosis TEXT,
      technical_solution TEXT,
      checklist_in TEXT, -- JSON object
      checklist_out TEXT, -- JSON object
      photos TEXT, -- JSON array
      parts_used TEXT, -- JSON array
      services_done TEXT, -- JSON array
      parts_cost REAL DEFAULT 0,
      services_cost REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'aguardando_analise',
      priority TEXT DEFAULT 'normal',
      technician_name TEXT,
      warranty_terms TEXT,
      history TEXT, -- JSON array
      estimated_delivery TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      change_qty INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'sale', 'os_part', 'manual_entry', 'manual_exit', 'adjustment'
      reference_id TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Safe migrations for newly added store_settings columns
  const newCols = [
    { name: 'printer_connection', type: "TEXT DEFAULT 'dialog'" },
    { name: 'printer_ip', type: 'TEXT' },
    { name: 'printer_port', type: 'INTEGER DEFAULT 9100' },
    { name: 'printer_baud_rate', type: 'INTEGER DEFAULT 9600' },
    { name: 'printer_cut_paper', type: 'INTEGER DEFAULT 1' },
    { name: 'printer_open_drawer', type: 'INTEGER DEFAULT 0' },
    { name: 'printer_codepage', type: "TEXT DEFAULT 'epson'" },
    { name: 'printer_model', type: "TEXT DEFAULT 'generic'" }
  ];

  for (const col of newCols) {
    try {
      db.run(`ALTER TABLE store_settings ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists
    }
  }

  // Seed default store settings if none exist
  const existingSettings = db.exec("SELECT * FROM store_settings WHERE id = 'default'");
  if (existingSettings.length === 0 || existingSettings[0].values.length === 0) {
    const defaultTemplates = JSON.stringify({
      aguardando_analise: "Olá {cliente}! Sua Ordem de Serviço #{os_numero} para o aparelho {aparelho} foi recebida com sucesso na {loja}. Em breve iniciaremos o diagnóstico técnico.",
      em_analise: "Olá {cliente}! Informamos que seu aparelho {aparelho} (OS #{os_numero}) já está na bancada sob análise técnica dos nossos especialistas.",
      aguardando_aprovacao: "Olá {cliente}! O orçamento do seu {aparelho} (OS #{os_numero}) ficou pronto: Total de R$ {valor}. Diagnóstico: {diagnostico}. Podemos iniciar o conserto?",
      aprovado: "Olá {cliente}! Orçamento aprovado para o {aparelho} (OS #{os_numero}). Nossos técnicos já iniciaram o procedimento de reparo.",
      aguardando_peca: "Olá {cliente}! Para a OS #{os_numero} ({aparelho}), estamos aguardando a chegada da peça de reposição original. Avisaremos assim que for instalada.",
      pronto: "🎉 Olá {cliente}! Ótima notícia: seu aparelho {aparelho} (OS #{os_numero}) está PRONTO para retirada na {loja}! Valor final: R$ {valor}. Garantia inclusa.",
      entregue: "Olá {cliente}! Agradecemos pela confiança na {loja}! Seu {aparelho} (OS #{os_numero}) foi entregue. Conte conosco sempre que precisar!",
      cancelado: "Olá {cliente}! A OS #{os_numero} referente ao seu {aparelho} foi cancelada. O aparelho está disponível para retirada na loja."
    });

    db.run(
      `INSERT INTO store_settings (id, name, cnpj, phone, whatsapp, address, city_state, receipt_footer, os_terms, printer_width, pix_key, pix_key_type, pix_beneficiary, whatsapp_templates)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'default',
        'TechCell Assistência & Acessórios',
        '12.345.678/0001-90',
        '(11) 3456-7890',
        '(11) 98765-4321',
        'Av. Paulista, 1000 - Loja 12',
        'São Paulo - SP',
        'Obrigado pela preferência! Volte sempre!\nTrocas somente com este cupom em até 7 dias.',
        'Garantia de 90 dias conforme Art. 26 do CDC para os serviços executados e peças substituídas. A garantia não cobre danos por líquidos, quedas ou intervenções de terceiros. Aparelhos não retirados em até 90 dias após notificação serão descartados conforme termo de serviço.',
        '80mm',
        'contato@techcellpro.com.br',
        'E-mail',
        'TechCell Reparos e Comércio ME',
        defaultTemplates
      ]
    );
  }

  // Seed sample products if none exist
  const existingProducts = db.exec('SELECT COUNT(*) as cnt FROM products');
  const count = existingProducts[0]?.values[0]?.[0] as number;
  if (!count || count === 0) {
    const sampleProducts = [
      {
        id: 'prod-1',
        name: 'Tela Display Frontal iPhone 11 Original China',
        barcode: '789100000001',
        sku: 'TEL-IP11',
        category: 'Telas & Displays',
        cost_price: 95.00,
        sale_price: 240.00,
        stock: 8,
        min_stock: 3,
        unit: 'UN',
        type: 'part'
      },
      {
        id: 'prod-2',
        name: 'Bateria iPhone 11 3110mAh Premium',
        barcode: '789100000002',
        sku: 'BAT-IP11',
        category: 'Baterias',
        cost_price: 45.00,
        sale_price: 150.00,
        stock: 12,
        min_stock: 4,
        unit: 'UN',
        type: 'part'
      },
      {
        id: 'prod-3',
        name: 'Tela Display Frontal Samsung A54 5G OLED',
        barcode: '789100000003',
        sku: 'TEL-A54',
        category: 'Telas & Displays',
        cost_price: 130.00,
        sale_price: 320.00,
        stock: 5,
        min_stock: 2,
        unit: 'UN',
        type: 'part'
      },
      {
        id: 'prod-4',
        name: 'Conector de Carga Sub-Placa Tipo-C Moto G52',
        barcode: '789100000004',
        sku: 'CON-MG52',
        category: 'Conectores & Placas',
        cost_price: 18.00,
        sale_price: 85.00,
        stock: 10,
        min_stock: 3,
        unit: 'UN',
        type: 'part'
      },
      {
        id: 'prod-5',
        name: 'Cabo USB-C para Lightning 20W 1m Reforçado',
        barcode: '789100000005',
        sku: 'CAB-IP20W',
        category: 'Acessórios',
        cost_price: 12.00,
        sale_price: 39.90,
        stock: 35,
        min_stock: 10,
        unit: 'UN',
        type: 'product'
      },
      {
        id: 'prod-6',
        name: 'Carregador Turbo 30W USB-C Bivolt Universal',
        barcode: '789100000006',
        sku: 'CAR-30W',
        category: 'Acessórios',
        cost_price: 22.00,
        sale_price: 69.90,
        stock: 20,
        min_stock: 5,
        unit: 'UN',
        type: 'product'
      },
      {
        id: 'prod-7',
        name: 'Película de Vidro 3D Privacidade Universal',
        barcode: '789100000007',
        sku: 'PEL-PRIV',
        category: 'Acessórios',
        cost_price: 4.50,
        sale_price: 25.00,
        stock: 45,
        min_stock: 10,
        unit: 'UN',
        type: 'product'
      },
      {
        id: 'prod-8',
        name: 'Serviço: Troca de Conector de Carga',
        barcode: 'SRV001',
        sku: 'SRV-CONECT',
        category: 'Mão de Obra',
        cost_price: 0,
        sale_price: 90.00,
        stock: 999,
        min_stock: 0,
        unit: 'SV',
        type: 'service'
      },
      {
        id: 'prod-9',
        name: 'Serviço: Desoxidação e Limpeza Química de Placa',
        barcode: 'SRV002',
        sku: 'SRV-DESOX',
        category: 'Mão de Obra',
        cost_price: 0,
        sale_price: 120.00,
        stock: 999,
        min_stock: 0,
        unit: 'SV',
        type: 'service'
      },
      {
        id: 'prod-10',
        name: 'Serviço: Restauração de Software / Hard Reset',
        barcode: 'SRV003',
        sku: 'SRV-SOFT',
        category: 'Mão de Obra',
        cost_price: 0,
        sale_price: 70.00,
        stock: 999,
        min_stock: 0,
        unit: 'SV',
        type: 'service'
      }
    ];

    const now = new Date().toISOString();
    for (const p of sampleProducts) {
      db.run(
        `INSERT INTO products (id, name, barcode, sku, category, cost_price, sale_price, stock, min_stock, unit, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.barcode, p.sku, p.category, p.cost_price, p.sale_price, p.stock, p.min_stock, p.unit, p.type, now, now]
      );
    }
  }

  // Seed sample clients if none
  const existingClients = db.exec('SELECT COUNT(*) as cnt FROM clients');
  const clientCount = existingClients[0]?.values[0]?.[0] as number;
  if (!clientCount || clientCount === 0) {
    const sampleClients = [
      {
        id: 'cli-1',
        name: 'Carlos Eduardo Silveira',
        phone: '11981234567',
        cpf: '123.456.789-00',
        email: 'carlos.edu@gmail.com',
        address: 'Rua das Flores, 142 - Apto 31',
        notes: 'Cliente frequente. Prefere contato via WhatsApp.'
      },
      {
        id: 'cli-2',
        name: 'Mariana Costa Lima',
        phone: '11972345678',
        cpf: '987.654.321-11',
        email: 'mariana.costa@hotmail.com',
        address: 'Av. Brasil, 850',
        notes: 'Empresarial - Emite nota fiscal quando possível.'
      },
      {
        id: 'cli-3',
        name: 'Roberto Andrade Filho',
        phone: '11993456789',
        cpf: '456.789.123-22',
        email: 'roberto.andrade@empresa.com.br',
        address: 'Rua Bela Cintra, 400',
        notes: 'Cliente particular.'
      }
    ];

    const now = new Date().toISOString();
    for (const c of sampleClients) {
      db.run(
        `INSERT INTO clients (id, name, phone, cpf, email, address, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.phone, c.cpf, c.email, c.address, c.notes, now]
      );
    }
  }

  // Seed sample Service Orders if none
  const existingOS = db.exec('SELECT COUNT(*) as cnt FROM service_orders');
  const osCount = existingOS[0]?.values[0]?.[0] as number;
  if (!osCount || osCount === 0) {
    const now = new Date();
    const isoNow = now.toISOString();

    const sampleOS = [
      {
        id: 'os-1001',
        os_number: 1001,
        client_id: 'cli-1',
        client_name: 'Carlos Eduardo Silveira',
        client_phone: '11981234567',
        client_cpf: '123.456.789-00',
        client_email: 'carlos.edu@gmail.com',
        device_type: 'smartphone',
        device_brand: 'Apple',
        device_model: 'iPhone 11 64GB',
        device_color: 'Preto',
        device_imei: '354892091823901',
        device_serial: 'DX3Z910KLM',
        device_password: '2580',
        device_pattern_lock: '',
        device_accessories: JSON.stringify(['Capinha Anti-impacto', 'Gaveta de Chip']),
        device_condition: 'Vidro frontal quebrado após queda. Carcaça com leves arranhões nas laterais.',
        reported_defect: 'Aparelho caiu no chão, display manchado com listras verticais e touch falhando na parte inferior.',
        technical_diagnosis: 'Display LCD danificado por impacto físico. Conector de carga e bateria em bom estado.',
        technical_solution: 'Substituição completa do módulo frontal (display + touch) e aplicação de película 3D cortesia.',
        checklist_in: JSON.stringify({
          screen: false,
          touch: false,
          cameras: true,
          mic: true,
          speaker: true,
          charging: true,
          wifi: true,
          bluetooth: true,
          biometrics: true,
          buttons: true,
          water_damage: false,
          sim_reading: true
        }),
        checklist_out: JSON.stringify({
          screen: true,
          touch: true,
          cameras: true,
          mic: true,
          speaker: true,
          charging: true,
          wifi: true,
          bluetooth: true,
          biometrics: true,
          buttons: true,
          water_damage: false,
          sim_reading: true
        }),
        photos: JSON.stringify([
          {
            id: 'photo-1',
            url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=60',
            timestamp: isoNow,
            type: 'entry',
            caption: 'Estado de entrada do aparelho: Vidro trincado e display manchado'
          }
        ]),
        parts_used: JSON.stringify([
          { productId: 'prod-1', name: 'Tela Display Frontal iPhone 11 Original China', quantity: 1, unitPrice: 240.00, costPrice: 95.00 }
        ]),
        services_done: JSON.stringify([
          { name: 'Mão de Obra Especializada Troca de Tela', price: 80.00 }
        ]),
        parts_cost: 240.00,
        services_cost: 80.00,
        discount: 20.00,
        total: 300.00,
        status: 'pronto',
        priority: 'alta',
        technician_name: 'Marcos Silva',
        warranty_terms: 'Garantia de 90 dias para a tela instalada.',
        history: JSON.stringify([
          { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'aguardando_analise', note: 'OS Aberta no balcão', operator: 'Balcão 1' },
          { timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'aguardando_aprovacao', note: 'Orçamento gerado e enviado ao cliente', operator: 'Marcos Silva' },
          { timestamp: new Date(Date.now() - 43200000).toISOString(), status: 'aprovado', note: 'Cliente aprovou o orçamento via WhatsApp', operator: 'Balcão 1' },
          { timestamp: isoNow, status: 'pronto', note: 'Serviço finalizado com sucesso. Testes aprovados.', operator: 'Marcos Silva' }
        ]),
        estimated_delivery: new Date(Date.now() + 86400000).toISOString().split('T')[0]
      },
      {
        id: 'os-1002',
        os_number: 1002,
        client_id: 'cli-2',
        client_name: 'Mariana Costa Lima',
        client_phone: '11972345678',
        client_cpf: '987.654.321-11',
        client_email: 'mariana.costa@hotmail.com',
        device_type: 'smartphone',
        device_brand: 'Samsung',
        device_model: 'Galaxy A54 5G',
        device_color: 'Violeta',
        device_imei: '869201948192039',
        device_serial: 'R58T90182K',
        device_password: '',
        device_pattern_lock: '1,2,5,8,9',
        device_accessories: JSON.stringify(['Carregador Original']),
        device_condition: 'Sem marcas externas aparentes. Aparelho não liga e não dá sinal de carga.',
        reported_defect: 'Não carrega mais após colocar em carregador veicular. Esquenta na parte inferior ao plugar.',
        technical_diagnosis: 'Conector Tipo-C em curto e oxidação parcial na sub-placa de carga.',
        technical_solution: '',
        checklist_in: JSON.stringify({
          screen: true,
          touch: true,
          cameras: true,
          mic: true,
          speaker: true,
          charging: false,
          wifi: true,
          bluetooth: true,
          biometrics: true,
          buttons: true,
          water_damage: true,
          sim_reading: true
        }),
        checklist_out: JSON.stringify({}),
        photos: JSON.stringify([]),
        parts_used: JSON.stringify([
          { productId: 'prod-4', name: 'Conector de Carga Sub-Placa Tipo-C Moto G52', quantity: 1, unitPrice: 85.00, costPrice: 18.00 }
        ]),
        services_done: JSON.stringify([
          { name: 'Desoxidação e Solda Conector Carga', price: 90.00 }
        ]),
        parts_cost: 85.00,
        services_cost: 90.00,
        discount: 0,
        total: 175.00,
        status: 'em_analise',
        priority: 'normal',
        technician_name: 'Lucas Ferreira',
        warranty_terms: 'Garantia de 90 dias.',
        history: JSON.stringify([
          { timestamp: isoNow, status: 'aguardando_analise', note: 'OS Aberta com carregador entregue', operator: 'Balcão 1' },
          { timestamp: isoNow, status: 'em_analise', note: 'Iniciado teste com amperímetro', operator: 'Lucas Ferreira' }
        ]),
        estimated_delivery: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
      }
    ];

    for (const os of sampleOS) {
      db.run(
        `INSERT INTO service_orders (
          id, os_number, client_id, client_name, client_phone, client_cpf, client_email,
          device_type, device_brand, device_model, device_color, device_imei, device_serial,
          device_password, device_pattern_lock, device_accessories, device_condition,
          reported_defect, technical_diagnosis, technical_solution, checklist_in, checklist_out,
          photos, parts_used, services_done, parts_cost, services_cost, discount, total,
          status, priority, technician_name, warranty_terms, history, estimated_delivery,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          os.id, os.os_number, os.client_id, os.client_name, os.client_phone, os.client_cpf, os.client_email,
          os.device_type, os.device_brand, os.device_model, os.device_color, os.device_imei, os.device_serial,
          os.device_password, os.device_pattern_lock, os.device_accessories, os.device_condition,
          os.reported_defect, os.technical_diagnosis, os.technical_solution, os.checklist_in, os.checklist_out,
          os.photos, os.parts_used, os.services_done, os.parts_cost, os.services_cost, os.discount, os.total,
          os.status, os.priority, os.technician_name, os.warranty_terms, os.history, os.estimated_delivery,
          isoNow, isoNow
        ]
      );
    }
  }

  // Open active register session if none
  const activeSession = db.exec("SELECT * FROM cash_register_sessions WHERE status = 'open'");
  if (activeSession.length === 0 || activeSession[0].values.length === 0) {
    const sessionId = 'session-' + Date.now();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO cash_register_sessions (id, opened_at, initial_amount, status, operator_name, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, now, 150.00, 'open', 'Operador Principal', 'Fundo de troco inicial']
    );
  }

  saveDatabase();
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database:', err);
  }
}

export function queryAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, any>>(sql: string, params: any[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

export function runQuery(sql: string, params: any[] = []): void {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabase();
}

export function getDatabaseBuffer(): Buffer {
  if (!db) throw new Error('Database not initialized');
  saveDatabase();
  return fs.readFileSync(DB_FILE);
}

export function loadDatabaseFromBuffer(buffer: Buffer): void {
  const SQL = (db as any).constructor;
  db = new SQL(buffer);
  saveDatabase();
}
