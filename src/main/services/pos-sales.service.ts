import Database from 'better-sqlite3';
import { POSCheckoutInput } from '../../shared/validation';
import { SalesOrderEntity, DailyCloseoutReport } from '../../shared/types';
import { InventoryService } from './inventory.service';
import { PurchaseNumberingService } from './purchase-numbering.service';
import { ProductRepository } from '../database/repositories/product.repository';
import { AuditRepository } from '../database/repositories/audit.repository';
import { logger } from './logger.service';

export class POSSalesService {
  private db: Database.Database;
  private inventoryService: InventoryService;
  private numberingService: PurchaseNumberingService;
  private productRepo: ProductRepository;
  private auditRepo: AuditRepository;

  constructor(db: Database.Database) {
    this.db = db;
    this.inventoryService = new InventoryService(db);
    this.numberingService = new PurchaseNumberingService(db);
    this.productRepo = new ProductRepository(db);
    this.auditRepo = new AuditRepository(db);
  }

  public calculateSaleTotals(input: POSCheckoutInput) {
    let subtotal = 0;
    let itemDiscountTotal = 0;
    let taxTotal = 0;

    const items = input.items.map((item) => {
      const lineSub = Math.round(item.quantity * item.unitPrice * 100) / 100;
      const lineDisc = Math.round(item.discount * 100) / 100;
      const taxable = Math.max(0, lineSub - lineDisc);
      const tax = Math.round(taxable * (item.taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + tax) * 100) / 100;

      subtotal += lineSub;
      itemDiscountTotal += lineDisc;
      taxTotal += tax;

      return {
        ...item,
        taxAmount: tax,
        lineTotal,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    itemDiscountTotal = Math.round(itemDiscountTotal * 100) / 100;
    const orderDiscount = Math.round(input.orderDiscount * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;
    const grandTotal =
      Math.round((subtotal - itemDiscountTotal - orderDiscount + taxTotal) * 100) / 100;

    const paidAmount = input.payments
      .filter((p) => p.paymentMethod !== 'Borrow' && p.paymentMethod !== 'Credit')
      .reduce((sum, p) => sum + p.amount, 0);
    const changeAmount = Math.max(0, Math.round((input.amountTendered - grandTotal) * 100) / 100);

    return {
      subtotal,
      itemDiscountTotal,
      orderDiscount,
      taxTotal,
      grandTotal,
      paidAmount,
      changeAmount,
      items,
    };
  }

  public processCheckout(input: POSCheckoutInput, cashierId?: string): SalesOrderEntity {
    const saleId = crypto.randomUUID();
    const invoiceNumber = this.numberingService.generateNextNumber('inv');
    const totals = this.calculateSaleTotals(input);
    const now = new Date().toISOString();

    const hasBorrow = input.payments.some((p) => p.paymentMethod === 'Borrow' || p.paymentMethod === 'Credit');
    let paymentStatus: 'Paid' | 'Partially paid' | 'Unpaid' = 'Paid';
    if (totals.paidAmount >= totals.grandTotal && !hasBorrow) {
      paymentStatus = 'Paid';
    } else if (totals.paidAmount > 0) {
      paymentStatus = 'Partially paid';
    } else {
      paymentStatus = 'Unpaid';
    }

    const insertSale = this.db.prepare(`
      INSERT INTO sales_orders (
        id, invoice_number, customer_id, customer_name, customer_phone, due_date, notes,
        subtotal, item_discount, order_discount,
        tax_total, grand_total, paid_amount, change_amount, payment_status,
        payment_method, shift_id, cashier_id, created_at,
        order_type, table_number, delivery_address, exchange_rate,
        paid_usd, paid_lbp, change_usd, change_lbp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = this.db.prepare(`
      INSERT INTO sales_order_items (
        id, sale_id, product_id, batch_id, unit_id, quantity, unit_price,
        cost_price, discount, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPayment = this.db.prepare(`
      INSERT INTO sales_payments (id, sale_id, payment_method, amount, reference_number, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const paymentMethodName =
      input.payments.length === 1 ? input.payments[0].paymentMethod : (hasBorrow ? 'Borrow' : 'Split');

    this.db.transaction(() => {
      insertSale.run(
        saleId,
        invoiceNumber,
        input.customerId || null,
        input.customerName || null,
        input.customerPhone || null,
        input.dueDate || null,
        input.notes || null,
        totals.subtotal,
        totals.itemDiscountTotal,
        totals.orderDiscount,
        totals.taxTotal,
        totals.grandTotal,
        totals.paidAmount,
        totals.changeAmount,
        paymentStatus,
        paymentMethodName,
        input.shiftId || null,
        cashierId || 'cashier',
        now,
        input.orderType || 'dine_in',
        input.tableNumber || null,
        input.deliveryAddress || null,
        input.exchangeRate || 89500,
        input.paidUsd || 0,
        input.paidLbp || 0,
        input.changeUsd || 0,
        input.changeLbp || 0,
      );

      for (const p of input.payments) {
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

      for (const item of totals.items) {
        let product = this.productRepo.findById(item.productId);

        let unitId = item.unitId;
        const validUnit = this.db.prepare('SELECT id FROM units WHERE id = ? OR LOWER(code) = LOWER(?)').get(unitId, unitId) as { id: string } | undefined;
        if (validUnit) {
          unitId = validUnit.id;
        } else {
          const defaultUnit = this.db.prepare('SELECT id FROM units LIMIT 1').get() as { id: string } | undefined;
          unitId = defaultUnit ? defaultUnit.id : 'unit-kg-std';
        }

        if (!product) {
          const defaultCat = this.db.prepare('SELECT id FROM categories LIMIT 1').get() as { id: string } | undefined;
          let catId = defaultCat ? defaultCat.id : 'fresh';
          let nameEn = (item as any).productName || item.productId;
          let nameAr = (item as any).productName || nameEn;

          if (item.productId.startsWith('hookah-')) {
            catId = 'cat-shisha';
            const isRefill = item.productId.endsWith('-refill');
            const flavorId = item.productId.replace('hookah-', '').replace('-full', '').replace('-refill', '');
            const flv = this.db.prepare('SELECT * FROM hookah_flavors WHERE id = ?').get(flavorId) as any;
            if (flv) {
              nameEn = isRefill ? `💨 Refill: ${flv.name_en}` : `💨 Hookah: ${flv.name_en}`;
              nameAr = isRefill ? `💨 راس: ${flv.name_ar}` : `💨 أركيلة: ${flv.name_ar}`;
            } else {
              const clean = flavorId.replace(/^hk-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              nameEn = isRefill ? `💨 Refill: ${clean || 'Hookah'}` : `💨 Hookah: ${clean || 'Hookah'}`;
              nameAr = isRefill ? `💨 راس: ${clean || 'شيشة'}` : `💨 أركيلة: ${clean || 'شيشة'}`;
            }
          }

          this.db.prepare(`
            INSERT INTO products (id, sku, name_en, name_ar, category_id, base_unit_id, selling_price, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET
              name_en = excluded.name_en,
              name_ar = excluded.name_ar,
              category_id = excluded.category_id,
              selling_price = excluded.selling_price
          `).run(item.productId, `SKU-${item.productId}`, nameEn, nameAr, catId, unitId, item.unitPrice);
          product = this.productRepo.findById(item.productId);
        }

        const costPrice = product ? product.avg_cost || product.purchase_cost || 0 : 0;

        let selectedBatchId = item.batchId;
        if (product && product.track_batches === 1 && !selectedBatchId) {
          const batchStmt = this.db.prepare(
            'SELECT id FROM batches WHERE product_id = ? AND remaining_qty > 0 ORDER BY expiry_date ASC LIMIT 1',
          );
          const b = batchStmt.get(item.productId) as { id: string } | undefined;
          if (b) selectedBatchId = b.id;
        }

        insertItem.run(
          crypto.randomUUID(),
          saleId,
          item.productId,
          selectedBatchId || null,
          unitId,
          item.quantity,
          item.unitPrice,
          costPrice,
          item.discount,
          item.taxRate,
          item.taxAmount,
          item.lineTotal,
        );

        this.inventoryService.createAdjustment(
          {
            productId: item.productId,
            batchId: selectedBatchId,
            movementType: 'Customer sale',
            quantityChange: -Math.abs(item.quantity),
            unitCost: costPrice,
            reason: `POS Sale Receipt #${invoiceNumber}`,
          },
          cashierId,
        );
      }
    })();

    this.auditRepo.logAction({
      user_id: cashierId,
      action: 'SALE_COMPLETED',
      module: 'POS',
      details: `Completed Sale #${invoiceNumber} total $${totals.grandTotal} via ${paymentMethodName}`,
    });
    logger.info('POSSalesService', `Completed Sale #${invoiceNumber}`);
    const found = this.getSaleById(saleId);
    if (found) return found as any;
    return {
      id: saleId,
      invoice_number: invoiceNumber,
      customer_id: input.customerId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      due_date: input.dueDate,
      notes: input.notes,
      subtotal: totals.subtotal,
      item_discount: totals.itemDiscountTotal,
      order_discount: totals.orderDiscount,
      tax_total: totals.taxTotal,
      grand_total: totals.grandTotal,
      paid_amount: totals.paidAmount,
      change_amount: totals.changeAmount,
      payment_status: paymentStatus,
      payment_method: paymentMethodName as 'Cash' | 'Card' | 'Split' | 'Other',
      shift_id: input.shiftId,
      cashier_id: cashierId,
      created_at: now,
    } as any;
  }

  public getSalesHistory(query = ''): SalesOrderEntity[] {
    let sql = 'SELECT * FROM sales_orders WHERE 1=1';
    const params: string[] = [];

    if (query) {
      sql += ' AND invoice_number LIKE ?';
      params.push(`%${query}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';
    return this.db.prepare(sql).all(...params) as SalesOrderEntity[];
  }

  public getSaleById(
    id: string,
  ): (SalesOrderEntity & { items: any[] }) | undefined {
    const sale = this.db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(id) as
      SalesOrderEntity | undefined;
    if (!sale) return undefined;

    const items = this.db
      .prepare(`
        SELECT soi.*, p.name_en, p.name_ar, u.name_ar as unit_name_ar, u.name_en as unit_name_en, u.symbol as unit_symbol
        FROM sales_order_items soi
        LEFT JOIN products p ON soi.product_id = p.id
        LEFT JOIN units u ON soi.unit_id = u.id
        WHERE soi.sale_id = ?
      `)
      .all(id);
    return { ...sale, items };
  }

  public getDebts(query = ''): SalesOrderEntity[] {
    let sql = `
      SELECT * FROM sales_orders
      WHERE (payment_status IN ('Unpaid', 'Partially paid') OR payment_method IN ('Borrow', 'Credit'))
    `;
    const params: string[] = [];
    if (query) {
      sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    return this.db.prepare(sql).all(...params) as SalesOrderEntity[];
  }

  public settleDebt(
    saleId: string,
    amount: number,
    paymentMethod = 'Cash',
    cashierId?: string,
    notes?: string,
  ): SalesOrderEntity {
    const sale = this.db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(saleId) as SalesOrderEntity | undefined;
    if (!sale) throw new Error('Sale not found');

    const newPaidAmount = Math.round(((sale.paid_amount || 0) + amount) * 100) / 100;
    const newStatus = newPaidAmount >= sale.grand_total ? 'Paid' : 'Partially paid';
    const now = new Date().toISOString();

    const insertPayment = this.db.prepare(`
      INSERT INTO sales_payments (id, sale_id, payment_method, amount, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateSale = this.db.prepare(`
      UPDATE sales_orders
      SET paid_amount = ?, payment_status = ?
      WHERE id = ?
    `);

    const tx = this.db.transaction(() => {
      insertPayment.run(crypto.randomUUID(), saleId, paymentMethod, amount, notes || 'Debt Settlement', now);
      updateSale.run(newPaidAmount, newStatus, saleId);
    });
    tx();

    this.auditRepo.logAction({
      user_id: cashierId,
      action: 'DEBT_SETTLED',
      module: 'POS',
      details: `Settled debt of ${amount} for invoice ${sale.invoice_number} (New Status: ${newStatus})`,
    });

    return this.getSaleById(saleId) as any;
  }

  public getDailyCloseoutReport(dateStr?: string): DailyCloseoutReport {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // 1. Fetch sales for the given date
    const salesStmt = this.db.prepare(`
      SELECT * FROM sales_orders
      WHERE date(created_at, 'localtime') = ? OR date(created_at) = ?
      ORDER BY created_at ASC
    `);
    const sales = salesStmt.all(today, today) as SalesOrderEntity[];

    let totalOrders = 0;
    let totalSalesUsd = 0;
    let totalSalesLbp = 0;

    let takeawayCount = 0;
    let takeawayTotalUsd = 0;
    let takeawayTotalLbp = 0;

    let dineInCount = 0;
    let dineInTotalUsd = 0;
    let dineInTotalLbp = 0;

    let playstationCount = 0;
    let playstationTotalUsd = 0;
    let playstationTotalLbp = 0;

    let cashUsdCollected = 0;
    let cashLbpCollected = 0;

    let debtsCount = 0;
    let debtsTotalUsd = 0;
    let debtsTotalLbp = 0;

    for (const sale of sales) {
      if (sale.payment_status === 'Refunded' || sale.payment_status === 'Voided') {
        continue;
      }
      totalOrders++;
      const rate = sale.exchange_rate || 89500;
      const saleUsd = Number(sale.grand_total) || 0;
      const saleLbp = Math.round(saleUsd * rate);

      totalSalesUsd += saleUsd;
      totalSalesLbp += saleLbp;

      // Section categorization
      const isPS =
        sale.order_type === 'playstation' ||
        sale.invoice_number?.startsWith('INV-PS-') ||
        sale.customer_name?.includes('PS');
      const isDineIn = !isPS && (sale.order_type === 'dine_in' || Boolean(sale.table_number));

      if (isPS) {
        playstationCount++;
        playstationTotalUsd += saleUsd;
        playstationTotalLbp += saleLbp;
      } else if (isDineIn) {
        dineInCount++;
        dineInTotalUsd += saleUsd;
        dineInTotalLbp += saleLbp;
      } else {
        takeawayCount++;
        takeawayTotalUsd += saleUsd;
        takeawayTotalLbp += saleLbp;
      }

      // Payment categorization
      const isDebt =
        sale.payment_method === 'Borrow' ||
        sale.payment_method === 'Credit' ||
        sale.payment_status === 'Unpaid';

      if (isDebt) {
        debtsCount++;
        debtsTotalUsd += saleUsd;
        debtsTotalLbp += saleLbp;
      } else {
        const pUsd = Number(sale.paid_usd) || 0;
        const cUsd = Number(sale.change_usd) || 0;
        const pLbp = Number(sale.paid_lbp) || 0;
        const cLbp = Number(sale.change_lbp) || 0;

        if (pUsd === 0 && pLbp === 0) {
          cashUsdCollected += saleUsd;
        } else {
          cashUsdCollected += Math.max(0, pUsd - cUsd);
          cashLbpCollected += Math.max(0, pLbp - cLbp);
        }
      }
    }

    // 2. Fetch expenses logged today
    let expenseRows: Array<{
      id: string;
      title: string;
      category: string;
      amount: number;
      payment_method: string;
      expense_date: string;
    }> = [];

    try {
      const expStmt = this.db.prepare(`
        SELECT id, title, category, amount, payment_method, expense_date
        FROM expenses
        WHERE date(expense_date) = ? OR date(created_at, 'localtime') = ? OR date(created_at) = ?
        ORDER BY created_at ASC
      `);
      expenseRows = expStmt.all(today, today, today) as typeof expenseRows;
    } catch {
      // Expenses table might be empty or unmigrated in edge environments
    }

    let totalExpensesUsd = 0;
    let totalExpensesLbp = 0;

    for (const exp of expenseRows) {
      const amt = Number(exp.amount) || 0;
      if (amt >= 10000 || exp.payment_method?.includes('LBP')) {
        totalExpensesLbp += amt;
      } else {
        totalExpensesUsd += amt;
      }
    }

    // 3. Expected Drawer Cash
    const netCashExpectedUsd = Math.max(0, cashUsdCollected - totalExpensesUsd);
    const netCashExpectedLbp = Math.max(0, cashLbpCollected - totalExpensesLbp);

    // 4. Shift status
    let activeShiftId: string | null = null;
    let shiftStatus = 'Closed';
    try {
      const shiftRow = this.db
        .prepare("SELECT * FROM pos_shifts WHERE status = 'Open' ORDER BY opened_at DESC LIMIT 1")
        .get() as any;
      if (shiftRow) {
        activeShiftId = shiftRow.id;
        shiftStatus = 'Open';
      }
    } catch {
      // pos_shifts table error handling
    }

    return {
      date: today,
      generatedAt: now,
      totalOrders,
      totalSalesUsd: Math.round(totalSalesUsd * 100) / 100,
      totalSalesLbp,
      takeawayCount,
      takeawayTotalUsd: Math.round(takeawayTotalUsd * 100) / 100,
      takeawayTotalLbp,
      dineInCount,
      dineInTotalUsd: Math.round(dineInTotalUsd * 100) / 100,
      dineInTotalLbp,
      playstationCount,
      playstationTotalUsd: Math.round(playstationTotalUsd * 100) / 100,
      playstationTotalLbp,
      cashUsdCollected: Math.round(cashUsdCollected * 100) / 100,
      cashLbpCollected,
      debtsCount,
      debtsTotalUsd: Math.round(debtsTotalUsd * 100) / 100,
      debtsTotalLbp,
      expensesCount: expenseRows.length,
      totalExpensesUsd: Math.round(totalExpensesUsd * 100) / 100,
      totalExpensesLbp,
      expenseItems: expenseRows.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        payment_method: e.payment_method,
      })),
      netCashExpectedUsd: Math.round(netCashExpectedUsd * 100) / 100,
      netCashExpectedLbp,
      activeShiftId,
      shiftStatus,
    };
  }

  public closeDailyShift(
    userId?: string,
    actualCashUsd?: number,
    actualCashLbp?: number,
    notes?: string,
  ): boolean {
    const report = this.getDailyCloseoutReport();
    const now = new Date().toISOString();

    let activeShift: any = null;
    try {
      activeShift = this.db
        .prepare("SELECT * FROM pos_shifts WHERE status = 'Open' ORDER BY opened_at DESC LIMIT 1")
        .get();
    } catch {
      // pos_shifts error handling
    }

    const closingSummary =
      notes ||
      `Daily closeout. Orders: ${report.totalOrders}. Counted USD: $${actualCashUsd ?? report.netCashExpectedUsd}, Counted LBP: ${actualCashLbp ?? report.netCashExpectedLbp}`;

    if (activeShift) {
      this.db
        .prepare(`
        UPDATE pos_shifts
        SET closed_at = ?,
            closing_cash_actual = ?,
            closing_cash_expected = ?,
            status = 'Closed',
            notes = ?
        WHERE id = ?
      `)
        .run(
          now,
          actualCashUsd ?? report.netCashExpectedUsd,
          report.netCashExpectedUsd,
          closingSummary,
          activeShift.id,
        );
    } else {
      const shiftId = crypto.randomUUID();
      try {
        this.db
          .prepare(`
          INSERT INTO pos_shifts (id, user_id, opened_at, closed_at, opening_cash, closing_cash_actual, closing_cash_expected, status, notes)
          VALUES (?, ?, ?, ?, 0, ?, ?, 'Closed', ?)
        `)
          .run(
            shiftId,
            userId || 'system',
            now,
            now,
            actualCashUsd ?? report.netCashExpectedUsd,
            report.netCashExpectedUsd,
            closingSummary,
          );
      } catch (err) {
        logger.error('POSSalesService', 'Failed inserting pos_shifts record', err);
      }
    }

    this.auditRepo.logAction({
      user_id: userId,
      action: 'SHIFT_CLOSED',
      module: 'POS',
      details: `Daily shift closed. Orders: ${report.totalOrders}, Revenue: $${report.totalSalesUsd} (${report.totalSalesLbp} LBP)`,
    });

    return true;
  }
}
