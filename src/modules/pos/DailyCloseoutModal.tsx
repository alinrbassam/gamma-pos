import React, { useEffect, useState } from 'react';
import { DailyCloseoutReport } from '@shared/types';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { useConfigStore } from '../../renderer/stores/useConfigStore';
import { useAuthStore } from '../../renderer/stores/useAuthStore';
import { Button } from '@components/ui/Button';
import { Card } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import {
  Moon,
  Printer,
  Calendar,
  CheckCircle2,
  Coins,
  UtensilsCrossed,
  Gamepad2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import { formatDateTime } from '@utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyCloseoutModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { language } = useLanguageStore();
  const { config } = useConfigStore();
  const { user } = useAuthStore();
  const isAr = language === 'ar';

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<DailyCloseoutReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [actualUsd, setActualUsd] = useState<string>('');
  const [actualLbp, setActualLbp] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState(false);

  const loadReport = async (dateStr: string) => {
    setLoading(true);
    try {
      if (window.api?.getDailyCloseoutReport) {
        const res = await window.api.getDailyCloseoutReport(dateStr);
        if (res.success && res.data) {
          setReport(res.data);
          // Autofill counted cash with expected cash initially
          setActualUsd(String(res.data.netCashExpectedUsd || ''));
          setActualLbp(String(res.data.netCashExpectedLbp || ''));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCloseSuccess(false);
      loadReport(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const handleConfirmCloseout = async () => {
    if (!report) return;
    const confirmPrompt = isAr
      ? 'هل أنت متأكد من تأكيد إغلاق اليومية والوردية؟'
      : 'Confirm closing the daily register and shift?';
    if (!window.confirm(confirmPrompt)) return;

    setIsClosing(true);
    try {
      if (window.api?.closeDailyShift) {
        const res = await window.api.closeDailyShift({
          actualCashUsd: parseFloat(actualUsd) || 0,
          actualCashLbp: parseFloat(actualLbp) || 0,
          notes: closingNotes.trim() || undefined,
        });
        if (res.success) {
          setCloseSuccess(true);
          await loadReport(selectedDate);
        }
      }
    } finally {
      setIsClosing(false);
    }
  };

  const handlePrintZReport = () => {
    window.print();
  };

  const countUsdNum = parseFloat(actualUsd) || 0;
  const countLbpNum = parseFloat(actualLbp) || 0;
  const diffUsd = countUsdNum - (report?.netCashExpectedUsd || 0);
  const diffLbp = countLbpNum - (report?.netCashExpectedLbp || 0);

  const storeName = config?.businessName || (isAr ? 'غاما كافيه ولاونج' : 'Gamma Café & Lounge');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111317] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#21242B] max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#21242B] flex items-center justify-between bg-slate-50 dark:bg-[#16181E]">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              <Moon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {isAr ? 'تقفيل اليومية والصندوق (Z-Report) 🌙' : 'End-of-Day Closeout (Z-Report) 🌙'}
                </h2>
                {report && (
                  <Badge variant={report.shiftStatus === 'Open' ? 'warning' : 'success'}>
                    {report.shiftStatus === 'Open'
                      ? isAr
                        ? 'الوردية مفتوحة'
                        : 'Shift Open'
                      : isAr
                      ? 'الوردية مقفلة'
                      : 'Shift Closed'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'ملخص الإيرادات والمصاريف اليومية، مطابقة الكاش في الصندوق، وإصدار تقرير الإقفال.'
                  : 'Daily revenue, expense deductions, cash drawer reconciliation, and Z-report.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="flex items-center space-x-1.5 rtl:space-x-reverse bg-white dark:bg-[#0E0F12] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#282C35]">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1E2028] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {closeSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 rtl:space-x-reverse text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                {isAr
                  ? 'تم تأكيد إغلاق اليومية والوردية بنجاح! تم حفظ السجلات.'
                  : 'Daily register closeout successfully recorded!'}
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-purple-600 border-t-transparent mb-2" />
              <p className="text-xs font-bold">
                {isAr ? 'جاري حساب إجمالي اليومية...' : 'Calculating daily summary...'}
              </p>
            </div>
          ) : report ? (
            <>
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 bg-gradient-to-br from-slate-900 to-[#181A20] text-white space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-400">
                    {isAr ? 'إجمالي المبيعات' : 'Total Revenue'}
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-400">
                    {formatUSD(report.totalSalesUsd)}
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-300">
                    {formatLBP(report.totalSalesLbp)}
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1 border-l-4 border-l-sky-500 rtl:border-l-0 rtl:border-r-4 rtl:border-r-sky-500">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    {isAr ? 'عدد الفواتير / الطلبات' : 'Total Orders'}
                  </span>
                  <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
                    {report.totalOrders}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isAr ? 'طلب مسجل اليوم' : 'Completed tickets'}
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1 border-l-4 border-l-amber-500 rtl:border-l-0 rtl:border-r-4 rtl:border-r-amber-500">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    {isAr ? 'الديون والآجل (غير مقبوض)' : 'Total Debts (Unpaid)'}
                  </span>
                  <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                    {formatUSD(report.debtsTotalUsd)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {report.debtsCount} {isAr ? 'زبائن آجل' : 'debt customers'}
                  </div>
                </Card>

                <Card className="p-3.5 space-y-1 border-l-4 border-l-rose-500 rtl:border-l-0 rtl:border-r-4 rtl:border-r-rose-500">
                  <span className="text-[10px] font-black uppercase text-slate-400">
                    {isAr ? 'المصاريف اليومية المسجلة' : 'Store Expenses'}
                  </span>
                  <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                    {report.totalExpensesUsd > 0
                      ? formatUSD(report.totalExpensesUsd)
                      : formatLBP(report.totalExpensesLbp)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {report.expensesCount} {isAr ? 'مصاريف تشغيل' : 'expense entries'}
                  </div>
                </Card>
              </div>

              {/* Net Expected Cash in Drawer */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Coins className="h-4 w-4" />
                    <span>{isAr ? 'الكاش المتوقع في الدرج (Net Cash Drawer)' : 'Expected Net Cash in Drawer'}</span>
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isAr
                      ? 'صافي النقد المحصل من الزبائن بعد خصم مصاريف اليوم والديون غير المقبوضة.'
                      : 'Net customer cash collected minus operating expense payouts.'}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-right rtl:text-left">
                  <div className="bg-white dark:bg-[#16181E] px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? 'كاش دولار ($):' : 'Cash USD ($):'}
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatUSD(report.netCashExpectedUsd)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#16181E] px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {isAr ? 'كاش ليرة (ل.ل):' : 'Cash LBP (L.L.):'}
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {formatLBP(report.netCashExpectedLbp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Department Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-[#16181E] rounded-xl border border-slate-200 dark:border-[#282C35] space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-amber-500" />
                      <span>{isAr ? 'مبيعات الكاشير المباشرة' : 'Direct POS Takeaway'}</span>
                    </span>
                    <Badge variant="neutral">{report.takeawayCount}</Badge>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                      {formatUSD(report.takeawayTotalUsd)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatLBP(report.takeawayTotalLbp)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#16181E] rounded-xl border border-slate-200 dark:border-[#282C35] space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <UtensilsCrossed className="h-4 w-4 text-emerald-500" />
                      <span>{isAr ? 'طاولات الصالة ☕' : 'Dine-In Tables ☕'}</span>
                    </span>
                    <Badge variant="neutral">{report.dineInCount}</Badge>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                      {formatUSD(report.dineInTotalUsd)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatLBP(report.dineInTotalLbp)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#16181E] rounded-xl border border-slate-200 dark:border-[#282C35] space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 className="h-4 w-4 text-indigo-500" />
                      <span>{isAr ? 'صالة البلايستيشن 🎮' : 'PlayStation Lounge 🎮'}</span>
                    </span>
                    <Badge variant="neutral">{report.playstationCount}</Badge>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                      {formatUSD(report.playstationTotalUsd)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatLBP(report.playstationTotalLbp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Cash Count & Discrepancy Reconciliation */}
              <div className="p-4 bg-slate-50 dark:bg-[#16181E] rounded-2xl border border-slate-200 dark:border-[#282C35] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">
                      {isAr ? 'مطابقة الجرد الفعلي للصندوق (Cash Reconciliation)' : 'Physical Drawer Cash Count'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isAr
                        ? 'أدخل المبالغ النقدية الموجودة فعلياً في الدرج لمطابقتها مع الحسابات.'
                        : 'Enter the actual counted cash in drawer to verify variances.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'الكاش الفعلي بالدولار ($ Counted):' : 'Actual Counted USD ($):'}
                    </label>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <input
                        type="number"
                        step="any"
                        value={actualUsd}
                        onChange={(e) => setActualUsd(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                      />
                      <span
                        className={`text-xs font-bold font-mono px-2 py-1 rounded-lg ${
                          diffUsd === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                            : diffUsd > 0
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-700'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                        }`}
                      >
                        {diffUsd === 0
                          ? isAr
                            ? 'متطابق'
                            : 'Match'
                          : diffUsd > 0
                          ? `+${diffUsd.toFixed(2)}`
                          : `${diffUsd.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {isAr ? 'الكاش الفعلي بالليرة (L.L. Counted):' : 'Actual Counted LBP (L.L.):'}
                    </label>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <input
                        type="number"
                        step="1000"
                        value={actualLbp}
                        onChange={(e) => setActualLbp(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                      />
                      <span
                        className={`text-xs font-bold font-mono px-2 py-1 rounded-lg ${
                          diffLbp === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                            : diffLbp > 0
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-700'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                        }`}
                      >
                        {diffLbp === 0
                          ? isAr
                            ? 'متطابق'
                            : 'Match'
                          : diffLbp > 0
                          ? `+${diffLbp.toLocaleString()}`
                          : `${diffLbp.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder={
                      isAr
                        ? 'ملاحظات إغلاق اليومية (اختياري)...'
                        : 'Optional closing remarks / shift notes...'
                    }
                    className="w-full px-3 py-1.5 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs text-slate-700 dark:text-slate-300 outline-none"
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Action Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#21242B] flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-[#16181E]">
          <Button variant="outline" onClick={onClose} disabled={isClosing}>
            {isAr ? 'إغلاق النافذة' : 'Close'}
          </Button>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintZReport}
              disabled={!report || loading}
              className="flex items-center space-x-1.5 rtl:space-x-reverse border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            >
              <Printer className="h-4 w-4" />
              <span>{isAr ? 'طباعة تقرير Z-Report 🖨️' : 'Print Thermal Z-Report 🖨️'}</span>
            </Button>

            <Button
              type="button"
              onClick={handleConfirmCloseout}
              isLoading={isClosing}
              disabled={!report || loading || isClosing}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1.5 rtl:space-x-reverse font-bold shadow-md shadow-purple-600/25"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isAr ? 'تأكيد تقفيل اليومية ✅' : 'Confirm Close Day ✅'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden Thermal Print Template for Z-Report */}
      {report && (
        <div id="thermal-z-report" className="hidden print:block print:fixed print:inset-0 print:m-0 print:p-4 print:bg-white print:text-black print:font-mono text-xs max-w-[80mm]">
          <div className="text-center font-bold pb-2 border-b border-dashed border-black">
            <h1 className="text-sm font-black uppercase">{storeName}</h1>
            <p className="text-[10px]">*** تقرير الإقفال اليومي (Z-REPORT) ***</p>
            <p className="text-[10px]">{formatDateTime(report.generatedAt)}</p>
            <p className="text-[9px]">التاريخ: {report.date} | الكاشير: {user?.full_name || user?.username || 'Cashier'}</p>
          </div>

          <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-black">
            <div className="flex justify-between font-bold">
              <span>عدد الفواتير الكلي:</span>
              <span>{report.totalOrders}</span>
            </div>
            <div className="flex justify-between font-black">
              <span>إجمالي المبيعات ($):</span>
              <span>{formatUSD(report.totalSalesUsd)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>إجمالي المبيعات (ل.ل):</span>
              <span>{formatLBP(report.totalSalesLbp)}</span>
            </div>
          </div>

          <div className="py-2 space-y-1 text-[10px] border-b border-dashed border-black">
            <p className="font-bold underline pb-0.5">توزيع الأقسام:</p>
            <div className="flex justify-between">
              <span>طلبات مباشرة (تيك أواي):</span>
              <span>{report.takeawayCount} ({formatUSD(report.takeawayTotalUsd)})</span>
            </div>
            <div className="flex justify-between">
              <span>طاولات الصالة ☕:</span>
              <span>{report.dineInCount} ({formatUSD(report.dineInTotalUsd)})</span>
            </div>
            <div className="flex justify-between">
              <span>صالة البلايستيشن 🎮:</span>
              <span>{report.playstationCount} ({formatUSD(report.playstationTotalUsd)})</span>
            </div>
          </div>

          <div className="py-2 space-y-1 text-[10px] border-b border-dashed border-black">
            <p className="font-bold underline pb-0.5">حركة الصندوق والكاش:</p>
            <div className="flex justify-between">
              <span>كاش دولار مقبوض:</span>
              <span>{formatUSD(report.cashUsdCollected)}</span>
            </div>
            <div className="flex justify-between">
              <span>كاش ليرة مقبوض:</span>
              <span>{formatLBP(report.cashLbpCollected)}</span>
            </div>
            <div className="flex justify-between">
              <span>ديون وآجل (غير مقبوض):</span>
              <span>{formatUSD(report.debtsTotalUsd)} ({report.debtsCount})</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>المصاريف المخصومة:</span>
              <span>-{formatUSD(report.totalExpensesUsd)} | -{formatLBP(report.totalExpensesLbp)}</span>
            </div>
          </div>

          <div className="py-2 space-y-1 text-[11px] font-black border-b border-dashed border-black">
            <div className="flex justify-between">
              <span>الكاش المتوقع ($):</span>
              <span>{formatUSD(report.netCashExpectedUsd)}</span>
            </div>
            <div className="flex justify-between">
              <span>الكاش المتوقع (ل.ل):</span>
              <span>{formatLBP(report.netCashExpectedLbp)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[10px]">
              <span>الجرد الفعلي المحسوب:</span>
              <span>${countUsdNum} | {countLbpNum.toLocaleString()} L.L.</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>فارق الصندوق:</span>
              <span>${diffUsd.toFixed(2)} | {diffLbp.toLocaleString()} L.L.</span>
            </div>
          </div>

          <div className="pt-4 text-center text-[10px] space-y-2">
            <p>توقيع المستلم / المدير: ___________________</p>
            <p className="text-[8px] text-gray-500">GAMMA POS SYSTEM - END OF DAY REPORT</p>
          </div>
        </div>
      )}
    </div>
  );
};
export default DailyCloseoutModal;
