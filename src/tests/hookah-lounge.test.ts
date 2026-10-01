import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { HookahService } from '../main/services/hookah.service';
import { TablesService } from '../main/services/tables.service';
import { RatesService } from '../main/services/rates.service';

describe('Hookah & Shisha Lounge System', () => {
  let mockDb: any;
  let hookahService: HookahService;
  let tablesService: TablesService;
  let ratesService: RatesService;

  let flavorsStore: any[];
  let productsStore: any[];
  let tabsStore: any[];
  let tabItemsStore: any[];
  let salesOrdersStore: any[];
  let salesOrderItemsStore: any[];
  let tablesStore: any[];

  beforeEach(() => {
    flavorsStore = [];
    productsStore = [];
    tabsStore = [];
    tabItemsStore = [];
    salesOrdersStore = [];
    salesOrderItemsStore = [];
    tablesStore = [
      { id: 'tbl-1', name: 'Table 1', capacity: 4, display_order: 1, is_active: 1 },
      { id: 'tbl-2', name: 'Table 2', capacity: 4, display_order: 2, is_active: 1 },
    ];

    mockDb = {
      exec: vi.fn(),
      transaction: (fn: any) => fn,
      prepare: (sql: string) => {
        // Units
        if (sql.includes('SELECT id FROM units LIMIT 1')) {
          return {
            get: () => ({ id: 'unit-piece' }),
          };
        }

        // Settings / Rates
        if (sql.includes("key = 'usd_to_lbp_rate'")) {
          return {
            get: () => ({ value: '89500' }),
          };
        }

        // Hookah Flavors
        if (sql.includes('SELECT * FROM hookah_flavors WHERE id = ?') || sql.includes('SELECT id FROM hookah_flavors WHERE id = ?')) {
          return {
            get: (id: string) => flavorsStore.find((f) => f.id === id),
          };
        }

        if (sql.includes('SELECT * FROM hookah_flavors WHERE is_active = 1')) {
          return {
            all: () => flavorsStore.filter((f) => f.is_active === 1),
          };
        }

        if (sql.includes('SELECT * FROM hookah_flavors')) {
          return {
            all: () => flavorsStore,
          };
        }

        if (sql.includes('INSERT INTO hookah_flavors')) {
          return {
            run: (...args: any[]) => {
              const flv = {
                id: args[0],
                name_en: args[1],
                name_ar: args[2],
                price_usd: args[3],
                price_lbp: args[4],
                refill_price_usd: args[5],
                refill_price_lbp: args[6],
                display_order: args[7],
                is_active: args[8],
                created_at: args[9],
                updated_at: args[10],
              };
              flavorsStore.push(flv);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE hookah_flavors SET name_en = ?') || (sql.includes('UPDATE hookah_flavors SET') && sql.includes('price_usd = ?'))) {
          return {
            run: (...args: any[]) => {
              const [name_en, name_ar, price_usd, price_lbp, refill_price_usd, refill_price_lbp, display_order, is_active, updated_at, id] = args;
              const f = flavorsStore.find((flv) => flv.id === id);
              if (f) {
                Object.assign(f, {
                  name_en,
                  name_ar,
                  price_usd,
                  price_lbp,
                  refill_price_usd,
                  refill_price_lbp,
                  display_order,
                  is_active,
                  updated_at,
                });
              }
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE hookah_flavors SET is_active = 0')) {
          return {
            run: (updated_at: string, id: string) => {
              const f = flavorsStore.find((flv) => flv.id === id);
              if (f) {
                f.is_active = 0;
                f.updated_at = updated_at;
              }
              return { changes: 1 };
            },
          };
        }

        // Tables Queries
        if (sql.includes('SELECT * FROM dine_in_tables WHERE is_active = 1')) {
          return {
            all: () => tablesStore,
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tables WHERE id = ?')) {
          return {
            get: (id: string) => tablesStore.find((t) => t.id === id),
          };
        }

        // Tabs
        if (sql.includes("SELECT * FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'") ||
            sql.includes("SELECT id FROM dine_in_tabs WHERE table_id = ? AND status = 'Active'")) {
          return {
            get: (tblId: string) => tabsStore.find((t) => t.table_id === tblId && t.status === 'Active'),
          };
        }

        if (sql.includes("SELECT * FROM dine_in_tabs WHERE id = ? AND status = 'Active'") ||
            sql.includes('SELECT * FROM dine_in_tabs WHERE id = ?')) {
          return {
            get: (id: string) => tabsStore.find((t) => t.id === id),
          };
        }

        if (sql.includes("SELECT * FROM dine_in_tabs WHERE status = 'Active'")) {
          return {
            all: () => tabsStore.filter((t) => t.status === 'Active'),
          };
        }

        if (sql.includes('INSERT INTO dine_in_tabs')) {
          return {
            run: (...args: any[]) => {
              const tab = {
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
              tabsStore.push(tab);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes("UPDATE dine_in_tabs SET status = 'Completed'")) {
          return {
            run: (closed_at: string, tabId: string) => {
              const t = tabsStore.find((tab) => tab.id === tabId);
              if (t) {
                t.status = 'Completed';
                t.closed_at = closed_at;
              }
              return { changes: 1 };
            },
          };
        }

        // Tab Items
        if (sql.includes('FROM dine_in_tab_items i')) {
          return {
            all: () => tabItemsStore,
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tab_items WHERE tab_id = ? AND product_id = ?')) {
          return {
            get: (tabId: string, prodId: string) => tabItemsStore.find((i) => i.tab_id === tabId && i.product_id === prodId),
          };
        }

        if (sql.includes('SELECT * FROM dine_in_tab_items WHERE tab_id = ?')) {
          return {
            all: (tabId: string) => tabItemsStore.filter((i) => i.tab_id === tabId),
          };
        }

        if (sql.includes('INSERT INTO dine_in_tab_items')) {
          return {
            run: (...args: any[]) => {
              const it = {
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
              tabItemsStore.push(it);
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('UPDATE dine_in_tab_items')) {
          return {
            run: (qty: number, total: number, id: string) => {
              const it = tabItemsStore.find((i) => i.id === id);
              if (it) {
                it.quantity = qty;
                it.line_total_usd = total;
              }
              return { changes: 1 };
            },
          };
        }

        // Numbering sequence
        if (sql.includes('FROM numbering_sequences')) {
          return {
            get: () => ({ prefix: 'INV', current_number: 101, padding: 6, include_year: 1 }),
          };
        }

        // Products
        if (sql.includes('SELECT id, base_unit_id FROM products WHERE id = ?') ||
            sql.includes('SELECT * FROM products WHERE id = ?') ||
            sql.includes('SELECT name_en, name_ar FROM products WHERE id = ?')) {
          return {
            get: (id: string) => productsStore.find((p) => p.id === id),
          };
        }

        if (sql.includes('INSERT OR IGNORE INTO products') || sql.includes('INSERT INTO products')) {
          return {
            run: (...args: any[]) => {
              productsStore.push({ id: args[0], name_en: args[3], name_ar: args[4] });
              return { changes: 1 };
            },
          };
        }

        // Sales Orders & Items
        if (sql.includes('INSERT INTO sales_orders')) {
          return {
            run: (...args: any[]) => {
              salesOrdersStore.push({
                id: args[0],
                invoice_number: args[1],
                grand_total: args[6],
                table_number: args[12],
              });
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('INSERT INTO sales_order_items')) {
          return {
            run: (...args: any[]) => {
              salesOrderItemsStore.push({ id: args[0], sale_id: args[1], product_id: args[2] });
              return { changes: 1 };
            },
          };
        }

        if (sql.includes('SELECT * FROM sales_orders WHERE id = ?')) {
          return {
            get: (id: string) => salesOrdersStore.find((s) => s.id === id),
          };
        }

        return {
          get: () => undefined,
          all: () => [],
          run: () => ({ changes: 1 }),
        };
      },
    };

    hookahService = new HookahService(mockDb as unknown as Database.Database);
    ratesService = new RatesService(mockDb as unknown as Database.Database);
    tablesService = new TablesService(mockDb as unknown as Database.Database, ratesService);
  });

  it('1. should allow saving and retrieving hookah flavors with USD and LBP prices', () => {
    const created = hookahService.saveFlavor({
      id: 'hk-two-apples',
      name_en: 'Two Apples',
      name_ar: 'تفاحتين',
      price_usd: 5.0,
      price_lbp: 450000,
      refill_price_usd: 3.0,
      refill_price_lbp: 270000,
      display_order: 1,
    });

    expect(created.id).toBe('hk-two-apples');
    expect(created.name_en).toBe('Two Apples');
    expect(created.name_ar).toBe('تفاحتين');
    expect(created.price_usd).toBe(5.0);
    expect(created.price_lbp).toBe(450000);
    expect(created.refill_price_usd).toBe(3.0);
    expect(created.refill_price_lbp).toBe(270000);

    const flavors = hookahService.getFlavors(true);
    expect(flavors).toHaveLength(1);
    expect(flavors[0].name_en).toBe('Two Apples');
  });

  it('2. manager can update flavor prices and changes reflect immediately', () => {
    hookahService.saveFlavor({
      id: 'hk-grape-mint',
      name_en: 'Grape & Mint',
      name_ar: 'عنب ونعنع',
      price_usd: 5.0,
      price_lbp: 450000,
      refill_price_usd: 3.0,
      refill_price_lbp: 270000,
    });

    // Update prices
    const updated = hookahService.saveFlavor({
      id: 'hk-grape-mint',
      name_en: 'Grape & Mint',
      name_ar: 'عنب ونعنع فاخر',
      price_usd: 6.0,
      price_lbp: 540000,
      refill_price_usd: 3.5,
      refill_price_lbp: 315000,
    });

    expect(updated.price_usd).toBe(6.0);
    expect(updated.price_lbp).toBe(540000);
    expect(updated.refill_price_usd).toBe(3.5);
    expect(updated.name_ar).toBe('عنب ونعنع فاخر');
  });

  it('3. adds full hookah and head refill to running table tab and calculates totals', () => {
    const flavor = hookahService.saveFlavor({
      id: 'hk-love-66',
      name_en: 'Love 66',
      name_ar: 'لوف 66',
      price_usd: 5.0,
      price_lbp: 450000,
      refill_price_usd: 3.0,
      refill_price_lbp: 270000,
    });

    const tab = tablesService.openTab({
      tableId: 'tbl-1',
      customerName: 'Ahmad',
      customerPhone: '70112233',
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: `hookah-${flavor.id}-full`,
      productName: '💨 لوف 66 (نفس كامل)',
      quantity: 1,
      unitPriceUsd: 5.0,
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: `hookah-${flavor.id}-refill`,
      productName: '💨 لوف 66 (تغيير راس)',
      quantity: 2,
      unitPriceUsd: 3.0,
    });

    const state = tablesService.getTablesAndTabs();
    const t1 = state.tablesWithTabs.find((t) => t.table.name === 'Table 1')!;

    expect(t1.activeTab).not.toBeNull();
    // 1 Full ($5.00) + 2 Refills ($6.00) = $11.00
    expect(t1.activeTab!.total_usd).toBe(11.0);
    expect(t1.activeTab!.items).toHaveLength(2);
  });

  it('4. checks out table tab with hookah items without foreign key errors and marks tab completed', () => {
    const flavor = hookahService.saveFlavor({
      id: 'hk-apples',
      name_en: 'Two Apples',
      name_ar: 'تفاحتين',
      price_usd: 5.0,
      price_lbp: 450000,
      refill_price_usd: 3.0,
      refill_price_lbp: 270000,
    });

    const tab = tablesService.openTab({
      tableId: 'tbl-2',
      customerName: 'Bilal',
      customerPhone: '03445566',
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: `hookah-${flavor.id}-full`,
      productName: '💨 تفاحتين (نفس كامل)',
      quantity: 1,
      unitPriceUsd: 5.0,
    });

    tablesService.addItemToTab({
      tabId: tab.id,
      productId: `hookah-${flavor.id}-refill`,
      productName: '💨 تفاحتين (تغيير راس)',
      quantity: 1,
      unitPriceUsd: 3.0,
    });

    const checkoutResult = tablesService.checkoutTab({
      tabId: tab.id,
      cashierId: 'caisse-1',
      payments: [{ paymentMethod: 'Cash USD', amount: 8.0 }],
      exchangeRate: 89500,
      paidUsd: 10.0,
      paidLbp: 0,
      changeUsd: 2.0,
      changeLbp: 179000,
      customerName: 'Bilal',
      customerPhone: '03445566',
    });

    expect(checkoutResult.grand_total).toBe(8.0);
    expect(checkoutResult.table_number).toBe('Table 2');
    expect(checkoutResult.items).toHaveLength(2);

    expect(salesOrderItemsStore).toHaveLength(2);

    const state = tablesService.getTablesAndTabs();
    const t2 = state.tablesWithTabs.find((t) => t.table.name === 'Table 2')!;
    expect(t2.activeTab).toBeNull();
  });
});
