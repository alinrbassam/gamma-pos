import React, { useState, useEffect } from 'react';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import { CartItem } from '../../renderer/stores/usePOSStore';
import {
  Delete,
  Trash2,
  Zap,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Banknote,
  Calculator,
} from 'lucide-react';

interface Props {
  selectedItem: CartItem | null;
  selectedItemIndex: number | null;
  onUpdateQuantity: (qty: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemoveItem: () => void;
  grandTotalUsd: number;
  grandTotalLbp: number;
  usdToLbpRate: number;
  onFastPayAndPrint: (paidUsd: number, paidLbp: number, changeUsd: number, changeLbp: number) => void;
  onOpenDetailedPayment: () => void;
  cartEmpty: boolean;
  isLoading: boolean;
}

export const POSTouchNumpad: React.FC<Props> = ({
  selectedItem,
  selectedItemIndex,
  onUpdateQuantity,
  onIncrement,
  onDecrement,
  onRemoveItem,
  grandTotalUsd,
  grandTotalLbp,
  usdToLbpRate,
  onFastPayAndPrint,
  onOpenDetailedPayment,
  cartEmpty,
  isLoading,
}) => {
  const { language } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'qty' | 'cash'>('qty');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Qty typing buffer state
  const [isFreshInput, setIsFreshInput] = useState<boolean>(true);

  // Reset fresh input whenever selected item changes
  useEffect(() => {
    setIsFreshInput(true);
  }, [selectedItemIndex]);

  // Fast cash tender state
  const [tenderedUsd, setTenderedUsd] = useState<number | null>(null);
  const [tenderedLbp, setTenderedLbp] = useState<number | null>(null);

  // Reset tender when grand total changes or cart clears
  useEffect(() => {
    setTenderedUsd(null);
    setTenderedLbp(null);
  }, [grandTotalUsd, cartEmpty]);

  // Handle Numpad digits for Quantity
  const handleDigit = (digit: string) => {
    if (!selectedItem) return;
    const currentQtyStr = String(selectedItem.quantity);

    if (isFreshInput) {
      // First keypress replaces current quantity
      const newQty = digit === '.' ? 0.5 : parseFloat(digit) || 1;
      onUpdateQuantity(newQty);
      setIsFreshInput(false);
    } else {
      // Subsequent keypress appends
      if (digit === '.') {
        if (!currentQtyStr.includes('.')) {
          onUpdateQuantity(parseFloat(`${currentQtyStr}.`) || selectedItem.quantity);
        }
      } else {
        const appended = parseFloat(`${currentQtyStr}${digit}`);
        if (!isNaN(appended) && appended <= 999) {
          onUpdateQuantity(appended);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (!selectedItem) return;
    const str = String(selectedItem.quantity);
    if (str.length <= 1 || isFreshInput) {
      onUpdateQuantity(1);
      setIsFreshInput(true);
    } else {
      const sliced = str.slice(0, -1);
      const val = parseFloat(sliced);
      onUpdateQuantity(isNaN(val) || val <= 0 ? 1 : val);
    }
  };

  const handleClear = () => {
    if (!selectedItem) return;
    onUpdateQuantity(1);
    setIsFreshInput(true);
  };

  const handleMultiplier = (mult: number) => {
    if (!selectedItem) return;
    onUpdateQuantity(mult);
    setIsFreshInput(true);
  };

  // Quick Cash Calculations
  const effectivePaidUsd = tenderedUsd ?? (tenderedLbp ? 0 : grandTotalUsd);
  const effectivePaidLbp = tenderedLbp ?? 0;
  const totalPaidInUsd = effectivePaidUsd + effectivePaidLbp / (usdToLbpRate || 89500);

  const changeUsd = Math.max(0, totalPaidInUsd - grandTotalUsd);
  const changeLbp = Math.round(changeUsd * (usdToLbpRate || 89500));

  const handleSelectQuickUsd = (amount: number) => {
    setTenderedUsd(amount);
    setTenderedLbp(null);
  };

  const handleSelectQuickLbp = (amount: number) => {
    setTenderedLbp(amount);
    setTenderedUsd(null);
  };

  const handleExactCash = (currency: 'USD' | 'LBP') => {
    if (currency === 'USD') {
      setTenderedUsd(grandTotalUsd);
      setTenderedLbp(null);
    } else {
      setTenderedLbp(grandTotalLbp);
      setTenderedUsd(null);
    }
  };

  const triggerFastCheckout = () => {
    if (cartEmpty || isLoading) return;
    onFastPayAndPrint(
      effectivePaidUsd,
      effectivePaidLbp,
      changeUsd,
      changeLbp,
    );
  };

  return (
    <div className="border-t border-slate-200 dark:border-[#21242B] bg-[#F4F5F7] dark:bg-[#111317] select-none flex flex-col">
      {/* 1. Large Dual Currency Total Banner (Always Visible) */}
      <div className="p-2.5 bg-gradient-to-r from-slate-900 via-[#181A20] to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shadow-inner">
        <div className="min-w-0">
          <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
              {isAr ? 'الإجمالي النهائي' : 'GRAND TOTAL'}
            </span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.2 rounded border border-amber-500/30">
              {usdToLbpRate.toLocaleString()} L.L.
            </span>
          </div>
          <div className="flex items-baseline space-x-2 rtl:space-x-reverse mt-0.5">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {formatUSD(grandTotalUsd)}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-slate-300">
              / {formatLBP(grandTotalLbp)}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-bold"
          title={isCollapsed ? (isAr ? 'إظهار لوحة اللمس' : 'Expand Keypad') : (isAr ? 'تصغير' : 'Collapse')}
        >
          <span>{isAr ? 'لوحة اللمس' : 'Touchpad'}</span>
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Keypad Body */}
      {!isCollapsed && (
        <div className="p-2.5 space-y-2">
          {/* Keypad Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 dark:bg-[#1A1C21] rounded-xl border border-slate-300/60 dark:border-[#282C35]">
            <button
              onClick={() => setActiveTab('qty')}
              className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'qty'
                  ? 'bg-white dark:bg-[#2A2E39] text-[#C83818] dark:text-[#DF7E63] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{isAr ? '🔢 تعديل الكمية (Qty)' : '🔢 Quantity (Qty)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('cash')}
              className={`py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'cash'
                  ? 'bg-white dark:bg-[#2A2E39] text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>{isAr ? '💵 سداد سريع (Fast Cash)' : '💵 Fast Cash'}</span>
            </button>
          </div>

          {/* TAB 1: QUANTITY TOUCHPAD */}
          {activeTab === 'qty' && (
            <div className="space-y-1.5">
              {/* Selected Item Indicator */}
              <div className="px-2.5 py-1.5 bg-white dark:bg-[#1A1C21] rounded-xl border border-slate-200 dark:border-[#282C35] flex items-center justify-between text-xs">
                <div className="min-w-0 truncate">
                  <span className="text-[10px] text-slate-400 font-bold block">
                    {isAr ? 'الصنف المحدد حالياً:' : 'Active Item:'}
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 truncate block">
                    {selectedItem
                      ? isAr
                        ? selectedItem.product.name_ar || selectedItem.product.name_en
                        : selectedItem.product.name_en
                      : isAr
                      ? '(انقر على صنف في السلة)'
                      : '(Tap a cart item to edit)'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400 font-semibold">{isAr ? 'الكمية:' : 'Qty:'}</span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63] font-mono font-black text-sm border border-[#C83818]/30">
                    {selectedItem ? selectedItem.quantity : 0}
                  </span>
                </div>
              </div>

              {/* 5-Column Touch Numpad Grid */}
              <div className="grid grid-cols-5 gap-1 text-xs">
                {/* Row 1 */}
                <button
                  onClick={() => handleDigit('1')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  1
                </button>
                <button
                  onClick={() => handleDigit('2')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  2
                </button>
                <button
                  onClick={() => handleDigit('3')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  3
                </button>
                <button
                  onClick={onIncrement}
                  disabled={!selectedItem}
                  className="h-10 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 text-emerald-700 dark:text-emerald-300 font-black text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs transition-transform disabled:opacity-40"
                >
                  +1
                </button>
                <button
                  onClick={() => handleMultiplier(2)}
                  disabled={!selectedItem}
                  className="h-10 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 text-amber-700 dark:text-amber-300 font-black text-xs rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs transition-transform disabled:opacity-40"
                >
                  x2
                </button>

                {/* Row 2 */}
                <button
                  onClick={() => handleDigit('4')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  4
                </button>
                <button
                  onClick={() => handleDigit('5')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  5
                </button>
                <button
                  onClick={() => handleDigit('6')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  6
                </button>
                <button
                  onClick={onDecrement}
                  disabled={!selectedItem}
                  className="h-10 bg-slate-100 dark:bg-[#21242B] hover:bg-slate-200 dark:hover:bg-[#2A2E39] active:scale-95 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  -1
                </button>
                <button
                  onClick={() => handleMultiplier(3)}
                  disabled={!selectedItem}
                  className="h-10 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 text-amber-700 dark:text-amber-300 font-black text-xs rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs transition-transform disabled:opacity-40"
                >
                  x3
                </button>

                {/* Row 3 */}
                <button
                  onClick={() => handleDigit('7')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  7
                </button>
                <button
                  onClick={() => handleDigit('8')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  8
                </button>
                <button
                  onClick={() => handleDigit('9')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  9
                </button>
                <button
                  onClick={handleBackspace}
                  disabled={!selectedItem}
                  className="h-10 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-95 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-800 shadow-xs transition-transform disabled:opacity-40"
                  title={isAr ? 'مسح رقم' : 'Backspace'}
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMultiplier(5)}
                  disabled={!selectedItem}
                  className="h-10 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 text-amber-700 dark:text-amber-300 font-black text-xs rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs transition-transform disabled:opacity-40"
                >
                  x5
                </button>

                {/* Row 4 */}
                <button
                  onClick={handleClear}
                  disabled={!selectedItem}
                  className="h-10 bg-slate-100 dark:bg-[#21242B] hover:bg-slate-200 dark:hover:bg-[#2A2E39] active:scale-95 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  C
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  0
                </button>
                <button
                  onClick={() => handleDigit('.')}
                  disabled={!selectedItem}
                  className="h-10 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-95 text-slate-900 dark:text-slate-100 font-black text-base rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs transition-transform disabled:opacity-40"
                >
                  .
                </button>
                <button
                  onClick={onRemoveItem}
                  disabled={!selectedItem}
                  className="h-10 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold flex items-center justify-center rounded-xl shadow-xs transition-transform disabled:opacity-40"
                  title={isAr ? 'حذف الصنف' : 'Delete Item'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMultiplier(10)}
                  disabled={!selectedItem}
                  className="h-10 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 text-amber-700 dark:text-amber-300 font-black text-xs rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs transition-transform disabled:opacity-40"
                >
                  x10
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FAST CASH & PRESET BILLS */}
          {activeTab === 'cash' && (
            <div className="space-y-2">
              {/* USD Presets */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>{isAr ? 'أوراق الدولار ($):' : 'USD Cash Bills ($):'}</span>
                  <button
                    onClick={() => handleExactCash('USD')}
                    className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline"
                  >
                    {isAr ? 'كاش تمام ($)' : 'Exact ($)'}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleSelectQuickUsd(amt)}
                      className={`h-9 font-black font-mono text-xs rounded-xl border transition-all ${
                        tenderedUsd === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-[#1A1C21] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-slate-200 dark:border-[#282C35]'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* LBP Presets */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>{isAr ? 'أوراق الليرة (L.L.):' : 'LBP Cash Bills (L.L.):'}</span>
                  <button
                    onClick={() => handleExactCash('LBP')}
                    className="text-amber-600 dark:text-amber-400 font-extrabold hover:underline"
                  >
                    {isAr ? 'كاش تمام (ل.ل)' : 'Exact (L.L.)'}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: '100K', val: 100000 },
                    { label: '250K', val: 250000 },
                    { label: '500K', val: 500000 },
                    { label: '1M', val: 1000000 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => handleSelectQuickLbp(item.val)}
                      className={`h-9 font-black font-mono text-xs rounded-xl border transition-all ${
                        tenderedLbp === item.val
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white dark:bg-[#1A1C21] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-slate-200 dark:border-[#282C35]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Change Indicator */}
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
                    {isAr ? 'المدفوع من الزبون:' : 'Tendered Cash:'}
                  </span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                    {tenderedUsd
                      ? formatUSD(tenderedUsd)
                      : tenderedLbp
                      ? formatLBP(tenderedLbp)
                      : isAr
                      ? 'كاش تمام (Exact)'
                      : 'Exact Amount'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block">
                    {isAr ? 'الباقي للزبون (Change):' : 'Customer Change:'}
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    {changeLbp > 0 ? `${formatLBP(changeLbp)} (${formatUSD(changeUsd)})` : '$0.00'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons: 1-Tap Fast Checkout vs Detailed Payment */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={triggerFastCheckout}
              disabled={cartEmpty || isLoading}
              className="col-span-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{isAr ? 'حفظ وطباعة ⚡' : 'Save & Print ⚡'}</span>
            </button>

            <button
              onClick={onOpenDetailedPayment}
              disabled={cartEmpty || isLoading}
              className="col-span-1 py-3 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252830] active:scale-[0.98] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-[#282C35] flex items-center justify-center gap-1 shadow-xs transition-all disabled:opacity-40"
              title={isAr ? 'دفع مفصل / دين / تقسيم' : 'Detailed / Split Payment'}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isAr ? 'تفصيل' : 'Details'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
