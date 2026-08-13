import * as SQLite from 'expo-sqlite';

// Keep the existing filename so upgrades preserve data from pre-rebrand builds.
const DATABASE_NAME = 'sari-sari-store.db';
const DATABASE_VERSION = 4;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const createStoreTables = async (database: SQLite.SQLiteDatabase) => {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
      selling_price REAL NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      category TEXT NOT NULL DEFAULT 'General',
      unit TEXT NOT NULL DEFAULT 'piece',
      expiry_date TEXT,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
      paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'unpaid', 'written_off')),
      due_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      cost_each REAL NOT NULL DEFAULT 0,
      price_each REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('cash', 'gcash', 'maya')),
      amount REAL NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voided_sales (
      sale_id INTEGER PRIMARY KEY NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      note TEXT,
      payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'gcash', 'maya')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      sale_id INTEGER,
      change_quantity INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('opening', 'restock', 'set', 'sale', 'void')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);
    CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_status ON sales(customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_created ON payments(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements(product_id, created_at);
  `);
};

const migrate = async (database: SQLite.SQLiteDatabase) => {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  await createStoreTables(database);

  if (currentVersion === 0) {
    await database.execAsync('DROP TABLE IF EXISTS cache; DROP TABLE IF EXISTS outbox; DROP TABLE IF EXISTS session; DROP TABLE IF EXISTS users;');
  }

  if (currentVersion === 1) {
    const legacyStore = await database.getFirstAsync<{ store_name: string }>('SELECT store_name FROM users ORDER BY id LIMIT 1');
    if (legacyStore?.store_name) {
      await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', legacyStore.store_name);
    }
    await database.execAsync('DROP TABLE IF EXISTS session; DROP TABLE IF EXISTS users;');
  }

  if (currentVersion > 0 && currentVersion < 3) {
    await database.execAsync(`
      ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'General';
      ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'piece';
      ALTER TABLE products ADD COLUMN expiry_date TEXT;
      ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);
      ALTER TABLE sales ADD COLUMN due_at TEXT;
    `);
  }

  if (currentVersion > 0 && currentVersion < 4) {
    await database.execAsync(`
      ALTER TABLE products ADD COLUMN archived_at TEXT;
      ALTER TABLE customers ADD COLUMN archived_at TEXT;
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
};

export const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await migrate(database);
      return database;
    });
  }
  return databasePromise;
};
