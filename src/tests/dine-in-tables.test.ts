import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { TablesService } from '../main/services/tables.service';
import { RatesService } from '../main/services/rates.service';

describe('Dine-In Tables & Running Tabs System', () => {
  let mockDb: any;
  let tablesService: TablesService;
  let ratesService: RatesService;

  let tablesStore: any[];
  let tabsStore: any[];
  let tabItemsStore: any[];
  let customersStore: any[];
  let salesOrdersStore: any[];
  let settingsStore: Record<string, string>;

  beforeEach(() => {
    settingsStore = {
      usd_to_lbp_rate: '89500',
    };

    // 15 Default Tables
    tablesStore = Array.from({ length: 15 }, (_, i) => ({
      id: `tbl-${i + 1}`,
      name: `Table ${i + 1}`,
      capacity: 4,
      display_order: i + 1,
      is_active: 1,
      created_at: new Date().toISOString(),
    }));

    tabsStore = [];
    tabItemsStore = [];
    customersStore = [];
    salesOrdersStore = [];

    mockDb = {
      transaction: (fn: any) => fn,
      prepare: (sql: string) => {
        // Business settings
        if (sql.includes("key = 'usd_to_lbp_rate'")) {
          return {
            get: () => ({ value: settingsStore['usd_to_lbp_rate'] || '89500' }),
          };
        }

        // Tables Queries
        if (sql.includes('SELECT * FROM dine_in_tables WHERE is_active = 1')) {
          return {
            all: () => tablesStore.filter((t) => t.is_active === 1),
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tables WHERE id = ?')) {
          return {
            get: (id: string) => tablesStore.find((t) => t.id === id),
          };
        }

        if (sql.includes('SELECT id FROM dine_in_tables WHERE name = ?')) {
          return {
            get: (name: string) => tablesStore.find((t) => t.name === name),
          };
        }

        if (sql.includes('SELECT MAX(display_order) as maxOrder FROM dine_in_tables')) {
          return {
            get: () => ({ maxOrder: tablesStore.length }),
          };
        }

        if (sql.includes('INSERT INTO dine_in_tables')) {
          return {
            run: (...args: any[]) => {
              const newTbl = {
                id: args[0],
                name: args[1],
                capacity: args[2],
                display_order: args[3],
                is_active: 1,
                created_at: new Date().toISOString(),
              };
              tablesStore.push(newTbl);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE dine_in_tables')) {
          return {
            run: (...args: any[]) => {
              const name = args[0];
              const cap = args[1];
              const id = args[2];
              const t = tablesStore.find((tbl) => tbl.id === id);
              if (t) {
                t.name = name;
                t.capacity = cap;
              }
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('DELETE FROM dine_in_tables WHERE id = ?')) {
          return {
            run: (id: string) => {
              tablesStore = tablesStore.filter((t) => t.id !== id);
              return { changes: 1 };
            },
          };
        }

        // Tabs Queries
        if (sql.includes("SELECT * FROM dine_in_tabs WHERE status = 'Active'")) {
          return {
            all: () => tabsStore.filter((t) => t.status === 'Active'),
          };
        }

        if (sql.includes("SELECT id FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'") ||
            sql.includes("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")) {
          return {
            get: (tableId: string) => tabsStore.find((t) => t.table_id === tableId && t.status === 'Active'),
          };
        }

        if (sql.includes("SELECT * FROM dine_in_tabs WHERE id = ? AND status = 'Active'") ||
            sql.includes('SELECT * FROM dine_in_tabs WHERE id = ?')) {
          return {
            get: (id: string) => tabsStore.find((t) => t.id === id),
          };
        }

        if (sql.includes('INSERT INTO dine_in_tabs')) {
          return {
            run: (...args: any[]) => {
              const newTab = {
                id: args[0],
                table_id: args[1],
                table_name: args[2],
                customer_name: args[3],
                customer_phone: args[4],
                opened_at: args[5],
                status: 'Active',
                notes: args[6],
                created_at: args[7],
                updated_at: args[8],
              };
              tabsStore.push(newTab);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE dine_in_tabs') && sql.includes('table_id = ?')) {
          return {
            run: (...args: any[]) => {
              const targetTableId = args[0];
              const targetTableName = args[1];
              const tabId = args[2];
              const tab = tabsStore.find((t) => t.id === tabId);
              if (tab) {
                tab.table_id = targetTableId;
                tab.table_name = targetTableName;
              }
              return { changes: 1 };
            },
          };
        }

        if (sql.includes("UPDATE dine_in_tabs SET status = 'Completed'")) {
          return {
            run: (...args: any[]) => {
              const closedAt = args[0];
              const tabId = args[1];
              const tab = tabsStore.find((t) => t.id === tabId);
              if (tab) {
                tab.status = 'Completed';
                tab.closed_at = closedAt;
              }
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE dine_in_tabs')) {
          return {
            run: () => ({ changes: 1 }),
          };
        }

        // Tab Items Queries
        if (sql.includes('FROM dine_in_tab_items i')) {
          return {
            all: () => {
              const activeTabIds = new Set(tabsStore.filter((t) => t.status === 'Active').map((t) => t.id));
              return tabItemsStore.filter((i) => activeTabIds.has(i.tab_id));
            },
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tab_items WHERE tab_id = ? AND product_id = ?')) {
          return {
            get: (tabId: string, prodId: string) =>
              tabItemsStore.find((i) => i.tab_id === tabId && i.product_id === prodId),
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tab_items WHERE tab_id = ?')) {
          return {
            all: (tabId: string) => tabItemsStore.filter((i) => i.tab_id === tabId),
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tab_items WHERE id = ?')) {
          return {
            get: (id: string) => tabItemsStore.find((i) => i.id === id),
          };
        }

        if (sql.includes('SELECT tab_id FROM dine_in_tab_items WHERE id = ?')) {
          return {
            get: (id: string) => tabItemsStore.find((i) => i.id === id),
          };
        }

        if (sql.includes('INSERT INTO dine_in_tab_items')) {
          return {
            run: (...args: any[]) => {
              const newItem = {
                id: args[0],
                tab_id: args[1],
                product_id: args[2],
                product_name: args[3],
                quantity: args[4],
                unit_price_usd: args[5],
                line_total_usd: args[6],
                notes: args[7],
                created_at: args[8],
              };
              tabItemsStore.push(newItem);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE dine_in_tab_items')) {
          return {
            run: (...args: any[]) => {
              const qty = args[0];
              const lineTotal = args[1];
              const id = args[2];
              const item = tabItemsStore.find((i) => i.id === id);
              if (item) {
                item.quantity = qty;
                item.line_total_usd = lineTotal;
              }
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('DELETE FROM dine_in_tab_items WHERE id = ?')) {
          return {
            run: (id: string) => {
              tabItemsStore = tabItemsStore.filter((i) => i.id !== id);
              return { changes: 1 };
            },
          };
        }

        // Customer Lookup Queries
        if (sql.includes('FROM customers WHERE phone = ?')) {
          return {
            get: (phone: string) => customersStore.find((c) => c.phone === phone),
          };
        }

        if (sql.includes('INSERT INTO customers')) {
          return {
            run: (...args: any[]) => {
              const id = args[0];
              const name = args[1];
              const phone = args[2];
              const existing = customersStore.find((c) => c.phone === phone);
              if (existing) {
                if (name) existing.name = name;
              } else {
                customersStore.push({ id, name, phone });
              }
              return { changes: 1 };
            },
          };
        }

        // Sales Orders / Units
        if (sql.includes('SELECT id FROM units LIMIT 1')) {
          return {
            get: () => ({ id: 'unit-1' }),
          };
        }

        if (sql.includes('SELECT * FROM numbering_sequences')) {
          return {
            get: () => ({ prefix: 'INV', current_number: 101, padding: 6, include_year: 1 }),
          };
        }

        if (sql.includes('INSERT INTO sales_orders')) {
          return {
            run: (...args: any[]) => {
              const sale = {
                id: args[0],
                invoice_number: args[1],
                customer_name: args[2],
                customer_phone: args[3],
                notes: args[4],
                subtotal: args[5],
                grand_total: args[6],
                paid_amount: args[7],
                change_amount: args[8],
                payment_method: args[9],
                cashier_id: args[10],
                created_at: args[11],
                order_type: 'dine_in',
                table_number: args[12],
                exchange_rate: args[13],
                paid_usd: args[14],
                paid_lbp: args[15],
                change_usd: args[16],
                change_lbp: args[17],
              };
              salesOrdersStore.push(sale);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('INSERT INTO sales_order_items') || sql.includes('INSERT INTO sales_payments')) {
          return {
            run: () => ({ changes: 1 }),
          };
        }

        if (sql.includes('SELECT * FROM sales_orders WHERE id = ?')) {
          return {
            get: (id: string) => salesOrdersStore.find((s) => s.id === id),
          };
        }

        if (sql.includes('SELECT * FROM sales_order_items WHERE sale_id = ?')) {
          return {
            all: () => [{ id: 'soi-1', product_name: 'Special Green Tea', quantity: 2, line_total: 7.0 }],
          };
        }

        return {
          get: () => undefined,
          all: () => [],
          run: () => ({ changes: 1 }),
        };
      },
    };

    ratesService = new RatesService(mockDb as unknown as Database.Database);
    tablesService = new TablesService(mockDb as unknown as Database.Database, ratesService);
  });

  it('1. should seed 15 default tables (Table 1 through Table 15)', () => {
    const { tablesWithTabs } = tablesService.getTablesAndTabs();
    expect(tablesWithTabs).toHaveLength(15);
    expect(tablesWithTabs[0].table.name).toBe('Table 1');
    expect(tablesWithTabs[14].table.name).toBe('Table 15');
    expect(tablesWithTabs.every((t) => t.activeTab === null)).toBe(true);
  });

  it('2. manager can add, rename, and delete tables', () => {
    // Add Table
    const table16 = tablesService.createTable('Table 16', 6);
    expect(table16.name).toBe('Table 16');
    expect(table16.capacity).toBe(6);

    let state = tablesService.getTablesAndTabs();
    expect(state.tablesWithTabs).toHaveLength(16);

    // Rename Table
    const updated = tablesService.updateTable(table16.id, 'Terrace VIP', 8);
    expect(updated.name).toBe('Terrace VIP');
    expect(updated.capacity).toBe(8);

    // Delete Table
    const deleted = tablesService.deleteTable(table16.id);
    expect(deleted).toBe(true);

    state = tablesService.getTablesAndTabs();
    expect(state.tablesWithTabs).toHaveLength(15);
  });

  it('3. opens a running tab and saves customer phone for future autofill', () => {
    // Customer "Ali Bassam" arrives with phone "70123456"
    const tab = tablesService.openTab({
      tableId: 'tbl-1',
      customerName: 'Ali Bassam',
      customerPhone: '70123456',
      notes: 'Terrace preference',
    });

    expect(tab.customer_name).toBe('Ali Bassam');
    expect(tab.customer_phone).toBe('70123456');
    expect(tab.status).toBe('Active');

    // Verify lookup by phone works
    const lookup = tablesService.lookupCustomerByPhone('70123456');
    expect(lookup.found).toBe(true);
    expect(lookup.name).toBe('Ali Bassam');
    expect(lookup.phone).toBe('70123456');

    // Next visit: Customer provides ONLY phone number "70123456" without typing their name
    const tab2 = tablesService.openTab({
      tableId: 'tbl-2',
      customerPhone: '70123456', // No customerName provided!
    });

    // Name should be autofilled from memory!
    expect(tab2.customer_name).toBe('Ali Bassam');
  });

  it('4. adds items to running tab, updates quantities, and calculates dual totals ($ and LBP)', () => {
    const tab = tablesService.openTab({
      tableId: 'tbl-1',
      customerName: 'Karim',
    });

    // Add 2 Turkish Coffees at $2.50 ea
    const item1 = tablesService.addItemToTab({
      tabId: tab.id,
      productId: 'prod-coffee',
      productName: 'Turkish Coffee',
      quantity: 2,
      unitPriceUsd: 2.5,
    });
    expect(item1.quantity).toBe(2);
    expect(item1.line_total_usd).toBe(5.0);

    // Add 1 Shisha at $8.00
    tablesService.addItemToTab({
      tabId: tab.id,
      productId: 'prod-shisha',
      productName: 'Double Apple Shisha',
      quantity: 1,
      unitPriceUsd: 8.0,
    });

    // Add 2 more Turkish Coffees (stepping up to 4 total)
    tablesService.addItemToTab({
      tabId: tab.id,
      productId: 'prod-coffee',
      productName: 'Turkish Coffee',
      quantity: 2,
      unitPriceUsd: 2.5,
    });

    const state = tablesService.getTablesAndTabs();
    const t1State = state.tablesWithTabs.find((t) => t.table.name === 'Table 1')!;
    expect(t1State.activeTab).not.toBeNull();
    expect(t1State.activeTab!.items).toHaveLength(2);

    const coffeeItem = t1State.activeTab!.items.find((i) => i.product_id === 'prod-coffee')!;
    expect(coffeeItem.quantity).toBe(4);
    expect(coffeeItem.line_total_usd).toBe(10.0);

    // Total: $10.00 (Coffee) + $8.00 (Shisha) = $18.00
    expect(t1State.activeTab!.total_usd).toBe(18.0);
    // At 89,500 LBP/USD, $18.00 = 1,611,000 LBP
    expect(t1State.activeTab!.total_lbp).toBe(1611000);
  });

  it('5. prevents adding playstation gaming item as cafeteria product', () => {
    const tab = tablesService.openTab({ tableId: 'tbl-1' });

    expect(() => {
      tablesService.addItemToTab({
        tabId: tab.id,
        productId: 'ps5-gaming-time',
        productName: 'PlayStation 5 Gaming Time',
        quantity: 1,
        unitPriceUsd: 5.0,
      });
    }).toThrow(/PlayStation gaming time is a paid lounge service/);
  });

  it('6. transfers running tab to another available table and frees original table', () => {
    const tab = tablesService.openTab({
      tableId: 'tbl-1',
      customerName: 'Samir',
      customerPhone: '03998877',
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: 'prod-latte',
      productName: 'Vanilla Latte',
      quantity: 3,
      unitPriceUsd: 4.0,
    });

    // Transfer Table 1 -> Table 5
    const movedTab = tablesService.transferTable('tbl-1', 'tbl-5');
    expect(movedTab.table_id).toBe('tbl-5');
    expect(movedTab.table_name).toBe('Table 5');

    const state = tablesService.getTablesAndTabs();
    const t1 = state.tablesWithTabs.find((t) => t.table.name === 'Table 1')!;
    const t5 = state.tablesWithTabs.find((t) => t.table.name === 'Table 5')!;

    // Table 1 is now available!
    expect(t1.activeTab).toBeNull();

    // Table 5 now has Samir's tab with all 3 Vanilla Lattes ($12.00)!
    expect(t5.activeTab).not.toBeNull();
    expect(t5.activeTab!.customer_name).toBe('Samir');
    expect(t5.activeTab!.total_usd).toBe(12.0);
  });

  it('7. checks out running tab, creates sales order with receipt info, and frees table', () => {
    const tab = tablesService.openTab({
      tableId: 'tbl-1',
      customerName: 'Hassan',
      customerPhone: '71554433',
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: 'prod-tea',
      productName: 'Special Green Tea',
      quantity: 2,
      unitPriceUsd: 3.5,
    });

    // Total = $7.00
    const checkoutResult = tablesService.checkoutTab({
      tabId: tab.id,
      cashierId: 'caisse-1',
      payments: [{ paymentMethod: 'Cash USD', amount: 7.0 }],
      exchangeRate: 89500,
      paidUsd: 10.0,
      paidLbp: 0,
      changeUsd: 3.0,
      changeLbp: 268500,
      customerName: 'Hassan',
      customerPhone: '71554433',
    });

    expect(checkoutResult.grand_total).toBe(7.0);
    expect(checkoutResult.order_type).toBe('dine_in');
    expect(checkoutResult.table_number).toBe('Table 1');
    expect(checkoutResult.customer_name).toBe('Hassan');
    expect(checkoutResult.customer_phone).toBe('71554433');
    expect(checkoutResult.change_usd).toBe(3.0);
    expect(checkoutResult.items).toHaveLength(1);

    // Table 1 must now be freed (Available)!
    const state = tablesService.getTablesAndTabs();
    const t1 = state.tablesWithTabs.find((t) => t.table.name === 'Table 1')!;
    expect(t1.activeTab).toBeNull();
  });

  it('8. checks out tab with transferred playstation gaming session and preserves service title', () => {
    const tab = tablesService.openTab({
      tableId: 'tbl-2',
      customerName: 'Ali Bassam',
      customerPhone: '03123456',
    });

    // Directly insert the gaming session item as PlayStation service does
    mockDb.prepare('INSERT INTO dine_in_tab_items').run(
      'titem-ps5-1',
      tab.id,
      'ps5-gaming-service',
      '🎮 PS5 - Console 1 (2P, 1m)',
      1,
      0.02,
      0.02,
      '2 players',
      new Date().toISOString(),
    );

    const checkoutResult = tablesService.checkoutTab({
      tabId: tab.id,
      cashierId: 'caisse-1',
      payments: [{ paymentMethod: 'Cash USD', amount: 0.02 }],
      exchangeRate: 89500,
      paidUsd: 1.0,
      paidLbp: 0,
      changeUsd: 0.98,
      changeLbp: 87710,
      customerName: 'Ali Bassam',
      customerPhone: '03123456',
    });

    expect(checkoutResult.grand_total).toBe(0.02);
    expect(checkoutResult.table_number).toBe('Table 2');
    expect(checkoutResult.items).toHaveLength(1);
    expect(checkoutResult.items[0].product_id).toBe('ps5-gaming-service');
    expect(checkoutResult.items[0].name_en).toBe('🎮 PS5 - Console 1 (2P, 1m)');
  });
});
