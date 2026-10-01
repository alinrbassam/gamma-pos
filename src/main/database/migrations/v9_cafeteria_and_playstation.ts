import Database from 'better-sqlite3';

export const migrationV9 = {
  version: 9,
  name: 'cafeteria_and_playstation_v9',
  sql: `
    -- 1. PlayStation Stations
    CREATE TABLE IF NOT EXISTS playstation_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO playstation_stations (id, name) VALUES ('ps-1', 'PS 1');
    INSERT OR IGNORE INTO playstation_stations (id, name) VALUES ('ps-2', 'PS 2');

    -- 2. PlayStation Sessions (Active and Past gaming sessions)
    CREATE TABLE IF NOT EXISTS playstation_sessions (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      station_name TEXT NOT NULL,
      players_count INTEGER NOT NULL DEFAULT 1,
      hourly_rate_lbp REAL NOT NULL DEFAULT 400000,
      hourly_rate_usd REAL NOT NULL DEFAULT 4.47,
      start_time TEXT NOT NULL,
      end_time TEXT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      gaming_total_usd REAL NOT NULL DEFAULT 0,
      gaming_total_lbp REAL NOT NULL DEFAULT 0,
      orders_total_usd REAL NOT NULL DEFAULT 0,
      orders_total_lbp REAL NOT NULL DEFAULT 0,
      grand_total_usd REAL NOT NULL DEFAULT 0,
      grand_total_lbp REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES playstation_stations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ps_session_status ON playstation_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_ps_session_station ON playstation_sessions(station_id);

    -- 3. PlayStation Session Cafeteria Items (Orders attached to gaming session)
    CREATE TABLE IF NOT EXISTS playstation_session_items (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price_usd REAL NOT NULL,
      line_total_usd REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES playstation_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ps_items_session ON playstation_session_items(session_id);
  `,
};

export function ensureCafeteriaAndPlaystationColumns(db: Database.Database): void {
  try {
    const columns = db.prepare(`PRAGMA table_info(sales_orders)`).all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('order_type')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'`);
    }
    if (!colNames.has('table_number')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN table_number TEXT NULL`);
    }
    if (!colNames.has('delivery_name')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN delivery_name TEXT NULL`);
    }
    if (!colNames.has('delivery_phone')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN delivery_phone TEXT NULL`);
    }
    if (!colNames.has('delivery_address')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN delivery_address TEXT NULL`);
    }
    if (!colNames.has('exchange_rate')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN exchange_rate REAL DEFAULT 89500`);
    }
    if (!colNames.has('paid_usd')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN paid_usd REAL DEFAULT 0`);
    }
    if (!colNames.has('paid_lbp')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN paid_lbp REAL DEFAULT 0`);
    }
    if (!colNames.has('change_usd')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN change_usd REAL DEFAULT 0`);
    }
    if (!colNames.has('change_lbp')) {
      db.exec(`ALTER TABLE sales_orders ADD COLUMN change_lbp REAL DEFAULT 0`);
    }

    // Ensure default settings for exchange rate and playstation rates
    const settingsStmt = db.prepare(`
      INSERT OR IGNORE INTO business_settings (id, business_id, category, key, value, created_at, updated_at)
      SELECT
        'rate-usd-lbp',
        id,
        'currency',
        'usd_to_lbp_rate',
        '89500',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM businesses LIMIT 1
    `);
    try {
      settingsStmt.run();
    } catch {
      // ignore
    }

    const psRateStmt = db.prepare(`
      INSERT OR IGNORE INTO business_settings (id, business_id, category, key, value, created_at, updated_at)
      SELECT
        'rate-ps-player-hour',
        id,
        'playstation',
        'rate_per_player_hour_lbp',
        '200000',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM businesses LIMIT 1
    `);
    try {
      psRateStmt.run();
      db.exec(`UPDATE business_settings SET value = '200000' WHERE key = 'rate_per_player_hour_lbp' AND value = '400000';`);
    } catch {
      // ignore
    }

    // PlayStation Tables Check
    db.exec(`
      CREATE TABLE IF NOT EXISTS playstation_stations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO playstation_stations (id, name) VALUES ('ps-1', 'PS5 - Console 1');
      INSERT OR IGNORE INTO playstation_stations (id, name) VALUES ('ps-2', 'PS5 - Console 2');
      UPDATE playstation_stations SET name = 'PS5 - Console 1' WHERE id = 'ps-1' AND (name = 'PS 1' OR name = 'PS 1 (Console 1)');
      UPDATE playstation_stations SET name = 'PS5 - Console 2' WHERE id = 'ps-2' AND (name = 'PS 2' OR name = 'PS 2 (Console 2)');

      CREATE TABLE IF NOT EXISTS playstation_sessions (
        id TEXT PRIMARY KEY,
        station_id TEXT NOT NULL,
        station_name TEXT NOT NULL,
        players_count INTEGER NOT NULL DEFAULT 1,
        hourly_rate_lbp REAL NOT NULL DEFAULT 400000,
        hourly_rate_usd REAL NOT NULL DEFAULT 4.47,
        start_time TEXT NOT NULL,
        end_time TEXT NULL,
        total_seconds INTEGER NOT NULL DEFAULT 0,
        gaming_total_usd REAL NOT NULL DEFAULT 0,
        gaming_total_lbp REAL NOT NULL DEFAULT 0,
        orders_total_usd REAL NOT NULL DEFAULT 0,
        orders_total_lbp REAL NOT NULL DEFAULT 0,
        grand_total_usd REAL NOT NULL DEFAULT 0,
        grand_total_lbp REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (station_id) REFERENCES playstation_stations(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ps_session_status ON playstation_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_ps_session_station ON playstation_sessions(station_id);

      CREATE TABLE IF NOT EXISTS playstation_session_items (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price_usd REAL NOT NULL,
        line_total_usd REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES playstation_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ps_items_session ON playstation_session_items(session_id);
    `);

    // Ensure icon column on categories table
    try {
      const catColumns = db.prepare(`PRAGMA table_info(categories)`).all() as Array<{ name: string }>;
      const catColNames = new Set(catColumns.map((c) => c.name));
      if (!catColNames.has('icon')) {
        db.exec(`ALTER TABLE categories ADD COLUMN icon TEXT NULL`);
      }
    } catch {
      // ignore
    }

    // Set business currency to USD
    db.prepare(`UPDATE businesses SET currency = 'USD' WHERE currency != 'USD'`).run();

    // Clean out demo seafood products and categories for clean cafeteria setup
    db.prepare(`DELETE FROM products WHERE sku LIKE 'DEMO-%' OR id LIKE 'prod-demo-%'`).run();
    db.prepare(`DELETE FROM categories WHERE id IN ('cat-demo-1', 'cat-demo-2', 'cat-demo-3', 'fresh', 'fillet', 'shrimp', 'extras')`).run();
    db.prepare(`DELETE FROM inventory_balances WHERE id LIKE 'bal-demo-%'`).run();

    // Ensure default cafeteria categories if empty
    try {
      const catCountRes = db.prepare('SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL').get() as { count: number };
      if (!catCountRes || catCountRes.count === 0) {
        const insertCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order) VALUES (?, ?, ?, ?, ?)`);
        insertCat.run('cat-hot-drinks', 'Hot Drinks', 'مشروبات ساخنة', '☕', 1);
        insertCat.run('cat-cold-drinks', 'Cold Drinks', 'مشروبات باردة', '🥤', 2);
        insertCat.run('cat-snacks', 'Snacks & Sandwiches', 'سندويشات وسناكس', '🥪', 3);
        insertCat.run('cat-shisha', 'Shisha / Argileh', 'أراكيل', '💨', 4);
        insertCat.run('cat-desserts', 'Desserts', 'حلويات', '🍰', 5);
        insertCat.run('cat-playstation', 'PlayStation Lounge', 'صالة بلايستيشن 5', '🎮', 6);
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
          VALUES ('cat-playstation', 'PlayStation Lounge', 'صالة بلايستيشن 5', '🎮', 99)
        `).run();
      }

      // Ensure default unit exists
      db.prepare(`
        INSERT OR IGNORE INTO units (id, code, name_en, name_ar, symbol, unit_category, is_active)
        VALUES ('unit-piece', 'PCS', 'Piece', 'قطعة', 'pc', 'Count', 1)
      `).run();

      const defaultUnit = db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
      const baseUnitId = defaultUnit?.id || 'unit-piece';

      // Ensure PS5 gaming products exist in products table
      db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-time', 'PS5-TIME', 'PS5-TIME', 'PlayStation 5 Gaming Time', 'وقت لعب بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(baseUnitId);

      db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-service', 'PS5-SRV', 'PS5-SRV', 'PlayStation 5 Gaming Service', 'خدمة بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(baseUnitId);
    } catch {
      // ignore
    }
  } catch {
    // Migration runner will catch or retry
  }
}
