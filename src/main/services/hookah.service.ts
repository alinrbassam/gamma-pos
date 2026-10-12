import Database from 'better-sqlite3';
import { HookahFlavorEntity } from '../../shared/types';
import { logger } from './logger.service';

export class HookahService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTablesAndDefaults();
  }

  private ensureTablesAndDefaults(): void {
    try {
      this.db.exec(`
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

      // Ensure Shisha category
      this.db.prepare(`
        INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
        VALUES ('cat-shisha', 'Shisha / Hookah', 'أراكيل وشيشة', '💨', 4)
      `).run();

      // Repair and synchronize all hookah products in catalog
      this.repairHookahProducts();
    } catch {
      // ignore
    }
  }

  public getFlavors(onlyActive = false): HookahFlavorEntity[] {
    const query = onlyActive
      ? 'SELECT * FROM hookah_flavors WHERE is_active = 1 ORDER BY display_order ASC, name_en ASC'
      : 'SELECT * FROM hookah_flavors ORDER BY display_order ASC, name_en ASC';
    return this.db.prepare(query).all() as HookahFlavorEntity[];
  }

  public saveFlavor(data: Partial<HookahFlavorEntity>): HookahFlavorEntity {
    const now = new Date().toISOString();
    const id = data.id || `hk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const nameEn = (data.name_en || '').trim() || 'Hookah';
    const nameAr = (data.name_ar || '').trim() || nameEn;
    const priceUsd = Math.max(0, Number(data.price_usd ?? 5.0));
    const priceLbp = Math.max(0, Number(data.price_lbp ?? 450000));
    const refillPriceUsd = Math.max(0, Number(data.refill_price_usd ?? 3.0));
    const refillPriceLbp = Math.max(0, Number(data.refill_price_lbp ?? 270000));
    const displayOrder = Number(data.display_order ?? 0);
    const isActive = data.is_active !== undefined ? Number(data.is_active) : 1;

    const existing = this.db.prepare('SELECT id FROM hookah_flavors WHERE id = ?').get(id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE hookah_flavors SET
            name_en = ?,
            name_ar = ?,
            price_usd = ?,
            price_lbp = ?,
            refill_price_usd = ?,
            refill_price_lbp = ?,
            display_order = ?,
            is_active = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          nameEn,
          nameAr,
          priceUsd,
          priceLbp,
          refillPriceUsd,
          refillPriceLbp,
          displayOrder,
          isActive,
          now,
          id,
        );
      logger.info('HookahService', `Updated flavor ${id} (${nameEn})`);
    } else {
      this.db
        .prepare(`
          INSERT INTO hookah_flavors (
            id, name_en, name_ar, price_usd, price_lbp, refill_price_usd, refill_price_lbp,
            display_order, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          nameEn,
          nameAr,
          priceUsd,
          priceLbp,
          refillPriceUsd,
          refillPriceLbp,
          displayOrder,
          isActive,
          now,
          now,
        );
      logger.info('HookahService', `Created flavor ${id} (${nameEn})`);
    }

    // Ensure product records in products table for Full and Refill to guarantee foreign key integrity
    this.ensureProductRecords(id, nameEn, nameAr, priceUsd, refillPriceUsd);

    return this.db.prepare('SELECT * FROM hookah_flavors WHERE id = ?').get(id) as HookahFlavorEntity;
  }

  public deleteFlavor(id: string): { success: boolean } {
    // Soft delete to preserve historical receipts
    this.db.prepare('UPDATE hookah_flavors SET is_active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    logger.info('HookahService', `Deactivated flavor ${id}`);
    return { success: true };
  }

  public repairHookahProducts(): void {
    try {
      const flavors = this.db.prepare('SELECT * FROM hookah_flavors').all() as HookahFlavorEntity[];
      for (const flv of flavors) {
        this.ensureProductRecords(flv.id, flv.name_en, flv.name_ar, flv.price_usd, flv.refill_price_usd);
      }

      // Also clean up any lingering raw product records whose name_en starts with 'hookah-'
      const rawProds = this.db
        .prepare(`SELECT id, name_en, name_ar FROM products WHERE id LIKE 'hookah-%' OR name_en LIKE 'hookah-%'`)
        .all() as Array<{ id: string; name_en: string; name_ar: string }>;

      for (const p of rawProds) {
        const isRefill = p.id.endsWith('-refill');
        const flavorId = p.id.replace('hookah-', '').replace('-full', '').replace('-refill', '');
        const flv = this.db.prepare('SELECT * FROM hookah_flavors WHERE id = ?').get(flavorId) as HookahFlavorEntity | undefined;

        if (flv) {
          const en = isRefill ? `💨 Refill: ${flv.name_en}` : `💨 Hookah: ${flv.name_en}`;
          const ar = isRefill ? `💨 راس: ${flv.name_ar}` : `💨 أركيلة: ${flv.name_ar}`;
          this.db.prepare('UPDATE products SET name_en = ?, name_ar = ?, category_id = ? WHERE id = ?').run(en, ar, 'cat-shisha', p.id);
        } else {
          // Pretty format slug fallback: e.g. "hk-two-apples" -> "Two Apples"
          const cleanName = flavorId
            .replace(/^hk-/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const en = isRefill ? `💨 Refill: ${cleanName || 'Hookah'}` : `💨 Hookah: ${cleanName || 'Hookah'}`;
          const ar = isRefill ? `💨 راس: ${cleanName || 'شيشة'}` : `💨 أركيلة: ${cleanName || 'شيشة'}`;
          this.db.prepare('UPDATE products SET name_en = ?, name_ar = ?, category_id = ? WHERE id = ?').run(en, ar, 'cat-shisha', p.id);
        }
      }
    } catch {
      // non-fatal
    }
  }

  private ensureProductRecords(
    flavorId: string,
    nameEn: string,
    nameAr: string,
    priceUsd: number,
    refillPriceUsd: number,
  ): void {
    try {
      let defaultUnit = this.db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
      const unitId = defaultUnit?.id || 'unit-piece';

      // 1. Full Hookah product
      const fullProdId = `hookah-${flavorId}-full`;
      const fullSku = `HK-${flavorId.slice(-6).toUpperCase()}-F`;
      this.db.prepare(`
        INSERT INTO products (
          id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost,
          category_id, base_unit_id, is_active
        ) VALUES (?, ?, ?, ?, ?, 'Service', ?, 0, 'cat-shisha', ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name_en = excluded.name_en,
          name_ar = excluded.name_ar,
          selling_price = excluded.selling_price,
          category_id = 'cat-shisha',
          product_type = 'Service',
          is_active = 1
      `).run(
        fullProdId,
        fullSku,
        fullSku,
        `💨 Hookah: ${nameEn}`,
        `💨 أركيلة: ${nameAr}`,
        priceUsd,
        unitId,
      );

      // 2. Refill Hookah product
      const refillProdId = `hookah-${flavorId}-refill`;
      const refillSku = `HK-${flavorId.slice(-6).toUpperCase()}-R`;
      this.db.prepare(`
        INSERT INTO products (
          id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost,
          category_id, base_unit_id, is_active
        ) VALUES (?, ?, ?, ?, ?, 'Service', ?, 0, 'cat-shisha', ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name_en = excluded.name_en,
          name_ar = excluded.name_ar,
          selling_price = excluded.selling_price,
          category_id = 'cat-shisha',
          product_type = 'Service',
          is_active = 1
      `).run(
        refillProdId,
        refillSku,
        refillSku,
        `💨 Refill: ${nameEn}`,
        `💨 راس: ${nameAr}`,
        refillPriceUsd,
        unitId,
      );
    } catch {
      // non-fatal
    }
  }
}
