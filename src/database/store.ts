import { getDatabase } from '@/database/client';
import { cashBasisProfit } from '@/utils/accounting';
import type {
  CartLine,
  Customer,
  CustomerDetail,
  DaySummary,
  Dashboard,
  Expense,
  PaymentMethod,
  Product,
  ProductPayload,
  ProfitSummary,
  RestockItem,
  Sale,
  SaleItem,
  MutationResult,
  NotificationSummary,
  TrafficRawSlot,
  UtangTransaction,
} from '@/types';

type ProductRow = {
  id: number;
  product_name: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  stock: number;
  category: string;
  unit: string;
  expiry_date: string | null;
  low_stock_threshold: number;
};

type CustomerRow = { id: number; name: string; balance: number; overdue_count: number };
type SaleRow = { id: number; customer_id: number | null; total: number; status: string; created_at: string; due_at: string | null; voided: number; void_reason: string | null };
type SaleItemRow = { id: number; product_id: number | null; description: string; quantity: number; cost_each: number; price_each: number; line_total: number };
type SalePaymentRow = { method: PaymentMethod; amount: number };

const productFromRow = (row: ProductRow): Product => ({
  id: row.id,
  productName: row.product_name,
  barcode: row.barcode,
  costPrice: row.cost_price,
  sellingPrice: row.selling_price,
  stock: row.stock,
  category: row.category,
  unit: row.unit,
  expiryDate: row.expiry_date,
  lowStockThreshold: row.low_stock_threshold,
});

const customerFromRow = (row: CustomerRow): Customer => ({ id: row.id, name: row.name, balance: row.balance, overdueCount: row.overdue_count });

const saleItemFromRow = (row: SaleItemRow): SaleItem => ({
  id: row.id,
  productId: row.product_id,
  description: row.description,
  quantity: row.quantity,
  costEach: row.cost_each,
  priceEach: row.price_each,
  lineTotal: row.line_total,
});

const result = (message: string): MutationResult => ({ success: true, message });
const pesoForMessage = (value: number) => `₱${value.toFixed(2)}`;

const backupSpecs = [
  { name: 'settings', columns: ['key', 'value'] },
  { name: 'products', columns: ['id', 'product_name', 'barcode', 'cost_price', 'selling_price', 'stock', 'category', 'unit', 'expiry_date', 'low_stock_threshold', 'archived_at', 'created_at', 'updated_at'] },
  { name: 'customers', columns: ['id', 'name', 'archived_at', 'created_at'] },
  { name: 'sales', columns: ['id', 'customer_id', 'total', 'paid_amount', 'status', 'created_at', 'paid_at', 'due_at'] },
  { name: 'sale_items', columns: ['id', 'sale_id', 'product_id', 'description', 'quantity', 'cost_each', 'price_each', 'line_total'] },
  { name: 'payments', columns: ['id', 'customer_id', 'amount', 'note', 'created_at'] },
  { name: 'sale_payments', columns: ['id', 'sale_id', 'method', 'amount', 'created_at'] },
  { name: 'expenses', columns: ['id', 'category', 'amount', 'note', 'payment_method', 'created_at'] },
  { name: 'voided_sales', columns: ['sale_id', 'reason', 'created_at'] },
  { name: 'stock_movements', columns: ['id', 'product_id', 'sale_id', 'change_quantity', 'movement_type', 'note', 'created_at'] },
] as const;

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const customerBalance = async (customerId: number) => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ balance: number }>(
    `SELECT COALESCE(SUM(total - paid_amount), 0) AS balance
     FROM sales WHERE customer_id = ? AND status = 'unpaid'`,
    customerId,
  );
  return row?.balance ?? 0;
};

const recordReceipt = async (
  items: CartLine[],
  status: 'paid' | 'unpaid',
  customerId: number | null,
  payments: { method: PaymentMethod; amount: number }[] = [],
  dueAt: string | null = null,
) => {
  if (items.length === 0) throw new Error('Add at least one product.');
  const database = await getDatabase();
  let saleId = 0;
  let total = 0;

  await database.withTransactionAsync(async () => {
    const transaction = database;
    const sale = await transaction.runAsync(
      'INSERT INTO sales (customer_id, total, status, due_at) VALUES (?, 0, ?, ?)',
      customerId,
      status,
      dueAt,
    );
    saleId = sale.lastInsertRowId;

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) continue;
      const product = await transaction.getFirstAsync<ProductRow>('SELECT * FROM products WHERE id = ?', item.productId);
      if (!product) throw new Error(`Product ${item.productId} was not found.`);
      if (product.stock < item.quantity) {
        throw new Error(`Not enough stock for ${product.product_name} (only ${product.stock}).`);
      }
      const lineTotal = product.selling_price * item.quantity;
      total += lineTotal;
      await transaction.runAsync(
        `INSERT INTO sale_items
         (sale_id, product_id, description, quantity, cost_each, price_each, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        saleId,
        product.id,
        product.product_name,
        item.quantity,
        product.cost_price,
        product.selling_price,
        lineTotal,
      );
      const stockUpdate = await transaction.runAsync(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?',
        item.quantity,
        product.id,
        item.quantity,
      );
      if (stockUpdate.changes !== 1) throw new Error(`Could not update stock for ${product.product_name}.`);
      await transaction.runAsync(
        `INSERT INTO stock_movements (product_id, sale_id, change_quantity, movement_type, note)
         VALUES (?, ?, ?, 'sale', ?)`,
        product.id,
        saleId,
        -item.quantity,
        `Sale #${saleId}`,
      );
    }

    if (total <= 0) throw new Error('The receipt has no valid items.');
    if (payments.some((payment) => !Number.isFinite(payment.amount) || payment.amount <= 0)) throw new Error('Enter valid payment amounts.');
    const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (!Number.isFinite(paymentTotal) || paymentTotal < 0) throw new Error('Enter valid payment amounts.');
    if (status === 'paid' && Math.abs(paymentTotal - total) > 0.01) throw new Error('Payment amounts must equal the sale total.');
    if (status === 'unpaid' && paymentTotal >= total) throw new Error('The upfront payment must be less than the sale total.');
    for (const payment of payments) {
      await transaction.runAsync('INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)', saleId, payment.method, payment.amount);
    }
    if (status === 'unpaid' && customerId && paymentTotal > 0) {
      await transaction.runAsync(
        'INSERT INTO payments (customer_id, amount, note) VALUES (?, ?, ?)',
        customerId,
        paymentTotal,
        `Down payment for sale #${saleId}`,
      );
    }
    await transaction.runAsync('UPDATE sales SET total = ?, paid_amount = ? WHERE id = ?', total, paymentTotal, saleId);
  });

  return { saleId, total };
};

export const store = {
  initialize: getDatabase,

  isConfigured: async () => {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'store_name'");
    return Boolean(row?.value.trim());
  },

  completeSetup: async (storeName: string) => {
    const database = await getDatabase();
    await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName.trim());
    return result('Store setup complete.');
  },

  getStoreProfile: async () => {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'store_name'");
    return { storeName: row?.value || 'My Store' };
  },

  updateStoreName: async (storeName: string) => {
    const database = await getDatabase();
    await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName.trim());
    return result('Store name updated.');
  },

  getSetting: async (key: string) => {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
    return row?.value ?? null;
  },

  setSetting: async (key: string, value: string) => {
    const database = await getDatabase();
    await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
    return result('Preference saved.');
  },

  notificationSummary: async (): Promise<NotificationSummary> => {
    const database = await getDatabase();
    const lowStock = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products WHERE archived_at IS NULL AND stock <= low_stock_threshold');
    const expiring = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM products WHERE archived_at IS NULL AND expiry_date IS NOT NULL AND date(expiry_date) <= date('now', '+30 days')",
    );
    const overdue = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sales WHERE status = 'unpaid' AND due_at IS NOT NULL AND date(due_at) < date('now', 'localtime')",
    );
    return { lowStockCount: lowStock?.count ?? 0, expiringCount: expiring?.count ?? 0, overdueCount: overdue?.count ?? 0 };
  },

  trafficData: async (periodDays = 56) => {
    const database = await getDatabase();
    const safeDays = Number.isInteger(periodDays) ? Math.min(365, Math.max(7, periodDays)) : 56;
    const offset = `-${safeDays - 1} days`;
    const rows = await database.getAllAsync<{ weekday: number; hour: number; transactions: number; revenue: number }>(
      `SELECT CAST(strftime('%w', s.created_at, 'localtime') AS INTEGER) AS weekday,
              CAST(strftime('%H', s.created_at, 'localtime') AS INTEGER) AS hour,
              COUNT(*) AS transactions,
              COALESCE(SUM(s.total), 0) AS revenue
       FROM sales s
       WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', ?)
         AND date(s.created_at, 'localtime') <= date('now', 'localtime')
         AND NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
       GROUP BY weekday, hour
       ORDER BY weekday, hour`,
      offset,
    );
    const summary = await database.getFirstAsync<{ total_transactions: number; active_days: number }>(
      `SELECT COUNT(*) AS total_transactions,
              COUNT(DISTINCT date(s.created_at, 'localtime')) AS active_days
       FROM sales s
       WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', ?)
         AND date(s.created_at, 'localtime') <= date('now', 'localtime')
         AND NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)`,
      offset,
    );
    return {
      periodDays: safeDays,
      totalTransactions: summary?.total_transactions ?? 0,
      activeDays: summary?.active_days ?? 0,
      slots: rows.map((row): TrafficRawSlot => ({
        weekday: row.weekday as TrafficRawSlot['weekday'],
        hour: row.hour,
        transactions: row.transactions,
        revenue: row.revenue,
      })),
    };
  },

  products: async () => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<ProductRow>('SELECT * FROM products WHERE archived_at IS NULL ORDER BY product_name COLLATE NOCASE');
    return rows.map(productFromRow);
  },

  topProducts: async () => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<ProductRow>(
      `SELECT p.* FROM products p
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id
         AND NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
       WHERE p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.quantity ELSE 0 END), 0) DESC, p.product_name COLLATE NOCASE
       LIMIT 5`,
    );
    return rows.map(productFromRow);
  },

  addProduct: async (product: ProductPayload) => {
    const database = await getDatabase();
    try {
      await database.withTransactionAsync(async () => {
        const transaction = database;
        const inserted = await transaction.runAsync(
          `INSERT INTO products
           (product_name, barcode, cost_price, selling_price, stock, category, unit, expiry_date, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          product.productName,
          product.barcode || null,
          product.costPrice,
          product.sellingPrice,
          product.stock,
          product.category || 'General',
          product.unit || 'piece',
          product.expiryDate || null,
          product.lowStockThreshold,
        );
        if (product.stock > 0) {
          await transaction.runAsync(
            `INSERT INTO stock_movements (product_id, change_quantity, movement_type, note)
             VALUES (?, ?, 'opening', 'Opening stock')`,
            inserted.lastInsertRowId,
            product.stock,
          );
        }
      });
      return result('Product added.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) throw new Error('Barcode is already used by another product.');
      throw error;
    }
  },

  importProducts: async (products: ProductPayload[]) => {
    if (!products.length) throw new Error('There are no valid products to import.');
    const database = await getDatabase();
    try {
      await database.withTransactionAsync(async () => {
        const transaction = database;
        for (const product of products) {
          const inserted = await transaction.runAsync(
            `INSERT INTO products
             (product_name, barcode, cost_price, selling_price, stock, category, unit, expiry_date, low_stock_threshold)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            product.productName,
            product.barcode || null,
            product.costPrice,
            product.sellingPrice,
            product.stock,
            product.category || 'General',
            product.unit || 'piece',
            product.expiryDate || null,
            product.lowStockThreshold,
          );
          if (product.stock > 0) {
            await transaction.runAsync(
              `INSERT INTO stock_movements (product_id, change_quantity, movement_type, note)
               VALUES (?, ?, 'opening', 'Imported opening stock')`,
              inserted.lastInsertRowId,
              product.stock,
            );
          }
        }
      });
      return result(`${products.length} product${products.length === 1 ? '' : 's'} imported.`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) throw new Error('An imported barcode is already used by another product. Choose the CSV again to refresh the preview.');
      throw error;
    }
  },

  updateProduct: async (product: Product) => {
    const database = await getDatabase();
    try {
      await database.runAsync(
        `UPDATE products SET product_name = ?, barcode = ?, cost_price = ?, selling_price = ?, category = ?, unit = ?,
         expiry_date = ?, low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        product.productName,
        product.barcode || null,
        product.costPrice,
        product.sellingPrice,
        product.category || 'General',
        product.unit || 'piece',
        product.expiryDate || null,
        product.lowStockThreshold,
        product.id,
      );
      return result('Product updated.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) throw new Error('Barcode is already used by another product.');
      throw error;
    }
  },

  archiveProduct: async (productId: number) => {
    const database = await getDatabase();
    const product = await database.getFirstAsync<{ stock: number; archived_at: string | null }>('SELECT stock, archived_at FROM products WHERE id = ?', productId);
    if (!product || product.archived_at) throw new Error('Product not found or already archived.');
    if (product.stock > 0) throw new Error('Set this product stock to zero before archiving it.');
    await database.runAsync('UPDATE products SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', productId);
    return result('Product archived. Past sales are unchanged.');
  },

  restock: async (payload: { productId: number; quantity: number; mode: 'add' | 'set'; newCost?: number; newSelling?: number }) => {
    const database = await getDatabase();
    const product = await database.getFirstAsync<ProductRow>('SELECT * FROM products WHERE id = ?', payload.productId);
    if (!product) throw new Error('Product not found.');
    const stock = payload.mode === 'add' ? product.stock + payload.quantity : payload.quantity;
    await database.withTransactionAsync(async () => {
      const transaction = database;
      await transaction.runAsync(
        `UPDATE products SET stock = ?, cost_price = ?, selling_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        stock,
        payload.newCost && payload.newCost > 0 ? payload.newCost : product.cost_price,
        payload.newSelling && payload.newSelling > 0 ? payload.newSelling : product.selling_price,
        payload.productId,
      );
      await transaction.runAsync(
        `INSERT INTO stock_movements (product_id, change_quantity, movement_type, note)
         VALUES (?, ?, ?, ?)`,
        payload.productId,
        stock - product.stock,
        payload.mode === 'add' ? 'restock' : 'set',
        payload.mode === 'add' ? 'Restocked inventory' : 'Stock count adjustment',
      );
    });
    return result(`Stock updated to ${stock}.`);
  },

  sales: async () => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<SaleRow>(
      `SELECT s.*, CASE WHEN v.sale_id IS NULL THEN 0 ELSE 1 END AS voided, v.reason AS void_reason
       FROM sales s LEFT JOIN voided_sales v ON v.sale_id = s.id
       WHERE s.status = 'paid' ORDER BY s.created_at DESC, s.id DESC`,
    );
    return Promise.all(rows.map(async (row): Promise<Sale> => {
      const items = await database.getAllAsync<SaleItemRow>('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id', row.id);
      const payments = await database.getAllAsync<SalePaymentRow>('SELECT method, amount FROM sale_payments WHERE sale_id = ? ORDER BY id', row.id);
      return {
        id: row.id,
        customerId: row.customer_id,
        total: row.total,
        status: row.status,
        createdAt: row.created_at,
        dueAt: row.due_at,
        voided: Boolean(row.voided),
        voidReason: row.void_reason,
        payments,
        items: items.map(saleItemFromRow),
      };
    }));
  },

  checkoutPaid: async (items: CartLine[], payments: { method: PaymentMethod; amount: number }[]) => {
    const receipt = await recordReceipt(items, 'paid', null, payments);
    return { success: true, message: `Sale #${receipt.saleId} recorded locally.` } satisfies MutationResult;
  },

  checkoutPartial: async (items: CartLine[], customerId: number, payments: { method: PaymentMethod; amount: number }[], dueAt: string | null = null) => {
    const receipt = await recordReceipt(items, 'unpaid', customerId, payments, dueAt);
    const paidNow = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return { success: true, message: `Sale #${receipt.saleId} recorded with ${pesoForMessage(paidNow)} paid and ${pesoForMessage(receipt.total - paidNow)} added to utang.` } satisfies MutationResult;
  },

  voidSale: async (saleId: number, reason: string) => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      const transaction = database;
      const sale = await transaction.getFirstAsync<{ id: number }>(
        `SELECT s.id FROM sales s LEFT JOIN voided_sales v ON v.sale_id = s.id
         WHERE s.id = ? AND s.status = 'paid' AND v.sale_id IS NULL`,
        saleId,
      );
      if (!sale) throw new Error('This sale cannot be refunded or was already voided.');
      const items = await transaction.getAllAsync<SaleItemRow>('SELECT * FROM sale_items WHERE sale_id = ?', saleId);
      await transaction.runAsync('INSERT INTO voided_sales (sale_id, reason) VALUES (?, ?)', saleId, reason.trim() || 'Customer return');
      for (const item of items) {
        if (!item.product_id) continue;
        await transaction.runAsync('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', item.quantity, item.product_id);
        await transaction.runAsync(
          `INSERT INTO stock_movements (product_id, sale_id, change_quantity, movement_type, note)
           VALUES (?, ?, ?, 'void', ?)`,
          item.product_id,
          saleId,
          item.quantity,
          `Refunded sale #${saleId}`,
        );
      }
    });
    return result(`Sale #${saleId} refunded and stock restored.`);
  },

  dashboard: async (): Promise<Dashboard> => {
    const database = await getDatabase();
    const sales = await database.getFirstAsync<{ revenue: number; cost: number }>(
      `SELECT COALESCE(SUM(sp.amount), 0) AS revenue,
              COALESCE(SUM(CASE WHEN s.total > 0 THEN
                (sp.amount / s.total) * COALESCE((SELECT SUM(si.cost_each * si.quantity) FROM sale_items si WHERE si.sale_id = s.id), 0)
                ELSE 0 END), 0) AS cost
       FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
       WHERE NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
         AND date(sp.created_at, 'localtime') = date('now', 'localtime')`,
    );
    const saleCount = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sales s
       WHERE NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
         AND date(created_at, 'localtime') = date('now', 'localtime')`,
    );
    const lowStock = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products WHERE archived_at IS NULL AND stock <= low_stock_threshold');
    const utang = await database.getFirstAsync<{ total: number }>("SELECT COALESCE(SUM(total - paid_amount), 0) AS total FROM sales WHERE status = 'unpaid'");
    const expenses = await database.getFirstAsync<{ total: number }>("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date(created_at, 'localtime') = date('now', 'localtime')");
    const expiring = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM products WHERE archived_at IS NULL AND expiry_date IS NOT NULL AND date(expiry_date) <= date('now', '+30 days')",
    );
    return {
      todayRevenue: sales?.revenue ?? 0,
      todayProfit: cashBasisProfit({ cashCollected: sales?.revenue ?? 0, recognizedProductCost: sales?.cost ?? 0, expenses: expenses?.total ?? 0 }),
      todaySaleCount: saleCount?.count ?? 0,
      lowStockCount: lowStock?.count ?? 0,
      totalUtang: utang?.total ?? 0,
      todayExpenses: expenses?.total ?? 0,
      expiringCount: expiring?.count ?? 0,
    };
  },

  profit: async (): Promise<ProfitSummary> => {
    const database = await getDatabase();
    const paid = await database.getFirstAsync<{ revenue: number; cost: number }>(
      `SELECT COALESCE(SUM(sp.amount), 0) AS revenue,
              COALESCE(SUM(CASE WHEN s.total > 0 THEN
                (sp.amount / s.total) * COALESCE((SELECT SUM(si.cost_each * si.quantity) FROM sale_items si WHERE si.sale_id = s.id), 0)
                ELSE 0 END), 0) AS cost
       FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
       WHERE NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)`,
    );
    const badDebt = await database.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(CASE
                WHEN s.total <= 0 THEN 0
                WHEN si.product_id IS NULL THEN si.line_total * (1 - MIN(1, s.paid_amount / s.total))
                ELSE si.cost_each * si.quantity * (1 - MIN(1, s.paid_amount / s.total))
              END), 0) AS total
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'written_off' AND NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)`,
    );
    const activity = await database.getFirstAsync<{ items_sold: number; sale_count: number }>(
      `SELECT COALESCE(SUM(CASE WHEN si.product_id IS NOT NULL THEN si.quantity ELSE 0 END), 0) AS items_sold,
              COUNT(DISTINCT s.id) AS sale_count
       FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)`,
    );
    const outstanding = await database.getFirstAsync<{ total: number }>("SELECT COALESCE(SUM(total - paid_amount), 0) AS total FROM sales WHERE status = 'unpaid'");
    const expenses = await database.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses');
    const revenue = paid?.revenue ?? 0;
    const cost = paid?.cost ?? 0;
    const grossProfit = revenue - cost;
    return {
      revenue,
      cost,
      grossProfit,
      expenses: expenses?.total ?? 0,
      writtenOffLoss: badDebt?.total ?? 0,
      netProfit: cashBasisProfit({ cashCollected: revenue, recognizedProductCost: cost, writtenOffLoss: badDebt?.total ?? 0, expenses: expenses?.total ?? 0 }),
      outstanding: outstanding?.total ?? 0,
      itemsSold: activity?.items_sold ?? 0,
      saleCount: activity?.sale_count ?? 0,
    };
  },

  customers: async () => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CustomerRow>(
      `SELECT c.id, c.name,
              COALESCE((SELECT SUM(s.total - s.paid_amount) FROM sales s WHERE s.customer_id = c.id AND s.status = 'unpaid'), 0) AS balance,
              COALESCE((SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'unpaid' AND s.due_at IS NOT NULL AND date(s.due_at) < date('now', 'localtime')), 0) AS overdue_count
       FROM customers c WHERE c.archived_at IS NULL ORDER BY balance DESC, c.name COLLATE NOCASE`,
    );
    return rows.map(customerFromRow);
  },

  addCustomer: async (name: string) => {
    const database = await getDatabase();
    await database.runAsync('INSERT INTO customers (name) VALUES (?)', name.trim());
    return result('Customer added.');
  },

  customerDetail: async (customerId: number): Promise<CustomerDetail> => {
    const database = await getDatabase();
    const customer = await database.getFirstAsync<CustomerRow>(
      `SELECT c.id, c.name,
              COALESCE((SELECT SUM(s.total - s.paid_amount) FROM sales s WHERE s.customer_id = c.id AND s.status = 'unpaid'), 0) AS balance,
              COALESCE((SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'unpaid' AND s.due_at IS NOT NULL AND date(s.due_at) < date('now', 'localtime')), 0) AS overdue_count
       FROM customers c WHERE c.id = ?`,
      customerId,
    );
    if (!customer) throw new Error('Customer not found.');
    const rows = await database.getAllAsync<{ id: number; kind: 'sale' | 'payment'; description: string; amount: number; status: string; created_at: string; due_at: string | null }>(
      `SELECT s.id, 'sale' AS kind,
              COALESCE((SELECT GROUP_CONCAT(si.description || ' x' || si.quantity, ', ') FROM sale_items si WHERE si.sale_id = s.id), 'Utang') AS description,
              s.total - s.paid_amount AS amount, s.status, s.created_at, s.due_at
       FROM sales s WHERE s.customer_id = ? AND s.status IN ('unpaid', 'written_off')
       UNION ALL
       SELECT p.id, 'payment' AS kind, COALESCE(p.note, 'Bayad') AS description,
              p.amount, 'payment' AS status, p.created_at, NULL AS due_at
       FROM payments p WHERE p.customer_id = ?
       ORDER BY created_at DESC, id DESC`,
      customerId,
      customerId,
    );
    return {
      customer: customerFromRow(customer),
      transactions: rows.map((row): UtangTransaction => ({
        id: row.id,
        kind: row.kind,
        description: row.description,
        amount: row.amount,
        status: row.status,
        createdAt: row.created_at,
        dueAt: row.due_at,
        overdue: row.status === 'unpaid' && Boolean(row.due_at && new Date(`${row.due_at}T23:59:59`).getTime() < Date.now()),
      })),
    };
  },

  addProductDebt: async (customerId: number, items: CartLine[], dueAt: string | null = null) => {
    const receipt = await recordReceipt(items, 'unpaid', customerId, [], dueAt);
    return { success: true, message: `Utang #${receipt.saleId} recorded locally.` } satisfies MutationResult;
  },

  addCashDebt: async (customerId: number, amount: number, note: string, dueAt: string | null = null) => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      const transaction = database;
      const sale = await transaction.runAsync("INSERT INTO sales (customer_id, total, status, due_at) VALUES (?, ?, 'unpaid', ?)", customerId, amount, dueAt);
      await transaction.runAsync(
        `INSERT INTO sale_items (sale_id, product_id, description, quantity, cost_each, price_each, line_total)
         VALUES (?, NULL, ?, 1, 0, ?, ?)`,
        sale.lastInsertRowId,
        note.trim() || 'Cash utang',
        amount,
        amount,
      );
    });
    return result('Cash utang recorded locally.');
  },

  addPayment: async (customerId: number, amount: number, note: string, method: PaymentMethod = 'cash') => {
    const balance = await customerBalance(customerId);
    if (amount <= 0) throw new Error('Payment must be greater than zero.');
    if (amount > balance) throw new Error('Payment cannot be more than the current balance.');
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      const transaction = database;
      await transaction.runAsync('INSERT INTO payments (customer_id, amount, note) VALUES (?, ?, ?)', customerId, amount, note.trim() || null);
      const unpaid = await transaction.getAllAsync<{ id: number; total: number; paid_amount: number }>(
        "SELECT id, total, paid_amount FROM sales WHERE customer_id = ? AND status = 'unpaid' ORDER BY created_at, id",
        customerId,
      );
      let remaining = amount;
      for (const sale of unpaid) {
        if (remaining <= 0) break;
        const owed = sale.total - sale.paid_amount;
        const applied = Math.min(remaining, owed);
        const newPaidAmount = sale.paid_amount + applied;
        const isPaid = newPaidAmount >= sale.total;
        await transaction.runAsync(
          'UPDATE sales SET paid_amount = ?, status = ?, paid_at = ? WHERE id = ?',
          newPaidAmount,
          isPaid ? 'paid' : 'unpaid',
          isPaid ? new Date().toISOString() : null,
          sale.id,
        );
        await transaction.runAsync('INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)', sale.id, method, applied);
        remaining -= applied;
      }
    });
    return result('Payment recorded locally.');
  },

  writeOffDebt: async (saleId: number) => {
    const database = await getDatabase();
    const update = await database.runAsync(
      "UPDATE sales SET status = 'written_off' WHERE id = ? AND customer_id IS NOT NULL AND status = 'unpaid'",
      saleId,
    );
    if (update.changes !== 1) throw new Error('This utang cannot be written off or is no longer unpaid.');
    return result('Utang written off. Its payment history and original sale remain in the ledger.');
  },

  archiveCustomer: async (customerId: number) => {
    const database = await getDatabase();
    const balance = await customerBalance(customerId);
    if (balance > 0.005) throw new Error('Settle or write off this customer’s remaining utang before archiving.');
    const update = await database.runAsync('UPDATE customers SET archived_at = CURRENT_TIMESTAMP WHERE id = ? AND archived_at IS NULL', customerId);
    if (update.changes !== 1) throw new Error('Customer not found or already archived.');
    return result('Customer archived. Past ledger records are unchanged.');
  },

  expenses: async (): Promise<Expense[]> => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number; category: string; amount: number; note: string | null; payment_method: PaymentMethod; created_at: string }>(
      'SELECT * FROM expenses ORDER BY created_at DESC, id DESC',
    );
    return rows.map((row) => ({ id: row.id, category: row.category, amount: row.amount, note: row.note, paymentMethod: row.payment_method, createdAt: row.created_at }));
  },

  addExpense: async (payload: { category: string; amount: number; note: string; paymentMethod: PaymentMethod }) => {
    if (!(payload.amount > 0)) throw new Error('Expense amount must be greater than zero.');
    const database = await getDatabase();
    await database.runAsync(
      'INSERT INTO expenses (category, amount, note, payment_method) VALUES (?, ?, ?, ?)',
      payload.category.trim() || 'Other',
      payload.amount,
      payload.note.trim() || null,
      payload.paymentMethod,
    );
    return result('Expense recorded.');
  },

  daySummary: async (): Promise<DaySummary> => {
    const database = await getDatabase();
    const sales = await database.getFirstAsync<{ cash: number; gcash: number; maya: number }>(
      `SELECT COALESCE(SUM(CASE WHEN sp.method = 'cash' THEN sp.amount ELSE 0 END), 0) AS cash,
              COALESCE(SUM(CASE WHEN sp.method = 'gcash' THEN sp.amount ELSE 0 END), 0) AS gcash,
              COALESCE(SUM(CASE WHEN sp.method = 'maya' THEN sp.amount ELSE 0 END), 0) AS maya
       FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
       WHERE NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
         AND date(sp.created_at, 'localtime') = date('now', 'localtime')`,
    );
    const expenses = await database.getFirstAsync<{ cash: number; digital: number; total: number }>(
      `SELECT COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash,
              COALESCE(SUM(CASE WHEN payment_method <> 'cash' THEN amount ELSE 0 END), 0) AS digital,
              COALESCE(SUM(amount), 0) AS total
       FROM expenses WHERE date(created_at, 'localtime') = date('now', 'localtime')`,
    );
    const cashSales = sales?.cash ?? 0;
    const gcashSales = sales?.gcash ?? 0;
    const mayaSales = sales?.maya ?? 0;
    const cashExpenses = expenses?.cash ?? 0;
    const digitalExpenses = expenses?.digital ?? 0;
    const revenue = cashSales + gcashSales + mayaSales;
    const expenseTotal = expenses?.total ?? 0;
    return {
      cashSales,
      gcashSales,
      mayaSales,
      cashExpenses,
      digitalExpenses,
      expectedCash: cashSales - cashExpenses,
      revenue,
      expenses: expenseTotal,
      netCashflow: revenue - expenseTotal,
    };
  },

  exportBackup: async () => {
    const database = await getDatabase();
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const spec of backupSpecs) {
      tables[spec.name] = await database.getAllAsync<Record<string, unknown>>(`SELECT ${spec.columns.join(', ')} FROM ${spec.name}`);
    }
    return { format: 'tindaryo-backup', version: 1, exportedAt: new Date().toISOString(), tables };
  },

  restoreBackup: async (input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid backup file.');
    const backup = input as { format?: string; tables?: Record<string, unknown> };
    if (backup.format !== 'tindaryo-backup' || !backup.tables) throw new Error('This is not a Tindaryo backup.');
    for (const spec of backupSpecs) {
      if (!Array.isArray(backup.tables[spec.name])) throw new Error(`Backup is missing ${spec.name}.`);
    }
    const settings = backup.tables.settings as Record<string, unknown>[];
    if (!settings.some((row) => row.key === 'store_name' && typeof row.value === 'string')) throw new Error('Backup has no store profile.');

    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      const transaction = database;
      for (const spec of [...backupSpecs].reverse()) await transaction.runAsync(`DELETE FROM ${spec.name}`);
      for (const spec of backupSpecs) {
        const rows = backup.tables![spec.name] as Record<string, unknown>[];
        const placeholders = spec.columns.map(() => '?').join(', ');
        for (const row of rows) {
          const values = spec.columns.map((column) => {
            const value = row[column];
            if (value === undefined && column === 'archived_at') return null;
            if (value === null || typeof value === 'string' || typeof value === 'number') return value;
            throw new Error(`Invalid value in ${spec.name}.${column}.`);
          });
          await transaction.runAsync(`INSERT INTO ${spec.name} (${spec.columns.join(', ')}) VALUES (${placeholders})`, values);
        }
      }
    });
    return result('Backup restored. Restarting the app is recommended.');
  },

  eraseAllData: async () => {
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      for (const spec of [...backupSpecs].reverse()) await database.runAsync(`DELETE FROM ${spec.name}`);
    });
    return result('All store data was erased from this device.');
  },

  salesCsv: async () => {
    const sales = await store.sales();
    const rows = [['Receipt', 'Date', 'Status', 'Payments', 'Items', 'Total'].map(csvCell).join(',')];
    for (const sale of sales) {
      rows.push([
        sale.id,
        sale.createdAt,
        sale.voided ? 'refunded' : 'paid',
        sale.payments.map((payment) => `${payment.method}:${payment.amount.toFixed(2)}`).join(' + '),
        sale.items.map((item) => `${item.description} x${item.quantity}`).join('; '),
        sale.total.toFixed(2),
      ].map(csvCell).join(','));
    }
    return rows.join('\n');
  },

  restockReport: async () => {
    const database = await getDatabase();
    const rows = await database.getAllAsync<{ id: number; product_name: string; stock: number; sold_last_30: number }>(
      `SELECT p.id, p.product_name, p.stock,
              COALESCE(SUM(CASE WHEN s.created_at >= datetime('now', '-30 days')
                AND NOT EXISTS (SELECT 1 FROM voided_sales v WHERE v.sale_id = s.id)
                THEN si.quantity ELSE 0 END), 0) AS sold_last_30
       FROM products p
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON s.id = si.sale_id
       WHERE p.archived_at IS NULL
       GROUP BY p.id, p.product_name, p.stock`,
    );
    const ranking = { out: 0, critical: 1, low: 2, ok: 3, no_data: 4 };
    return rows.map((row): RestockItem => {
      const velocity = row.sold_last_30 / 30;
      const daysLeft = velocity > 0 ? row.stock / velocity : null;
      const urgency: RestockItem['urgency'] = row.sold_last_30 === 0 ? 'no_data' : row.stock === 0 ? 'out' : daysLeft! <= 2 ? 'critical' : daysLeft! <= 5 ? 'low' : 'ok';
      return { id: row.id, productName: row.product_name, stock: row.stock, soldLast30: row.sold_last_30, velocity: Number(velocity.toFixed(2)), daysLeft: daysLeft === null ? null : Number(daysLeft.toFixed(1)), urgency };
    }).sort((a, b) => ranking[a.urgency] - ranking[b.urgency]);
  },
};
