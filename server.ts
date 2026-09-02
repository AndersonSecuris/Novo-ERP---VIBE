import express from 'express';
import path from 'path';
import cors from 'cors';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import {
  initDatabase,
  queryAll,
  queryOne,
  runQuery,
  saveDatabase,
  getDatabaseBuffer,
  loadDatabaseFromBuffer
} from './server/db.ts';

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = queryOne('SELECT * FROM store_settings WHERE id = ?', ['default']);
      if (settings && typeof settings.whatsapp_templates === 'string') {
        try {
          settings.whatsapp_templates = JSON.parse(settings.whatsapp_templates);
        } catch {
          // ignore parse error
        }
      }
      res.json(settings || {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const s = req.body;
      const templatesStr = typeof s.whatsapp_templates === 'object' ? JSON.stringify(s.whatsapp_templates) : s.whatsapp_templates;

      runQuery(
        `UPDATE store_settings SET
          name = ?, cnpj = ?, phone = ?, whatsapp = ?, address = ?, city_state = ?,
          receipt_footer = ?, os_terms = ?, printer_width = ?,
          printer_connection = ?, printer_ip = ?, printer_port = ?, printer_baud_rate = ?, printer_serial_port = ?,
          printer_cut_paper = ?, printer_open_drawer = ?, printer_codepage = ?, printer_model = ?,
          pix_key = ?, pix_key_type = ?, pix_beneficiary = ?, whatsapp_templates = ?
        WHERE id = 'default'`,
        [
          s.name, s.cnpj, s.phone, s.whatsapp, s.address, s.city_state,
          s.receipt_footer, s.os_terms, s.printer_width || '80mm',
          s.printer_connection || 'dialog', s.printer_ip || null, Number(s.printer_port || 9100),
          Number(s.printer_baud_rate || 9600), s.printer_serial_port || 'COM1',
          s.printer_cut_paper ? 1 : 0, s.printer_open_drawer ? 1 : 0,
          s.printer_codepage || 'epson', s.printer_model || 'generic',
          s.pix_key, s.pix_key_type, s.pix_beneficiary, templatesStr
        ]
      );
      res.json({ success: true, message: 'Configurações salvas com sucesso' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Printer Direct Network Print (TCP Socket Port 9100)
  app.post('/api/printer/network-print', (req, res) => {
    const { ip, port = 9100, buffer } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Endereço IP da impressora é obrigatório.' });
    }
    if (!buffer) {
      return res.status(400).json({ error: 'Buffer de impressão não fornecido.' });
    }

    try {
      const rawData = Buffer.from(buffer, 'base64');
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(Number(port) || 9100, ip, () => {
        client.write(rawData, () => {
          client.end();
          res.json({ success: true, message: `Dados enviados com sucesso para a impressora ${ip}:${port}` });
        });
      });

      client.on('error', (err) => {
        client.destroy();
        res.status(500).json({ error: `Erro de conexão TCP com a impressora: ${err.message}` });
      });

      client.on('timeout', () => {
        client.destroy();
        res.status(504).json({ error: `Tempo limite de conexão esgotado (Timeout) ao conectar em ${ip}:${port}` });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Falha no processamento do buffer de impressão.' });
    }
  });

  // Printer Network Ping/Connection Test
  app.post('/api/printer/test-network', (req, res) => {
    const { ip, port = 9100 } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'Endereço IP da impressora é obrigatório.' });
    }

    const socket = new net.Socket();
    socket.setTimeout(4000);

    socket.connect(Number(port) || 9100, ip, () => {
      socket.end();
      res.json({ success: true, message: `Conexão bem sucedida com a impressora ${ip}:${port}!` });
    });

    socket.on('error', (err) => {
      socket.destroy();
      res.status(500).json({ error: `Falha ao alcançar a porta ${port} no IP ${ip}: ${err.message}` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      res.status(504).json({ error: `Timeout: A impressora no IP ${ip}:${port} não respondeu.` });
    });
  });

  // Products
  app.get('/api/products', (req, res) => {
    try {
      const { search, category, type, low_stock } = req.query;
      let sql = 'SELECT * FROM products WHERE 1=1';
      const params: any[] = [];

      if (search) {
        sql += ' AND (name LIKE ? OR barcode LIKE ? OR sku LIKE ?)';
        const queryTerm = `%${search}%`;
        params.push(queryTerm, queryTerm, queryTerm);
      }
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      if (low_stock === 'true') {
        sql += ' AND stock <= min_stock AND type != "service"';
      }

      sql += ' ORDER BY name ASC';
      const products = queryAll(sql, params);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', (req, res) => {
    try {
      const p = req.body;
      const id = p.id || 'prod-' + Date.now();
      const now = new Date().toISOString();

      runQuery(
        `INSERT INTO products (id, name, barcode, sku, category, cost_price, sale_price, stock, min_stock, unit, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, p.name, p.barcode || null, p.sku || null, p.category || 'Geral',
          Number(p.cost_price || 0), Number(p.sale_price || 0), Number(p.stock || 0),
          Number(p.min_stock || 0), p.unit || 'UN', p.type || 'product', now, now
        ]
      );

      // Log initial stock if > 0
      if (Number(p.stock) > 0) {
        runQuery(
          `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'log-' + Date.now(), id, p.name, Number(p.stock), 0, Number(p.stock),
            'manual_entry', 'Cadastro inicial de produto', now
          ]
        );
      }

      const created = queryOne('SELECT * FROM products WHERE id = ?', [id]);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      const p = req.body;
      const now = new Date().toISOString();
      const existing = queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      const prevStock = existing.stock;
      const newStock = Number(p.stock);

      runQuery(
        `UPDATE products SET
          name = ?, barcode = ?, sku = ?, category = ?, cost_price = ?, sale_price = ?,
          stock = ?, min_stock = ?, unit = ?, type = ?, updated_at = ?
         WHERE id = ?`,
        [
          p.name, p.barcode || null, p.sku || null, p.category || 'Geral',
          Number(p.cost_price || 0), Number(p.sale_price || 0), newStock,
          Number(p.min_stock || 0), p.unit || 'UN', p.type || 'product', now, id
        ]
      );

      if (prevStock !== newStock) {
        runQuery(
          `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'log-' + Date.now(), id, p.name, (newStock - prevStock), prevStock, newStock,
            'adjustment', p.adjustment_reason || 'Ajuste manual de cadastro', now
          ]
        );
      }

      const updated = queryOne('SELECT * FROM products WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/:id/adjust-stock', (req, res) => {
    try {
      const { id } = req.params;
      const { change_qty, reason, type } = req.body;
      const existing = queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      const prevStock = existing.stock;
      const newStock = Math.max(0, prevStock + Number(change_qty));
      const now = new Date().toISOString();

      runQuery('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, now, id]);

      runQuery(
        `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'log-' + Date.now(), id, existing.name, Number(change_qty), prevStock, newStock,
          type || (Number(change_qty) > 0 ? 'manual_entry' : 'manual_exit'),
          reason || 'Ajuste de estoque', now
        ]
      );

      const updated = queryOne('SELECT * FROM products WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const { id } = req.params;
      runQuery('DELETE FROM products WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Clients
  app.get('/api/clients', (req, res) => {
    try {
      const { search } = req.query;
      let sql = 'SELECT * FROM clients WHERE 1=1';
      const params: any[] = [];

      if (search) {
        sql += ' AND (name LIKE ? OR phone LIKE ? OR cpf LIKE ?)';
        const queryTerm = `%${search}%`;
        params.push(queryTerm, queryTerm, queryTerm);
      }

      sql += ' ORDER BY name ASC';
      const clients = queryAll(sql, params);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/clients', (req, res) => {
    try {
      const c = req.body;
      const id = c.id || 'cli-' + Date.now();
      const now = new Date().toISOString();

      runQuery(
        `INSERT INTO clients (id, name, phone, cpf, email, address, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, c.name, c.phone, c.cpf || null, c.email || null, c.address || null, c.notes || null, now]
      );

      const created = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/clients/:id', (req, res) => {
    try {
      const { id } = req.params;
      const c = req.body;

      runQuery(
        `UPDATE clients SET name = ?, phone = ?, cpf = ?, email = ?, address = ?, notes = ?
         WHERE id = ?`,
        [c.name, c.phone, c.cpf || null, c.email || null, c.address || null, c.notes || null, id]
      );

      const updated = queryOne('SELECT * FROM clients WHERE id = ?', [id]);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/clients/:id', (req, res) => {
    try {
      const { id } = req.params;
      runQuery('DELETE FROM clients WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cash Register Sessions
  app.get('/api/cash-register/current', (req, res) => {
    try {
      const session = queryOne<any>("SELECT * FROM cash_register_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1");
      if (!session) {
        return res.json({ session: null, movements: [], salesSummary: null });
      }

      const movements = queryAll('SELECT * FROM cash_movements WHERE session_id = ? ORDER BY created_at ASC', [session.id]);
      const sales = queryAll<any>("SELECT * FROM sales WHERE session_id = ? AND status = 'completed'", [session.id]);

      let totalSales = 0;
      let cashSales = 0;
      let pixSales = 0;
      let cardSales = 0;
      let otherSales = 0;

      for (const sale of sales) {
        totalSales += sale.total;
        if (sale.payment_method === 'dinheiro') cashSales += sale.total;
        else if (sale.payment_method === 'pix') pixSales += sale.total;
        else if (sale.payment_method.includes('cartao')) cardSales += sale.total;
        else otherSales += sale.total;
      }

      let suprimentos = 0;
      let sangrias = 0;
      for (const m of movements) {
        if (m.type === 'suprimento') suprimentos += m.amount;
        if (m.type === 'sangria') sangrias += m.amount;
      }

      const calculatedExpectedCash = session.initial_amount + suprimentos - sangrias + cashSales;

      res.json({
        session,
        movements,
        salesCount: sales.length,
        salesSummary: {
          totalSales,
          cashSales,
          pixSales,
          cardSales,
          otherSales,
          suprimentos,
          sangrias,
          calculatedExpectedCash
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cash-register/open', (req, res) => {
    try {
      const { initial_amount, operator_name, notes } = req.body;
      const existing = queryOne("SELECT * FROM cash_register_sessions WHERE status = 'open'");
      if (existing) {
        return res.status(400).json({ error: 'Já existe um caixa aberto no momento' });
      }

      const id = 'session-' + Date.now();
      const now = new Date().toISOString();

      runQuery(
        `INSERT INTO cash_register_sessions (id, opened_at, initial_amount, status, operator_name, notes)
         VALUES (?, ?, ?, 'open', ?, ?)`,
        [id, now, Number(initial_amount || 0), operator_name || 'Operador', notes || null]
      );

      const created = queryOne('SELECT * FROM cash_register_sessions WHERE id = ?', [id]);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cash-register/close', (req, res) => {
    try {
      const { final_amount, notes } = req.body;
      const session = queryOne<any>("SELECT * FROM cash_register_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1");
      if (!session) {
        return res.status(400).json({ error: 'Nenhum caixa aberto para fechar' });
      }

      const now = new Date().toISOString();
      runQuery(
        `UPDATE cash_register_sessions SET closed_at = ?, final_amount = ?, status = 'closed', notes = ?
         WHERE id = ?`,
        [now, Number(final_amount), notes || session.notes, session.id]
      );

      const closed = queryOne('SELECT * FROM cash_register_sessions WHERE id = ?', [session.id]);
      res.json(closed);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cash-register/movement', (req, res) => {
    try {
      const { type, amount, reason } = req.body;
      const session = queryOne<any>("SELECT * FROM cash_register_sessions WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1");
      if (!session) {
        return res.status(400).json({ error: 'Caixa fechado. Abra o caixa primeiro.' });
      }

      const id = 'mov-' + Date.now();
      const now = new Date().toISOString();

      runQuery(
        `INSERT INTO cash_movements (id, session_id, type, amount, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, session.id, type, Number(amount), reason || '', now]
      );

      res.status(201).json({ success: true, movementId: id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cash-register/sessions', (req, res) => {
    try {
      const sessions = queryAll('SELECT * FROM cash_register_sessions ORDER BY opened_at DESC LIMIT 30');
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sales (PDV)
  app.get('/api/sales', (req, res) => {
    try {
      const { date_from, date_to, search } = req.query;
      let sql = 'SELECT * FROM sales WHERE 1=1';
      const params: any[] = [];

      if (date_from) {
        sql += ' AND created_at >= ?';
        params.push(date_from);
      }
      if (date_to) {
        sql += ' AND created_at <= ?';
        params.push(date_to);
      }
      if (search) {
        sql += ' AND (client_name LIKE ? OR sale_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY created_at DESC LIMIT 200';
      const sales = queryAll(sql, params).map((sale: any) => {
        try {
          sale.items = JSON.parse(sale.items);
        } catch {}
        try {
          sale.payment_details = JSON.parse(sale.payment_details || '[]');
        } catch {}
        return sale;
      });

      res.json(sales);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales', (req, res) => {
    try {
      const sale = req.body;
      const now = new Date().toISOString();
      const saleId = 'sale-' + Date.now();

      // Find current active session
      const activeSession = queryOne<any>("SELECT id FROM cash_register_sessions WHERE status = 'open' LIMIT 1");
      const sessionId = sale.session_id || (activeSession ? activeSession.id : null);

      // Get next sale number
      const maxSale = queryOne<any>('SELECT MAX(sale_number) as max_num FROM sales');
      const saleNumber = (maxSale?.max_num || 1000) + 1;

      const items = Array.isArray(sale.items) ? sale.items : [];
      const itemsJson = JSON.stringify(items);
      const paymentDetailsJson = JSON.stringify(sale.payment_details || []);

      runQuery(
        `INSERT INTO sales (
          id, sale_number, client_id, client_name, session_id, subtotal, discount, addition,
          total, payment_method, payment_details, amount_paid, change_amount, items,
          status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
        [
          saleId, saleNumber, sale.client_id || null, sale.client_name || 'Consumidor Final',
          sessionId, Number(sale.subtotal || 0), Number(sale.discount || 0), Number(sale.addition || 0),
          Number(sale.total || 0), sale.payment_method || 'dinheiro', paymentDetailsJson,
          Number(sale.amount_paid || sale.total), Number(sale.change_amount || 0), itemsJson,
          sale.notes || null, now
        ]
      );

      // Deduct inventory and log movements for product items
      for (const item of items) {
        if (item.productId) {
          const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [item.productId]);
          if (product && product.type !== 'service') {
            const prevStock = product.stock;
            const newStock = Math.max(0, prevStock - Number(item.quantity || 1));

            runQuery('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, now, item.productId]);

            runQuery(
              `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reference_id, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'sale', ?, ?, ?)`,
              [
                'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                item.productId, product.name, -Number(item.quantity || 1), prevStock, newStock,
                saleId, `Venda PDV #${saleNumber}`, now
              ]
            );
          }
        }
      }

      const createdSale = queryOne<any>('SELECT * FROM sales WHERE id = ?', [saleId]);
      if (createdSale) {
        createdSale.items = items;
        createdSale.payment_details = sale.payment_details;
      }

      res.status(201).json(createdSale);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales/:id/cancel', (req, res) => {
    try {
      const { id } = req.params;
      const sale = queryOne<any>('SELECT * FROM sales WHERE id = ?', [id]);
      if (!sale) {
        return res.status(404).json({ error: 'Venda não encontrada' });
      }

      if (sale.status === 'cancelled') {
        return res.status(400).json({ error: 'Venda já está cancelada' });
      }

      const now = new Date().toISOString();
      runQuery("UPDATE sales SET status = 'cancelled' WHERE id = ?", [id]);

      // Revert inventory
      try {
        const items = JSON.parse(sale.items);
        for (const item of items) {
          if (item.productId) {
            const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [item.productId]);
            if (product && product.type !== 'service') {
              const prevStock = product.stock;
              const newStock = prevStock + Number(item.quantity || 1);

              runQuery('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, now, item.productId]);

              runQuery(
                `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reference_id, reason, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'adjustment', ?, ?, ?)`,
                [
                  'log-' + Date.now(),
                  item.productId, product.name, Number(item.quantity || 1), prevStock, newStock,
                  id, `Cancelamento de Venda #${sale.sale_number}`, now
                ]
              );
            }
          }
        }
      } catch (err) {
        console.error('Error reverting inventory on sale cancellation:', err);
      }

      res.json({ success: true, message: 'Venda cancelada e estoque revertido' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Service Orders (Ordens de Serviço)
  app.get('/api/service-orders', (req, res) => {
    try {
      const { status, search, priority } = req.query;
      let sql = 'SELECT * FROM service_orders WHERE 1=1';
      const params: any[] = [];

      if (status && status !== 'all') {
        sql += ' AND status = ?';
        params.push(status);
      }
      if (priority && priority !== 'all') {
        sql += ' AND priority = ?';
        params.push(priority);
      }
      if (search) {
        sql += ' AND (client_name LIKE ? OR os_number LIKE ? OR device_model LIKE ? OR device_imei LIKE ? OR client_phone LIKE ?)';
        const queryTerm = `%${search}%`;
        params.push(queryTerm, queryTerm, queryTerm, queryTerm, queryTerm);
      }

      sql += ' ORDER BY updated_at DESC LIMIT 300';
      const osList = queryAll(sql, params).map((os: any) => {
        try { os.device_accessories = JSON.parse(os.device_accessories || '[]'); } catch {}
        try { os.checklist_in = JSON.parse(os.checklist_in || '{}'); } catch {}
        try { os.checklist_out = JSON.parse(os.checklist_out || '{}'); } catch {}
        try { os.photos = JSON.parse(os.photos || '[]'); } catch {}
        try { os.parts_used = JSON.parse(os.parts_used || '[]'); } catch {}
        try { os.services_done = JSON.parse(os.services_done || '[]'); } catch {}
        try { os.history = JSON.parse(os.history || '[]'); } catch {}
        return os;
      });

      res.json(osList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/service-orders/:id', (req, res) => {
    try {
      const { id } = req.params;
      const os = queryOne<any>('SELECT * FROM service_orders WHERE id = ? OR os_number = ?', [id, id]);
      if (!os) {
        return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
      }

      try { os.device_accessories = JSON.parse(os.device_accessories || '[]'); } catch {}
      try { os.checklist_in = JSON.parse(os.checklist_in || '{}'); } catch {}
      try { os.checklist_out = JSON.parse(os.checklist_out || '{}'); } catch {}
      try { os.photos = JSON.parse(os.photos || '[]'); } catch {}
      try { os.parts_used = JSON.parse(os.parts_used || '[]'); } catch {}
      try { os.services_done = JSON.parse(os.services_done || '[]'); } catch {}
      try { os.history = JSON.parse(os.history || '[]'); } catch {}

      res.json(os);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/service-orders', (req, res) => {
    try {
      const os = req.body;
      const id = os.id || 'os-' + Date.now();
      const now = new Date().toISOString();

      // Next OS Number
      const maxOS = queryOne<any>('SELECT MAX(os_number) as max_num FROM service_orders');
      const osNumber = (maxOS?.max_num || 1000) + 1;

      const history = [
        {
          timestamp: now,
          status: os.status || 'aguardando_analise',
          note: os.initial_note || 'Ordem de serviço aberta',
          operator: os.operator_name || 'Atendente'
        }
      ];

      const partsUsed = Array.isArray(os.parts_used) ? os.parts_used : [];

      runQuery(
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
          id, osNumber, os.client_id || 'cli-generic', os.client_name, os.client_phone, os.client_cpf || null, os.client_email || null,
          os.device_type || 'smartphone', os.device_brand, os.device_model, os.device_color || null, os.device_imei || null, os.device_serial || null,
          os.device_password || null, os.device_pattern_lock || null, JSON.stringify(os.device_accessories || []), os.device_condition || null,
          os.reported_defect, os.technical_diagnosis || null, os.technical_solution || null,
          JSON.stringify(os.checklist_in || {}), JSON.stringify(os.checklist_out || {}),
          JSON.stringify(os.photos || []), JSON.stringify(partsUsed), JSON.stringify(os.services_done || []),
          Number(os.parts_cost || 0), Number(os.services_cost || 0), Number(os.discount || 0), Number(os.total || 0),
          os.status || 'aguardando_analise', os.priority || 'normal', os.technician_name || null,
          os.warranty_terms || 'Garantia de 90 dias conforme Art. 26 CDC', JSON.stringify(history),
          os.estimated_delivery || null, now, now
        ]
      );

      // Auto deduct inventory if parts were attached in creation
      for (const part of partsUsed) {
        if (part.productId) {
          const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [part.productId]);
          if (product && product.type !== 'service') {
            const prevStock = product.stock;
            const newStock = Math.max(0, prevStock - Number(part.quantity || 1));
            runQuery('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, now, part.productId]);
            runQuery(
              `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reference_id, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'os_part', ?, ?, ?)`,
              [
                'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                part.productId, product.name, -Number(part.quantity || 1), prevStock, newStock,
                id, `Peça utilizada na OS #${osNumber}`, now
              ]
            );
          }
        }
      }

      const created = queryOne<any>('SELECT * FROM service_orders WHERE id = ?', [id]);
      if (created) {
        created.device_accessories = os.device_accessories || [];
        created.checklist_in = os.checklist_in || {};
        created.checklist_out = os.checklist_out || {};
        created.photos = os.photos || [];
        created.parts_used = partsUsed;
        created.services_done = os.services_done || [];
        created.history = history;
      }

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/service-orders/:id', (req, res) => {
    try {
      const { id } = req.params;
      const os = req.body;
      const existing = queryOne<any>('SELECT * FROM service_orders WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'OS não encontrada' });
      }

      const now = new Date().toISOString();
      let history = [];
      try {
        history = JSON.parse(existing.history || '[]');
      } catch {}

      if (os.status && os.status !== existing.status) {
        history.push({
          timestamp: now,
          status: os.status,
          note: os.status_note || `Status alterado para ${os.status}`,
          operator: os.operator_name || 'Operador'
        });
      } else if (os.status_note) {
        history.push({
          timestamp: now,
          status: existing.status,
          note: os.status_note,
          operator: os.operator_name || 'Operador'
        });
      }

      // Check for newly added parts to deduct from stock
      let existingParts: any[] = [];
      try { existingParts = JSON.parse(existing.parts_used || '[]'); } catch {}
      const newParts = Array.isArray(os.parts_used) ? os.parts_used : [];

      for (const part of newParts) {
        const alreadyExists = existingParts.some(ep => ep.productId === part.productId);
        if (!alreadyExists && part.productId) {
          const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [part.productId]);
          if (product && product.type !== 'service') {
            const prevStock = product.stock;
            const newStock = Math.max(0, prevStock - Number(part.quantity || 1));
            runQuery('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [newStock, now, part.productId]);
            runQuery(
              `INSERT INTO stock_logs (id, product_id, product_name, change_qty, previous_stock, new_stock, type, reference_id, reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'os_part', ?, ?, ?)`,
              [
                'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                part.productId, product.name, -Number(part.quantity || 1), prevStock, newStock,
                id, `Peça adicionada na OS #${existing.os_number}`, now
              ]
            );
          }
        }
      }

      runQuery(
        `UPDATE service_orders SET
          client_id = ?, client_name = ?, client_phone = ?, client_cpf = ?, client_email = ?,
          device_type = ?, device_brand = ?, device_model = ?, device_color = ?, device_imei = ?, device_serial = ?,
          device_password = ?, device_pattern_lock = ?, device_accessories = ?, device_condition = ?,
          reported_defect = ?, technical_diagnosis = ?, technical_solution = ?,
          checklist_in = ?, checklist_out = ?, photos = ?, parts_used = ?, services_done = ?,
          parts_cost = ?, services_cost = ?, discount = ?, total = ?,
          status = ?, priority = ?, technician_name = ?, warranty_terms = ?,
          history = ?, estimated_delivery = ?, updated_at = ?
         WHERE id = ?`,
        [
          os.client_id || existing.client_id, os.client_name || existing.client_name, os.client_phone || existing.client_phone,
          os.client_cpf || existing.client_cpf, os.client_email || existing.client_email,
          os.device_type || existing.device_type, os.device_brand || existing.device_brand, os.device_model || existing.device_model,
          os.device_color || existing.device_color, os.device_imei || existing.device_imei, os.device_serial || existing.device_serial,
          os.device_password || existing.device_password, os.device_pattern_lock || existing.device_pattern_lock,
          JSON.stringify(os.device_accessories || []), os.device_condition || existing.device_condition,
          os.reported_defect || existing.reported_defect, os.technical_diagnosis || existing.technical_diagnosis,
          os.technical_solution || existing.technical_solution,
          JSON.stringify(os.checklist_in || {}), JSON.stringify(os.checklist_out || {}),
          JSON.stringify(os.photos || []), JSON.stringify(newParts), JSON.stringify(os.services_done || []),
          Number(os.parts_cost ?? existing.parts_cost), Number(os.services_cost ?? existing.services_cost),
          Number(os.discount ?? existing.discount), Number(os.total ?? existing.total),
          os.status || existing.status, os.priority || existing.priority, os.technician_name || existing.technician_name,
          os.warranty_terms || existing.warranty_terms, JSON.stringify(history),
          os.estimated_delivery || existing.estimated_delivery, now, id
        ]
      );

      const updated = queryOne<any>('SELECT * FROM service_orders WHERE id = ?', [id]);
      if (updated) {
        try { updated.device_accessories = JSON.parse(updated.device_accessories || '[]'); } catch {}
        try { updated.checklist_in = JSON.parse(updated.checklist_in || '{}'); } catch {}
        try { updated.checklist_out = JSON.parse(updated.checklist_out || '{}'); } catch {}
        try { updated.photos = JSON.parse(updated.photos || '[]'); } catch {}
        try { updated.parts_used = JSON.parse(updated.parts_used || '[]'); } catch {}
        try { updated.services_done = JSON.parse(updated.services_done || '[]'); } catch {}
        try { updated.history = JSON.parse(updated.history || '[]'); } catch {}
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // OS Update Status + WhatsApp notification generator
  app.post('/api/service-orders/:id/status', (req, res) => {
    try {
      const { id } = req.params;
      const { status, note, operator_name, custom_message } = req.body;
      const os = queryOne<any>('SELECT * FROM service_orders WHERE id = ?', [id]);
      if (!os) {
        return res.status(404).json({ error: 'OS não encontrada' });
      }

      const now = new Date().toISOString();
      let history = [];
      try { history = JSON.parse(os.history || '[]'); } catch {}

      history.push({
        timestamp: now,
        status,
        note: note || `Status alterado para ${status}`,
        operator: operator_name || 'Operador'
      });

      runQuery(
        'UPDATE service_orders SET status = ?, history = ?, updated_at = ? WHERE id = ?',
        [status, JSON.stringify(history), now, id]
      );

      // Get settings for whatsapp message
      const settings = queryOne<any>('SELECT * FROM store_settings WHERE id = "default"');
      let templates: any = {};
      if (settings && settings.whatsapp_templates) {
        try { templates = JSON.parse(settings.whatsapp_templates); } catch {}
      }

      const storeName = settings?.name || 'TechCell Assistência';
      let message = custom_message || templates[status] || `Olá {cliente}, atualizamos sua OS #{os_numero} para o status: ${status}.`;

      message = message
        .replace(/\{cliente\}/g, os.client_name || 'Cliente')
        .replace(/\{os_numero\}/g, os.os_number?.toString() || id)
        .replace(/\{aparelho\}/g, `${os.device_brand} ${os.device_model}`)
        .replace(/\{loja\}/g, storeName)
        .replace(/\{valor\}/g, Number(os.total || 0).toFixed(2).replace('.', ','))
        .replace(/\{diagnostico\}/g, os.technical_diagnosis || os.reported_defect || 'Em análise');

      // Clean phone number for WhatsApp link
      const rawPhone = (os.client_phone || '').replace(/\D/g, '');
      const fullPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
      const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

      res.json({
        success: true,
        status,
        message,
        whatsappUrl,
        phone: os.client_phone
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stock logs
  app.get('/api/stock-logs', (req, res) => {
    try {
      const { product_id, limit } = req.query;
      let sql = 'SELECT * FROM stock_logs WHERE 1=1';
      const params: any[] = [];

      if (product_id) {
        sql += ' AND product_id = ?';
        params.push(product_id);
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(Number(limit || 100));

      const logs = queryAll(sql, params);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SQLite Database Export & Import (Windows backup support)
  app.get('/api/db/export', (req, res) => {
    try {
      const buffer = getDatabaseBuffer();
      res.setHeader('Content-Type', 'application/x-sqlite3');
      res.setHeader('Content-Disposition', `attachment; filename="pdv_backup_${new Date().toISOString().split('T')[0]}.sqlite"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/db/import', (req, res) => {
    try {
      const { base64Data } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: 'Dados base64 do SQLite não fornecidos' });
      }
      const buffer = Buffer.from(base64Data, 'base64');
      loadDatabaseFromBuffer(buffer);
      res.json({ success: true, message: 'Banco de dados SQLite restaurado com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vite Middleware or Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PDV & Assistência Técnica Pro rodando em http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
