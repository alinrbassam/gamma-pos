import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import { logger } from './logger.service';
import { RatesService } from './rates.service';

export interface StationState {
  id: string;
  name: string;
  isActive: number;
  activeSession: PlaystationSessionData | null;
}

export interface PlaystationSessionItem {
  id: string;
  sessionId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
  createdAt: string;
}

export interface PlaystationSessionData {
  id: string;
  stationId: string;
  stationName: string;
  playersCount: number;
  hourlyRateLbp: number;
  hourlyRateUsd: number;
  startTime: string;
  endTime: string | null;
  totalSeconds: number;
  gamingTotalUsd: number;
  gamingTotalLbp: number;
  ordersTotalUsd: number;
  ordersTotalLbp: number;
  grandTotalUsd: number;
  grandTotalLbp: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  notes: string | null;
  createdAt: string;
  items: PlaystationSessionItem[];
}

export class PlaystationService {
  private db: Database.Database;
  private ratesService: RatesService;

  constructor(db: Database.Database, ratesService: RatesService) {
    this.db = db;
    this.ratesService = ratesService;
  }

  public getStationsAndSessions(): { stations: StationState[]; activeSessions: PlaystationSessionData[]; rates: { usdToLbpRate: number; ratePerPlayerHourLbp: number } } {
    const rates = this.ratesService.getRates();
    const stations = this.db.prepare('SELECT * FROM playstation_stations ORDER BY name ASC').all() as Array<{
      id: string;
      name: string;
      is_active: number;
    }>;

    const result: StationState[] = stations.map((st) => {
      const activeSessionRow = this.db
        .prepare("SELECT * FROM playstation_sessions WHERE station_id = ? AND status = 'Active' ORDER BY created_at DESC LIMIT 1")
        .get(st.id) as any;

      let activeSession: PlaystationSessionData | null = null;
      if (activeSessionRow) {
        // Clean out any accidental playstation session items that were added as cafeteria snacks
        try {
          this.db
            .prepare("DELETE FROM playstation_session_items WHERE product_id = 'ps5-gaming-time' OR LOWER(product_name) LIKE '%playstation%'")
            .run();
        } catch {
          // ignore
        }

        const items = this.db
          .prepare("SELECT * FROM playstation_session_items WHERE session_id = ? AND product_id != 'ps5-gaming-time' AND LOWER(product_name) NOT LIKE '%playstation%' ORDER BY created_at ASC")
          .all(activeSessionRow.id) as any[];

        const mappedItems: PlaystationSessionItem[] = items.map((it) => ({
          id: it.id,
          sessionId: it.session_id,
          productId: it.product_id,
          productName: it.product_name,
          quantity: it.quantity,
          unitPriceUsd: it.unit_price_usd,
          lineTotalUsd: it.line_total_usd,
          createdAt: it.created_at,
        }));

        // Calculate live elapsed time
        const startMs = new Date(activeSessionRow.start_time).getTime();
        const nowMs = Date.now();
        const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const hoursFraction = elapsedSeconds / 3600;

        const gamingTotalLbp = Math.round(hoursFraction * activeSessionRow.hourly_rate_lbp);
        const gamingTotalUsd = rates.usdToLbpRate > 0 ? Math.round((gamingTotalLbp / rates.usdToLbpRate) * 100) / 100 : 0;

        const ordersTotalUsd = mappedItems.reduce((acc, it) => acc + it.lineTotalUsd, 0);
        const ordersTotalLbp = Math.round(ordersTotalUsd * rates.usdToLbpRate);

        const grandTotalUsd = Math.round((gamingTotalUsd + ordersTotalUsd) * 100) / 100;
        const grandTotalLbp = gamingTotalLbp + ordersTotalLbp;

        activeSession = {
          id: activeSessionRow.id,
          stationId: activeSessionRow.station_id,
          stationName: activeSessionRow.station_name,
          playersCount: activeSessionRow.players_count,
          hourlyRateLbp: activeSessionRow.hourly_rate_lbp,
          hourlyRateUsd: activeSessionRow.hourly_rate_usd,
          startTime: activeSessionRow.start_time,
          endTime: activeSessionRow.end_time,
          totalSeconds: elapsedSeconds,
          gamingTotalUsd,
          gamingTotalLbp,
          ordersTotalUsd,
          ordersTotalLbp,
          grandTotalUsd,
          grandTotalLbp,
          status: activeSessionRow.status,
          notes: activeSessionRow.notes,
          createdAt: activeSessionRow.created_at,
          items: mappedItems,
        };
      }

      return {
        id: st.id,
        name: st.name,
        isActive: st.is_active,
        activeSession,
      };
    });

    const activeSessions = result
      .filter((r) => r.activeSession !== null)
      .map((r) => r.activeSession!);

    return { stations: result, activeSessions, rates };
  }

  public startSession(params: {
    stationId: string;
    playersCount: number; // 1, 2, 3, or 4
    customHourlyRateLbp?: number;
    notes?: string;
  }): PlaystationSessionData {
    const station = this.db.prepare('SELECT * FROM playstation_stations WHERE id = ?').get(params.stationId) as any;
    if (!station) {
      throw new Error(`Station not found: ${params.stationId}`);
    }

    // Check if station already has an active session
    const existing = this.db
      .prepare("SELECT id FROM playstation_sessions WHERE station_id = ? AND status = 'Active'")
      .get(params.stationId);
    if (existing) {
      throw new Error(`Station "${station.name}" is already in use.`);
    }

    const rates = this.ratesService.getRates();
    const playersCount = Math.max(1, Math.min(4, params.playersCount || 1));
    const hourlyRateLbp =
      params.customHourlyRateLbp !== undefined && params.customHourlyRateLbp > 0
        ? params.customHourlyRateLbp
        : rates.ratePerPlayerHourLbp * playersCount;
    const hourlyRateUsd =
      rates.usdToLbpRate > 0 ? Math.round((hourlyRateLbp / rates.usdToLbpRate) * 100) / 100 : 0;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO playstation_sessions (
          id, station_id, station_name, players_count, hourly_rate_lbp, hourly_rate_usd,
          start_time, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
      `)
      .run(
        id,
        params.stationId,
        station.name,
        playersCount,
        hourlyRateLbp,
        hourlyRateUsd,
        now,
        params.notes || null,
        now,
      );

    logger.info('PlaystationService', `Started session ${id} on ${station.name} for ${playersCount} player(s)`);

    return {
      id,
      stationId: params.stationId,
      stationName: station.name,
      playersCount,
      hourlyRateLbp,
      hourlyRateUsd,
      startTime: now,
      endTime: null,
      totalSeconds: 0,
      gamingTotalUsd: 0,
      gamingTotalLbp: 0,
      ordersTotalUsd: 0,
      ordersTotalLbp: 0,
      grandTotalUsd: 0,
      grandTotalLbp: 0,
      status: 'Active',
      notes: params.notes || null,
      createdAt: now,
      items: [],
    };
  }

  public addItemToSession(params: {
    sessionId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
  }): PlaystationSessionItem {
    if (params.productId === 'ps5-gaming-time' || params.productName.toLowerCase().includes('playstation')) {
      throw new Error('PlayStation gaming time cannot be added as a cafeteria snack.');
    }

    const session = this.db.prepare("SELECT * FROM playstation_sessions WHERE id = ? AND status = 'Active'").get(params.sessionId);
    if (!session) {
      throw new Error('Active session not found.');
    }

    const id = crypto.randomUUID();
    const qty = Math.max(1, params.quantity || 1);
    const lineTotal = Math.round(qty * params.unitPriceUsd * 100) / 100;
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO playstation_session_items (
          id, session_id, product_id, product_name, quantity, unit_price_usd, line_total_usd, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, params.sessionId, params.productId, params.productName, qty, params.unitPriceUsd, lineTotal, now);

    logger.info('PlaystationService', `Added item ${params.productName} (x${qty}) to session ${params.sessionId}`);

    return {
      id,
      sessionId: params.sessionId,
      productId: params.productId,
      productName: params.productName,
      quantity: qty,
      unitPriceUsd: params.unitPriceUsd,
      lineTotalUsd: lineTotal,
      createdAt: now,
    };
  }

  public removeItemFromSession(itemId: string): boolean {
    this.db.prepare('DELETE FROM playstation_session_items WHERE id = ?').run(itemId);
    logger.info('PlaystationService', `Removed item ${itemId} from session`);
    return true;
  }

  public stopSession(sessionId: string): PlaystationSessionData {
    const session = this.db.prepare("SELECT * FROM playstation_sessions WHERE id = ?").get(sessionId) as any;
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const rates = this.ratesService.getRates();
    const startMs = new Date(session.start_time).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const hoursFraction = elapsedSeconds / 3600;

    const gamingTotalLbp = Math.round(hoursFraction * session.hourly_rate_lbp);
    const gamingTotalUsd = rates.usdToLbpRate > 0 ? Math.round((gamingTotalLbp / rates.usdToLbpRate) * 100) / 100 : 0;

    const items = this.db
      .prepare('SELECT * FROM playstation_session_items WHERE session_id = ?')
      .all(sessionId) as any[];

    const ordersTotalUsd = items.reduce((acc, it) => acc + (it.line_total_usd || 0), 0);
    const ordersTotalLbp = Math.round(ordersTotalUsd * rates.usdToLbpRate);

    const grandTotalUsd = Math.round((gamingTotalUsd + ordersTotalUsd) * 100) / 100;
    const grandTotalLbp = gamingTotalLbp + ordersTotalLbp;

    const endNow = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE playstation_sessions SET
          end_time = ?,
          total_seconds = ?,
          gaming_total_usd = ?,
          gaming_total_lbp = ?,
          orders_total_usd = ?,
          orders_total_lbp = ?,
          grand_total_usd = ?,
          grand_total_lbp = ?
        WHERE id = ?
      `)
      .run(endNow, elapsedSeconds, gamingTotalUsd, gamingTotalLbp, ordersTotalUsd, ordersTotalLbp, grandTotalUsd, grandTotalLbp, sessionId);

    logger.info('PlaystationService', `Calculated totals for session ${sessionId}: Gaming=$${gamingTotalUsd}, Orders=$${ordersTotalUsd}`);

    return {
      id: session.id,
      stationId: session.station_id,
      stationName: session.station_name,
      playersCount: session.players_count,
      hourlyRateLbp: session.hourly_rate_lbp,
      hourlyRateUsd: session.hourly_rate_usd,
      startTime: session.start_time,
      endTime: endNow,
      totalSeconds: elapsedSeconds,
      gamingTotalUsd,
      gamingTotalLbp,
      ordersTotalUsd,
      ordersTotalLbp,
      grandTotalUsd,
      grandTotalLbp,
      status: session.status,
      notes: session.notes,
      createdAt: session.created_at,
      items: items.map((it) => ({
        id: it.id,
        sessionId: it.session_id,
        productId: it.product_id,
        productName: it.product_name,
        quantity: it.quantity,
        unitPriceUsd: it.unit_price_usd,
        lineTotalUsd: it.line_total_usd,
        createdAt: it.created_at,
      })),
    };
  }

  /**
   * Send PlayStation session to a Dine-In table running tab
   */
  public sendSessionToTable(sessionId: string, tableId: string): any {
    const sessionData = this.stopSession(sessionId);
    const table = this.db.prepare('SELECT * FROM dine_in_tables WHERE id = ?').get(tableId) as any;
    if (!table) {
      throw new Error(`Table ${tableId} not found`);
    }

    // Find active tab on table, or open one if table is currently available
    let tab = this.db.prepare("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'").get(tableId) as any;
    const nowIso = new Date().toISOString();
    if (!tab) {
      const tabId = `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.db
        .prepare(`
          INSERT INTO dine_in_tabs (
            id, table_id, table_name, customer_name, customer_phone,
            opened_at, status, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, 'Active', ?, ?, ?)
        `)
        .run(
          tabId,
          table.id,
          table.name,
          `${sessionData.stationName} Gamer`,
          nowIso,
          `Transferred from ${sessionData.stationName}`,
          nowIso,
          nowIso,
        );
      tab = this.db.prepare("SELECT * FROM dine_in_tabs WHERE id = ?").get(tabId) as any;
    }

    // Ensure default unit, category, and gaming service products exist in database
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO units (id, code, name_en, name_ar, symbol, unit_category, is_active)
        VALUES ('unit-piece', 'PCS', 'Piece', 'قطعة', 'pc', 'Count', 1)
      `).run();

      const defaultUnit = this.db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
      const baseUnitId = defaultUnit?.id || 'unit-piece';

      this.db.prepare(`
        INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
        VALUES ('cat-playstation', 'PlayStation Lounge', 'صالة بلايستيشن 5', '🎮', 99)
      `).run();

      this.db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-service', 'PS5-SRV', 'PS5-SRV', 'PlayStation 5 Gaming Service', 'خدمة بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(baseUnitId);

      this.db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-time', 'PS5-TIME', 'PS5-TIME', 'PlayStation 5 Gaming Time', 'وقت لعب بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(baseUnitId);
    } catch {
      // ignore
    }

    // 1. Add PS5 gaming time as a line item on the table tab if gaming cost > 0 or seconds > 0
    if (sessionData.gamingTotalUsd > 0 || sessionData.totalSeconds > 0) {
      const gamingItemId = `titem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const durationMins = Math.max(1, Math.round(sessionData.totalSeconds / 60));
      const gamingTitle = `🎮 ${sessionData.stationName} (${sessionData.playersCount}P, ${durationMins}m)`;

      this.db
        .prepare(`
          INSERT INTO dine_in_tab_items (
            id, tab_id, product_id, product_name, quantity, unit_price_usd, line_total_usd, notes, created_at
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
        `)
        .run(
          gamingItemId,
          tab.id,
          'ps5-gaming-service',
          gamingTitle,
          sessionData.gamingTotalUsd,
          sessionData.gamingTotalUsd,
          `${sessionData.playersCount} players`,
          nowIso,
        );
    }

    // 2. Transfer all session cafeteria snacks/drinks to the table tab
    const sessionItems = this.db
      .prepare("SELECT * FROM playstation_session_items WHERE session_id = ? AND product_id != 'ps5-gaming-time'")
      .all(sessionId) as any[];

    for (const it of sessionItems) {
      const existing = this.db
        .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ? AND product_id = ?')
        .get(tab.id, it.product_id) as any;

      if (existing) {
        const newQty = existing.quantity + it.quantity;
        const newLineTotal = Math.round(newQty * existing.unit_price_usd * 100) / 100;
        this.db
          .prepare('UPDATE dine_in_tab_items SET quantity = ?, line_total_usd = ? WHERE id = ?')
          .run(newQty, newLineTotal, existing.id);
      } else {
        const newItemId = `titem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.db
          .prepare(`
            INSERT INTO dine_in_tab_items (
              id, tab_id, product_id, product_name, quantity, unit_price_usd, line_total_usd, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            newItemId,
            tab.id,
            it.product_id,
            it.product_name,
            it.quantity,
            it.unit_price_usd,
            it.line_total_usd,
            it.notes || null,
            nowIso,
          );
      }
    }

    // 3. Mark the PlayStation session completed
    this.db
      .prepare("UPDATE playstation_sessions SET status = 'Completed', notes = ? WHERE id = ?")
      .run(`Sent to ${table.name}`, sessionId);

    // 4. Touch table tab updated_at
    this.db
      .prepare("UPDATE dine_in_tabs SET updated_at = ? WHERE id = ?")
      .run(nowIso, tab.id);

    logger.info('PlaystationService', `Successfully sent session ${sessionId} to ${table.name} (Tab: ${tab.id})`);
    return { success: true, tableId: table.id, tableName: table.name, tabId: tab.id };
  }

  public checkoutSession(params: {
    sessionId: string;
    paidUsd: number;
    paidLbp: number;
    changeUsd: number;
    changeLbp: number;
  }): { invoiceNumber: string; grandTotalUsd: number; grandTotalLbp: number } {
    const sessionData = this.stopSession(params.sessionId);

    const invoiceNumber = `INV-PS-${Date.now().toString().slice(-6)}`;
    const saleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const rates = this.ratesService.getRates();

    const psConsoleName = sessionData.stationName.includes('PS5')
      ? sessionData.stationName
      : `PS5 - ${sessionData.stationName}`;

    let defaultUnit = this.db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
    if (!defaultUnit) {
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO units (id, code, name_en, name_ar, symbol, unit_category, is_active)
          VALUES ('unit-session', 'SESS', 'Session', 'جلسة', 'sess', 'Count', 1)
        `).run();
        defaultUnit = { id: 'unit-session' };
      } catch {
        // ignore
      }
    }
    const unitId = defaultUnit?.id || 'unit-session';

    this.db.transaction(() => {
      // 1. Insert Sales Order tagged with PS5
      this.db
        .prepare(`
          INSERT INTO sales_orders (
            id, invoice_number, customer_name, subtotal, grand_total, paid_amount, change_amount,
            payment_status, payment_method, order_type, table_number, exchange_rate,
            paid_usd, paid_lbp, change_usd, change_lbp, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Paid', 'Split', 'playstation', ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          saleId,
          invoiceNumber,
          psConsoleName,
          sessionData.grandTotalUsd,
          sessionData.grandTotalUsd,
          sessionData.grandTotalUsd,
          params.changeUsd || 0,
          psConsoleName,
          rates.usdToLbpRate,
          params.paidUsd || 0,
          params.paidLbp || 0,
          params.changeUsd || 0,
          params.changeLbp || 0,
          `PlayStation 5 Session (${sessionData.playersCount} Players, ${Math.max(1, Math.round(sessionData.totalSeconds / 60))} mins)`,
          now,
        );

      // 2. Ensure PS5 category and gaming product exist
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
          VALUES ('cat-playstation', 'PlayStation Lounge', 'صالة بلايستيشن 5', '🎮', 99)
        `).run();
      } catch {
        // ignore
      }

      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
          VALUES ('ps5-gaming-time', 'PS5-TIME', 'PS5-TIME', 'PlayStation 5 Gaming Time', 'وقت لعب بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
        `).run(unitId);
        this.db.prepare(`
          INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
          VALUES ('ps5-gaming-service', 'PS5-SRV', 'PS5-SRV', 'PlayStation 5 Gaming Service', 'خدمة بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
        `).run(unitId);
      } catch {
        // ignore
      }

      // 3. Insert Gaming Session Item into sales_order_items
      const gamingItemId = crypto.randomUUID();
      this.db
        .prepare(`
          INSERT INTO sales_order_items (
            id, sale_id, product_id, unit_id, quantity, unit_price, cost_price,
            line_total, discount, tax_rate, tax_amount
          ) VALUES (?, ?, 'ps5-gaming-time', ?, 1, ?, 0, ?, 0, 0, 0)
        `)
        .run(
          gamingItemId,
          saleId,
          unitId,
          sessionData.gamingTotalUsd,
          sessionData.gamingTotalUsd,
        );

      // 4. Insert attached cafeteria items if any into sales_order_items
      for (const it of sessionData.items) {
        const orderItemId = crypto.randomUUID();
        let prod = this.db.prepare('SELECT base_unit_id FROM products WHERE id = ?').get(it.productId) as { base_unit_id?: string } | undefined;
        if (!prod) {
          try {
            this.db.prepare(`
              INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
              VALUES (?, ?, ?, ?, ?, 'Service', ?, 0, 'cat-playstation', ?, 1)
            `).run(
              it.productId,
              `PROD-${it.productId.slice(-8)}`,
              `PROD-${it.productId.slice(-8)}`,
              it.productName || 'Snack',
              it.productName || 'صنف',
              it.unitPriceUsd || 0,
              unitId,
            );
            prod = this.db.prepare('SELECT base_unit_id FROM products WHERE id = ?').get(it.productId) as { base_unit_id?: string } | undefined;
          } catch {
            // ignore
          }
        }
        const itemUnitId = prod?.base_unit_id || unitId;
        this.db
          .prepare(`
            INSERT INTO sales_order_items (
              id, sale_id, product_id, unit_id, quantity, unit_price, cost_price,
              line_total, discount, tax_rate, tax_amount
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, 0, 0)
          `)
          .run(
            orderItemId,
            saleId,
            it.productId,
            itemUnitId,
            it.quantity,
            it.unitPriceUsd,
            it.lineTotalUsd,
          );
      }

      // 5. Mark session Completed
      this.db
        .prepare("UPDATE playstation_sessions SET status = 'Completed' WHERE id = ?")
        .run(params.sessionId);
    })();

    logger.info('PlaystationService', `Checkout complete for session ${params.sessionId}, Invoice: ${invoiceNumber}`);

    return {
      invoiceNumber,
      grandTotalUsd: sessionData.grandTotalUsd,
      grandTotalLbp: sessionData.grandTotalLbp,
    };
  }
}
