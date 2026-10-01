import Database from 'better-sqlite3';

export const migrationV11 = {
  version: 11,
  name: 'hookah_lounge_v11',
  sql: `
    -- Hookah / Shisha Flavors & Pricing Table
    CREATE TABLE IF NOT EXISTS hookah_flavors (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      price_usd REAL NOT NULL DEFAULT 5.0,
      price_lbp REAL NOT NULL DEFAULT 450000,
      refill_price_usd REAL NOT NULL DEFAULT 3.0,
      refill_price_lbp REAL NOT NULL DEFAULT 270000,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_hookah_active ON hookah_flavors(is_active);
    CREATE INDEX IF NOT EXISTS idx_hookah_order ON hookah_flavors(display_order);
  `,
};

export function ensureHookahLounge(db: Database.Database): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS hookah_flavors (
        id TEXT PRIMARY KEY,
        name_en TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        price_usd REAL NOT NULL DEFAULT 5.0,
        price_lbp REAL NOT NULL DEFAULT 450000,
        refill_price_usd REAL NOT NULL DEFAULT 3.0,
        refill_price_lbp REAL NOT NULL DEFAULT 270000,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure Shisha category exists
    try {
      db.prepare(`
        INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
        VALUES ('cat-shisha', 'Shisha / Hookah', 'أراكيل وشيشة', '💨', 4)
      `).run();
    } catch {
      // ignore
    }

    // Seed popular Lebanese hookah flavors if table is empty
    const countRes = db.prepare('SELECT COUNT(*) as count FROM hookah_flavors').get() as { count: number };
    if (!countRes || countRes.count === 0) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO hookah_flavors (
          id, name_en, name_ar, price_usd, price_lbp, refill_price_usd, refill_price_lbp, display_order, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      const defaults = [
        { id: 'hk-two-apples', en: 'Two Apples', ar: 'تفاحتين', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 1 },
        { id: 'hk-grape-mint', en: 'Grape & Mint', ar: 'عنب ونعنع', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 2 },
        { id: 'hk-lemon-mint', en: 'Lemon & Mint', ar: 'حامض ونعنع', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 3 },
        { id: 'hk-gum-mint', en: 'Gum & Mint', ar: 'علكة ونعنع', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 4 },
        { id: 'hk-love-66', en: 'Love 66', ar: 'لوف 66', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 5 },
        { id: 'hk-gum-cinnamon', en: 'Gum & Cinnamon', ar: 'علكة وقرفة', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 6 },
        { id: 'hk-watermelon-mint', en: 'Watermelon & Mint', ar: 'بطيخ ونعنع', pUsd: 5.0, pLbp: 450000, rUsd: 3.0, rLbp: 270000, order: 7 },
      ];

      for (const d of defaults) {
        insert.run(d.id, d.en, d.ar, d.pUsd, d.pLbp, d.rUsd, d.rLbp, d.order);
      }
    }
  } catch {
    // Non-fatal
  }
}
