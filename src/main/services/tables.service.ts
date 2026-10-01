import Database from 'better-sqlite3';
import { logger } from './logger.service';
import { RatesService } from './rates.service';
import { PurchaseNumberingService } from './purchase-numbering.service';

export interface DineInTableEntity {
  id: string;
  name: string;
  capacity: number;
  display_order: number;
  is_active: number;
  created_at: string;
}

export interface DineInTabItemEntity {
  id: string;
  tab_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  line_total_usd: number;
  notes?: string;
  created_at: string;
}

export interface DineInTabEntity {
  id: string;
  table_id: string;
  table_name: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  opened_at: string;
  closed_at?: string | null;
  status: 'Active' | 'Completed' | 'Transferred' | 'Cancelled';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items: DineInTabItemEntity[];
  total_usd: number;
  total_lbp: number;
  elapsed_seconds: number;
}

export interface TableWithTab {
  table: DineInTableEntity;
  activeTab: DineInTabEntity | null;
}

export class TablesService {
  private db: Database.Database;
  private ratesService: RatesService;
  private numberingService: PurchaseNumberingService;

  constructor(db: Database.Database, ratesService: RatesService) {
    this.db = db;
    this.ratesService = ratesService;
    this.numberingService = new PurchaseNumberingService(db);
  }

  /**
   * Get all active tables along with their active tabs and live running totals
   */
  public getTablesAndTabs(): {
    tablesWithTabs: TableWithTab[];
    rates: { usdToLbpRate: number };
  } {
    const rates = this.ratesService.getRates();
    const tables = this.db
      .prepare('SELECT * FROM dine_in_tables WHERE is_active = 1 ORDER BY display_order ASC, name ASC')
      .all() as DineInTableEntity[];

    const activeTabs = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE status = 'Active'")
      .all() as any[];

    const activeTabsMap = new Map<string, any>();
    for (const tab of activeTabs) {
      activeTabsMap.set(tab.table_id, tab);
    }

    const allItems = this.db
      .prepare(`
        SELECT i.* FROM dine_in_tab_items i
        INNER JOIN dine_in_tabs t ON i.tab_id = t.id
        WHERE t.status = 'Active'
        ORDER BY i.created_at ASC
      `)
      .all() as DineInTabItemEntity[];

    const itemsByTabId = new Map<string, DineInTabItemEntity[]>();
    for (const item of allItems) {
      if (!itemsByTabId.has(item.tab_id)) {
        itemsByTabId.set(item.tab_id, []);
      }
      itemsByTabId.get(item.tab_id)!.push(item);
    }

    const now = Date.now();

    const tablesWithTabs: TableWithTab[] = tables.map((tbl) => {
      const rawTab = activeTabsMap.get(tbl.id);
      if (!rawTab) {
        return {
          table: tbl,
          activeTab: null,
        };
      }

      const items = itemsByTabId.get(rawTab.id) || [];
      const total_usd = Math.round(items.reduce((sum, it) => sum + (it.line_total_usd || 0), 0) * 100) / 100;
      const total_lbp = Math.round(total_usd * rates.usdToLbpRate);

      const openedMs = new Date(rawTab.opened_at).getTime();
      const elapsed_seconds = Math.max(0, Math.floor((now - openedMs) / 1000));

      const tab: DineInTabEntity = {
        id: rawTab.id,
        table_id: rawTab.table_id,
        table_name: rawTab.table_name || tbl.name,
        customer_name: rawTab.customer_name,
        customer_phone: rawTab.customer_phone,
        opened_at: rawTab.opened_at,
        closed_at: rawTab.closed_at,
        status: rawTab.status,
        notes: rawTab.notes,
        created_at: rawTab.created_at,
        updated_at: rawTab.updated_at,
        items,
        total_usd,
        total_lbp,
        elapsed_seconds,
      };

      return {
        table: tbl,
        activeTab: tab,
      };
    });

    return {
      tablesWithTabs,
      rates: { usdToLbpRate: rates.usdToLbpRate },
    };
  }

  /**
   * Create a new table (Manager only)
   */
  public createTable(name: string, capacity: number = 4): DineInTableEntity {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Table name cannot be empty');
    }

    const existing = this.db
      .prepare('SELECT id FROM dine_in_tables WHERE LOWER(TRIM(name)) = LOWER(?)')
      .get(trimmed);
    if (existing) {
      throw new Error(`A table named "${trimmed}" already exists. Please choose a different name.`);
    }

    const maxOrderRes = this.db
      .prepare('SELECT MAX(display_order) as maxOrder FROM dine_in_tables')
      .get() as { maxOrder: number | null };
    const nextOrder = (maxOrderRes?.maxOrder || 0) + 1;

    const id = `tbl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    this.db
      .prepare(`
        INSERT INTO dine_in_tables (id, name, capacity, display_order, is_active)
        VALUES (?, ?, ?, ?, 1)
      `)
      .run(id, trimmed, capacity > 0 ? capacity : 4, nextOrder);

    logger.info('TablesService', `Created new table: ${trimmed} (${id})`);

    return this.db.prepare('SELECT * FROM dine_in_tables WHERE id = ?').get(id) as DineInTableEntity;
  }

  /**
   * Update / Rename table (Manager only)
   */
  public updateTable(id: string, name: string, capacity: number = 4): DineInTableEntity {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Table name cannot be empty');
    }

    const existing = this.db
      .prepare('SELECT id FROM dine_in_tables WHERE LOWER(TRIM(name)) = LOWER(?) AND id != ?')
      .get(trimmed, id);
    if (existing) {
      throw new Error(`A table named "${trimmed}" already exists. Please choose a different name.`);
    }

    this.db
      .prepare(`
        UPDATE dine_in_tables
        SET name = ?, capacity = ?
        WHERE id = ?
      `)
      .run(trimmed, capacity > 0 ? capacity : 4, id);

    // Also update active tab table_name if one is running
    this.db
      .prepare(`
        UPDATE dine_in_tabs
        SET table_name = ?
        WHERE table_id = ? AND status = 'Active'
      `)
      .run(trimmed, id);

    logger.info('TablesService', `Updated table: ${trimmed} (${id})`);
    return this.db.prepare('SELECT * FROM dine_in_tables WHERE id = ?').get(id) as DineInTableEntity;
  }

  /**
   * Delete / Deactivate table (Manager only)
   */
  public deleteTable(id: string): boolean {
    const activeTab = this.db
      .prepare("SELECT id FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(id);

    if (activeTab) {
      throw new Error('Cannot remove a table with an active running tab. Please settle or move the tab first.');
    }

    this.db.prepare('DELETE FROM dine_in_tables WHERE id = ?').run(id);
    logger.info('TablesService', `Deleted table: ${id}`);
    return true;
  }

  /**
   * Lookup customer details by phone number
   */
  public lookupCustomerByPhone(phone: string): { found: boolean; name?: string; phone?: string } {
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 3) {
      return { found: false };
    }

    // 1. Check customers directory
    const cust = this.db
      .prepare('SELECT name, phone FROM customers WHERE phone = ? OR phone LIKE ? ORDER BY updated_at DESC LIMIT 1')
      .get(cleanPhone, `%${cleanPhone}%`) as { name: string; phone: string } | undefined;

    if (cust && cust.name) {
      return { found: true, name: cust.name, phone: cust.phone };
    }

    // 2. Check previous dine_in_tabs
    const pastTab = this.db
      .prepare(`
        SELECT customer_name as name, customer_phone as phone
        FROM dine_in_tabs
        WHERE (customer_phone = ? OR customer_phone LIKE ?) AND customer_name IS NOT NULL AND trim(customer_name) != ''
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(cleanPhone, `%${cleanPhone}%`) as { name: string; phone: string } | undefined;

    if (pastTab && pastTab.name) {
      this.upsertCustomer(pastTab.name, pastTab.phone || cleanPhone);
      return { found: true, name: pastTab.name, phone: pastTab.phone || cleanPhone };
    }

    // 3. Check previous sales_orders
    const pastSale = this.db
      .prepare(`
        SELECT customer_name as name, customer_phone as phone
        FROM sales_orders
        WHERE (customer_phone = ? OR customer_phone LIKE ?) AND customer_name IS NOT NULL AND trim(customer_name) != ''
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(cleanPhone, `%${cleanPhone}%`) as { name: string; phone: string } | undefined;

    if (pastSale && pastSale.name) {
      this.upsertCustomer(pastSale.name, pastSale.phone || cleanPhone);
      return { found: true, name: pastSale.name, phone: pastSale.phone || cleanPhone };
    }

    return { found: false };
  }

  /**
   * Upsert customer record
   */
  public upsertCustomer(name: string, phone: string): void {
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanName = name.trim();
    if (!cleanPhone) return;

    try {
      this.db
        .prepare(`
          INSERT INTO customers (id, name, phone, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
          ON CONFLICT(phone) DO UPDATE SET
            name = CASE WHEN excluded.name != '' THEN excluded.name ELSE customers.name END,
            updated_at = datetime('now', 'localtime')
        `)
        .run(`cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`, cleanName, cleanPhone);
    } catch (err) {
      logger.warn('TablesService', 'Could not upsert customer', err);
    }
  }

  /**
   * Open a new running tab on a table
   */
  public openTab(params: {
    tableId: string;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
  }): DineInTabEntity {
    const table = this.db
      .prepare('SELECT * FROM dine_in_tables WHERE id = ?')
      .get(params.tableId) as DineInTableEntity | undefined;

    if (!table) {
      throw new Error(`Table ${params.tableId} not found`);
    }

    // Check if table is already occupied
    const existing = this.db
      .prepare("SELECT id FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(params.tableId);

    if (existing) {
      throw new Error(`Table "${table.name}" already has an active open tab.`);
    }

    let customerName = params.customerName?.trim() || null;
    const customerPhone = params.customerPhone?.trim() || null;

    // Autofill name from phone if customer did not provide a name
    if (customerPhone && !customerName) {
      const lookup = this.lookupCustomerByPhone(customerPhone);
      if (lookup.found && lookup.name) {
        customerName = lookup.name;
      }
    }

    // Save customer if both name and phone are provided
    if (customerName && customerPhone) {
      this.upsertCustomer(customerName, customerPhone);
    }

    const tabId = `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO dine_in_tabs (
          id, table_id, table_name, customer_name, customer_phone,
          opened_at, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
      `)
      .run(
        tabId,
        table.id,
        table.name,
        customerName,
        customerPhone,
        nowIso,
        params.notes || null,
        nowIso,
        nowIso,
      );

    logger.info('TablesService', `Opened tab ${tabId} on table ${table.name} (Customer: ${customerName || customerPhone || 'Guest'})`);

    return {
      id: tabId,
      table_id: table.id,
      table_name: table.name,
      customer_name: customerName,
      customer_phone: customerPhone,
      opened_at: nowIso,
      status: 'Active',
      notes: params.notes || null,
      created_at: nowIso,
      updated_at: nowIso,
      items: [],
      total_usd: 0,
      total_lbp: 0,
      elapsed_seconds: 0,
    };
  }

  /**
   * Add an item (drink, snack, shisha, etc.) to an active tab
   */
  public addItemToTab(params: {
    tabId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
    notes?: string;
  }): DineInTabItemEntity {
    if (
      params.productId === 'ps5-gaming-time' ||
      params.productId === 'ps5-gaming-service' ||
      params.productName.toLowerCase().includes('playstation')
    ) {
      throw new Error('PlayStation gaming time is a paid lounge service and cannot be added as a cafeteria item.');
    }

    const tab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE id = ? AND status = 'Active'")
      .get(params.tabId);

    if (!tab) {
      throw new Error('Active tab not found');
    }

    const qty = Math.max(1, params.quantity);
    const unitPrice = Math.max(0, params.unitPriceUsd);

    // Check if the item is already on the tab
    const existing = this.db
      .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ? AND product_id = ?')
      .get(params.tabId, params.productId) as DineInTabItemEntity | undefined;

    let resultItem: DineInTabItemEntity;

    if (existing) {
      const newQty = existing.quantity + qty;
      const newLineTotal = Math.round(newQty * unitPrice * 100) / 100;
      this.db
        .prepare(`
          UPDATE dine_in_tab_items
          SET quantity = ?, line_total_usd = ?
          WHERE id = ?
        `)
        .run(newQty, newLineTotal, existing.id);

      resultItem = {
        ...existing,
        quantity: newQty,
        line_total_usd: newLineTotal,
      };
    } else {
      const itemId = `titem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const lineTotal = Math.round(qty * unitPrice * 100) / 100;
      const nowIso = new Date().toISOString();

      this.db
        .prepare(`
          INSERT INTO dine_in_tab_items (
            id, tab_id, product_id, product_name, quantity, unit_price_usd, line_total_usd, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          itemId,
          params.tabId,
          params.productId,
          params.productName,
          qty,
          unitPrice,
          lineTotal,
          params.notes || null,
          nowIso,
        );

      resultItem = {
        id: itemId,
        tab_id: params.tabId,
        product_id: params.productId,
        product_name: params.productName,
        quantity: qty,
        unit_price_usd: unitPrice,
        line_total_usd: lineTotal,
        notes: params.notes,
        created_at: nowIso,
      };
    }

    // Touch tab updated_at
    this.db
      .prepare("UPDATE dine_in_tabs SET updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(params.tabId);

    logger.info('TablesService', `Added ${params.productName} (x${qty}) to tab ${params.tabId}`);
    return resultItem;
  }

  /**
   * Update item quantity directly (e.g. from stepper)
   */
  public updateItemQuantity(itemId: string, quantity: number): boolean {
    if (quantity <= 0) {
      return this.removeItemFromTab(itemId);
    }

    const item = this.db
      .prepare('SELECT * FROM dine_in_tab_items WHERE id = ?')
      .get(itemId) as DineInTabItemEntity | undefined;

    if (!item) {
      throw new Error('Item not found');
    }

    const lineTotal = Math.round(quantity * item.unit_price_usd * 100) / 100;
    this.db
      .prepare('UPDATE dine_in_tab_items SET quantity = ?, line_total_usd = ? WHERE id = ?')
      .run(quantity, lineTotal, itemId);

    this.db
      .prepare("UPDATE dine_in_tabs SET updated_at = datetime('now', 'localtime') WHERE id = ?")
      .run(item.tab_id);

    return true;
  }

  /**
   * Remove item from tab
   */
  public removeItemFromTab(itemId: string): boolean {
    const item = this.db
      .prepare('SELECT tab_id FROM dine_in_tab_items WHERE id = ?')
      .get(itemId) as { tab_id: string } | undefined;

    this.db.prepare('DELETE FROM dine_in_tab_items WHERE id = ?').run(itemId);

    if (item) {
      this.db
        .prepare("UPDATE dine_in_tabs SET updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(item.tab_id);
    }

    logger.info('TablesService', `Removed item ${itemId} from tab`);
    return true;
  }

  /**
   * Transfer / Move active tab from one table to another
   */
  public transferTable(sourceTableId: string, targetTableId: string): DineInTabEntity {
    if (sourceTableId === targetTableId) {
      throw new Error('Source and destination tables must be different');
    }

    const sourceTab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(sourceTableId) as any;

    if (!sourceTab) {
      throw new Error('No active running tab on the source table');
    }

    const targetTable = this.db
      .prepare('SELECT * FROM dine_in_tables WHERE id = ? AND is_active = 1')
      .get(targetTableId) as DineInTableEntity | undefined;

    if (!targetTable) {
      throw new Error('Destination table not found or inactive');
    }

    const existingTargetTab = this.db
      .prepare("SELECT id FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(targetTableId);

    if (existingTargetTab) {
      throw new Error(`Destination table "${targetTable.name}" is already occupied! Transfer cannot overwrite an occupied table.`);
    }

    this.db
      .prepare(`
        UPDATE dine_in_tabs
        SET table_id = ?, table_name = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `)
      .run(targetTable.id, targetTable.name, sourceTab.id);

    logger.info(
      'TablesService',
      `Transferred tab ${sourceTab.id} from table ${sourceTab.table_name} to ${targetTable.name}`,
    );

    const fullState = this.getTablesAndTabs();
    const updated = fullState.tablesWithTabs.find((t) => t.table.id === targetTableId);
    return updated!.activeTab!;
  }

  /**
   * Merge one table into another (e.g. Table 8 into Table 9)
   */
  public mergeTables(sourceTableId: string, targetTableId: string): DineInTabEntity {
    if (sourceTableId === targetTableId) {
      throw new Error('Source and target tables must be different');
    }

    const sourceTab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(sourceTableId) as any;

    if (!sourceTab) {
      throw new Error('No active open tab on the source table to merge');
    }

    const targetTab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(targetTableId) as any;

    if (!targetTab) {
      throw new Error('Target table does not have an active tab. Use Table Transfer instead.');
    }

    const sourceItems = this.db
      .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ?')
      .all(sourceTab.id) as DineInTabItemEntity[];

    const nowIso = new Date().toISOString();

    this.db.transaction(() => {
      // Combine items into target tab
      for (const item of sourceItems) {
        const existing = this.db
          .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ? AND product_id = ?')
          .get(targetTab.id, item.product_id) as DineInTabItemEntity | undefined;

        if (existing) {
          const newQty = existing.quantity + item.quantity;
          const newLineTotal = Math.round(newQty * existing.unit_price_usd * 100) / 100;
          this.db
            .prepare('UPDATE dine_in_tab_items SET quantity = ?, line_total_usd = ? WHERE id = ?')
            .run(newQty, newLineTotal, existing.id);
          this.db
            .prepare('DELETE FROM dine_in_tab_items WHERE id = ?')
            .run(item.id);
        } else {
          this.db
            .prepare('UPDATE dine_in_tab_items SET tab_id = ? WHERE id = ?')
            .run(targetTab.id, item.id);
        }
      }

      // Merge customer name if present
      let mergedName = targetTab.customer_name || '';
      if (sourceTab.customer_name && !mergedName.includes(sourceTab.customer_name)) {
        mergedName = mergedName ? `${mergedName} & ${sourceTab.customer_name}` : sourceTab.customer_name;
      }

      // Update target tab
      this.db
        .prepare('UPDATE dine_in_tabs SET customer_name = ?, updated_at = ? WHERE id = ?')
        .run(mergedName || null, nowIso, targetTab.id);

      // Close source tab and free source table
      this.db
        .prepare("UPDATE dine_in_tabs SET status = 'Completed', notes = ?, closed_at = ? WHERE id = ?")
        .run(`Merged into ${targetTab.table_name}`, nowIso, sourceTab.id);
    })();

    logger.info('TablesService', `Merged tab ${sourceTab.id} into ${targetTab.id}`);
    const fullState = this.getTablesAndTabs();
    const updated = fullState.tablesWithTabs.find((t) => t.table.id === targetTableId);
    return updated!.activeTab!;
  }

  /**
   * Transfer active table tab items into a PlayStation gaming console
   */
  public transferTableToPlaystation(
    tableId: string,
    stationId: string,
    playersCount: number = 2,
  ): any {
    const sourceTab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")
      .get(tableId) as any;

    if (!sourceTab) {
      throw new Error('No active open tab on this table');
    }

    const station = this.db
      .prepare('SELECT * FROM playstation_stations WHERE id = ?')
      .get(stationId) as any;

    if (!station) {
      throw new Error(`PlayStation station ${stationId} not found`);
    }

    // Check if station has active session, otherwise start one
    let session = this.db
      .prepare("SELECT * FROM playstation_sessions WHERE station_id = ? AND status = 'Active'")
      .get(stationId) as any;

    const nowIso = new Date().toISOString();
    const rates = this.ratesService.getRates();

    if (!session) {
      const sessionId = `ps-sess-${Date.now()}`;
      const hourlyLbp = playersCount * rates.ratePerPlayerHourLbp;
      const hourlyUsd = rates.usdToLbpRate > 0 ? hourlyLbp / rates.usdToLbpRate : 4.47;

      this.db
        .prepare(`
          INSERT INTO playstation_sessions (
            id, station_id, station_name, players_count, hourly_rate_lbp, hourly_rate_usd,
            start_time, status, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
        `)
        .run(
          sessionId,
          station.id,
          station.name,
          playersCount,
          hourlyLbp,
          hourlyUsd,
          nowIso,
          `Transferred from ${sourceTab.table_name}`,
          nowIso,
        );
      session = this.db.prepare('SELECT * FROM playstation_sessions WHERE id = ?').get(sessionId) as any;
    }

    // Transfer items from table to playstation_session_items
    const tableItems = this.db
      .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ?')
      .all(sourceTab.id) as DineInTabItemEntity[];

    for (const it of tableItems) {
      const psItemId = `ps-item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.db
        .prepare(`
          INSERT INTO playstation_session_items (
            id, session_id, product_id, product_name, quantity, unit_price_usd, line_total_usd, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          psItemId,
          session.id,
          it.product_id,
          it.product_name,
          it.quantity,
          it.unit_price_usd,
          it.line_total_usd,
          nowIso,
        );
    }

    // Close the table tab and free the table
    this.db
      .prepare("UPDATE dine_in_tabs SET status = 'Completed', notes = ?, closed_at = ? WHERE id = ?")
      .run(`Transferred to ${station.name}`, nowIso, sourceTab.id);

    logger.info('TablesService', `Transferred tab ${sourceTab.id} to PlayStation console ${station.name}`);
    return { success: true, sessionId: session.id, stationName: station.name };
  }

  /**
   * Checkout / Settle a running tab and record complete sale
   */
  public checkoutTab(params: {
    tabId: string;
    cashierId?: string;
    payments: Array<{
      paymentMethod: string;
      amount: number;
      referenceNumber?: string;
      notes?: string;
    }>;
    exchangeRate: number;
    paidUsd: number;
    paidLbp: number;
    changeUsd: number;
    changeLbp: number;
    customerName?: string;
    customerPhone?: string;
    notes?: string;
  }): any {
    const tab = this.db
      .prepare("SELECT * FROM dine_in_tabs WHERE id = ? AND status = 'Active'")
      .get(params.tabId) as any;

    if (!tab) {
      throw new Error('Active tab not found');
    }

    const items = this.db
      .prepare('SELECT * FROM dine_in_tab_items WHERE tab_id = ?')
      .all(params.tabId) as DineInTabItemEntity[];

    if (items.length === 0) {
      // Empty tab: simply cancel or complete
      this.db
        .prepare("UPDATE dine_in_tabs SET status = 'Completed', closed_at = datetime('now', 'localtime') WHERE id = ?")
        .run(params.tabId);
      return { success: true, message: 'Empty tab closed' };
    }

    const grandTotalUsd = Math.round(items.reduce((sum, it) => sum + it.line_total_usd, 0) * 100) / 100;
    const saleId = crypto.randomUUID();
    const invoiceNumber = this.numberingService.generateNextNumber('inv');
    const now = new Date().toISOString();

    const customerName = params.customerName || tab.customer_name || 'Dine-In Customer';
    const customerPhone = params.customerPhone || tab.customer_phone || null;

    if (customerName && customerPhone) {
      this.upsertCustomer(customerName, customerPhone);
    }

    // Default unit fallback for line items
    let defaultUnit = this.db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
    if (!defaultUnit) {
      try {
        this.db.prepare(`
          INSERT OR IGNORE INTO units (id, code, name_en, name_ar, symbol, unit_category, is_active)
          VALUES ('unit-piece', 'PCS', 'Piece', 'قطعة', 'pc', 'Count', 1)
        `).run();
        defaultUnit = { id: 'unit-piece' };
      } catch {
        // ignore
      }
    }
    const fallbackUnitId = defaultUnit?.id || 'unit-piece';

    // Ensure PS5 lounge category exists
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO categories (id, name_en, name_ar, icon, display_order)
        VALUES ('cat-playstation', 'PlayStation Lounge', 'صالة بلايستيشن 5', '🎮', 99)
      `).run();
    } catch {
      // ignore
    }

    // Ensure PS5 gaming products exist in products table
    try {
      this.db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-service', 'PS5-SRV', 'PS5-SRV', 'PlayStation 5 Gaming Service', 'خدمة بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(fallbackUnitId);

      this.db.prepare(`
        INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
        VALUES ('ps5-gaming-time', 'PS5-TIME', 'PS5-TIME', 'PlayStation 5 Gaming Time', 'وقت لعب بلايستيشن 5', 'Service', 0, 0, 'cat-playstation', ?, 1)
      `).run(fallbackUnitId);
    } catch {
      // ignore
    }

    const insertSale = this.db.prepare(`
      INSERT INTO sales_orders (
        id, invoice_number, customer_name, customer_phone, notes,
        subtotal, item_discount, order_discount, tax_total, grand_total,
        paid_amount, change_amount, payment_status, payment_method,
        cashier_id, created_at, order_type, table_number, exchange_rate,
        paid_usd, paid_lbp, change_usd, change_lbp
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, 'Paid', ?, ?, ?, 'dine_in', ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO sales_order_items (
        id, sale_id, product_id, unit_id, quantity, unit_price, cost_price, discount, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
    `);

    const insertPayment = this.db.prepare(`
      INSERT INTO sales_payments (id, sale_id, payment_method, amount, reference_number, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const paymentMethodName = params.payments.length === 1 ? params.payments[0].paymentMethod : 'Split';

    this.db.transaction(() => {
      // 1. Insert Sales Order
      insertSale.run(
        saleId,
        invoiceNumber,
        customerName,
        customerPhone,
        params.notes || tab.notes || `Dine-In Tab - ${tab.table_name}`,
        grandTotalUsd,
        grandTotalUsd,
        grandTotalUsd,
        params.changeUsd || 0,
        paymentMethodName,
        params.cashierId || 'cashier',
        now,
        tab.table_name,
        params.exchangeRate || 89500,
        params.paidUsd || 0,
        params.paidLbp || 0,
        params.changeUsd || 0,
        params.changeLbp || 0,
      );

      // 2. Insert items
      for (const it of items) {
        // Ensure product exists in products table before inserting to prevent foreign key errors
        let prod = this.db.prepare('SELECT id, base_unit_id FROM products WHERE id = ?').get(it.product_id) as { id: string; base_unit_id: string } | undefined;
        if (!prod) {
          try {
            this.db.prepare(`
              INSERT OR IGNORE INTO products (id, sku, primary_barcode, name_en, name_ar, product_type, selling_price, purchase_cost, category_id, base_unit_id, is_active)
              VALUES (?, ?, ?, ?, ?, 'Service', ?, 0, 'cat-playstation', ?, 1)
            `).run(
              it.product_id,
              `SRV-${it.product_id.slice(-8)}`,
              `SRV-${it.product_id.slice(-8)}`,
              it.product_name || 'Service Item',
              it.product_name || 'خدمة',
              it.unit_price_usd || 0,
              fallbackUnitId,
            );
            prod = this.db.prepare('SELECT id, base_unit_id FROM products WHERE id = ?').get(it.product_id) as { id: string; base_unit_id: string } | undefined;
          } catch {
            // ignore
          }
        }

        const itemUnitId = prod?.base_unit_id || fallbackUnitId;

        insertItem.run(
          crypto.randomUUID(),
          saleId,
          it.product_id,
          itemUnitId,
          it.quantity,
          it.unit_price_usd,
          it.line_total_usd,
        );
      }

      // 3. Insert payments
      for (const p of params.payments) {
        insertPayment.run(
          crypto.randomUUID(),
          saleId,
          p.paymentMethod,
          p.amount,
          p.referenceNumber || null,
          p.notes || null,
          now,
        );
      }

      // 4. Mark tab completed
      this.db
        .prepare("UPDATE dine_in_tabs SET status = 'Completed', closed_at = ? WHERE id = ?")
        .run(now, params.tabId);
    })();

    logger.info('TablesService', `Successfully checked out tab ${params.tabId} on ${tab.table_name}, Invoice: ${invoiceNumber}`);

    // Return the sale record for receipt preview with product names enriched
    const completedSale = this.db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(saleId) as any;

    const enrichedItems = items.map((it) => {
      let prod: any;
      try {
        prod = this.db.prepare('SELECT name_en, name_ar FROM products WHERE id = ?').get(it.product_id);
      } catch {
        // ignore
      }
      return {
        id: it.id,
        sale_id: saleId,
        product_id: it.product_id,
        name_en: it.product_name || prod?.name_en || 'Item',
        name_ar: it.product_name || prod?.name_ar || 'صنف',
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price_usd,
        unit_price_usd: it.unit_price_usd,
        line_total: it.line_total_usd,
        line_total_usd: it.line_total_usd,
      };
    });

    return {
      ...completedSale,
      items: enrichedItems,
    };
  }
}
