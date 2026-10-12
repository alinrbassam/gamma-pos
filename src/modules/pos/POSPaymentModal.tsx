import React, { useState, useEffect } from 'react';
import { Button } from '@components/ui/Button';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { useExchangeRateStore } from '../../renderer/stores/useExchangeRateStore';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import {
  Banknote,
  CheckCircle2,
  Clock,
  UserCheck,
  Calendar,
  Phone,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number; // Base in USD
  grandTotalLbp?: number; // Exact integer LBP
  onConfirm: (
    payments: {
      paymentMethod: 'Cash' | 'Card' | 'Digital Wallet' | 'Store Credit' | 'Borrow' | 'Credit' | string;
      amount: number;
      referenceNumber?: string;
    }[],
    tendered: number,
    borrowDetails?: {
      customerName: string;
      customerPhone?: string;
      dueDate?: string;
      notes?: string;
    },
    splitCurrencyDetails?: {
      paidUsd: number;
      paidLbp: number;
      changeUsd: number;
      changeLbp: number;
      exchangeRate: number;
    },
  ) => void;
}

export const POSPaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  grandTotal,
  grandTotalLbp: propGrandTotalLbp,
  onConfirm,
}) => {
  const { language } = useLanguageStore();
  const { usdToLbpRate } = useExchangeRateStore();
  const [activeTab, setActiveTab] = useState<'cash' | 'borrow'>('cash');

  // Helper functions for formatting with commas
  const formatWithCommas = (val: string | number): string => {
    if (val === '' || val === null || val === undefined) return '';
    const digits = String(val).replace(/[^\d]/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('en-US');
  };

  const parseCommas = (val: string): number => {
    const digits = String(val).replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  };

  // Split Cash state (USD and LBP)
  const [paidUsd, setPaidUsd] = useState<string>('');
  const [paidLbp, setPaidLbp] = useState<string>('');
  const [preferredChangeCurrency, setPreferredChangeCurrency] = useState<'LBP' | 'USD'>('LBP');

  // Borrow / Credit state (Supports down payments in USD, LBP, or both)
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [downPaymentUsd, setDownPaymentUsd] = useState<string>('');
  const [downPaymentLbp, setDownPaymentLbp] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const grandTotalLbp = propGrandTotalLbp !== undefined ? propGrandTotalLbp : Math.round(grandTotal * usdToLbpRate);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('cash');
      setPaidUsd(grandTotal > 0 ? grandTotal.toFixed(2) : '0');
      setPaidLbp('');
      setPreferredChangeCurrency('LBP');
      setBorrowerName('');
      setBorrowerPhone('');
      setDownPaymentUsd('');
      setDownPaymentLbp('');
      setDueDate('');
      setNotes('');
      setValidationError(null);
    }
  }, [isOpen, grandTotal]);

  // Keyboard shortcut to close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Real-time calculations
  const numPaidUsd = parseFloat(paidUsd) || 0;
  const numPaidLbp = parseCommas(paidLbp);

  // Total paid in USD and LBP equivalents
  const totalPaidUsdEquivalent = numPaidUsd + (numPaidLbp / usdToLbpRate);
  const totalPaidLbpEquivalent = numPaidLbp + Math.round(numPaidUsd * usdToLbpRate);

  const remainingLbp = Math.max(0, grandTotalLbp - totalPaidLbpEquivalent);
  const remainingUsd = Math.max(0, remainingLbp > 0 ? remainingLbp / usdToLbpRate : 0);

  const changeLbp = Math.max(0, totalPaidLbpEquivalent - grandTotalLbp);
  const changeUsd = Math.max(0, changeLbp > 0 ? changeLbp / usdToLbpRate : 0);

  const isFullyPaid = totalPaidLbpEquivalent >= grandTotalLbp - 100 || totalPaidUsdEquivalent >= grandTotal - 0.009;

  // Borrow down payment calculations
  const parsedDownPaymentUsd = parseFloat(downPaymentUsd) || 0;
  const parsedDownPaymentLbp = parseCommas(downPaymentLbp);
  const totalDownPaymentUsd = parsedDownPaymentUsd + (parsedDownPaymentLbp / usdToLbpRate);
  const remainingDebt = Math.max(0, Math.round((grandTotal - totalDownPaymentUsd) * 100) / 100);
  const remainingDebtLbp = Math.round(remainingDebt * usdToLbpRate);

  const handlePayCash = () => {
    if (!isFullyPaid) {
      setValidationError(
        language === 'ar'
          ? 'المبلغ المدفوع غير كافٍ لتغطية إجمالي الفاتورة!'
          : 'Total paid amount is less than grand total!',
      );
      return;
    }

    const payments = [
      {
        paymentMethod: 'Cash',
        amount: grandTotal,
      },
    ];

    onConfirm(
      payments,
      totalPaidUsdEquivalent,
      undefined,
      {
        paidUsd: numPaidUsd,
        paidLbp: numPaidLbp,
        changeUsd: Math.round(changeUsd * 100) / 100,
        changeLbp,
        exchangeRate: usdToLbpRate,
      },
    );
  };

  const handleConfirmBorrow = () => {
    if (!borrowerName.trim()) {
      setValidationError(
        language === 'ar'
          ? 'يرجى إدخال اسم المستدين / الزبون للمتابعة'
          : 'Please enter borrower name to continue',
      );
      return;
    }

    if (totalDownPaymentUsd > grandTotal + 0.01) {
      setValidationError(
        language === 'ar'
          ? 'المبلغ المدفوع مقدماً لا يمكن أن يتجاوز الإجمالي'
          : 'Down payment cannot exceed grand total',
      );
      return;
    }

    const effectiveDownPaymentUsd = Math.round(totalDownPaymentUsd * 100) / 100;

    const payments: {
      paymentMethod: string;
      amount: number;
    }[] = [];

    if (effectiveDownPaymentUsd > 0) {
      payments.push({
        paymentMethod: 'Cash',
        amount: effectiveDownPaymentUsd,
      });
    }

    if (remainingDebt > 0 || effectiveDownPaymentUsd === 0) {
      payments.push({
        paymentMethod: 'Borrow',
        amount: remainingDebt,
      });
    }

    onConfirm(
      payments,
      effectiveDownPaymentUsd,
      {
        customerName: borrowerName.trim(),
        customerPhone: borrowerPhone.trim() || undefined,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      },
      {
        paidUsd: parsedDownPaymentUsd,
        paidLbp: parsedDownPaymentLbp,
        changeUsd: 0,
        changeLbp: 0,
        exchangeRate: usdToLbpRate,
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100 max-h-[95vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-[#21242B]">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <div
              className={`p-2.5 rounded-2xl border ${
                activeTab === 'cash'
                  ? 'bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63] border-[#C83818]/30'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }`}
            >
              {activeTab === 'cash' ? <Banknote className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                {language === 'ar' ? 'إتمام الدفع والدفع المجزأ' : 'Complete Payment & Split Currency'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1 USD = {usdToLbpRate.toLocaleString('en-US')} L.L
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-base p-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Cash vs Borrow */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#1A1C21] rounded-2xl border border-slate-200 dark:border-[#282C35]">
          <button
            type="button"
            onClick={() => {
              setActiveTab('cash');
              setValidationError(null);
            }}
            className={`flex items-center justify-center space-x-2 rtl:space-x-reverse py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'cash'
                ? 'bg-[#C83818] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-[#282C35]'
            }`}
          >
            <Banknote className="h-4 w-4" />
            <span>{language === 'ar' ? 'دفع نقدي / مجزأ ($ + ل.ل)' : 'Cash / Split Payment ($ + L.L)'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('borrow');
              setValidationError(null);
            }}
            className={`flex items-center justify-center space-x-2 rtl:space-x-reverse py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'borrow'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-[#282C35]'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>{language === 'ar' ? 'دين / آجل (On-Credit)' : 'Borrow / On-Credit'}</span>
          </button>
        </div>

        {/* Total Amount Due Banner (Dual Currency) */}
        <div className="p-4 bg-[#C83818]/10 dark:bg-[#C83818]/15 rounded-2xl border border-[#C83818]/30 flex justify-between items-center">
          <div>
            <span className="text-[11px] text-[#C83818] dark:text-[#DF7E63] font-bold uppercase tracking-wider block">
              {language === 'ar' ? 'المبلغ الإجمالي المطلوب:' : 'Total Amount Due:'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#C83818] dark:text-[#DF7E63] font-mono tracking-tight">
              {formatUSD(grandTotal)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block">
              {language === 'ar' ? 'بالليرة اللبنانية:' : 'Equivalent in LBP:'}
            </span>
            <div className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-200 font-mono">
              {formatLBP(grandTotalLbp)}
            </div>
          </div>
        </div>

        {/* CASH / SPLIT PAYMENT TAB */}
        {activeTab === 'cash' && (
          <div className="space-y-4 bg-slate-50 dark:bg-[#1A1C21]/50 p-4 rounded-2xl border border-slate-200 dark:border-[#282C35]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* USD Paid Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'المدفوع بالدولار ($):' : 'Paid in USD ($):'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-base">
                    $
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={paidUsd}
                    onChange={(e) => {
                      setPaidUsd(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-lg font-black text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-[#C83818] focus:outline-none"
                  />
                </div>
                {/* Quick exact USD button */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaidUsd(grandTotal.toFixed(2));
                      setPaidLbp('');
                    }}
                    className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-slate-200 dark:border-[#282C35] hover:bg-[#C83818]/10 text-[11px] font-bold text-[#C83818] dark:text-[#DF7E63] rounded-lg transition-colors"
                  >
                    Exact ${grandTotal.toFixed(2)}
                  </button>
                  {[5, 10, 20, 50, 100]
                    .filter((v) => v >= grandTotal)
                    .slice(0, 3)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setPaidUsd(v.toString());
                          setPaidLbp('');
                        }}
                        className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-slate-200 dark:border-[#282C35] hover:bg-slate-100 dark:hover:bg-[#282C35] text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                      >
                        ${v}
                      </button>
                    ))}
                </div>
              </div>

              {/* LBP Paid Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'ar' ? 'المدفوع بالليرة اللبنانية (L.L):' : 'Paid in LBP (L.L):'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={paidLbp}
                    onChange={(e) => {
                      setPaidLbp(formatWithCommas(e.target.value));
                      setValidationError(null);
                    }}
                    placeholder="0"
                    className="w-full px-3 pr-12 py-2.5 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-lg font-black text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-[#C83818] focus:outline-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                    L.L
                  </div>
                </div>
                {/* Quick exact LBP button */}
                <div className="flex gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setPaidLbp(formatWithCommas(grandTotalLbp));
                      setPaidUsd('');
                    }}
                    className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-slate-200 dark:border-[#282C35] hover:bg-[#C83818]/10 text-[11px] font-bold text-[#C83818] dark:text-[#DF7E63] rounded-lg transition-colors"
                  >
                    Exact {formatLBP(grandTotalLbp)}
                  </button>
                  {[100000, 250000, 500000, 1000000]
                    .filter((v) => v >= grandTotalLbp)
                    .slice(0, 2)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setPaidLbp(formatWithCommas(v));
                          setPaidUsd('');
                        }}
                        className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-slate-200 dark:border-[#282C35] hover:bg-slate-100 dark:hover:bg-[#282C35] text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                      >
                        {formatLBP(v)}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Live Payment Status Banner */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#282C35]">
              {!isFullyPaid ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block">
                        {language === 'ar' ? 'المتبقي للدفع:' : 'Remaining to Pay:'}
                      </span>
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {formatUSD(remainingUsd)} / {formatLBP(remainingLbp)}
                      </span>
                    </div>
                  </div>
                  {/* Fill Remaining in LBP / USD button */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPaidUsd((numPaidUsd + remainingUsd).toFixed(2))}
                      className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-amber-300 dark:border-amber-700 rounded-lg text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                    >
                      + Fill USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidLbp(formatWithCommas(numPaidLbp + remainingLbp))}
                      className="px-2 py-1 bg-white dark:bg-[#0E0F12] border border-amber-300 dark:border-amber-700 rounded-lg text-[10px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                    >
                      + Fill LBP
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {changeUsd > 0.001
                          ? language === 'ar'
                            ? 'الفاتورة مغطاة بالكامل - الباقي للزبون:'
                            : 'Order Covered - Change Due:'
                          : language === 'ar'
                          ? 'المبلغ مدفوع بالكامل بالتمام'
                          : 'Order Fully Paid Exactly'}
                      </span>
                    </div>
                    {changeUsd > 0.001 && (
                      <div className="flex items-center bg-white dark:bg-[#0E0F12] rounded-lg p-0.5 border border-emerald-200 dark:border-emerald-800 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setPreferredChangeCurrency('LBP')}
                          className={`px-2 py-0.5 rounded font-bold transition-colors ${
                            preferredChangeCurrency === 'LBP'
                              ? 'bg-[#C83818] text-white'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Change in LBP
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreferredChangeCurrency('USD')}
                          className={`px-2 py-0.5 rounded font-bold transition-colors ${
                            preferredChangeCurrency === 'USD'
                              ? 'bg-[#C83818] text-white'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Change in USD
                        </button>
                      </div>
                    )}
                  </div>

                  {changeUsd > 0.001 && (
                    <div className="flex items-baseline justify-between pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {preferredChangeCurrency === 'LBP'
                          ? `Return ${formatLBP(changeLbp)} to customer`
                          : `Return ${formatUSD(changeUsd)} to customer`}
                      </span>
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
                        {preferredChangeCurrency === 'LBP' ? formatLBP(changeLbp) : formatUSD(changeUsd)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {validationError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Confirm Cash Payment Button */}
            <Button
              onClick={handlePayCash}
              disabled={!isFullyPaid}
              className={`w-full py-3.5 text-sm font-black rounded-2xl shadow-lg transition-all ${
                isFullyPaid
                  ? 'bg-[#C83818] hover:bg-[#A72B11] text-white shadow-[#C83818]/25 active:scale-[0.99]'
                  : 'bg-slate-300 dark:bg-[#282C35] text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
              <span>
                {language === 'ar'
                  ? `تأكيد الدفع (${formatUSD(grandTotal)})`
                  : `Confirm Payment (${formatUSD(grandTotal)})`}
              </span>
            </Button>
          </div>
        )}

        {/* BORROW / ON-CREDIT TAB */}
        {activeTab === 'borrow' && (
          <div className="space-y-3.5 bg-slate-50 dark:bg-[#1A1C21]/50 p-4 rounded-2xl border border-slate-200 dark:border-[#282C35]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-amber-600" />
                  <span>{language === 'ar' ? 'اسم الزبون / المستدين *:' : 'Customer / Borrower Name *:'}</span>
                </label>
                <input
                  type="text"
                  value={borrowerName}
                  onChange={(e) => {
                    setBorrowerName(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder={language === 'ar' ? 'مثال: أبو علي...' : 'e.g. John Doe...'}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-amber-600" />
                  <span>{language === 'ar' ? 'رقم الهاتف:' : 'Phone Number:'}</span>
                </label>
                <input
                  type="text"
                  value={borrowerPhone}
                  onChange={(e) => setBorrowerPhone(e.target.value)}
                  placeholder="03 / 70 / 71 / 76..."
                  className="w-full px-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Dual Currency Down Payment: USD and LBP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'دفعة أولى بالدولار ($):' : 'Down Payment in USD ($):'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                    $
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={downPaymentUsd}
                    onChange={(e) => {
                      setDownPaymentUsd(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'دفعة أولى بالليرة (L.L):' : 'Down Payment in LBP (L.L):'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={downPaymentLbp}
                    onChange={(e) => {
                      setDownPaymentLbp(formatWithCommas(e.target.value));
                      setValidationError(null);
                    }}
                    placeholder="0"
                    className="w-full px-3 pr-10 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-amber-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400 text-[11px] font-semibold">
                    L.L
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Presets for Down Payment */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-semibold">
                {language === 'ar' ? 'أوراق سريعة للدفعة:' : 'Quick bills:'}
              </span>
              {[250000, 500000, 1000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setDownPaymentLbp(formatWithCommas(val));
                    setValidationError(null);
                  }}
                  className="px-2 py-0.5 bg-white dark:bg-[#0E0F12] border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[10px] font-bold text-amber-700 dark:text-amber-300 rounded-lg transition-colors"
                >
                  +{formatLBP(val)}
                </button>
              ))}
              {(downPaymentUsd || downPaymentLbp) && (
                <button
                  type="button"
                  onClick={() => {
                    setDownPaymentUsd('');
                    setDownPaymentLbp('');
                    setValidationError(null);
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold text-rose-500 hover:text-rose-600 rounded-lg transition-colors ml-auto rtl:ml-0 rtl:mr-auto"
                >
                  {language === 'ar' ? 'مسح الدفعة' : 'Clear'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  <span>{language === 'ar' ? 'تاريخ السداد المتوقع:' : 'Due Date:'}</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span>{language === 'ar' ? 'ملاحظات إضافية:' : 'Notes:'}</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'أي تفاصيل أخرى...' : 'Additional notes...'}
                  className="w-full px-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Remaining Debt Highlight Banner */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 flex justify-between items-center text-xs">
              <div>
                <span className="font-bold text-amber-800 dark:text-amber-300 block">
                  {language === 'ar' ? 'المبلغ المتبقي كدين في الذمة:' : 'Remaining Debt / Credit:'}
                </span>
                {totalDownPaymentUsd > 0 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold block mt-0.5">
                    {language === 'ar' ? 'الدفعة الأولى: ' : 'Down Payment: '}
                    {parsedDownPaymentUsd > 0 && formatUSD(parsedDownPaymentUsd)}
                    {parsedDownPaymentUsd > 0 && parsedDownPaymentLbp > 0 ? ' + ' : ''}
                    {parsedDownPaymentLbp > 0 && formatLBP(parsedDownPaymentLbp)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-base sm:text-lg block">
                  {formatUSD(remainingDebt)}
                </span>
                <span className="font-mono font-bold text-slate-500 dark:text-slate-400 text-xs">
                  {formatLBP(remainingDebtLbp)}
                </span>
              </div>
            </div>

            {validationError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <Button
              onClick={handleConfirmBorrow}
              className="w-full py-3.5 text-sm font-black rounded-2xl shadow-lg bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25 active:scale-[0.99] transition-all"
            >
              <UserCheck className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
              <span>
                {language === 'ar' ? 'تسجيل العملية كدين في الدفتر' : 'Record as Debt / Credit'}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
