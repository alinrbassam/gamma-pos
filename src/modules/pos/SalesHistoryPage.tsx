import React, { useEffect, useState } from 'react';
import { usePOSStore } from '@stores/usePOSStore';
import { useAuthStore } from '@stores/useAuthStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Card } from '@components/ui/Card';
import { Table, Column } from '@components/ui/Table';
import { SearchBox } from '@components/ui/SearchBox';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { SalesOrderEntity } from '@shared/types';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { History, Printer, Undo2 } from 'lucide-react';
import { formatDateTime } from '@utils/date';
import { formatCurrency } from '../../renderer/utils/currency';

export const SalesHistoryPage: React.FC = () => {
  const { salesHistory, loadSalesHistory, selectedSale, loadSaleById, processRefund } =
    usePOSStore();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [search, setSearch] = useState('');
  const [activeReceiptSale, setActiveReceiptSale] = useState<SalesOrderEntity | null>(null);

  useEffect(() => {
    loadSalesHistory(search);
  }, [search, loadSalesHistory]);

  const handleReprint = async (sale: SalesOrderEntity) => {
    await loadSaleById(sale.id);
    setActiveReceiptSale(sale);
  };

  const handleRefund = async (sale: SalesOrderEntity) => {
    const confirmed = window.confirm(
      language === 'ar'
        ? `هل تريد تأكيد استرجاع الفاتورة رقم ${sale.invoice_number}؟\nسيتم وضع علامة "مسترجع" على الفاتورة وإعادة كافة الأصناف إلى المخزون.`
        : `Process refund for ${sale.invoice_number}?\nThe invoice will be marked as "Refunded" and all items returned to stock.`
    );
    if (!confirmed) return;

    const ok = await processRefund(
      {
        saleId: sale.id,
        reason: 'Customer Return',
        refundMethod: sale.payment_method || 'Cash',
        items: [],
      },
      user?.id,
    );

    if (ok) {
      await loadSalesHistory(search);
      alert(
        language === 'ar'
          ? `تم استرجاع الفاتورة ${sale.invoice_number} بنجاح وإعادة المنتجات إلى المخزون.`
          : `Refund processed successfully for ${sale.invoice_number}. Items have been returned to stock.`
      );
    } else {
      const storeErr = usePOSStore.getState().error;
      const detail = storeErr ? ` (${storeErr})` : '';
      alert(
        language === 'ar'
          ? `تعذر معالجة الاسترجاع${detail}.`
          : `Failed to process refund${detail}.`
      );
    }
  };

  const columns: Column<SalesOrderEntity>[] = [
    {
      key: 'invoice_number',
      header: language === 'ar' ? 'رقم الإيصال' : 'Receipt #',
      render: (s) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-[#C83818] dark:text-[#DF7E63] font-mono">
              {s.invoice_number}
            </span>
            {(s.order_type === 'playstation' || s.invoice_number?.startsWith('INV-PS-')) && (
              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                PS5
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {formatDateTime(s.created_at)}
          </span>
        </div>
      ),
    },
    {
      key: 'order_type',
      header: language === 'ar' ? 'القسم / الجهاز' : 'Section / Device',
      render: (s) => {
        const isPS = s.order_type === 'playstation' || s.invoice_number?.startsWith('INV-PS-') || s.customer_name?.includes('PS');
        if (isPS) {
          const rawName = s.table_number || s.customer_name || 'PS5';
          const cleanName = rawName.includes('PS5') ? rawName : `PS5 - ${rawName}`;
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
              <span>🎮</span>
              <span>{cleanName}</span>
            </span>
          );
        }

        if (s.order_type === 'dine_in') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <span>🍽️</span>
              <span>{language === 'ar' ? `طاولة ${s.table_number || '-'}` : `Table ${s.table_number || '-'}`}</span>
            </span>
          );
        }

        if (s.order_type === 'takeaway') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span>🥡</span>
              <span>{language === 'ar' ? 'سفري' : 'Takeaway'}</span>
            </span>
          );
        }

        if (s.order_type === 'delivery') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
              <span>🛵</span>
              <span>{language === 'ar' ? 'توصيل' : 'Delivery'}</span>
            </span>
          );
        }

        return (
          <span className="text-xs text-slate-500 font-medium">
            {language === 'ar' ? 'كافتيريا' : 'Cafeteria POS'}
          </span>
        );
      },
    },
    {
      key: 'customer_name',
      header: language === 'ar' ? 'العميل' : 'Customer',
      render: (s) => {
        const isPS = s.order_type === 'playstation' || s.invoice_number?.startsWith('INV-PS-');
        if (isPS) {
          return (
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              🎮 {s.customer_name || 'PS5 Lounge'}
            </span>
          );
        }
        return (
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {s.customer_name || (language === 'ar' ? 'عميل صالة' : 'Walk-in')}
          </span>
        );
      },
    },
    {
      key: 'payment_method',
      header: language === 'ar' ? 'طريقة الدفع' : 'Payment Method',
      render: (s) => <Badge variant="neutral">{s.payment_method}</Badge>,
    },
    {
      key: 'grand_total',
      header: language === 'ar' ? 'الإجمالي' : 'Grand Total',
      render: (s) => (
        <span className="font-black text-slate-900 dark:text-slate-100 font-mono">
          {formatCurrency(s.grand_total)}
        </span>
      ),
    },
    {
      key: 'payment_status',
      header: language === 'ar' ? 'الحالة' : 'Status',
      render: (s) => {
        let variant: 'success' | 'danger' | 'warning' | 'neutral' = 'success';
        let label = s.payment_status;
        if (s.payment_status === 'Refunded' || s.payment_status === 'Voided') {
          variant = 'danger';
          label = language === 'ar' ? 'مسترجع' : 'Refunded';
        } else if (s.payment_status === 'Paid') {
          variant = 'success';
          label = language === 'ar' ? 'مدفوع' : 'Paid';
        } else if (s.payment_status === 'Unpaid') {
          variant = 'danger';
          label = language === 'ar' ? 'غير مدفوع' : 'Unpaid';
        } else if (s.payment_status === 'Partially paid') {
          variant = 'warning';
          label = language === 'ar' ? 'مدفوع جزئياً' : 'Partially paid';
        }
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      key: 'id',
      header: 'Actions',
      render: (s) => (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleReprint(s)}>
            <Printer className="h-3 w-3 mr-1" />
            Receipt
          </Button>

          {s.payment_status === 'Paid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefund(s)}
              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200"
              title={language === 'ar' ? 'استرجاع الفاتورة' : language === 'fr' ? 'Rembourser' : 'Refund'}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'استرجاع' : language === 'fr' ? 'Rembourser' : 'Refund'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <History className="h-6 w-6 text-sky-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            POS Sales History
          </h1>
          <p className="text-xs text-slate-500">
            Completed register receipts, thermal reprints, voids, and refunds.
          </p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="max-w-md">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by receipt invoice number..."
          />
        </div>
        <Table columns={columns} data={salesHistory} keyExtractor={(s) => s.id} />
      </Card>

      <ThermalReceiptModal
        isOpen={Boolean(activeReceiptSale)}
        onClose={() => setActiveReceiptSale(null)}
        sale={selectedSale || activeReceiptSale}
      />
    </div>
  );
};
