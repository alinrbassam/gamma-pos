import Database from 'better-sqlite3';

export const migrationV10 = {
  version: 10,
  name: 'dine_in_tables_and_tabs_v10',
  sql: `
    -- 1. Dine-In Tables Table
    CREATE TABLE IF NOT EXISTS dine_in_tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL DEFAULT 4,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Dine-In Running Tabs
    CREATE TABLE IF NOT EXISTS dine_in_tabs (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      customer_name TEXT NULL,
      customer_phone TEXT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES dine_in_tables(id)
    );

    CREATE INDEX IF NOT EXISTS idx_dine_in_tabs_status ON dine_in_tabs(status);
    CREATE INDEX IF NOT EXISTS idx_dine_in_tabs_table ON dine_in_tabs(table_id);
    CREATE INDEX IF NOT EXISTS idx_dine_in_tabs_phone ON dine_in_tabs(customer_phone);

    -- 3. Dine-In Tab Items
    CREATE TABLE IF NOT EXISTS dine_in_tab_items (
      id TEXT PRIMARY KEY,
      tab_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price_usd REAL NOT NULL,
      line_total_usd REAL NOT NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tab_id) REFERENCES dine_in_tabs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dine_in_items_tab ON dine_in_tab_items(tab_id);

    -- 4. Customer Directory for Phone Autofill
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `,
};

export function ensureDineInTables(db: Database.Database): void {
  try {
    // Ensure 15 default tables exist
    const insertTable = db.prepare(`
      INSERT OR IGNORE INTO dine_in_tables (id, name, capacity, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    for (let i = 1; i <= 15; i++) {
      const id = `tbl-${i}`;
      const name = `Table ${i}`;
      insertTable.run(id, name, 4, i);
    }

    // Populate customers table from existing sales_orders if any exist
    try {
      db.exec(`
        INSERT OR IGNORE INTO customers (id, name, phone, created_at, updated_at)
        SELECT 
          'cust-' || substr(replace(customer_phone, ' ', ''), 1, 15) || '-' || substr(abs(random()), 1, 6),
          COALESCE(NULLIF(customer_name, ''), 'Customer'),
          replace(customer_phone, ' ', ''),
          MIN(created_at),
          MAX(created_at)
        FROM sales_orders
        WHERE customer_phone IS NOT NULL AND trim(customer_phone) != ''
        GROUP BY replace(customer_phone, ' ', '');
      `);
    } catch {
      // Ignore if sales_orders has duplicate phones
    }
  } catch {
    // Non-fatal
  }
}
