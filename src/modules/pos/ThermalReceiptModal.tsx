import React from 'react';
import { SalesOrderEntity, SalesOrderItemEntity } from '@shared/types';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { Button } from '@components/ui/Button';
import { Printer } from 'lucide-react';
import { formatDateTime } from '@utils/date';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';

interface ExtendedSalesOrder extends SalesOrderEntity {
  items?: SalesOrderItemEntity[];
  order_type?: string;
  table_number?: string;
  delivery_address?: string;
  exchange_rate?: number;
  paid_usd?: number;
  paid_lbp?: number;
  change_usd?: number;
  change_lbp?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale: ExtendedSalesOrder | null;
  businessName?: string;
  businessAddress?: string;
  taxNumber?: string;
}

export const ThermalReceiptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sale,
  businessName,
  businessAddress,
  taxNumber = 'VAT-300998811',
}) => {
  const { language } = useLanguageStore();

  if (!isOpen || !sale) return null;

  const defaultStoreName = language === 'ar' ? 'كافيتيريا غاما' : 'Gamma Cafeteria';
  const defaultAddress = language === 'ar' ? 'الفرع الرئيسي' : 'Main Branch';

  const storeTitle = businessName || defaultStoreName;
  const storeAddr = businessAddress || defaultAddress;

  const rate = sale.exchange_rate || 89500;
  const grandTotalUsd = sale.grand_total || 0;
  const grandTotalLbp = Math.round(grandTotalUsd * rate);

  const getOrderTypeLabel = () => {
    switch (sale.order_type) {
      case 'playstation':
        return language === 'ar'
          ? `🎮 صالة ألعاب بلايستيشن (PS5) - ${sale.table_number || 'Console'}`
          : `🎮 PlayStation 5 (PS5) - ${sale.table_number || 'Console'}`;
      case 'dine_in':
        return language === 'ar'
          ? `صالة (Dine In) - طاولة ${sale.table_number || '-'}`
          : `Dine In - Table ${sale.table_number || '-'}`;
      case 'takeaway':
        return language === 'ar' ? 'سفري (Takeaway)' : 'Takeaway';
      case 'delivery':
        return language === 'ar' ? 'توصيل (Delivery)' : 'Delivery';
      default:
        return language === 'ar' ? 'صالة (Dine In)' : 'Dine In';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">
            {language === 'ar' ? 'معاينة إيصال الدفع الحراري (58 مم)' : 'Thermal Receipt Preview (58mm)'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        {/* 58mm Thermal Receipt Visual Preview */}
        <div
          id="thermal-receipt"
          className="p-4 bg-white text-black font-mono text-[11px] leading-tight border border-slate-300 shadow-inner rounded-lg space-y-2.5"
        >
          {/* Header */}
          <div className="text-center space-y-0.5">
            <h3 className="font-black text-sm tracking-tight">{storeTitle}</h3>
            <p className="text-[10px] text-slate-600">{storeAddr}</p>
            <p className="text-[10px] text-slate-600">VAT #: {taxNumber}</p>
            <div className="border-b border-dashed border-slate-800 my-1" />
          </div>

          {/* Invoice Meta */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'رقم الإيصال:' : 'Receipt #:'}</span>
              <span className="font-bold">{sale.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'التاريخ والوقت:' : 'Date:'}</span>
              <span>{formatDateTime(sale.created_at || new Date())}</span>
            </div>
            <div className="flex justify-between font-bold bg-slate-100 p-1 rounded">
              <span>{language === 'ar' ? 'نوع الطلب:' : 'Order Type:'}</span>
              <span className="text-slate-900">{getOrderTypeLabel()}</span>
            </div>
            {sale.order_type === 'delivery' && sale.delivery_address && (
              <div className="flex justify-between text-[9px] text-slate-700">
                <span>{language === 'ar' ? 'عنوان التوصيل:' : 'Delivery Address:'}</span>
                <span className="truncate max-w-[140px]">{sale.delivery_address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{language === 'ar' ? 'طريقة الدفع:' : 'Payment:'}</span>
              <span className="font-semibold">{sale.payment_method || 'Cash'}</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between font-bold text-amber-950 bg-amber-100/70 p-1 rounded">
                <span>{language === 'ar' ? 'العميل / المستدين:' : 'Customer:'}</span>
                <span>{sale.customer_name}</span>
              </div>
            )}
            {sale.payment_status && sale.payment_status !== 'Paid' && (
              <div className="flex justify-between font-bold text-rose-700 bg-rose-50 p-1 rounded">
                <span>{language === 'ar' ? 'حالة السداد:' : 'Payment Status:'}</span>
                <span>
                  {sale.payment_status === 'Unpaid'
                    ? language === 'ar'
                      ? 'دين غير مسدد'
                      : 'Unpaid Debt'
                    : language === 'ar'
                    ? 'مسدد جزئياً'
                    : 'Partially Paid'}
                </span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-800 my-1" />

          {/* Line items list with quantity and price */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold pb-1 border-b border-slate-300">
              <span>{language === 'ar' ? 'الصنف' : 'Item'}</span>
              <span className="text-right rtl:text-left">{language === 'ar' ? 'الكمية × السعر' : 'Qty × Price'}</span>
            </div>
            {sale.items && sale.items.length > 0 ? (
              sale.items.map((item: any, idx) => {
                const itemName =
                  language === 'ar'
                    ? item.name_ar || item.name_en || item.product_name || item.name || item.product_id
                    : item.name_en || item.name_ar || item.product_name || item.name || item.product_id;
                const unitPrice = item.unit_price || 0;
                const lineTotal = item.line_total || unitPrice * item.quantity;

                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-[11px] py-1 border-b border-dashed border-slate-100"
                  >
                    <div className="font-bold pr-2 rtl:pr-0 rtl:pl-2">
                      <p>{itemName}</p>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {item.quantity} × {formatUSD(unitPrice)}
                      </span>
                    </div>
                    <span className="font-extrabold font-mono text-[11px] whitespace-nowrap">
                      {formatUSD(lineTotal)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-1 text-[11px] text-center text-slate-500">
                {language === 'ar' ? 'أصناف الطلب' : 'Order Items'}
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-800 my-1.5" />

          {/* Items Summary & Financial Breakdown */}
          <div className="space-y-1 text-[10px] bg-slate-50 p-2 rounded border border-slate-200">
            {sale.order_discount !== undefined && sale.order_discount > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>{language === 'ar' ? 'خصم الفاتورة:' : 'Receipt Discount:'}</span>
                <span className="font-mono text-amber-800">-{formatUSD(sale.order_discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-[12px] pt-1 border-t border-slate-300">
              <span>{language === 'ar' ? 'الإجمالي بالدولار:' : 'Total (USD):'}</span>
              <span className="font-mono">{formatUSD(grandTotalUsd)}</span>
            </div>
            <div className="flex justify-between font-black text-[12px]">
              <span>{language === 'ar' ? 'الإجمالي بالليرة:' : 'Total (LBP):'}</span>
              <span className="font-mono">{formatLBP(grandTotalLbp)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 pt-0.5 border-t border-slate-200">
              <span>{language === 'ar' ? 'سعر الصرف:' : 'Exchange Rate:'}</span>
              <span className="font-mono">1 $ = {rate.toLocaleString('en-US')} L.L</span>
            </div>

            {/* Split Cash breakdown if available */}
            {((sale.paid_usd && sale.paid_usd > 0) || (sale.paid_lbp && sale.paid_lbp > 0)) && (
              <div className="pt-1 mt-1 border-t border-slate-200 text-[9px] space-y-0.5">
                {sale.paid_usd && sale.paid_usd > 0 ? (
                  <div className="flex justify-between text-slate-700">
                    <span>{language === 'ar' ? 'المدفوع دولار:' : 'Paid USD:'}</span>
                    <span className="font-mono font-bold">{formatUSD(sale.paid_usd)}</span>
                  </div>
                ) : null}
                {sale.paid_lbp && sale.paid_lbp > 0 ? (
                  <div className="flex justify-between text-slate-700">
                    <span>{language === 'ar' ? 'المدفوع ليرة:' : 'Paid LBP:'}</span>
                    <span className="font-mono font-bold">{formatLBP(sale.paid_lbp)}</span>
                  </div>
                ) : null}
                {sale.change_usd && sale.change_usd > 0 ? (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>{language === 'ar' ? 'الباقي دولار:' : 'Change USD:'}</span>
                    <span className="font-mono">{formatUSD(sale.change_usd)}</span>
                  </div>
                ) : null}
                {sale.change_lbp && sale.change_lbp > 0 ? (
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>{language === 'ar' ? 'الباقي ليرة:' : 'Change LBP:'}</span>
                    <span className="font-mono">{formatLBP(sale.change_lbp)}</span>
                  </div>
                ) : null}
              </div>
            )}

            {sale.paid_amount !== undefined && sale.paid_amount < sale.grand_total && (
              <div className="flex justify-between font-black text-rose-700 pt-0.5">
                <span>{language === 'ar' ? 'المتبقي في الذمة (دين):' : 'Remaining Debt:'}</span>
                <span className="font-mono">
                  {formatUSD(Math.max(0, sale.grand_total - (sale.paid_amount || 0)))}
                </span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-800 my-1.5" />

          {/* Clean Footer */}
          <div className="text-center text-[9px] pt-1 text-slate-700 leading-tight space-y-0.5">
            <p className="font-bold">
              {language === 'ar' ? 'أهلاً وسهلاً بكم دائماً! ✨' : 'Welcome anytime! Thank you! ✨'}
            </p>
            <p>{language === 'ar' ? 'كافيتيريا وصالة غاما' : 'Gamma Cafeteria & Lounge'}</p>
          </div>
        </div>

        <div className="flex space-x-2 rtl:space-x-reverse pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
          <Button
            onClick={handlePrint}
            className="w-full flex items-center justify-center space-x-2 rtl:space-x-reverse bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <Printer className="h-4 w-4" />
            <span>{language === 'ar' ? 'طباعة الإيصال' : 'Print Receipt'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
export default ThermalReceiptModal;
